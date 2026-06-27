/**
 * Continuity validator — the Tier-1 "physics-engine" lint layer.
 *
 * Runs deterministic continuity checks over the files the platform already parses
 * (the per-scene continuity manifests + each shot's nb-prompt), with no new data
 * model and no change to how the storyboard skill authors. It turns the hand-run
 * audits from `skills/story-saint-storyboard` into code:
 *
 *   L01  state continuity      — a character's posture cannot teleport between
 *                                consecutive on-camera shots without a transitional beat.
 *   L02  manifest -> prompt     — the posture/contact the manifest declares for a shot
 *                                must actually appear in that shot's prompt (silence is a
 *                                failure), and the prompt must not assert a contradictory one.
 *   L04  action-target presence — a transitive action referencing an element needs that
 *                                element listed in the shot.
 *   L06  held-object continuity — an object the manifest says is in-hand (and the framing
 *                                shows the hand) must be named in the prompt.
 *   L09  on-screen text         — a diegetic on-screen string must read identically everywhere.
 *   L12  perspective coherence  — a strict top-down/bird's-eye shot must not describe a
 *                                horizon/sky/shoreline (the fake-perspective clash from pasting
 *                                an eye-level [World Plate] into an overhead frame).
 *
 * The manifest (`storyboard/continuity/scene-N-objects.md`) is the source of truth for
 * physical state; the prompt is checked against it. See physics-engine/ for the full design.
 */
import path from "path";
import matter from "gray-matter";
import { fileStore } from "./file-store.js";
import type { ProjectIndex, Shot, Character } from "../types.js";
import { UNFLATTERING_RE, BUILD_TOKEN } from "./physics-vocab.js";

// ────────────────────────────────────────────────────────────────────────────
// Issue / report shapes
// ────────────────────────────────────────────────────────────────────────────

export type ContinuityRule = "L01" | "L02" | "L03" | "L04" | "L05" | "L06" | "L07" | "L09" | "L11" | "L12";
export type ContinuitySeverity = "error" | "warning";

export interface ContinuityIssue {
  rule: ContinuityRule;
  severity: ContinuitySeverity;
  scene: number | null;
  shotCode: string;
  /** Second shot, for cross-shot rules (L01 reports the pair). */
  shotCodeB?: string;
  character?: string;
  object?: string;
  message: string;
}

export interface ContinuityReport {
  project: string;
  timestamp: string;
  scenes: number[];
  shotsChecked: number;
  totalErrors: number;
  totalWarnings: number;
  issues: ContinuityIssue[];
}

// ────────────────────────────────────────────────────────────────────────────
// Contact (posture) classification — the load-bearing axis (pinned != standing)
// ────────────────────────────────────────────────────────────────────────────

export type Contact =
  | "standing"
  | "kneeling"
  | "seated"
  | "grounded" // prone / supine / pinned / fallen all fold into the "down" group
  | "rising"
  | "sitting-down"
  | "walking"
  | "turning";

/** Static contacts that conflict if they disagree; transitional ones bridge a change. */
const CONTACT_GROUP: Record<Contact, string | null> = {
  standing: "stand",
  walking: null, // transitional (also implies standing) — bridges, never conflicts
  turning: null,
  seated: "sit",
  kneeling: "kneel",
  grounded: "down",
  rising: null,
  "sitting-down": null,
};

const TRANSITIONAL: ReadonlySet<Contact> = new Set<Contact>([
  "walking",
  "turning",
  "rising",
  "sitting-down",
]);

// Order matters: more specific phrases first so "about to stand" reads as rising, not standing.
const CONTACT_PATTERNS: Array<[RegExp, Contact]> = [
  [/\bpinned\b/, "grounded"],
  [/\b(prone|supine|sprawl\w*|fallen|collapsed|slumped|lying|on (his|her|their|its|the )?(back|side|stomach|floor|ground))\b/, "grounded"],
  [/\b(on (the )?(floor|ground)|grounded)\b/, "grounded"],
  [/\b(kneel\w*|on (his|her|their) knees)\b/, "kneeling"],
  [/\b(rising|rises|getting up|push\w* up|about to stand|standing up|stands up|gets up|to (his|her|their) feet|to full height|one knee (up|driven|rais\w*)|knee (driven|drives) up|foot planting|plant\w* (his |her |the )?(foot|trainer|knee)|weight (shift\w*|transfer\w*) (up|onto|into))\b/, "rising"],
  [/\b(sitting down|sits down|lowering (himself|herself|themselves)|taking a seat)\b/, "sitting-down"],
  [/\b(seated|sitting|sits\b|sat\b)\b/, "seated"],
  [/\b(walk\w*|run\w*|scrambl\w*|stepping|step\w* (up|onto|to)|mid-exit|exiting|crossing|strides?|striding|pacing|climb\w*|ascend\w*|foot (lifting|reaching) (to|toward|onto))\b/, "walking"],
  [/\b(turn\w*|pivot\w*)\b/, "turning"],
  [/\b(standing|stands|stood|upright|on (his|her|their) feet)\b/, "standing"],
];

