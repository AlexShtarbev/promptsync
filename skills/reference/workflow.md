# Workflow

How to operate with the user. Modes, edits, audits, iteration.

---

## FIRST MESSAGE HANDLING

- **Specific idea** → jump into Development Mode at the right step.
- **General greeting** → introduce yourself, ask what stories excite them, 2-3 questions.
- **Multiple ideas** → help them pick one. Which are they most excited about?
- **A finished draft** → enter Review Mode.
- **"Write scene N" / "script it"** → confirm context is loaded, then enter Script Mode.

---

## DEVELOPMENT STEPS

For long-form (feature, series) and short-form alike, the steps are the same. Depth differs.

1. **Idea Clarification.** Find the SPARK, CHARACTER, CONFLICT, desired ending FEELING. Distill to one sentence: *"[Character] must [action] or else [stakes], but [obstacle]."* This is the working logline.
2. **Story Structure.** Map Promise → Progress → Payoff (Sanderson) or 3-act with Inciting Incident / Crisis / Climax / Resolution (McKee). For series, sketch episode arc + series arc.
3. **Character Deepening.** Proactive / Relatable / Capable. Want / Need / Flaw. Hamartia. Visual identity (silhouette, signature trait).
4. **Scene Breakdown / Beat Sheet.** For each scene: VISUAL, TEXT, AUDIO, CHARACTER MOTION, CAMERA MOTION, DURATION, BEAT. For long-form: 3-5 sentence treatment per scene.
5. **Hook Engineering** (short-form especially). VISUAL HOOK, TEXT HOOK, AUDIO HOOK. Stress test: "Would I stop scrolling for this?"
6. **Pre-Production Lock.** Before writing the script, lock every creative decision through pre-mortem analysis. This step produces a `pre-production.md` file in the project directory. See details below. **Gate:** `pre-production.md` must be complete and all structural risks resolved before entering Script Mode.
7. **Pre-Flight (short-form).** Before writing the final script, run a shot-by-shot check against AI animation failure modes. See `short-form.md`. Do not enter Script Mode until all HIGH RISK shots are resolved.
8. **Script Output.** Check readiness, then produce in compact (15s) or full (30s/60s/feature) format. All HIGH RISK workarounds must be baked into the script — not left as notes for later.
9. **Production Pipeline (short-form).** After script lock, enter the production pipeline. See the PRODUCTION PIPELINE section below for the full phase breakdown (9a–9e): Character Design → Storyboard → Voice Design → Animation Prompts → Viral Extraction. Each phase has its own skill file and gate.
10. **Revision.** Use audit tags (below). For short-form: review platform analytics after publication (retention curve, completion rate, re-watch rate, follows generated, engagement ratio) to diagnose structural issues — e.g., a drop at second 3 means the hook failed; a drop at the midpoint means progress isn't escalating.

---

## WHEN THE USER ASKS FOR A SCENE

1. **Read the context.** If not loaded — synopsis, character bible, previous scenes.
2. **Check structural location.** What act? What McKee beat? What Campbell stage? What Sanderson beat?
3. **Think about every present character's arc** in this scene.
4. **Show ONE version** of the scene — Hollywood format, plain text in chat (monospaced).
5. **3-5 lines of analysis** under the scene:
   - What value enters → exits?
   - Which hamartia does it serve?
   - Potential red flags (repeat, weak causality, overload)?
6. **Ask what edits** — narrow question, not open.

**Do not show 5 versions.** One version + one argument.

---

## WHEN THE USER GIVES AN EDIT

1. **Targeted edit.** Don't rewrite the whole scene because of one line.
2. **Re-render the output** (artifact / docx) — only the file the user is looking at.
3. **Confirm in one sentence:** "Done — changed: [what]."
4. **Don't propose new edits from yourself.** Wait for the next request.

---

## WHEN THE USER PROPOSES AN IDEA

1. **Check it against the bible** and the established mythology first.
2. **If there's a conflict** — say so directly: "This contradicts [X] in the bible. I propose [Y] as a workaround."
3. **If it's compatible** — implement.
4. **If the new idea is stronger than the established canon** — propose changing the canon, not the scene.

---

## WHEN THE USER REJECTS ("doesn't work" / "no" / "not right")

1. **Don't over-apologise.** One "got it" is enough.
2. **Don't dump five more variants** trying to guess.
3. **Ask one question:** what specifically isn't working?
   - Direction?
   - Tone?
   - Tempo?
   - A specific line?
   - Logic of a character's behaviour?
4. **After the answer — one solution, not five.**

---

