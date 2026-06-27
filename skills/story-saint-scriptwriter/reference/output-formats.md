# Output Formats

## Table of Contents
1. Beat Sheet
2. Shot List
3. Storyboard Brief
4. Director's Notes

---

## 1. Beat Sheet

The beat sheet captures the dramatic structure of a scene or film. It is the foundation from which all other outputs derive.

**Format:**

```
TITLE: [Film/Scene Title]
THROUGHLINE: [Superobjective as active verb phrase]
STARTS BECAUSE: [Concrete external disordering event]
ENDS WHEN: [Condition for order restored — achieved or denied]

BEATS:
1. [Verb phrase] — [one-sentence description of the step]
2. [Verb phrase] — [one-sentence description of the step]
3. [Verb phrase] — [one-sentence description of the step]
...
```

**Example:**

```
TITLE: The Retraction
THROUGHLINE: To get a retraction from the instructor
STARTS BECAUSE: The student received an unjust grade
ENDS WHEN: The retraction is granted or categorically denied

BEATS:
1. To arrive early — The protagonist shows commitment by being first to arrive
2. To prepare — The protagonist readies his case materials
3. To pay homage — The protagonist shows deference to the authority figure
4. To present the case — The protagonist puts his prepared argument before the instructor
5. To receive judgment — The authority weighs the case
6. To receive the retraction — Order is restored; the grade is changed
```

**Validation checklist for beat sheets:**
- Every beat is an essential step (remove it and the story breaks)
- No beat repeats another beat (no circularity)
- Each beat is at the same level of abstraction
- Each beat serves the superobjective
- The previous beat provides a natural lead-in to the next
- The sequence has a clear cap/endpoint

## 2. Shot List

The shot list translates each beat into a sequence of uninflected images.

**Format:**

```
BEAT: [Beat name from beat sheet]
IDEA: [The single idea this beat must convey]

SHOTS:
  1. [Simple image description — what we SEE, no emotion/narration]
  2. [Simple image description]
  3. [Simple image description]

---
```

**Example:**

```
BEAT: To arrive early
IDEA: Earliness

SHOTS:
  1. A man walks down an empty hallway
  2. Close-up: a hand turns a doorknob — it doesn't open
  3. The man sits down on a bench outside the door

---

BEAT: To prepare
IDEA: Preparation

SHOTS:
  1. The man opens a three-ring binder on his lap
  2. Insert: hands rip a perforated tab from a piece of white cardboard
  3. Insert: a pen writes something on the tab (we do NOT see what)
  4. Insert: the tab is inserted into a plastic divider
  5. The man closes the binder

---
```

**Rules for shot descriptions:**
- Maximum 12 words per shot description
- No adjectives that convey emotion (not "nervously," not "respectfully")
- No information that cannot be photographed
- Simple adverbs of manner are acceptable ("quickly," "slowly")
- Each shot is ONE image — if you need "and" you probably need two shots
- Note what is deliberately NOT shown (e.g., "we do NOT see what he writes")

## 3. Storyboard Brief

The storyboard brief translates the shot list into descriptions suitable for AI image generation tools. Each shot becomes a frame description that can be fed to Midjourney, Kling, NanoBanana, or similar tools.

**Format:**

```
SCENE: [Scene/beat name]
FRAME [N]:
  DESCRIPTION: [Visual description of what's in frame]
  FRAMING: [Shot type — wide/medium/close-up/insert/POV]
  KEY ELEMENT: [The one thing the audience MUST notice]
  TRANSITION NOTE: [How this frame juxtaposes with the next]

---
```

**Example:**

```
SCENE: To arrive early
FRAME 1:
  DESCRIPTION: A man in simple clothes walks down a long, empty corridor. Institutional walls. No decoration.
  FRAMING: Medium-wide, slightly behind the figure
  KEY ELEMENT: The emptiness of the hallway (conveys earliness)
  TRANSITION NOTE: Cut to close-up of his hand

FRAME 2:
  DESCRIPTION: A hand grips a metal door handle and turns it. The door does not open.
  FRAMING: Close-up on hand and handle
  KEY ELEMENT: The locked door (the attempt, the resistance)
  TRANSITION NOTE: Cut to wider shot

FRAME 3:
  DESCRIPTION: The man sits on a wooden bench beside the closed door. The hallway is empty.
  FRAMING: Medium shot, bench centered
  KEY ELEMENT: The solitude — one person, empty space
  TRANSITION NOTE: End of beat. Cut to preparation beat.

---
```

**Guidelines for storyboard briefs:**
- DESCRIPTION should be concrete and visual — what a camera would capture
- Keep descriptions to 1-2 sentences
- FRAMING helps the AI tool with composition
- KEY ELEMENT tells you (and the AI tool) what matters most in this frame
- TRANSITION NOTE maintains the montage logic across frames
- Never include character emotions or narrative context in DESCRIPTION
- Include notes about what is NOT shown when relevant

## 4. Director's Notes

Director's notes capture what to tell the "performer" (human actor or AI tool) and what NOT to do. Based on Mamet's principle that actors should perform simple physical actions without emotional inflation.

**Format:**

```
BEAT: [Beat name]
ACTION: [The simple physical action to perform]
DO: [Specific, concrete instruction]
DO NOT: [What to avoid — emotional inflection, narration, etc.]
NOTE: [Any structural context the director needs to remember]
```

**Example:**

```
BEAT: To arrive early
ACTION: Walk to a door. Try the door. Sit down.
DO: Walk at a normal pace. Turn the handle once. Sit.
DO NOT: Walk "nervously" or "anxiously." Do not look at a watch. Do not act "early" — the structure conveys earliness, not the performance.
NOTE: The idea of earliness comes from juxtaposition (empty hall + locked door + sitting alone), not from the actor's behavior.

BEAT: To pay homage
ACTION: Hear footsteps. Stand up.
DO: Turn head toward sound. Stand up from seated position.
DO NOT: Stand up "humbly" or "reverently." Do not bow. The juxtaposition of distant feet and the act of standing creates homage without inflection.
NOTE: The feet in the hallway should be distant — the fact that the protagonist hears them anyway is what creates the sense of attentiveness/homage.
```

**Purpose of Director's Notes:**
- They prevent "inflation" — the tendency to make each moment carry the weight of the whole scene
- They translate Mamet's directing philosophy into concrete do/don't instructions
- For AI video: they help craft prompts that avoid over-stylization and keep the imagery uninflected
- They serve as a reality check: if the direction requires emotional performance to work, the structure is probably wrong