export function classifyContacts(text: string | undefined | null): Set<Contact> {
  const out = new Set<Contact>();
  if (!text) return out;
  const lower = text.toLowerCase();
  for (const [re, contact] of CONTACT_PATTERNS) {
    if (re.test(lower)) out.add(contact);
  }
  return out;
}

/** The distinct static groups implied by a set of contacts (transitional ones contribute none). */
function staticGroups(contacts: Set<Contact>): Set<string> {
  const g = new Set<string>();
  for (const c of contacts) {
    const grp = CONTACT_GROUP[c];
    if (grp) g.add(grp);
  }
  return g;
}

function hasTransitional(contacts: Set<Contact>): boolean {
  for (const c of contacts) if (TRANSITIONAL.has(c)) return true;
  return false;
}

function disjointStatic(a: Set<Contact>, b: Set<Contact>): boolean {
  const ga = staticGroups(a);
  const gb = staticGroups(b);
  if (ga.size === 0 || gb.size === 0) return false;
  for (const x of ga) if (gb.has(x)) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Manifest parsing — handles BOTH on-disk table schemas:
//   rich:   | Shot | Position | Posture | Facing | Holding | Wearing | Visible? |
//   simple: | Shot | Location | State   | Visible? | Notes |
// ────────────────────────────────────────────────────────────────────────────

export interface ManifestRow {
  shot: string;
  visible: boolean;
  posture?: string; // Posture column, else State column, else Opening state
  position?: string; // Position / Location column
  facing?: string;
  holding?: string; // raw Holding column
  wearing?: string;
  notes?: string;
  /** Opening/Closing-state schema (crawler-style resolved timeline). */
  opening?: string;
  closing?: string;
}

export interface ManifestSection {
  scene: number;
  title: string;
  kind: "character" | "object";
  characterName?: string; // resolved display name when kind === 'character'
  /** Section title reduced to a likely object noun (kind === 'object'). */
  objectNoun?: string;
  rows: ManifestRow[];
}

export interface SceneManifest {
  scene: number;
  setting: string;
  path: string;
  sections: ManifestSection[];
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[?*]/g, "")
    .replace(/[\s_\-]+/g, "")
    .trim();
}

function splitTableRow(line: string): string[] {
  // | a | b | c |  -> ['a','b','c']
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|?\s*:?-{2,}/.test(line.trim()) && line.includes("-");
}

function visibleFromCell(cell: string | undefined): boolean {
  if (!cell) return false;
  const v = cell.trim().toLowerCase();
  // "Yes — WS", "Yes (primary)", "Partial — hand only" are on-camera; "No — …" is not.
  if (v.startsWith("no")) return false;
  if (v.startsWith("yes") || v.startsWith("partial") || v.startsWith("y ")) return true;
  return false;
}

/** Strip a section heading down to its subject ("Peter (character …)" -> "Peter"). */
function headingSubject(heading: string): string {
  return heading
    .replace(/^#+\s*/, "")
    .split(/—|–|\(|:/)[0]
    .trim();
}

function resolveCharacterName(subject: string, knownNames: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ns = norm(subject);
  if (!ns) return null;
  // exact normalized match
  for (const name of knownNames) if (norm(name) === ns) return name;
  // unique prefix / first-name match ("Peter" -> "Peter Nightingale")
  const matches = knownNames.filter((name) => {
    const parts = name.split(/\s+/).map(norm);
    return parts.includes(ns) || norm(name).startsWith(ns) || ns.startsWith(parts[0]);
  });
  return matches.length === 1 ? matches[0] : null;
}

const STOPWORDS = new Set(["the", "a", "an", "of", "and"]);

/** A crude object noun for L06 presence checks: last meaningful word of the title. */
function objectNounFromTitle(title: string): string {
  const cleaned = headingSubject(title)
    .toLowerCase()
    .replace(/[()'’.,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  return cleaned.length ? cleaned[cleaned.length - 1] : headingSubject(title).toLowerCase();
}

export function parseManifestFile(filePath: string, knownNames: string[]): SceneManifest | null {
  if (!fileStore().exists(filePath)) return null;
  const raw = fileStore().readText(filePath);
  const { data, content } = matter(raw);
  // scene may be a number, or a label like "Floor 1 — present (1A–1C…)" — extract the integer.
  const scene =
    typeof data.scene === "number"
      ? data.scene
      : Number(String(data.scene ?? "").match(/\d+/)?.[0] ?? 0);
  const setting = (data.setting as string) ?? "";

  const lines = content.split("\n");
  const sections: ManifestSection[] = [];
  let currentHeading: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{2,})\s+(.*)$/);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
      continue;
    }

    // Table start: a header row followed by a separator row.
    if (line.trim().startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headers = splitTableRow(line).map(normHeader);
      const col = (...names: string[]): number => {
        for (const n of names) {
          const idx = headers.indexOf(n);
          if (idx !== -1) return idx;
        }
        return -1;
      };
      const cShot = col("shot");
      const cVisible = col("visible");
      const cPosture = col("posture");
      const cState = col("state");
      const cOpening = col("openingstate", "opening");
      const cClosing = col("closingstate", "closing");
      const cPosition = col("position", "location");
      const cFacing = col("facing");
      const cHolding = col("holding");
      const cWearing = col("wearing");
      const cNotes = col("notes");
      const hasVisibleCol = cVisible !== -1;

      const rows: ManifestRow[] = [];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const rl = lines[j];
        if (!rl.trim().startsWith("|")) break;
        const cells = splitTableRow(rl);
        const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : undefined);
        const shot = get(cShot);
        if (!shot) continue;
        const opening = get(cOpening);
        const closing = get(cClosing);
        rows.push({
          shot,
          // A timeline with no Visible column lists only on-camera rows — treat as visible.
          visible: hasVisibleCol ? visibleFromCell(get(cVisible)) : true,
          posture: get(cPosture) ?? get(cState) ?? opening,
          position: get(cPosition),
          facing: get(cFacing),
          holding: get(cHolding),
          wearing: get(cWearing),
          notes: get(cNotes),
          opening,
          closing,
        });
      }
      i = j - 1;

      const title = currentHeading ?? "(untitled)";
      const subject = headingSubject(title);
      const characterName = resolveCharacterName(subject, knownNames);
      sections.push({
        scene,
        title,
        kind: characterName ? "character" : "object",
        characterName: characterName ?? undefined,
        objectNoun: characterName ? undefined : objectNounFromTitle(title),
        rows,
      });
    }
  }

  return { scene, setting, path: filePath, sections };
}