## WHEN THE USER WANTS TO CUT RUNTIME

1. **Calculate real time first** using `timing-and-cutting.md`.
2. **Don't trust "1 page = 1 minute" literally** for action sequences and montages.
3. **Show a per-scene breakdown** in a table.
4. **Find the easiest cuts** — repeats, parallel beats, breathing scenes.
5. **Give a concrete plan: "trim −X seconds from scene Y"** — not abstract "could be shorter."

---

## WHEN THE USER WANTS A CAUSALITY AUDIT

Read the treatment and for each scene answer:

- **Does each scene start with "because"?** (Scene N happened BECAUSE in scene N-1, X happened.)
- **If the scene starts with "after that" — that's a failure.** Good structure is causal, not chronological.
- **Mark sags with one of these tags:**
  - ⚠ **[CAUSALITY]** — scene doesn't follow from the previous one
  - ⚠ **[VALUE]** — scene doesn't move value, no +/– shift
  - ⚠ **[BIBLE]** — conflicts with character or world bible
  - ⚠ **[TEMPO]** — too slow or too fast for its function
  - ⚠ **[INFO DUMP]** — exposition through dialogue
  - ⚠ **[REPEAT]** — repeats something already established
  - ⚠ **[FLAW AMNESIA]** — the hamartia is forgotten in this scene

---

## WHEN YOU DON'T KNOW — ASK ONE BINARY QUESTION

If context is insufficient for a confident decision, **don't make it up**. Ask ONE narrow binary question.

- Bad: "What's the tone of the scene?" (open, overload)
- Good: "Is this hero protecting or using in this scene?" (binary, narrow)

The binary question is the best question. The user answers "protecting" — you have a direction. Only then do you write.

---

## PRE-PRODUCTION LOCK (Step 6)

Before writing the script, lock every creative decision that shapes the piece. Each decision is stress-tested through pre-mortem analysis (see `SKILL.md` — PRE-MORTEM ON EVERY CREATIVE QUESTION). The output is a `pre-production.md` file in the project directory.

### What pre-production covers

Every fork that shapes the piece must be decided and documented here — not during scripting, not during storyboarding. These decisions are locked before a single scene is written.

**Required sections:**

1. **Brand / Series Context** (if applicable). Brand promise, tonal register, series architecture, where this episode fits in the launch order. Skip if standalone.

2. **Controlling Idea.** One sentence in McKee's form: "Life becomes X when the hero does Y, because Z." This is the spine. Every subsequent decision must serve it.

3. **Creative Decisions — Pre-Mortem Locked.** For each creative fork (tone, recognition strategy, hook, transformation mechanic, escalation method, audio approach, ending pattern, and any story-specific forks), document:
   - The options considered
   - The failure scenario for each (using the failure vocabulary from SKILL.md)
   - Which option was selected and why it has the highest survival rate
   - Any execution risks that remain (to be solved in storyboard/production)

4. **Structure.** The beat-by-beat timing of the piece with approximate durations. Not a full script — a structural skeleton that shows where each beat falls, what emotional state it carries, and how the escalation works.

5. **Visual Grammar.** Staging rules, palette, camera approach, directional conventions, format (16:9 / 9:16). If carrying assets from a previous version, list what transfers and what doesn't.

6. **Character / Asset Inventory.** What characters, props, and environments exist. Whether designs are new or carried from prior work. What state they're in (draft / reference-done / element-created).

7. **Pre-Mortem Summary.** Two lists:
   - **Structural risks: RESOLVED** — risks that were eliminated by the creative decisions made above
   - **Execution risks: OPEN** — risks that remain and must be solved in storyboard, voice design, or production

### Gate

`pre-production.md` must be complete before entering Script Mode. All structural risks must be resolved. Execution risks may remain open — they're solved downstream — but they must be named.

### When to skip pre-production

- **Rapid Mode** compresses steps 1-5 into one exchange and skips pre-production (step 6). The trade-off is explicit: faster output, higher risk of structural failure. Rapid mode is for volume and iteration — ship fast, diagnose from analytics, refine later.
- **Long-form** uses pre-production for pilot episodes and structural turning points (season finale, mid-season pivot). Not every scene of a feature needs its own pre-production pass — the controlling idea and creative decisions are set once at the project level.

### Template

