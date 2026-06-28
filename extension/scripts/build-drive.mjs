/**
 * Build the browser bundle of the PromptSync Drive read pipeline for the extension.
 *
 *   node scripts/build-drive.mjs            # one-shot
 *   node scripts/build-drive.mjs --watch    # rebuild on change
 *
 * Bundles src/drive-pipeline.ts (which re-exports the platform/server/services modules) into
 * vendor/promptsync-drive.mjs as a browser ESM. Two build-time swaps keep it Node-free:
 *   - alias `path`        -> src/path-shim.ts (pure string ops only)
 *   - resolve `file-store.js` -> platform/.../file-store-core.ts (drops Node `fs`/FsStore)
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(here, "..");
const coreStore = path.resolve(extDir, "../platform/server/services/file-store-core.ts");
const pathShim = path.resolve(extDir, "src/path-shim.ts");

/** Map any import of `.../file-store.js` to the fs-free core, so no bundle path pulls in `fs`. */
const swapFileStore = {
  name: "swap-file-store",
  setup(build) {
    build.onResolve({ filter: /file-store\.js$/ }, () => ({ path: coreStore }));
  },
};

const opts = {
  entryPoints: [path.resolve(extDir, "src/drive-pipeline.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome114",
  outfile: path.resolve(extDir, "vendor/promptsync-drive.mjs"),
  alias: { path: pathShim },
  plugins: [swapFileStore],
  logLevel: "info",
  legalComments: "none",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log("build-drive: watching…");
} else {
  await esbuild.build(opts);
  console.log("build-drive: wrote vendor/promptsync-drive.mjs");
}
