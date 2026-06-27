# 08 — Domain context (for a fresh implementer)

A context picking this up without the originating conversation needs the domain grounding below.

## What story-saint is

An AI-animated short-film production toolkit. Three parts:
- **`skills/`** — Claude Code skills that drive the creative pipeline (story → script → storyboard → prompts).
- **`platform/`** — "PromptSync", a web dashboard for production tracking. Stack: React (Vite) + Express + SQLite + chokidar (file watching) + WebSocket. Dev: `cd platform && npm run dev`, port 3456. **This is where the physics-engine lives.**
- **`extension/`** — a Chrome extension (Manifest V3) that injects prompts into OpenArt (the generation front-end).

## The production pipeline (where the engine sits)

```
story-saint-storyteller  → develop the story, beat sheet, pre-production lock
story-saint-scriptwriter → locked Hollywood-format script
story-saint-storyboard   → TSV + per-shot dirs + character/env sheets + continuity manifest   ◄── engine targets THIS stage
story-saint-prompter     → Kling/Seedance video prompts, voice, music, post
```

The **physics-engine** formalizes the storyboard stage's outputs into a typed graph and compiles/lints them. The storyboard skill (`skills/story-saint-storyboard/SKILL.md` + `reference/algorithm.md`) is the human/LLM authoring front-end; its hand-run audits (Steps 6f/6g/6g-i/6g-ii/6g-iii/6h, three-detail audit, Step 9) are exactly the lints in `04-`.

## File layout the engine reads/writes

A single film (or one episode of a series) looks like:
```
{project}/
├── project.yaml                     # palettes, elements list, pipeline status
├── {project}_storyboard.tsv         # the board (one row/shot, 12 columns)
└── storyboard/
    ├── characters/{name}.md         # element sheet: build, wardrobe, identity, refs, "Visual Anchors"
    ├── environments/{name}.md       # env plate: canonical block, screen anchors, palette
    ├── continuity/scene-{N}-objects.md   # the manifest the engine REPLACES with a computed timeline
    └── shots/{code}/
        ├── shot.md                  # frontmatter + ## Subject & Action / ## VO / ## SFX / ## Notes
        ├── nb-prompt.md             # [Subject]/[Action]/[World Plate]/[Optical Realism]/[Camera Capture]/[Skin & Surface]/Negative
        └── image.jpg                # the generated still (when done)
```
A **series** adds `series.yaml` + a global `storyboard/` library (shared cast/world) + `episodes/{epNN-slug}/`; an episode's effective elements = global ∪ local (local wins on name collision). The reference episode for Phase 0 is `crawler/episodes/ep01-the-one-they-could-spare/`.

### Conventions
- **Shot codes:** `1A, 1B, 2A, 3C, 5G` (scene-number + letter).
- **`@ElementName`** in prompts is shorthand bound to a character/environment/prop sheet (always a space after the `@`).
- **`asset_type`:** `still | kling | seedance | kling-reuse`.
- **`status` flow:** `draft → nb-ready → nb-done → kling-ready → kling-done → seedance-ready → seedance-done → complete`.
- Prompt blocks use a **labeled-block** format (not TASK declarations).
- Everything is **YAML frontmatter + markdown body**.

## The generation tools (what the prompts target)

| Tool | Role | Key property for the engine |
|---|---|---|
| **NanoBanana** (Gemini 2.5/3 Flash Image) | the stills (`platform: nanobanana`) | autoregressive/conversational; **no real negative-prompt param**; control = positive phrasing |
| **Kling** | image→video; hero emotion, single-burst physics | i2v with **start/end frame** + **Bind Subject/Elements**; negatives supported |
| **Seedance** (ByteDance) | multi-shot montage, character lock across many shots | reference pack (cap ~3); start/end frame; negatives supported |
| **OpenArt** | the front-end the Chrome extension injects into | how prompts actually get run today |
| **ControlNet / ComfyUI / Diffusers** | (Tier 2) deterministic conditioning | OpenPose/depth/IP-Adapter; **not** available inside the three tools above |
| **Blender / Cascadeur / Unreal** | (Tier 3) 3D previs blocking | emit depth/pose/normal control passes |

## The crawler reference project (Phase 0 target)

`crawler` is a vertical (9:16) AI-animated **series**. Episode 1, "The One They Could Spare," is a ~3-min pilot, 32 shots, across 5 scenes/beats (stall → flee → fight → learn → stand-and-climb). It is fully storyboarded (TSV + per-shot files + character sheets + env plates + continuity manifest), with 19 of 32 stills generated. It is the canonical import/round-trip test because its continuity defects (documented in `00-`) are exactly what the engine must catch.

> One series-confidential note for whoever implements: the crawler has a hidden late-series twist. It is **not** needed to build the engine and must **not** be surfaced into any user-facing/production artifact. The engine deals only with per-shot physical state; it never needs the plot secret.

## Glossary

- **Manifest** — `continuity/scene-{N}-objects.md`; the per-character opening/closing state timeline. The engine *computes* this instead of trusting a hand-written table.
- **Element / element sheet** — a character/creature/environment/prop and its canonical attributes.
- **nb-prompt** — the NanoBanana still prompt for a shot.
- **Conformance** — the property that the prompt actually carries the manifest's state (the thing that kept failing).
- **Beautification / build drift** — the model slimming/flattering a body, worst in vertical/active shots.
- **Action-target presence** — a transitive action must have its target in frame (or it renders against empty space).
- **Contact-state** — `standing/grounded/pinned/...`; first-class because it's the axis that produced the worst bug.