export function loadManifests(projectDir: string, knownNames: string[]): SceneManifest[] {
  const dir = path.join(projectDir, "storyboard", "continuity");
  if (!fileStore().exists(dir)) return [];
  return fileStore()
    .readDir(dir)
    .map((e) => e.name)
    .filter((f) => /scene-.*-objects\.md$/.test(f))
    .map((f) => parseManifestFile(path.join(dir, f), knownNames))
    .filter((m): m is SceneManifest => m !== null)
    .sort((a, b) => a.scene - b.scene);
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt access helpers
// ────────────────────────────────────────────────────────────────────────────

/** The nanobanana still prompt for a shot (nb-prompt.md lands in mjPrompt w/ platform nanobanana). */
function nbPrompt(shot: Shot): { body: string; sections: Record<string, string> } | null {
  if (shot.mjPrompt && shot.mjPrompt.meta.platform === "nanobanana") {
    return { body: shot.mjPrompt.body, sections: shot.mjPrompt.sections };
  }
  if (shot.nanoBanana) return { body: shot.nanoBanana.body, sections: shot.nanoBanana.sections };
  return null;
}

/** [Subject] + [Action] text — where physical state lives — falling back to the whole body. */
function actionText(p: { body: string; sections: Record<string, string> }): string {
  const subj = p.sections["subject"] ?? "";
  const act = p.sections["action"] ?? "";
  const joined = `${subj}\n${act}`.trim();
  return joined || p.body;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Aliases for a character: element_name (`@peterNightingale`), full name, and each
 * significant name word (so "Hale" matches "Monsignor Hale", and a shared surname like
 * "Reeves" matches every sibling — which conservatively suppresses attribution rather
 * than misattributing it).
 */
function aliasesOf(c: Character): string[] {
  const set = new Set<string>();
  if (c.meta.element_name) set.add(c.meta.element_name);
  if (c.name) set.add(c.name);
  for (const w of (c.name ?? "").split(/\s+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w.toLowerCase())) set.add(w);
  }
  return [...set];
}

/**
 * Token-boundary alias matcher. The leading/trailing alnum guards stop a surname
 * matching inside another token (e.g. "Reeves" inside "@sarahReeves", or one Reeves
 * sibling inside another) — the bug that wrecked naive windowing.
 */
function mentionsChar(text: string, c: Character): boolean {
  for (const n of aliasesOf(c)) {
    if (new RegExp(`(?<![A-Za-z0-9])@?${escapeRe(n)}(?![A-Za-z0-9])`, "i").test(text)) return true;
  }
  return false;
}

interface CharSentence {
  text: string;
  soleSubject: boolean; // names the target and no other tracked character
}

/**
 * Sentence-level attribution: every sentence that names the target, flagged for whether
 * it names the target alone. Robust to two-handers where both figures are described in
 * both [Subject] and [Action] — we union over all naming sentences instead of slicing a
 * single window that interleaving breaks.
 */
function sentencesFor(text: string, target: Character, tracked: Character[]): CharSentence[] {
  const sentences = text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const others = tracked.filter((c) => c !== target);
  const out: CharSentence[] = [];
  for (const s of sentences) {
    if (!mentionsChar(s, target)) continue;
    out.push({ text: s, soleSubject: !others.some((o) => mentionsChar(s, o)) });
  }
  return out;
}

// A face/insert framing shows no body, so posture is correctly absent (spec A4 / B5).
// MCU is deliberately NOT here: a medium close-up often frames the torso (e.g. an action
// MCU showing a pinned figure), so we rely on a face-only PROMPT cue to exclude those.
const NO_BODY_SHOTTYPE_RE = /\b(ECU|extreme close-?up|close-?up|closeup|insert|macro)\b|\bCU\b/i;
const FACE_ONLY_PROMPT_RE =
  /face and upper chest|tight on (his |her |the )?face|head and shoulders|face fill\w* the frame|close-?up (of|on) (his |her |the )?face|only (his |her |the )?face/i;

export function bodyVisible(shot: Shot, promptText?: string): boolean {
  const st = shot.meta.shot_type ?? "";
  if (NO_BODY_SHOTTYPE_RE.test(st)) return false;
  if (promptText && FACE_ONLY_PROMPT_RE.test(promptText)) return false;
  return true;
}

// Manifest annotations that say only a fragment of the figure is in frame — posture is
// not assertable for that character in that shot (e.g. an OTS foreground shoulder/head).
const PARTIAL_FRAMING_RE = /shoulder\/head|\bOTS\b|off-camera|hand only|insert|back of head/i;

// ────────────────────────────────────────────────────────────────────────────
// Rules
// ────────────────────────────────────────────────────────────────────────────

interface Ctx {
  manifests: SceneManifest[];
  shotByCode: Map<string, Shot>;
  charByName: Map<string, Character>;
  /** element_name → element (any kind), for resolving a shot's elements to their sheets. */
  charByElement: Map<string, Character>;
  /** Real characters the manifest tracks (excludes environment elements) — used for attribution. */
  trackedChars: Character[];
}

/** L01 — posture cannot teleport between consecutive on-camera shots without a transitional beat. */
function lintStateContinuity(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  for (const m of ctx.manifests) {
    for (const sec of m.sections) {
      if (sec.kind !== "character") continue;
      // Compare the previous shot's CLOSING state to this shot's OPENING state (the manifest's
      // own rule). When the schema has no separate closing, both fall back to the row posture.
      let prev: { row: ManifestRow; closing: Set<Contact> } | null = null;
      for (const row of sec.rows) {
        if (!row.visible) continue; // off-camera: not a "previous state" anchor
        const opening = classifyContacts(`${row.opening ?? row.posture ?? ""} ${row.position ?? ""}`);
        const closing = classifyContacts(`${row.closing ?? row.opening ?? row.posture ?? ""} ${row.position ?? ""}`);
        if (staticGroups(opening).size === 0 && !hasTransitional(opening) && staticGroups(closing).size === 0) {
          continue; // unreadable row — don't anchor on it
        }
        if (prev) {
          const bridged = hasTransitional(prev.closing) || hasTransitional(opening);
          if (!bridged && disjointStatic(prev.closing, opening)) {
            issues.push({
              rule: "L01",
              severity: "warning",
              scene: m.scene,
              shotCode: prev.row.shot,
              shotCodeB: row.shot,
              character: sec.characterName,
              message: `${sec.characterName}: posture jumps "${(prev.row.closing ?? prev.row.posture ?? "").trim()}" (${prev.row.shot}) → "${(row.opening ?? row.posture ?? "").trim()}" (${row.shot}) with no transitional beat — declare the transition or add an intervening rise/sit/turn.`,
            });
          }
        }
        prev = { row, closing };
      }
    }
  }
  return issues;
}

/** L02 — the manifest posture must appear in the shot's prompt (no silence, no contradiction). */
function lintManifestToPrompt(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  for (const m of ctx.manifests) {
    for (const sec of m.sections) {
      if (sec.kind !== "character") continue;
      const char = sec.characterName ? ctx.charByName.get(sec.characterName) : undefined;
      if (!char) continue;
      for (const row of sec.rows) {
        if (!row.visible) continue;
        const manifestContacts = classifyContacts(`${row.posture ?? ""} ${row.position ?? ""}`);
        if (manifestContacts.size === 0) continue; // nothing declared to enforce
        if (PARTIAL_FRAMING_RE.test(`${row.posture ?? ""} ${row.notes ?? ""}`)) continue; // OTS shoulder/head, insert — not assertable

        const shot = ctx.shotByCode.get(row.shot);
        const p = shot ? nbPrompt(shot) : null;
        if (!p) continue; // no still prompt to check (e.g. pure video / not authored yet)

        const text = actionText(p);
        if (!bodyVisible(shot!, text)) continue; // face CU / insert / face-only — posture not shown (A4)

        if (!mentionsChar(text, char)) {
          issues.push({
            rule: "L02",
            severity: "warning",
            scene: m.scene,
            shotCode: row.shot,
            character: sec.characterName,
            message: `${sec.characterName} is on-camera (manifest: "${(row.posture ?? "").trim()}") but is not referenced in the nb-prompt [Subject]/[Action].`,
          });
          continue;
        }

        // In a single-subject shot every sentence is about that character, so attribute the
        // whole text. Only fall back to per-sentence attribution in a genuine multi-hander.
        const referenced = ctx.trackedChars.filter((c) => mentionsChar(text, c));
        let attributed: Set<Contact>;
        let soleContacts: Set<Contact>;
        if (referenced.length <= 1) {
          attributed = classifyContacts(text);
          soleContacts = attributed;
        } else {
          const sents = sentencesFor(text, char, ctx.trackedChars);
          attributed = classifyContacts(sents.map((s) => s.text).join(" "));
          soleContacts = classifyContacts(sents.filter((s) => s.soleSubject).map((s) => s.text).join(" "));
        }

        // Omission: the manifest declares a posture but no attributable sentence carries one.
        if (attributed.size === 0) {
          issues.push({
            rule: "L02",
            severity: "error",
            scene: m.scene,
            shotCode: row.shot,
            character: sec.characterName,
            message: `${sec.characterName}: prompt omits posture — manifest says "${(row.posture ?? "").trim()}" but no sentence naming them states a contact/posture. Silence renders the model default (usually standing).`,
          });
          continue;
        }

        // Contradiction: from safely-attributed (sole-subject) text only, and only when
        // neither side is mid-transition (a rise/turn legitimately spans two postures).
        if (
          !hasTransitional(manifestContacts) &&
          !hasTransitional(soleContacts) &&
          disjointStatic(manifestContacts, soleContacts)
        ) {
          issues.push({
            rule: "L02",
            severity: "error",
            scene: m.scene,
            shotCode: row.shot,
            character: sec.characterName,
            message: `${sec.characterName}: prompt posture contradicts manifest — manifest "${(row.posture ?? "").trim()}" (${[...staticGroups(manifestContacts)].join("/")}) vs prompt (${[...staticGroups(soleContacts)].join("/")}).`,
          });
        }
      }
    }
  }
  return issues;
}

const HELD_VERBS = /(hold\w*|grip\w*|clutch\w*|carr\w*|wield\w*|in (his|her|their|its) (hand|fist|grasp)|picked up|pocket\w*)/i;

// Pull held-object head nouns from in-hand phrasing ("shard in fist", "stone shard in his hand").
const HELD_NOUN_RE = /([A-Za-z][\w\- ]*?)\s+(?:loose\s+)?in\s+(?:his |her |their |the )?(?:\w+\s+)?(?:fist|hand|hands|grasp)/gi;
function heldNounsFrom(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  HELD_NOUN_RE.lastIndex = 0;
  while ((m = HELD_NOUN_RE.exec(text)) !== null) {
    const head = m[1].replace(/^\W+|\W+$/g, "").trim().toLowerCase().split(/\s+/).pop();
    if (head && head.length > 1 && !["nothing", "none", "empty"].includes(head)) out.add(head);
  }
  return [...out];
}

/** L06 — an object the manifest puts in-hand (with the hand in frame) must be named in the prompt. */
function lintHeldObject(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const seen = new Set<string>();

  const check = (
    scene: number,
    shotCode: string,
    objNoun: string,
    label: string,
    character?: string,
  ) => {
    const key = `${shotCode}::${objNoun}`;
    if (seen.has(key)) return;
    const shot = ctx.shotByCode.get(shotCode);
    const p = shot ? nbPrompt(shot) : null;
    if (!p) return;
    if (!new RegExp(`\\b${escapeRe(objNoun)}s?\\b`, "i").test(p.body)) {
      seen.add(key);
      issues.push({
        rule: "L06",
        severity: "warning",
        scene,
        shotCode,
        object: objNoun,
        character,
        message: `${label} per manifest in ${shotCode} but "${objNoun}" is not named in the nb-prompt — held objects vanish when omitted.`,
      });
    }
  };

  for (const m of ctx.manifests) {
    for (const sec of m.sections) {
      // (a) character held objects — from the "Holding" column (rich schema) OR, when absent,
      //     extracted from the opening/state text ("shard in fist" — crawler timeline schema).
      if (sec.kind === "character") {
        for (const row of sec.rows) {
          if (!row.visible) continue;
          if (row.holding) {
            const held = row.holding
              .split(/[,→/]| then | and /i)
              .map((t) => t.replace(/\(.*?\)/g, "").trim())
              .filter(Boolean);
            for (const item of held) {
              const noun = objectNounFromTitle(item);
              if (!noun || ["nothing", "none", "empty", ""].includes(noun)) continue;
              check(m.scene, row.shot, noun, `${sec.characterName} holding "${item}"`, sec.characterName);
            }
          } else {
            // No Holding column: derive from the state text, but only when the framing shows
            // the hand (skip face CUs / inserts where the held hand is correctly out of frame).
            const shot = ctx.shotByCode.get(row.shot);
            if (shot && !bodyVisible(shot, nbPrompt(shot)?.body)) continue;
            for (const noun of heldNounsFrom(`${row.opening ?? ""} ${row.posture ?? ""}`)) {
              check(m.scene, row.shot, noun, `${sec.characterName} holding "${noun}"`, sec.characterName);
            }
          }
        }
        continue;
      }
      // (b) portable-object sections: only objects that are ever handled (phone, shard, …)
      const portable = sec.rows.some((r) => HELD_VERBS.test(`${r.posture ?? ""} ${r.notes ?? ""}`));
      if (!portable || !sec.objectNoun) continue;
      for (const row of sec.rows) {
        if (!row.visible) continue;
        if (!HELD_VERBS.test(`${row.posture ?? ""} ${row.notes ?? ""}`)) continue;
        check(m.scene, row.shot, sec.objectNoun, `Object "${sec.title}" is handled`);
      }
    }
  }
  return issues;
}

// Transitive action verbs that need a target in frame (A5 / L04).
const TRANSITIVE_ACTION = /\b(strik\w*|swing\w*|hit\w*|punch\w*|reach\w*|grab\w*|push\w*|shov\w*|aim\w*|point\w*|throw\w*|hurl\w*|stab\w*|slash\w*|look\w* at|stare\w* at|stares? toward|glanc\w* at|gaz\w* at)\b/i;
const INTENTIONAL_ABSENCE = /\b(flee\w*|fleeing|runs? from|escap\w*|disembodied|unseen|off-screen voice|empty (room|space|air)|alone)\b/i;

/**
 * L04 — a transitive action in the prompt that names an @element must list that element
 * in the shot, so the action doesn't render against empty space.
 */
function lintActionTarget(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const mentionRe = /@([a-zA-Z][a-zA-Z0-9]*)/g;
  for (const shot of ctx.shotByCode.values()) {
    const p = nbPrompt(shot);
    if (!p) continue;
    const act = p.sections["action"] ?? "";
    if (!act || !TRANSITIVE_ACTION.test(act)) continue;
    if (INTENTIONAL_ABSENCE.test(act)) continue;

    // Every @element referenced inside the action clause must be a listed element.
    const listed = new Set(shot.meta.elements);
    let mm: RegExpExecArray | null;
    const flagged = new Set<string>();
    while ((mm = mentionRe.exec(act)) !== null) {
      const el = mm[1];
      if (!listed.has(el) && !flagged.has(el)) {
        flagged.add(el);
        issues.push({
          rule: "L04",
          severity: "error",
          scene: null,
          shotCode: shot.code,
          object: el,
          message: `Transitive action targets @${el} but it is not in shot.md elements — action would render against empty space (add the target, or mark intentional absence).`,
        });
      }
    }
  }
  return issues;
}

const QUOTE_RE = /[“"]([^”"]{2,80})[”"]/g;

// A readout/sign (digits, or an all-caps label) vs ordinary quoted dialogue/prose.
function isReadout(s: string): boolean {
  if (/\d/.test(s)) return true;
  const letters = s.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && s === s.toUpperCase();
}

/**
 * L09 — a diegetic on-screen string (a counter/sign readout) must read identically wherever
 * it recurs. Scans a `[Screen Text]` block if present AND the whole prompt body, since readouts
 * like the FLOOR counter are written inline in [Subject] / a "Text rendering:" line. A legitimate
 * value change (FLOOR 01/66 → 02/66) is a different string, so it never false-flags; only the
 * SAME value written with different spacing/punctuation collides and is caught.
 */
function lintOnScreenText(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const registry = new Map<string, { canonical: string; shot: string }>();

  // Whitespace and punctuation must not count as a difference — "FLOOR 01 / 66" and
  // "FLOOR 01/66" are the same intended readout, so they collide on one registry key.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const shot of ctx.shotByCode.values()) {
    const p = nbPrompt(shot);
    if (!p) continue;
    const block =
      p.sections["screen_text"] ?? p.sections["on-screen_text"] ?? p.sections["on_screen_text"] ?? p.sections["text"] ?? "";

    const strings = new Set<string>();
    let qm: RegExpExecArray | null;
    for (const hay of [block, p.body]) {
      QUOTE_RE.lastIndex = 0;
      while ((qm = QUOTE_RE.exec(hay)) !== null) strings.add(qm[1].trim());
    }
    if (block && strings.size === 0) strings.add(block.trim());

    for (const s of strings) {
      if (!isReadout(s)) continue; // only diegetic readouts/signs, not dialogue or description
      const key = norm(s);
      if (!key) continue;
      const existing = registry.get(key);
      if (!existing) {
        registry.set(key, { canonical: s, shot: shot.code });
      } else if (existing.canonical !== s) {
        issues.push({
          rule: "L09",
          severity: "error",
          scene: null,
          shotCode: shot.code,
          shotCodeB: existing.shot,
          message: `On-screen text mismatch: "${s}" (${shot.code}) vs "${existing.canonical}" (${existing.shot}) — must be byte-identical.`,
        });
      }
    }
  }
  return issues;
}

