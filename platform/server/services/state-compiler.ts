/**
 * State → prompt compiler (physics-engine Tier-1, doc 02 §3).
 *
 * The pipeline is: the LLM authors STATE (resolved opening/closing physical state per shot)
 * and creative prose; an algorithm propagates the state across shots; and THIS module turns
 * the resolved state into the mandatory prompt clauses — posture, build, held objects,
 * concealment, action target — plus a per-platform negative policy. Because the prompt is
 * compiled *from* the state, the continuity invariants (L02 manifest→prompt, L03 build/pose
 * crowd-out, L06 held-object, L07 concealment-positivity) hold by construction. The
 * continuity-validator stays as the gate for anything hand-edited or authored off-spec.
 *
 * Pure and deterministic — no model, no I/O. classifyContacts/Contact are shared with the
 * validator so "what the compiler emits" and "what the validator checks" use one vocabulary.
 */
import { classifyContacts, type Contact } from "./continuity-validator.js";

// ── Inputs ────────────────────────────────────────────────────────────────────

/** Anti-drift build anchor (B2). Authored once per character in the element library. */
export interface BuildSpec {
  /** Positive, physical, present-tense clauses — the load-bearing anti-beautification anchor. */
  positiveClauses: string[];
  /** Adjectives the model must not drift toward; feed the (weak) negative + lint. */
  forbidden?: string[];
  /** When true, the build clause is mandatory on every body-visible shot. */
  unflattering?: boolean;
}

/** A concealed element shown only as a silhouette/mass — described POSITIVELY (B4). */
export interface ConcealmentSpec {
  /** e.g. "a shapeless black shadow-mass filling the upper frame, no eyes, no anatomy". */
  positiveDescription: string;
  /** What the negative MAY suppress — its reveal, never its presence. */
  hideOnly?: string[];
}

/** The resolved physical state for one character in one shot (from the propagated timeline). */
export interface ResolvedState {
  /** Free-text posture as authored ("pinned flat on his back, propped on one elbow"). */
  posture: string;
  /** Objects currently in hand ("stone shard"). */
  heldObjects?: string[];
  facing?: string;
}

export type Platform = "nanobanana" | "kling" | "seedance";

/** Framing + action facts that gate what is emitted. */
export interface ShotFraming {
  /** false for a face CU / insert — omit body posture + build (A4). */
  bodyVisible: boolean;
  /** false when the holding hand is out of frame — omit held objects (A4). */
  handInFrame?: boolean;
  /** The action verb's prior is "standing" (strike/swing/throw/reach/lift) — force positive posture (B1). */
  defaultPoseProne?: boolean;
}

export interface CharacterCompileInput {
  state: ResolvedState;
  build: BuildSpec;
  /** Canonical face/hair description (always emitted when the character is in frame). */
  identityClause?: string;
}

export interface CompileInput {
  characters: CharacterCompileInput[];
  framing: ShotFraming;
  platform: Platform;
  concealment?: ConcealmentSpec[];
  /** Positive description of a transitive action's target, so it isn't "striking air" (A5). */
  targetDescription?: string;
}

// ── Output ──────────────────────────────────────────────────────────────────

export type ClauseKind = "identity" | "build" | "posture" | "held" | "concealment" | "target";

export interface TaggedClause {
  kind: ClauseKind;
  text: string;
}

export interface CompiledClauses {
  /** Ordered mandatory clauses for the [Subject]/[Action] blocks. */
  subjectClauses: string[];
  /** The same clauses tagged by kind — lets the emitter inject only the MISSING ones. */
  taggedClauses: TaggedClause[];
  /** The negative line, per-platform policy applied. Empty string when policy emits none. */
  negative: string;
  /** Human-facing notes about what was emitted/omitted and why (audit trail). */
  notes: string[];
}

// ── Clause emitters ────────────────────────────────────────────────────────────

/** Posture, phrased positively. For a default-pose-prone action, anchor the non-standing contact hard. */
export function postureClause(state: ResolvedState, framing: ShotFraming): string {
  const posture = state.posture.trim().replace(/\s+/g, " ");
  if (!framing.defaultPoseProne) return posture;
  const contacts = classifyContacts(posture);
  const grounded = contacts.has("grounded") || contacts.has("kneeling") || contacts.has("seated");
  // The model's prior for strike/swing is a standing batter's stance — crowd it out positively.
  if (grounded && !/\bnot (rising|standing)\b/i.test(posture)) {
    return `${posture} — the action driven from this position, NOT rising, NOT standing`;
  }
  return posture;
}

export function buildClause(build: BuildSpec): string {
  return build.positiveClauses.join(", ");
}

