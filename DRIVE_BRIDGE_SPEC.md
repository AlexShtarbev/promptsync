# PromptSync ⇄ Google Drive — bridge spec (final)

PromptSync becomes a **browser extension on top of Google Drive**. Drive is the single
hub. Everything writes into it automatically; the extension reads prompts back out and
drives Google Flow (free NB2). OpenArt video stays on the OpenArt MCP (Claude-side), with
its outputs archived to Drive and its credit spend tracked.

Supersedes `DRIVE_ONLY_BRIDGE_SPEC.md` (the pure "MCP-only, no-disk write" idea). The
write path is now **hook-based auto-mirror** (decided 2026-06-28).

---

## Decisions (locked)
- **Drive root folder:** `promptsync` (lowercase) — matches `drive-push-changed.ts`.
- **OAuth:** one **Desktop** client_id shared by every writer/reader; scope
  **`drive.file`**; **same Google account** as `labs.google` (Flow). Files are visible
  across sessions of the *same* client_id only — this is the lynchpin.
- **Writer 1 trigger:** Claude Code **`PostToolUse(Write|Edit)`** hook — instant, no commit.
- **OpenArt → Drive:** **outputs only** (the generated videos), not inputs.
- **Layout + types:** existing PromptSync project layout; only `TEXT_EXTS`
  (`.md .yaml .yml .json .tsv .txt`) are mirrored as text; media are binary assets.

---

## Architecture: Drive as hub — 3 writers, 1 reader

```
 Claude Code ─PostToolUse(Write|Edit)─► drive-push-changed.ts ─┐
 Claude Code ─PostToolUse(OpenArt done)─► download video ──────┤
                                                               ├──► Google Drive (promptsync/<project>/…)
 Extension   ─device-auth + Drive REST upload (stills/status)──┘            ▲
 Extension   ◄─ driveRest → buildSnapshot → ProjectIndex → extensionIndex ──┘  reads prompts/index → injects to Flow
```

### Writer 1 — Claude's text output → Drive  (shots, scripts, VO, config)
- **Mechanism:** Claude Code `PostToolUse` hook matching `Write|Edit`. On each write the
  hook invokes the **existing** `platform/scripts/drive-push-changed.ts` with the written
  file path (it already accepts path args, filters via `isTextFile`, resolves project-
  relative paths, and upserts under root `promptsync`).
- **Settings scope:** user-level `~/.claude/settings.json` (creative projects live across
  multiple dirs, so the hook must fire regardless of cwd). [confirm vs project-level]
- **Hook command (shape):**
  ```
  PostToolUse matcher "Write|Edit":
    read tool_input.file_path from stdin JSON
    if path under a PromptSync project and isTextFile:
      cd ~/personal/promptsync/platform &&
      GOOGLE_CREDENTIALS_PATH=~/personal/promptsync/google_creds/outh.json \
      PROMPTSYNC_REPO=<project-root> PROMPTSYNC_DRIVE_ROOT=promptsync \
      npx tsx scripts/drive-push-changed.ts <file_path>
    (backgrounded; never blocks the tool)
  ```
- The git **post-commit** hook (`hooks/post-commit-drive-push.sh`) becomes a redundant
  fallback — keep or drop; do not let both double-push noisily.

### Writer 2 — OpenArt MCP outputs → Drive  (videos only)
- **Mechanism:** Claude Code `PostToolUse` hook matching the OpenArt completion tools
  (`mcp__claude_ai_OpenArt__openart_creation_wait` / `…_creation_get` / `…_generate_video`).
  The hook receives `tool_response`; extract the finished media URL(s), download, and
  upsert into Drive as a **binary asset** at `promptsync/<project>/…` (e.g. the shot's
  video path).
- **New code:** a binary asset push. Reuse `drive-sync.uploadFile` (already streams binary
  with a mime type; `drive-push-changed` is text-only). Resolve the target project/shot
  from the creation metadata or the active project.
- **Credits tie-in:** on the same event, append a row to the OpenArt ledger (below).

### Writer 3 — Extension → Drive  (auto-commit its own products)
- **Mechanism:** an extension-side Drive **write** client = device-auth token + Drive REST
  **multipart upload** (the write counterpart to the read-only `drive-rest.ts`).
