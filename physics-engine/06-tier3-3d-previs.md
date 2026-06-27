# 06 — Tier 3: 3D previs blocking (the root-cause fix)

## The root cause

Spatial continuity is hard because **there is no underlying space**. Each shot is an independent 2D hallucination, so "the creature is above him," "he's pinned," "the red glow is camera-left," "the 180° line" all have to be *re-asserted per shot* — and any one of them can be dropped (that's most of `00-`). The film industry solved this decades ago with **previsualization**: block the scene once in 3D, and every shot becomes a *camera angle on the same persistent scene*.

## What it buys

Block the Floor-1 chamber once:
- the **set** (chamber, stairs camera-right, counter, red glow camera-left),
- the **characters** as posable mannequins (Hale's build as a body shape; the creature as a rough mass),
- the **camera** as a real camera with position + lens.

Then for every shot you place the camera and pose the mannequins **once**, and these become *automatic and consistent*:
- posture / contact (pinned, grounded, standing) — it's the rig's actual pose;
- position and facing — the mannequin's actual transform;
- "creature above him" — the creature mass is actually above in 3D;
- screen-direction & the 180° line — a property of camera placement, not prose;
- held objects — parented to the hand;
- the build — the mannequin's body shape doesn't slim when it stands.

Spatial continuity stops being a lint you *check* and becomes a property you *derive*.

## How it feeds generation

You do **not** need pretty 3D renders. You need the **control passes**:
- **Depth pass** → ControlNet depth (composition, who's where, near/far).
- **OpenPose pass** → ControlNet OpenPose (exact posture, from the rig).
- **Normal / canny** (optional) → extra structure.

These render in seconds from rough blocking and drive the Tier-2 pipeline (`05-`). The AI image then inherits the 3D-correct pose and composition, while the prompt + IP-Adapter supply identity, skin, lighting, and style. This "3D blocking → control maps → AI render" pipeline is where a lot of serious AI-film work is converging.

## Tooling (all scriptable)

- **Blender + Python** — the pragmatic core. Script mannequin placement and posing *from the Tier-1 scene graph*, set the camera per shot, render the depth/OpenPose/normal passes in a batch. Free, headless-capable, fully automatable.
- **Cascadeur** — physics-aware posing if hand-posing the hard frames (a pinned, mid-strike body).
- **Unreal Engine (Sequencer)** — heavier previs if you want real-time and camera work; overkill for the MVP.
- **Mixamo / rigged mannequins** — stock posable bodies; scale to the character's build.

## From the graph to the blocking

The Tier-1 `PhysicalState` already encodes what the blocking needs:
```
PhysicalState{ contact, posture, position, facing, heldObjects }  ──►  Blender:
  contact/posture → rig pose (pose library or hand-key the hard ones)
  position/facing → mannequin transform in the set
  heldObjects     → prop parented to hand bone
  shot.framing    → camera transform + lens
EnvironmentElement.screenAnchors → fixed set dressing positions (red glow, stairs, counter)
```
So Tier 3 is "render the Tier-1 state into 3D, then render 3D into control maps." The graph stays the single source of truth; 3D is a *projection* of it, exactly like the text files are.

## Adoption is incremental

- **Start tiny:** block only the *recurring hard set* (the Floor-1 chamber) and only for *flagged shots*. A rough chamber + two mannequins covers most of the scene's continuity pain.
- **Reuse across the series:** the whole point of `crawler` is a shared cast + world across episodes. A 3D chamber + a posable Hale + a creature mass, built once, serves every episode. This is where Tier 3's cost amortizes hard — it's the strongest argument for building it for a *series* specifically.
- **Mannequins, not beauty:** the 3D never needs to look good; it only needs correct geometry for depth/pose. Quality comes from the AI render conditioned on those maps.

## When it's worth it

Tier 3 is the most setup. Build it when: (a) you're producing multiple episodes with a shared world (you are), and (b) specific shots keep failing pose/composition even with Tier-2 authored rigs. Until then, Tier-2 pose libraries (`05-`) cover most hard poses without a full 3D scene.
