# Short-Form (15-90s AI-Animated Pieces)

For vertical Shorts, episodic series, sketch packs and any AI-animated micro-narrative. Long-form work uses `methodology.md` and `style-rules.md`; short-form adds the constraints below.

---

## VISUAL STORYTELLING FIRST

- The story must work with on-screen text alone. The viewer is on mute by default.
- One focal point per frame.
- Specify expressions precisely. Not "sad" but **"eyes downcast, shoulders collapsed, hand slowly releasing an object."**

---

## ON-SCREEN TEXT

- 5-10 words max per card.
- Text should ADD to the visual, not describe it.
- 1.5-2.5 seconds per card.
- The card and the visual together = the line of dialogue.

---

## PACING

| Length | Beats | Constraints |
|---|---|---|
| 15s | 5-7 beats | No shot longer than 3s. |
| 30s | 10-15 beats | No shot longer than 4s (one exception allowed). One slower breathing moment allowed. |
| 60s | 20-25 beats | No shot longer than 5s (one exception allowed). Room for one slow-down and one acceleration. |
| 90s | 25-35 beats | No shot longer than 6s (one exception allowed). Mini three-act with a breathing moment. See `video-dramaturgy.md` § 10 (Three-Layer Storyboard Method → Layer 1 — Dramatic Beats) for the 60-90s arc template. |

A new visual stimulus every 2-3 seconds as the default rhythm. Exception: emotional beats (grief, dignity, contemplation) may hold 4-5s — but the hold must be earned by the surrounding pace, not a default.

---

## FORMAT SELECTION

- **15s:** One hook + one beat + one payoff. 2-3 scenes. Single joke / twist / gut-punch.
- **30s:** One hook + two escalating beats + payoff. 3-5 scenes. The workhorse format.
- **60s:** Mini three-act structure. 5-8 scenes. For pilots, slow-builds, multi-character dynamics.
- **90s:** Full three-act with a breathing moment. 8-12 scenes. For complex emotional arcs and pieces with setup/payoff depth. Use the 60-90s arc template in `video-dramaturgy.md` § 10 (Three-Layer Storyboard Method → Layer 1 — Dramatic Beats).

---

## ENDING PATTERNS

Pick one and commit:

- **Hard Cut to Black** — abrupt silence after the punchline beat.
- **The Loop** — the last frame ties to the first; perfect for autoplay.
- **Emotional Linger** — hold a still face for 1-2s after the climax line.
- **Cliffhanger** — promise of more (good for series).
- **The Question** — leave the viewer with a one-line text card asking them.
- **Resolution + Tease** — wrap the story, hint at the next.

---

## SERIES ARCHITECTURE

- **Episode arc** — standalone Promise → Progress → Payoff that satisfies on its own.
- **Series arc** — ongoing thread that gives a reason to follow.
- **Recurring hooks** — visual / audio motifs that signal "this is from that series."
- **Entry points** — any episode must be watchable standalone. No required prerequisites.

---

## CHARACTER VISUAL IDENTITY

For animated short-form characters:
- 2-3 signature visual traits.
- Distinct silhouette (recognisable in shadow).
- Signature expression.
- Consistent colour palette.

These traits anchor the AI image generators across shots.

---

## HOOK ENGINEERING

The first 1-3 seconds determine whether the viewer stays. Design three layers:

1. **VISUAL HOOK** — the opening frame. Must be unusual or charged.
2. **TEXT HOOK** — the first card if any. 3-7 words. A question, an unfamiliar claim, a tension.
3. **AUDIO HOOK** — the opening sound. Music drop, hard cut from silence, distinctive voice.

Stress test the hook by asking: **"Would I stop scrolling for this?"** If unsure, the hook is weak.

---

## COMEDY AND HUMOUR

- Payoff in comedy is a laugh. The setup must feel like it's going one direction so the punchline can go another.
- **Timing:** hold the "before" frame 1.5-2s, cut for punchline, 0.5s freeze on reaction. The punchline should land between seconds 10-13 in a 15s Short.
- **Rule of three at Short scale:** establish a pattern with two beats, break on the third.
- **Contrast** is the engine of visual comedy.
- Comedy hooks create an *expectation gap*, not a *curiosity gap*.
- For standalone jokes, ask: Is the setup clear? Is the punchline unexpected? Is the timing right?

---

## AI ANIMATION CAPABILITIES & CONSTRAINTS

During story development, **avoid suggesting beats that require complex AI animation.** Suggest cinematic workarounds: aftermath shots, reaction shots, dramatic stills, sound design, hard cuts, silhouettes.

### HIGH RISK patterns — rewrite at story stage, not at script stage

| Pattern | Workaround |
|---|---|
| Two hands passing an object between them | Wide shot with light spreading outward; skip the contact moment |
| A figure descending through lightning or storm | Storm as pure presence and force, no body or figure |
| Objects wrapping around a character (chains, vines, ropes) | Cut: object already locked, tightening mid-action |
| Two characters physically interacting in the same frame (wrestling, fighting, embracing) | Generate each separately, cut between close-ups |
| A character reaching into something and grasping it | Start mid-action, object already in hand |
| Running, fast movement | Replace with walking, silhouette, or aftermath shot |
| Lip sync / speaking characters | Text cards over visuals, or VO over a non-speaking shot |
| 2D flat staging with character motion | Seedance preferred (respects flat plane better than Kling); reinforce with explicit "perpendicular to action plane" instruction |

### Element budget

Most current AI video tools (Kling and similar) allow **max 3 elements per generation batch**. Multiple elements can exist in the story, but no single batch can exceed 3. Plan the batch breaks at story stage — not at production.

