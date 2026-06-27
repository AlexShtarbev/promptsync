# The Algorithm: Script → Storyboard

This is the master pipeline. Follow these steps in order for every script-to-storyboard conversion. Each step references a specific section in the other reference files.

---

## STEP 0: PARSE THE INPUT

Extract from the script/scene:
- **Scene heading** (INT/EXT, location, time of day)
- **Characters present** (count them — this determines staging pattern)
- **Dialogue lines** (who speaks, in what order)
- **Action/movement descriptions** (who moves where)
- **Emotional beats** (where does the scene turn? what shifts?)
- **Props/objects** mentioned that interact with characters

If any of these are ambiguous, make a reasonable assumption and note it. Do not ask the user.

---

## STEP 1: CLASSIFY THE SCENE TYPE

Every scene falls into one or more of these categories. Classification determines which staging rules apply.

| Type | Characteristics | Primary Reference |
|------|----------------|-------------------|
| **DIALOGUE-STATIC** | 2+ characters talking, minimal movement | staging-rules.md §Positions |
| **DIALOGUE-MOBILE** | Characters talk AND reposition during scene | staging-rules.md §Mobile |
| **ACTION** | Physical movement is primary (chase, fight, walk) | staging-rules.md §Action |
| **ESTABLISHING** | Introduce a location, mood, time, context | shot-flow-and-editing.md §Establishing |
| **TRANSITION** | Bridge between two scenes or time periods | shot-flow-and-editing.md §Transitions |
| **REVEAL** | Information is disclosed to character or audience | shot-flow-and-editing.md §Q&A Patterns |
| **REACTION** | Character processes information/event | staging-rules.md §Depth |
| **MONTAGE** | Compressed time, multiple mini-scenes | shot-flow-and-editing.md §Montage |

Most scenes are compound (e.g., ESTABLISHING → DIALOGUE-STATIC → REVEAL). Process each phase sequentially.

---

## STEP 2: DRAMATIC ANALYSIS (per scene)

Answer these 7 questions. The answers directly determine camera choices in Step 4.

| # | Question | Feeds Into |
|---|----------|-----------|
| 1 | What is the **purpose** of this scene in the story? | Overall tone, pacing |
| 2 | What does the **main character want** in this scene? | POV choice, whose CU we favor |
| 3 | What does the character **see/experience**? | What the camera shows |
| 4 | What does the character **expect** to happen? | Setup shots before the turn |
| 5 | What **actually** happens? | The turn — where staging/size shifts |
| 6 | What should the **audience learn**, and **when**? | Information control: Q before A, or A before Q |
| 7 | What should the **audience feel**? | Emotional distance → shot size; angle → relationship |

**The output of Step 2 is a 1-2 sentence answer for each question.** These answers are not shown to the user unless requested — they feed directly into Steps 3-5.

---

## STEP 3: DETERMINE STAGING PATTERN

### Decision Tree for Pattern Selection

```
How many characters are ON SCREEN simultaneously?

├─ 1 character
│   → No pattern needed. Use shot size + angle + depth.
│   → See: staging-rules.md §Solo
│
├─ 2 characters
│   → Pattern: I (always I for two players)
│   → Go to: POSITION SELECTION (Step 3b)
│
├─ 3 characters
│   → Is one character flanked by the other two?
│   │   ├─ YES → Pattern: A
│   │   └─ NO → Is one character isolated to one side?
│   │       ├─ YES → Pattern: L
│   │       └─ NEITHER → Pattern: I (all three in a line)
│   → Then: Reduce to I-pattern pairs for camera placement
│
├─ 4+ characters
│   → Identify the 2-3 CENTRAL characters (who drives the dialogue?)
│   → Establish line of action between them
│   → Treat remaining characters as background/reaction
│   → Apply A, I, or L based on central characters
│
└─ Crowd / large group
    → Camera IN the crowd (wide lens, intimate/chaotic)
    → OR Camera OUTSIDE the crowd (telephoto, observational)
    → Isolate key characters with lens choice
```

### Step 3b: POSITION SELECTION (for 2-character I-pattern)

Choose based on the **dramatic relationship** in the scene:

