#!/usr/bin/env tsx
/**
 * drive-push-asset — upsert a single BINARY asset (e.g. an OpenArt output video) into Drive
 * at  promptsync/<project>/<destRelPath>.  The source is either a URL (downloaded to a temp
 * file first) or a local path. Used by the PostToolUse OpenArt-archive hook
 * (hooks/posttooluse-openart-archive.sh). Mirrors drive-push-changed's upsert semantics, but
 * for binaries rather than authored text.
 *
 *   tsx drive-push-asset.ts --project <name> --dest <relpath> (--url <url> | --file <path>)
 *
 * Never throws to the caller (the hook backgrounds it); always exits 0.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { isDriveEnabled, getDrive, ensureFolder, uploadFile } from "../server/services/drive-sync.js";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${res.statusText}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureChain(drive: any, rootId: string, segments: string[]): Promise<string> {
  let parent = rootId;
  for (const seg of segments) parent = await ensureFolder(drive, seg, parent);
  return parent;
}

async function main(): Promise<number> {
  const project = arg("--project");
  const dest = arg("--dest"); // posix relpath under the project, e.g. openart-outputs/<id>.mp4
  const url = arg("--url");
  const file = arg("--file");
  const rootName = process.env.PROMPTSYNC_DRIVE_ROOT || "promptsync";

  if (!project || !dest || (!url && !file)) {
    console.error("drive-push-asset: need --project, --dest and (--url | --file).");
    return 0;
  }
  if (!isDriveEnabled()) {
    console.warn("drive-push-asset: Drive not configured — skipping.");
    return 0;
  }
  const drive = await getDrive();
  if (!drive) {
    console.warn("drive-push-asset: could not init Drive — skipping.");
    return 0;
  }

  // Resolve the source to a local file. The temp file keeps `dest`'s basename so its extension
  // (and therefore the MIME `uploadFile` derives from it) is correct.
  let local = file;
  let tmp: string | null = null;
  if (url) {
    tmp = path.join(os.tmpdir(), `ps-asset-${Date.now()}-${path.posix.basename(dest)}`);
    await download(url, tmp);
    local = tmp;
  }
  if (!local || !fs.existsSync(local)) {
    console.warn("drive-push-asset: source missing — skipping.");
    return 0;
  }

  try {
    // promptsync/<project>/<dest dirs...>
    const destDir = path.posix.dirname(dest);
    const segments = [project, ...(destDir === "." ? [] : destDir.split("/"))];
    const rootId = await ensureFolder(drive, rootName);
    const parentId = await ensureChain(drive, rootId, segments);
    const name = path.posix.basename(dest);
    await uploadFile(drive, local, parentId, name);
    console.log(`drive-push-asset: ↑ ${rootName}/${project}/${dest}`);
  } finally {
    if (tmp) { try { fs.unlinkSync(tmp); } catch { /* best effort */ } }
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("drive-push-asset.ts")) {
  main().then((c) => process.exit(c)).catch((e) => {
    console.error("drive-push-asset failed:", e.message);
    process.exit(0); // never surface a non-zero exit to the hook
  });
}
