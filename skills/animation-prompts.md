---
name: story-saint-prompts
description: >-
  Generates Kling and Seedance video prompts with built-in shot risk evaluation.
  Use when the creator asks for Kling prompts, Seedance prompts, video generation
  prompts, animation prompts, or says "generate prompts" after storyboarding.
  Evaluates every shot for AI generation risk before writing prompts.
  Outputs directly into PromptSync directory structure.
---

# AI Animation Prompt Generator

Generates production-ready prompts for the AI video pipeline: Kling video prompts (defaulting to Image-to-Video using the NanoBanana storyboard image as the start frame), Seedance 2.0 prompts (for multi-shot montage and character-locked sequences), ElevenLabs voiceover scripts, and Suno music blocks. Every shot is evaluated for AI generation risk before a prompt is written. NanoBanana is the sole image generation platform — used for character reference sheets (Character Design phase), storyboard scene images (storyboard phase, `nb-prompt.md` per shot), and environment references.

**This skill owns prompt generation. story-saint owns story development.** When both are active, story-saint hands off to this skill at the prompt stage.

---

## Output Files — PromptSync Directory Structure

All prompt output is written directly into the PromptSync directory structure. This is the format the PromptSync dashboard reads.

| Output | Location | When |
|--------|----------|------|
| Kling video prompts | `storyboard/video-prompts/{code}/kling-prompt.md` | For every shot with `asset_type: kling` |
| Seedance video prompts | `storyboard/video-prompts/{code}/seedance-prompt.md` | For every shot with `asset_type: seedance` |
| Style definitions | `storyboard/styles/{name}.md` | Shared style tokens and Kling anchors |
| ElevenLabs voiceover script | `{project}/elevenlabs.md` | When dialogue or narration is present |
| Suno music blocks | `{project}/suno.md` | When music generation is in scope |

**Not produced by this skill:**
- NanoBanana storyboard images → created during storyboard phase (`storyboard/shots/{code}/nb-prompt.md`)
- Character element files → created during Character Design phase (`storyboard/characters/{name}.md`)

### Per-Shot Kling Prompt File — `storyboard/video-prompts/{code}/kling-prompt.md`

```markdown
---
shot: "{code}"
motion_scale: 0.5
aspect_ratio: "9:16"
resolution: std
mode: i2v
start_frame: storyboard
start_frame_shot: null
multi_shot_group: null
---

[Scene & Mood]: {atmospheric register, palette, volumetric depth cues — haze density, light shaft angle, atmospheric falloff between subject and background. For I2V: only include if the motion should shift mood from the start frame. For t2v/multi-shot: always include — no start frame carries the visual treatment. Replaces [Style & Ambiance].}
[Frame Map]: {depth-plane decomposition — foreground: ..., midground: ..., background: ... with atmospheric separation between planes (haze, particulate, contrast loss). For I2V: only elements NOT visible in the start frame or environmental motion. For t2v/multi-shot: describe the full spatial layout. Replaces [Context].}
[Subject]: @element_name — {shot-specific motion state}
[Action]: {what moves — pronouns or body part names after Subject established}
[Camera Capture]: {behavioral camera description — movement verb, lens behavior (not brand names), depth character. One camera instruction only. Use behavioral descriptions from the project's Camera Rig Definition. Replaces [Cinematography].}
[MOTION SCALE: {X}]
Aspect ratio: {project aspect ratio — 9:16 or 16:9, as confirmed at project start}
Negative prompt: {block — always includes: smooth plastic skin, airbrushed texture}
```

**Multi-Shot Compression Guide (500-char limit):**

When total prompt body exceeds 500 characters per shot in multi-shot mode, cut sections in this priority order:

1. **Drop `[Scene & Mood]` first** — style is inherited from start frame in I2V
2. **Merge `[Frame Map]` into `[Subject]`** — compress depth cues into a single spatial anchor after the element name: `@element_name — midground, {motion state}`
3. **Compress `[Camera Capture]`** — reduce to bare movement verb: `[Camera Capture]: slow push-in`

Worked example (under 500 chars):
```
[Subject]: @marcusReeves — seated cross-legged on the bed, screwdriver in right hand
[Action]: Head lifts slowly, eyes track toward the doorway, breath catches
[Frame Map]: foreground: bare-bulb lamp casting hard upward shadows, background: hazy bedroom wall losing contrast
[Camera Capture]: static, medium shot, shallow depth with soft background falloff
```

**Note:** The `aspect_ratio` in both frontmatter and prompt body must match the project's confirmed aspect ratio (see Resolution and Aspect Ratio Confirmation Gate below). For 16:9 horizontal projects, also update the `[Style & Ambiance]` to reference anamorphic lens character and horizontal composition strategies from the project's camera rig definition.

**Frontmatter fields:**