// ────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────

// ── L03 build-presence · L07 concealment-negative · L11 action-density ─────────

/** L03 — a build-sensitive character in a body-visible shot must have its physique asserted (B2). */
function lintBuildPresence(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  for (const shot of ctx.shotByCode.values()) {
    const p = nbPrompt(shot);
    if (!p) continue;
    const text = actionText(p);
    if (!bodyVisible(shot, text)) continue;
    const seen = new Set<string>();
    for (const el of shot.meta.elements) {
      const char = ctx.charByElement.get(el);
      if (!char || seen.has(el)) continue;
      seen.add(el);
      const ib = `${char.sections["identity_block"] ?? ""} ${(char.meta.build?.positive ?? []).join(" ")}`;
      const unflattering = char.meta.build?.unflattering ?? UNFLATTERING_RE.test(ib);
      if (!unflattering) continue;
      if (!BUILD_TOKEN.test(p.body)) {
        issues.push({
          rule: "L03",
          severity: "warning",
          scene: null,
          shotCode: shot.code,
          character: char.name,
          message: `${char.name}: build-sensitive character but the prompt asserts no physique — the model will slim/beautify. Restate the build POSITIVELY (run \`npm run emit\` to inject it).`,
        });
      }
    }
  }
  return issues;
}

const CONCEALMENT_RULE_RE = /on-?screen rule[^.]*(shadow|silhouette|rim-?light)|never fully lit|no (full )?(daylight )?reveal|(shadow|silhouette)[^.]{0,24}\bonly\b|shadowed\s*\/\s*silhouetted/i;
const REVEAL_QUALIFIER = /(anatom|eyes|teeth|face|features|fur\b|skin|lit\b|glow|clearly|clear\b|recognis|recogniz|detail|reveal)/;

