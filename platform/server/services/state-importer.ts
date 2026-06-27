/**
 * State importer + shot compiler (physics-engine Tier-1, doc 02 §3 / 07 Phase-0).
 *
 * Bridges the artifacts that already exist on disk to the state→prompt compiler:
 *   - resolved physical state  ← the per-scene continuity manifest timeline
 *   - build / identity / concealment ← the element library Identity Blocks
 *   - framing / action         ← shot.md (shot_type) + the authored prompt
 * It assembles a typed CompileInput, runs the compiler, and reports COVERAGE against the
 * hand-authored nb-prompt — the Phase-0 round-trip test ("does the engine reproduce the
 * hand-authored prompt, and are the only diffs intended improvements?").
 */
import {
  loadManifests,
  classifyContacts,
  bodyVisible,
  type SceneManifest,
} from "./continuity-validator.js";
import { UNFLATTERING_RE, DEFAULT_FORBIDDEN } from "./physics-vocab.js";
import {
  compile,
  type CompileInput,
  type BuildSpec,
  type ConcealmentSpec,
  type ResolvedState,
  type Platform,
  type CompiledClauses,
} from "./state-compiler.js";
import type { ProjectIndex, Shot, Character } from "../types.js";

// ── Element-sheet parsing ──────────────────────────────────────────────────────

/** Parse the `Key: value` lines inside an element's "## Identity Block" fenced code block. */
export function identityFields(char: Character): Record<string, string> {
  const block =
    char.sections["identity_block"] ??
    char.sections["identity_block_(creature)"] ??
    Object.entries(char.sections).find(([k]) => k.startsWith("identity_block"))?.[1] ??
    "";
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z ]*?):\s*(.+?)\s*$/);
    if (m) fields[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return fields;
}


