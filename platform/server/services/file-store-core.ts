/**
 * FileStore core — the fs-FREE half of the FileStore seam (interface + MemFileStore +
 * the process-wide registry). Split out of file-store.ts so the browser/extension bundle
 * can use the seam without pulling in Node's `fs` (which only FsStore needs). The Node
 * entry (file-store.ts) re-exports everything here, adds FsStore, and sets it as the
 * default store at import — so server/CLI behaviour is unchanged.
 */

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export interface FileStore {
  /** True if a file or directory exists at this path. */
  exists(p: string): boolean;
  /** UTF-8 file contents. Callers guard with exists(); may throw if absent. */
  readText(p: string): string;
  /** Raw bytes (image/video header parsing). */
  readBytes(p: string): Uint8Array;
  /** Directory entries, or [] when the directory is missing/unreadable. */
  readDir(p: string): DirEntry[];
  /** Create or overwrite a UTF-8 file (CLI/emit side; browser path never authors). */
  writeText(p: string, data: string): void;
}

/**
 * In-memory store keyed by absolute posix path. Used by tests and as the backing shape
 * the browser's DriveStore snapshot fills. Directories are inferred from the set of file
 * paths, so you only seed files. No Node imports — browser-safe.
 */
export class MemFileStore implements FileStore {
  private files = new Map<string, Uint8Array>();
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  /** Seed a text file (parents are implied). */
  set(p: string, data: string | Uint8Array): void {
    this.files.set(norm(p), typeof data === "string" ? this.enc.encode(data) : data);
  }

  exists(p: string): boolean {
    const n = norm(p);
    if (this.files.has(n)) return true;
    const prefix = n.endsWith("/") ? n : n + "/";
    for (const key of this.files.keys()) if (key.startsWith(prefix)) return true;
    return false;
  }
  readText(p: string): string {
    const b = this.files.get(norm(p));
    if (!b) throw new Error(`ENOENT: ${p}`);
    return this.dec.decode(b);
  }
  readBytes(p: string): Uint8Array {
    const b = this.files.get(norm(p));
    if (!b) throw new Error(`ENOENT: ${p}`);
    return b;
  }
  readDir(p: string): DirEntry[] {
    const prefix = norm(p).replace(/\/$/, "") + "/";
    const seen = new Map<string, boolean>(); // name -> isDirectory
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash === -1) {
        if (!seen.has(rest)) seen.set(rest, false);
      } else {
        seen.set(rest.slice(0, slash), true);
      }
    }
    return [...seen.entries()].map(([name, isDirectory]) => ({ name, isDirectory }));
  }
  writeText(p: string, data: string): void {
    this.set(p, data);
  }
}

function norm(p: string): string {
  // Collapse duplicate slashes; keep it simple (paths are already posix here).
  return p.replace(/\/+/g, "/");
}

// Default store is the in-memory one (browser-safe). The Node entry overrides this with an
// FsStore at import; the browser sets a DriveStore via setFileStore() before any parse runs.
let current: FileStore = new MemFileStore();

/** Swap the process-wide active store (e.g. the browser sets a DriveStore at startup). */
export function setFileStore(store: FileStore): void {
  current = store;
}

/** The currently active store. Parser/validator call this instead of touching `fs`. */
export function fileStore(): FileStore {
  return current;
}
