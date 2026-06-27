# 02 — Tier 1: the state engine (the core build)

This is the MVP and the highest-leverage piece. It is pure TypeScript + SQLite; no GPU, no model. Build this first and standalone.

> Read `03-schema.md` alongside this — it holds the concrete types referenced here.

## Pipeline overview

```
  author ──► Scene Graph (typed, in SQLite)
                  │
                  ├─► (1) STATE PROPAGATION  → resolved opening/closing state per character per shot
                  │
                  ├─► (2) LINT PASS          → invariants (see 04-); fail or warn before compile
                  │
                  └─► (3) PROMPT COMPILER     → nb-prompt.md + shot.md + TSV row, all from the same state
```

The current `.md`/`.tsv` files become **compiler outputs**, not hand-edited inputs. Hand-edits are still possible (an `override` field) but are themselves linted against the state.

## (1) State propagation

The heart of the engine. For each character, walk shots in order and fold state forward, skipping shots where the character is not on-camera (inserts, cutaways, other-subject shots) when resolving "previous state."

```ts
// pseudocode — see 03-schema.md for types
function propagate(scene: Scene): ResolvedStates {
  const resolved: ResolvedStates = {}
  for (const character of scene.characters) {
    let prevClosing: PhysicalState = character.initialState
    for (const shot of scene.shotsInOrder) {
      if (!isOnCamera(character, shot)) {
        // An INSERT of this character's hand can still mutate object state
        // (e.g. 3B: hand grabs shard) without being a full-body "previous state".
        prevClosing = applyInsertEffects(prevClosing, shot, character)
        continue
      }
      // opening = previous closing + any declared transition for THIS shot
      const opening = merge(prevClosing, shot.stateChanges[character.id])
      // a declared transition is REQUIRED if opening != prevClosing on a tracked axis
      resolved[shot.code][character.id] = { opening }
      // closing = opening after this shot's action plays out
      const closing = applyActionEffects(opening, shot.action)
      resolved[shot.code][character.id].closing = closing
      prevClosing = closing
    }
  }
  return resolved
}
```

Key behaviors:
- **`isOnCamera`** is derived from the shot's framing + elements, not guessed. A face CU is on-camera for the character but with `visibleBody = false` (used by the framing-aware emitter, A4).
- **Declared transitions.** If a shot's opening posture differs from the carried-forward closing (e.g. `pinned → standing`), the shot MUST declare that transition in `stateChanges`. An undeclared jump is lint **L01** (state-continuity break). This is the 6g audit as code.
- **`applyActionEffects`** updates state from the action: a `pick-up` action adds a held object; a `set-down` removes it; a `rise` changes contact `grounded→standing`. This is how object/contact continuity is *computed*, not remembered.

Output: a per-shot, per-character `{opening, closing}` — the resolved state timeline. This *replaces* the hand-written manifest table; the manifest becomes a rendered view of it.

## (2) Lint pass

Run the full rule suite (`04-lint-rules.md`) over the graph + resolved states. Two severities: `error` (blocks compile) and `warn`. Examples that come straight from our debugging:
- **L01** state-continuity (A1): undeclared posture/position/object jump.
- **L04** action-target presence (A5): `action.transitive && !action.targetElementId` → error, unless the action verb is in the intentional-absence allowlist (`flee`, `address-disembodied`).
- **L09** on-screen-text canonical (A6): every `textOnScreen` resolves to one registry entry.

Lints run on every save (chokidar already watches the tree) and in `npm run structure -- validate`.

## (3) Prompt compiler

Deterministically render each output **from the resolved state**, so the state cannot be missing from the prompt.

### nb-prompt compiler
Maps resolved state → the labeled blocks the storyboard skill already uses (`[Subject]/[Action]/[World Plate]/[Optical Realism]/[Camera Capture]/[Skin & Surface]/Negative prompt`).

```ts
function compileNbPrompt(shot, resolved, library, platform): NbPrompt {
  const subjectClauses = []
  for (const charId of shot.subjectElements) {
    const st = resolved[shot.code][charId].opening
    const el = library.character(charId)
    // BUILD clause is MANDATORY for any character flagged `unflattering` or in a
    // vertical/active shot (B2). Emitted POSITIVELY.
    subjectClauses.push(buildClause(el))                 // "noticeably overweight, heavy soft belly straining the tee…"
    subjectClauses.push(postureClause(st))               // "pinned flat on his back, back/hips/legs flat on the floor, not rising"
    subjectClauses.push(heldObjectClause(st, shot))      // framing-aware (A4): only if hand in frame
    if (shot.action.transitive)
      subjectClauses.push(targetClause(shot.action, library)) // "his shard arcs UP into the shadow-mass above"
  }
  // concealed elements rendered POSITIVELY (B4), never only via negative
  for (const c of shot.concealment) subjectClauses.push(concealmentClause(c)) // "a shapeless shadow-mass, no anatomy"

  const negative = negativePolicy(platform, shot)  // see below
  return assemble(subjectClauses, worldPlate(shot, library), camera(shot), negative)
}
```

### Per-platform negative policy (B3)
The compiler knows the target model and adjusts:
- `platform: nanobanana` → posture/build/concealment carried **positively**; negative line is a thin backup only (and the model-default term, e.g. `standing`, is *crowded out* by a positive clause, not relied on in the negative).
- `platform: kling | seedance` (video stage) → negatives are a real supported lever; emit them, but still positive-anchor pose/build/held-object in the motion prompt.

This encodes the research finding directly (see `05-`), so a future author can't reintroduce the "put it in the negative" mistake.

### shot.md and TSV compilers
Trivial projections of the same resolved state + the shot's authored prose. Because all three come from one model, **A3 (three-layer drift) cannot occur**.

## Framing-aware emission (A4)

Held objects and body details are emitted **only when the framing shows them**:
- `visibleBody = false` (face CU) → omit held-object and build-of-body clauses (a shard in an off-frame hand is correctly *not* in the prompt — and including it would violate the "no off-screen references" rule).
- `visibleBody = true` → held object + build mandatory.

This is the nuance a flat "always restate the shard" rule got wrong; here it's computed from `shot.framing`.

## Round-trip / adoption

You don't have to author from scratch. Build an **importer**: parse the existing crawler ep01 `.md`/`.tsv` into the graph, then **re-compile and diff** against the originals. Convergence (the engine reproduces the hand-authored files) is the Phase-0 acceptance test (`07-`). After that, the graph is the source of truth and the files are outputs.

## What Tier 1 explicitly does NOT do

- It does not look at pixels. It guarantees the *prompt* carries the state; it cannot guarantee the *model obeyed* (that's B5 → Tier 2/3). It can optionally call a vision model as a post-generation lint (`L-vision`), but that's an add-on, not core.
- It does not pose or render anything. It emits text + structured conditioning hints that Tier 2 consumes.