export function parseBuildSpec(char: Character): BuildSpec | null {
  // Prefer DECLARED typed frontmatter (`build:`); fall back to Identity-Block prose.
  const fm = char.meta.build;
  if (fm && (fm.positive?.length || fm.unflattering != null)) {
    return {
      positiveClauses: fm.positive ?? [],
      forbidden: fm.forbidden ?? (fm.unflattering ? DEFAULT_FORBIDDEN : []),
      unflattering: fm.unflattering ?? UNFLATTERING_RE.test((fm.positive ?? []).join(" ")),
    };
  }
  const fields = identityFields(char);
  const build = fields["build"] ?? fields["anatomy"];
  if (!build) return null;
  const unflattering = UNFLATTERING_RE.test(build);
  const positiveClauses = build
    .split(/,\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
  return {
    positiveClauses,
    forbidden: unflattering ? DEFAULT_FORBIDDEN : [],
    unflattering,
  };
}

export function identityClause(char: Character): string | undefined {
  const at = `@${char.meta.element_name || char.name}`;
  if (char.meta.identity_clause) return char.meta.identity_clause.includes(at) ? char.meta.identity_clause : `${at}, ${char.meta.identity_clause}`;
  const fields = identityFields(char);
  const face = fields["face"] ?? fields["surface"];
  return face ? `${at}, ${face}` : at;
}

/** Concealment from declared frontmatter (`concealment:`), else a "shadow/silhouette only" prose rule. */
export function concealmentSpec(char: Character): ConcealmentSpec | null {
  const at = `@${char.meta.element_name || char.name}`;
  const fm = char.meta.concealment;
  if (fm?.positive) {
    return { positiveDescription: fm.positive, hideOnly: fm.hide_only ?? DEFAULT_HIDE_ONLY };
  }
  const vis = char.sections["visual_identity"] ?? "";
  // Require a real concealment RULE, not a bare mention of "silhouette" — otherwise a
  // protagonist whose sheet merely describes how his silhouette reads (e.g. Hale) is
  // mis-detected as a hidden creature.
  const hasRule =
    /on-?screen rule[^.]*(shadow|silhouette|rim-?light)/i.test(vis) ||
    /never fully lit|no (full )?(daylight )?reveal/i.test(vis) ||
    /(shadow|silhouette)[^.]{0,24}\bonly\b/i.test(vis) ||
    /shadowed\s*\/\s*silhouetted/i.test(vis);
  if (!hasRule) return null;
  return {
    positiveDescription: `${at} shown only as a shapeless shadow-mass / silhouette, no eyes, no anatomy`,
    hideOnly: DEFAULT_HIDE_ONLY,
  };
}

const DEFAULT_HIDE_ONLY = ["visible creature anatomy", "eyes", "teeth", "recognizable animal", "clearly-lit creature"];

// ── State + framing from manifest / shot ───────────────────────────────────────

const HELD_RE = /([A-Za-z][\w\- ]*?)\s+(?:loose\s+)?in\s+(?:his |her |their |the )?(?:\w+\s+)?(?:fist|hand|hands|grasp)/gi;

export function extractHeldObjects(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  HELD_RE.lastIndex = 0;
  while ((m = HELD_RE.exec(text)) !== null) {
    const noun = m[1].replace(/^\W+|\W+$/g, "").trim().toLowerCase();
    if (noun && noun.length <= 40) out.add(noun);
  }
  return [...out];
}

/** The resolved opening state for a character in a shot, from the manifest timeline. */
export function resolvedStateForShot(
  manifests: SceneManifest[],
  characterName: string,
  shotCode: string,
): ResolvedState | null {
  for (const man of manifests) {
    for (const sec of man.sections) {
      if (sec.kind !== "character" || sec.characterName !== characterName) continue;
      const row = sec.rows.find((r) => r.shot.trim() === shotCode);
      if (!row) continue;
      const posture = (row.opening ?? row.posture ?? "").trim();
      if (!posture) return null;
      return { posture, heldObjects: extractHeldObjects(posture) };
    }
  }
  return null;
}

const DEFAULT_POSE_VERB = /\b(strik\w*|swing\w*|throw\w*|hurl\w*|reach\w*|lift\w*|driv\w*|thrust\w*|punch\w*|aim\w*|raise\w*)\b/i;
const NO_HAND_FRAMING = /\b(lower body|legs?|feet|foot|face|head)\b/i;

// ── Assemble CompileInput for a shot ───────────────────────────────────────────

export interface ShotCompileResult {
  shotCode: string;
  input: CompileInput;
  compiled: CompiledClauses;
}

export function compileShot(
  project: ProjectIndex,
  manifests: SceneManifest[],
  shotCode: string,
  platformOverride?: Platform,
): ShotCompileResult | { error: string } {
  const shot = project.shots.find((s) => s.code === shotCode);
  if (!shot) return { error: `Shot ${shotCode} not found` };

  const elementSet = new Set(shot.meta.elements);
  const inShot = project.characters.filter(
    (c) => elementSet.has(c.meta.element_name || c.name) || c.meta.appears_in?.includes(shotCode),
  );

  const promptText = nbText(shot);
  const actionSrc = `${shot.content.subject_action} ${promptText}`;

  const characters: CompileInput["characters"] = [];
  const concealment: ConcealmentSpec[] = [];

  for (const c of inShot) {
    const conceal = concealmentSpec(c);
    const state = resolvedStateForShot(manifests, c.name, shotCode);
    const build = parseBuildSpec(c);
    if (state && build) {
      characters.push({ state, build, identityClause: identityClause(c) });
    } else if (conceal) {
      concealment.push(conceal);
    }
  }

  const shotType = shot.meta.shot_type ?? "";
  const framing = {
    bodyVisible: bodyVisible(shot, promptText),
    handInFrame: !NO_HAND_FRAMING.test(shotType),
    defaultPoseProne: DEFAULT_POSE_VERB.test(actionSrc),
  };

  const platform: Platform =
    platformOverride ??
    (shot.mjPrompt?.meta.platform === "nanobanana" ? "nanobanana" : undefined) ??
    (shot.meta.asset_type === "kling" ? "kling" : "nanobanana");

  const input: CompileInput = { characters, framing, platform, concealment };
  return { shotCode, input, compiled: compile(input) };
}

function nbText(shot: Shot): string {
  const p = shot.mjPrompt?.meta.platform === "nanobanana" ? shot.mjPrompt : shot.nanoBanana;
  if (!p) return "";
  return `${p.sections["subject"] ?? ""}\n${p.sections["action"] ?? ""}`.trim();
}

// ── Round-trip coverage vs the hand-authored prompt ────────────────────────────

export interface CoverageItem {
  kind: "posture" | "build" | "held-object" | "concealment" | "target";
  detail: string;
  covered: boolean; // already present in the hand-authored prompt
}

export interface CoverageReport {
  shotCode: string;
  items: CoverageItem[];
  /** Mandatory clauses the engine would ADD (not present in the hand-authored prompt). */
  additions: number;
}

export function coverageVsPrompt(result: ShotCompileResult, project: ProjectIndex): CoverageReport {
  const shot = project.shots.find((s) => s.code === result.shotCode)!;
  const prompt = nbText(shot).toLowerCase(); // [Subject]/[Action] — where posture lives
  const fullBody = (shot.mjPrompt?.body ?? shot.nanoBanana?.body ?? "").toLowerCase(); // build/held/concealment may live in any block
  const items: CoverageItem[] = [];
  const has = (s: string) => fullBody.includes(s.toLowerCase());

  const promptContacts = classifyContacts(prompt);
  for (const ch of result.input.characters) {
    const contacts = [...classifyContacts(ch.state.posture)];
    // Only assess posture when the body is in frame (face CUs correctly omit it) and the
    // manifest posture actually has a classifiable contact (otherwise there's nothing to verify).
    if (result.input.framing.bodyVisible && contacts.length > 0) {
      const covered = contacts.some((c) => promptContacts.has(c));
      items.push({ kind: "posture", detail: ch.state.posture, covered });
    }

    if (result.input.framing.bodyVisible && (ch.build.unflattering || result.input.framing.defaultPoseProne)) {
      // Covered if any distinctive body descriptor from the build appears in the prompt.
      const buildText = ch.build.positiveClauses.join(" ");
      const tokens = buildText.match(/\b(overweight|belly|heavy|thick|soft|fat|sagging|paunch|broad|round|slump\w*|out of shape)\b/gi) ?? [];
      const covered = tokens.some((t) => has(t));
      items.push({ kind: "build", detail: tokens.slice(0, 3).join(", ") || buildText.slice(0, 40), covered });
    }
    for (const o of ch.state.heldObjects ?? []) {
      if (result.input.framing.handInFrame !== false) items.push({ kind: "held-object", detail: o, covered: has(o) });
    }
  }
  for (const _c of result.input.concealment ?? []) {
    items.push({ kind: "concealment", detail: "shadow-mass / silhouette", covered: /shadow|silhouette|shadow-mass/.test(fullBody) });
  }

  return { shotCode: result.shotCode, items, additions: items.filter((i) => !i.covered).length };
}

export function loadManifestsForProject(project: ProjectIndex, projectDir: string): SceneManifest[] {
  return loadManifests(projectDir, project.characters.map((c) => c.name));
}
