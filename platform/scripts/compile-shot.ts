#!/usr/bin/env tsx
/**
 * Compile a shot's mandatory prompt clauses FROM its resolved state, and (Phase-0
 * round-trip) report coverage against the hand-authored nb-prompt.
 *
 *   npm run compile -- <project-dir> <shotCode> [--json]
 *   npm run compile -- --slug <slug> --root <dir> <shotCode> [--json]
 */
import path from "path";
import { discoverProjects, loadProject } from "../server/services/markdown-parser.js";
import {
  compileShot,
  coverageVsPrompt,
  loadManifestsForProject,
} from "../server/services/state-importer.js";
import type { ProjectIndex } from "../server/types.js";

function resolveRoots(roots: string[]): string[] {
  const raw = roots.length ? roots : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function resolveProject(args: string[]): { project: ProjectIndex; dir: string; shot: string } | { error: string } {
  const roots: string[] = [];
  let slug: string | null = null;
  let dir: string | null = null;
  let shot: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") roots.push(args[++i]);
    else if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--json") continue;
    else if (!args[i].startsWith("--")) {
      if (!dir && !slug) dir = args[i];
      else if (!shot) shot = args[i];
    }
  }
  if (!shot) return { error: "Provide a shot code, e.g. `npm run compile -- --slug crawler-ep01 --root ../../crawler 3C`" };

  if (slug) {
    const proj = discoverProjects(resolveRoots(roots)).find((p) => p.slug === slug);
    if (!proj) return { error: `Project "${slug}" not found` };
    const project = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!project) return { error: `Failed to load "${slug}"` };
    return { project, dir: proj.path, shot };
  }
  if (dir) {
    const abs = path.resolve(process.cwd(), dir);
    const project = loadProject(abs);
    if (!project) return { error: `No project.yaml under ${abs}` };
    return { project, dir: abs, shot };
  }
  return { error: "Provide --slug or a project dir" };
}

function main(): number {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const r = resolveProject(args);
  if ("error" in r) {
    console.error(r.error);
    return 2;
  }

  const manifests = loadManifestsForProject(r.project, r.dir);
  const result = compileShot(r.project, manifests, r.shot);
  if ("error" in result) {
    console.error(result.error);
    return 2;
  }
  const coverage = coverageVsPrompt(result, r.project);

  if (json) {
    console.log(JSON.stringify({ ...result, coverage }, null, 2));
    return 0;
  }

  console.log(`\n━━━ compiled mandatory clauses — ${r.shot} (${result.input.platform}) ━━━`);
  if (result.compiled.subjectClauses.length === 0) console.log("  (none — body not visible / no state)");
  for (const c of result.compiled.subjectClauses) console.log("  • " + c);
  console.log(`\n[Negative]: ${result.compiled.negative || "(none)"}`);
  if (result.compiled.notes.length) {
    console.log("\nnotes:");
    for (const n of result.compiled.notes) console.log("  - " + n);
  }

  console.log(`\n━━━ round-trip coverage vs hand-authored nb-prompt ━━━`);
  for (const it of coverage.items) {
    console.log(`  ${it.covered ? "✓ in prompt " : "＋ would add"}  [${it.kind}] ${it.detail.slice(0, 80)}`);
  }
  console.log(
    coverage.additions === 0
      ? `\n✓ engine reproduces the hand-authored prompt (0 additions) — round-trip converges.`
      : `\n${coverage.additions} mandatory clause(s) the engine would add (intended improvements or gaps).`,
  );
  return 0;
}

process.exit(main());
