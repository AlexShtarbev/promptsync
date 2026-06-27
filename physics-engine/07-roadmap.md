# 07 — Implementation roadmap

Phased, lowest-risk-highest-value first. Each phase is independently shippable. Do not start a phase before the previous one's acceptance test passes.

## Phase 0 — Import & round-trip (prove the model)
**Goal:** show the schema can represent a real episode and the compiler can reproduce it.
- Implement `03-schema.md` types + SQLite persistence.
- Write an **importer**: parse the existing crawler ep01 `.md`/`.tsv` (`episodes/ep01-the-one-they-could-spare/`) into the scene graph.
- Write the **compilers** (nb-prompt, shot.md, TSV) — minimally, enough to re-emit.
- **Acceptance:** round-trip the whole episode: graph → compiled files, diff against the hand-authored originals. The remaining diffs should be *only* improvements you intend (e.g. positive build clauses), not losses. Document every intentional diff.

## Phase 1 — State propagation + the bookkeeping lints (the MVP)
**Goal:** kill Family A (`00-`).
- Implement state propagation (`02-` §1), incl. insert-skipping and declared transitions.
- Implement lints **L01, L02, L04, L05, L06, L09, L12** (the deterministic bookkeeping rules).
- Replace the hand-written continuity manifest with the *computed* timeline (render it as a view for humans).
- Integrate into `platform/ npm run structure -- validate` and the chokidar save hook.
- **Acceptance:** re-run against ep01 and confirm the engine flags the exact bugs we fixed by hand (the 3C standing/pin drift as L01, the dropped-creature as L04, the FLOOR-counter mismatch as L09, the TSV three-layer drift as L05). Then confirm it passes once the graph is corrected.

## Phase 2 — Positive-clause compiler + default/build crowd-out
**Goal:** kill B3, B4, and reduce B1/B2 at the text layer.
- Per-platform negative policy (`02-` §3): positive-first for nanobanana; negatives only for kling/seedance.
- Mandatory build clause for `unflattering` characters on visible-body shots.
- Concealment-positivity emit + lints **L03, L07, L10, L11**.
- **Acceptance:** every compiled nanobanana prompt carries posture + build positively; no concealment relies on a bare negative; spot-regenerate 2–3 historically-failing shots and compare.

## Phase 2.5 — Vision verifier (optional, cheap, high signal)
**Goal:** close the text→pixels gap (B5) with a check, before building generation control.
- Implement **L-vision**: after a frame is generated, a vision model verifies contact + build + target presence against the resolved state; warn + suggest escalation.
- **Acceptance:** the verifier flags the original 3C standing+slim render as a failure.

## Phase 3 — Controlled generation (Tier 2)
**Goal:** *force* pose/build/composition for routed shots (B1, B2, B5).
- Stand up a ComfyUI (or Diffusers) runtime; implement the per-shot **graph emitter** (`05-`).
- Pose source: start with a **pose library** keyed by `(contact, action.verb)`; add a small authored-rig editor if needed.
- IP-Adapter from `Element.referenceImages`; ControlNet OpenPose (+ depth if available).
- Implement **hybrid routing** — only flagged shots escalate.
- Wire the locked still into the Kling/Seedance start-frame handoff.
- **Acceptance:** the pinned-strike 3C and a hero-rise build shot come out correct *reliably* (≥4/5 generations), where text-only failed.

## Phase 4 — 3D previs (Tier 3)
**Goal:** derive spatial continuity instead of re-asserting it.
- Blender + Python: build the recurring set (Floor-1 chamber) + a posable Hale mannequin (correct build) + a creature mass.
- Drive mannequin pose/transform + camera from the Tier-1 graph; batch-render depth/OpenPose/normal passes per flagged shot; feed Tier 2.
- **Acceptance:** regenerate the 3A→3C→3D beat from one blocking; the pin, the creature-above, and screen-direction are all correct with no per-shot spatial prose.

## Sequencing guidance
- **Phases 0–1 are the whole point.** They are cheap, in your existing stack, and remove the class of bugs we spent a debugging session on. If you build nothing else, build these.
- **Phase 2** is small and high-value; do it next.
- **Phases 3–4 are GPU/3D investments.** Justify them by *observed* failure rate on hard shots, and by the series economics (build the cast/set once, reuse across episodes). Don't build them speculatively.

## Risks / watch-fors
- **Don't let the engine try to be creative.** If you find yourself encoding "good staging" as rules, stop — that's the LLM's job; the engine owns invariants.
- **Keep the fast path.** Resist converting every shot to ControlNet; the nanobanana path is good and cheap for most shots.
- **Schema churn.** The tracked-state axes (contact/posture/position/heldObjects/facing) are load-bearing for the lints — get those right early; everything else can evolve.
- **Override discipline.** Manual `overrides` must stay linted against state, or they reintroduce the very drift the engine removes.
