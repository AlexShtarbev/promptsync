# Drive-only bridge — spec

Status: draft for implementation. Scope: two issues, one shared contract.

1. **Write side** — when running the story-saint skill in **Claude Code**, store all
   text output (scripts, shots, VO, config, storyboard `.md`/`.yaml`/`.tsv`/`.json`)
   **directly to Google Drive**, with **no local disk and no scripts** — via a small
   local **MCP server** Claude calls as tools.
2. **Read side** — the **PromptSync extension** keeps driving Google Flow, but reads
   prompts/index **from Google Drive directly** instead of `localhost:3456`.

Both halves talk only to Google Drive. They never talk to each other. Drive is the
single shared store; agreement is by **contract**, not by a running server.

---

## 0. Goals / non-goals

**Goals**
- Claude Code authors a project's text files straight into Drive (CRUD), no disk.
- Extension reads that project from Drive and injects into Flow (free NB2), no local
  server at generation time.
- Maximum reuse of the already-built, browser-safe Drive/FileStore layer.

**Non-goals (this spec)**
- Image/video return path (Flow NB2 stills stay in Flow; not pushed to Drive yet).
- The React platform dashboard and chokidar live-watch (disk-based; see §5.4 for the
  Drive-only consequence and the validator carve-out).
- OpenArt video step (unchanged: Claude drives the OpenArt MCP downstream).

---

## 1. Architecture (Drive-only)

```
  Claude Code ──(local MCP, stdio, tool calls)──► Google Drive ◄──(REST + device-auth)── Extension ──► Flow (free NB2)
   author text                                     drive.file              read index/prompts        inject prompt
   (no disk)                                      app-created files         (no localhost)
```

- **Write side** = a new local MCP server (Node) wrapping the existing
  `platform/server/services/drive-sync.ts` (googleapis client) + a content-string
  upsert. Registered in the project `.mcp.json`.
- **Read side** = the existing browser-safe modules (`drive-rest`, `drive-store`,
  `file-store` MemFileStore, the ProjectIndex parser, `extension-index`) bundled into
  the extension, fed by a device-flow token.

---

## 2. THE SHARED CONTRACT (both sides MUST agree)

These are the only things that make write and read meet. Any divergence breaks the loop.

### 2.1 OAuth — one Desktop client, one account, `drive.file`
- **Single OAuth 2.0 "Desktop app" client_id** used by **both** the MCP and the
  extension. A Desktop/Installed client supports **both** the installed-app flow (MCP,
  token cached to a local file) **and** the OAuth **device flow** (extension). Source
  of truth: `google_creds/creds.json` (`installed`/`web`).
- **Scope: `https://www.googleapis.com/auth/drive.file`** on both sides (matches
  `drive-sync.ts` `SCOPES`). Consequence: a client only sees files **it created**.
  Therefore the MCP must create the root folder, all project folders, and all files;
  the extension (same client_id) then sees exactly those. **If the client_ids differ,
  the extension sees nothing.** This is the #1 integration risk — verify first.
- **Same Google account** that is logged into `labs.google` (Flow). Otherwise the
  extension reads a Drive the user isn't generating in.

