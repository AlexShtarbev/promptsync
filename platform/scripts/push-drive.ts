#!/usr/bin/env tsx
/**
 * push-drive — mirror a project's AUTHORED files (the git-owned source of truth) one-way
 * into Google Drive, where the browser-only extension/PWA read them. This is the transport
 * that replaces the localhost server: author locally (skills / Claude / CLI), push to Drive,
 * read in the browser.
 *
 *   npm run push-drive -- <project-dir>            # dry-run (default): prints intended ops
 *   npm run push-drive -- --slug otto-and-pip      # resolve via PROJECTS_DIR / --root
 *   npm run push-drive -- --all                    # every discovered project
 *   npm run push-drive -- <dir> --apply            # ACTUALLY upload to Drive
 *   npm run push-drive -- <dir> --apply --with-assets   # also upload images/videos
 *   npm run push-drive -- <dir> --root-name promptsync  # Drive sync-root folder name
 *
 * SAFETY: dry-run is the default and needs no Drive credentials — it only walks the local
 * tree and reports what WOULD be created/uploaded. Nothing touches Drive without --apply.
 *
 * Ownership model: authored TEXT files (.md/.yaml/.json/.tsv/.txt) are pushed by default —
 * git owns them, Drive is a read mirror. Binary assets (rendered images/videos) are owned
 * by the browser/Drive at runtime, so they are SKIPPED unless --with-assets is given (useful
 * for a one-time seed of existing local renders during the transition).
 */
import fs from "fs";
import path from "path";
import { discoverProjects, loadProject } from "../server/services/markdown-parser.js";
import { isTextFile } from "../server/services/drive-store.js";
import { isDriveEnabled, getDrive, ensureFolder, uploadFile } from "../server/services/drive-sync.js";

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git"]);

interface Options {
  apply: boolean;
  withAssets: boolean;
  rootName: string;
  roots: string[];
  slug: string | null;
  dir: string | null;
  all: boolean;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    apply: false,
    withAssets: false,
    rootName: "promptsync",
    roots: [],
    slug: null,
    dir: null,
    all: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") o.apply = true;
    else if (a === "--with-assets") o.withAssets = true;
    else if (a === "--all") o.all = true;
    else if (a === "--root-name") o.rootName = argv[++i];
    else if (a === "--root") o.roots.push(argv[++i]);
    else if (a === "--slug") o.slug = argv[++i];
    else if (!a.startsWith("--") && !o.dir) o.dir = a;
  }
  return o;
}

function resolveRoots(rootArgs: string[]): string[] {
  const raw = rootArgs.length
    ? rootArgs
    : (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), "..")).split(path.delimiter);
  return raw.map((r) => r.trim()).filter(Boolean).map((r) => path.resolve(process.cwd(), r));
}

/** The project directories to push, resolved from a positional dir, --slug, or --all. */
function resolveProjectDirs(o: Options): { name: string; dir: string }[] | { error: string } {
  if (o.dir) {
    const dir = path.resolve(process.cwd(), o.dir);
    if (!loadProject(dir)) return { error: `No project.yaml under ${dir}` };
    return [{ name: path.basename(dir), dir }];
  }
  const projects = discoverProjects(resolveRoots(o.roots));
  if (o.all) {
    if (!projects.length) return { error: `No projects found under roots: ${resolveRoots(o.roots).join(", ")}` };
    return projects.map((p) => ({ name: path.basename(p.path), dir: p.path }));
  }
  if (o.slug) {
    const proj = projects.find((p) => p.slug === o.slug);
    if (!proj) return { error: `Project "${o.slug}" not found under roots: ${resolveRoots(o.roots).join(", ")}` };
    return [{ name: path.basename(proj.path), dir: proj.path }];
  }
  return { error: "Usage: push-drive <project-dir> | --slug <slug> | --all  [--apply] [--with-assets] [--root-name <name>]" };
}

interface Stats {
  folders: number;
  text: number;
  assets: number;
  skipped: number;
  bytes: number;
}

/**
 * Recursively mirror a local directory into a Drive folder. In dry-run, driveParentId is
 * null and we only log. In apply mode, we ensure each folder and upload each file.
 */
async function mirror(
  localDir: string,
  driveParentId: string | null,
  rel: string,
  o: Options,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drive: any,
  stats: Stats
): Promise<void> {
  const entries = fs
    .readdirSync(localDir, { withFileTypes: true })
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const localPath = path.join(localDir, e.name);
    const childRel = rel ? `${rel}/${e.name}` : e.name;

    if (e.isDirectory()) {
      stats.folders++;
      console.log(`  📁 ${childRel}/`);
      let childId: string | null = null;
      if (o.apply) childId = await ensureFolder(drive, e.name, driveParentId ?? undefined);
      await mirror(localPath, childId, childRel, o, drive, stats);
      continue;
    }

    const text = isTextFile(e.name);
    if (!text && !o.withAssets) {
      stats.skipped++;
      continue; // binary asset, browser-owned — skip unless seeding
    }
    const size = fs.statSync(localPath).size;
    stats.bytes += size;
    if (text) stats.text++;
    else stats.assets++;
    console.log(`  ${text ? "📄" : "🖼 "} ${childRel}  (${(size / 1024).toFixed(1)} KB)`);
    if (o.apply) await uploadFile(drive, localPath, driveParentId!, e.name);
  }
}

async function main(): Promise<number> {
  const o = parseArgs(process.argv.slice(2));
  const resolved = resolveProjectDirs(o);
  if ("error" in resolved) {
    console.error(resolved.error);
    return 2;
  }

  console.log(
    o.apply
      ? `\n⚠️  APPLY mode — uploading to Drive folder "${o.rootName}/" ${o.withAssets ? "(including assets)" : "(text only)"}\n`
      : `\n🔍 DRY-RUN — nothing will be uploaded. Re-run with --apply to push.${o.withAssets ? " (assets included)" : ""}\n`
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let drive: any = null;
  let syncRootId: string | null = null;
  if (o.apply) {
    if (!isDriveEnabled()) {
      console.error("Drive is not configured (no credentials/token). Set up google_creds first.");
      return 3;
    }
    drive = await getDrive();
    if (!drive) {
      console.error("Failed to initialise the Drive client.");
      return 3;
    }
    syncRootId = await ensureFolder(drive, o.rootName); // under My Drive root
    console.log(`Sync root: ${o.rootName}/  (Drive folder ${syncRootId})\n`);
  }

  const total: Stats = { folders: 0, text: 0, assets: 0, skipped: 0, bytes: 0 };
  for (const proj of resolved) {
    console.log(`▸ ${proj.name}  (${proj.dir})`);
    let projFolderId: string | null = null;
    if (o.apply) projFolderId = await ensureFolder(drive, proj.name, syncRootId ?? undefined);
    await mirror(proj.dir, projFolderId, "", o, drive, total);
    console.log("");
  }

  console.log(
    `${o.apply ? "✓ pushed" : "would push"}: ${total.text} text + ${total.assets} asset file(s), ` +
      `${total.folders} folder(s), ${(total.bytes / 1024).toFixed(1)} KB` +
      (total.skipped ? `; ${total.skipped} asset(s) skipped (use --with-assets to include)` : "")
  );
  if (!o.apply) console.log(`\nRun again with --apply to perform the upload.`);
  return 0;
}

main().then((code) => process.exit(code));
