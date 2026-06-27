/**
 * DriveStore — loads a Google Drive folder subtree into an in-memory snapshot that the
 * existing (synchronous) parser/validator can read through the FileStore seam.
 *
 * Why a snapshot rather than per-call Drive reads: the FileStore interface is sync, and
 * Drive is async with real latency + quotas. So we do the network work ONCE, up front —
 * one `files.list` per folder, plus a download of each small text file — and serve every
 * subsequent exists()/readText()/readDir() from memory. This is also the cheapest Drive
 * access pattern (batched listing, no round-trip per existsSync).
 *
 * Binary assets (images/videos) are recorded as PRESENCE markers (empty bytes) so that
 * findImage()/findVideo() see them and status bumps fire, without pulling megabytes into
 * memory. Their actual bytes are served out-of-band via a Drive download URL (UI layer),
 * never through FileStore.readBytes on the parse path.
 *
 * This module is browser-safe (no Node imports). The real Drive REST client is injected
 * as a `DriveApi`, so the snapshot logic is unit-tested against an in-memory fake.
 */
import { MemFileStore } from "./file-store.js";

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

/** A Drive child as returned by files.list (the fields we request). */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

/** The minimal Drive surface the snapshot needs. Implemented over fetch in the browser. */
export interface DriveApi {
  /** Direct children of a folder (non-recursive). */
  listFolder(folderId: string): Promise<DriveFile[]>;
  /** UTF-8 contents of a file. */
  downloadText(fileId: string): Promise<string>;
}

// Extensions the parser actually reads as text. Everything else is a presence marker
// (snapshot) / a binary asset (push). Shared so the loader and the git→Drive push agree
// on exactly which files are "authored text".
export const TEXT_EXTS = new Set([".md", ".yaml", ".yml", ".json", ".tsv", ".txt"]);

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isTextFile(name: string): boolean {
  return TEXT_EXTS.has(extOf(name));
}

export interface SnapshotResult {
  store: MemFileStore;
  /** virtual-path -> Drive fileId, for assets whose bytes are fetched lazily out-of-band. */
  assetIds: Map<string, string>;
  /** counts for logging/telemetry */
  stats: { folders: number; textFiles: number; assets: number };
}

/**
 * Walk a Drive folder subtree and materialise it into a MemFileStore mounted at `mountPath`.
 * Folders recurse; text files are downloaded; binaries become empty presence markers whose
 * Drive id is recorded in `assetIds` for lazy retrieval.
 */
export async function buildSnapshot(
  api: DriveApi,
  rootFolderId: string,
  mountPath = "/drive"
): Promise<SnapshotResult> {
  const store = new MemFileStore();
  const assetIds = new Map<string, string>();
  const stats = { folders: 0, textFiles: 0, assets: 0 };

  const walk = async (folderId: string, prefix: string): Promise<void> => {
    const children = await api.listFolder(folderId);
    await Promise.all(
      children.map(async (child) => {
        const childPath = `${prefix}/${child.name}`;
        if (child.mimeType === DRIVE_FOLDER_MIME) {
          stats.folders++;
          await walk(child.id, childPath);
        } else if (isTextFile(child.name)) {
          const text = await api.downloadText(child.id);
          store.set(childPath, text);
          stats.textFiles++;
        } else {
          store.set(childPath, new Uint8Array()); // presence marker
          assetIds.set(childPath, child.id);
          stats.assets++;
        }
      })
    );
  };

  await walk(rootFolderId, mountPath.replace(/\/$/, ""));
  return { store, assetIds, stats };
}