### Flashback and time-shift

Define the visual style anchor for each timeline at story stage:
- **PRESENT style** (e.g. cool blue, sharp focus)
- **MEMORY style** (e.g. warm desaturation, vignette edges)

Without explicit anchors, the editor can't cut the timeline cleanly.

### Pre-flight checklist (before SCRIPT MODE)

- [ ] Every shot mapped to a preliminary `asset_type`: `kling | seedance | still | kling-reuse`. This is a first-pass assignment — it may be revised during storyboard batching (Step 8b) after risk evaluation.
- [ ] Every HIGH RISK shot has a confirmed cinematic workaround (not "we'll figure it out later").
- [ ] Style anchors defined per timeline layer.
- [ ] Element list written, with batch breaks marked.
- [ ] No batch exceeds its tool's reference cap — Kling: max 3 Elements per generation; Seedance 2.0 on OpenArt: references subjects/worlds by `@Name` element (same elements as Kling), with `@image1` reserved for the start frame.
- [ ] Lip sync replaced everywhere — use Talking Shot Strategies from `animation-prompts.md` (profile shot, back of head, reaction coverage, wide shot, environmental cutaway, or text card).
- [ ] **Staging constraints flagged.** Any shot requiring forced perspective, profile-only framing, or 2D flat staging is tagged. Flat staging with character motion is HIGH RISK.
- [ ] **Cross-shot consistency assessed.** Any shot that must visually match 3+ other shots in sequence is tagged (drives Seedance `@Name` element or Kling multi-shot grouping decisions downstream).
- [ ] **Anatomical specificity checked.** Prosthetics in motion, specific medical detail, or fine hand/finger work is tagged.

Pre-flight is a first-pass filter. The full 11-factor risk matrix runs at both the storyboard stage (`storyboard.md` Step 4) and the prompt generation stage (`animation-prompts.md` → Shot Risk Evaluation) and may reclassify shots at either stage. Do not consider script lock permanent until the storyboard risk evaluation is complete.

Do not enter SCRIPT MODE until every box is checked.

---

## SCRIPT FORMATS FOR SHORT-FORM

### COMPACT FORMAT (15s)

```
[Project] — 15s
HOOK: [visual + text]
PAYOFF: [the line / image / cut that lands]

Beat 1 (0-3s) — VISUAL: ... | TEXT: ... | AUDIO: ...
Beat 2 (3-7s) — VISUAL: ... | TEXT: ... | AUDIO: ...
Beat 3 (7-12s) — VISUAL: ... | TEXT: ... | AUDIO: ...
Beat 4 (12-15s) — VISUAL: ... | TEXT: ... | AUDIO: ...

Ending pattern: [hard cut / loop / linger / question / tease]
```

### FULL FORMAT (30s / 60s / 90s)

```
[Project] — 30s
LOGLINE: [one sentence]
PROMISE / PROGRESS / PAYOFF: [three sentences]

SCENE 1 — [LOCATION] — [TIME]
  VISUAL: ...
  TEXT: ...
  AUDIO: ...
  CHARACTER MOTION: ...
  CAMERA MOTION: ...
  DURATION: 4s
  BEAT: [hook]
  TOOL: Kling / Seedance / Still / Kling-reuse
  RISK: LOW / MED / HIGH (workaround if HIGH)

SCENE 2 — ...
...
```

---

## STORYBOARD HANDOFF (after script lock)

Once the script is locked, the user may ask for a TSV storyboard and per-shot prompt files for visual production. The canonical format is defined in `storyboard.md` — read that file for the full TSV column spec, PromptSync directory structure, and `nb-prompt.md` per-shot file format.

**Quick reference — TSV columns:** Shot, Place/Setting, Emotion, Shot Type, Camera Movement, Duration, Color & Mood, Subject & Action, VO/Lines, SFX/Audio, Shot image, Notes.

**Quick reference — per-shot files:** `storyboard/shots/{code}/shot.md` (metadata) + `storyboard/shots/{code}/nb-prompt.md` (NanoBanana image prompt).

Key short-form considerations for the storyboard:
- Emotion column maps to camera language (`reference/cinematography.md`) and color/palette (`reference/nanobanana-artistry.md`)
- For 9:16, favor vertical movements and vertical composition strategies (see `reference/cinematography.md` — 9:16 Vertical Format)
- For physical effort/interaction, include physics cues in Subject & Action (see `reference/kling-reference.md` — Dynamic Physics)
- Group shots into batches by shared elements (max 3 elements per batch)

---

## COMMON PITFALLS (FLAG THESE)

- Worldbuilding before story
- Passive protagonist
- Cool moment without setup (Sanderson's First Law)
- Starting with exposition
- Tone whiplash
- Overstuffing (Sanderson's Third Law — one well-explored idea beats five shallow ones)
- Twist that cheats the promise
- Dialogue crutch (using VO to paper over weak visuals)
- Sequel-baiting without substance
- Copycat syndrome
- Beautiful nothing (gorgeous frames, no story movement)
- Weak hook
- Flaw amnesia (character's flaw forgotten mid-piece)

---

## RULES SPECIFIC TO SHORT-FORM

- Recommend the right format. If a 60s idea is really 15s padded with filler, say so.
- Don't suggest beats requiring complex AI animation. Always suggest cinematic workarounds.
- Run pre-flight before SCRIPT MODE. Do not write the final script until every HIGH RISK shot has a confirmed workaround.
- Prefer visual storytelling over dialogue.
- Always ask: "Will this make someone stop scrolling?" and "Will this make someone follow for more?"
- Protect the user's original voice. Help them execute their weird idea well.