/** L07 — a concealed element's PRESENCE must not be negated (only its reveal may be) (B4). */
function lintConcealmentNegative(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  // Concealed elements = sheets whose Visual identity declares a shadow/silhouette-only rule.
  const concealedNoun = new Map<string, string>();
  for (const c of ctx.charByElement.values()) {
    if (CONCEALMENT_RULE_RE.test(c.sections["visual_identity"] ?? "")) {
      const noun = c.name.split(/\s+/).filter((w) => w.length >= 3).pop()?.toLowerCase();
      if (noun) concealedNoun.set(c.meta.element_name || c.name, noun);
    }
  }
  if (concealedNoun.size === 0) return issues;

  for (const shot of ctx.shotByCode.values()) {
    const p = nbPrompt(shot);
    const neg = (p?.sections["negative_prompt"] ?? "").toLowerCase();
    if (!neg) continue;
    for (const el of shot.meta.elements) {
      const noun = concealedNoun.get(el);
      if (!noun) continue;
      const re = new RegExp(`\\b${escapeRe(noun)}\\b`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(neg)) !== null) {
        const window = neg.slice(Math.max(0, m.index - 28), m.index + noun.length + 28);
        if (!REVEAL_QUALIFIER.test(window)) {
          issues.push({
            rule: "L07",
            severity: "warning",
            scene: null,
            shotCode: shot.code,
            object: noun,
            message: `negative prompt suppresses the "${noun}" itself, not just its reveal — a concealed target must stay PRESENT (negate "visible ${noun} anatomy/eyes", never the bare "${noun}"), or the action loses its anchor.`,
          });
          break;
        }
      }
    }
  }
  return issues;
}

