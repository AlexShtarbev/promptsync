# Shot Flow and Editing Design

## Q&A Narrative Structure

Every shot either RAISES a question or PROVIDES an answer (or both). This is the fundamental logic of editing.

### The Basic Patterns

**Pattern 1: Q → A (Standard)**
Shot of person looking → Shot of what they see.
Simplest and most common. Direct cause-and-effect.

**Pattern 2: A → Q (Suspense)**
Show the bomb under the table → Show people sitting at the table.
Audience knows something the character doesn't. Creates unbearable tension.

**Pattern 3: Q → delay → A (Tension)**
Raise the question, insert unrelated or partially-related shots, answer later.
The delay creates anticipation. The longer the delay, the more tension.

**Pattern 4: Multiple Q in one shot (Density)**
A single composition contains several unanswered narrative threads.
Dense, rewarding for attentive viewers. Risk: confusion if overdone.

**Pattern 5: A that creates new Q (Chain)**
Each answer immediately opens a new question. This is how sequences sustain momentum — an overlapping chain of Q&A like fanned-out cards.

### Application to Scene Turns

At the scene's turn (the moment things change), the Q&A pattern should shift:
- If building to a reveal: sustained Q → decisive A at the turn
- If building suspense: A given early → escalating Q about consequences
- If surprise: No Q at all → sudden A that recontextualizes everything before it

---

## Shot Flow: Size and Angle Sequencing

### Progressive Flow
Each shot increases in one direction: tighter, higher, more angled. Creates smooth forward momentum. Good for:
- Approaching a location
- Building emotional intensity
- Moving toward a confrontation

### Non-Progressive (Conflicting) Flow
Shots contradict each other in angle or direction. More dynamic, jarring, energetic. Good for:
- Disorientation
- Psychological conflict
- Action sequences
- Establishing unease

### Rhythmic Principles

| Technique | Effect |
|-----------|--------|
| Progressively tighter shots, shorter duration | Tension building |
| Cut to a wider shot, held longer | Release, breath, pause |
| Abrupt jump in shot size (WS → ECU) | Shock, emphasis |
| Consistent shot sizes, even duration | Stability, calm, monotony |
| Alternating tight/wide | Dialogue rhythm, tennis-match energy |

---

## Establishing Strategies

### Strategy 1: Wide → Tight (Standard)
WS of location → MS of character → CU to begin scene.
Clear, efficient, unambiguous. The default when orientation matters.

### Strategy 2: Tight → Wide (Discovery)
ECU of detail → pull back/cut wider to reveal context.
Engages curiosity. The audience discovers the location along with the camera.

### Strategy 3: Detail Montage (Atmospheric)
Series of CUs that imply the whole:
- CU: dusty piano keys
- CU: cobweb on a window latch
- CU: faded family photo
- CU: cracked mirror
= Abandoned house, former family home. The audience assembles this.

This is the most narratively engaging because the audience does active interpretive work. Each detail also raises a Q about the story.

---

## Transitions Between Scenes

| Transition | Use When |
|-----------|----------|
| **Hard cut** | Continuous time; OR deliberate contrast between scenes |
| **Dissolve** | Time passage; thematic connection between scenes |
| **Fade to black** | End of act; major time gap; emotional full stop |
| **Match cut** | Visual or thematic rhyme (shape, motion, idea) |
| **Clear frame** | Subject exits frame → hold empty → new scene. Elegant time passage. |
| **Sound bridge** | Audio from next scene starts over outgoing image. Smoothest transition. |
| **Smash cut** | Abrupt hard cut for comedy or shock (peaceful scene → explosion) |

---

## Cutting on Movement

The invisible edit. Cut mid-action to hide the transition.

### Three Edit Points for Any Action
1. **Before the action** — Cut as character begins the move
2. **During the action** — Cut mid-movement (most common, most invisible)
3. **After the action** — Cut after character completes the move

### Overlap Rule
Always shoot action with overlap past the intended edit point. This gives flexibility to find the perfect cut frame.

### Strong Cutting Points (Stage Business)
Create clear physical actions that provide natural edit opportunities:
- Slamming a fist on a table
- Sitting down or standing up
- Opening/closing a door
- Picking up or putting down an object
- Turning to face someone
- Taking a drink

---

## Coverage vs. Camera Cutting (Decision Guide)

