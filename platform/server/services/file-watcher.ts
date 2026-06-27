import { watch, type FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { invalidateWorkspaceCache, discoverProjects, loadProject } from "./markdown-parser.js";
import { validateContinuity } from "./continuity-validator.js";
import { emitProject } from "./prompt-emitter.js";
import { projectDocFiles } from "../routes/documents.js";
import type { Broadcaster } from "./ws-hub.js";

// Auto-emit: regenerate projections (inject missing mandatory clauses, sync the board) on every
// save. Low-touch DEFAULT is ON; the choice is persisted across restarts and toggleable live from
// the UI. PHYSICS_AUTOEMIT=0/1 forces it (overriding the persisted value).
const STATE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.autoemit.json");

function loadAutoEmit(): boolean {
  const env = process.env.PHYSICS_AUTOEMIT;
  if (env === "0" || env === "false") return false;
  if (env === "1" || env === "true") return true;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")).enabled === true;
  } catch {
    return true; // default ON — hands-off out of the box
  }
}

let autoEmit = loadAutoEmit();
export function getAutoEmit(): boolean {
  return autoEmit;
}
export function setAutoEmit(on: boolean): void {
  autoEmit = on;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ enabled: on }));
  } catch {
    /* best-effort persistence */
  }
  console.log(`[emit] auto-emit ${on ? "ON" : "OFF"}`);
}

let watcher: FSWatcher | null = null;
let hub: Broadcaster | null = null;
let watchedDirs: string[] = [];

/**
 * Re-run the continuity engine for every project touched by this batch of changes and
 * broadcast a report (the deterministic gate, on every save). Best-effort: never throw
 * into the watcher.
 */
function runContinuity(changedPaths: string[]): void {
  try {
    const projects = discoverProjects(watchedDirs);
    const touched = projects.filter((p) => changedPaths.some((c) => c.startsWith(p.path + path.sep)));
    for (const proj of touched) {
      const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
      if (!index) continue;
      if (autoEmit) {
        // Idempotent + non-destructive (inject-only): a self-write settles in one more no-op pass.
        const emitted = emitProject(index, proj.path, proj.slug, { write: true });
        if (emitted.changes.length) console.log(`[emit] ${proj.slug}: regenerated ${emitted.changes.length} projection(s)`);
      }
      const report = validateContinuity(index, proj.path, proj.slug);
      const status = report.totalErrors || report.totalWarnings
        ? `${report.totalErrors} error(s), ${report.totalWarnings} warning(s)`
        : "✓ clean";
      console.log(`[continuity] ${proj.slug}: ${status}`);
      broadcast({ type: "continuity-report", slug: proj.slug, report });
    }
  } catch (err) {
    console.error("[continuity] validation failed:", (err as Error).message);
  }
}

const WATCHED_EXTS = new Set([
  ".md", ".yaml", ".yml",
  ".png", ".jpg", ".jpeg", ".webp",
  ".mp4", ".webm", ".mov",
  ".json",
]);

function broadcast(data: Record<string, unknown>) {
  hub?.broadcast(data);
}

export function startWatcher(projectDirs: string[], broadcaster: Broadcaster) {
  hub = broadcaster;
  watchedDirs = projectDirs;

  const watchPaths = projectDirs.flatMap((dir) => [
    path.join(dir, "storyboard"),     // local shots/elements, or a series global library
    path.join(dir, "project.yaml"),
    path.join(dir, "series.yaml"),
    path.join(dir, "bible"),          // series narrative canon (Documents)
    // Root-level Documents (.md/.txt). Keep the two canonical names explicit so
    // they're watched even if created after startup; add any other doc files present.
    path.join(dir, "pre-production.md"),
    path.join(dir, "script.md"),
    ...projectDocFiles(dir).map((f) => path.join(dir, f)),
  ]);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingChanges = new Set<string>();

  const flush = () => {
    const changes = [...pendingChanges];
    pendingChanges.clear();
    broadcast({ type: "files-changed", paths: changes });
    runContinuity(changes); // deterministic continuity gate on every save
  };

  watcher = watch(watchPaths, {
    ignoreInitial: true,
    usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    interval: 300,
  });

  watcher.on("all", (_event, filePath) => {
    if (!WATCHED_EXTS.has(path.extname(filePath).toLowerCase())) return;
    invalidateWorkspaceCache(); // a project.yaml/series.yaml may have changed
    pendingChanges.add(filePath);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, 300);
  });

  return watcher;
}

export function notifyChange(filePath: string) {
  broadcast({ type: "files-changed", paths: [filePath] });
}

export function stopWatcher() {
  watcher?.close();
  watcher = null;
}
