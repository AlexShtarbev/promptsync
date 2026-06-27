#!/usr/bin/env tsx
/**
 * Continuity linter CLI — the Tier-1 physics-engine checks over a project's
 * continuity manifests + nb-prompts. Pure, deterministic, no GPU/model.
 *
 *   npm run lint:continuity -- <project-dir> [--json]
 *   npm run lint:continuity -- --slug <slug> [--root <dir>]... [--json]
 *
 * Exit code is the number of ERROR-severity findings (0 = clean), so it can gate CI.
 */
import path from "path";
import {
  discoverProjects,
  loadProject,
} from "../server/services/markdown-parser.js";
import {
  validateContinuity,
  type ContinuityReport,
  type ContinuityIssue,
} from "../server/services/continuity-validator.js";

function resolveRoots(rootArgs: string[]): string[] {
  const raw = rootArgs.length
    ? rootArgs
    : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function reportFor(args: string[]): ContinuityReport | { error: string } {
  const roots: string[] = [];
  let slug: string | null = null;
  let dir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") roots.push(args[++i]);
    else if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--json") continue;
    else if (!args[i].startsWith("--") && !dir) dir = args[i];
  }

  if (dir) {
    const projectDir = path.resolve(process.cwd(), dir);
    const index = loadProject(projectDir);
    if (!index) return { error: `No project.yaml under ${projectDir}` };
    return validateContinuity(index, projectDir, index.config.slug || path.basename(projectDir));
  }

  if (slug) {
    const projects = discoverProjects(resolveRoots(roots));
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return { error: `Project "${slug}" not found under roots: ${resolveRoots(roots).join(", ")}` };
    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return { error: `Failed to load project "${slug}"` };
    return validateContinuity(index, proj.path, slug);
  }

  return { error: "Usage: lint-continuity <project-dir> [--json]  OR  --slug <slug> [--root <dir>]... [--json]" };
}

function printReport(report: ContinuityReport): void {
  const icon = (i: ContinuityIssue) => (i.severity === "error" ? "✗" : "!");
  const order = { error: 0, warning: 1 } as const;
  const sorted = [...report.issues].sort(
    (a, b) => order[a.severity] - order[b.severity] || a.shotCode.localeCompare(b.shotCode),
  );
  if (sorted.length === 0) {
    console.log(`✓ continuity OK — scenes [${report.scenes.join(", ")}], no issues`);
    return;
  }
  for (const i of sorted) {
    const where = i.shotCodeB ? `${i.shotCode}→${i.shotCodeB}` : i.shotCode;
    console.log(`${icon(i)} [${i.severity}] ${i.rule}  (${where})\n    ${i.message}`);
  }
  console.log(
    `\n${report.totalErrors} error(s), ${report.totalWarnings} warning(s) across scenes [${report.scenes.join(", ")}].`,
  );
}

function main(): number {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const result = reportFor(args);

  if ("error" in result) {
    console.error(result.error);
    return 2;
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result);
  }
  return result.totalErrors;
}

process.exit(main());
