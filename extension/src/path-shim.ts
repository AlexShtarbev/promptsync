/**
 * Minimal POSIX `path` shim for the browser bundle. markdown-parser uses `path` only for
 * pure string ops on virtual `/drive/...` paths (join/resolve/basename/dirname/extname) —
 * never for filesystem access — so this faithful subset is enough. Aliased to `path` by
 * the esbuild build (scripts/build-drive.mjs).
 */
function join(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}
function resolve(...parts: string[]): string {
  let p = join(...parts);
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/+/g, "/");
}
function basename(p: string, ext?: string): string {
  let n = p.replace(/\/+$/, "").split("/").pop() || "";
  if (ext && n.endsWith(ext)) n = n.slice(0, -ext.length);
  return n;
}
function dirname(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  parts.pop();
  const d = parts.join("/");
  return d || "/";
}
function extname(p: string): string {
  const n = basename(p);
  const i = n.lastIndexOf(".");
  return i > 0 ? n.slice(i) : "";
}

export default { join, resolve, basename, dirname, extname, sep: "/" };
export { join, resolve, basename, dirname, extname };
export const sep = "/";