// One change in body state = one beat. Distinct physical-action verbs proxy the beat count.
const BEAT_VERB = /\b(stand\w*|rise\w*|sit\w*|sat\b|walk\w*|step\w*|turn\w*|reach\w*|grab\w*|grip\w*|pick\w*|swing\w*|strik\w*|throw\w*|hurl\w*|lift\w*|rais\w*|climb\w*|kneel\w*|fall\w*|fell\b|drop\w*|push\w*|pull\w*|run\w*|lunge\w*|plant\w*|driv\w*|thrust\w*|scrambl\w*|crawl\w*|collaps\w*|spin\w*|duck\w*|leap\w*|jump\w*|pour\w*|slump\w*)\b/gi;

export function countBeats(text: string): number {
  const roots = new Set<string>();
  for (const m of text.toLowerCase().matchAll(BEAT_VERB)) roots.add(m[0].slice(0, 5));
  return roots.size;
}

/**
 * L11 — too many physical beats in one shot (the 6h audit). Advisory only: beat-counting from
 * prose is a heuristic, and whether beats "flow as one motion" is a judgment call — so this warns
 * (≥4 beats) rather than blocking, and stays quiet at ≤3 to avoid noise.
 */
function lintActionDensity(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  for (const shot of ctx.shotByCode.values()) {
    const beats = countBeats(shot.content.subject_action ?? "");
    if (beats >= 4) {
      issues.push({
        rule: "L11",
        severity: "warning",
        scene: null,
        shotCode: shot.code,
        message: `${beats} distinct physical beats — likely over-stuffed for one still/clip; confirm it reads as one continuous motion, else split.`,
      });
    }
  }
  return issues;
}

