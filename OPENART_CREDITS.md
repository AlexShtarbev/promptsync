# OpenArt credits — calculation + remaining (Writer-2 companion / feature #4)

Goal: know what an OpenArt generation will cost and what's left, and keep a running ledger
— without leaving Claude Code. Credit numbers come from the OpenArt **MCP** (Claude-side);
a standalone hook/script can't read them, so this is a Claude operating convention, and the
ledger it writes rides **Writer 1** to Drive automatically.

## Sources (MCP, Claude-side)
- **Remaining balance:** `openart_account_get` → `{ plan, credits }`.
  - Snapshot 2026-06-28: `plan: "Infinite", credits: 16012`.
- **Per-job estimate:** `openart_model_cost(model, mode, params)` → `totalCredits` for that exact
  config (resolution/duration/audio/count all change it).
  - Reference (1×, 5s, defaults): kling-3-omni i2v **175**, seedance-2 i2v **400**,
    seedance-2-fast i2v **350**, seedance-2-mini i2v **200**, wan2-7 i2v **125**,
    pixverse i2v **50**, grok-imagine i2v **405**. (Always re-quote with the real params.)

## Behavior — around every OpenArt video generation
1. **Before** `openart_generate_video`: call `openart_model_cost(model, mode, params)` and
   `openart_account_get`. Report: `est X • balance Y • ≈ Y−X after`. Warn if `X > Y`.
2. **After** completion (the same turn the Writer-2 hook archives the video): call
   `openart_account_get` again → `actualSpend = balanceBefore − balanceAfter`.
3. **Log** a row (below). Because Writer 2 already wrote the video to
   `promptsync/<project>/openart-outputs/<historyId>.<ext>`, record that path so the ledger
   and the asset stay linked.

## Ledger — `promptsync/<project>/openart-ledger.tsv`
Maintained as a LOCAL file under the project (read → append row → `Write`); Writer 1 mirrors
it to Drive on save. Tab-separated, header once:

```
timestamp	historyId	model	mode	config	estCredits	balanceBefore	balanceAfter	outputDrivePath
```

Example row:
```
2026-06-28T13:52:29Z	bPAum4JAMDfAra6tjHi3	kling-v3	image2video	1284x716,3s	175	16187	16012	ep01-drift/openart-outputs/bPAum4JAMDfAra6tjHi3.mp4
```

## Notes
- The Writer-2 hook can't populate credit numbers (no MCP in a shell hook) — it only archives
  the video. The credit columns are filled by Claude from the MCP, here in the ledger.
- Optional later: an extension-panel credits badge that reads this ledger (or scrapes
  openart.ai) — out of scope for #4.