| Field | Values | Meaning |
|-------|--------|---------|
| `shot` | Shot code | Matches the directory name |
| `motion_scale` | 0.1–1.0 | Kling motion intensity. Must match the `[MOTION SCALE: X]` value in the prompt body — the frontmatter is for pipeline tracking, the prompt body value is what Kling reads |
| `aspect_ratio` | "16:9" \| "9:16" \| "1:1" | Output ratio |
| `resolution` | `std \| pro` | Kling output resolution. `std` = 720x1280 (9:16) / 1280x720 (16:9). `pro` = 1080x1920 (9:16) / 1920x1080 (16:9). Default: `std`. Use `pro` for: hero shots, ECU faces, thumbnails, key frames, and any shot that will be cropped or zoomed in post. |
| `mode` | `i2v \| t2v \| multi-shot` | Generation mode (Kling only — `multi-shot` is not valid for Seedance; use Seedance's native multi-shot syntax instead). Default: `i2v` (NanoBanana storyboard image as start frame). Use `multi-shot` for Kling multi-shot batches. Use `t2v` only when no suitable start frame exists and the shot is not part of a multi-shot group. **T2V audio warning:** OpenArt auto-enhancement strips audio notes from T2V prompts (see `reference/kling-reference.md` → Audio Notes Behaviour). For T2V shots with critical audio design, add audio direction to `suno.md` or handle in post — do not rely on inline audio cues reaching Kling. **I2V audio note:** I2V prompts pass through unchanged so audio notes survive, but Kling's response to them is inconsistent — treat I2V audio cues as best-effort, not guaranteed |
| `start_frame` | `storyboard \| prev_frame \| null` | Where the I2V start frame comes from. `storyboard` = NanoBanana image from `shots/{code}/nb-prompt.md`. `prev_frame` = last frame of the previous shot in sequence — OR of the shot named in `start_frame_shot` when that is set (setup-chain return). `null` = T2V mode, no start frame |
| `start_frame_shot` | Shot code or null | The setup-chain predecessor (same subject + angle + closeness) whose rendered last frame becomes this shot's I2V start frame; implies `start_frame: prev_frame`. Copied from the shot.md `start_frame_shot`. `null` = literal previous shot or storyboard image. A different-closeness return to the same subject stays `null` (state carry, Step 6c). See `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains |
| `multi_shot_group` | Name or null | Groups shots for Kling multi-shot batching |

### Per-Shot Seedance Prompt File — `storyboard/video-prompts/{code}/seedance-prompt.md`

```markdown
---
shot: "{code}"
aspect_ratio: "9:16"
duration: 5
mode: i2v
character_lock: "{character_name or null — names the OpenArt element to reference by @Name in the prompt body; pipeline tracking, not a sheet to upload}"
environment_ref: "{world-name or null — names the OpenArt environment element to reference by @Name in the [World Plate] block}"
wardrobe_ref: "{character-state or null — names the OpenArt wardrobe-state element to reference by @Name}"
start_frame: storyboard
start_frame_shot: null
camerafixed: false
seed: null
---

{For multi-shot sequences: prepend the Anti-Mush Guard paragraph here — see `reference/seedance-reference.md` → Anti-Mush Guard. Deploy when the sequence has visible cuts between shots.}

[Scene & Mood]: {palette, contrast, grain, emotional register, volumetric atmosphere — haze density, particulate behavior, atmospheric falloff. From project style mood. For 16:9: include anamorphic lens character (oval bokeh, horizontal streak flares) from the project's camera rig definition. Replaces [Visual Style].}
[Frame Map]: {depth-plane decomposition — foreground: ..., midground: ..., background: ... with volumetric separation between planes. Atmospheric haze thickening with distance, particulate catching light sources, contrast loss in deep background. Anchors subjects to screen positions before identity is described. Reference each character/environment by its OpenArt element — `@ElementName` (PascalCase, no spaces; space-after before text or possessive, e.g. `@Pip 's face`), exactly like Kling.}
[Subject]: {`@ElementName — {motion/state}` — the OpenArt element carries identity; describe only the per-shot motion/state after the dash, never the locked appearance. Mirror Kling's `[Subject]: @element_name — {motion}` convention. For 2+ character sequences, write one `[Subject]:` line per element. Replaces the inline Identity Block paste — no pasted identity dump.}
[Cross-Frame Rules]: {MULTI-SHOT ONLY — the consistency contract. State what holds identical across shots: which character holds which position and wardrobe state across which shots, persistent environment and lighting state, time-of-day/weather/atmosphere lock. Name any single deliberate change as an explicit exception ("ONLY in Shot N…"). Omit for single-shot clips. See `reference/seedance-reference.md` → Frame Map, Subject Lock & Cross-Frame Rules.}
[Action]: {what moves — physical micro-actions, not appearance. Describe only motion and camera, not static elements visible in the start frame}
[World Plate]: {environmental pressure — location anchor, materials, single atmospheric force (cold light, dust, wet surfaces, steam). Reference the environment by its OpenArt element `@EnvironmentName` (like Kling), then add the canonical environment block from the environment file if available. Replaces [Environment].}
[Movement]: {motion across the runtime, layering all four types — character motion (with beat timestamps for clips >5s: "0–2s: static. 2–4s: slow push-in. 4–5s: hold."), micro-motion (breath, hair, fabric, jewelry), environmental motion (rain, smoke, dust, traffic), and camera motion. State explicitly when a layer is static ("only breath and hair move"). For clips ≤5s: single movement description. See `reference/seedance-reference.md` → Movement Layers and Camera Movements. Replaces [Camera].}
[Last Frame]: {target end state — what the final frame should show, described as a visual composition. Gives the model a motion target to land on. Keep to 1-2 sentences.}
[Sound Bed]: {diegetic sound cues ONLY — ambient, micro-action, silence moment. Include delivery notes for any spoken lines: "{character by visual markers} says '{line}' — {tone, pace, emotion}." No dialogue text in the prompt body itself (creates visual ghosts). Neither Seedance nor Kling generates voice — all VO handled by ElevenLabs. Replaces [Audio].}
[Capture Realism]: {anti-render physics block, four mechanics tuned to the scene: (1) depth via suspended atmosphere between planes, (2) moisture-without-shine IF wet (delete if dry), (3) per-zone specular kill + flattering ceiling on skin (drop the skin sentence on no-human plates), (4) contrast curve stated three ways. Ship on every prompt unless the user asks for a glossy/clean register. Physics only — no gear/grade/frame-rate (those live in Camera Capture). See `reference/seedance-reference.md` → Capture Realism Block.}
[Camera Capture]: {behavioral lens description (not brand names) + motivated lighting (Cardinal Rule 4) in one closing block. Lens behavior, depth character, film look, color behavior, grain, anti-plastic skin treatment. Name each light source visible in frame, map to body parts, state warm/cool split. "No clean studio light." Replaces [Lighting] — lighting is now part of Camera Capture.}

Use @image1 as start frame.

Quality guards (positive framing): {Seedance 2.0 ignores traditional negative prompts (see `reference/seedance-reference.md` → Negative Prompts). Instead, describe what you WANT as affirmative statements: "anatomically correct hands with clear finger separation" not "no extra fingers." "Consistent wardrobe and face across all shots" not "no morphing." See `reference/nanobanana-artistry.md` → Positive Framing for the technique.}

```

**END STATE (write below the prompt in the .md file, outside the prompt code block — do NOT paste into Seedance):**

```
END STATE:
- {character by visual markers ONLY — e.g. "dark-haired figure in torn linen tunic", NEVER character name}: {exact physical state at clip end}
- Camera: {final position and framing}
```

**Frontmatter fields:**

| Field | Values | Meaning |
|-------|--------|---------|
| `shot` | Shot code | Matches the directory name |
| `aspect_ratio` | "16:9" \| "9:16" \| "1:1" | Output ratio |
| `duration` | 2–12 seconds | Clip length. Seedance resolution is always 720p (upscale in post with Topaz Video) — no resolution field needed |
| `mode` | `i2v \| t2v \| r2v` | Generation mode (Seedance only — `r2v` is not valid for Kling; use Kling Element binding instead). `i2v` = NanoBanana image as start frame. `r2v` = reference-to-video (character lock from ref image) |
| `character_lock` | Character name or null | The **primary** character, named by its OpenArt element. Reference it in the prompt body as `@ElementName` (PascalCase, no spaces) — exactly like Kling. The element carries identity; do **not** upload or paste a reference sheet. This applies to both `i2v` and `r2v` modes. **Required when `mode: r2v`** — r2v locks character identity via the `@ElementName` element, so `character_lock` must be set. Should also be set for `i2v` whenever a character must hold identity. For multi-character shots, list the primary here; additional characters/props/creatures are referenced by their own `@ElementName` in the prompt body |
| `environment_ref` | World name or null | The environment's OpenArt element, referenced in the prompt body's `[World Plate]` block as `@ElementName`. The character must be lit by the environment's actual lighting |
| `wardrobe_ref` | Character-state or null | The wardrobe-state OpenArt element, referenced by `@ElementName`. When set, the wardrobe-state element carries the look — reference it alongside the character element |
| `start_frame` | `storyboard \| prev_frame \| null` | Where the I2V start frame comes from. The start frame is the single reference image, declared in the prompt body as `Use @image1 as start frame.` — `@image1` is reserved for the storyboard start frame only (identity is carried by the `@ElementName` elements, not by this image). `prev_frame` = last frame of the previous shot in sequence, OR of the shot named in `start_frame_shot` when set (setup-chain return). Set `null` for `r2v` and `t2v` modes |
| `start_frame_shot` | Shot code or null | The setup-chain predecessor (same subject + angle + closeness) whose rendered last frame becomes this shot's I2V start frame; implies `start_frame: prev_frame`. Copied from the shot.md `start_frame_shot`. `null` = literal previous shot or storyboard image. A different-closeness return to the same subject stays `null` (state carry, Step 6c). See `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains |
| `camerafixed` | `true \| false` | Whether the camera is locked (`true`) or can move (`false`). Maps to Seedance `--camerafixed` CLI parameter. Seedance-only — Kling controls camera via the `[Cinematography]` block in the prompt body, not a frontmatter toggle. When `true`, the `[Camera]` block in the prompt body should say `Static` or be omitted — do not write camera movement instructions that contradict `camerafixed: true` |
| `seed` | Integer or null | Reproducibility seed. Maps to Seedance `--seed` CLI parameter |

**Template scope:** This compact per-shot template is the format written into each `seedance-prompt.md` file in the PromptSync directory. For the full 11-block production skeleton (character lock, story, visual style, camera style, editing style, audio, shot-by-shot timeline, lighting, composition, output specs), see `reference/seedance-reference.md` → 11-Block Production Skeleton — use it when designing multi-shot sequences. For single-shot composition-focused work, see `reference/seedance-reference.md` → Prompt Anatomy (shot declaration, camera, character, lighting, atmosphere, environment, lens spec, hyperrealism, film reference). Use the skeleton or anatomy when designing the prompt; write the compact template into the file.

**Seedance-specific rules:**
- Reference characters and worlds by their OpenArt elements — `@ElementName` (PascalCase, no spaces; space-after before text or possessive, e.g. `@Pip 's face`), exactly like Kling. The element carries identity; do **not** upload or paste a reference sheet, and do **not** include an Identity Block in the prompt body
- The storyboard start frame is the single reference image — `@image1`. Reserve `@image1` for the start frame only and end the prompt body with `Use @image1 as start frame.`
- When `environment_ref` is set, reference the environment element by `@ElementName` in the `[World Plate]` block. Map the environment's lighting sources to the character's body (motivated lighting, Cardinal Rule 4)
- When `wardrobe_ref` is set, reference the wardrobe-state element by `@ElementName` alongside the character element
- **Multi-character Seedance shots:** reference each identity-critical character and world by its own `@ElementName` element, exactly like Kling. Give each a `[Subject]: @ElementName — {motion/state}` line. Drop a character to visual-markers-only description only when no element exists for it (see `reference/seedance-reference.md` → Group Scenes)
- Apply the Details Law: every shot needs one environmental pressure, one physical micro-action, one sound anchor
- Do NOT re-describe static elements visible in the start frame — describe only motion and camera
- For flat 2D staging: state "2D flat staging, camera perpendicular to action plane, no depth perspective, no vanishing point" explicitly in the prompt. For Kling shots, reinforce in the negative prompt block. For Seedance shots, reinforce with positive framing: "All action confined to a single plane parallel to the camera. Characters and objects share the same depth plane. Flat perpendicular composition maintained throughout."
- For multi-shot stitching (15s+): split into 3×5s clips with matched END STATE → start-state anchors
- **Seedance mode decision:** Use `i2v` when the NanoBanana storyboard image matches the desired frame 1 composition. Use `i2v` with `start_frame: prev_frame` when the shot continues from the previous shot's end state and needs precise physical state carry-over (extract last frame from previous generation as the start frame). **For a setup-chain return** (same subject + angle + closeness as an earlier shot, `start_frame_shot` set), also use `i2v` with `start_frame: prev_frame`, but source the frame from the chain predecessor's last frame rather than the literal previous shot — the Seedance equivalent of the Kling setup-chain branch (see Start Frame Strategy → Setup-chain returns). Use `r2v` when the character must match but the shot composition differs from the storyboard image — `r2v` locks character identity via the `@ElementName` element without constraining frame 1 (set `start_frame: null`). Use `t2v` only when no start frame or character reference is needed (set `start_frame: null`).

### Character Element File — `storyboard/characters/{name}.md`

The canonical character element format — including production frontmatter, Identity Block, Kling Element, Seedance character lock, NanoBanana reference prompts (Prompts 1-5), transformation states, visual anchors, and consistency notes — lives in `templates/characters.template.md`. That template is the single source of truth for both the YAML frontmatter and the content sections.

**Frontmatter fields (defined in `templates/characters.template.md`):**

```yaml
name: "{Display Name}"
element_name: "{ElementName}"
element_type: character       # or: prop | environment | creature
appears_in: [1A, 2A, 3B]
status: reference-done
element_status: not-created   # tracks whether Kling Element has been created in OpenArt
```

**Key sections in each character file:**
- **Identity Block** — face, hair, build, wardrobe, distinctive features. Repeated verbatim in every prompt.
- **Kling Element Description** — brief; the 4 reference images carry the visual DNA.
- **Seedance Character Lock** — reference the character's OpenArt element as `@ElementName` in the prompt body, same as Kling. No reference-sheet upload, no Identity Block pasted inline.
- **NanoBanana Reference Prompts** — 4 separate angles (3:4) + optional expression sheet (16:9). See `templates/characters.template.md` for the full prompt text.
- **Transformation States** — if the character changes visually, each state gets its own file (`{name}-{state}.md`) with its own Identity Block, reference images, and Element/character lock.

For non-character elements (props, environments), use the same frontmatter with `element_type: prop` or `element_type: environment` and omit the reference prompt sections.

### Style File — `storyboard/styles/{name}.md`

```markdown
---
name: "{Style Name}"
---

## Shared NanoBanana Tokens
{Common NanoBanana style tokens applied to all storyboard image prompts.}

## Shared Kling Style Anchor
{Base Kling style prefix. e.g. "Photorealistic cinematic. Shot on ARRI Alexa. Shallow depth of field."}

## Kling Style Anchors by Palette/Mood
{Per-palette style anchors. Each palette group gets its own subsection.
Use the enriched anchors from `reference/kling-reference.md` — Style Anchors by Mood
as starting points, then customize for this project.
For 9:16 vertical projects: adapt anchors to use spherical primes instead of anamorphic lenses
(see `reference/kling-reference.md` → Style Anchors by Mood → 9:16 adaptation note).}

## Visual Language — Mood Definitions
{Define 3-5 core moods for this project. Each mood locks a fixed combination of
film look, lens behavior, color palette, lighting, and atmosphere. Reference these mood
names in the storyboard's Color & Mood column — the NanoBanana and Kling prompts
inherit the full visual treatment automatically.

See `reference/nanobanana-artistry.md` — Visual Language Framework for the template
and `reference/nanobanana-artistry.md` — Emotion → Color/Mood table for lookup.
Describe film look and lens by behavior, never by brand — see Film Look Vocabulary
and Lens Behavior, Not Brand Names in that file.}

### MOOD: {Name}
- Film look: {e.g. warm fine-grain negative, cool shift}
- Lens: {e.g. normal-FOV prime at a wide aperture, soft window light}
- Palette: {e.g. desaturated, muted blues and greys}
- Lighting: {e.g. soft diffused, overcast, low contrast}
- Atmosphere: {e.g. fog, empty space}
- Quality boosters: {e.g. "emotional depth, painterly realism"}

### MOOD: {Name}
{...repeat for each core mood}

## Camera Rig Definitions

Define per-world or per-context camera rigs using behavioral descriptions. Describe what the camera/lens/stock *does* visually — not brand names. The model renders behavior, not gear; brand names are pattern-matched to a vibe, behavioral descriptions are rendered directly.

### RIG: {World/Context Name}
- Capture behavior: {e.g. wide-latitude cinema capture with 14+ stops of dynamic range, clean highlight roll-off, rich shadow detail}
- Lens behavior: {e.g. vintage 75mm 2x anamorphic character at wide aperture, oval bokeh, horizontal streak flares, warm organic edge falloff}
- Default focal feel: {e.g. medium portrait compression for MCU, wide environmental for WS}
- Diffusion: {e.g. quarter-strength highlight softening, lowered micro-contrast, gentle bloom on specular points}
- Film look: {e.g. daylight motion picture film pushed one stop, visible fine grain structure, warm skin rendition, lifted shadows}
- Color behavior: {e.g. teal-amber split, deep but not crushed blacks, warm practicals against cool ambient}
- Depth character: {e.g. oval anamorphic bokeh with horizontal stretch (16:9) or circular spherical bokeh (9:16)}
- Volumetric default: {e.g. light atmospheric haze between depth planes, subtle particulate catching light shafts, atmospheric falloff softening background one stop}
- Skin treatment: {e.g. natural texture with visible pores, subtle subsurface scattering at ears and fingertips, fine peach fuzz catching edge light on jaw and cheekbones, per-zone specular control — forehead matte, nose bridge soft catch, no airbrushing}
- Aspect ratio: {16:9 or 9:16}

### RIG: {BTS / Documentary}
- Capture behavior: {e.g. clean digital capture, wide dynamic range, neutral color science}
- Lens behavior: {e.g. modern 32mm spherical prime, natural rendering, minimal distortion}
- Default focal feel: {e.g. 32mm moderate wide, environmental with natural perspective}
- Diffusion: {none — no diffusion for BTS}
- Film look: {neutral — no film emulation push, clean digital}
- Color behavior: {neutral, flat, documentary register}
- Depth character: {natural circular bokeh}
- Volumetric default: {whatever is present on set — no added atmosphere}
- Skin treatment: {natural, ungraded — no beauty treatment}
- Aspect ratio: {16:9 or 9:16}

{Repeat for each distinct visual world. Performance/stadium, narrative, dance break, BTS — each may have its own rig. The rig name is referenced in the per-shot prompt's `[Camera Capture]` block instead of writing the full spec inline.}

### Behavioral Camera Language Reference

When converting from brand-name rigs (legacy or external reference), use this mapping:

| Brand Name | Behavioral Equivalent |
|---|---|
| ARRI Alexa 35 | wide-latitude cinema capture, 14+ stops DR, clean highlight roll-off, rich shadow detail |
| ARRI Alexa Mini LF | clean large-format cinema capture, shallow depth of field, natural skin rendering |
| Panavision Ultra Vintage 2x anamorphic | vintage 2x anamorphic character, oval bokeh, horizontal streak flares, warm organic edge falloff, breathing on focus pull |
| Cooke S4/i spherical | modern spherical prime, warm color rendition, smooth bokeh, minimal distortion |
| Tiffen Black Pro-Mist 1/4 | quarter-strength diffusion softening specular highlights into gentle blooms, lowered micro-contrast |
| Kodak Vision3 250D | daylight motion picture film, fine grain, warm skin rendition, natural saturation |
| Kodak Vision3 500T | tungsten motion picture film, visible grain, cooler base with warm practical rendering |
| Kodak Portra 400 | fine-grain color negative, warm skin bias, pastel highlight rendering, lifted shadows |
| Cinestill 800T | tungsten-balanced film pushed for speed, halation bloom around point light sources, visible grain, cool blue shadows with warm highlights |

## Shared Seedance Visual Style
{Base Seedance [Visual Style] block: palette, contrast, grain, color temperature.
Seedance places visual style near the top of the prompt body — not at the end like Kling.
Derive from the same mood definitions above. Seedance accepts camera body and film
references (e.g., "Shot on ARRI Alexa 35 with 50mm spherical prime") when placed early
in the prompt (see `reference/seedance-reference.md` → Prompt Anatomy), but responds
better to descriptive prose for color/mood than to film stock tags alone:
e.g. "Warm desaturated palette, soft contrast, subtle grain, amber color temperature."}

## Universal Kling Closing Block
{Append to every Kling prompt: MOTION SCALE, aspect ratio, negative prompt.}

## Negative Prompt Assembly
{Project-specific negative prompt. Start with the identity base block, then add
physics, vertical, and artistic blocks as needed. See Negative Prompt Assembly
Guide in this file for the full list of sources.}

> Select terms by **named tell**, not wholesale — see `reference/ai-slop-ban-list.md` (the video column maps each tell to its negative + staging fix; keep the total to 5-8 terms for this shot's actual exposure).

## Motion Scale Quick Reference
- Atmospheric / stillness → 0.3
- Single deliberate action → 0.5
- Dynamic action burst → 0.7
- Environmental chaos (no characters) → 1.0

## Camera Vocabulary
{Exact terms Kling responds to.}

## Expression Control Phrases
{Micro-expression language for close-ups.}

## Emotion Keywords
{State words to combine with micro-expressions.}
```

---

## Start Frame Strategy

The NanoBanana storyboard image (`storyboard/shots/{code}/nb-prompt.md`) is the default start frame for every Kling I2V shot. These images are created during the storyboard phase — they already contain the correct characters, composition, lighting, and mood. They depict the shot's frame 1 state.

**Default flow:** `nb-prompt.md` → generate NanoBanana image → use as Kling I2V start frame.

**When to use T2V instead:**
- Multi-shot batches where Kling handles continuity internally
- The storyboard image doesn't match the required frame 1 state (e.g., the shot continues from the previous shot's end state)

When using `prev_frame`, the I2V start frame is the last frame of the previous shot's Kling generation, not the storyboard image. The `nb-prompt.md` for this shot still exists (for PromptSync dashboard visualization and as an I2V fallback) but does NOT serve as the actual start frame — it may depict a different composition than the actual `prev_frame` input.

**Setup-chain returns (`start_frame_shot`).** In coverage scenes the camera returns to the same setup — same subject, same angle, same closeness — with reverse shots and cutaways between (e.g. `3C → 3E → 3H`, all "MS Hale behind the desk"; or `4D → 4H`, Sarah at the door). A returning shot's true predecessor is its **chain predecessor**, not the literal previous shot. When the storyboard sets `start_frame_shot: {code}`, source the I2V start frame from THAT shot's rendered last frame (set `start_frame: prev_frame`). This gives perfect setup/lighting/identity carry and the clip animates only the delta — no fresh NanoBanana image is needed (skip generation, or treat any existing nb image as dashboard-only). A return to the same *subject* at a **different** closeness is not a setup chain — leave `start_frame_shot: null` and handle it as ordinary state carry (Step 6c). This also differs from `kling-reuse`, which reuses an entire identical clip; setup-chain reuse takes only the predecessor's end frame as this shot's start frame. A setup-chain return is never part of a Kling multi-shot batch — it depends on a specific earlier shot's rendered frame, which multi-shot generation can't supply, so keep `multi_shot_group: null` on these shots. See `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains.

---

## Continuity System

Every shot in the pipeline must track physical state — what the characters and objects look like at the END of the shot, so the next shot can anchor from it.

### End-State Annotation (required on every shot)

After writing every video prompt (Kling or Seedance), append an `END STATE` block:

```
Kling example:
END STATE:
- @Sisyphus: seated on ground, both hands open in lap, gaze directed downward
- Camera: eye level, static, medium shot

Seedance example (visual markers, not names — see `reference/seedance-reference.md` → Cardinal Rule 2):
END STATE:
- broad-shouldered figure in torn linen tunic: seated on ground, both hands open in lap, gaze directed downward
- Camera: eye level, static, medium shot
```

This block is NOT part of the video prompt — do not paste it into Kling or Seedance. It is metadata for the next shot's author (human or AI).

**Cross-tool continuity:** When the next shot uses a different tool than the current shot (e.g., Kling→Seedance or Seedance→Kling), translate the END STATE into the target tool's syntax. Kling END STATE uses `@element_name`; Seedance END STATE uses visual markers (hair color, wardrobe, build). Always translate before writing the start-state anchor.

Example — Kling shot 2A ends, Seedance shot 2B continues:
```
Shot 2A (Kling) END STATE:
- @Sisyphus: kneeling, both hands flat on boulder surface, head bowed
- Camera: eye level, static, medium shot

Shot 2B (Seedance) start-state anchor:
Broad-shouldered figure in torn linen tunic kneeling with both hands flat on
boulder surface, head bowed. [Then describe the new motion...]
```

### Start-State Anchor (required on continuation shots)

Any shot that continues directly from a previous shot MUST open its video prompt (Kling or Seedance) with an explicit physical-state anchor — a single descriptive line that locks in the carry-over position before any new action begins.

**Format (Kling):** `@element_name [exact physical state from previous shot's END STATE].`
**Format (Seedance):** `[character by visual markers] [exact physical state from previous shot's END STATE].`

Without the anchor, the generation tool re-interprets the character's pose from scratch.

### Shot Dependency Fields

> **JSON output is opt-in.** These fields are tracked internally during prompt generation but are NOT written to output by default. Only produce shot JSON if the creator explicitly asks for it.

Every shot tracks: `depends_on_shot`, `start_frame_shot` (chain predecessor for setup-chain returns, or null), `mode` (i2v | t2v | multi-shot), `start_frame` (storyboard | prev_frame | null), `start_state`, `end_state`, `dialogue`, `speech_pace`, `estimated_speech_duration_s`, `speech_on_camera`, `speech_strategy`.

### Kling Generation Mode Decision Tree

```
Is this shot part of a multi-shot batch?
├── YES → Kling handles continuity internally. mode: multi-shot, start_frame: null
└── NO  → Is this a setup-chain return (same subject, angle, AND closeness as an earlier shot)?
          ├── YES → Source the start frame from the chain predecessor's last frame.
          │         mode: i2v, start_frame: prev_frame, start_frame_shot: {code}
          │         (no fresh nb image needed — animate only the delta)
          └── NO  → Does this shot continue a complex physical state from the previous on-camera shot?
                    │  (a different-closeness return to the same subject lands here — match its
                    │   most recent on-camera state per Step 6c; start_frame_shot stays null)
                    ├── YES → Use last frame of previous generation. mode: i2v, start_frame: prev_frame
                    └── NO  → Use the NanoBanana storyboard image as start frame (default).
                              mode: i2v, start_frame: storyboard
```

---

## Spatial Blocking Rules

Kling does not infer character positioning from context. Any physical state that matters must be stated explicitly.

**Always explicitly state:**
- Which part of the body is touching what (`both hands gripping armrests`)
- Character's orientation relative to camera and other elements (`@Sisyphus facing @Boulder, back to camera`)
- Whether a character is seated/standing/kneeling and on/at what
- Object positions that carry meaning

### Spatial Scale and Depth Ordering

Use depth labels inside `[Context]` for multi-element shots:
```
[Context]:
foreground: @Sisyphus 's extended arm, closest to camera
midground: @Boulder — reaching @Sisyphus 's chest height
background: steep mountain slope, cold grey stone, no summit visible
```

Always state sizes relative to the human figure — never rely on Kling to guess:
- "rock reaching @Sisyphus 's chest" not "large rock"
- "@Sword blade as long as @Arthur 's forearm" not "large sword"

---

## Speech Duration System

Any shot containing dialogue MUST have its clip duration derived from the spoken line — this applies to both Kling and Seedance shots. The formula and pace tiers are tool-agnostic.

### Duration Formula

```
word_count = count words in the dialogue line
clip_duration = ceil(word_count / wpm * 60) + 1.5
```

The `+ 1.5` is the breath buffer.

### Pace Tiers

| Pace | WPM | When to use |
|------|-----|-------------|
| `dramatic` | 100 | Emotional declarations, confrontations, confessions |
| `normal` | 130 | Conversation, exposition, neutral narration |
| `fast` | 160 | Arguments, panicked speech, rapid exchanges |

Default to `dramatic` when in doubt.

### Kling Duration Cap Warning

Kling max is **12 seconds**. If a dialogue line requires more than 10.5s, the line MUST be split across two shots or delivered as voiceover. Flag this explicitly.

### Seedance Duration Cap Warning

Seedance clips over **8 seconds** degrade in quality — character drift, motion artifacts, and identity loss increase sharply. If a dialogue line requires more than 6.5s (after breath buffer), prefer splitting into stitched clips with matched END STATE → start-state anchors. Seedance's hard max is 12s, but treat 8s as the practical ceiling for dialogue shots. See `reference/seedance-reference.md` → Shot Budget for the full duration guidance.

---

## Talking Shot Strategies

**Determining `speech_on_camera`:** A shot is `speech_on_camera: true` when the speaking character's mouth is potentially visible in the frame (MCU, CU, MS facing camera, two-shot with faces visible). It is `false` when the character speaks off-screen, is shown from behind, in silhouette, or in a wide shot where mouth detail is indistinguishable. Derive from the storyboard's Shot Type and Subject & Action columns.

When `speech_on_camera: true`, use one of these strategies:

| Strategy | Lip Sync Risk | When |
|----------|--------------|------|
| `profile_shot` | LOW | Default for most dialogue shots |
| `back_of_head` | LOW | When listener POV matters |
| `reaction_coverage` | LOW | Classic intercutting technique |
| `wide_shot` | LOW | Distance hides sync problems |
| `environmental_cutaway` | LOW | Best for narration/prayer beats |
| `text_card` | NONE | Removes the problem entirely |
| `direct_address_close_up` | HIGH | Always provide fallback |

Default to `profile_shot` unless the script specifically requires direct-address.

---

## Shot Risk Evaluation

Before writing ANY prompt, evaluate against this matrix. Take the HIGHEST risk level across all factors.

### Risk Matrix

| Factor | LOW | MEDIUM | HIGH |
|--------|-----|--------|------|
| Characters in frame | 0–1 | 2 generated separately | 2+ interacting or touching |
| Motion complexity | Single motion or static | Two sequential motions | 3+ motions, choreography |
| Motion type | Stillness, slow turn, expression shift | Walking, slow gesture, simple reach | Running, fighting, jumping, dancing |
| Camera | Static, slow push-in, slow pull-back, pan, tilt | Tracking, crane, rack focus, whip pan | Rapid multi-axis moves, orbit, drone sweep, dolly zoom |
| Body focus | Face, torso, full-body silhouette | Arms/legs simple poses | Hands manipulating objects, fingers gripping |
| Physics | None, simple particles | Cloth physics, dust, simple liquid | Pouring liquid, impact chains, collapse |
| Duration vs action | Short clip (1–3s) one action | Medium (3–5s) one action | Long clip (5s+) or multiple phases |
| Dialogue | No dialogue, or VO only | Mouth partially visible, short line | Mouth fully visible, 3+ words |
| Staging constraint | Natural perspective | Specific framing (profile-only, mirror) | 2D flat staging, forced perspective |
| Anatomical specificity | Standard body | Prosthetic visible but static | Prosthetic in motion, specific medical detail |
| Cross-shot consistency | Standalone shot | Must match one other shot | Must match 3+ shots in sequence |

### Risk Response Protocol

**LOW RISK** — Write the prompt directly. Tag as `[LOW RISK]`.

**MEDIUM RISK** — Write prompt with `Fallback:` and `Watch for:` sections.
- If physics factor is MEDIUM or higher: add physics vocabulary to `[Action]` (see `reference/kling-reference.md` — Dynamic Physics Vocabulary) and append physics negative prompts.
- If 9:16 format: apply vertical composition strategies (see `reference/cinematography.md` — 9:16 Vertical Format) and append vertical negative prompts.
- If 16:9 format: apply horizontal composition strategies (anamorphic lens character, lateral spacing for groups, horizontal depth). No vertical negative prompts needed.

**HIGH RISK** — Do NOT write prompt as described. Tag as `[HIGH RISK → REWORKED]`. Provide 2–3 reworked alternatives.
- If physics factor is HIGH: use the Workaround Playbook (Chain-Reaction Physics section). Split cause and effect into separate clips. Use explicit physics vocabulary for each clip individually. Always add the full physics negative prompt block.

---

## Kling 3.0 Prompt Template

Think like a **Director of Photography**, not a photographer. Describe how things **move**, not how they **look**. Once a character is bound as an Element, Kling already knows their appearance.

### Hard Limits (Kling 3.0)

- **500 characters max per shot** in multi-shot mode (prompt body only — the negative prompt block at the end is separate and does not count toward this limit)
- Each `@element_name` consumes **37 characters**
- **Max 3 Elements per task**
- **2-4 reference images per Element** (the pipeline generates 4 per character — front three-quarter, side profile, back three-quarter, ECU face — to maximise identity anchoring)
- Duration: 3-15 seconds total, 1-12 seconds per shot in multi-shot
- **Max 6 shots per multi-shot generation**

### Prompt Structure — I2V (image-to-video)

The start frame already carries framing, composition, character appearance, environment, lighting, and style. The prompt's only job is to say **what changes** — what moves, what the camera does. Everything else is redundant noise that competes with the image for Kling's attention.

```
[Cinematography]: [camera movement verb ONLY — "Static.", "Slow push-in over 4s.", "Pan left to right." No framing, no shot size, no lens — the start frame defines those]
[Subject]: @element_name — [starting physical state relevant to the action — pose, hand position, weight distribution. NOT appearance, NOT clothing, NOT lighting on them]
[Action]: [physical motion only — what body parts move, in what direction, at what speed. No narrative, no emotion words, no inner thoughts, no acting notes]
[Context]: [ONLY elements entering frame or changing state that are NOT visible in the start frame. If nothing new enters: omit this block entirely]
[Style & Ambiance]: [ONLY if the mood shifts mid-clip — e.g., light changes, color temperature shifts. If mood holds steady from start frame: omit this block entirely]
```

**I2V Start Frame Filter — before writing each block, ask:**
- Is this already visible in the start frame image? → **Delete it**
- Is this appearance/clothing/lighting? → **Delete it** (Element binding + start frame handle these)
- Is this emotion/narrative/inner thought? → **Delete it** (Kling renders motion, not subtext)
- Is this a stage direction note for a human actor? → **Rewrite as physical motion** ("not hostile, tired" → delete; "jaw clenches" → keep)
- Does this describe HOW something looks rather than how it MOVES? → **Delete it**

**Common I2V violations:**
| Violation | Example | Fix |
|-----------|---------|-----|
| Framing in `[Cinematography]` | `"Static. MS — Sarah in the doorframe."` | `"Static."` |
| Appearance in `[Subject]` | `"large dark eyes, dark circles beneath"` | Delete — Element + start frame carry this |
| Pose from start frame in `[Subject]` | `"sitting cross-legged on the bed, hands on knees"` | Delete — start frame shows this. Only include if the pose is the ACTION's starting point and changes |
| Narrative prose in `[Action]` | `"He knew the visitor was coming."` | Delete — not visible motion |
| Emotion words in `[Action]` | `"not hostile, tired"` | Delete — or rewrite as physical: `"shoulders drop"` |
| Environment in `[Context]` | `"Grey daylight from the window. Floor lamp unlit."` | Delete — visible in start frame |
| Steady lighting in `[Style & Ambiance]` | `"Grey room light, cool tones"` | Omit block — start frame carries this |

### Prompt Structure — T2V / Multi-shot

No start frame — every block must be complete. Kling builds the scene from text alone.

```
[Cinematography]: [camera type, framing, angle, lens feel, depth of field, camera movement]
[Subject]: @element_name — [full visual state: pose, wardrobe if non-default, spatial position]
[Action]: [what moves — pronouns or body part names after Subject established]
[Context]: [background elements with @IDs, non-element figures, full environment description]
[Style & Ambiance]: [style anchor, lighting, mood, motion scale]
```

### Rules

- One focal action per prompt
- One camera instruction per prompt
- One lighting direction per prompt
- **Do NOT re-describe character appearance** — Element binding handles identity. This includes eye color, skin tone, hair, clothing, scars, and accessories. The only exception is wardrobe overrides when the character is NOT wearing their default outfit (per the continuity manifest)
- **Always add a space after every `@element_name`** before any following character
- **Transformation states:** if a character has multiple visual states (e.g., `@Beethoven_Young` and `@Beethoven_Deaf`), reference the correct state Element for each shot. Never mix states within one Element — each state has its own Element with its own reference images
- Motion scale must appear somewhere in the prompt
- **I2V: the start frame is the prompt's foundation.** Every block must pass the Start Frame Filter above. If a block would be empty after filtering, omit it. A good I2V prompt is SHORT — often just `[Cinematography]` + `[Subject]` (element ref + action-relevant pose) + `[Action]`. Resist the urge to "fill out" blocks with descriptive prose
- **`[Action]` contains physical motion only.** Describe what body parts do: "right hand rises, knocks twice", "eyes shift upward, gaze locks". Do NOT include: emotional labels ("tired", "gentle", "hostile"), narrative context ("he knew this was coming"), character motivation ("not invading space, offering presence"), acting direction ("the delivery is wrong"), metaphor ("the room's coldness holds"). If you can't mime it, it doesn't belong in `[Action]`
- Use Kling's camera vocabulary: static, push-in, pull-back, dolly, pan, tilt, tracking
- Always count characters — must stay under 500 per shot in multi-shot mode
- **No off-screen references.** Only describe characters and elements visible in the frame. Do not mention characters who are off-frame, off-screen, or in a previous/next shot — Kling cannot see them and the reference is meaningless noise. When an off-frame character is needed as a spatial anchor (eyeline target, action direction), replace the name with a visual or spatial description: "toward the figure in the doorway", "facing the visitor off-frame", "the boy on the bed" — never "toward Peter", "facing Sarah"

### Negative Prompts

Always include as a separate block at the end.

**Identity block (always):**
```
morphing features, shifting jawline, changing clothes, shifting color, disappearing accessories, extra limbs, blurry limbs, distorted joints, flickering background, smooth plastic skin, sliding feet
```

**Physics block (add for shots with motion, interaction, or physical effort — see `reference/kling-reference.md` for the full categorized list):**
```
floating objects, weightless, low gravity, inconsistent physics, unrealistic momentum, wrong center of mass, objects clipping through surfaces, no friction, unrealistic bounce, delayed gravity
```

**Vertical format block (add for 9:16 only — skip for 16:9 projects. See `reference/cinematography.md` for full vertical guidance):**
```
wide horizontal composition, landscape framing, distorted vertical proportions, horizon in center, weak vertical lines
```

---

## NanoBanana Reference Prompt Templates

NanoBanana is the sole image generation platform. It handles character reference sheets, environment references, and storyboard scene images.

### Character Reference Prompts — 4 Separate Photorealistic Angles

The full prompt text for all 5 reference prompts (4 angles + expression sheet) lives in `templates/characters.template.md` → Reference Sheet Prompts section. That is the single source of truth — do not duplicate the prompt text here.

**Heading convention:** `### Prompt N — View Name (AR, Resolution)`. The parenthetical is parsed by the PromptSync inject-text feature (Chrome extension) to set aspect ratio and output resolution when injecting prompts into OpenArt. Both values are required.

**Element slot mapping:**
1. Front three-quarter (Prompt 1, 3:4) → PRIMARY identity anchor
2. Side profile (Prompt 2, 3:4) → nose, jaw, ear, body proportions
3. Back three-quarter (Prompt 3, 3:4) → hair, back of clothing, texture
4. Extreme close-up face (Prompt 4, 1:1) → eyes, skin texture, expression baseline
5. Expression sheet (Prompt 5, 16:9) → optional, not uploaded to Element

**Platform mapping:**
- Prompts 1–4 (separate angles) → Kling Element slots (max 4 images per Element)
- Prompt 5 (expression sheet) → creator reference, not uploaded to any platform
- Prompt 6 (Seedance Combined Reference Sheet) → authors the OpenArt element Seedance references by `@ElementName`

**Critical rules for reference prompts:** See `templates/characters.template.md` → Reference Sheet Prompts for the canonical rules. Key points: natural language paragraphs (not keyword lists), full Identity Block in every prompt, no numerical camera specs, flat studio lighting + neutral background (not cinematic lighting), material specificity, positive framing. Storyboard scene images (`nb-prompt.md`) DO use cinematic lighting and behavioral lens descriptions (describe what the glass does — compression, bokeh, falloff — never brand names; see `reference/nanobanana-artistry.md` → Lens Behavior, Not Brand Names) — the distinction is: reference sheets lock identity with flat lighting; scene images set mood with cinematic lighting.

### Environment Reference Prompts

Environment plates are generated during storyboarding (storyboard.md Step 2b) for projects with distinct visual worlds. They serve as Image 2 in multi-reference TASK format composites (see `reference/nanobanana-artistry.md` → Character-in-Environment Composite).

```
[Environment description], [time of day], [weather/atmosphere], [specific
lighting sources and color temperatures], [architectural materials and condition],
[atmospheric elements — haze, fog, dust, mist], photorealistic cinematic,
no people, no characters, wide establishing shot, [behavioral camera/lens description],
[film look].
```

---

## ElevenLabs Prompt Template

Output as `{project}/elevenlabs.md`. Organized by character, not per-shot.

**Model:** Always use `eleven_v3`. No SSML — delivery controlled through audio tags and punctuation.

### Voice Script Format

```
## [Character Name] — Voice ID: [ID or "TBD"]

Model: eleven_v3
Settings:
  stability: [0.3–0.8]
  similarity_boost: [0.7–0.95]
  style: [0.0–1.0]
  speed: [0.8–1.2]

---
[SHOT shot_id] [STATE state_name]
[audio tag] "Verbatim dialogue line."
// [Emotional direction note — for human review only]
```

### Audio Tags (v3 Delivery Control)

| Intent | Tag |
|--------|-----|
| Quiet / intimate | `[softly]`, `[quietly]` |
| Whisper | `[whispers]` |
| Measured / deliberate | `[measured]`, `[steady]` |
| Weight / gravity | `[with quiet weight]` |
| Resolved / decided | `[quietly resolute]` |
| Tentative / uncertain | `[tentative]` |
| Expressive / emotional | `[broken]`, `[raw]` |
| Long silence gap | `[long pause]` |

---

## Suno Prompt Template

Output as `{project}/suno.md`. Organized by emotional zone, not per-shot.

### Music Block Format

```
## MUSIC BLOCK [number] — [Descriptive Name]
Covers: Shot [start] → Shot [end]
Target duration: [Xs]

Style tags: [comma-separated tags]
Tempo: [BPM or relative: slow / mid / driving]
Key mood: [1-line description]
Instrumentation: [primary instruments]
Lyrics: [verbatim lyrics, or "INSTRUMENTAL"]

Direction: [1–2 sentences on emotional intent]
```

### Music Placement Rules

- One block per distinct emotional zone
- Silence is a valid choice — mark as `SILENCE — [reason]`
- Note VO overlap: `// Ducked under VO: shot_03 → shot_05`
- Stingers: short 1–3s accent cues as mini-blocks
- **Lyrics vs instrumental:** For 15-90s Shorts, default to `INSTRUMENTAL` — most Shorts work on mute, and lyrics compete with text cards and VO. Use lyrics only when the song IS the content (music video, lyric-driven piece)

---

## Negative Prompt Assembly Guide

Negative prompts are spread across multiple reference files by domain. When generating a prompt, assemble the negative block by combining the relevant layers:

| Layer | When to Include | Source |
|-------|----------------|--------|
| **Identity** (always) | Every shot | `morphing features, shifting jawline, changing clothes, shifting color, disappearing accessories, extra limbs, blurry limbs, distorted joints, flickering background, smooth plastic skin, sliding feet` |
| **Physics** | Any shot with motion, interaction, physical effort, or objects in motion | `reference/kling-reference.md` → Physics Negative Prompts (5 categorized blocks: gravity, foot contact, friction, scale, slope) |
| **Vertical format** | 9:16 shots only | `reference/cinematography.md` → Vertical Negative Prompts (framing + camera blocks). Skip for 16:9 projects |
| **Artistic** | NanoBanana storyboard images (handled by storyboard phase) and Kling prompts where aesthetic quality matters | `reference/nanobanana-artistry.md` → Negative Prompt Additions: `flat lighting, plastic skin, generic, amateur, digital noise` |
| **Period / genre** | Period-specific shots | `reference/kling-reference.md` → Period/fantasy template or Corporate/professional template |
| **Shot-specific** | Custom per shot | Scene-specific terms: e.g., slope shots add `warped incline, floating boulder`; night scenes add `overexposed, daylight bleeding` |

**Assembly order:** Identity → Physics (if applicable) → Vertical (if 9:16, skip for 16:9) → Period/genre → Artistic (for NanoBanana) → Shot-specific.

Keep the assembled block focused — a wall of 50+ terms dilutes effectiveness. Target 20-30 terms total. Pick the 4-6 most relevant terms from each included layer rather than dumping everything.

### Seedance Positive Quality Guard Assembly

Seedance 2.0 ignores traditional negative prompts (see `reference/seedance-reference.md` → Negative Prompts). Instead, assemble positive affirmative statements covering the same domains as the Kling negative layers. Use the technique from `reference/nanobanana-artistry.md` → Positive Framing.

| Domain | Positive Guard | Replaces Kling Negative |
|--------|---------------|------------------------|
| **Identity** | "Consistent character appearance maintained across all shots. Same face, same wardrobe, same body type throughout." | `morphing features, shifting jawline, changing clothes` |
| **Physics** | "Realistic gravity and weight. Objects interact with surfaces naturally. Feet planted firmly on ground." | `floating objects, weightless, sliding feet` |
| **Vertical format (9:16)** | "Strong vertical composition. Layered depth with foreground, subject, and background stacked vertically." | `wide horizontal composition, landscape framing` |
| **Horizontal format (16:9)** | "Strong cinematic widescreen composition. Anamorphic lens character with oval bokeh and horizontal streak flares. Lateral depth with subject framed in the width." | N/A (use instead of vertical guard for 16:9 projects) |
| **Flat staging** | "All action confined to a single plane parallel to the camera. Characters and objects share the same depth plane. Flat perpendicular composition maintained throughout." | `depth perspective, vanishing point` |
| **Hands / anatomy** | "Anatomically correct hands with clear finger separation. Natural joint articulation." | `extra fingers, bad hands, distorted joints` |
| **Motion** | "Smooth continuous motion with realistic physics. Natural deceleration and weight transfer." | `jittery motion, unrealistic momentum` |
| **Period / genre** | "Period-accurate wardrobe and architecture. Materials and textures consistent with [era]. No modern objects or anachronisms." | Period/genre negative template |
| **Artistic** | "Cinematic depth and detail. Rich textures, natural skin, nuanced lighting. Photographic realism with emotional weight." | `flat lighting, plastic skin, generic, amateur` |

**Assembly order:** Identity (always) → Physics (if motion) → Vertical (if 9:16) or Horizontal (if 16:9) → Flat staging (if applicable) → Period/genre (if period piece) → Artistic (if needed) → Hands/anatomy (if visible) → Motion (if dynamic). Write as a "Quality guards" block at the end of the Seedance prompt body.

---

## Workaround Playbook

When a shot is HIGH RISK, use these proven alternatives:

### Fight / Combat

**Step 1: Decompose using the Action Choreography Framework** (`reference/kling-reference.md` → Action Choreography Framework). Break the full fight into timestamped beats with A-action / B-reaction / cinematic / camera layers. This forces precise choreography thinking and exposes which beats are actually achievable.

**Step 2: Triage each beat individually.** Run every beat through the risk matrix — not the sequence as a whole. A fight is HIGH RISK, but a dominant standing posture over a fallen opponent is LOW. A slow circling stalk is LOW. A single deliberate overhead strike is MEDIUM. A rapid punch-block-counter exchange is HIGH.

**Step 3: Route by risk.** LOW and MEDIUM beats get Kling prompts directly. HIGH beats get one of these workarounds:

- Aftermath shots — show the result, not the action
- Pre-strike tension — the moment before violence
- Reaction shots — cut to someone watching
- Single deliberate strikes — one slow overhead swing
- Silhouette combat — backlit figures hide detail problems
- Hard cuts — show wind-up, cut to black, show result

**Step 4: Reassemble.** The final sequence interleaves directly-prompted beats with workaround-routed beats. The beat decomposition ensures END STATE continuity across the seams — each beat's B-reaction is the next beat's start-state anchor.

### Running / Crowds
- Empty environment + environmental storytelling
- Single figure walking (not running)
- Sound design — footsteps and voices off-screen
- Dust/aftermath

### Multi-Character Interaction
- Generate each character separately — composite in editor
- Over-shoulder framing — one character's back (static) with the other in focus
- Reaction shot / reverse shot

### Complex Hand / Finger Work
- Start mid-action — object already in hand
- Silhouette or shadow
- Cut away before the grab
- Pressed flat / gripping — static positions are safer

### Chain-Reaction Physics
- Split cause and effect into separate clips
- Show only the effect
- Use light/flash as transition
- Sound design carries causality

### Lip Sync / Dialogue
Use the Talking Shot Strategies table above.

### Tool Switch (Kling → Seedance or vice versa)
When a shot is HIGH RISK on one tool, check whether the other tool handles it better before applying cinematic workarounds:
- Flat 2D staging HIGH on Kling → switch to Seedance (respects flat plane better)
- Character consistency failing across 3+ Kling shots → switch to Seedance `@ElementName` element reference
- Multi-shot montage breaking in Kling → switch to Seedance native multi-shot syntax
- Fine hand/finger work or complex physics HIGH on Seedance → switch to Kling (better articulation)
- Expression control failing on Seedance → switch to Kling Element binding + expression vocabulary

**Cost of switching:** Changing tools mid-sequence may require adjusting character references for the target tool (both Kling and Seedance now reference the same OpenArt `@ElementName` elements) and translating END STATE syntax (see Continuity System → Cross-tool continuity). Seedance is ~7× cheaper per minute than Kling (~$1.32/min vs ~$9/min). Factor this into the decision — a tool switch is worth it for a stubborn HIGH RISK shot, not for a marginal MEDIUM.

See `SKILL.md` → Tool Selection for the full decision table.

---

## Resolution and Aspect Ratio Confirmation Gate

Before generating any Kling or Seedance prompts, the skill **must** ask the creator to confirm the project's output format. This is a blocking gate — do not proceed until confirmed.

**Ask the creator:**

> Before I generate prompts, I need to confirm your output format:
>
> 1. **Aspect ratio:** 9:16 (vertical — Shorts, Reels, TikTok) or 16:9 (horizontal — cinematic, music video, short film)?
> 2. **Kling resolution:** `std` (720p) or `pro` (1080p) as the project default? Individual hero shots can override to `pro` regardless.
> 3. **Seedance resolution:** 720p (upscale in post with Topaz Video). Confirm?

**What the confirmation determines:**

| Setting | 9:16 Vertical | 16:9 Horizontal |
|---|---|---|
| Lens family | Spherical primes | Anamorphic primes (2x squeeze) |
| Composition | Top-to-bottom stacking | Left-to-right lateral |
| Camera movements | Tilt, crane, dolly favored | Pan, tracking, dutch tilt favored |
| Group scenes | Depth stacking | Left-to-right reading order |
| Bokeh | Circular spherical | Oval anamorphic |
| Negative prompts | Include vertical format block | Skip vertical block |
| Quality guards (Seedance) | Vertical format guard | Horizontal format guard |
| NanoBanana storyboard images | 9:16 framing | 16:9 framing |

Record the confirmed format in the project's `project.yaml` under `aspect_ratio` and `default_resolution`. Apply to every prompt's frontmatter and body.

---

## Workflow

1. **Receive storyboard** from story-saint-storyboard (TSV + shot directories with `nb-prompt.md` per shot)
2. **Resolution and Aspect Ratio Confirmation Gate** — before generating any prompts, confirm the project's output format with the creator. Ask for explicit confirmation of:
   - **Aspect ratio:** 9:16 (vertical short-form) or 16:9 (horizontal cinematic). This determines lens family (spherical vs anamorphic), composition strategies, camera movement palette, group scene arrangement, and negative prompt/quality guard assembly
   - **Kling resolution:** `std` (720p) or `pro` (1080p) as the project default. Individual hero shots can override to `pro` regardless of default
   - **Seedance resolution:** 720p (upscale in post with Topaz Video)
   Do not proceed to prompt generation until the creator confirms. Record the confirmed format in the project's `project.yaml` and apply it to every prompt's frontmatter and body.
3. **Verify character element files** in `storyboard/characters/` — these are created during the Character Design phase (workflow Step 8a), not here. Confirm every recurring character has `status: reference-done` and complete visual anchors. For characters appearing in Kling **or Seedance** shots, verify `element_status: created` — the OpenArt element must exist before prompts can reference it by `@ElementName` (both tools now reference the same elements). If any character files are missing or incomplete, return the creator to the Character Design phase before proceeding.
4. **Verify character consistency check passed** — storyboard images must have been checked against visual anchors (storyboard.md Step 9). If not done, return to storyboard phase.
4b. **Verify continuity manifests are current** — for every scene, check that the `last_validated` date in `storyboard/continuity/scene-{N}-objects.md` is not older than the most recent modification to any shot in that scene. If stale, return to storyboard phase for re-validation (Steps 6b and 6c) before generating prompts.
5. **Verify `voice_design.md` exists** — voice design (workflow Step 8c) must be complete before generating `elevenlabs.md`. If missing, return the creator to the voice design phase.
6. **Evaluate each shot** against the risk matrix (skip `asset_type: still` and `asset_type: kling-reuse` shots — stills have no video generation risk; kling-reuse shots inherit risk from their source shot)
7. **Flag and rework** any HIGH RISK shots. After reworking, **re-validate multi-shot groups** — if a shot changed tool or risk level, its multi-shot group may need to be updated (remove the shot, split the group, or reassign). **Re-validate `kling-reuse` shots** — if a source shot's `asset_type` changed (e.g., from `kling` to `seedance`), any `kling-reuse` shot pointing to it via `reuses` becomes invalid and must be reclassified. **Sync the storyboard TSV** — if any shot's `asset_type`, `risk`, or `multi_shot_group` changed, update the TSV Notes column and the corresponding `shot.md` frontmatter to match
8. **Calculate speech durations** for all dialogue shots
9. **Assign talking shot strategies** for all `speech_on_camera: true` shots
10. **Assign Kling resolution per shot** — use the project default from Step 2. Override to `pro` for hero shots, ECU faces, thumbnails, and shots that will be cropped/zoomed in post.
11. **Generate style files** in `storyboard/styles/` — formalize the style anchors defined conceptually during storyboarding (storyboard.md Step 3) into production-ready style files. Include Visual Language mood definitions with film look, lens behavior, palette per mood. Include both Kling style anchors and Seedance `[Visual Style]` direction per mood. **Include Camera Rig Definitions** — define per-world camera rigs (camera body, lens family, filter stack, film emulation, color grade, bokeh character) using the confirmed aspect ratio. See style file template → Camera Rig Definitions
12. **Generate Kling prompts** in `storyboard/video-prompts/{code}/kling-prompt.md` — for shots with `asset_type: kling`. Default to I2V using the NanoBanana storyboard image as start frame. **Skip `asset_type: kling-reuse` shots** — these reuse another shot's Kling generation (no new video prompt). Verify the `reuses` field points to a valid source shot code. Use the confirmed aspect ratio in both frontmatter and prompt body. **For I2V shots: apply the I2V Start Frame Filter to every block before writing the file.** The start frame carries framing, composition, environment, lighting, and character appearance — the prompt describes only what CHANGES. Read each block back and delete anything that describes how things look rather than how they move.
12b. **Cross-layer start-frame validation (mandatory).** After writing each kling prompt, verify alignment between the nb-prompt and the kling prompt's opening action:
   - For `start_frame: storyboard` shots: the nb-prompt IS the kling start frame. The kling prompt's opening action must begin from the exact physical state depicted in the nb-prompt's `[Subject]` and `[Action]` blocks. If the nb-prompt shows a character with a folded garment at waist height but the kling action starts with "lifts garment over head," the kling action must be rewritten to start from the depicted state.
   - For `start_frame: prev_frame` shots: the kling prompt's opening action must begin from the previous shot's END STATE (or, when `start_frame_shot` is set, the chain predecessor's — see next bullet). Verify the previous kling prompt's end-state annotation matches this shot's opening physical state.
   - For shots with `start_frame_shot: {code}` set (setup-chain return): resolve "previous shot" to the named chain predecessor, NOT the literal previous shot. The predecessor's last frame IS this shot's start frame, so its setup, lighting, and framing must match the predecessor verbatim, and the opening action must begin from the predecessor's END STATE. Verify the predecessor's end-state annotation matches this shot's opening physical state.
   - Check wardrobe consistency: verify the kling prompt's `[Subject]` describes the character in the wardrobe they're actually wearing at this point in the scene (per the continuity manifest's Wearing column), not the character element's default appearance.
   - Flag any mismatch. Fix the kling prompt to match the nb-prompt (not the other way around — the nb-prompt was validated during storyboarding and the generated image is the ground truth).
13. **Generate Seedance prompts** in `storyboard/video-prompts/{code}/seedance-prompt.md` — for shots with `asset_type: seedance`. Reference each character/world by its OpenArt element `@ElementName` (like Kling) with a `[Subject]: @ElementName — {motion}` line — no reference-sheet upload, no Identity Block in the body. End the body with `Use @image1 as start frame.` Apply the Details Law. Include motivated lighting (Cardinal Rule 4) in `[Camera Capture]`. Use positive-framed quality guards, not traditional negatives. For `r2v` mode shots: set `start_frame: null` and ensure `character_lock` is set (required for r2v — the `@ElementName` element locks identity without constraining frame 1). Use the confirmed aspect ratio.
14. **Verify character counts** — every Kling multi-shot prompt under 500 characters per shot (single-shot I2V prompts are not subject to this limit). **Budget guide:** each `@element_name` = 37 chars. Boilerplate lines (`[MOTION SCALE: X]` + `Aspect ratio: {ratio}`) ≈ 40 chars. With 3 elements (111 chars) + boilerplate (40 chars), you have ~349 chars left for `[Cinematography]` + `[Subject]` + `[Action]` + `[Context]` + `[Style & Ambiance]`
15. **Verify Element count** — no Kling shot references more than 3 Elements
16. **DURATION SYNC CHECK** — shot durations must match the storyboard TSV's Duration column exactly. **Speech duration precedence:** if the speech duration formula (Step 8) produces a different duration than the TSV, the formula wins — update both the TSV Duration column and the `shot.md` frontmatter `duration` field to match. The original TSV duration was a storyboard-phase estimate; the formula-derived duration is the production-ready value. Document the override in the shot's Notes column: "Duration updated from Xs to Ys per speech duration formula."
17. **Assemble negative prompts** per shot using the Negative Prompt Assembly Guide — follow assembly order: Identity → Physics → Vertical (if 9:16, skip for 16:9) → Period/genre → Artistic → Shot-specific. For Seedance: assemble positive quality guards using the same domain order (see Seedance Positive Quality Guard Assembly) — use Horizontal format guard for 16:9 projects, Vertical format guard for 9:16.
18. **Include fallbacks** for all MEDIUM RISK shots
19. **Generate ElevenLabs voiceover script** if dialogue present — select voice states using the Storyboard Emotion → Voice State Mapping table in `voice-design.md`. Derive ElevenLabs `speed` from the shot's `speech_pace` field (see `voice-design.md` → Integration with animation-prompts); emotional state speed overrides speech_pace speed when they conflict. Document any overrides.
20. **Generate Suno music blocks** if music in scope

## Iteration Workflow — Diagnose, Adjust, Regenerate

After generation, review each output and iterate. The knowledgebase gives you the vocabulary to fix specific problems — don't regenerate blindly with the same prompt.

### Step 1: Diagnose the Failure Category

| What's wrong? | Category | Where to look |
|----------------|----------|---------------|
| Character looks different, drifts mid-clip | **Identity** | Kling: `reference/kling-reference.md` → Troubleshooting, Element Binding. Seedance: `reference/seedance-reference.md` → Character Lock, Identity Block |
| Objects float, slide, bounce wrong, no weight | **Physics** | `reference/kling-reference.md` → Dynamic Physics Vocabulary |
| Body effort looks fake, no strain | **Body mechanics** | `reference/kling-reference.md` → Body Mechanics Under Load |
| Scale shifts, depth looks wrong | **Spatial** | `reference/kling-reference.md` → Spatial Scale and Depth Ordering |
| Camera does wrong thing or multiple things | **Camera** | Kling: `reference/kling-reference.md` → Camera Vocabulary, Combining Instructions. Seedance: `reference/seedance-reference.md` → Camera Movements |
| Shot feels flat, generic, not cinematic | **Artistic** | `reference/nanobanana-artistry.md` → Quality Boosters, Film Look Vocabulary, Lens Character |
| Lighting is flat or contradictory | **Lighting** | Kling: `reference/kling-reference.md` → Style Anchors by Mood. Seedance: `reference/seedance-reference.md` → Cardinal Rule 4 (Motivated Lighting). Rewrite `[Lighting]` block with named sources mapped to body parts |
| Expression doesn't read | **Performance** | `reference/kling-reference.md` → Expression Control, Micro-Expression Language |
| Vertical shot feels like phone video | **Format** | `reference/cinematography.md` → 9:16 Vertical Format, Cinematic Enhancement |
| Motion too chaotic or too subtle | **Motion scale** | `reference/kling-reference.md` → Motion Scale Guide |
| Character morphs between stitched clips | **Seedance Identity** | `reference/seedance-reference.md` → Anti-Mush Guard, Identity Block repetition |
| Seedance output looks mushy, over-blended | **Seedance Mush** | `reference/seedance-reference.md` → Anti-Mush Guard. Deploy guard paragraph; shorten clip duration |
| Seedance ignores quality guards | **Seedance Framing** | Rewrite negative-style guards as positive affirmative statements (see Seedance Positive Quality Guard Assembly) |
| Character name leaks into Seedance prompt | **Seedance Cardinal Rule** | `reference/seedance-reference.md` → Cardinal Rule 2. Replace names with visual markers throughout |
| I2V prompt describes things visible in start frame | **I2V Noise** | Re-read every block through the I2V Start Frame Filter. Delete framing from `[Cinematography]`, appearance from `[Subject]`, environment from `[Context]`, steady lighting from `[Style & Ambiance]`. The prompt should be dramatically shorter after filtering |
| `[Action]` reads like a screenplay, not motion direction | **Narrative Leak** | Strip emotion words, inner thoughts, acting notes, metaphor. Keep only physical motion: what body part moves, in what direction, at what speed. Test: "can I mime this?" — if not, delete it |

### Step 2: Adjust the Specific Prompt Layer

Don't rewrite the whole prompt. Change only the layer that failed:

- **Physics failed** → Rewrite `[Action]` with explicit physics vocabulary. Add physics negatives.
- **Scale wrong** → Rewrite `[Context]` with body-relative sizes and depth labels. Add `inconsistent scale, distorted proportions` to negatives.
- **Too flat** → Add film look, lens character, and 2-3 quality boosters to `[Style & Ambiance]`.
- **Camera wrong** → Rewrite `[Cinematography]` with one clear movement from the vocabulary. Check for accidental compound movements.
- **Body effort fake** → Add biomechanics to `[Action]`: heel strikes, weight transfer, muscle strain. Add struggle cues.
- **Vertical weak** → Add vertical composition cues: depth layering, vertical lines, vertical negative space. Add vertical negatives.
- **Lighting flat or contradictory** → Rewrite Seedance `[Lighting]` block: name every source, map to body parts, state warm/cool split, exclude studio light. See Cardinal Rule 4 in `reference/seedance-reference.md`.
- **Background elements too prominent** → Add scale suppression language: "visible only as small distant background elements," "dwarfed by the depth of frame." See `reference/seedance-reference.md` → Background / Ensemble Scale Suppression.
- **Extra characters appearing** → Add count guard: "Exactly N figures, no extra characters." See `reference/seedance-reference.md` → Group Scenes → Count Guard.
- **I2V noise** → Run each block through the I2V Start Frame Filter. Delete everything the start frame already shows. A tight I2V prompt is often 3 blocks: `[Cinematography]` (one movement verb), `[Subject]` (element ref + action-relevant starting pose only), `[Action]` (physical motion sequence).
- **Narrative leak in `[Action]`** → Remove every clause that fails the mime test. "Her expression tightens — not hostile, tired" → delete. "Jaw clenches, lips press flat" → keep. Emotion lives in the performance the start frame sets up, not in prose Kling can't render.

**Seedance block equivalents:** When adjusting Seedance prompts, the block names differ from Kling:
- Kling `[Cinematography]` → Seedance `[Camera]`
- Kling `[Context]` → Seedance `[Environment]`
- Kling `[Style & Ambiance]` → Seedance `[Visual Style]` (placed near top, not end)
- Kling `[Style & Ambiance]` (lighting part) → Seedance `[Lighting]` (dedicated block for motivated lighting)
- Kling negative prompts → Seedance positive quality guards (see Seedance Positive Quality Guard Assembly)
- Seedance `[Audio]` has no Kling equivalent — diegetic sound cues live in the Seedance prompt body

### Step 3: Regenerate and Compare

- Generate the new version alongside the old (don't discard the original yet)
- If the fix worked but introduced a new problem, the new problem is usually in the layer you didn't change
- For stubborn shots: verify the NanoBanana storyboard image matches frame 1 blocking — if not, regenerate the `nb-prompt.md` to anchor spatial layout before re-running Kling
- For complex physics: split into shorter clips (the fewer seconds of physics to simulate, the more reliable the result)

### When to Rework Instead of Iterate

If a shot fails 3+ times on the same failure mode after targeted adjustments, it's a shot design problem, not a prompt problem. Go back to the risk matrix — the shot is probably HIGH RISK and needs a cinematic workaround from the Workaround Playbook.

---

## Prompt Quality Checklist

Before outputting any files, verify:
- [ ] Every prompt has a risk tag
- [ ] No prompt asks for more than one focal action
- [ ] No prompt asks for more than one camera instruction
- [ ] All HIGH RISK shots have been reworked
- [ ] All MEDIUM RISK shots have fallback prompts
- [ ] Motion scales assigned to every Kling prompt
- [ ] Duration recommendations included
- [ ] Style anchors placed per tool — Kling: in `[Style & Ambiance]` (end of prompt body); Seedance: in `[Visual Style]` (near top of prompt body)
- [ ] Elements referenced with `@element_name` syntax with space after
- [ ] **I2V Start Frame Filter passed** — every I2V Kling prompt checked block-by-block: no framing in `[Cinematography]` (movement verb only), no appearance/pose-from-image in `[Subject]`, no narrative/emotion in `[Action]` (physical motion only), no start-frame-visible content in `[Context]`, `[Style & Ambiance]` omitted unless mood shifts mid-clip
- [ ] **No character appearance re-descriptions** in Kling prompts (Element handles identity)
- [ ] **Seedance prompts reference characters/worlds as `@ElementName` elements** (like Kling) — no Identity Block in the body, no reference-sheet upload; `@image1` reserved for the start frame, body ends with `Use @image1 as start frame.`
- [ ] **Three-Detail Audit applied to ALL video prompts** (Kling and Seedance): environmental pressure in `[Context]`/`[Environment]`, physical micro-action in `[Action]`, sound anchor or visual motif. The audit is universal — "Details Law" is the Seedance name for the same check
- [ ] **Seedance prompts apply Details Law**: environmental pressure + physical micro-action + sound anchor
- [ ] **Flat staging shots (Kling)** include explicit "perpendicular to action plane, no depth perspective" in prompt + reinforced in negative block
- [ ] **Flat staging shots (Seedance)** include explicit flat staging instruction + positive framing reinforcement (see Seedance Positive Quality Guard Assembly)
- [ ] **DURATION SYNC: Every shot's video duration matches script timing**
- [ ] Speech durations calculated via formula, not guessed
- [ ] No dialogue line silently truncated — lines >12s split or routed to VO
- [ ] Every `speech_on_camera: true` shot has a strategy assigned
- [ ] Every `direct_address_close_up` has a fallback
- [ ] **Every Kling multi-shot prompt under 500 characters per shot** (single-shot I2V not subject to this limit)
- [ ] **No shot references more than 3 Elements**
- [ ] Every continuation shot has start-state anchor
- [ ] Every shot has END STATE block
- [ ] Spatial blocking explicitly stated
- [ ] **Kling `resolution` field set per shot** — `pro` for hero shots, ECU faces, thumbnails; `std` for everything else
- [ ] **Seedance quality guards use positive framing** — no traditional negative prompts (Seedance ignores them)
- [ ] **Capture Realism block present** (before `[Camera Capture]`, unless glossy/clean register requested) — four mechanics tuned to scene: suspended-atmosphere depth, moisture-without-shine (if wet), per-zone specular kill + flattering ceiling (skin sentence dropped on no-human plates), contrast curve stated three ways. No gear/grade/frame-rate overlap with `[Camera Capture]`. See `reference/seedance-reference.md` → Capture Realism Block
- [ ] **Seedance `camerafixed` consistent with `[Camera]` block** — when `camerafixed: true`, the `[Camera]` block says `Static` or is omitted; when `camerafixed: false`, the `[Camera]` block describes a specific movement
- [ ] **Seedance `[Audio]` block contains diegetic sound only** — no dialogue text (creates visual ghosts), no music cues (Cardinal Rule 3). All dialogue/VO routed to ElevenLabs via `elevenlabs.md`
- [ ] **Seedance `r2v` mode validated** — every `r2v` shot has `character_lock` set and `start_frame: null`
- [ ] **Seedance clips over 5s structured appropriately** — prefer 5s clips for best quality. Clips of 6-8s are acceptable for single continuous actions. Clips over 8s should be split. Sequences of 15s+ must be split into stitched 3×5s clips with matched END STATE → start-state anchors
- [ ] **Cross-layer start-frame validation passed** (Step 12b) — every kling prompt's opening action matches the physical state depicted in the nb-prompt (`start_frame: storyboard`) or the previous shot's END STATE (`start_frame: prev_frame`). Wardrobe in kling `[Subject]` matches the continuity manifest's Wearing column, not the character element's default
- [ ] **Setup-chain returns wired** — every shot with `start_frame_shot` set is a same-setup return (same subject + angle + closeness): `start_frame: prev_frame`, the start frame sourced from the chain predecessor's last rendered frame (no fresh nb image), and Step 12b validates setup, lighting, and opening state against that predecessor. Different-closeness returns to the same subject are not set here — they stay `null` and use Step 6c state carry. See `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains
- [ ] NanoBanana storyboard images (`nb-prompt.md`) verified — each depicts correct frame 1 state for Kling I2V
- [ ] **Character consistency check passed** — all storyboard images verified against visual anchors before prompt generation
- [ ] **Kling Element reference images** — 4 images per Element (front three-quarter, side profile, back three-quarter, ECU face). Kling supports 2–4; the pipeline uses the full 4 for maximum identity anchoring
- [ ] **Multi-shot groups re-validated after risk re-evaluation** — if risk assessment changed a shot's tool or risk level, verify that its multi-shot group is still valid (same tool, compatible elements, ≤6 shots per group)
- [ ] **Dramaturgy checks** — each shot's emotional beat matches the story arc; Promise→Progress→Payoff structure intact; no beautiful-nothing shots; every shot passes the Three-Jobs Rule: changes emotion, advances action, or increases pressure (see `reference/video-dramaturgy.md` §§ 2, 10)
- [ ] Character files in `storyboard/characters/` with complete frontmatter
- [ ] Style files in `storyboard/styles/` with palette-specific anchors
- [ ] `elevenlabs.md` uses `eleven_v3`, audio tags (not SSML), direction notes
- [ ] `elevenlabs.md` voice states selected via Storyboard Emotion → Voice State Mapping table (`voice-design.md`), with overrides documented
- [ ] `suno.md` music blocks cover emotional zones, silence marked where applicable
- [ ] Shots with physical motion include physics vocabulary in `[Action]` (see `reference/kling-reference.md` — Dynamic Physics)
- [ ] Shots with physical motion include physics negative prompts
- [ ] **Aspect ratio confirmed** — Resolution and Aspect Ratio Confirmation Gate completed before prompt generation. All prompts use the confirmed format
- [ ] 9:16 shots use vertical composition strategies (see `reference/cinematography.md` — 9:16 Vertical Format) and include vertical negative prompts
- [ ] 16:9 shots use horizontal/anamorphic composition strategies (see `reference/seedance-reference.md` → 16:9 Horizontal Anatomy) and anamorphic lens character from the project's camera rig definition
- [ ] **Motivated lighting (Cardinal Rule 4)** — every Seedance `[Lighting]` block names sources, maps them to body parts, states warm/cool split, and explicitly excludes unexplained studio light
- [ ] **Camera rig consistency** — all prompts reference the per-world camera rig from the project's style file, not ad-hoc camera/lens specs
- [ ] **Hero shot NanoBanana prompts use production-grade prose mode** — 500-1000 word continuous prose briefs (see `reference/nanobanana-artistry.md` → Production-Grade Prose Mode)
- [ ] **Hyperrealism block applied to hero shots** — canonical block from `reference/nanobanana-artistry.md` → Hyperrealistic Photography Block, customized with project-specific film stock, ASA, and references
- [ ] **Group shots include count guard** — exact character count stated AND extras explicitly negated ("exactly four figures no fifth no sixth"). See `reference/seedance-reference.md` → Group Scenes → Count Guard
- [ ] **Group shots include expression register** — shared expression baseline named before individual character descriptions. See `reference/seedance-reference.md` → Group Scenes → Group Expression Register
- [ ] **Background elements use scale suppression** — background objects described with emphatic scale language ("small distant," "dwarfed by depth of frame") to prevent foreground-scale rendering
- [ ] **Hero shot wardrobe at production-grade depth** — garments described with material, fit, print technique, print content, ink condition, hem position, light interaction. Not just "material and condition." See `reference/seedance-reference.md` → Wardrobe Description Depth
- [ ] **Filter stack appropriate per context** — diffusion filters (Black Pro-Mist, Glimmerglass) for performance/narrative; no filter for BTS/documentary. See `reference/seedance-reference.md` → Filter Stack Guidance
- [ ] **BTS crew described as characters** — background crew in BTS shots described with full visual markers (race, hair, wardrobe, tools), not just "a crew member"

## Reference Files

- For Kling capabilities, motion scales, expression control: `reference/kling-reference.md`
- For Seedance 2.0 character locking, multi-shot, anti-mush guard, Details Law: `reference/seedance-reference.md`
- For NanoBanana reference prompt templates: see NanoBanana Reference Prompt Templates section above
- For NanoBanana prompting rules and artistic prompting — natural language, film stocks, lens character, emotion→palette: `reference/nanobanana-artistry.md`
- For voice design methodology, ElevenLabs settings, audition process: `voice-design.md` (skill file)
- For project voice profiles at runtime: `{project}/voice_design.md` (project output — generated by voice-design skill)
