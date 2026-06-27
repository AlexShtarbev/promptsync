#!/usr/bin/env tsx
/**
 * Claude Code Stop hook — after Claude finishes a turn, regenerate every engine-managed
 * project's projections (inject missing mandatory clauses into [Subject], sync/create the board)
 * and report the continuity gate. This makes Claude/skill authoring reliable WITHOUT the dev
 * server and without Claude having to remember to run anything.
 *
 * Safe by construction: emit is inject-only, idempotent, and posture-excluded; this always exits
 * 0 so it can never block Claude. Scoped to projects that opted into the engine (have a
 * storyboard/continuity manifest dir).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { discoverProjects, loadProject } from "../server/services/markdown-parser.js";
import { emitProject } from "../server/services/prompt-emitter.js";

/** True if any file under `dir` was modified within `withinMs` (bounded scan, early-exit). */
function touchedRecently(dir: string, withinMs: number): boolean {
  const cutoff = Date.now() - withinMs;
  let scanned = 0;
  const walk = (d: string): boolean => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      if (++scanned > 5000) return false; // safety cap
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (walk(full)) return true;
      } else if (/\.(md|tsv|ya?ml)$/.test(e.name)) {
        try {
          if (fs.statSync(full).mtimeMs > cutoff) return true;
        } catch {
          /* ignore */
        }
      }
    }
    return false;
  };
  return walk(dir);
}

function main(): void {
  const platformDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const def = [path.resolve(platformDir, ".."), path.resolve(platformDir, "../../crawler")].join(path.delimiter);
  const roots = (process.env.PROJECTS_DIR ?? def).split(path.delimiter).map((r) => r.trim()).filter(Boolean);

  let projects;
  try {
    projects = discoverProjects(roots);
  } catch {
    return;
  }

  const lines: string[] = [];
  for (const proj of projects) {
    if (!fs.existsSync(path.join(proj.path, "storyboard", "continuity"))) continue; // engine-managed only
    if (!touchedRecently(path.join(proj.path, "storyboard"), 5 * 60 * 1000)) continue; // skip if not edited recently
    try {
      const idx = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
      if (!idx) continue;
      const res = emitProject(idx, proj.path, proj.slug, { write: true });
      const errs = res.lint.totalErrors;
      if (res.changes.length || errs) {
        lines.push(`[physics] ${proj.slug}: regenerated ${res.changes.length} file(s)${errs ? `, ⚠ ${errs} continuity error(s)` : ""}`);
      }
    } catch {
      /* never block the turn */
    }
  }
  if (lines.length) console.log(lines.join("\n"));
}

try {
  main();
} catch {
  /* always exit 0 */
}
