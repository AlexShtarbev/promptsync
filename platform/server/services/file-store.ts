/**
 * FileStore — the single seam that decouples project parsing/discovery from Node's
 * filesystem so the exact same logic can run in the browser over Google Drive.
 *
 * The interface is deliberately SYNCHRONOUS, mirroring the `fs` calls the parser already
 * makes (existsSync / readFileSync / readdirSync). Node's `FsStore` wraps `fs` directly,
 * so server/CLI behaviour is byte-identical. The browser's DriveStore (added later) bulk-
 * prefetches a project subtree into an in-memory snapshot ONCE, then serves this sync
 * interface from that snapshot — which is the correct Drive access pattern anyway (one
 * batched `files.list` per folder, not a network round-trip per `exists()`).
 *
 * Swap the active store process-wide with `setFileStore()`; read it via `fileStore()`.
 */
import fs from "fs";

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
 * Node filesystem implementation — the default; preserves current server/CLI behaviour.
 *
 * NOTE (browser): this class top-level-imports `fs` and is therefore Node-only. The
 * browser bundle (Part C) excludes it — it imports only the interface + MemFileStore and
 * sets a DriveStore via setFileStore() before any parse runs. Keep FsStore the ONLY
 * fs-touching export of this module so that split stays a one-file concern.
 */
export class FsStore implements FileStore {
  exists(p: string): boolean {
    return fs.existsSync(p);
  }
  readText(p: string): string {
    return fs.readFileSync(p, "utf-8");
  }
  readBytes(p: string): Uint8Array {
    return fs.readFileSync(p);
  }
  readDir(p: string): DirEntry[] {
    try {
      return fs.readdirSync(p, { withFileTypes: true }).map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
      }));
    } catch {
      return [];
    }
  }
  writeText(p: string, data: string): void {
    fs.writeFileSync(p, data);
  }
}

/**
 * In-memory store keyed by absolute posix path. Used by tests and as the backing
 * shape the browser's DriveStore snapshot fills. Directories are inferred from the
 * set of file paths, so you only seed files.
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

let current: FileStore = new FsStore();

/** Swap the process-wide active store (e.g. the browser sets a DriveStore at startup). */
export function setFileStore(store: FileStore): void {
  current = store;
}

/** The currently active store. Parser/validator call this instead of touching `fs`. */
export function fileStore(): FileStore {
  return current;
}
