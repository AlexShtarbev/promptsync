/**
 * CLIP image verifier — Tier 2 of the text→pixels checks (taxonomy B1/B2/B5). Local, free, no
 * Claude. Zero-shot CLIP scores each render against contrastive descriptions derived from the
 * shot's resolved state, and flags when the PIXELS read as the wrong thing:
 *   - posture: "a person lying pinned on the floor" vs "a person standing upright"  (B1)
 *   - build:   "an overweight, heavy-set person"     vs "a slim, fit, athletic person" (B2)
 *
 * The model runs via transformers.js (CPU/WASM, ~150MB, downloaded on first use). It is an
 * OPTIONAL dependency: `loadClipScorer()` lazy-imports it and throws a clear hint if absent, so
 * the rest of the platform never needs it. The check logic is pure and unit-tested via an
 * injected scorer; the model is just one ClipScorer implementation.
 */
import { classifyContacts, type Contact } from "./continuity-validator.js";
import { compileShot } from "./state-importer.js";
import type { ImageFinding, ImageVerifier } from "./image-checker.js";
import type { ProjectIndex } from "../types.js";
import type { SceneManifest } from "./continuity-validator.js";

/** Score an image against candidate labels; returns scores aligned to `labels` (0..1, softmax). */
export type ClipScorer = (imagePath: string, labels: string[]) => Promise<number[]>;

export interface ClipCheck {
  axis: "posture" | "build";
  character?: string;
  expected: string; // what the state implies the image should look like
  against: string; // the failure mode to detect (usually the model's default)
}

const POSTURE_LABEL: Partial<Record<Contact, string>> = {
  grounded: "a person lying down on the floor",
  kneeling: "a person kneeling on the ground",
  seated: "a person sitting down",
};

/** Contrastive checks for a character, from its resolved posture + whether its build is drift-prone. */
export function buildClipChecks(posture: string, unflattering: boolean, character?: string): ClipCheck[] {
  const checks: ClipCheck[] = [];
  const contacts = classifyContacts(posture);
  // Posture: only meaningful when the state is a clear, settled NON-standing contact (the case the
  // model defaults wrong). Skip if any standing/transitional contact is present (ambiguous frame).
  if (!contacts.has("standing") && !contacts.has("rising") && !contacts.has("walking")) {
    for (const c of ["grounded", "kneeling", "seated"] as Contact[]) {
      if (contacts.has(c)) {
        checks.push({ axis: "posture", character, expected: POSTURE_LABEL[c]!, against: "a person standing upright" });
        break;
      }
    }
  }
  if (unflattering) {
    checks.push({ axis: "build", character, expected: "an overweight, heavy-set person with a large belly", against: "a slim, fit, athletic person" });
  }
  return checks;
}

/** Run the checks with a scorer; flag any where the image reads as the failure mode by `minMargin`. */
export async function runClipChecks(
  imagePath: string,
  checks: ClipCheck[],
  scorer: ClipScorer,
  shotCode: string,
  minMargin = 0.15,
): Promise<ImageFinding[]> {
  const findings: ImageFinding[] = [];
  for (const ch of checks) {
    const [expScore, againstScore] = await scorer(imagePath, [ch.expected, ch.against]);
    if (againstScore > expScore + minMargin) {
      const who = ch.character ? `${ch.character}: ` : "";
      findings.push({
        shotCode,
        severity: "warning",
        kind: "vision",
        message: `${who}rendered frame reads as "${ch.against}" but state implies "${ch.expected}" (CLIP ${Math.round(againstScore * 100)}% vs ${Math.round(expScore * 100)}%) — likely a ${ch.axis} default; regenerate or escalate to ControlNet`,
      });
    }
  }
  return findings;
}

/** An ImageVerifier (for checkImages) that runs CLIP posture/build checks from compiled state. */
export function makeClipVerifier(
  project: ProjectIndex,
  manifests: SceneManifest[],
  scorer: ClipScorer,
  minMargin = 0.15,
): ImageVerifier {
  return async (shot, imagePath) => {
    const r = compileShot(project, manifests, shot.code);
    if ("error" in r || !r.input.framing.bodyVisible) return []; // no body in frame → nothing to verify
    const checks: ClipCheck[] = [];
    for (const ch of r.input.characters) {
      const name = ch.identityClause?.match(/@([A-Za-z][A-Za-z0-9]*)/)?.[1];
      checks.push(...buildClipChecks(ch.state.posture, ch.build.unflattering ?? false, name));
    }
    return runClipChecks(imagePath, checks, scorer, shot.code, minMargin);
  };
}

/**
 * Lazy-load a CLIP scorer backed by transformers.js. Throws a clear, actionable error if the
 * optional dependency isn't installed — callers should catch and fall back to Tier-0 checks.
 */
export async function loadClipScorer(model = "Xenova/clip-vit-base-patch32"): Promise<ClipScorer> {
  const spec = "@xenova/transformers"; // variable specifier → not statically resolved by tsc
  let mod: any;
  try {
    mod = await import(spec);
  } catch {
    throw new Error("CLIP backend not installed. Run: npm install @xenova/transformers");
  }
  const pipe = await mod.pipeline("zero-shot-image-classification", model);
  return async (imagePath: string, labels: string[]) => {
    const out = await pipe(imagePath, labels);
    const byLabel = new Map<string, number>((out as Array<{ label: string; score: number }>).map((o) => [o.label, o.score]));
    return labels.map((l) => byLabel.get(l) ?? 0);
  };
}
