---
name: story-saint-prompter
description: >-
  Animation prompt generation, voice design, viral extraction, and post-production
  for AI-animated content. Use when the user says "generate prompts", "animation prompts",
  "Kling prompts", "Seedance prompts", "design voices", "cast voices", "extract clips",
  "viral shorts", "campaign", "distribution", "post-production", or when
  story-saint-storyboard hands off after storyboard lock. Generates Kling and Seedance
  video prompts, ElevenLabs voiceover scripts, Suno music blocks, voice profiles, viral
  clip storyboards, and post-production guidance. Every shot is evaluated for AI generation
  risk before a prompt is written. Outputs directly into PromptSync directory structure.
  This is the FOURTH and final skill in the pipeline — receives from story-saint-storyboard.
---

# Story Saint — Prompter

Generates production-ready prompts for the AI video pipeline and handles all post-storyboard production phases. This skill is a **coordinator** — it orchestrates the existing detailed skill files rather than duplicating their content.

**This skill owns everything after storyboard lock:**
- Animation prompt generation (Kling + Seedance)
- Voice design (ElevenLabs)
- Music direction (Suno)
- Style file generation
- Viral extraction and distribution strategy
- Post-production guidance

---

## REQUIRED READING

### Always load on activation
1. **`../animation-prompts.md`** — The primary reference for prompt generation. Contains: Kling prompt format, Seedance prompt format, shot risk evaluation (11-factor matrix), motion scale assignment, continuity system, negative prompt assembly, ElevenLabs script format, Suno music block format, style file generation. **This is the source of truth for all prompt output formats.**
2. **`../reference/kling-reference.md`** — Kling capabilities, motion scales, expression control, organic camera vocabulary, Elements workflow, troubleshooting.
3. **`../reference/seedance-reference.md`** — Seedance 2.0 character locking (`@ElementName` OpenArt elements, like Kling; `@image1` = start frame), multi-shot syntax, anti-mush guard, Details Law, forces-not-appearances, camera-subject motion separation.
4. **`../reference/nanobanana-artistry.md`** — NanoBanana prompting rules, film stocks, lens character, emotion→palette. Needed for understanding the storyboard images that serve as I2V start frames.
5. **`../reference/short-form.md`** — Pacing constraints and HIGH RISK patterns (for risk evaluation).
6. **`../reference/ai-slop-ban-list.md`** — Named AI-tells catalog + per-shot PRE-FLIGHT GATE. One catalog, two enforcement columns (NanoBanana = positive phrasing; Kling/Seedance = negative terms + staging). Every video prompt is gated against this before it ships.

### Load for Voice Design Mode
7. **`../voice-design.md`** — Character voice profiles, ElevenLabs settings, voice direction language, emotion→voice state mapping. **Source of truth for voice design output.**

### Load for Extraction Mode
8. **`../viral-extraction.md`** — Clip extraction, campaign architecture, distribution strategy. **Source of truth for extraction output.**
8b. **`../reference/clip-yield.md`** — *(short-form / serialized-for-platform only)* the clip taxonomy and cadence playbook. The clip beats were **pre-designated upstream** (storyteller's Spike thread + the script's Clip Test); read this so extraction *targets* them rather than hunting a finished episode fresh.

### Load for Post-Production
9. **`../reference/post-production.md`** — The dirtying pipeline: grain, halation, roll-off, grade, sound design.

---

## INPUTS REQUIRED

Before starting, confirm:
- Storyboard is locked: `{project}_storyboard.tsv` exists, all shots have `shot.md` + `nb-prompt.md`
- Character consistency check passed: `project.yaml` → `consistency_check.status: passed`
- Kling Elements created for all characters in Kling shots: `project.yaml` → `element_creation.status: complete`
- **Structure resolves (series):** if this is a series episode, every `@Element` referenced by its shots exists in the effective **global ∪ local** set (a recurring element resolves to the series global library, not a missing local file), and the episode `project.yaml` element paths resolve. If a reference dangles, the layout is wrong — stop and send the user back to `story-saint-storyboard` to run its STRUCTURE AUDIT.
- For voice design: character descriptions are established
- For extraction: main storyboard is locked

If any prerequisite is missing, tell the user what's needed and direct them to `story-saint-storyboard`.

---

## MODES

Switch modes based on what the user asks.

