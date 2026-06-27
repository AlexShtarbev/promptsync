# 01 — Architecture

## Design philosophy

**Demote the LLM from source-of-truth to author.** The LLM is excellent at creative content (beats, prose, emotional staging, the *meaning* of a shot) and at translating human intent into structure. It is unreliable as the keeper of state and the enforcer of invariants — that is what leaks. So:

- The LLM **authors** a typed **scene graph** (and the creative prose that hangs off it).
- A deterministic **engine** owns everything mechanical: propagating state, compiling prompts from state, and linting invariants.
- The three text files (TSV / `shot.md` / `nb-prompt.md`) stop being independently-edited artifacts and become **projections** (compiled views) of the one graph.

This single move — "the prompt is *generated from* the state, not *hand-copied from* the manifest" — is what makes Family-A failures (`00-`) structurally impossible rather than merely audited.

## The three tiers

The tiers are **composable and independently valuable**. You can ship Tier 1 alone and get most of the benefit. Each higher tier addresses failures the lower one can't, at increasing setup cost.

```
                 ┌─────────────────────────────────────────────┐
   Authoring     │  LLM authors the scene graph + creative prose │
                 └───────────────────────┬─────────────────────┘
                                         │  (typed graph)
   ┌─────────────────────────────────────▼─────────────────────┐
   │ TIER 1 — STATE ENGINE (deterministic, in platform/ stack)  │
   │  • propagate per-character physical state across shots     │
   │  • compile nb-prompt / shot.md / TSV from state            │
   │  • lint invariants (continuity, target-presence, text, …)  │
   │  KILLS: A1–A8, B3, B4, much of B1/B2 (via positive emit)   │
   └─────────────────────────────────────┬─────────────────────┘
                                         │  (compiled prompt + state)
                           easy shots ◄──┤──► hard / repeatedly-failing shots
                                         │
   ┌─────────────────────────────────────▼─────────────────────┐
   │ TIER 2 — CONTROLLED GENERATION (diffusion pipeline)        │
   │  • ControlNet/OpenPose  → forces exact posture            │
   │  • IP-Adapter / refs    → locks identity + build          │
   │  • depth/region maps    → forces composition (target up)  │
   │  • emitted as a ComfyUI graph per shot                     │
   │  KILLS: B1, B2, B5 (the text→pixels gap) for routed shots  │
   └─────────────────────────────────────┬─────────────────────┘
                                         │  (needs pose/depth conditioning)
   ┌─────────────────────────────────────▼─────────────────────┐
   │ TIER 3 — 3D PREVIS BLOCKING (Blender/Python)              │
   │  • block the scene ONCE in 3D (mannequins + set + camera) │
   │  • render depth / OpenPose / normal passes per shot       │
   │  • feed passes to Tier 2 as conditioning                  │
   │  ROOT-CAUSE FIX: spatial continuity is derived, not       │
   │  re-described — pinned/above/screen-left fall out free    │
   └────────────────────────────────────────────────────────────┘
```

### Tier 1 — State engine
**What it is:** a typed scene graph + a state-propagation pass + a prompt compiler + a lint suite. Pure data/TypeScript; no GPU; lives in `platform/`.
**What it kills:** all bookkeeping failures (A1–A8), the weak-negative and concealment-as-negative problems (B3, B4, by compiling *positive* clauses), and a large share of posture/build default (B1, B2) because the compiler is forced to emit posture + build clauses every shot.
**Cost:** low. This is the MVP. See `02-`.

### Tier 2 — Controlled generation
**What it is:** for shots Tier-1 text can't hold, generate the still in a Stable-Diffusion/Flux pipeline with explicit conditioning — ControlNet/OpenPose (pose), IP-Adapter (identity/build), depth or regional maps (composition) — emitted as a parameterized ComfyUI graph, then hand the locked still to Kling/Seedance as a start frame.
**What it kills:** the residual B1/B2 and the text→pixels gap (B5) for routed shots — *guaranteed* pose, not prayed-for.
**Cost:** medium. Needs a diffusion runtime + GPU. **Hybrid: route only flagged shots.** See `05-`.

### Tier 3 — 3D previs blocking
**What it is:** block the scene once in 3D (posable mannequins, the set, the camera) and render control passes (depth/pose/normal) per shot to drive Tier 2. Scriptable in Blender via Python from the Tier-1 graph.
**What it kills:** spatial continuity at the root — "pinned, creature pressing from above, swing up, red glow camera-left" stop being four hand-written clauses and become a camera angle on one consistent blocking.
**Cost:** highest, but amortizes across a series with a shared cast/world. See `06-`.

## Where it lives / integrates

- **Stack:** the existing `platform/` is React (Vite) + Express + SQLite + chokidar + WebSocket. Tier 1 is a TypeScript module there. The scene graph persists in SQLite; the compiler writes the `.md`/`.tsv` files (which chokidar already watches).
- **Existing tool to extend:** `platform/ npm run structure` already scaffolds and *validates/auto-fixes file layout*. The state engine is the semantic layer above it: from "are the files in the right place with the right frontmatter?" to "is the scene's state continuous and do the prompts carry it?" Same command surface, deeper checks.
- **The skill stays.** `skills/story-saint-storyboard` continues to drive the creative process; over time its hand-run audits (Steps 6f/6g/6g-i/6g-ii/6g-iii, the three-detail audit) are *replaced by* engine lints. The skill becomes the authoring front-end to the graph.

## Non-goals

- Not an attempt to make generation deterministic end-to-end (image models are stochastic; the engine constrains, it doesn't render).
- Not a replacement for human/LLM creative judgment.
- Not a requirement to abandon nanobanana/OpenArt — that fast path stays for shots that don't need conditioning.
