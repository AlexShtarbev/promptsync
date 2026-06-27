#!/usr/bin/env tsx
/**
 * Structure tool — scaffold a correct project/series layout and validate that an
 * existing one adheres to it. Run by the model (or a human) so every generated
 * file lands in the right place.
 *
 *   npm run structure -- validate [--root <dir>]... [--fix] [--json]
 *   npm run structure -- scaffold-series  <dir> <slug> <name> [ep01 ep02 ...]
 *   npm run structure -- scaffold-project <dir> <slug> <name>
 *   npm run structure -- scaffold-episode <seriesDir> <epSlug> <name>
 *   npm run structure -- new-element <baseDir> <type> <scope> <name> [canonPath]
 *
 * <baseDir> for new-element is the series root (scope=global) or an episode/project
 * dir (scope=local). <type> = character|creature|environment|prop.
 */
import path from "path";
import {
  validateStructure, fixStructure,
  scaffoldSeries, scaffoldProject, scaffoldEpisode, scaffoldElement,
  type StructureIssue, type ElementSpec,
} from "../server/services/structure.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveRoots(rootArgs: string[]): string[] {
  const raw = rootArgs.length
    ? rootArgs
    : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function printIssues(issues: StructureIssue[]): void {
  if (!issues.length) { console.log("✓ structure OK — no issues"); return; }
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = [...issues].sort((a, b) => order[a.level] - order[b.level]);
  const icon = { error: "✗", warning: "!", info: "·" } as const;
  for (const i of sorted) {
    console.log(`${icon[i.level]} [${i.level}] ${i.code}  (${i.context})${i.fixable ? "  [fixable]" : ""}\n    ${i.message}`);
  }
  const errs = issues.filter((i) => i.level === "error").length;
  const warns = issues.filter((i) => i.level === "warning").length;
  console.log(`\n${errs} error(s), ${warns} warning(s), ${issues.length} total.`);
}

function main(): number {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case "validate": {
      const roots: string[] = [];
      let fix = false, json = false;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--root") roots.push(rest[++i]);
        else if (rest[i] === "--fix") fix = true;
        else if (rest[i] === "--json") json = true;
      }
      const resolved = resolveRoots(roots);
      if (fix) {
        const { applied, remaining } = fixStructure(resolved);
        if (json) { console.log(JSON.stringify({ applied, remaining }, null, 2)); return remaining.some((i) => i.level === "error") ? 1 : 0; }
        if (applied.length) { console.log("Applied fixes:"); applied.forEach((a) => console.log("  + " + a)); console.log(""); }
        printIssues(remaining);
        return remaining.some((i) => i.level === "error") ? 1 : 0;
      }
      const issues = validateStructure(resolved);
      if (json) console.log(JSON.stringify(issues, null, 2));
      else printIssues(issues);
      return issues.some((i) => i.level === "error") ? 1 : 0;
    }

    case "scaffold-series": {
      const [dir, slug, name, ...eps] = rest;
      if (!dir || !slug || !name) { console.error("usage: scaffold-series <dir> <slug> <name> [eps...]"); return 2; }
      const res = scaffoldSeries(path.resolve(dir), slug, name, eps, today());
      console.log(`Created ${res.created.length}, skipped ${res.skipped.length}:`);
      res.created.forEach((c) => console.log("  + " + c));
      res.skipped.forEach((s) => console.log("  = " + s + " (exists)"));
      return 0;
    }

    case "scaffold-project": {
      const [dir, slug, name] = rest;
      if (!dir || !slug || !name) { console.error("usage: scaffold-project <dir> <slug> <name>"); return 2; }
      const res = scaffoldProject(path.resolve(dir), slug, name, today());
      res.created.forEach((c) => console.log("  + " + c));
      res.skipped.forEach((s) => console.log("  = " + s + " (exists)"));
      return 0;
    }

    case "scaffold-episode": {
      const [seriesDir, epSlug, name] = rest;
      if (!seriesDir || !epSlug || !name) { console.error("usage: scaffold-episode <seriesDir> <epSlug> <name>"); return 2; }
      const res = scaffoldEpisode(path.resolve(seriesDir), epSlug, name, today());
      res.created.forEach((c) => console.log("  + " + c));
      res.skipped.forEach((s) => console.log("  = " + s + " (exists)"));
      return 0;
    }

    case "new-element": {
      const [baseDir, type, scope, name, canon] = rest;
      if (!baseDir || !type || !scope || !name) { console.error("usage: new-element <baseDir> <type> <scope> <name> [canonPath]"); return 2; }
      const spec: ElementSpec = { type: type as ElementSpec["type"], scope: scope as ElementSpec["scope"], name, canon: canon ?? null };
      const res = scaffoldElement(path.resolve(baseDir), spec);
      res.created.forEach((c) => console.log("  + " + c));
      res.skipped.forEach((s) => console.log("  = " + s + " (exists)"));
      return 0;
    }

    default:
      console.error(`Unknown command: ${cmd ?? "(none)"}\nCommands: validate | scaffold-series | scaffold-project | scaffold-episode | new-element`);
      return 2;
  }
}

process.exit(main());
