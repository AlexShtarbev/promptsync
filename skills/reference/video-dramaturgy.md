# Video Dramaturgy — Film Theory for AI Video Prompts

Applied film theory that strengthens every stage of the pipeline: script development, storyboarding, shot design, and prompt writing. These principles sit above any specific model — they work for Kling, Seedance, NanoBanana, or any future tool.

The practical checks derived from this theory (three-detail audit, five anchors, dramaturgy check, rhythm ladder) live in `kling-reference.md` → Dramaturgical Framework. The three-detail audit also appears as the Details Law in `seedance-reference.md` and as the three-detail audit in `storyboard.md` → Step 6. This file is the foundation those checks are built on. Read this first; use those checks as the enforcement mechanism.

---

## Contents

1. Scene formula
2. Three-jobs rule
3. Walter Murch Rule of Six
4. Blocking as choreography of desire
5. Staging controls subtext
6. Camera must have a reason (Fincher rule)
7. Spatial clarity beats montage hysteria (Spielberg principle)
8. Environment plays (Kurosawa principle)
9. Universal prompt rules (weight-at-start, no contradictions, show don't tell)
10. Three-layer storyboard method
11. Shot card template (14 fields)

---

## 1. Scene Formula

A scene exists only when all five elements are present:

```
Scene = hero's desire + obstacle + space geometry + controlled gaze + editing rhythm
```

If any element is missing, the scene collapses into decoration.

- **Desire.** What does the character want right now, in this specific second.
- **Obstacle.** What blocks them. Object, person, fear, distance, rule.
- **Space geometry.** Who stands where. Who has the power position. Which direction is threat, which is escape.
- **Controlled gaze.** Where the viewer's eye is forced to look — one focal point per frame.
- **Editing rhythm.** How long each shot lives, where the pause lands, where the cut bites.

Before writing a prompt or storyboard row, name each of these in one sentence. If you cannot, the scene is not ready.

---

## 2. Three-Jobs Rule

Every shot must do at least one of three things. If it does none, delete it.

1. **Change emotion** — in hero, viewer, or the dynamic between characters.
2. **Advance action** — new physical event, new information, new position.
3. **Increase pressure** — stakes rise, clock ticks, space tightens, witness appears.

"Beautiful establishing shot" is not a job. "Beautiful hero shot of product" is not a job. Either the frame works for one of these three, or it is a wrapper without candy.

---

## 3. Walter Murch Rule of Six

From the editor of *Apocalypse Now*, *The Godfather Part II*, and *The English Patient*. The priority order when deciding where to cut. Each item is weighted heavier than the sum of everything below it.

| Priority | Weight | Criterion |
|----------|--------|-----------|
| 1 | 51% | **Emotion.** Does the cut honor the emotional truth of the moment? What does the viewer feel now vs. what they should feel next? |
| 2 | 23% | **Story.** Does the cut advance story or reveal character? |
| 3 | 10% | **Rhythm.** Does the cut fall on a musical beat of the scene? |
| 4 | 7% | **Eye-trace.** Where is the viewer's gaze at the moment of the cut? Does the new shot receive that gaze naturally? |
| 5 | 5% | **2D plane.** Does the cut respect the axis of screen direction? |
| 6 | 4% | **3D space.** Does the cut respect the geometry of the real location? |

**Practical consequence:** Cutting for pace alone sits at item 3. If you cut there without serving items 1 and 2, the result is an attention-deficit TikTok ad. Always ask: does this cut serve emotion first?

---

## 4. Blocking as Choreography of Desire

Blocking is not "where the actor stands." Blocking is a visual answer to "what does the character want and from whom."

For every character in the scene, name:

- What they want now.
- Who or what they move toward.
- Who or what they move away from.
- Whom they corner.
- To whom they yield space.
- What gesture reveals the hidden desire.

Bad: "He stands near the window."
Good: "He edges toward the window but his shoulder stays angled back toward her, as if the conversation still holds him."

This is especially critical in AI video because the model cannot infer blocking intent — it positions characters literally. If the blocking is not spelled out, the spatial relationship will be meaningless.

---

## 5. Staging Controls Subtext

Staging is the arrangement of people, objects, and camera inside the frame. Before dialogue, staging already tells the conflict.

### Power Signals

| Staging | What It Says |
|---------|-------------|
| Standing character vs. seated | Standing dominates |
| Character in the doorway | Controls the room |
| Character behind glass or in reflection | Psychologically distant |
| Character in shadow | Carries threat or grief |
| Negative space around a character | Isolation |
| Tight framing, no breathing room | Suffocation, pressure |
| Shared frame without eye contact | Broken intimacy |
| Character's back to camera | Vulnerability or rejection |
| Low angle on a character | Power, authority |
| High angle on a character | Diminishment, judgment |

Spielberg, Kubrick, and Iñárritu build entire scenes where the staging states the conflict before a line is spoken. Before writing a prompt, name the power dynamic the staging reveals.

**For AI video prompts:** These staging signals must be stated explicitly in `[Context]` or spatial blocking. Kling will not infer power dynamics from dialogue — it only renders what you describe physically.

---

## 6. Camera Must Have a Reason (Fincher Rule)

Every camera movement answers "what changed?" If the answer is nothing, the camera is static.

### Reasons for Camera Movement

| Reason | Example |
|--------|---------|
| Character made a decision | Camera follows the shift in body weight |
| New information arrived | Camera reveals what entered the frame |
| Pressure escalated | Camera tightens — push-in |
| Character looked | Camera reveals what they saw |
| A gesture pulled focus | Rack focus to the hand |
| The space changed | Door opened, someone entered |

Bad: "Cinematic gliding camera movement."
Good: "Push-in starts on 'I don't know' and stops on her jaw locking."

This rule is already enforced as point 4 of the dramaturgy check in `kling-reference.md`. This section gives the theory behind it — the reason to ask "what changed?" before writing any camera instruction.

---

## 7. Spatial Clarity Beats Montage Hysteria (Spielberg Principle)

Even in chaos, the viewer must always know:

- Where the hero is.
- Where the threat is.
- Which direction is escape.
- Which direction is decision.

High craft means fast, nervous, and still readable. Random whip-pans and strobe cuts without geography destroy drama. The fastest action scenes in cinema (Spielberg, Miller, early Bay) are built on a clear geometric map maintained through every cut.

Before writing a fast-cut sequence, sketch the geography in one sentence:
"Hero moves left-to-right. Threat enters from the top of the frame. Exit is off-camera right."

**For AI video:** This matters even more because Kling has no persistent spatial memory between shots. If you don't state where things are, each shot invents its own geography and the sequence becomes incoherent. Use the depth labels (`foreground:` / `midground:` / `background:`) and consistent directional language across shots.

---

## 8. Environment Plays (Kurosawa Principle)

Weather and environment are characters. They amplify emotional state without stating it. Pick one environmental pressure per scene and let it carry the emotion.

### Environment → Emotion Mapping

| Environment | Emotional Signal |
|-------------|-----------------|
| Flickering fluorescent light | Decay, bureaucracy, dread |
| Rain on a window | Grief withheld |
| Steam from a kettle | Suppressed anger |
| Buzzing air conditioner | Dissociation |
| Wet asphalt at night | Guilt |
| Tight corridor | Walls closing in, entrapment |
| Mirror or glass surface | Self-reckoning |
| Overhead cold office light | Judgment |
| Open sky, wind | Liberation, exposure |
| Dust motes in a shaft of light | Stillness, sacred pause |
| Embers, ash | Aftermath, loss |
| Dripping tap | Time passing, neglect |
| Curtain breathing in the AC | Restlessness, unease |

This is the companion to the environmental pressure detail in the three-detail audit (`kling-reference.md`). The audit checks that each shot HAS an environmental pressure; this table helps you CHOOSE one that amplifies the emotion of the shot.

**Application:** Use this table when filling the Color & Mood column of the storyboard TSV. The chosen environment drives NanoBanana lighting/atmosphere and the Kling `[Context]` block.

---

## 9. Universal Prompt Rules

These apply to every AI video model (Kling, Seedance) and sit above model-specific syntax.

### Weight-at-Start

Generators put more attention on the first 30–40% of tokens. Lead with subject and action. Style modifiers go at the end. Camera, lighting, and environment live in the middle.

In the Kling prompt template (`[Cinematography] → [Subject] → [Action] → [Context] → [Style & Ambiance]`), this is already respected — `[Subject]` and `[Action]` carry the narrative weight and appear before style modifiers.

### No Contradictions

The model obeys the strongest signal. Contradictions produce artifacts.

| Contradiction | What Breaks |
|--------------|-------------|
| "Still pond" + "flowing water" | Water physics tear |
| "Close-up" + "wide cinematic landscape" | Framing oscillates |
| "Quiet moment" + "explosive action" | Motion scale fights itself |
| "Golden hour warmth" + "cold blue moonlight" | Lighting averages into flat mush |
| "Static camera" + "tracking shot" | Camera jitters |

Audit every prompt for contradictions before sending. If you find one, pick the stronger choice and cut the weaker.

### Show Don't Tell

The model cannot render feelings. It renders bodies. Translate every emotion into a physical action.

- Bad: "He is scared."
- Good: "His jaw locks. He stops breathing for one beat. His fingers curl against the doorframe."

This is the philosophical basis of the three-detail audit's "physical micro-action" requirement. The audit enforces the rule; this principle explains WHY.

### Natural Language Beats Tag Spam

Video models are not image models. Tag stuffing ("masterpiece, 4k, cinematic, beautiful") fails. Write in full cinematic sentences as if briefing a human DOP.

This applies to Kling prompts. NanoBanana image prompts use a different register — they accept quality boosters and behavioral film-look and lens descriptions (describe what the look and glass do, never brand names — see `reference/nanobanana-artistry.md` → Film Look Vocabulary and Lens Behavior, Not Brand Names). But even for NanoBanana, the subject/action core should be natural language.

---

## 10. Three-Layer Storyboard Method

Build storyboards in three layers, in this order. Skipping a layer produces pretty but empty output.

### Layer 1 — Dramatic Beats

Map the emotional arc before touching camera or visuals. For a 60–90 second piece:

```
0–5s    Hook.        Hero already in tension. No setup. Problem on screen.
5–15s   Context.     Where we are. Who is near. What is at stake.
15–30s  Pressure.    Hero tries to hold control.
30–45s  Crack.       A detail appears that breaks the hero's position.
45–60s  Acceleration. Cuts shorten. Breath tightens.
60–75s  Impact.      Decision, break, confession, or action.
75–90s  Aftermath.   Brief silence or visual residue.
```

Adjust for 30s or 15s by compressing proportionally. Never skip the Crack or the Impact.

### Layer 2 — Shot Functions

Tag every shot with a function. This is cinema grammar — everything else is decorative wallpaper.

| Function | What It Does |
|----------|-------------|
| **Establish** | Where we are |
| **Power** | Who controls the scene right now |
| **Pressure** | What pushes down on the hero |
| **Detail** | Object, hand, phone, eye, drop, receipt, door. Macro anchor. |
| **Reaction** | Face after the event |
| **Shift** | Inner change made visible |
| **Impact** | The decisive frame |
| **Aftermath** | Emptiness after action |
| **Exit** | Final image the viewer carries out |

If two adjacent shots have the same function, they feel redundant — and in AI video generation, the model may literally average them into the same frame. Vary function and framing in every cut.

### Layer 3 — Editing Rhythm

Not random mincing. A rhythmic staircase:

```
long → shorter → shorter → pause → impact
```

Example internal structure of an 8–10 second montage:

```
4s    Wide. Hero enters.
2s    Medium. Hero notices the object.
1s    Close-up. Eyes.
0.5s  Macro insert of the object.
0.33s Hand.
0.25s Detail / sound cue.
2s    Sudden silence.
1s    Decision.
```

The pause before the impact is more important than the speed of the cuts. Without a pause, speed becomes a visual meat grinder.

This connects to the rhythm ladder and five-second scaffold in `kling-reference.md` → Dramaturgical Framework.

---

## 11. Shot Card Template (14 Fields)

For detailed shot-level planning when the storyboard TSV needs deeper direction. Fill every field — missing fields reveal missing direction.

| # | Field | Description |
|---|-------|-------------|
| 1 | **Shot ID** | 01, 02, 03 |
| 2 | **Beat** | What changes in the story here |
| 3 | **Emotion** | Fear, shame, anger, guilt, resolve, relief |
| 4 | **Frame** | Wide / medium / close-up / macro insert |
| 5 | **Composition** | Center, edge, negative space, reflection, silhouette, foreground obstruction |
| 6 | **Camera** | Static, push-in, handheld, tracking, whip-pan |
| 7 | **Movement reason** | Why the camera moves here. Answer "what changed?" |
| 8 | **Action** | Exact physical event |
| 9 | **Eye trace** | Where the viewer's gaze should land in the first 0.3s |
| 10 | **Duration** | 0.5s, 1s, 3s |
| 11 | **Cut type** | Match cut, smash cut, cut on action, J-cut, L-cut |
| 12 | **Sound** | Breath, bass hit, street noise, phone ring, silence |
| 13 | **Light / color** | Cold, contrast, flicker, shadow, specific palette |
| 14 | **Production note** | Prop, location, actor direction |

If a shot card has empty fields, fill them or drop the shot. This template is an expansion of the storyboard TSV row — use it for complex shots where the TSV's columns aren't enough to nail the direction.

---

## How This File Connects to the Pipeline

| Pipeline Stage | What This File Provides |
|---------------|------------------------|
| **DEVELOPMENT MODE** | Scene formula (§1), blocking (§4), staging (§5) — test whether the scene has all five elements before writing it |
| **SCRIPT MODE** | Three-jobs rule (§2), Murch (§3) — audit every beat |
| **STORYBOARD MODE** | Three-layer method (§10), shot card (§11), shot functions, environment plays (§8) |
| **Prompt generation** | Weight-at-start (§9), no contradictions (§9), Fincher camera rule (§6), spatial clarity (§7) |
| **REVIEW MODE** | Every section — diagnose where a scene or shot fails |

---

## What This File Does Not Do

1. Does not replace the dramaturgy check or three-detail audit in `kling-reference.md` — those are the enforcement mechanism. This file is the theory.
2. Does not replace `cinematography.md` — that file maps emotion → shot size, angle, movement. This file maps emotion → staging, blocking, and environment.
3. Does not contain model-specific syntax — see `kling-reference.md` for Kling prompts, `seedance-reference.md` for Seedance prompts, `nanobanana-artistry.md` for NanoBanana prompts.
4. Does not contain the rhythm ladder or five-second scaffold — those live in `kling-reference.md` → Dramaturgical Framework since they're applied at the prompt level.