```markdown
# [Project Name] — Pre-Production

## Brand / Series Context
[Brand promise, tonal register, launch order position. Skip if standalone.]

## Controlling Idea
"[Life becomes X when the hero does Y, because Z.]"

What everyone thinks: [The surface reading]
What they forgot: [The forgotten meaning this piece recovers]

## Creative Decisions — Pre-Mortem Locked

### [Decision name, e.g. Tone]
**Options considered:** [list]
**Pre-mortem:** [failure scenario per option]
**Selected:** [winner and why]

[Repeat for each fork]

## Structure
[Beat-by-beat timing table]

## Visual Grammar
[Staging, palette, camera, format, directional conventions]

## Character / Asset Inventory
[Characters, props, environments. Status of each.]

## Pre-Mortem Summary
### Structural risks: RESOLVED
- [Risk] → [how resolved]

### Execution risks: OPEN
- [Risk] → [where it gets solved]

## Next Steps
[What happens after pre-production is approved]
```

---

## PRODUCTION PIPELINE (short-form, after script lock)

Steps 1–8 above cover story development through script output. For short-form AI-animated pieces, the production pipeline continues with these phases. Each phase has its own skill file — do not skip or reorder.

| Phase | What | Skill File | Gate |
|-------|------|-----------|------|
| **9a. Character Design** | Visual identity, reference images, Element/character lock for every recurring character | CHARACTER DESIGN MODE in `SKILL.md` (uses `templates/characters.template.md` + `reference/nanobanana-artistry.md`) | All characters `status: reference-done` |
| **9b. Storyboard** | TSV + PromptSync shot directories + NanoBanana image prompts. Optionally: environment plates for distinct visual worlds (storyboard.md Step 2b) | `storyboard.md` | All shots written and three-detail audit passed. Then: NanoBanana images generated → character consistency check passed (storyboard.md Step 9) → Kling Elements created in OpenArt for all Kling characters (storyboard.md Step 10). All three gates required before 9d |
| **9c. Voice Design** | Voice profiles, ElevenLabs settings, emotional state presets | `voice-design.md` | `voice_design.md` complete for all speaking characters |
| **9d. Animation Prompts** | Kling/Seedance video prompts, ElevenLabs script, Suno music blocks | `animation-prompts.md` | All prompts written, risk evaluated, quality checklist passed |
| **9e. Viral Extraction** (optional) | Clip extraction, campaign architecture, distribution strategy | `viral-extraction.md` | Main storyboard locked |

Voice design (9c) must complete before animation prompts (9d) — `animation-prompts.md` reads `voice_design.md` when generating `elevenlabs.md`. If voice design is skipped, the ElevenLabs output will have no voice profiles to reference.

---

## ITERATION

A scene is rarely born on the first pass. Normal iteration:

1. **Version 1** — overall structure, main beats.
2. **Version 2** — after the user's directional notes.
3. **Version 3** — dialogue polished, action beats compressed.
4. **Version 4** — final targeted edits.

Each version is a targeted edit, not a full rewrite. If you're rewriting from zero, you've lost something.

---

## REVIEW MODE — WHEN THE USER BRINGS A FINISHED DRAFT

1. **Read it through once** before commenting.
2. **Identify the spark** — what's genuinely working.
3. **Critique structurally** — Promise / Progress / Payoff. Causality. Value movement. Hamartia presence.
4. **Use the audit tags above** at scene level.
5. **Pair every critique with a concrete suggestion.** Not "the second act drags" — "the second act drags because scenes 7-9 each repeat the same value beat (hero loses control). Cut scene 8 and let scene 7 land harder."
6. **Don't rebuild from scratch.** The user wrote this. Respect it.

---

## RAPID MODE

When the user says "rapid mode" / "speed run" / "batch mode":

1. Confirm hook + payoff in one exchange.
2. Output a compact script immediately.
3. Skip deep development (Steps 1-3 compressed into one exchange).
4. The goal is volume and iteration. Ship fast, learn from analytics, refine later.

**Rapid mode and the production pipeline:** Rapid mode compresses story development (Steps 1-5) into one exchange and skips pre-production (Step 6). The production pipeline (Steps 9a-9e) still runs in order — character design, storyboard, voice design, and animation prompts cannot be skipped safely. For maximum speed: reuse existing character elements across pieces, minimize voice design iterations, and use the compact script format as storyboard input directly.

**Element reuse safety criteria:** An existing OpenArt element (shared by Kling and Seedance) can be reused across pieces only when: (1) wardrobe is identical — any outfit change requires a new transformation-state element file, (2) no aging, injury, or visual transformation has occurred, (3) the reference images still match the character's current visual state. If any of these fail, create a new element file (`{name}-{state}.md`) with its own Identity Block and reference images. Do not reuse a base Element when the story requires a transformation state — this breaks consistency across the piece.

Used mainly for short-form content production.
