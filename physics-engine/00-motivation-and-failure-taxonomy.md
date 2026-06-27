# 00 — Motivation & failure taxonomy

This is the "why." Every failure below was **observed in real production** (crawler ep01), not imagined. They are the acceptance targets: the engine exists to make each one structurally impossible or to catch it deterministically.

## The shape of the problem

The storyboard pipeline produces, per shot, three text artifacts that must agree:
- a row in the **TSV** (the at-a-glance board),
- `shot.md` (per-shot metadata + Subject & Action),
- `nb-prompt.md` (the actual image-generation prompt, `[Subject]/[Action]/[World Plate]/...` blocks).

Plus a **continuity manifest** (`scene-{N}-objects.md`) that tracks, per character, an opening/closing physical state across shots, and an **element library** (character/environment/prop sheets) holding canonical attributes (build, wardrobe, palette, screen-position).

The LLM authors all of these as free text and audits them by re-reading. The failures cluster into two families.

---

## Family A — Bookkeeping failures (deterministic; Tier 1 kills these)

### A1. State not propagated across shots
A character's opening physical state must equal the closing state of their **most recent on-camera shot** (skipping inserts/cutaways). When it isn't carried, the model invents one.
- **Observed:** Shot `3A` = Hale **pinned on his back**. Shot `3C` (two shots later, after an insert) was written with no posture carried → drifted to a free standing swing.

### A2. The manifest knows the right state, but the prompt doesn't carry it
The manifest is the source of truth, but the prompt is *hand-copied* from it, so the copy can silently omit a field. **Silence is the failure**, not contradiction — a prompt that just doesn't mention posture passes a "does anything contradict?" check but renders the default.
- **Observed:** the manifest had `3C: on back, shard in fist`; the `nb-prompt` said only "his body torquing into the swing" — posture omitted → rendered standing.

### A3. Three-layer drift
The same shot's three files disagree because they're edited independently.
- **Observed:** after `3C`'s `shot.md` and `nb-prompt` were corrected, the **TSV row still described the old standing swing** for another round.

### A4. Held-object continuity
An object enters a hand and must remain (or be explicitly set down) through every later shot where the hand is in frame.
- **Observed:** the stone shard was at risk of vanishing from the climb shots; the manifest even pre-flagged it. Whether it belongs in a given prompt depends on **framing** (a face CU doesn't show the hand) — a nuance a flat rule gets wrong.

### A5. Action has no target in frame ("striking air")
A **transitive** action (strike/reach/look-at/push/aim-at) needs its target present, or the action renders against empty space. The inverse of the usual object audit: a target present in shot N gets *dropped* from the continuation N+1.
- **Observed:** `3C` (Hale swings up) had the creature **removed** from its elements (to "keep it hidden") and even negated `visible creature` → a man swinging at nothing. Fix was to keep the creature present *as a shadow-mass* (concealment preserved, target restored). Exceptions exist: *fleeing* an unseen pursuer and *addressing a disembodied voice* are intentional empty space, not defects.

### A6. On-screen text not canonical
A diegetic string (a counter readout) must match everywhere it's specified.
- **Observed:** the floor counter was `FLOOR 01 / 66` in `shot.md`/TSV but `01 / 66` in the `nb-prompt` and environment plate — 11 occurrences across 5 files, internally inconsistent.

### A7. Screen-direction / spatial anchors
Elements anchored to a screen side must stay there; the 180° line must hold across a chase.
- (Audited clean in ep01, but only by hand — it's a deterministic check waiting to be coded: red glow camera-left, stairs/counter camera-right, climb direction.)

### A8. Palette by scene group
Memory shots warm-desaturated; present shots cold blue-black; rest-area amber. A present shot that renders warm breaks the visual grammar. Deterministically checkable from `palette_group`.

---

## Family B — Generation-control failures (text is a weak lever; Tier 2/3 address these)

### B1. Posture default (mode collapse to the common pose)
With posture under-specified, the model falls back to its training prior — usually **standing**. Measured, not folklore (see `05-`/research refs). "Man swinging a rock" → standing batter's stance.

### B2. Beautification / build drift
The model quietly **slims, straightens, de-ages, and fitness-improves** a body — worst as a character goes vertical/active. A deliberately overweight character drifts to fit unless the build is positively re-asserted every shot. **A character reference / Kling Element locks identity (face, wardrobe), NOT pose and NOT reliably build.**
- **Observed:** `3C` rendered Hale noticeably slimmer than his "noticeably overweight" canon, *even with his Element attached*.

### B3. Negative prompts barely work on NanoBanana/Gemini
NanoBanana (Gemini-class image) is autoregressive/conversational and exposes **no true negative-prompt parameter**; Google's guidance is "describe positively, don't list exclusions." A `standing` negative there is weak and can even *introduce* the concept. Negatives ARE a real lever at the Kling/Seedance **video** stage.
- **Implication:** posture/build/concealment control must be carried by **positive phrasing** on stills; negatives are a low-weight backup only.

### B4. Concealment expressed only as a negative
"Don't show the creature" via the negative prompt is unreliable on NanoBanana. Concealment must be positive: "a shapeless shadow-mass, no anatomy."
- **Observed:** creature shots survived because the drafter *did* phrase concealment positively — but nothing enforced it; it was luck + care, not a guarantee.

### B5. The text→pixels gap is invisible to text audits
Every Family-A and -B check above is upstream of the image. A text-vs-text audit cannot see that the *rendered* frame defaulted. Only looking at the pixels (a vision check, or deterministic conditioning) can.

---

## What "fixed" means (acceptance targets)

| # | Failure | Engine answer | Tier |
|---|---|---|---|
| A1 | state not propagated | computed state timeline | 1 |
| A2 | manifest→prompt omission | prompt compiled *from* state | 1 |
| A3 | three-layer drift | three files are projections of one model | 1 |
| A4 | held-object continuity | object state + framing-aware emit | 1 |
| A5 | action has no target | `transitive ⇒ target ∈ elements` lint | 1 |
| A6 | on-screen text | text registry, single source | 1 |
| A7 | screen-direction | element screen-anchor map + lint | 1 |
| A8 | palette | `palette_group` lint | 1 |
| B1 | posture default | positive-clause compiler; ControlNet for hard shots | 1→2 |
| B2 | build drift | mandatory build clause; IP-Adapter; 3D mannequin | 1→2→3 |
| B3 | weak negatives | positive-first compiler, per-platform negative policy | 1 |
| B4 | concealment-as-negative | positive concealment emit + lint | 1 |
| B5 | text→pixels gap | optional vision verifier; deterministic conditioning | 2→3 |
