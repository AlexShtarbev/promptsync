#!/usr/bin/env tsx
/**
 * Emit every projection of a project FROM its authored state, in one pass — the reliable,
 * deterministic "author → files auto-emit" step. Regenerates each shot's nb-prompt [Subject] +
 * Negative (and Kling motion prompt), preserving authored creative blocks, plus the board TSV,
 * then reports the continuity gate.
 *
 *   npm run emit -- <project-dir> [--write] [--watch]
 *   npm run emit -- --slug <slug> --root <dir> [--write] [--watch]
 *
 * Default: dry-run (lists what WOULD change + lint status). --write writes. --watch re-emits on
 * change (safe: emit is idempotent, so a self-write settles in one more no-op pass).
 */
import fs from "fs";
import path from "path";
import { watch } from "chokidar";
import { discoverProjects, loadProject, invalidateWorkspaceCache } from "../server/services/markdown-parser.js";
import { emitProject, type EmitResult } from "../server/services/prompt-emitter.js";
import type { ProjectIndex } from "../server/types.js";

function resolveRoots(roots: string[]): string[] {
  const raw = roots.length ? roots : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function resolve(args: string[]): { dir: string; slug: string } | { error: string } {
  const roots: string[] = [];
  let slug: string | null = null;
  let dir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") roots.push(args[++i]);
    else if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--write" || args[i] === "--watch") continue;
    else if (!args[i].startsWith("--") && !dir && !slug) dir = args[i];
  }
  if (slug) {
    const proj = discoverProjects(resolveRoots(roots)).find((p) => p.slug === slug);
    if (!proj) return { error: `Project "${slug}" not found` };
    return { dir: proj.path, slug };
  }
  if (dir) {
    const abs = path.resolve(process.cwd(), dir);
    const idx = loadProject(abs);
    if (!idx) return { error: `No project.yaml under ${abs}` };
    return { dir: abs, slug: idx.config.slug || path.basename(abs) };
  }
  return { error: "Usage: emit <project-dir> [--write] [--watch]  OR  --slug <slug> --root <dir> [--write] [--watch]" };
}

function load(dir: string): ProjectIndex | null {
  invalidateWorkspaceCache();
  // Re-discover so series episodes get their global element dirs.
  const proj = discoverProjects([path.resolve(dir, "..", ".."), dir]).find((p) => p.path === dir);
  return proj ? loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults) : loadProject(dir);
}

function report(res: EmitResult, write: boolean): void {
  const verb = write ? "wrote" : "would change";
  if (res.changes.length === 0) console.log(`✓ all projections in sync — nothing to ${write ? "write" : "change"}.`);
  for (const c of res.changes) {
    console.log(`  ${write ? "✎" : "·"} ${verb}  [${c.kind}]${c.shotCode ? " " + c.shotCode : ""}  ${path.relative(process.cwd(), c.path)}`);
  }
  if (res.skipped) console.log(`  (${res.skipped} shot(s) skipped — no compiled state, left untouched)`);
  const l = res.lint;
  console.log(`  continuity: ${l.totalErrors === 0 && l.totalWarnings === 0 ? "✓ clean" : `${l.totalErrors} error(s), ${l.totalWarnings} warning(s)`}`);
}

function main(): number {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const watchMode = args.includes("--watch");
  const r = resolve(args);
  if ("error" in r) {
    console.error(r.error);
    return 2;
  }

  const once = (): EmitResult | null => {
    const idx = load(r.dir);
    if (!idx) {
      console.error(`Failed to load ${r.dir}`);
      return null;
    }
    return emitProject(idx, r.dir, r.slug, { write: write || watchMode });
  };

  const first = once();
  if (!first) return 2;
  report(first, write || watchMode);

  if (!watchMode) return first.lint.totalErrors > 0 && !write ? 1 : 0;

  // --watch: re-emit on source change. Idempotency means a self-write settles immediately.
  console.log(`\n👁  watching ${path.relative(process.cwd(), r.dir)}/storyboard — auto-emitting on change (Ctrl-C to stop)`);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const w = watch([path.join(r.dir, "storyboard")], { ignoreInitial: true, interval: 300 });
  w.on("all", (_e, fp) => {
    if (!/\.(md|tsv|yaml|yml)$/.test(fp)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const res = once();
      if (res && res.changes.length) report(res, true);
    }, 350);
  });
  return 0; // long-lived
}

const code = main();
if (code !== 0) process.exit(code);
