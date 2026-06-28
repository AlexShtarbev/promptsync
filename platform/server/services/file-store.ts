/**
 * FileStore (Node entry) — re-exports the fs-free core (interface, MemFileStore, registry)
 * and adds the Node-only `FsStore`, which it installs as the default store at import so
 * server/CLI behaviour is byte-identical to before the core split.
 *
 * The browser/extension bundle imports `file-store-core.ts` directly (the esbuild build
 * aliases this module to it), so it never pulls in `fs`.
 */
import fs from "fs";
import { setFileStore, type FileStore, type DirEntry } from "./file-store-core.js";

export * from "./file-store-core.js";

/**
 * Node filesystem implementation — preserves current server/CLI behaviour. This is the ONLY
 * fs-touching export of the FileStore seam, so the browser split stays a one-file concern.
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

// Restore the server/CLI default: an fs-backed store. (Core defaults to MemFileStore.)
setFileStore(new FsStore());
