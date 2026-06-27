# Output Format: The Storyboard Specification

## What the User Gets

When a user feeds a script into this skill, the output is a **numbered shot-by-shot storyboard** with structured data for each panel. This format is designed to be:
- Directly translatable into AI image generation prompts (Midjourney, NanoBanana, Kling, etc.)
- Readable as a production document
- Sequentially coherent (any filmmaker could shoot from this)

---

## Output Structure

### Header Block (once per scene)

```
## SCENE: [Scene heading from script]
**Location:** [INT/EXT, specific place]
**Time:** [Time of day / lighting condition]
**Characters:** [List with brief physical/costume notes if relevant]
**Mood/Tone:** [1-2 words from dramatic analysis]
**Scene Purpose:** [1 sentence from Step 2, Q1]
**The Turn:** [What changes and at which shot number]
```

### Shot Block (repeated for each shot)

```
### SHOT [number]

**Size:** [ELS / WS / MS / MCU / CU / ECU]
**Angle:** [Eye level / Low angle / High angle / Dutch / Overhead]
**Camera Height:** [approximate: ground level / 3ft / eye level (5ft) / 7ft / overhead]
**Lens:** [Wide (24-35mm) / Normal (50mm) / Telephoto (85-200mm)]
**Movement:** [Static / Pan L→R / Dolly in / Dolly out / Track L→R / Crane up / etc.]

**Frame Description:**
[Detailed visual description of what is IN THE FRAME. Written as if describing a photograph.
Include: subject position (left/center/right, foreground/middleground/background),
body language, facial expression if visible, environment visible, lighting quality,
depth of field (what's sharp, what's soft). This description should be usable as
an image generation prompt with minimal modification.]

**Action:**
[What happens DURING this shot. Movement of characters, gestures, physical business.]

**Dialogue/Sound:**
[Any dialogue spoken during this shot. Sound effects. Music cues.]

**Edit → Next:**
[How this shot connects to the next: "Cut on action as she turns" / "Dissolve to" / "Hard cut" / etc.]

**Narrative Function:**
[Q: what question does this raise? / A: what question does this answer? / Setup for shot X / Reaction to shot X]
```

---

## Formatting Rules

### Shot Numbering
Sequential within the scene: 1, 2, 3, etc.
If a scene has distinct phases (e.g., ESTABLISHING → DIALOGUE → REVEAL), note the phase transition with a brief separator.

### Frame Description Guidelines
The frame description is the most important field — it's what gets converted into image generation prompts.

**Always include:**
- Subject size relative to frame (fills the frame / occupies left third / small figure in vast space)
- Camera-to-subject relationship (we're looking up at / we're at eye level with / we're looking down on)
- Depth information (foreground element X, middleground character Y, background Z)
- Lighting direction and quality (harsh overhead / soft ambient / single source from left / silhouette)
- Aspect ratio implication (use the full width for scope / vertical emphasis for power / tight crop for intimacy)

**Never include:**
- Edit instructions in the frame description (those go in Edit → Next)
- Emotional interpretation without visual grounding ("she looks sad" → "her eyes are downcast, shoulders slumped")
- References to previous or next shots ("we now see" → just describe what's in THIS frame)

### Conciseness
Each field should be 1-3 sentences maximum. The frame description can be up to 5 sentences for complex compositions. If you need more, the shot is probably too complex — split it.

---

## Example Output

```
## SCENE: INT. KITCHEN — MORNING
**Location:** INT, small suburban kitchen, 1970s decor
**Time:** Early morning, warm natural light from window
**Characters:** FATHER (40s, dressed for work), BOY (10, pajamas)
**Mood/Tone:** Bittersweet, routine
**Scene Purpose:** Establish the father-son morning ritual that will be disrupted
**The Turn:** Shot 5 — Father finds the boy's lost sneaker, revealing the pattern of forgetfulness

---

### SHOT 1

**Size:** WS
**Angle:** Slightly high angle (looking down into the yard)
**Camera Height:** ~8ft (elevated, as if from second-floor window)
**Lens:** Normal (50mm)
**Movement:** Static, then slow pan right to follow Father

**Frame Description:**
A quiet suburban house in morning light. The front yard is slightly overgrown.
FATHER exits the front door in the center of frame, briefcase in hand, and
walks right toward the detached garage. The house fills the left two-thirds
of the frame; trees and neighboring rooftops fill the background. Warm,
golden morning light rakes across the lawn from camera left.

**Action:**
Father exits house, walks briskly toward garage. Halfway across the yard,
he notices something in the grass and slows.

**Dialogue/Sound:**
Birds. A distant lawnmower. The click of the front door closing.

**Edit → Next:**
Cut on Father's downward glance to Shot 2.

**Narrative Function:**
Q: What is the father's morning routine? What did he notice in the grass?

---

### SHOT 2

**Size:** CU
**Angle:** High angle (looking down at the ground)
**Camera Height:** ~4ft (Father's approximate eye level looking down)
**Lens:** Normal (50mm)
**Movement:** Static

**Frame Description:**
A child's sneaker lying in the dewy grass, morning light catching the
white rubber sole. Blades of grass partially obscure the shoe. Shallow
depth of field — the grass in the immediate foreground is soft, the
sneaker is sharp, the background lawn blurs into green.

**Action:**
Father's hand enters frame from above and picks up the sneaker.

**Dialogue/Sound:**
Father sighs.

**Edit → Next:**
Cut to Shot 3 as Father straightens up.

**Narrative Function:**
A: He noticed his son's lost sneaker. Q: How will he react? (Establishes
the forgetfulness theme.)

---

### SHOT 3

**Size:** MS
**Angle:** Eye level
**Camera Height:** 5ft
**Lens:** Normal (50mm)
**Movement:** Static

**Frame Description:**
FATHER in medium shot, facing camera at a slight angle. He holds the small
sneaker in one hand, briefcase in the other. Behind him, the house is
softly out of focus. His expression shifts from mild irritation to weary
affection — he's seen this before. Morning light models his face from
camera left.

**Action:**
Father looks at the sneaker, shakes his head slowly, then looks up toward
the boy's bedroom window (offscreen, camera right and up).

**Dialogue/Sound:**
Silence. Then, faintly, from inside the house — an alarm clock.

**Edit → Next:**
Cut on Father's look upward to Shot 4 (the boy's room).

**Narrative Function:**
A: Father reacts with familiar exasperation. Q: What is the boy doing?
(Cut on the look — classic Q&A.)
```

---

## Adaptation for AI Video Pipeline

When the user's pipeline involves AI image/video generation (Midjourney, NanoBanana, Kling, etc.):

### Key Adjustments
1. **Frame Description becomes the prompt seed.** Write it as a self-contained visual description that could generate the image without any other context.
2. **Camera movement may need to be simplified.** AI video tools handle static or simple moves better than complex choreography. Prefer cuts between static compositions over dolly/crane instructions.
3. **Depth of field and lens effects should be described visually** ("background softly blurred," "everything sharp from foreground to background") rather than with technical specs the AI won't understand.
4. **Lighting is critical to describe** — AI tools respond well to lighting direction and quality descriptions.
5. **Consistent character descriptions** across shots matter more than in traditional storyboards because each shot is independently generated. Anchor character identity with repeated visual markers (clothing, hair, distinctive features).

### Prompt-Ready Frame Description Template
```
[Shot size] [angle] view of [subject] in [location].
[Subject position in frame] [body language/expression].
[Key foreground/background elements].
[Lighting description]. [Atmosphere/mood descriptor].
[Aspect ratio if non-standard]. [Style reference if applicable].
```
