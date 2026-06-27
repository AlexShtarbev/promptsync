# 04 — Lint rules

Every hand-run audit from the storyboard skill becomes a deterministic rule here. Each rule lists: the failure it prevents (`00-` taxonomy), severity, and pseudocode. Rules run on save and in `npm run structure -- validate`. `error` blocks compile; `warn` surfaces in the dashboard.

> Many of these are *guaranteed* by the compiler (the prompt is built from state, so the state is present by construction). The lint still exists to catch **manual overrides** (`shot.overrides`) and authoring-time graph mistakes.

---

### L01 — State continuity  ·  prevents A1  ·  `error`
A character's opening state must equal their previous on-camera closing state, unless the shot declares the transition.
```ts
for shot, char where onCamera(char, shot):
  expected = prevClosing(char, shot)            // skips inserts/cutaways
  declared = shot.stateChanges[char.id] ?? {}
  diff = axesDiffer(resolved.opening, expected) // posture, contact, position, heldObjects, facing
  for axis in diff:
    if axis not in declared: ERROR(`${shot}: ${char} ${axis} changed from ${expected[axis]} without a declared transition`)
```
*This is the 6g audit. The 3C "pinned→standing" drift is an L01 error.*

### L02 — Manifest→prompt conformance  ·  prevents A2  ·  `error`
Every tracked state axis in the resolved opening state must appear in the compiled (or overridden) prompt text.
```ts
for axis in [posture, contact, heldObjects(if visibleBody), facing]:
  if not promptText.mentions(resolved.opening[axis]): ERROR(`${shot}: prompt omits ${axis}=${value}`)
```
*Trivially true for compiler output; the guard is for `overrides`. "Silence is a failure" encoded.*

### L03 — Model-default crowd-out (posture + build)  ·  prevents B1, B2  ·  `error`
For build-sensitive or default-pose-prone shots, the prompt must carry POSITIVE posture and build clauses.
```ts
if shot.framing.visibleBody:
  if character.unflattering && not promptText.containsAny(build.positiveClauses): ERROR(build missing)
  if isDefaultPoseProne(shot.action) && resolved.contact != 'standing'
       && not promptText.statesContactPositively(resolved.contact): ERROR(posture not positively anchored)
// isDefaultPoseProne: action.verb in {strike, swing, throw, reach, lift} → prior is "standing"
```

### L04 — Action-target presence  ·  prevents A5  ·  `error`
A transitive action needs its target in frame, with exceptions.
```ts
if shot.action.transitive && !shot.action.intentionalAbsence:
  t = shot.action.targetElementId
  if !t: ERROR("transitive action has no target")
  if t not in shot.elements: ERROR("action target not in shot.elements")
  if !promptText.describesTarget(t): ERROR("target not described in [Subject]/[Action]")
// intentionalAbsence allowlist: 'flee' (unseen pursuer), 'address-disembodied' (the voice)
```
*The 3C "swinging at air" bug. Note: concealed targets satisfy this via their positive ConcealmentSpec, not by being revealed.*

### L05 — Cross-layer equality  ·  prevents A3  ·  `error`
TSV row, `shot.md`, and `nb-prompt.md` must derive from the same shot record.
```ts
// guaranteed by construction; lint detects hand-edits that diverged from the graph
if hash(compiledTSVrow) != hash(fileTSVrow) || ...: ERROR("layer drift: regenerate from graph")
```

### L06 — Held-object continuity  ·  prevents A4  ·  `error`
An object in `heldObjects` persists until a `set-down`; must be emitted in every shot where its holder's hand is in frame.
```ts
if obj in resolved.opening.heldObjects && shot.framing.visibleBody && handInFrame(shot):
  if not promptText.mentions(obj): ERROR(`${obj} held but not in prompt`)
if obj appears in a later shot with no pick-up and absent earlier: ERROR("object teleported in")  // object audit (Step 7b)
```

### L07 — Concealment positivity  ·  prevents B4  ·  `error`
A concealed element must be described positively, and the negative must suppress only its *reveal*, not its presence.
```ts
for c in shot.concealment:
  if not promptText.contains(c.positiveDescription): ERROR("concealed element only negated, not positively shown")
  if negative.suppresses(c.elementId + " presence"): ERROR("negative removes the target's presence")  // e.g. bare "visible creature"
```

### L08 — Screen-direction  ·  prevents A7  ·  `warn`
Fixed environment features keep their screen side across the scene; flag reversals.
```ts
for feature in environment.screenAnchors:
  sides = shots.map(s => statedSideOf(feature, s)).filter(defined)
  if distinct(sides).length > 1: WARN(`${feature} flips side: ${sides}`)
// also: a fleeing/chase sequence should not flip the 180° line without an on-screen cut cue
```

### L09 — On-screen text canonical  ·  prevents A6  ·  `error`
Every `textOnScreen` resolves to exactly one registry entry; all references and the env plate agree.
```ts
for ref in shot.textOnScreen:
  entry = registry[ref.id] ?? ERROR("unknown text ref")
  if promptText.onScreenString(ref) != entry.canonical: ERROR(`text mismatch: ${...} vs ${entry.canonical}`)
```
*The FLOOR 01 / 66 inconsistency across 11 sites.*

### L10 — Palette consistency  ·  prevents A8  ·  `warn`
A shot's emitted color/mood must match its `paletteGroup` definition.
```ts
if not promptText.colorMood.consistentWith(palettes[shot.paletteGroup]): WARN("palette drift (e.g. warm in a present/cold shot)")
```

### L11 — Action density  ·  prevents over-stuffed shots  ·  `warn`
≤2 physical beats per 3–5s; 3 needs review; 4+ must be split.
```ts
beats = decomposeBeats(shot.action, shot.prose.subjectAndAction)
if beats.length >= 4: ERROR("split this shot"); else if beats.length == 3: WARN("review: flows as one motion?")
```
*The 6h audit.*

### L12 — Element-reference binding  ·  `error`
Every `@ElementName` in any prompt resolves to a real `ElementId` (global ∪ episode-local), respecting series scope.

### L-vision — Rendered-frame check (optional, post-generation)  ·  prevents B5  ·  `warn`
After an image is generated, a vision model verifies the *pixels* match the resolved state (contact, build, target presence). This is the only check that sees a default-pose/beautification failure. Add-on, not core; belongs to Tier-1.5 or Tier-2.
```ts
verdict = vision(image, `Is the subject ${resolved.contact} and ${build.summary}? Is ${target} present above?`)
if !verdict.ok: WARN("rendered frame diverged — regenerate or escalate to ControlNet (Tier 2)")
```

---

## Rule → audit provenance map

| Lint | Replaces (storyboard skill) |
|---|---|
| L01 | Step 6g intra-scene action continuity |
| L02 | Step 6g-i manifest→prompt conformance |
| L03 | Step 6g-ii model-default (posture + beautification) |
| L04 | Step 6g-iii action-target presence |
| L05 | "continuity applies to all layers" rule |
| L06 | Step 6f / 7b object continuity |
| L07 | concealment-positive (NanoBanana finding) |
| L08 | spatial / screen-direction audit |
| L09 | on-screen text "render exact" |
| L10 | palette/style-anchor rule |
| L11 | Step 6h action density |
| L12 | element name-binding check |
| L-vision | Step 9 consistency check (pixel-level) |