| Position | When To Use | Dramatic Effect |
|----------|------------|-----------------|
| **P1: Face-to-face** | Confrontation, negotiation, interview | Direct opposition, tension |
| **P2: Shoulder-to-shoulder** | Shared task, looking at same thing | Alliance, collaboration |
| **P3: 90-degree angle** | Casual conversation, early relationship | Relaxed, non-committal |
| **P4: One turned away** | One character withholding, in denial | Tension, privileged viewer position |
| **P5: Both facing away** | Standoff, emotional shutdown | Maximum separation |
| **P6: Same direction, in depth** | Interrogation, confession, monologue | Foreground ID, withheld eye contact |
| **P7: Both offscreen-look, different directions** | Distracted, divided attention | Relaxed, offhanded |
| **P8: Right angle, BG looks away** | One observes the other covertly | Unequal awareness |
| **P9: Backs to each other** | Defiance, covert surveillance | Stylized, comedy or thriller |
| **P10: Different heights** | Power differential, seated/standing | Dominance/submission |

**If the scene has a TURN (most do):** Start with one position, shift to another at the turn. Example: Start P3 (casual), shift to P1 (confrontation) when conflict emerges.

---

## STEP 4: ASSIGN CAMERA SETUPS

For each phase of the scene (before turn, at turn, after turn), assign specific shots.

### 4a: Determine the Line of Action
Draw an imaginary line between the two characters who are currently in dialogue. The camera stays on one side of this line (the 180° working space).

### 4b: Select Shots Using the Triangle System

The triangle provides 5 basic setups for any two characters:

| Setup | What It Is | When To Use |
|-------|-----------|-------------|
| **Master two-shot** | Both characters in frame | Scene opening, reestablishing geography |
| **Angular singles** | MS or CU of each character from angled positions | Standard coverage, differentiation |
| **OTS (over-the-shoulder)** | One character framed past the other's shoulder | Dialogue exchange — overlaps space, maintains unity |
| **POV singles** | CU from the other character's approximate eyeline | Intimate reaction, emotional peak |
| **Profile shots** | Both characters in profile | Formal opposition, symmetry |

### 4c: Apply Shot Size Based on Emotional Distance

Map the dramatic analysis (Step 2, Question 7) to shot size:

| Audience Should Feel | Shot Size | Camera Distance |
|---------------------|-----------|-----------------|
| Detached, observational, epic scope | ELS / WS | Far — outside the action |
| Contextual, oriented, grounded | WS / MS | Medium — at the edge |
| Engaged, present, involved | MS / MCU | Close — in the action |
| Intimate, vulnerable, confrontational | CU / ECU | Very close — uncomfortably in the action |

### 4d: Apply Camera Angle Based on Relationship

| Relationship | Angle | Effect |
|-------------|-------|--------|
| Neutral / objective | Eye level | Stable, balanced |
| Character dominance | Low angle (looking up) | Subject appears powerful |
| Character vulnerability | High angle (looking down) | Subject appears diminished |
| Unease / disorientation | Dutch angle (tilted) | Psychological instability |
| God's-eye / fate | Extreme overhead | Detachment, pattern, irony |

**WARNING:** These are defaults, not laws. In Citizen Kane, low angles on old Kane + vast spaces = he seems SMALL despite the "power" angle. Context overrides convention. Always check: does this angle serve the dramatic analysis from Step 2?

### 4e: Movement Decision

```
Does the scene involve character movement?
├─ NO → Static camera. Cut between setups.
│
├─ YES, minor repositioning
│   → Mobile staging: actor movement substitutes for cuts
│   → Camera may dolly to follow or reframe
│   → See staging-rules.md §Mobile for counter-moves
│
└─ YES, significant movement (crossing room, chase, walk-and-talk)
    → Tracking shot, crane, or steadicam
    → OR cut between static positions along the path
    → Decision depends on: Do you want the audience to TRAVEL WITH
    │  the character (track) or OBSERVE the movement (static + cut)?
    └─ For AI video: prefer cuts between static frames over complex tracking
```

---

## STEP 5: SEQUENCE THE SHOTS (Shot Flow Design)

### 5a: Opening Strategy

Every scene needs an opening. Three options:

| Strategy | How | When |
|----------|-----|------|
| **Wide → Tight** | Establishing shot → move closer | Standard. New location, orientation needed. |
| **Tight → Wide** | Detail/CU → pull back to reveal context | Mystery, surprise, audience discovery |
| **Detail montage** | Series of CUs that imply the whole | Mood, atmosphere, thematic |

### 5b: Q&A Editing Structure