/** Held objects — only when the hand is in frame (A4); otherwise correctly omitted. */
export function heldObjectClause(state: ResolvedState, framing: ShotFraming): string | null {
  const held = (state.heldObjects ?? []).filter(Boolean);
  if (held.length === 0) return null;
  if (framing.handInFrame === false) return null;
  return held.map((o) => `${o} in hand`).join(", ");
}

export function concealmentClause(c: ConcealmentSpec): string {
  return c.positiveDescription.trim();
}

export function targetClause(targetDescription: string): string {
  return targetDescription.trim();
}

// ── Per-platform negative policy (B3) ──────────────────────────────────────────

/**
 * NanoBanana/Gemini has no real negative-prompt lever — posture/build/concealment must be
 * carried POSITIVELY, and the negative is a thin backup only. Kling/Seedance (video) DO honor
 * negatives, so emit the full crowd-out list there. Crucially: never suppress a concealed
 * element's PRESENCE — only its reveal (A5/B4).
 */
export function negativePolicy(input: CompileInput): { negative: string; notes: string[] } {
  const notes: string[] = [];
  const forbidden = input.characters.flatMap((c) => c.build.forbidden ?? []);
  const hideOnly = (input.concealment ?? []).flatMap((c) => c.hideOnly ?? []);

  if (input.platform === "nanobanana") {
    // Thin backup: a few build-drift terms + concealment reveal terms. Positive clauses do the work.
    const thin = [...new Set([...forbidden, ...hideOnly])];
    if (forbidden.length) notes.push("nanobanana: build held POSITIVELY; forbidden terms are weak backup only");
    if (hideOnly.length) notes.push("nanobanana: concealment held POSITIVELY; reveal terms are weak backup only");
    return { negative: thin.join(", "), notes };
  }

  // kling / seedance: negatives are a real lever.
  const poseDefaults: string[] = [];
  for (const c of input.characters) {
    if (input.framing.defaultPoseProne) {
      const contacts = classifyContacts(c.state.posture);
      if (contacts.has("grounded") || contacts.has("kneeling") || contacts.has("seated")) {
        poseDefaults.push("standing", "upright", "on his feet", "heroic pose", "batter's stance");
        break;
      }
    }
  }
  const neg = [...new Set([...poseDefaults, ...forbidden, ...hideOnly])];
  notes.push(`${input.platform}: negatives are a real lever — emitted ${neg.length} term(s)`);
  return { negative: neg.join(", "), notes };
}

// ── Compile ─────────────────────────────────────────────────────────────────

export function compile(input: CompileInput): CompiledClauses {
  const tagged: TaggedClause[] = [];
  const notes: string[] = [];
  const add = (kind: ClauseKind, text: string) => { if (text && text.trim()) tagged.push({ kind, text: text.trim() }); };

  for (const ch of input.characters) {
    // Identity (face/hair) is emitted in full for stills. In video the start frame / Element
    // locks the face, so we keep only the @element anchor (so the Element still binds) and
    // re-anchor the drift-prone axes (build/posture/held/concealment) below.
    if (ch.identityClause) {
      if (input.platform === "nanobanana") add("identity", ch.identityClause);
      else add("identity", ch.identityClause.match(/@[A-Za-z][A-Za-z0-9]*/)?.[0] ?? "");
    }

    if (input.framing.bodyVisible) {
      if (ch.build.unflattering || input.framing.defaultPoseProne) {
        add("build", buildClause(ch.build));
      } else {
        notes.push("build clause skipped (character not flagged unflattering and shot not pose-prone)");
      }
      const posture = postureClause(ch.state, input.framing);
      add("posture", posture);

      if (input.framing.handInFrame === false) {
        if ((ch.state.heldObjects ?? []).length) notes.push("held object omitted — hand not in frame (A4)");
      } else {
        // Dedup: don't restate an object the posture clause already names ("shard in fist").
        const postureLc = posture.toLowerCase();
        const remaining = (ch.state.heldObjects ?? []).filter((o) => o && !postureLc.includes(o.toLowerCase()));
        if (remaining.length) add("held", remaining.map((o) => `${o} in hand`).join(", "));
      }
    } else {
      notes.push("posture + build omitted — body not visible (face CU / insert, A4)");
    }
  }

  for (const c of input.concealment ?? []) add("concealment", concealmentClause(c));
  if (input.targetDescription) add("target", targetClause(input.targetDescription));

  const { negative, notes: negNotes } = negativePolicy(input);
  notes.push(...negNotes);

  return { subjectClauses: tagged.map((t) => t.text), taggedClauses: tagged, negative, notes };
}
