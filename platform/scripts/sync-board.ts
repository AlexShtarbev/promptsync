#!/usr/bin/env tsx
/**
 * Sync the storyboard board (`{slug}_storyboard.tsv`) FROM the per-shot shot.md files, so the
 * at-a-glance board is a provable projection — never hand-maintained, never drifting.
 *
 *   npm run sync-board -- <project-dir> [--write]
 *   npm run sync-board -- --slug <slug> --root <dir> [--write]
 *
 * Default: report drift (exit non-zero if any). --write: regenerate the TSV (board-only columns
 * like "Shot image" and the column order are preserved).
 */
import fs from "fs";
import path from "path";
import { discoverProjects, loadProject } from "../server/services/markdown-parser.js";
import { compileBoardTsv, boardDrift, findBoardTsv, isStructuredColumn } from "../server/services/board-compiler.js";
import type { ProjectIndex } from "../server/types.js";

function resolveRoots(roots: string[]): string[] {
  const raw = roots.length ? roots : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function resolve(args: string[]): { project: ProjectIndex; dir: string; slug: string } | { error: string } {
  const roots: string[] = [];
  let slug: string | null = null;
  let dir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") roots.push(args[++i]);
    else if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--write") continue;
    else if (!args[i].startsWith("--") && !dir && !slug) dir = args[i];
  }
  if (slug) {
    const proj = discoverProjects(resolveRoots(roots)).find((p) => p.slug === slug);
    if (!proj) return { error: `Project "${slug}" not found` };
    const project = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!project) return { error: `Failed to load "${slug}"` };
    return { project, dir: proj.path, slug };
  }
  if (dir) {
    const abs = path.resolve(process.cwd(), dir);
    const project = loadProject(abs);
    if (!project) return { error: `No project.yaml under ${abs}` };
    return { project, dir: abs, slug: project.config.slug || path.basename(abs) };
  }
  return { error: "Usage: sync-board <project-dir> [--write]  OR  --slug <slug> --root <dir> [--write]" };
}

function main(): number {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const r = resolve(args);
  if ("error" in r) {
    console.error(r.error);
    return 2;
  }

  const boardPath = findBoardTsv(r.dir, r.slug) ?? path.join(r.dir, `${r.slug}_storyboard.tsv`);
  const existingRaw = fs.existsSync(boardPath) ? fs.readFileSync(boardPath, "utf-8") : undefined;

  if (write) {
    const tsv = compileBoardTsv(r.project, existingRaw);
    fs.writeFileSync(boardPath, tsv);
    console.log(`✓ wrote ${path.relative(process.cwd(), boardPath)} (${r.project.shots.length} shots projected from shot.md)`);
    return 0;
  }

  if (!existingRaw) {
    console.log(`No board at ${path.relative(process.cwd(), boardPath)} yet — run with --write to generate it.`);
    return 0;
  }
  const drift = boardDrift(r.project, existingRaw);
  if (drift.length === 0) {
    console.log("✓ board is in sync with shot.md — no drift.");
    return 0;
  }
  const structured = drift.filter((d) => isStructuredColumn(d.column));
  const prose = drift.length - structured.length;

  // Structured drift = real bookkeeping bugs (wrong duration/setting) — show each.
  for (const d of structured) {
    console.log(`✗ ${d.shotCode}  [${d.column}]\n    board:   ${d.board.slice(0, 90)}\n    shot.md: ${d.shotMd.slice(0, 90)}`);
  }
  if (structured.length === 0) console.log("✓ structured columns (setting, duration) are in sync.");
  if (prose > 0) {
    const shots = new Set(drift.filter((d) => !isStructuredColumn(d.column)).map((d) => d.shotCode)).size;
    console.log(`\nℹ ${prose} prose/summary cell(s) across ${shots} shot(s) differ (Subject & Action, Notes, …) — expected for an at-a-glance board. Run --write to re-project them from shot.md.`);
  }
  return structured.length > 0 ? 1 : 0;
}

process.exit(main());