For each shot, identify what QUESTION it raises or what ANSWER it provides:

- **Q then A (standard):** Character looks offscreen → Cut to what they see
- **A then Q (suspense):** Show the danger → Then show the character approaching it
- **Q, delay, A (tension):** Raise a question, insert other shots, answer later
- **Multiple Q in one shot:** Dense composition with several narrative threads

The scene's TURN is where Q&A structure matters most. At the turn:
- Shift shot size (tighter = more intense)
- Shift angle (new perspective on the situation)
- Shift the line of action if a new character dynamic emerges

### 5c: Cutting Rhythm

| Pacing Goal | Technique |
|-------------|-----------|
| Tension building | Shots get progressively tighter and shorter |
| Release / breath | Cut to a wider shot, hold longer |
| Shock | Abrupt size change (WS → ECU) |
| Continuity / flow | Cut on movement, matched action |
| Time passage | Clear frame, dissolve, or detail montage |
| Parallel action | Intercut between locations |

### 5d: Transition to Next Scene

| Transition | Meaning |
|-----------|---------|
| Hard cut | Continuous time, or deliberate contrast |
| Dissolve | Time passage, connection between scenes |
| Fade to black | End of act, significant time gap |
| Match cut | Graphic or thematic link (bone → spaceship) |
| Clear frame | Subject exits, hold empty frame, cut to new scene |
| Sound bridge | Audio from next scene begins over current image |

---

## STEP 6: WRITE THE STORYBOARD

See `references/output-format.md` for the exact format. For each shot, produce:

1. **Panel number**
2. **Shot size** (WS, MS, CU, etc.)
3. **Camera angle and height**
4. **Lens suggestion** (wide, normal, telephoto — and why)
5. **Subject description** (who/what is in frame, where in the frame)
6. **Action in the shot** (what happens during this shot)
7. **Camera movement** (static, pan, dolly, crane — with direction)
8. **Sound/dialogue** (what we hear)
9. **Edit note** (how this shot connects to the next: cut on action, dissolve, etc.)
10. **Dramatic function** (why this shot exists — what Q it raises or A it provides)

---

## STEP 7: SELF-CHECK

Before delivering, verify:

- [ ] Every dialogue line has a character visible or audible
- [ ] The 180° line is consistent (or deliberately crossed with motivation)
- [ ] Shot sizes vary — no more than 3 same-size shots in a row without reason
- [ ] The scene TURN is marked by a shift in shot size, angle, or both
- [ ] Opening shot establishes enough geography for the audience to follow
- [ ] The Q&A chain is unbroken — every question gets answered, every answer was set up
- [ ] Reaction shots exist — we see characters RESPOND, not just act
- [ ] The emotional arc (from Step 2) is supported by the shot size progression
- [ ] **Intra-scene object continuity** passes — see Step 7b below

If any check fails, revise the relevant shots before output.

### Step 7b: INTRA-SCENE OBJECT CONTINUITY AUDIT

Objects and character positions within a scene are persistent — a phone on a table doesn't materialize when the story needs it; it was there all along. When a later shot introduces an object, character, or character position, every earlier shot in the same scene where that item would be physically visible must already include it.

**The principle:** Within a single scene (same setting, continuous time), any physical element that exists in shot N must be retroactively present in shots 1 through N-1 wherever the camera framing would reveal it. Objects don't appear from nowhere — the audience just notices them later.

**The algorithm:**

1. **Build the Object Continuity Manifest.** After writing all shots for a scene, create a manifest file at `storyboard/continuity/scene-{N}-objects.md`. This is the source of truth for where every object IS at every moment — not just when it's mentioned. For each persistent object (phone, screwdriver, bag, furniture) and each character, build a shot-by-shot table tracking: Location, State, Visible? (given shot type and camera direction), and Notes. Include objects that are HIDDEN (under a surface, in a pocket, in a closed cabinet) — track them as "not visible" with their actual location. The manifest catches objects that SHOULD be mentioned but aren't — the audit alone can only verify objects that ARE mentioned.

2. **Find each item's introduction shot.** For each item in the manifest, identify the first shot where it becomes relevant or is used.

3. **Walk backward — propagate into earlier shots.** Using the manifest's Visible? column, check each earlier shot. Apply the visibility filter:

| Shot type | What should be visible |
|-----------|----------------------|
| EWS / WS / Establishing | Nearly everything in the scene — all characters, major objects, furniture, spatial layout |
| MS | Characters and objects in the immediate area; background objects if camera direction includes them |
| MCU | Character and objects within arm's reach or on their body |
| CU / ECU | Only what fills the frame — hands, face, held objects |
| Insert | Only the featured object |

4. **Add missing items.** If the manifest shows an item as visible in a shot but the shot's text doesn't mention it, add it. Keep additions proportional to the shot — a WS gets a brief mention ("his phone rests on the altar cloth"), not a detailed description. A CU on hands doesn't need to mention a phone across the room.

5. **Track items that move.** When an object moves (phone picked up, screwdriver left on pew), update the manifest and ensure subsequent shots reflect the new location. The object doesn't vanish — it's somewhere, and the manifest says where.

6. **Prefer visible placement over hidden.** When the script says an object is hidden ("under the pulpit," "in a drawer"), consider whether it should be visible from the start instead. Visible planting in earlier shots makes the pickup feel earned rather than conjured. Hidden objects are invisible to the AI model — it can't show what it doesn't know about. Move objects to visible surfaces when possible: "screwdriver under the pulpit" → "screwdriver on the nearest pew."

**Common miss patterns:**
- Insert shot introduces an object (phone, bottle, note) that was never visible in earlier WS or MS shots of the same location
- Character is positioned in shot B but the establishing WS in shot A doesn't show them
- Character puts down / picks up an object but intermediate shots don't track where it is
- A prop is used in a later shot but wasn't planted in the environment when we first saw it

### Step 7c: INTRA-SCENE ACTION CONTINUITY AUDIT

Objects don't teleport — and neither do characters. When a character ends shot N kneeling at a pew with a screwdriver, their next on-camera shot must begin from that physical state. The script may say "Peter crosses back to the altar" — but crosses back from WHERE? The video model has no memory of previous shots. It needs the bridge.

**The principle:** For every shot in a scene, each character's opening physical state (position, posture, held objects, facing direction) must match their closing physical state from the most recent shot where they were on-camera — which may be one, two, or several shots back. Inserts, cutaways, CU shots of a different subject, and reaction shots of other characters are all skipped when finding the "previous" state. Example: if shots run A (Peter at altar) → B (insert of phone) → C (Peter again), then C bridges from A, not B — Peter's state in C must match where A left him, even though B sits between them.

**The algorithm:**

1. **Build a per-character state timeline.** For each character in the scene, walk through every shot in order. For each shot where the character is on-camera, record:
   - **Opening state:** Where they are, what posture, what they're holding, which direction they face
   - **Closing state:** Where the action leaves them at the end of the shot

2. **Find state gaps.** For each on-camera appearance after the first, compare the opening state against the closing state of the character's **most recent on-camera shot** — which may be one, two, or more shots back if intervening shots are inserts, cutaways, or CUs of other characters. If the states don't match — the character was kneeling and now they're standing, they were at a pew and now they're at the altar, they were holding a screwdriver and now their hands are empty — there is a gap.

3. **Bridge the gap in the action description.** The shot's Subject & Action (shot.md) and the video prompt's [Subject]/[Action] blocks must explicitly describe the transition: "Peter rises from kneeling at the pew, leaving the screwdriver on the seat. Walks back to the altar." Not just "Peter crosses back to the altar."

4. **The video prompt layer is the most critical.** The shot.md script can be somewhat implicit ("crosses back" implies he was elsewhere). But the Kling/Seedance video prompt must be fully explicit — the model sees only this prompt and the start frame. It has no memory of previous shots. Every physical transition must be spelled out: starting posture → movement → arriving posture.

5. **The nb-prompt.md inherits from the opening state.** Since the NanoBanana image captures frame 1 (static), it must show the character in whatever state they would be in at the start of the shot — which is the closing state of their previous on-camera appearance.

6. **Conformance gate — diff each prompt against its manifest row.** Steps 1–5 produce a correct timeline. They do NOT guarantee the prompts honor it. After the timeline is built, walk every on-camera shot and diff its manifest opening-state against the words actually in `shot.md` Subject & Action AND `nb-prompt.md` `[Action]`/`[Subject]`. The posture, position, held objects, and facing in the manifest must each appear **explicitly** in the prompt. **Silence is a failure, not just contradiction.** A prompt that says "his body torquing into the swing" while the manifest says "on his back, propped on one elbow" passes a contradiction check (nothing on paper conflicts) but FAILS conformance, because it omitted the grounded posture. The manifest's own ✔ ("the timeline chains correctly") is necessary but not sufficient — it proves the logic, not that the prompts match the logic. This gate catches the highest-frequency real failure: the right state was known and simply never written into the prompt.

