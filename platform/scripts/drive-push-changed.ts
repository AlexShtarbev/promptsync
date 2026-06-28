#!/usr/bin/env tsx
/**
 * drive-push-changed — mirror the authored markdown changed in a commit up to Drive.
 *
 * Invoked by the git post-commit hook (see hooks/post-commit-drive-push.sh): it receives
 * the commit's changed file list on stdin and the repo root in PROMPTSYNC_REPO, resolves
 * which belong to a PromptSync project, and uploads just those text files to the matching
 * Drive folder. Only authored TEXT is synced here — generated assets are written separately
 * by Claude via the Drive MCP. Deletions are logged, not propagated (manual for now).
 *
 * Runs out-of-band (the hook backgrounds it), so it never blocks a commit.
 */
import fs from "fs";
import path from "path";
import { isTextFile } from "../server/services/drive-store.js";
import { isDriveEnabled, getDrive, ensureFolder, uploadFile } from "../server/services/drive-sync.js";

export interface PushTarget {
  projectName: string; // Drive folder name for the project (basename of its root)
  projectRoot: string; // abs path to the dir holding project.yaml
  relPath: string; // file path relative to projectRoot (posix-ish)
  abs: string; // abs path on disk
}

/**
 * Resolve changed repo-relative paths to per-file push targets: keep only authored TEXT
 * files that live under a project. The mirror root is the nearest `series.yaml` ancestor if
 * there is one (so a series' episodes AND its shared global library keep their structure
 * under a single Drive folder), otherwise the nearest `project.yaml` ancestor (standalone
 * project). `hasFile` is injected so this is unit-testable without a real tree.
 */
export function resolveTargets(
  repo: string,
  changed: string[],
  hasFile: (dir: string, name: string) => boolean
): PushTarget[] {
  const out: PushTarget[] = [];
  for (const rel of changed) {
    if (!rel || !isTextFile(rel)) continue; // assets / non-text are not git-mirrored
    const abs = path.resolve(repo, rel);
    let dir = path.dirname(abs);
    let projectRoot: string | null = null;
    let seriesRoot: string | null = null;
    // Walk up to the repo root, noting the nearest project.yaml and series.yaml.
    while (dir.length >= repo.length && dir.startsWith(repo)) {
      if (!seriesRoot && hasFile(dir, "series.yaml")) seriesRoot = dir;
      if (!projectRoot && hasFile(dir, "project.yaml")) projectRoot = dir;
      if (dir === repo) break;
      dir = path.dirname(dir);
    }
    const root = seriesRoot || projectRoot;
    if (!root) continue; // changed file isn't part of any project/series
    out.push({
      projectName: path.basename(root),
      projectRoot: root,
      relPath: path.relative(root, abs),
      abs,
    });
  }
  return out;
}

/** Ensure syncRoot/<segments...> exists, caching folder ids by their drive path. */
async function ensureChain(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drive: any,
  syncRootId: string,
  segments: string[],
  cache: Map<string, string>
): Promise<string> {
  let parent = syncRootId;
  let acc = "";
  for (const seg of segments) {
    acc = acc ? `${acc}/${seg}` : seg;
    let id = cache.get(acc);
    if (!id) {
      id = await ensureFolder(drive, seg, parent);
      cache.set(acc, id);
    }
    parent = id;
  }
  return parent;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    // No piped stdin (e.g. manual run) → resolve empty quickly.
    if (process.stdin.isTTY) resolve("");
  });
}

async function main(): Promise<number> {
  const repo = process.env.PROMPTSYNC_REPO || process.cwd();
  const rootName = process.env.PROMPTSYNC_DRIVE_ROOT || "promptsync";

  // Changed files: CLI args win (for testing), else stdin (the hook pipes them).
  const fromArgs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const changed = (fromArgs.length ? fromArgs.join("\n") : await readStdin())
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const targets = resolveTargets(repo, changed, (d, name) => fs.existsSync(path.join(d, name)));
  if (!targets.length) {
    console.log("drive-push-changed: no project markdown changed — nothing to mirror.");
    return 0;
  }

  if (!isDriveEnabled()) {
    console.warn("drive-push-changed: Drive not configured — skipping (commit unaffected).");
    return 0;
  }
  const drive = await getDrive();
  if (!drive) {
    console.warn("drive-push-changed: could not init Drive — skipping.");
    return 0;
  }

  const syncRootId = await ensureFolder(drive, rootName);
  const cache = new Map<string, string>();
  let pushed = 0;
  for (const t of targets) {
    if (!fs.existsSync(t.abs)) {
      console.log(`drive-push-changed: ${t.projectName}/${t.relPath} deleted — not propagated (manual).`);
      continue;
    }
    const relDir = path.dirname(t.relPath);
    const segments = [t.projectName, ...(relDir === "." ? [] : relDir.split(path.sep))];
    const parentId = await ensureChain(drive, syncRootId, segments, cache);
    await uploadFile(drive, t.abs, parentId, path.basename(t.relPath));
    console.log(`drive-push-changed: ↑ ${t.projectName}/${t.relPath}`);
    pushed++;
  }
  console.log(`drive-push-changed: mirrored ${pushed} file(s) to Drive '${rootName}/'.`);
  return 0;
}

// Only run when invoked directly (not when imported by the test).
if (process.argv[1] && process.argv[1].endsWith("drive-push-changed.ts")) {
  main().then((c) => process.exit(c)).catch((e) => {
    console.error("drive-push-changed failed:", e.message);
    process.exit(0); // never surface a non-zero exit to the commit
  });
}
