# 05 — Tier 2: controlled generation

Tier 1 guarantees the *prompt* carries the state. It cannot guarantee the *model obeyed* (failure B5, the text→pixels gap). For shots that text can't hold — hard non-default poses (pinned-and-striking-up), the build-drift-prone hero shots — Tier 2 replaces "describe and hope" with explicit, coded conditioning.

## The core fact this tier exists for

On a NanoBanana/Gemini-class still, your only lever is text, and:
- it has **no true negative-prompt parameter** (autoregressive/conversational; Google says "describe positively"),
- a character reference locks **identity, not pose and not reliably build**,
- under-specified pose collapses to the training prior (standing), and bodies drift toward flattering.

A diffusion pipeline (Stable Diffusion / SDXL / Flux via ComfyUI or Diffusers) exposes conditioning that *forces* these:

| Lever | Mechanism | Forces | Maps to failure |
|---|---|---|---|
| **ControlNet — OpenPose** | a skeleton (joint coords) constrains the pose before pixels | exact posture, incl. lying/pinned | B1 |
| **ControlNet — depth / lineart / scribble** | a layout map constrains composition | "creature mass top, Hale bottom", target in frame | A5, vertical staging |
| **Regional prompting / latent couples** | per-region prompts | place subject vs target deterministically | A5 |
| **IP-Adapter / reference embeddings** | image-conditioned identity+appearance | identity AND build (stronger than text) | B2 |
| **ControlNet weight / guidance** | strength of each constraint | tune control vs. freedom | tradeoff knob |

ControlNet/OpenPose is the **only guaranteed pose lock** found in research — and it is **not available inside NanoBanana/Kling/Seedance**. So the pattern is: generate the controlled *still* in the diffusion pipeline, then hand that locked still to Kling/Seedance as the **start frame** for video.

## Emit a ComfyUI graph per shot

ComfyUI workflows are node graphs drivable via its HTTP/websocket API. The Tier-1 engine emits one per routed shot:

```
  Tier-1 resolved shot
        │
        ├─ prompt text            → CLIP text encode (positive; minimal/no negative)
        ├─ pose skeleton          → ControlNet(OpenPose)         [authored rig OR Tier-3 render]
        ├─ depth/layout map       → ControlNet(depth)            [Tier-3 render, optional]
        ├─ character refImages     → IP-Adapter                   [from Element.referenceImages]
        └─ model/sampler params   → KSampler → VAE → save
```

The skeleton can come from three sources, in increasing fidelity:
1. **Authored 2D rig** — a small pose editor (or a library of canonical poses: "supine, one arm braced, other thrusting up") keyed by `PhysicalState.contact` + action.
2. **Pose library lookup** — map `(contact, action.verb)` → a stock OpenPose skeleton, scaled to the build.
3. **Rendered from 3D blocking** — Tier 3 (`06-`), the most accurate.

## Hybrid routing (do NOT convert everything)

The fast nanobanana/OpenArt path stays for the ~80% of shots that work. Route a shot to Tier 2 only when flagged:

```ts
function routeShot(shot, resolved, history): 'nanobanana' | 'controlnet' {
  if history.regenFailures(shot) >= 1) return 'controlnet'        // it already failed once
  if isDefaultPoseProne(shot.action) && resolved.contact != 'standing') return 'controlnet'  // hard non-default pose
  if shot.isHeroBuildShot && characterUnflattering) return 'controlnet' // beautification-critical
  return 'nanobanana'
}
```

Quality tradeoff to hold in mind: nanobanana's photoreal + zero-setup is genuinely good; SDXL/Flux + ControlNet is more controllable but needs a GPU and tuning. Hybrid captures both.

## Video stage (Kling / Seedance) — what changes here

Negatives ARE supported at this stage (unlike nanobanana) — use them, but as *secondary*:
- **Start frame** = the Tier-2 locked still (carries pose, build, target).
- **Bind Subject / Elements** (Kling) or reference pin (Seedance) for identity continuity.
- **Positive-anchor held objects** in the motion prompt ("the stone shard stays gripped in his hand throughout") — object loss is common in i2v.
- Prefer **start+end frame** (or an explicit end-state in the prompt) over start-frame-only: last-frame-only constrains the clip's opening, not its trajectory (a character can stand up mid-clip).
- Seedance gotchas from research: cap reference packs (~3 stills, not 10); avoid perfect loop seams (they can cause a face "reset").

## Reference / evidence

Drawn from the research pass that informed this design:
- Google "How to prompt Gemini 2.5 Flash Image" + DeepMind NanoBanana prompt guide (positive-only; no negative parameter).
- arXiv 2602.12133 (measured default bias on Gemini Flash 2.5 Image).
- ControlNet OpenPose (ThinkDiffusion / Next Diffusion; `dw_openpose_full` handles lying poses).
- Midjourney `--cref` docs (reference = identity, not pose).
- Kling Elements / start-end frame; BytePlus Seedance prompt docs; WaveSpeed Seedance consistency rules.

(The story-saint memory note `reference_nanobanana-negative-prompts-weak` captures the short version.)