7. **Model-default (prior) check.** For each shot, ask: *if I left this unstated, what would the image model default to for this subject + action?* The model fills any unspecified slot with its training prior, and that prior is **not neutral** — it pulls toward two defaults:
   - **Default posture/position:** "heavy man swinging a rock" → standing batter's stance; "person at a desk" → seated upright; "figure in a doorway" → standing centered.
   - **Beautification drift:** the model quietly slims, straightens, de-ages, and fitness-improves a body — *worst as the character goes vertical or active*. A deliberately overweight/hunched/unflattering character drifts toward fit/average unless the build is positively re-asserted **every shot**. A character reference / Kling Element locks **identity (face, wardrobe), not pose and not reliably build** — restate the build in words; do not trust the reference to hold the body.

   **The fix is POSITIVE phrasing first.** State the correct posture AND build as positive present-tense physical clauses ("hips, backside and legs in full contact with the floor, not risen"; "heavy soft belly straining the t-shirt, body unchanged, only the posture lifts"). Do **not** lean on the negative prompt to do this on a NanoBanana/Gemini still — those models are autoregressive/conversational and expose **no true negative-prompt parameter**; Google's guidance is "describe positively, don't list exclusions," and a `standing` negative there is a weak hint that can even introduce the concept. A negative line on a `platform: nanobanana` prompt is a low-weight backup only — crowd the wrong default out with an explicit positive assertion. (Negatives ARE supported and worth using at the **Kling/Seedance video stage**, but still positive-anchor pose/build/held-object in the motion prompt.) The prior is strongest right after an insert (last full-body anchor ≥2 shots back) and on any action that reads as default-standing (swing, throw, reach, lift, strike) or any beat whose drama depends on an unflattering/grounded body.

8. **Action-target presence check.** A **transitive** action directed AT something needs its target in the frame. If a shot's action strikes / reaches for / looks at / pushes / aims at something, that something must be in the shot's `elements:` and described in `[Subject]`/`[Action]` — else the model renders the action against **empty space**. This is the inverse of the object audit (Step 7b, which catches a target *appearing from nowhere*): here a target that was present in the prior shot, is still the object of the action, gets **silently dropped** from the continuation. Most dangerous with **concealed** targets — the instinct to omit a hidden creature/threat to keep it hidden removes the action's anchor. Keep it present as the little that's shown ("a shapeless shadow-mass looming above, no anatomy"); preserve concealment positively (step 7 above) and hide only the *impact* via the cut. **Exceptions (absence is deliberate):** fleeing an unseen pursuer (threat off-frame behind, by design), or addressing a disembodied/intentionally-absent presence (a voice with no source, an intentional void) — there the empty space reads as intentional, not broken; do not invent a target. Worked example: 3C — Hale swings up from the floor continuing 3A (creature looming over him); the first pass dropped the creature from 3C and negated `visible creature`, leaving him striking air. Fix: re-add the creature as an above-frame shadow-mass; suppress only the *reveal* (lit anatomy/eyes), not the presence. Contrast 4B (Hale speaks to the empty dark) — that void is intentional and correctly stays empty.

**What to check:**
- Position changes: character was at location A, now at location B → bridge the movement
- Posture changes: kneeling → standing, sitting → walking → describe the transition
- Held objects: was holding X, now holding Y or nothing → show the put-down / pick-up
- Facing direction: was facing the altar, now facing the nave → describe the turn

