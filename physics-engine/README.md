# physics-engine — a deterministic continuity engine for AI-animated storyboards

**Status:** design specification. Nothing here is built yet. This directory is a hand-off package: a fresh context (human or agent) should be able to read it end-to-end and start implementing without needing the conversation that produced it.

---

## The one-paragraph pitch

Today the story-saint pipeline authors storyboards as free text and audits them by hand. That works for prose and emotion, but it leaks badly on the things that are actually *mechanical*: a character's posture and held objects across shots, the same shot staying consistent across its three files (TSV / `shot.md` / `nb-prompt.md`), the manifest's known state actually reaching the prompt, an action having its target in frame, on-screen text matching everywhere. Those are **data and conditioning problems**, not creative ones — and an LLM doing free-text authoring + free-text auditing will always miss some. The **physics-engine** makes the scene's continuity ("its physics") a typed, code-enforced model: the LLM authors the creative content into a scene graph, and a deterministic engine propagates state, compiles the prompts, and lints the invariants. Optionally it then drives *controlled* generation (pose/identity/composition conditioning) and, at the far end, a 3D previs blocking so spatial continuity falls out automatically instead of being re-described per shot.

## Why "physics"

The engine treats scene continuity like a physics simulation:
- **Bodies don't teleport** — a character's position/posture/facing carries forward from their last on-camera shot unless a transition is declared.
- **Objects persist** — a shard picked up in 3B is in-hand until explicitly set down; it can't vanish.
- **Contact-state is real** — `standing | grounded | pinned | seated | kneeling` is a tracked state with consequences, not an adjective. (The bug that motivated this: a man written "swinging a rock" rendered *standing* when he was supposed to be *pinned on the floor* — three separate continuity slips on one shot.)
- **Screen-space is consistent** — an element anchored camera-left stays camera-left; the 180° line holds.

## How to read this directory

Read in order; each builds on the last.

| File | What it covers |
|---|---|
| [`00-motivation-and-failure-taxonomy.md`](00-motivation-and-failure-taxonomy.md) | The real failures that motivate this, each with a concrete example. Start here — it's the "why." |
| [`01-architecture.md`](01-architecture.md) | The three composable tiers and the design philosophy (demote the LLM from source-of-truth to author). |
| [`02-tier1-state-engine.md`](02-tier1-state-engine.md) | **The core build.** Scene graph, state-propagation algorithm, prompt compiler, integration with the existing `platform/` structure tool. |
| [`03-schema.md`](03-schema.md) | The typed data model (TS interfaces) — the central artifact everything else operates on. |
| [`04-lint-rules.md`](04-lint-rules.md) | The full catalog of validation rules, each mapped to the audit/failure it replaces, with pseudocode. |
| [`05-tier2-controlled-generation.md`](05-tier2-controlled-generation.md) | Beyond text: ControlNet/OpenPose, IP-Adapter, depth/layout maps, ComfyUI graph emission, hybrid routing. |
| [`06-tier3-3d-previs.md`](06-tier3-3d-previs.md) | The root-cause fix: a 3D blocking (Blender/Python) that emits control passes; one scene → many consistent renders. |
| [`07-roadmap.md`](07-roadmap.md) | Phased plan. What to build first (the MVP), in what order, with milestones and a round-trip acceptance test. |
| [`08-domain-context.md`](08-domain-context.md) | Domain grounding for a fresh context: the story-saint pipeline, file layout, shot conventions, and the tool landscape (nanobanana/Gemini, Kling, Seedance, OpenArt, ControlNet, ComfyUI, Blender). |

## Scope discipline (read before building)

- **The engine is not a replacement for the LLM.** It owns *state and invariants*. The LLM still authors beats, prose, staging, and the emotional content — into the graph. Don't try to make the engine "creative."
- **Build Tier 1 first and standalone.** It eliminates the largest class of bugs for the least cost, and it lives in the existing React/Express/SQLite `platform/` stack (it's a natural evolution of `npm run structure`). Tiers 2 and 3 are opt-in escalations for shots that text can't hold.
- **Hybrid by default.** Keep the fast nanobanana path for the ~80% of shots that work; route only the hard/failing shots through controlled generation. Every tier trades convenience for control — add control only where it pays.

## Provenance

This spec was distilled from a debugging session on the `crawler` series, episode 1 ("The One They Could Spare"), where a string of continuity defects in one shot (`3C`) exposed that the storyboard skill *knew* the right state in its manifest but had no mechanical way to enforce it into the prompts or the pixels. The failure taxonomy in `00-` is drawn from real, observed defects, not hypotheticals.
