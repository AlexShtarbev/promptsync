#!/usr/bin/env tsx
/**
 * Assemble a complete nb-prompt for a shot FROM its resolved state: the compiler owns
 * [Subject] + Negative, the author's other blocks pass through. Closes the loop with the
 * validator — the assembled file carries the state by construction.
 *
 *   npm run assemble -- <project-dir> <shotCode> [--write] [--kling]
 *   npm run assemble -- --slug <slug> --root <dir> <shotCode> [--write] [--kling]
 *
 * Default writes a preview to <prompt>.compiled.md (no clobber); --write overwrites the prompt.
 * --kling assembles the Kling motion prompt (video-prompts/<shot>/kling-prompt.md) instead of
 * the still nb-prompt — same state, video negative policy, lean (identity locked by start frame).
 */
import fs from "fs";
import path from "path";
import { discoverProjects, loadProject } from "../server/services/markdown-parser.js";
import { compileShot, loadManifestsForProject } from "../server/services/state-importer.js";
import { assembleNbPrompt } from "../server/services/prompt-assembler.js";
import type { ProjectIndex } from "../server/types.js";

function resolveRoots(roots: string[]): string[] {
  const raw = roots.length ? roots : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function resolve(args: string[]): { project: ProjectIndex; dir: string; shot: string } | { error: string } {
  const roots: string[] = [];
  let slug: string | null = null;
  let dir: string | null = null;
  let shot: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") roots.push(args[++i]);
    else if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--write") continue;
    else if (!args[i].startsWith("--")) {
      if (!dir && !slug) dir = args[i];
      else if (!shot) shot = args[i];
    }
  }
  if (!shot) return { error: "Provide a shot code, e.g. `npm run assemble -- --slug crawler-ep01 --root ../../crawler 3C`" };
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
  const write = args.includes("--write");
  const kling = args.includes("--kling");
  const r = resolve(args);
  if ("error" in r) {
    console.error(r.error);
    return 2;
  }

  const manifests = loadManifestsForProject(r.project, r.dir);
  const result = compileShot(r.project, manifests, r.shot, kling ? "kling" : undefined);
  if ("error" in result) {
    console.error(result.error);
    return 2;
  }

  const srcPath = kling
    ? path.join(r.dir, "storyboard", "video-prompts", r.shot, "kling-prompt.md")
    : path.join(r.dir, "storyboard", "shots", r.shot, "nb-prompt.md");
  if (!fs.existsSync(srcPath)) {
    console.error(`No ${kling ? "kling-prompt.md" : "nb-prompt.md"} at ${srcPath} to assemble into`);
    return 2;
  }
  const assembled = assembleNbPrompt(fs.readFileSync(srcPath, "utf-8"), result.compiled);

  const outPath = write ? srcPath : srcPath.replace(/\.md$/, ".compiled.md");
  fs.writeFileSync(outPath, assembled);

  console.log(`\n━━━ assembled ${kling ? "kling-prompt" : "nb-prompt"} — ${r.shot} (${result.input.platform}) ━━━\n`);
  console.log(assembled);
  console.log(`\n→ wrote ${path.relative(process.cwd(), outPath)}${write ? "  (overwrote nb-prompt.md)" : "  (preview; pass --write to overwrite nb-prompt.md)"}`);
  return 0;
}

process.exit(main());