**Common miss patterns:**
- Script says "crosses back to X" without saying where from
- Character was in a complex pose (kneeling, bent over) but next shot starts with them standing — the rise is missing
- An insert shot (CU of phone buzzing) breaks the visual continuity — the shot after the insert must resume from the pre-insert physical state, not from a default standing position. The gap may span multiple shots: A (Peter kneeling at pew) → B (insert of phone) → C (Peter again) — C bridges from A, two shots back
- Multiple intervening shots: in dialogue scenes, one character's reaction shots may separate another character's on-camera appearances by 3-4 shots. The bridge must still connect to the last shot where THAT character was visible
- Character was mid-task (fixing a hinge) but the action continuation doesn't reference the task ending or being interrupted
- **Silent under-specification (the manifest was right, the prompt was empty).** The manifest correctly logged the opening state, but the prompt never restated it, so the model filled the gap with its default. Worked example: 3A (Hale on his back, pinned) → 3B (ECU insert of his hand grabbing a shard) → 3C (he swings). The manifest logged 3C as "on back, propped on one elbow, rising to strike." But `3C/nb-prompt.md` said only "his whole body torquing forward as his arm whips the shard" — no grounding cue. Nothing on paper contradicted 3A, so a contradiction-only audit passed it. nanobanana then rendered the strongest prior for "heavy man swinging a rock" — a fully standing batter's stance. This broke continuity (3A floor → 3D "frozen low, shard raised" both bracket a sudden stand) AND spoiled the scene's payoff (5C is THE MARK, his first full-height rise — standing in 3C pre-empts it). Caught by neither the timeline build (which was correct) nor a contradiction scan, only by the conformance gate (step 6: prompt omitted the manifest posture) and the model-default check (step 7: "swing" defaults to standing, so it needed an explicit floor cue + `standing` in the negative prompt). After an insert this is doubly likely — the writer has the insert (hand + shard) fresh in mind and the last full-body anchor sits two shots back. The same shot also exposed **beautification drift**: even with his character Element attached, Hale rendered noticeably slimmer than his "noticeably overweight" canon — two defaults (standing + slimmer) firing at once, because going vertical/active triggers both. The prompt had to positively re-assert the heavy build AND the grounded posture; the negatives alone (on a NanoBanana still) would not have held either.

### Step 7d: ACTION DENSITY AUDIT

A shot that reads as one dramatic beat in the script may contain too many discrete physical actions for a single AI video generation. "Peter crosses back to the altar, picks up the phone, reads the screen, his expression softens" is one narrative unit but five physical beats: rise, walk, pick up, read, react. No 5-second Kling generation handles that cleanly.

**The principle:** Each shot's action must be achievable by the AI video model within the shot's duration. When a shot packs too many distinct physical beats, split it into sub-shots — each with one clear dramatic function.

**The algorithm:**

1. **Decompose the action into discrete physical beats.** A beat is one change in body state or position: stand up, walk, turn, reach, pick up, put down, sit, kneel, read, react. Count them.

2. **Apply the capacity rule:**

| Duration | Beats | Verdict |
|----------|-------|---------|
| 2-3s | 1 | Safe |
| 3-5s | 1-2 | Safe |
| 3-5s | 3 | Review — can they flow as one continuous motion (e.g., walk + sit + sigh)? If not, split |
| Any | 4+ | Split mandatory |

3. **Split by dramatic function.** Each sub-shot should serve one clear purpose:
   - **Movement shot:** Character changes location (rise + walk)
   - **Insert shot:** Object interaction close-up (hand picks up phone)
   - **Reaction shot:** Emotional response (reads, expression shifts)

4. **Naming convention:** When splitting, append a suffix to preserve shot ordering: `1E` → `1E-1`, `1E-2`, `1E-3`. Document the split rationale in each sub-shot's Notes.

5. **Verify the split doesn't lose dramatic value.** The original beat had a purpose — the split must preserve it. Three shots showing "rise, pickup, react" still tell the same story as the monolithic original, but each is now achievable by the model. If a split would drain the moment of its power (e.g., splitting an embrace from the reaction to it), keep it together and accept the generation risk.

**Why this audit exists separately from risk evaluation:** The risk matrix (Step 4) flags broad categories — "complex motion," "hands passing objects." It catches the TYPE of action that's hard. This audit catches the QUANTITY of actions — shots that individually are all low-risk but collectively overwhelm a single generation. A rise is low-risk. A walk is low-risk. A pickup is low-risk. A facial reaction is low-risk. All four in one 5-second shot? That's not a risk-type problem — it's an action-density problem.

**Common miss patterns:**
- Script describes a continuous sequence as one sentence: "He crosses back, picks up the phone, and reads it" — three beats disguised as one narrative moment
- Character transitions between two activities: "finishes fixing the hinge, stands up, walks to the altar" — the finishing, standing, and walking are three separate physical beats
- Emotional progression bundled with physical action: "picks up the letter, reads it, his face falls" — the physical action and the reaction are separate generation challenges