// ── L12 perspective coherence ──────────────────────────────────────────────
// A true top-down / bird's-eye frame is a plan view: it physically cannot contain a horizon,
// sky band, or distant shoreline. Mixing one in (most often by pasting a single eye-level
// [World Plate] block into an overhead shot) produces the "subject pasted on a backdrop"
// fake-perspective. Fires ONLY on STRICT straight-down language — an angled "high wide
// overhead" shot (e.g. a Spike) legitimately sees a horizon and is exempt.
const STRICT_TOPDOWN_RE =
  /\b(top-?down|bird'?s-?eye|straight down|directly above|directly overhead|plan view|flat-?lay)\b/i;
const HORIZON_TOKEN_RE =
  /\b(horizon line|horizon|skyline|shoreline|distant shore|far shore|distant line of reeds|reeds at the far|far edge of the (?:lake|water)|night sky|open sky|sky band|on the horizon)\b/gi;

/** A horizon token is OK if it's negated ("no horizon") or is a reflection ("sky reflected"). */
function horizonTokenIsAllowed(text: string, idx: number, tokenLen: number): boolean {
  const before = text.slice(Math.max(0, idx - 16), idx);
  if (/\b(no|not|without|never|zero|free of|absent)\b[\s,]*$/i.test(before)) return true;
  const window = text.slice(Math.max(0, idx - 40), idx + tokenLen + 40);
  if (/reflect/i.test(window)) return true; // sky/moon AS a reflection on the surface is fine
  return false;
}

/** First un-negated horizon/sky/shore token in the text, or null. (Exported for testing.) */
export function findHorizonConflict(text: string | undefined | null): string | null {
  if (!text) return null;
  let m: RegExpExecArray | null;
  HORIZON_TOKEN_RE.lastIndex = 0;
  while ((m = HORIZON_TOKEN_RE.exec(text)) !== null) {
    if (!horizonTokenIsAllowed(text, m.index, m[0].length)) return m[0];
  }
  return null;
}

export function isStrictTopDown(...parts: Array<string | undefined>): boolean {
  return STRICT_TOPDOWN_RE.test(parts.filter(Boolean).join(" "));
}

/** L12 — a strict top-down/bird's-eye shot must not describe a horizon/sky/shoreline. */
function lintPerspectiveCoherence(ctx: Ctx): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  for (const shot of ctx.shotByCode.values()) {
    const p = nbPrompt(shot);
    if (!p) continue;
    const meta = shot.meta as Record<string, unknown>;
    const cam = p.sections["camera_capture"] ?? "";
    if (!isStrictTopDown(meta.shot_type as string, meta.camera as string, cam)) continue;
    const scan = [p.sections["world_plate"], cam, p.sections["frame_map"]].filter(Boolean).join("\n");
    const offender = findHorizonConflict(scan);
    if (offender) {
      issues.push({
        rule: "L12",
        severity: "error",
        scene: null,
        shotCode: shot.code,
        message: `top-down/bird's-eye framing but the world description contains "${offender}" — a plan view cannot show a horizon/sky/shore. Use the environment's TOP-DOWN [World Plate] (surface only; moon & stars as reflections), or reframe to a high-angle. This is the fake-perspective clash.`,
      });
    }
  }
  return issues;
}