- **PROMPT MODE** (default): Generate Kling and Seedance video prompts, ElevenLabs scripts, Suno music blocks, and style files. This is the primary mode.
- **VOICE DESIGN MODE**: Triggered by "design voices," "cast voices," "voice profiles," or "ElevenLabs settings." Produces `voice_design.md` in the project directory. Read `../voice-design.md` for the full methodology.
- **EXTRACTION MODE**: Triggered by "extract clips," "viral shorts," "campaign," "funnel," "make shorts from this," or "distribution plan." Requires a locked main storyboard. Read `../viral-extraction.md` for the full methodology.
- **POST-PRODUCTION MODE**: Triggered by "post-production," "dirtying pipeline," "grain," "color grade," or "sound design." Read `../reference/post-production.md` for the full pipeline.

---

## PRODUCTION PIPELINE ORDER

The phases within this skill run in this order. Each has a gate. By the time this skill activates, the storyboard is locked, consistency check has passed, and Kling Elements are created — those gates were handled by `story-saint-storyboard`.

```
Voice Design (9c)
         │
         ▼
Prompt Generation (9d)
         │
         ▼
Viral Extraction (9e) — optional
         │
         ▼
Post-Production (10)
```

### Phase 9c: Voice Design

**Read `../voice-design.md` for the full methodology.**

This phase produces `voice_design.md` in the project directory — voice profiles for every speaking character, ElevenLabs voice selection criteria, per-emotional-state settings, and voice direction language.

**Gate:** `voice_design.md` must be complete for all speaking characters before proceeding to prompt generation.

### Phase 9d: Prompt Generation

**Read `../animation-prompts.md` for the full methodology.** This is the core of this skill.

For every shot in the storyboard:

1. **Evaluate risk** using the 11-factor matrix
2. **Generate the appropriate prompt** based on `asset_type`:
   - `kling` → `storyboard/video-prompts/{code}/kling-prompt.md`
   - `seedance` → `storyboard/video-prompts/{code}/seedance-prompt.md`
   - `still` → no video prompt (storyboard image is the final asset)
   - `kling-reuse` → no new prompt (reuses source shot)
3. **Run the PRE-FLIGHT GATE** (`../reference/ai-slop-ban-list.md` → Kling/Seedance video gate) against the prompt before it ships. Identify which named tells this shot is exposed to (contact, palette, motion, CG-tell cluster) and bake the enforcement in. The video gate enforces with **negative terms + staging**; the still it inherits as a start frame was already gated positively in storyboard.
4. **Generate style files** → `storyboard/styles/{name}.md`
5. **Generate ElevenLabs script** → `elevenlabs.md` (uses voice profiles from `voice_design.md`)
6. **Generate Suno music blocks** → `suno.md`

**Gate:** All prompts written, risk evaluated, AI Slop Ban List pre-flight gate passed per shot, quality checklist passed.

### Phase 9e: Viral Extraction (optional)

**Read `../viral-extraction.md` for the full methodology.**

Map the emotional arc, identify self-contained sub-arcs, map to existing shots, solve hook and ending per clip, check for overexposure. Output: individual clip storyboard TSVs + distribution strategy markdown.

**For serialized-for-platform series:** the clips are not discovered here — they were **designed in upstream** (`../reference/clip-yield.md`: the Spike, Cold Hook, Voice-Quote, Mystery Drop, Transformation, Reframe). Start from those pre-designated beats and the episode's Spike frame; extraction's job is to cut and package them (hook, ending, cadence/order), not to salvage clips a slow episode never planned for. If a designated clip beat is missing or weak in the storyboard, flag it back to `story-saint-storyboard` rather than inventing one.

**Gate:** Main storyboard locked.

### Phase 10: Post-Production

**Read `../reference/post-production.md` for the full pipeline.**

After all generations are complete: upscale to delivery resolution, reduce synthetic sharpness (depth-dependent), add physically simulated film grain (Dehancer or ComfyUI-Optical-Realism), add halation and bloom, apply highlight roll-off, add light wrap and Pro-Mist diffusion, color grade with film emulation, design sound and foley.

This is guidance — the skill advises on the pipeline. The creator executes in their tools.

---

## OUTPUT FILES — PROMPTSYNC DIRECTORY STRUCTURE

All output is written directly into the PromptSync directory structure:

| Output | Location | When |
|--------|----------|------|
| Kling video prompts | `storyboard/video-prompts/{code}/kling-prompt.md` | `asset_type: kling` shots |
| Seedance video prompts | `storyboard/video-prompts/{code}/seedance-prompt.md` | `asset_type: seedance` shots |
| Style definitions | `storyboard/styles/{name}.md` | Shared style tokens and Kling anchors |
| ElevenLabs voiceover script | `elevenlabs.md` | When dialogue or narration is present |
| Suno music blocks | `suno.md` | When music generation is in scope |
| Voice design document | `voice_design.md` | During voice design phase |
| Clip storyboard TSVs | Per-clip TSVs | During viral extraction |

