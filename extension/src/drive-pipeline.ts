/**
 * Browser bundle entry — re-exports the (browser-safe) PromptSync Drive read pipeline for the
 * Chrome extension. Bundled by scripts/build-drive.mjs into vendor/promptsync-drive.mjs, which
 * the service worker imports. The build aliases `path` → ./path-shim and swaps `file-store.js`
 * → `file-store-core.ts` (drops Node `fs`).
 *
 * Read flow in the extension:
 *   token = await getToken()                              // drive-auth (chrome.storage)
 *   api   = driveRestApi(getToken)                        // drive-rest
 *   { store } = await buildSnapshot(api, projectFolderId) // drive-store -> MemFileStore
 *   setFileStore(store)
 *   const index = loadProject("/drive/<slug>")            // markdown-parser -> ProjectIndex
 *   const ext   = buildExtensionIndex(index, "<slug>")    // extension-index -> ExtensionIndex
 */
export { requestDeviceCode, pollOnce, pollForToken, refreshAccessToken } from "../../platform/server/services/device-auth.js";
export { driveRestApi, driveMediaUrl } from "../../platform/server/services/drive-rest.js";
export { buildSnapshot } from "../../platform/server/services/drive-store.js";
export { setFileStore, fileStore, MemFileStore } from "../../platform/server/services/file-store.js";
export { loadProject, loadSingleShot, loadSingleCharacter, discoverProjects } from "../../platform/server/services/markdown-parser.js";
export { buildExtensionIndex } from "../../platform/server/services/extension-index.js";