// L05 (board ↔ shot.md consistency) is intentionally NOT a per-save lint: a legacy board is
// authored independently with its own field conventions, so drift there is mostly expected, not
// a defect. It is enforced explicitly by `npm run sync-board` (check at handoff, --write to
// re-project) — see board-compiler.ts — keeping this gate high-signal.

export function validateContinuity(
  project: ProjectIndex,
  projectDir: string,
  projectSlug: string,
): ContinuityReport {
  const knownNames = project.characters.map((c) => c.name);
  const manifests = loadManifests(projectDir, knownNames);

  const shotByCode = new Map<string, Shot>();
  for (const s of project.shots) shotByCode.set(s.code, s);
  const charByName = new Map<string, Character>();
  const charByElement = new Map<string, Character>();
  for (const c of project.characters) {
    charByName.set(c.name, c);
    charByElement.set(c.meta.element_name || c.name, c);
  }

  // Only the characters the manifest actually tracks (a real cast member, not an
  // environment plate) participate in sentence attribution.
  const trackedNames = new Set(
    manifests.flatMap((m) =>
      m.sections.filter((s) => s.kind === "character" && s.characterName).map((s) => s.characterName as string),
    ),
  );
  const trackedChars = project.characters.filter((c) => trackedNames.has(c.name));

  const ctx: Ctx = { manifests, shotByCode, charByName, charByElement, trackedChars };

  const issues = [
    ...lintStateContinuity(ctx),
    ...lintManifestToPrompt(ctx),
    ...lintBuildPresence(ctx),
    ...lintHeldObject(ctx),
    ...lintConcealmentNegative(ctx),
    ...lintActionTarget(ctx),
    ...lintOnScreenText(ctx),
    ...lintActionDensity(ctx),
    ...lintPerspectiveCoherence(ctx),
  ];

  const scenes = manifests.map((m) => m.scene);
  const shotsChecked = new Set(issues.map((i) => i.shotCode)).size;

  return {
    project: projectSlug,
    timestamp: new Date().toISOString(),
    scenes,
    shotsChecked,
    totalErrors: issues.filter((i) => i.severity === "error").length,
    totalWarnings: issues.filter((i) => i.severity === "warning").length,
    issues,
  };
}
