/**
 * Project emitter — the deterministic "author state → files auto-emit" step (physics-engine
 * Tier-1, the projection half of "the three files become projections of one model").
 *
 * Regenerates every derivable projection of a project FROM the authored state in ONE pass:
 *   - each shot's nb-prompt [Subject] + Negative (and the Kling motion prompt, if present),
 *     compiled from the manifest timeline + element sheets, preserving the authored creative blocks;
 *   - the storyboard board TSV.
 *
 * Safety (what makes it reliable enough to run automatically):
 *   - IDEMPOTENT: only writes a file when its content actually changes → no chokidar write-loops,
 *     so `--watch` is safe.
 *   - STATE-GUARDED: a shot with no compiled state is skipped, never clobbered with an empty [Subject].
 *   - NON-DESTRUCTIVE: only [Subject] + Negative (and board cells) are owned by the engine; every
 *     authored block ([World Plate], [Cinematography], …) and the frontmatter pass through verbatim.
 */
import fs from "fs";
import path from "path";
import type { ProjectIndex } from "../types.js";
import { compileShot, loadManifestsForProject } from "./state-importer.js";
import { injectMissingClauses } from "./prompt-assembler.js";
import { compileBoardTsv, findBoardTsv } from "./board-compiler.js";
import { validateContinuity, type ContinuityReport } from "./continuity-validator.js";
import type { CompiledClauses, ClauseKind } from "./state-compiler.js";
// Any build descriptor present in the body means the prompt already anchors the physique.
import { BUILD_TOKEN } from "./physics-vocab.js";

/**
 * Which mandatory clause kinds are NOT already present in the prompt body — i.e. what the
 * emitter should inject. Conservative: anything plausibly present is treated as present, so
 * the emitter never over-writes (and stays idempotent).
 */
function missingKinds(compiled: CompiledClauses, body: string): Set<ClauseKind> {
  const lc = body.toLowerCase();
  const missing = new Set<ClauseKind>();
  for (const t of compiled.taggedClauses) {
    if (t.kind === "identity") continue; // never inject identity
    // Posture is NOT auto-injected: a still may legitimately depict the shot's closing moment
    // (e.g. opening "running" → the frame shows the "sprawled" landing). Which moment the image
    // captures is creative judgment, so posture omissions/contradictions stay a lint (L02) for the
    // author to resolve, never silently rewritten.
    if (t.kind === "posture") continue;
    let present: boolean;
    switch (t.kind) {
      case "build":
        present = BUILD_TOKEN.test(lc); // the prompt already names a physique descriptor anywhere
        break;
      case "held": {
        const noun = t.text.replace(/\s+in hand.*$/i, "").split(/[, ]+/)[0].toLowerCase();
        present = !noun || lc.includes(noun);
        break;
      }
      case "concealment":
        present = /shadow|silhouette/.test(lc);
        break;
      case "target": {
        const at = t.text.match(/@[A-Za-z][A-Za-z0-9]*/)?.[0]?.toLowerCase();
        present = at ? lc.includes(at) : true;
        break;
      }
      default:
        present = true;
    }
    if (!present) missing.add(t.kind);
  }
  return missing;
}

export interface EmitChange {
  path: string; // repo-relative-ish absolute path
  kind: "nb-prompt" | "kling-prompt" | "board";
  shotCode?: string;
}

export interface EmitResult {
  changes: EmitChange[]; // files that changed (or would change, in dry-run)
  skipped: number; // shots with no compiled state — left untouched
  wrote: boolean; // whether changes were written to disk
  lint: ContinuityReport;
}

/** True iff this shot has enough authored state for the compiler to own its [Subject]. */
function hasState(result: ReturnType<typeof compileShot>): boolean {
  if ("error" in result) return false;
  return result.input.characters.length > 0 || (result.input.concealment ?? []).length > 0;
}

function reconcile(
  filePath: string,
  next: string,
  kind: EmitChange["kind"],
  shotCode: string | undefined,
  write: boolean,
  changes: EmitChange[],
): void {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
  if (current === next) return; // idempotent — nothing to do
  changes.push({ path: filePath, kind, shotCode });
  if (write) fs.writeFileSync(filePath, next);
}

export function emitProject(
  project: ProjectIndex,
  projectDir: string,
  slug: string,
  opts: { write: boolean },
): EmitResult {
  const manifests = loadManifestsForProject(project, projectDir);
  const changes: EmitChange[] = [];
  let skipped = 0;

  for (const shot of project.shots) {
    // nb-prompt [Subject] + Negative
    const nbPath = path.join(projectDir, "storyboard", "shots", shot.code, "nb-prompt.md");
    if (fs.existsSync(nbPath)) {
      const r = compileShot(project, manifests, shot.code);
      if (hasState(r) && !("error" in r)) {
        const cur = fs.readFileSync(nbPath, "utf-8");
        const next = injectMissingClauses(cur, r.compiled, missingKinds(r.compiled, cur));
        reconcile(nbPath, next, "nb-prompt", shot.code, opts.write, changes);
      } else {
        skipped++;
      }
    }

    // Kling motion prompt (video negative policy, identity locked by start frame)
    const klingPath = path.join(projectDir, "storyboard", "video-prompts", shot.code, "kling-prompt.md");
    if (fs.existsSync(klingPath)) {
      const rk = compileShot(project, manifests, shot.code, "kling");
      if (hasState(rk) && !("error" in rk)) {
        const cur = fs.readFileSync(klingPath, "utf-8");
        const next = injectMissingClauses(cur, rk.compiled, missingKinds(rk.compiled, cur));
        reconcile(klingPath, next, "kling-prompt", shot.code, opts.write, changes);
      }
    }
  }

  // Board TSV — created if missing (a project's board is just a projection), else kept in sync.
  const boardPath = findBoardTsv(projectDir, slug) ?? path.join(projectDir, `${slug}_storyboard.tsv`);
  const existingBoard = fs.existsSync(boardPath) ? fs.readFileSync(boardPath, "utf-8") : undefined;
  reconcile(boardPath, compileBoardTsv(project, existingBoard), "board", undefined, opts.write, changes);

  const lint = validateContinuity(project, projectDir, slug);
  return { changes, skipped, wrote: opts.write, lint };
}
