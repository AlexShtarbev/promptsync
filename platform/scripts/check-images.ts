#!/usr/bin/env tsx
/**
 * Check generated images against shot intent — cheap, deterministic, no model, no Claude.
 * Verifies aspect ratio + corruption/size sanity from image headers. Optional pixel tiers:
 *   --clip       posture/build vs compiled state (local CLIP model)
 *   --colortemp  warm/amber drift on cool-declared shots (free, no inference; the moonlight→honey tell)
 *
 *   npm run check-images -- <project-dir> [--clip] [--colortemp]
 *   npm run check-images -- --slug <slug> --root <dir> [--clip] [--colortemp]
 *
 * Exit code = number of findings (0 = all good), so it can gate a render batch.
 */
import path from "path";
import { discoverProjects, loadProject } from "../server/services/markdown-parser.js";
import { checkImages, type ImageVerifier, type ImageFinding } from "../server/services/image-checker.js";
import { loadManifestsForProject } from "../server/services/state-importer.js";
import { makeClipVerifier, loadClipScorer } from "../server/services/clip-verifier.js";
import { makeColorTempVerifier, loadPixelSampler } from "../server/services/color-temp-verifier.js";
import type { ProjectIndex } from "../server/types.js";

/** Run several verifiers per image and concatenate their findings. */
function composeVerifiers(verifiers: ImageVerifier[]): ImageVerifier {
  return async (shot, imagePath, buf) => {
    const out: ImageFinding[] = [];
    for (const v of verifiers) out.push(...(await v(shot, imagePath, buf)));
    return out;
  };
}

function resolveRoots(roots: string[]): string[] {
  const raw = roots.length ? roots : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

function resolve(args: string[]): { project: ProjectIndex; dir: string } | { error: string } {
  const roots: string[] = [];
  let slug: string | null = null;
  let dir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") roots.push(args[++i]);
    else if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--clip" || args[i] === "--colortemp") continue;
    else if (!args[i].startsWith("--") && !dir && !slug) dir = args[i];
  }
  if (slug) {
    const proj = discoverProjects(resolveRoots(roots)).find((p) => p.slug === slug);
    if (!proj) return { error: `Project "${slug}" not found` };
    const project = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    return project ? { project, dir: proj.path } : { error: `Failed to load "${slug}"` };
  }
  if (dir) {
    const abs = path.resolve(process.cwd(), dir);
    const project = loadProject(abs);
    return project ? { project, dir: abs } : { error: `No project.yaml under ${abs}` };
  }
  return { error: "Usage: check-images <project-dir> [--clip] [--colortemp]  OR  --slug <slug> --root <dir> [--clip] [--colortemp]" };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const r = resolve(args);
  if ("error" in r) {
    console.error(r.error);
    return 2;
  }
  const { project, dir } = r;

  // Optional higher-tier verifiers. Each degrades to Tier-0 (header checks) if its backend is absent.
  const verifiers: ImageVerifier[] = [];
  if (args.includes("--clip")) {
    try {
      const scorer = await loadClipScorer();
      verifiers.push(makeClipVerifier(project, loadManifestsForProject(project, dir), scorer));
      console.log("· CLIP posture/build verification enabled (local model)");
    } catch (e) {
      console.error(`· CLIP unavailable (${(e as Error).message}) — running header checks only`);
    }
  }
  // Tier-1 color-temperature drift (free, no inference). Flags warm/amber renders on cool-declared shots.
  if (args.includes("--colortemp")) {
    try {
      verifiers.push(makeColorTempVerifier(await loadPixelSampler()));
      console.log("· Color-temperature drift verification enabled (warm-on-cool tell)");
    } catch (e) {
      console.error(`· Color-temp unavailable (${(e as Error).message}) — skipping that check`);
    }
  }
  const verifier: ImageVerifier | undefined = verifiers.length ? composeVerifiers(verifiers) : undefined;

  const withImages = project.shots.filter((s) => s.imagePath).length;
  const findings = await checkImages(project, { verifier });
  if (findings.length === 0) {
    console.log(`✓ ${withImages} image(s) checked — aspect ratio + integrity all good.`);
    return 0;
  }
  for (const f of findings.sort((a, b) => a.shotCode.localeCompare(b.shotCode))) {
    console.log(`! [${f.kind}] ${f.shotCode}  ${f.message}`);
  }
  console.log(`\n${findings.length} finding(s) across ${withImages} image(s) checked.`);
  return findings.length;
}

main().then((code) => process.exit(code));