- **What it writes:** captured Flow NB2 stills and status bumps go straight to the
  project's Drive folder instead of `localhost:3456`.
- Mirrors `uploadFile`'s upsert semantics (list by name+parent → update else create).

### Reader 1 — Extension reads prompts/index from Drive
- Assembly of existing browser-safe modules:
  `driveRestApi(getToken) → buildSnapshot(api, projectFolderId, "/drive") →
   setFileStore(store) → ProjectIndex parser (over the seam) → buildExtensionIndex(index, slug)`
  → the exact `{aspect_ratio, default_resolution, shots, characters, elementMap}` the
  extension already consumes.
- **Auth:** port `device-auth.ts` → `background/drive-auth.js`; first-run device code shown
  in the panel; token in `chrome.storage`; `refreshAccessToken` on expiry.
- **Swap:** `service-worker.js loadIndex` + `shared.js fetchIndex/fetchShot` read off the
  Drive snapshot instead of `PROMPTSYNC_API`. `googleflow.js` injection unchanged.
- **Manifest:** add `https://www.googleapis.com/*` + `https://oauth2.googleapis.com/*`.
- Replace WS live-sync with a manual Refresh / TTL re-snapshot (no chokidar).

---

## Feature: OpenArt credits (calculation + remaining)
- **Remaining:** `openart_account_get` → `credits` (e.g. plan "Infinite", 16012).
- **Estimate:** `openart_model_cost(model, mode, params)` for the exact config.
- **Around each generation (Claude-side behavior):**
  1. estimate = model_cost(config); balance = account_get.credits.
  2. Report `est X • balance Y • ≈ Y−X after`; warn if `X > Y`.
  3. After completion: re-read balance → actual spend = before − after.
- **Ledger (Drive):** append to `promptsync/<project>/openart-ledger.tsv`:
  `timestamp, model, mode, configSummary, estCredits, balanceBefore, balanceAfter, outputDrivePath`.
  Written on the Writer 2 event so output-archive and spend-log stay in lockstep.
- **Surface:** Claude report + Drive ledger now; optional extension-panel credits badge
  later (reads the ledger / scrapes openart.ai). [confirm scope]

---

## Reuse map
| Need | Module | Note |
|---|---|---|
| text upsert on write | `platform/scripts/drive-push-changed.ts` | exists; path-arg driven; Writer 1 |
| binary asset upsert | `services/drive-sync.ts uploadFile` | streams binary; Writer 2 base |
| Drive folder chain | `services/drive-sync.ts ensureFolder` | cached chain |
| extension read client | `services/drive-rest.ts driveRestApi` | browser-safe; Reader 1 |
| Drive→snapshot | `services/drive-store.ts buildSnapshot` | → MemFileStore |
| sync FS seam | `services/file-store.ts` MemFileStore/setFileStore | split out FsStore for browser bundle |
| index shape | `services/extension-index.ts buildExtensionIndex` | pure; needs ProjectIndex |
| device auth | `services/device-auth.ts` | port to extension + reuse for writers' token |
| credits | OpenArt MCP `openart_account_get`, `openart_model_cost` | feature |

## Build order
1. **Verify lynchpin:** one Desktop client_id + `drive.file` + same account — write via the
   Node path, confirm a *second* session of the same client can list it.
2. **Writer 1** — the `PostToolUse(Write|Edit)` hook → `drive-push-changed.ts` (smallest;
   reuses existing code; just settings.json + a thin wrapper).
3. **Writer 2** — OpenArt-completion hook + binary asset push + ledger row.
4. **Credits behavior** — estimate/balance reporting (skill/behavior).
5. **Reader 1** — extension Drive read (device-auth + drive-rest + snapshot + index swap);
   the `file-store` split + esbuild bundle of browser-safe modules.
6. **Writer 3** — extension Drive write client (stills/status).

## Open confirmations
- Writer 1/2 hooks in **user-level** `~/.claude/settings.json` (fires everywhere) vs project-level.
- Credits surface: Claude report + Drive ledger only, or also an extension-panel badge.

## Risks
- `drive.file` + client_id sharing (step 1).
- Device-grant enabled on the Desktop client.
- ProjectIndex loader purity (only `fileStore()`), for the browser bundle.
- Hook noise: ensure Writer 1 ignores non-project / non-text writes (it already filters).