```
Is this a high-stakes scene where every shot has specific narrative purpose?
├─ YES → Camera cut. Design each shot. Accept the risk.
│
└─ NO → Is this a dialogue scene where performances might vary?
    ├─ YES → Get coverage (triangle system) PLUS your designed shots
    │
    └─ NO → Is this a simple transitional/establishing scene?
        └─ YES → Minimal coverage. One or two setups max.
```

For AI video production (the user's pipeline), camera cutting is the default because each "shot" is a separate generation. There is no "extra footage" — every frame is intentional.

---

## Setup Chains (Returning Coverage)

In coverage-style scenes the camera returns to the **same setup** several times — same subject, same angle, same **closeness**, same screen position — with reverse shots, cutaways, and inserts in between. Shots that share a setup form a **setup chain**. The chain, not scene order, is the unit of frame continuity.

Examples (a two-hander dialogue and a doorway scene):
- Hale's desk, MS: `3C → 3E → 3H` (every "MS, Hale behind the desk"). His tighter coverage forms a *separate* chain: `3J → 3M` (both "CU, Hale").
- Sarah at the door, MS: `4D → 4H` — she opens it (`4D`), then lets Peter in (`4H`); the intervening `4G` is a CU reaction (different closeness — see below).

**The start frame of a returning shot is the END frame of its chain predecessor — not the literal previous shot.** When the camera returns to Hale at `3E`, it returns to where `3C` left him; the intervening Peter shot `3D` is irrelevant to Hale's frame. So a same-setup return can **reuse its chain predecessor's last rendered frame as its I2V start frame** — perfect setup/lighting/identity carry, the new clip animating only the delta (hands settle on the blotter, he begins to speak). No fresh storyboard image is needed. Record the predecessor in the shot's `start_frame_shot` field; the first shot of each chain keeps `start_frame_shot: null` and is built from a fresh storyboard image.

**Different closeness is NOT a setup chain — it's state carry.** When the camera returns to the same *subject* at a different framing (`4G` CU Sarah → `4H` MS Sarah), there is no frame to reuse (the framing differs), so `start_frame_shot` stays `null`. This case is already handled by the **Step 6c action-continuity audit**: the returning shot's opening state must match the subject's most recent on-camera appearance (knuckles white on the doorframe → she releases and steps back), which may be several shots back. Setup chains add *frame* reuse on top of that existing *state* carry — they don't replace it, and they don't apply across a closeness change.

**Three returns, three mechanisms — don't conflate them:**
- *Visually identical* return (no new action) → reuse the whole clip: `asset_type: kling-reuse`, `reuses: {code}`.
- *Same setup, new action delta* (same subject + angle + closeness) → reuse only the predecessor's last frame as the start frame: `start_frame_shot: {code}`, generate a short new clip.
- *Same subject, different closeness* → no frame reuse; state carry via Step 6c, `start_frame_shot: null`.

**How to lay out chains.** After designing a scene's shots, group them by setup (subject + angle + closeness + position). For each group of 2+ shots, set every non-first shot's `start_frame_shot` to the previous shot in that group.

---

## Montage Sequences

### Purpose
Compress time. Show process, change, or accumulation without real-time pacing.

### Structure
- Each mini-shot is a complete visual statement
- No shot needs the previous shot to make sense
- The SEQUENCE as a whole tells the story (not individual shots)
- Duration per shot: short and consistent (2-5 seconds)
- Variation comes from content, not pacing

### Types
| Type | Example |
|------|---------|
| **Training montage** | Character improving at a skill over time |
| **Passage of time** | Seasons changing, clocks, calendars |
| **Emotional processing** | Character in different locations/activities, all showing the same emotional state |
| **Preparation** | Getting ready for the big event |
| **Deterioration** | Things getting progressively worse |

---

## The Self-Check Sequence

After designing a sequence, read through it imagining you're the audience seeing it for the first time:

1. **Geography test:** After the first 2-3 shots, do I know where we are and who's here?
2. **Orientation test:** If I cover any shot, can I predict roughly what angle/size the next shot will be? (If yes, it might be too predictable. If I'm totally lost, it might be too chaotic.)
3. **Engagement test:** At every shot, am I curious about what comes next? (If not, the Q&A chain is broken.)
4. **Reaction test:** Do I see characters RESPOND to events, or just do things? (Missing reactions = missing emotion.)
5. **Turn test:** Can I point to the exact shot where the scene changes? (If no clear turn, the scene may be flat.)
6. **Exit test:** Does the last shot leave me with a clear feeling or question? (Scenes should END, not just stop.)