### 2.2 Drive layout — root + project folder + file tree
- **Root folder**: app-created folder named `PromptSync` under My Drive root.
  Configurable via env `PROMPTSYNC_DRIVE_ROOT` (default `PromptSync`). Resolve by:
  `name='PromptSync' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  (works under `drive.file` because the app created it). Cache its id.
- **Project folder**: `{root}/{project-slug}/`.
- **File tree under the project folder = the existing PromptSync layout verbatim**
  (single-project or series — see `skills/story-saint-storyboard` PROJECT LAYOUT):
  `project.yaml`, `{project}_storyboard.tsv`, `storyboard/shots/{code}/nb-prompt.md`,
  `storyboard/characters/{name}.md`, `series.yaml`/`episodes/...`, etc.
- **Paths** are project-relative POSIX, no leading slash (e.g.
  `storyboard/shots/1A/nb-prompt.md`). The snapshot mounts the project subtree at
  `/drive` (see `buildSnapshot(..., mountPath="/drive")`); the ProjectIndex parser must
  be pointed at that mount root.

### 2.3 Authored file types
- Only **`TEXT_EXTS`** (`.md .yaml .yml .json .tsv .txt`, from `drive-store.ts`) are
  authored as text. Shared constant — do not fork it. Binary assets are out of scope.

---

## 3. Reuse map (do NOT reinvent)

| Need | Existing module | Notes |
|---|---|---|
| Drive REST read client | `services/drive-rest.ts` `driveRestApi(getToken)` | browser-safe; fetch + bearer; paginates |
| Drive subtree → snapshot | `services/drive-store.ts` `buildSnapshot(api, folderId, mount)` | browser-safe; returns `MemFileStore` |
| Sync FS seam | `services/file-store.ts` `MemFileStore`, `setFileStore`, `fileStore` | **`FsStore` is Node-only — must be excluded from the browser bundle (see §6.1)** |
| Drive write client + OAuth (installed) | `services/drive-sync.ts` `initDrive`/`getDrive`/`ensureFolder`/`uploadFile`/`getAuthUrl`/`exchangeCodeForTokens` | Node; MCP uses this. `uploadFile` already upserts. |
| Device-flow auth | `services/device-auth.ts` `requestDeviceCode`/`pollForToken`/`refreshAccessToken` | browser-safe; extension uses this |
| Index shape builder | `services/extension-index.ts` `buildExtensionIndex(index, slug)` | **pure** — needs a parsed `ProjectIndex` |
| ProjectIndex parser | `services/markdown-parser.ts` (+ whatever assembles `ProjectIndex`) | **must read via `fileStore()` seam** — implementer to confirm/port |

---

## 4. Issue 1 — Write side: the MCP server

### 4.1 Runtime & registration
- Node, `@modelcontextprotocol/sdk`, **stdio** transport.
- Location: `platform/mcp/drive-mcp.ts` (build to `platform/mcp/dist/`), or a sibling
  package — implementer's call; keep it importing `platform/server/services/*`.
- Registered in project `.mcp.json`:

```json
{
  "mcpServers": {
    "promptsync-drive": {
      "command": "node",
      "args": ["platform/mcp/dist/drive-mcp.js"],
      "env": {
        "PROMPTSYNC_DRIVE_CRED": "google_creds/creds.json",
        "PROMPTSYNC_DRIVE_ROOT": "PromptSync"
      }
    }
  }
}
```

- One-time auth: a `drive_auth_status` / `drive_auth_begin` tool pair (wrapping
  `getAuthUrl` + `exchangeCodeForTokens`) so the user authorizes once; token persists at
  `tokenPathFor(cred)`. (Or reuse the existing `drive-auth.ts` script once, out-of-band.)

### 4.2 Folder/path resolution + cache
- Resolve `{root}/{project}/{dir…}` by chaining `ensureFolder(drive, name, parentId)`.
- Maintain an in-process `Map<string, folderId>` cache (path → id) to avoid a
  `files.list` per call. Invalidate on `drive_delete` of a folder.

### 4.3 Content-string upsert (the one new bit)
`uploadFile` reads from a path via `fs.createReadStream`. Add a sibling that takes a
**string body**:

```
upsertText(drive, folderId, name, content, mimeType):
  list q: name='<name>' and '<folderId>' in parents and trashed=false
  if found -> files.update(fileId, media:{mimeType, body: content})
  else      -> files.create(requestBody:{name, parents:[folderId]}, media:{mimeType, body: content})
  return { fileId, created|updated }
```
`mimeType` from a small ext→mime map (reuse `mimeFor` in drive-sync if exported).

### 4.4 Tools (the filesystem-over-Drive surface Claude uses)

All take `project` (slug) + project-relative POSIX `path`. Path guardrails: reject
absolute paths, `..`, and (for writes) non-`TEXT_EXTS` extensions.

| Tool | Params | Returns | Semantics |
|---|---|---|---|
| `drive_put_file` | `project, path, content` | `{fileId, path, action:"created"\|"updated"}` | ensure folders + `upsertText`. Idempotent. |
| `drive_read_file` | `project, path` | `{content}` | `downloadText`; error if absent |
| `drive_list` | `project, prefix?` | `[{path, type:"file"\|"dir", fileId, modifiedTime}]` | recursive list under prefix |
| `drive_delete` | `project, path` | `{ok}` | trash file/folder; invalidate cache |
| `drive_ensure_project` | `project` | `{folderId}` | create `{root}/{project}` if missing |
| `drive_validate` *(optional, see §5.4)* | `project` | validator report | snapshot project → run existing FileStore validator |

Errors: throw MCP tool errors with a clear message (missing project, auth expired →
hint to run `drive_auth_begin`, Drive 4xx/5xx surfaced).

### 4.5 Skill integration (Drive-only authoring)
- When authoring under Drive-only mode, the skill's "write file X" steps map to
  **`drive_put_file`** instead of the `Write` tool. Re-reads map to `drive_read_file`;
  listing/auditing maps to `drive_list`.
- The story-saint skill docs should gain a short "Output target: Drive MCP" note so the
  Write→`drive_put_file` mapping is explicit. (Doc change, coordinate with skill owner.)

---

## 5. Issue 2 — Read side: extension reads Drive

### 5.1 Auth (device flow)
- New `background/drive-auth.js` porting `device-auth.ts`:
  - First run: `requestDeviceCode(clientId, "https://www.googleapis.com/auth/drive.file")`
    → show `user_code` + `verification_url` in the side panel; `pollForToken(...)`.
  - Persist `TokenSet` in `chrome.storage.local`.
  - `getToken()` (the `TokenProvider` for `driveRestApi`) returns a cached access token,
    calling `refreshAccessToken(...)` when expired.
- `clientId`/`clientSecret`: the **same Desktop client** as the MCP (installed-app
  client_secret is non-confidential; `device-auth.ts` already treats it so).

### 5.2 Read pipeline (assembly of existing modules)
```
getToken ──► driveRestApi(getToken)                         // drive-rest
         ──► resolve {root}/{project} folderId              // §2.2 search, cached
         ──► buildSnapshot(api, projectFolderId, "/drive")  // drive-store -> MemFileStore
         ──► setFileStore(snapshot.store)                    // file-store seam
         ──► parse ProjectIndex over fileStore()             // markdown-parser + loader
         ──► buildExtensionIndex(index, project)             // extension-index (pure)
         ──► ExtensionIndex JSON                             // == current /extension/index
```
The output object is byte-shape-compatible with what `service-worker.js loadIndex` and
`shared.js fetchIndex/fetchShot` consume today.

### 5.3 Data-source swap
- `background/service-worker.js`: replace `loadIndex(project)` (currently
  `GET ${API}/extension/index`) with the Drive pipeline above.
- `content/shared.js`: replace `fetchIndex`/`fetchShot` (`PROMPTSYNC_API`) with reads
  off the cached snapshot/index. `getPromptForSite(shot, site)` stays unchanged.
- `content/googleflow.js` injection is **unchanged**.
- Remove the WS live-sync (`localhost:3456/ws`) from the gen-time path; replace with a
  manual **Refresh** action and/or a TTL re-snapshot on panel open (no chokidar in
  Drive-only).

### 5.4 Drive-only consequences for platform tooling
- The React dashboard + chokidar are disk-based and are **not** part of the Drive-only
  gen-time path. They keep working against any local copy you still have, but are not
  required for the loop.
- **Structure/continuity validation** (the STRUCTURE AUDIT gate) is FileStore-based, so
  it does **not** need disk: the MCP can `buildSnapshot` the project from Drive,
  `setFileStore`, and run the existing `continuity-validator` / structure logic — exposed
  as the optional `drive_validate` tool (§4.4). This preserves the gate in a Drive-only
  world.

### 5.5 Manifest changes
- `host_permissions`: add `https://www.googleapis.com/*` and
  `https://oauth2.googleapis.com/*` (device-code + token + Drive REST).
- No `identity` permission needed (device flow uses `fetch`, not `chrome.identity`).
- Keep existing `labs.google` content-script entries.

### 5.6 Caching / invalidation
- Snapshot per project, cached in memory (and optionally `chrome.storage` for warm
  start) with a TTL + explicit Refresh. Re-snapshot on project switch or Refresh.

---

## 6. Cross-cutting build notes

### 6.1 Browser bundle (the one refactor)
- The reusable modules are TS in `platform/server/services` and are browser-safe **except
  `FsStore`**, which top-level-imports `fs`. Split `file-store.ts` into:
  - `file-store-core.ts` — `FileStore` interface + `MemFileStore` + `setFileStore`/`fileStore` (no `fs`).
  - `file-store-node.ts` — `FsStore` only (imports `fs`).
  Server imports both; the **extension bundle imports only core**.
- Add an `esbuild`/`rollup` step compiling
  `{drive-rest, drive-store, file-store-core, markdown-parser, projectIndex-loader, extension-index, device-auth}`
  into an extension module loaded by the service worker / panel. Confirm the ProjectIndex
  loader reads **only** through `fileStore()` (no stray `fs`/`path` Node calls); port if needed.

### 6.2 Same-constant guarantees
- `TEXT_EXTS`, the layout paths, and the `{root}` name must be the literal same on both
  sides. Prefer importing the shared module on the write side; on the extension side they
  come in via the bundle — do not hand-duplicate.

---

## 7. Build sequencing
1. **Verify the lynchpin** (§2.1): one Desktop client_id, `drive.file`, same account —
   create a file via the MCP path and confirm a second session of the *same client* can
   list it. If not, nothing else matters.
2. **MCP server** (§4): `drive_ensure_project`, `drive_put_file`, `drive_read_file`,
   `drive_list`, `drive_delete` + auth tools; register in `.mcp.json`.
3. **file-store split + esbuild bundle** (§6.1).
4. **Extension auth** (§5.1) — device flow, token in `chrome.storage`.
5. **Extension read pipeline + data-source swap** (§5.2–5.3); Flow injection unchanged.
6. *(Optional)* `drive_validate` (§5.4); skill doc note (§4.5).

## 8. Acceptance criteria
- Running the skill in Claude Code creates/updates the project's text tree under
  `{root}/{project}/…` in Drive with **zero** local disk writes and **zero** script runs
  (only MCP tool calls). Re-authoring a shot **updates** its file (no duplicate).
- With the local platform server **stopped**, the extension authorizes via device code
  once, loads the project index from Drive, lists shots in the panel, and injects the
  correct per-shot prompt into Flow.
- The extension's index object matches the current `/extension/index` shape (shots,
  characters, `aspect_ratio`, `default_resolution`, `elementMap`).

## 9. Open questions / risks
- **Client_id sharing under `drive.file`** (§2.1) — the make-or-break; verify in step 1.
- **Device-flow on a Desktop client** — confirm the chosen client type is enabled for the
  device grant in the Google Cloud console.
- **ProjectIndex loader purity** — confirm it touches only `fileStore()`; port any raw
  `fs`/`path` usage (§6.1).
- **Snapshot cost** — `buildSnapshot` downloads every text file; fine for one project,
  watch quota on large series. Cache + TTL (§5.6).
- **Skill authoring ergonomics** — many `drive_put_file` calls per phase vs a batch
  `drive_put_many`; add a batch tool if call volume is high.