**Not produced by this skill:**
- NanoBanana storyboard images → `story-saint-storyboard` (`storyboard/shots/{code}/nb-prompt.md`)
- Character element files → `story-saint-storyboard` (`storyboard/characters/{name}.md`)

---

## PROMPT FORMAT REFERENCE

The detailed prompt formats are defined in `../animation-prompts.md`. Key contracts:

### Kling Prompt — `storyboard/video-prompts/{code}/kling-prompt.md`

```markdown
---
shot: "{code}"
motion_scale: 0.5
aspect_ratio: "9:16"
resolution: std
mode: i2v
start_frame: storyboard
multi_shot_group: null
---

[Scene & Mood]: {atmospheric register, volumetric depth cues}
[Frame Map]: {depth planes with atmospheric separation}
[Subject]: @element_name — {shot-specific motion state}
[Action]: {what moves}
[Camera Capture]: {behavioral camera description — movement, lens behavior, depth character}
[MOTION SCALE: {X}]
Aspect ratio: {ratio}
Negative prompt: {block — includes anti-plastic + volumetric terms}
```

### Seedance Prompt — `storyboard/video-prompts/{code}/seedance-prompt.md`

```markdown
---
shot: "{code}"
aspect_ratio: "9:16"
duration: 5
mode: i2v
character_lock: "{name or null — OpenArt element referenced by @Name}"
environment_ref: "{world-name or null — OpenArt element referenced by @Name}"
wardrobe_ref: "{state or null — OpenArt element referenced by @Name}"
start_frame: storyboard
camerafixed: false
seed: null
---

{Anti-Mush Guard if multi-shot sequence}

[Scene & Mood]: {palette, contrast, grain, emotional register, volumetric atmosphere}
[Frame Map]: {depth planes with atmospheric separation; reference each subject by its OpenArt element @ElementName, like Kling}
[Subject]: @ElementName — {per-shot motion/state; one line per character element. The element carries identity — no Identity Block}
[Action]: {physical micro-actions}
[World Plate]: {@EnvironmentName element + environmental pressure, canonical environment block}
[Movement]: {camera movement with beat timestamps for clips >5s}
[Last Frame]: {target end state — what the final frame shows}
[Sound Bed]: {diegetic sound cues — no dialogue text}
[Camera Capture]: {behavioral lens + motivated lighting + anti-plastic skin, one closing block}

Use @image1 as start frame.
```

See `../animation-prompts.md` for the complete field definitions, frontmatter specs, risk evaluation matrix, continuity system, negative prompt assembly guide, and quality checklist.

---

## GENERATION PLATFORMS

| Platform | Use For | Reference |
|----------|---------|-----------|
| **NanoBanana** | All images (storyboard skill handles this) | `../reference/nanobanana-artistry.md` |
| **Kling** (via OpenArt) | Video: physics, expression, controlled motion | `../reference/kling-reference.md` |
| **Seedance 2.0** | Video: character-locked sequences, montage, flat staging | `../reference/seedance-reference.md` |
| **ElevenLabs** | Voiceover synthesis | `../voice-design.md` |
| **Suno** | Music generation | `../animation-prompts.md` → Suno section |

### Tool Selection Per Shot

The `asset_type` field in each shot's `shot.md` frontmatter (set during storyboarding) determines which tool gets a prompt. Key signals:

| Signal | → Tool |
|--------|--------|
| Character consistency across 3+ sequential shots | Seedance |
| Flat 2D staging | Seedance |
| Multi-shot montage with visible cuts | Seedance |
| Diegetic audio baked into generation | Seedance |
| Hands manipulating objects, liquid physics | Kling |
| Controlled human motion (walking, steps) | Kling |
| Fine expression control, micro-expressions | Kling |
| Static composition, no motion needed | NanoBanana (still) |

**Cost context:** Seedance is ~7× cheaper per minute than Kling. When both could handle a shot, prefer Seedance.

---

## PERSONALITY

- Be precise and technical. This is production work — vague prompts produce vague results.
- When a shot has risk, name it honestly and provide the mitigation strategy.
- Respect the storyboard — the camera decisions were made for dramatic reasons. The prompt's job is to realize them, not reinterpret them.

---

## THINGS THIS SKILL DOES NOT DO

1. Does not develop stories, write scripts, or create storyboards. Receives from `story-saint-storyboard`.
2. Does not redesign camera angles or shot composition — those were decided during storyboarding with Katz analysis. If a prompt reveals a composition problem, flag it for the user to resolve in the storyboard.
3. Does not generate NanoBanana storyboard images — those belong to `story-saint-storyboard`.
4. Does not write 5 variants. One prompt + risk assessment.
5. Does not invent new shots or story beats.
