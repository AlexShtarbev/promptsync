---
name: story-saint-storyboard
description: >-
  Storyboarding extension for story-saint. Use after character designs are locked to
  produce production-ready files: (1) a TSV storyboard importable into
  Google Sheets, (2) per-shot PromptSync directory structure with shot.md
  and nb-prompt.md files, and (3) project.yaml metadata. Triggered when
  the user says "storyboard it", "create the storyboard", "image prompts",
  "create stills", or when story-saint completes a locked script and the
  creator is ready for visual production.
---

# Story Saint — Storyboard

Production extension for story-saint. Converts a locked script into production-ready files for the PromptSync visual production pipeline:

1. **TSV Storyboard** — Google Sheets compatible. One row per shot.
2. **PromptSync Shot Directories** — Per-shot `.md` files. Ready for the PromptSync dashboard.
3. **Image Prompts** — NanoBanana prompt per shot, embedded in the per-shot `nb-prompt.md` file. These storyboard images double as Kling I2V start frames.
4. **Project Metadata** — `project.yaml` with project-level configuration.

This skill picks up after character designs are locked (workflow Step 8a). Do not use this skill if the script is not locked or character designs are missing — return the creator to the appropriate phase first.

---

## Where This Fits in the Workflow

```
story-saint Steps 1–7 → script locked
→ Step 8a: Character Design → character element files locked (storyboard/characters/)
→ Step 8b: story-saint-storyboard → TSV + PromptSync shot directories + project.yaml
    → character consistency check (Step 9 of this skill)
→ Step 8c: voice-design → voice_design.md
→ Step 8d: animation-prompts → Kling/Seedance video prompts + styles + elevenlabs.md + suno.md
→ Step 8e: viral-extraction (optional) → clip storyboards + distribution strategy
```

---

## Inputs Required

Before starting, confirm:
- Script is locked (all shots have VISUAL, AUDIO, VO, DURATION, BEAT defined)
- Character designs are locked — `storyboard/characters/{name}.md` exists for every recurring character with `status: reference-done`, approved reference images, and visual anchors
- AI animation pre-flight is complete (no unresolved HIGH RISK shots)
- Tool split is confirmed (which shots are Kling video, which are Seedance, which are stills)
- Project name and slug are confirmed

If any of the above are missing, say so and return the creator to the appropriate phase (story-saint for script issues, character design for missing character files).

---

## What This Skill Produces

### Output 1: `{project}_storyboard.tsv`

Tab-separated. Imports directly into Google Sheets. One row per shot.

**Columns:**

| Column | Content |
|---|---|
| Shot | Shot ID: `0A`, `1A`, `1B`, `2A`, etc. If a beat is split for AI animation constraints, append lowercase: `2A` → `2Aa`, `2Ab`. If an extraction clip needs unique IDs, prefix with clip slug: `c1-1A` |
| Place / Setting | Location and period. "Mountain slope — timeless" |
| Emotion | Dominant emotion driving visual treatment. Maps to camera language (`reference/cinematography.md`) and color/palette (`reference/nanobanana-artistry.md` — Emotion → Color/Mood). Use project style mood name if defined. |
| Shot Type | Angle + size. "Low angle MCU", "Eye level WS". For 9:16: see `reference/cinematography.md` — 9:16 Vertical Format. |
| Camera Movement | Static / Dolly in / Dolly out / Tilt up / Rack focus / Tracking / etc. For 9:16: favor vertical movements; see `reference/cinematography.md` → Vertical Combination Patterns. |
| Duration | In seconds: 3s, 5s, 8s, etc. |
| Color & Mood | Film look + palette + lighting (behavioral, no brand names). Reference emotion→palette table or project style mood. E.g., "warm fine-grain-negative warmth. Soft window light. Muted amber." Be specific enough for prompt derivation. |
| Subject & Action | What is visible and what is happening. Present tense. For physical effort, include physics cues (see `reference/kling-reference.md` — Dynamic Physics). |
| VO/Lines | Exact VO line for this shot, or on-screen text card prefixed with `TEXT:`, or (silence) / (exhale only). If a shot has both VO and text card, list both: `TEXT: "5 words" / VO: "spoken line"` |
| SFX / Audio | Sound design notes for this shot |
| Shot image | Leave blank — filled after still generation |
| Notes | Tool (Kling/Seedance/Still), risk level, format (16:9/9:16), physics notes, key production notes |

### Output 2: PromptSync Shot Directories

For every shot in the storyboard, create a directory under `storyboard/shots/{code}/` containing two files:

#### `storyboard/shots/{code}/shot.md` — Shot metadata (unchanged)

```markdown
---
shot: "{code}"
setting: "{place/setting from TSV}"
emotion: "{dominant emotion — drives camera language and color/palette choices}"
shot_type: "{EWS|WS|LS|FS|MLS|MWS|MS|MCU|CU|ECU|Profile|POV|OTS|Reverse|Insert|Two-Shot|Three-Shot|Master|Establishing|Cutaway|Reaction}"
camera: "{Static|Dolly in|Dolly out|Tilt up|Tilt down|Crane up|Crane down|Rack focus|Pan|Dolly|Tracking|Handheld|Whip pan|Crash zoom|Parallax tracking|Ground level|Orbit}"
duration: "{Xs}"
color_mood: "{film look + palette + lighting direction}"
aspect_ratio: "{16:9|9:16|1:1}"
status: draft
asset_type: "{still|kling|seedance|kling-reuse}"
reuses: null
start_frame_shot: null             # setup-chain predecessor (same subject + angle + closeness) whose last frame becomes this shot's I2V start frame — set on a same-setup return. null = fresh storyboard image. Different-closeness subject returns stay null (Step 6c state carry). See shot-flow-and-editing.md → Setup Chains
palette_group: "{palette name or null}"
risk: "{low|medium|high}"
multi_shot_group: null             # Kling only — groups shots for Kling multi-shot T2V batching. null for Seedance and still shots
speech_pace: null
speech_on_camera: null         # true if speaking character's mouth is potentially visible (MCU, CU, MS facing camera); false if off-screen, back-of-head, silhouette, or wide shot; null if no dialogue
elements:                      # PascalCase element_name from character file — must match exactly. No spaces. e.g. DadAfter, not "Dad After"
  - {ElementName1}
  - {ElementName2}
---

## Subject & Action
{What is visible and what is happening. Present tense. Specific.}

## VO / Lines
{Exact VO line, or (silence)}

## SFX / Audio
{Sound design notes}

## Notes
{Tool, risk level, key production notes. Reuse info. Palette connections.}
```

#### `storyboard/shots/{code}/nb-prompt.md` — NanoBanana image prompt

This is the storyboard image prompt AND the Kling I2V start frame. One image serves both purposes.

**Use `@ElementName` shorthand.** Characters, props, and environments that have locked element files in `storyboard/characters/` or `storyboard/environments/` are referenced by `@ElementName` (e.g., `@Sisyphus`, `@CarvedBoulder`, `@MountainSlope`). The `@ElementName` must exactly match the `element_name` from the element's .md file, which itself is derived from the kebab-case file prefix converted to PascalCase (see Step 2 rules). OpenArt expands `@ElementName` to the element's Identity Block at generation time — the element's reference images and identity text anchor consistency. This keeps the `nb-prompt.md` focused on shot-specific direction instead of repeating identity descriptions.

**What still goes inline (not shorthand):**
- Shot-specific pose and expression ("body hunched, shoulder driving into stone")
- Key identity markers from the Visual Anchors that are critical for this specific shot ("black eyes forward, not down" in a face shot)
- Shot-specific atmospheric additions appended AFTER the canonical environment block (see Step 2b.4)

**Canonical environment block rule:** The `[Environment]` block must begin with the frozen canonical text from the environment lockdown file (Step 2b.4). This text is identical across every shot in that location — it names the anchor objects and their positions, preventing spatial drift. Shot-specific atmospheric details (dust, wind, time-specific light changes) may be appended after the canonical core but must not contradict or omit any anchor object or spatial relationship.

**Prompt format uses labeled blocks** — the same structure OpenArt uses when enhancing prompts. Each block contains descriptive prose (not keywords). This aligns nb-prompts with the Kling prompt format and makes individual dimensions easy to iterate on.

```markdown
---
shot: "{code}"
aspect_ratio: "{9:16|16:9|1:1}"
platform: "nanobanana"
---

[Scene & Mood]: {emotional register, palette direction, atmospheric tone. Volumetric: haze density, particulate behavior, light shaft presence and angle. Sets the visual temperature of the shot before any subject is described.}
[Frame Map]: {depth-plane decomposition — foreground: ..., midground: ..., background: ... Each plane gets atmospheric separation (haze between MG and BG, contrast loss in deep BG). Light shafts crossing planes. Volumetric depth is mandatory — the "flat air" AI look is eliminated by describing atmosphere between every depth plane. **For 2+ subject shots:** also anchor each subject to screen position, depth layer, contact points, and gaze BEFORE identity is described in [Subject] — e.g. "foreground-left, the taller figure at three-quarter facing camera-right; midground-right, the seated figure facing away." This stops characters drifting to the wrong side of frame. See `reference/nanobanana-artistry.md` → FRAME MAP.}
[Subject]: @CharacterName , {shot-specific appearance details relevant to this shot — visible injuries, sweat, expression}. Interacting with @PropName {prop state for this shot}.
[Action]: {Physical state at frame 1 — pose, weight distribution, muscle tension, micro-expression. Static frame, no motion verbs.}
[World Plate]: {CANONICAL ENVIRONMENT BLOCK from environment lockdown file — paste verbatim, do not improvise}. {Shot-specific atmospheric addition if any — appended after canonical core. Replaces [Environment].}
[Optical Realism]: {Behavioral capture + lens + aperture as physics package. Film look + grain intensity. 2-4 physical imperfections (grain, halation, chromatic aberration, vignette, etc.). 1-2 depth-dependent effects (atmospheric haze, lifted blacks, contrast loss). Volumetric depth effects included here. See nanobanana-artistry.md → OPTICAL REALISM section. Use behavioral descriptions not brand names — see animation-prompts.md → Behavioral Camera Language Reference.}
[Camera Capture]: {Format (Vertical 9:16 / Horizontal 16:9). Shot size, angle. Behavioral lens feel (not brand names). Quality boosters from nanobanana-artistry.md → Quality & Beauty Boosters. Resolution signal. Consolidates former [Cinematography] and [Technical] into one closing block.}
[Skin & Surface]: {Anti-plastic defaults — per-zone specular kill: zero shine on forehead, nose bridge, cheekbones, temples, chin. Peach fuzz on jaw and hairline catching edge light. Subsurface scattering at ears, fingertips, thin skin. Fine, soft, even pore texture and subtle tonal variation. **Flattering ceiling:** never harsh or clinical — no acne, no blemishes, no enlarged or cratered pores; resolve any tension toward fine-and-flattering, a face should look real and good at once. **Only include for MCU/CU/ECU and shots where skin detail is visible. Skip for WS/LS where skin is not readable.**}

Negative prompt: {Standard + anti-plastic (smooth plastic skin, airbrushed texture) + volumetric (flat atmosphere, uniform background density) + vertical + period-specific. See Standard Negative Prompt below.}
```

**Frontmatter fields explained:**

| Field | Values | Meaning |
|-------|--------|---------|
| `shot` | Shot code | Matches the directory name |
| `setting` | Free text | Location and time period |
| `shot_type` | Camera shot size abbreviation | From `reference/cinematography.md` |
| `camera` | Camera movement description | From `reference/cinematography.md` |
| `duration` | e.g. "6s" | Shot duration in seconds |
| `color_mood` | Free text | Color palette and emotional quality |
| `status` | `draft \| nb-ready \| nb-done \| kling-ready \| kling-done \| seedance-ready \| seedance-done \| complete` | Production status. Flow varies by asset_type — see Status Flow by Asset Type below |
| `asset_type` | `still \| kling \| seedance \| kling-reuse` | Which generation tool |
| `reuses` | Shot code or null | If this shot reuses another shot's Kling sequence *entirely* (visually identical — no new action). For same-setup returns with a new action delta, use `start_frame_shot` instead |
| `start_frame_shot` | Shot code or null | The **setup-chain predecessor** — an earlier shot with the same subject + angle + closeness — whose rendered last frame becomes this shot's I2V start frame. Set on a same-setup return: the prompter reuses that frame instead of a fresh nb image (implies `start_frame: prev_frame`), and Step 12b validates this shot's setup, lighting, and opening state against that predecessor. `null` (default) = fresh storyboard image. A return to the same subject at a **different** closeness is NOT set here — it stays `null` and uses the Step 6c state-carry audit. See `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains |
| `palette_group` | Free text or null | Groups shots with similar color palettes |
| `risk` | `low \| medium \| high` | AI generation risk level |
| `multi_shot_group` | Free text or null | Groups shots for Kling multi-shot batching |
| `speech_pace` | `dramatic \| normal \| fast \| null` | Speech pace for dialogue shots. Assign during storyboarding based on the scene's emotional context — this is a first-pass assignment that voice design (Step 8c) may refine. Default `dramatic` when in doubt. `null` for shots without dialogue. Pace tiers: `dramatic` = 100 WPM (emotional declarations), `normal` = 130 WPM (conversation), `fast` = 160 WPM (panicked speech). See `animation-prompts.md` → Pace Tiers for full definitions. Used by `voice-design.md` to derive ElevenLabs speed. |
| `speech_on_camera` | `true \| false \| null` | Whether the speaking character's mouth is potentially visible in the frame. `true` if MCU, CU, MS facing camera, two-shot with faces visible. `false` if off-screen, back-of-head, silhouette, or wide shot where mouth detail is indistinguishable. `null` for shots without dialogue. Determines which Talking Shot Strategy is needed during animation-prompts.md. |
| `elements` | List of element names | @element references used in this shot |
| `aspect_ratio` | "16:9" etc. | Aspect ratio |
| `platform` | `nanobanana` | Image generation platform |

### Output 3: `project.yaml`

```yaml
name: "{Project Title}"
slug: {project-slug}
created: {YYYY-MM-DD}
status: in-progress

drive_folder_id: null
default_style: null                  # set during animation-prompts.md Step 10 when storyboard/styles/ files are created
shot_prefix: ""

consistency_check:
  status: pending              # pending | passed | failed — updated by Step 9
  checked_date: null
  characters: []

element_creation:
  status: pending              # pending | complete | failed — updated by Step 10
  checked_date: null
  characters: []
```

---

## Workflow

### Step 1 — Extract Shots

Read the locked script. List every shot ID, duration, visual description, VO line, audio notes, and tool assignment. Do not begin writing until you have the full shot list.

### Step 1b — Spatial Continuity Audit

After extracting the full shot list, walk through every consecutive pair of shots and check for location changes. For every setting change (street → cafe, cafe → harbor, etc.), answer three questions:

1. **Bridge:** Can the audience track how the character got from location A to location B? If the character is outside in one shot and seated inside in the next, there must be a shot showing the crossing — a door, a threshold, movement through space.
2. **Geography:** Does the new location's spatial layout need establishing before the drama begins? If two characters will interact across a specific distance (one table apart, across a room, opposite sides of a street), the audience must see that distance before it matters.
3. **Pre-plant:** Is there a character already in the new location whose presence needs to be planted before the protagonist arrives? If the story depends on the protagonist noticing someone, the audience needs to see the protagonist arrive and discover that person — not cut to both already in position.

If any answer is yes and no bridging shot exists in the extracted list, flag it. Write the missing shot(s) before proceeding to Step 2.

**Why this exists:** The shot extraction algorithm selects shots based on emotional and dramatic function — beats with value movement, progressive complications, turning points. But some shots carry **spatial function** — they don't turn a value, they orient the audience in the physical world. When a location changes, spatial function is load-bearing. Without it, every subsequent scene in the new location starts at a deficit because the audience is disoriented. The three-detail audit (Step 6) checks what's inside a shot. This audit checks what's between shots.

**Common miss patterns:**
- Character walking toward a building → character already inside (missing: door/entry)
- Character in one room → character in another room (missing: hallway/transition)
- Two characters who must be near each other → both already positioned (missing: arrival + geography establishing)
- Time jump within the same location → no signal that time passed (missing: transitional beat or visual cue)

### Step 2 — Load @Elements from Character Design

Character elements are already locked in `storyboard/characters/{name}.md` from the Character Design phase (workflow Step 8a). Load them — do not redefine from scratch.

1. Read every file in `storyboard/characters/`. Each one is a locked @Element with 4 approved photorealistic reference images (front three-quarter, side profile, back three-quarter, extreme close-up face) and visual anchors. Characters with transformation states have multiple files: `{name}.md` (base) and `{name}-{state}.md` (variants) — each is a separate Element.
2. Verify each character file has `status: reference-done` and complete visual anchors. If any file is missing or incomplete, return the creator to the Character Design phase.
3. Add any **non-character elements** (environments, props, creatures) that appear across multiple shots but were not created during Character Design. Use the same frontmatter format from `templates/characters.template.md` with `element_type: environment | prop | creature` — omit the NanoBanana reference prompt sections (those are character-specific).

**Rules:**
- Every element has a unique @Name in **PascalCase with NO spaces**: `@Beethoven`, `@Study`, `@Piano`. Transformation states: `@BeethovenYoung`, `@BeethovenDeaf`. Never use spaces in `element_name` or `@Name` — spaces break OpenArt element binding
- **Naming derivation:** `element_name` is the kebab-case file prefix converted to PascalCase. Every word (including articles) becomes a capitalized segment: `the-father.md` → `TheFather`, `carved-bird.md` → `CarvedBird`, `cafe-center.md` → `CafeCenter`. The same PascalCase name must be used in the element file's `element_name` field, all `@Name` references in nb-prompts, all `elements` lists in shot.md, and the element name when creating in OpenArt. A mismatch at any point means the element won't bind during generation
- The `elements` list in shot.md and `@Name` references in nb-prompt.md must exactly match the `element_name` from the character file. If the character file says `element_name: "TheFather"`, the shot.md says `- TheFather` and the nb-prompt says `@TheFather`
- Character descriptions come from the locked character files — do not modify them here
- For characters with transformation states, reference the correct state Element per shot — never mix states within one Element
- Do not create elements for things that appear in only one shot — describe inline instead
- Max 3 elements per Kling generation batch

### Step 2b — Environment Lockdown

AI models have no spatial memory. Every generation starts from scratch — without explicit control, walls move, furniture teleports, objects appear and disappear between shots. Environment lockdown is the countermeasure: build the set empty first, lock the spatial geometry, then place characters into the locked set. This is set design, not background decoration.

**Template:** See `templates/environments.template.md` for the full environment lockdown file format.

Environment lockdown is required when:
- The same environment appears in **3+ shots** — without lockdown, each generation invents its own version of the same space (different stone texture, different light angle, different furniture placement)
- The environment has motivated lighting that must stay consistent across shots (side light, practicals, time-of-day)
- The environment is an **interior** — interiors are the highest-risk category for spatial drift (walls move, windows teleport, furniture multiplies)

Environment lockdown is optional only when:
- Every shot is an ECU/detail with no visible environment (rare for a full project)
- The project has a single shot per location with no consistency requirement

**The principle:** Generate environments empty first, then insert characters. Never let the model invent the room around the character — that forces spatial reinvention every shot.

#### 2b.1 — Identify Environments and Assess Risk

List every distinct location from the shot list. For each, assess spatial drift risk:

| Risk factor | HIGH | MEDIUM | LOW |
|---|---|---|---|
| Interior vs exterior | Interior (walls, furniture, windows) | Semi-enclosed (porch, gate, archway) | Open exterior (landscape, field) |
| Shot count | 10+ shots | 3-9 shots | 1-2 shots |
| Recurring across episodes | Yes — geometry must carry | No — single episode | N/A |
| Anchor objects | Many (table, cross, bed, window) | Some (bench, tree, gate) | Few (sky, ground) |
| Camera angle variety | Multiple angles including reverse | 2-3 similar angles | Single angle |

Interiors with 10+ shots and multiple camera angles are the highest risk. Prioritize these for full lockdown.

#### 2b.2 — Write the Spatial Map

For each environment, write a spatial map — a written description of the exact physical layout. This is not a prompt; it is a production document that every prompt references.

The spatial map must answer:
1. **What is in the space?** — Every object, surface, and architectural feature. Named and positioned.
2. **Where is everything relative to everything else?** — Spatial relationships using **relational positional language** (see Positional Language Convention below). Every object gets a fixed position described relative to the primary anchor (the room's focal point — altar, bed, desk, etc.) and at least one neighboring object.
3. **What does the camera see from each angle?** — For each camera direction used in the shot list, describe what is visible and what is behind the camera. Note how relational terms flip between angles: "camera-left" from angle A becomes "camera-right" from the reverse angle B.
4. **What is the lighting?** — Every light source, its direction, color temperature, and what it illuminates. Lighting must be consistent across all shots in this location. (Document the answer in the Lighting Lockdown section, not in the spatial map.)

**Positional Language Convention:** Use consistent relational terms throughout the spatial map, canonical environment block, anchor objects list, shot.md, nb-prompts, and kling/seedance prompts. The same object must be described with the same positional phrase everywhere it appears.

| Term | Meaning | Use when |
|------|---------|----------|
| `camera-left` / `camera-right` | Relative to the current camera angle | Describing what appears on which side of frame. Flips on reverse angles — always specify the camera angle when using these |
| `LEFT of X` / `RIGHT of X` | Relative to another named object | Fixed spatial relationship (does not flip with camera). Preferred for the spatial map and anchor objects list |
| `BEHIND X` / `IN FRONT OF X` | Depth relative to another object from the primary camera angle | Use sparingly — ambiguous on reverse angles. Prefer "between X and Y" or "closer to camera than X" |
| `beside` / `near` / `next to` | Adjacent, unspecified side | **Forbidden in spatial maps and anchor objects.** Too vague — the generator picks a random side. Always specify LEFT, RIGHT, or a compass/stage direction |
| `on the LEFT/RIGHT/CENTER of X` | Position on a surface | For objects resting on surfaces (phone on altar, book on desk). Specifies WHERE on the surface, not just that it's on it |
| `at {distance}` | Approximate metric distance | For depth relationships: "gate at 15m behind the bench." Gives the generator a scale cue |

**The approved master plate is the ultimate spatial lock.** Positional language guides the generator toward a composition that matches the approved plate. Once the plate is approved, the language must describe what the image shows — not the other way around. If the generated plate places the cabinet slightly right of where you wrote "LEFT of altar," update the language to match the approved image, not the other way around.

**Format:**

```markdown
## Spatial Map — {Location Name}

### Layout
{Written description of the physical space — dimensions, materials, key objects and their positions relative to each other. Use compass directions or stage directions (camera-left, camera-right, upstage, downstage) consistently.}

### Camera Angles Used
| Angle | Shots | What is visible | What is behind camera |
|---|---|---|---|
| {e.g., "Facing gate from bench"} | {1A, 4E, 5A} | {gate, path, headstones in soft focus} | {tree canopy above, bench below frame} |
| {e.g., "Reverse — facing bench from path"} | {6A, 6G} | {bench under tree, cemetery entrance} | {grave area, interior cemetery} |
```

Anchor objects, forbidden drift list, and lighting are documented in their own top-level sections (see 2b.5) — not nested inside the spatial map. The spatial map describes the layout and camera geography; the production checklists stand alone for quick reference during generation.

#### 2b.3 — Generate Master Plates

Generate **environment plates** — character-free reference images that lock the setting's architecture, lighting, atmosphere, and color palette. These become OpenArt elements referenced via `@EnvironmentName` in nb-prompts.

**How to generate:**

1. For each environment, generate a **Master Plate A** — wide establishing shot from the primary camera direction. No characters. Full lighting and atmosphere. Use the project's aspect ratio.
2. For environments with reverse-angle shots, generate a **Master Plate B** — the same space from the opposite camera direction. The two masters together define the full 180° geography. Use the "Reflected Eye Trick" — imagine what would be reflected in a character's eye or a mirror in the room to determine what exists behind camera A.
3. For high-shot-count environments (10+), generate **additional angle plates** for every distinct camera direction in the shot list.
4. Generate at NanoBanana Pro resolution — these are reference assets, not throwaway drafts.

**Zero-character guard:** Environment plates must contain no people. State this explicitly at the end of every environment prompt: `IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame. The space feels inhabited but empty.` Without this hard constraint, Seedance and NanoBanana will insert phantom figures — especially in domestic interiors and urban street scenes.

**Master plate prompt structure:**

```
[Detailed environment description — architectural materials with condition,
furniture/props with material specificity and FIXED POSITIONS matching the spatial map,
background elements at described distances],
[time of day], [weather and atmosphere], [specific lighting sources and their color
temperatures — map each source to what it illuminates], [atmospheric elements — haze,
fog, dust, mist with density and direction], photorealistic cinematic, [camera position
relative to physical landmarks in the scene — e.g., "camera at seated eye level facing
the iron gate"], [behavioral camera/lens description], [film look].
IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame.
The space feels inhabited but empty. Maintain strong negative space on [floor/ground/key area].
```

#### 2b.4 — Write the Canonical Environment Block

For each environment, write a **canonical `[Environment]` block** — a frozen paragraph that is copy-pasted verbatim into every `nb-prompt.md` for shots in that location. This is the single most important anti-drift measure.

**Rules:**
- The canonical block is written once during environment lockdown and never improvised per-shot
- It references the `@EnvironmentName` element, then adds the spatial anchors from the spatial map
- Shot-specific atmospheric variations (e.g., "dust catching the light" in one shot vs. "wind picking up" in another) are appended AFTER the canonical block, clearly separated
- The canonical block must name the anchor objects and their positions using the Positional Language Convention — these are the geometry locks that prevent drift. Use `LEFT of X` / `RIGHT of X` relational terms, not vague proximity ("beside," "near," "next to"). After master plate approval, verify the canonical block matches the approved image and update any positional terms that don't match what was generated

**Format:**

```
[Environment]: @EnvironmentName , {canonical description: key spatial relationships,
anchor objects in their fixed positions, lighting direction, atmospheric baseline}.
{Shot-specific addition if any — clearly after the canonical core.}
```

**Example:**

```
[Environment]: @CemeteryBench , stone bench camera-left under a spreading deciduous tree,
iron cemetery gate directly behind at 15 meters, gravel path between bench and gate,
headstones in soft focus camera-right and behind the gate, low stone wall running left
to right behind the headstones. Late afternoon, warm natural daylight filtering through
the tree canopy, dappled shadows on the bench and ground.
```

This exact text appears in every nb-prompt for shots 1A, 1B, 1C, 2A, 2C, 3C, 4A-4F, 5A-5M, 7A-7D. The model sees the same spatial description every time. Objects don't move.

Save the canonical blocks in the environment file alongside the spatial map and master plate prompts.

#### 2b.5 — Assemble the Environment Lockdown File

Save everything to `storyboard/environments/{world-name}.md`:

```markdown
---
name: "{Location Display Name}"
element_name: "{EnvironmentName}"
element_type: environment
appears_in: [{shot codes}]
status: draft
element_status: not-created
risk: "{low|medium|high}"
---

## Spatial Map
{From 2b.2}

## Anchor Objects
{Bulleted list. Each entry: object name + fixed position using relational language from the Positional Language Convention (e.g., "vestment cabinet — LEFT of the altar, against the N wall"). No vague terms (beside, near, next to). These positions are frozen after master plate approval — the language must match what the approved image shows.}

## Forbidden Drift List
{Bulleted list — these must NOT appear}

## Lighting Lockdown
{Light sources, directions, color temperatures — consistent across all shots}

## Master Plates

### Master Plate A — {Primary Angle} ({aspect_ratio}, 1K)
{NanoBanana prompt}

### Master Plate B — {Reverse Angle} ({aspect_ratio}, 1K)
{NanoBanana prompt — if reverse shots exist}

### Additional Angles
{Any further angle plates needed}

## Canonical Environment Block
{The frozen [Environment] paragraph from 2b.4 — copy-paste target for all nb-prompts in this location}

## Seedance Environment Reference
{Combined multi-angle sheet prompt used to author the OpenArt environment element Seedance references by @Name — if using Seedance}
```

Mark `status: draft` until master plates are generated and approved. Promote to `status: reference-done` after approval.

#### 2b.6 — Subject Visibility Audit

After assembling all environment lockdown files, verify that every shot's primary subject is physically visible from its assigned angle with the set in its scripted state. The environment lockdown process trusts the angle assignments from the shot breakdown — this step audits that trust.

**The algorithm:**

1. For each environment angle file, walk its `appears_in` list.
2. For each shot in the list, identify the shot's primary subject (from the TSV or shot.md).
3. Ask: **Can this subject be physically seen from this camera angle, given the set's state at this moment in the scene?**
   - Is the subject on the camera's side of all barriers (doors, walls, curtains)?
   - Has the subject arrived at this location by this point in the scene timeline?
   - Is the subject in front of the camera, not behind it?
   - Are interior-only objects (chain locks, coat hooks, furniture) assigned to angles that can actually see them?
4. If the answer is no — the angle assignment is wrong. Either:
   - Reassign the shot to a different existing angle that can see the subject
   - Create a new environment/angle for the shot (as with a building corridor vs. apartment interior)
   - Split the shot if it requires visibility from both sides of a barrier

**Common failures this catches:**
- Subject is on the other side of a closed or locked door (the 4C failure — Peter outside, camera inside, door closed)
- Subject hasn't entered the space yet at this point in the scene (camera inside before character crosses threshold)
- Interior objects (chain lock, coat hook) listed as visible from an exterior/corridor angle
- Character is behind the camera at the assigned angle
- A reverse-angle shot uses the forward-angle environment element

This audit is fast — one pass through the `appears_in` lists — and catches assignment errors before they get baked into canonical blocks and copy-pasted into every downstream prompt.

#### 2b.7 — Seedance Environment Combined Sheet

For projects using Seedance, also generate a combined multi-angle environment sheet — a single image showing the location from 2-3 camera positions on one canvas. Use it to author the OpenArt environment element that Seedance references by `@Name` (the same way Kling and NanoBanana reference environment elements). Save the prompt in the environment lockdown file's Seedance section. The single-angle master plates remain as OpenArt environment elements for NanoBanana prompts. See `reference/seedance-reference.md` → Environment Reference for the full workflow and zero-character guard.

#### 2b.8 — Depth Map Extraction (high-risk interiors only)

For interior environments with 10+ shots and multiple camera angles — the highest spatial drift risk — consider extracting a depth map from the approved master plate. The depth map encodes the spatial geometry (wall distances, furniture placement, floor plane) as a grayscale image that can be fed through ControlNet Depth in ComfyUI/Stable Diffusion pipelines. This forces the model to respect walls, floors, and furniture positions regardless of what character or action is being generated.

This step is optional and requires a ComfyUI pipeline. It is not available in NanoBanana or Kling directly. Note in the environment file whether depth maps have been extracted and where they are stored.

**Downstream usage:** During storyboard image generation (Step 7), environments are referenced via `@EnvironmentName` in the canonical `[Environment]` block of nb-prompts — the frozen text from 2b.4, not per-shot improvisation. OpenArt expands the element to the locked identity and reference images. The `[Lighting/Style]` block must state that the character is lit by the environment's actual lighting sources — not studio light. For Seedance video prompts: reference the environment as the `@Name` element in the `[World Plate]` block — same element name as NanoBanana/Kling. Set `environment_ref` in the shot's `seedance-prompt.md` frontmatter. The character must be lit by the environment's actual lighting sources, stated in the lighting block (see `reference/seedance-reference.md` → Multi-Subject Element Workflow).

### Step 2c — Generate Prop Plates (optional)

For hero props that appear across multiple shots or carry narrative weight (a signature weapon, a vehicle, a musical instrument, a game machine), generate **prop plates** — standalone multi-angle reference renders on a clean mid-grey seamless background, with no characters and no environment. These become OpenArt elements referenced via `@PropName` in nb-prompts.

Prop plates are recommended when:
- The prop appears in 3+ shots and must stay visually consistent
- The prop has complex surface detail (screens, decals, mechanical parts, wear patterns)
- The prop needs to be composited into different environments or lighting conditions

**How to generate:**

1. Identify hero props from the shot list — anything that appears repeatedly or is a focal point
2. Write a NanoBanana prompt per prop as a **multi-angle product reference sheet** — 4–6 panels on a single mid-grey seamless background showing the prop from multiple angles (three-quarter, front, side, detail close-up). Include full material specificity: surface finish, wear, mechanical detail, lighting interaction
3. Generate at NanoBanana Pro resolution
4. Save to `storyboard/props/{prop-name}.md` (prompt + reference)

**Prop plate prompt structure:**

```
A photorealistic multi-angle product reference sheet of [prop description with full material
specificity], displayed as [N] panels against a clean mid-grey seamless backdrop: [panel layout
with specific angles and framings]. The [prop] is identical in every panel — same dimensions,
same surface detail, same coloration. [Detailed material description — construction material,
surface finish, wear patterns, mechanical details, any screens or displays with their content
described, any decals or graphics described as non-readable]. Soft even studio product-render
lighting across all panels, consistent exposure, clean neutral mid-grey background, subtle floor
shadow. Photorealistic, hyper-detailed, material specificity on [key surface types].
IMPORTANT: No humans, no hands, no characters. Product render only.
```

**Composite workflow:** After generating the prop plate and the environment plate separately, create OpenArt elements for hero props so they can be referenced via `@PropName` in nb-prompts. The `[Subject]` or `[Environment]` block references the prop element; the `[Lighting/Style]` block ensures the prop is lit by the environment's actual sources. This two-step approach (render prop clean → reference as element in scene) produces more consistent results than trying to describe a complex prop inline within a busy environment prompt.

### Step 3 — Define Style Anchors

Define the visual style for each timeline layer. These anchors will be used downstream: Kling prompts place them in `[Style & Ambiance]` at the end of the prompt body (every Kling prompt opens with: `Photorealistic cinematic fantasy. Shot on ARRI Alexa. [style anchor].`); Seedance prompts encode the same palette, contrast, and grain in the `[Visual Style]` block near the top. Define the anchors here; they are consumed during prompt generation (animation-prompts.md).

Common timeline layers:
- **PRESENT** — the main story timeline
- **MEMORY / FLASHBACK** — the past. Always add: `Soft vignette edges. Slightly desaturated — memory treatment.`
- **TRANSITION** — between cold and warm, past and present
- **PAYOFF** — the emotional climax. Usually the warmest, richest light in the piece

**Note:** These are conceptual anchors — define the visual intent per timeline layer here, but do not write `storyboard/styles/` files yet. The production-ready style files (with Kling anchors, Seedance `[Visual Style]` direction, mood definitions, and negative prompt assembly) are generated during animation-prompts.md Step 10.

### Step 4 — Assign Risk Levels

Use the full 11-factor risk matrix from `animation-prompts.md` → Shot Risk Evaluation. Take the HIGHEST risk level across all factors. Be honest — label what's actually hard, not what you hope will work.

| Risk | Action |
|---|---|
| LOW | Generate normally |
| MEDIUM | Note watch-for, provide fallback |
| HIGH | Must be resolved before this step — return to story-saint if not |

**Video-generation-specific flags:**
- Crowd motion → environmental storytelling, imply crowd through sound and aftermath
- Many figures in motion simultaneously → generate separately, composite in editor
- Character running → silhouette or aftermath shot
- Hands passing objects → start mid-action, object already transferred
- Buttons/fine motor detail → show coat already on, hands smoothing only
- 2D flat staging → enforce in prompt with explicit "perpendicular to action plane, no depth perspective" and negative prompts
- Prosthetic in motion → Kling preferred (controlled motion); Seedance may interpret too freely

### Step 5 — Group into Batches, Palette Groups, and Multi-Shot Groups

Batch shots that share the same 1–3 elements. Name each batch by its story beat, not a letter alone.

**Batch rules:**
- Max 3 elements per batch
- Shots that open a new timeline layer start a new batch (present → memory = new batch)
- Shots within one continuous visual environment can share a batch

Assign palette groups to shots with similar color/mood palettes. This enables the PromptSync dashboard to group shots by palette for batch generation with consistent lighting.

**Multi-shot grouping (Kling only):** For each batch, apply the Generation Mode Decision Tree (`animation-prompts.md` → Continuity System) to decide which shots use individual I2V and which are grouped for Kling multi-shot T2V. Assign `multi_shot_group` names now — not at the prompt generation phase.

| Signal | → Mode | Rationale |
|--------|--------|-----------|
| Continuous emotional arc across 3–6 shots, same setting | Multi-shot T2V | Character identity persists; Kling handles internal transitions |
| Dialogue exchange between characters in same location | Multi-shot T2V | Character switches need continuity, not per-shot reframing |
| Shot must match precise NanoBanana storyboard composition | Individual I2V | Per-frame compositional control from the start frame |
| Shot continues from previous shot's end state (complex pose carry-over) | Individual I2V with `start_frame: prev_frame` | Precise physical state anchor needed |
| Standalone shot, no continuity dependency | Individual I2V with `start_frame: storyboard` | Default — NanoBanana image as start frame |

Document the grouping rationale in the Notes column of the TSV: "multi-shot group: [name] — [reason]."

**Seedance mode pre-assignment:** For `asset_type: seedance` shots, note the intended Seedance generation mode in the Notes column: `i2v` (NanoBanana start frame controls frame 1), `r2v` (character lock without constraining composition), or `t2v` (no start frame). The final mode is confirmed during animation-prompts.md, but flagging it here prevents mismatches between storyboard composition and the generation approach. If a Seedance shot's storyboard image won't be used as a start frame (r2v or t2v), note that in the Notes column so the creator knows the `nb-prompt.md` serves as reference only.

### Step 6 — Write TSV

Build the TSV using the three-layer storyboard method from `reference/video-dramaturgy.md` § 10: (1) map dramatic beats first, (2) assign shot functions (establish, power, pressure, detail, reaction, shift, impact, aftermath, exit), (3) set editing rhythm. Each layer must be solid before moving to the next — skipping a layer produces pretty but empty output.

One row per shot. Tab-separated. Do not use commas as separators.

Keep Subject & Action to 1–2 sentences. Present tense. Describe exactly what the frame contains.

**Three-detail audit (mandatory).** Every Subject & Action cell must name three concrete details — the same three enforced at the prompt generation phase. Without them, the storyboard is underspecified and the prompt author must invent or backtrack.

1. **Environmental pressure** — a physical fact about the space: cold light, wet stone, flickering fluorescent, dust in a shaft of light, steam. The environment should reinforce the shot's emotion — see `reference/nanobanana-artistry.md` → Emotion → Color/Mood table and `reference/cinematography.md` → Emotion → Camera Language for lookup.
2. **Physical micro-action** — the emotion translated into the body: jaw locks, knuckles whiten, fingers curl against the doorframe, shoulders collapse.
3. **Sound anchor or visual motif** — a recurring perceptual hook: reflection in dark glass, the same musical sting, footsteps in an empty corridor.

If a Subject & Action cell reads "Hero stares at the mountain" — it fails the audit. Rewrite: "Hero stares at the mountain summit. Jaw tightens. Cold wind whips loose gravel past his boots. Faint echo of falling rock from above."

Save as `{project_name}_storyboard.tsv` in the project directory.

### Step 6b — Intra-Scene Object Continuity Audit

After writing all shots for a scene, build an Object Continuity Manifest and run a backward-propagation check. Objects within a scene don't materialize when the story needs them — they were there all along. The audience just notices them later.

**The algorithm:**

1. **Build the Object Continuity Manifest.** Create `storyboard/continuity/scene-{N}-objects.md`. The frontmatter must include a `last_validated` date field — set it to today when creating or re-validating the manifest. For every persistent object (phone, screwdriver, bag) and character, build a shot-by-shot table tracking: Location, State, Visible? (given shot type and camera direction), Notes. Include hidden objects with their actual location — the manifest tracks where everything IS, not just where it's mentioned. For characters, track two additional columns: **Wearing** (current wardrobe — updated whenever clothing is added, removed, or changed during the scene) and **Appearance State** (visible injuries, sweat, blood, dishevelment — anything that accumulates or changes). Wardrobe changes are the highest-frequency continuity error in AI-generated sequences because each generation starts from the character element's default appearance, not from the scene's current state. This is the source of truth the audit checks against.

   **Manifest frontmatter:**
   ```yaml
   ---
   scene: {N}
   setting: "{location}"
   shots: [{shot codes}]
   last_validated: {YYYY-MM-DD}
   ---
   ```
2. **Find each item's introduction shot.** For each item in the manifest, identify which shot first uses or reveals it.
3. **Walk backward — propagate into earlier shots.** Using the manifest's Visible? column, check each earlier shot: if the item is marked visible but not described, it needs to be added.

| Shot type | Visibility scope |
|-----------|-----------------|
| EWS / WS / Establishing | Nearly everything — all characters, major objects, furniture, spatial layout |
| MS | Characters and objects in the immediate area; background objects if camera direction includes them |
| MCU | Character and objects within arm's reach |
| CU / ECU | Only what fills the frame |
| Insert | Only the featured object |

4. **Add missing items.** If the manifest shows an item as visible but the shot text doesn't mention it, add it. Keep additions proportional — a WS gets a brief mention, not a detailed description.
5. **Track items that move.** When an object is picked up, put down, or relocated, update the manifest and ensure subsequent shots reflect the new location. Use the Positional Language Convention for the new location — "screwdriver on pew 3, LEFT side of the seat" not "screwdriver on the pew." When an object is placed on a surface, specify WHERE on that surface (LEFT/RIGHT/CENTER, near which edge or neighboring object). Once a transient object's position is established in an approved storyboard image, lock the positional language to match what the image shows and use that same phrase in all subsequent prompts where the object is visible.
6. **Track wardrobe and appearance state.** When a character's clothing changes (vestment removed, jacket put on, sleeves rolled up, tie loosened), update the Wearing column in the manifest from that shot forward. Every subsequent prompt layer — shot.md Subject & Action, nb-prompt `[Subject]`, kling/seedance prompt `[Subject]`, and nb-prompt `[Technical]` — must describe the character in the updated wardrobe, not the element's default appearance. The same applies to Appearance State: if a character is bloodied in shot 4C, every later shot must carry the blood. Cross-check the `[Technical]` block — "fabric texture on vestments" is wrong when the character is in a clerical shirt.
7. **Prefer visible placement.** When the script hides an object ("under the pulpit," "in a drawer"), consider moving it to a visible surface. Hidden objects are invisible to AI models — they can't show what they don't know about. Visible planting in earlier shots makes the pickup feel earned rather than conjured.

**Common miss patterns:**
- Insert shot introduces an object that was never visible in earlier WS/MS shots of the same location
- Character is positioned in shot B but the establishing WS in shot A doesn't show them
- Character puts down an object but intermediate shots don't track where it is
- A prop is used in a later shot but wasn't planted in the environment when we first saw it

**Re-validation trigger:** If any shot in a scene is modified after the manifest's `last_validated` date (shot rewritten, split, added, or deleted), re-run Steps 6b and 6c for that scene before proceeding to animation prompts. Update `last_validated` after re-validation passes. The `last_validated` field makes staleness visible — a manifest dated three weeks ago for a scene with recent shot edits is a red flag.

### Step 6c — Intra-Scene Action Continuity Audit

After the object audit (Step 6b), verify that character physical states flow correctly between shots. Characters don't teleport any more than objects do — when a character ends shot N kneeling at a pew, their next on-camera shot must begin from that physical state.

**The algorithm:**

1. **Build a per-character state timeline.** For each character in the scene, walk through their on-camera appearances in order. For each shot, record the opening state (position, posture, held objects, facing direction) and the closing state (where the action leaves them).
2. **Skip non-visible shots.** Insert shots, cutaways, CU shots of a different subject, and reaction shots of other characters don't show the character — skip them when determining the "previous" physical state. The bridge may span multiple shots: A (Peter kneeling at pew) → B (insert of phone) → C (Peter again) — C bridges from A, two shots back. In dialogue scenes, one character's reaction shots may separate another character's appearances by 3-4 shots.
3. **Find and bridge state gaps.** Compare each opening state against the previous closing state. If they don't match — the character was kneeling and now stands, was at a pew and now at the altar — bridge the gap in the Subject & Action.
4. **The video prompt layer is the most critical.** The shot.md script can be somewhat implicit ("crosses back" implies movement from somewhere). But the Kling/Seedance video prompt must be fully explicit — the model has no memory of previous shots. Every physical transition must be spelled out: starting posture → movement → arriving posture.
5. **The nb-prompt.md inherits from the opening state.** Since the NanoBanana image captures frame 1 (static), it must show the character in their closing state from their previous on-camera appearance.
6. **Setup chains (frame reuse).** When a shot returns to a setup an earlier shot already occupied — same subject, same angle, same closeness — it is a *setup-chain return* (see `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains). Set its `start_frame_shot` to the previous shot in that chain: its I2V start frame will be that predecessor's rendered last frame, so it needs no fresh storyboard image (any nb-prompt generated for it is dashboard-only and must copy the predecessor's setup/lighting and depict the carried state). This is *frame* reuse layered on top of the *state* carry in steps 1–5. A return to the same subject at a **different** closeness is not a setup chain — leave `start_frame_shot: null` and rely on the state-carry audit alone (steps 1–5). Set `start_frame_shot: null` on the first shot of each chain and on any shot built from scratch.
7. **Cross-layer start-frame validation (forward reference).** The nb-prompt depicts frame 1; the kling prompt's opening action must begin from that exact state. This validation cannot run at storyboard time because kling prompts don't exist yet. The executable check lives in `animation-prompts.md` Step 12b — it runs when kling prompts are written, and for a `start_frame_shot` return resolves the baseline to that predecessor's END STATE. At storyboard time, ensure the nb-prompt accurately depicts the shot's opening physical state (per step 5 above) so the downstream check has a correct baseline to validate against.

**Common miss patterns:**
- A same-setup return re-derives its setup from scratch instead of carrying the chain predecessor's frame — desk, lighting, and identity drift between `3C` and `3E` because `start_frame_shot` was left null
- Script says "crosses back to X" without saying where from — video model starts character at a default position
- Character was kneeling/bent over but next shot starts with them standing — the rise is missing
- An insert shot breaks visual continuity — the shot after the insert must resume from the pre-insert state
- Character was mid-task but the continuation doesn't reference the task ending or being interrupted
- nb-prompt shows character in state X but the kling prompt's action starts from state Y (start-frame / action mismatch)
- Character removed a garment in an earlier shot but a later prompt still describes or references the original outfit

### Step 6d — Action Density Audit

After the continuity audits, verify that each shot's action is achievable by the AI video model within the shot's duration. A shot that reads as one dramatic beat in the script may contain too many discrete physical actions for a single generation.

**The algorithm:**

1. **Decompose the action into discrete physical beats.** A beat is one change in body state or position: stand up, walk, turn, reach, pick up, put down, sit, kneel, read, react. Count them.

2. **Apply the capacity rule:**

| Duration | Beats | Verdict |
|----------|-------|---------|
| 2-3s | 1 | Safe |
| 3-5s | 1-2 | Safe |
| 3-5s | 3 | Review — can they flow as one continuous motion? If not, split |
| Any | 4+ | Split mandatory |

3. **Split by dramatic function.** Each sub-shot gets one clear purpose:
   - **Movement shot:** Character changes location (rise + walk)
   - **Insert shot:** Object interaction close-up (hand picks up phone)
   - **Reaction shot:** Emotional response (reads, expression shifts)

4. **Naming convention:** When splitting, append a suffix to preserve shot ordering: `1E` → `1E-1`, `1E-2`, `1E-3`. Document the split rationale in each sub-shot's Notes.

5. **Verify the split doesn't lose dramatic value.** The original beat had a purpose — the split must preserve it. If a split would drain the moment of its power, keep it together and accept the generation risk.

**Why this exists separately from risk evaluation:** The risk matrix flags the TYPE of action that's hard (complex motion, hands passing objects). This audit catches the QUANTITY — shots where each action is individually low-risk but collectively overwhelm a single generation.

### Step 7 — Write PromptSync Shot Directories

For each shot in the TSV:

1. Create directory `storyboard/shots/{code}/`
2. Write `shot.md` with full frontmatter and body sections (Subject & Action, VO / Lines, SFX / Audio, Notes)
3. Write `nb-prompt.md` with NanoBanana image prompt

**These storyboard images are production assets — they serve as Kling I2V start frames.** The image must depict the exact frame 1 state: correct character pose at the starting position, correct blocking, and the right composition for camera movement to begin from. Do not illustrate the "most dramatic moment" of the shot — illustrate the moment the shot begins.

**Labeled block format is the default** — the same structure OpenArt uses when enhancing prompts. Each block contains descriptive prose, not keywords. This aligns nb-prompts with the Kling prompt format and makes individual dimensions easy to iterate on.

**NanoBanana prompt blocks (per shot):**
1. **`[Subject]`** — `@Element` shorthand + shot-specific appearance details, expression, visible injuries/state. The `@Element` reference gets expanded to the Identity Block at generation time. Add inline only what's unique to this shot or critical identity markers for this specific framing (e.g., "black eyes forward, not down" in a face CU).
2. **`[Action]`** — Physical state at frame 1. Pose, weight distribution, muscle tension, micro-expression. Static frame — no motion verbs.
3. **`[Environment]`** — `@Element` shorthand for locked environments + shot-specific atmosphere (foreground elements, depth layering, atmospheric density, weather unique to this shot).
4. **`[Cinematography]`** — Format (9:16/16:9), shot size, angle, behavioral camera + lens description (no brand names — describe compression, bokeh, falloff; see `reference/nanobanana-artistry.md` → Lens Character References), aperture. For 9:16 projects: add vertical-specific cues from `reference/cinematography.md` → 9:16 Vertical Format.
5. **`[Optical Realism]`** — **Mandatory.** Capture behavior + lens behavior + aperture as physics package (no brand names). Film look + grain intensity. 2-4 physical imperfections (grain, halation, chromatic aberration, vignette — select from `reference/nanobanana-artistry.md` → Imperfection Vocabulary). 1-2 depth-dependent effects (atmospheric haze, lifted blacks, contrast loss). Cross-reference the shot's dominant emotion with the Optical Realism by Emotion table. This block is what separates "AI image" from "photograph."
6. **`[Lighting/Style]`** — Motivated lighting: name each source, direction, what it illuminates, warm/cool split. Color grading and emotional palette direction. State "no studio fill" when environmental lighting should dominate. Film look now lives in `[Optical Realism]` — this block owns color grading and light source direction.
7. **`[Technical]`** — Photorealistic rendering, 2-3 quality boosters from `reference/nanobanana-artistry.md` → Quality & Beauty Boosters, resolution signal, texture emphasis.
8. **Negative prompt** — Standard Negative Prompt (see below) + vertical negatives for 9:16 + period/genre-specific exclusions.

**NB2 vs Pro:** Use NB2 (~$0.04/image) for iteration and test variations at 0.5K. Use NanoBanana Pro (~$0.15/image) for final storyboard images, complex multi-character shots, and any image that will serve as a Kling I2V start frame in a hero shot. Upscale winners to at least 1K (ideally 2K) before use as I2V start frames — low-res start frames degrade video output quality.

**Aspect ratio consistency:** The `aspect_ratio` in `nb-prompt.md` frontmatter MUST match the `aspect_ratio` in `shot.md` frontmatter. A mismatch between the storyboard image's aspect ratio and the video's target aspect ratio causes composition problems during I2V generation — the start frame won't map cleanly to the output dimensions.

**Rules for image prompts:**
- **Use labeled blocks** — `[Subject]`, `[Action]`, `[Environment]`, `[Cinematography]`, `[Lighting/Style]`, `[Technical]`. Each block contains descriptive prose, not keywords
- **Use `@Element` shorthand** for characters, props, and environments with locked element files — do not copy the full Identity Block into every prompt. The shorthand is expanded at generation time. Write shot-specific direction inline (pose, expression, what's unique)
- **Always add a space after every `@Element` name** — `@Sisyphus stands` not `@Sisyphus,stands`. OpenArt needs the trailing space to recognize the Element binding. No space = broken reference
- Add critical identity markers inline only when the shot framing makes them ambiguous (e.g., "black eyes not brown" in a face CU, "spherical, no flat base" for a boulder in WS)
- Concise is better. Each block should be 1-2 sentences of descriptive prose. The expanded @Element carries identity; the prompt carries the shot
- Lead with the most important visual element in `[Subject]`
- **Resolution-aware detail.** Describe only what the camera at this distance / motion / lighting can physically resolve. Drop detail the framing can't hold (a badge on a distant fast car, micro-expression on a figure across a wide plate) or the model hallucinates it at the wrong scale. See `reference/cinematography.md` → Resolution-Aware Detail
- Pose and blocking in `[Action]` must represent the shot's starting state, not mid-action or climax
- Static frame only — no motion verbs, no temporal language ("slowly", "begins to", "then")
- If the Kling prompt will describe a progression, this image captures only the starting position
- **Environment anchor validation (mandatory for WS, MS, MLS, FS shots).** After writing the `[Environment]` block, cross-check it against the environment lockdown file's Anchor Objects list and the spatial map's Camera Angles Used table. Every anchor object that would be visible from this shot's camera angle must appear in the canonical block or the shot-specific addition. No object may appear that isn't defined in the environment file unless it's a transient element brought into the scene by a character (a placed phone, a carried bag). For WS/MS/MLS/FS shots, if an anchor object is deliberately excluded (behind camera, partially out of frame), note why in the continuity manifest: "No — behind camera" or "No — edge of frame." **CU, ECU, MCU, and Insert shots are exempt from exclusion notes** — tight framings exclude most anchors by definition; requiring notes for each would be busywork. The check still applies to what IS shown: no phantom objects in any shot type. This prevents both phantom objects (things appearing that shouldn't exist in the space) and vanishing anchors (architectural features disappearing between wide/medium shots of the same location).

### Step 8 — Write project.yaml

Create `project.yaml` at the project root with project metadata.

### Step 9 — Character Consistency Check (after storyboard image generation)

After NanoBanana storyboard images are generated, compare every image against the character's visual anchors (from `storyboard/characters/{name}.md` → Visual Anchors). This must happen before Kling/Seedance prompt generation begins — the storyboard images are I2V start frames, and any drift bakes into the video.

**For each character, for each shot they appear in:**
1. Open the generated storyboard image alongside the character's reference images (front three-quarter, side profile, back three-quarter, ECU face)
2. Check every item in the character's Visual Anchors list — if any anchor is broken, flag the shot
3. Check the character's Consistency Notes → "Watch for" items
4. Verify wardrobe materials, distinctive features, and hair match the Identity Block under the storyboard's cinematic lighting conditions (cinematic light shifts apparent color — a "charcoal wool" coat under golden hour may look brown, but the texture and weave should still match)

**If drift is detected:**
- Regenerate the `nb-prompt.md` with stronger character anchoring language
- Add explicit corrective detail: "charcoal wool coat — NOT brown, NOT leather" (positive framing preferred, but direct correction is acceptable for reference image consistency)
- Do NOT proceed to video prompt generation until all storyboard images pass the visual anchor check

Mark each character's consistency status in `project.yaml` under a `consistency_check` key:

```yaml
consistency_check:
  status: passed          # passed | pending | failed
  checked_date: YYYY-MM-DD
  characters:
    - name: "{character}"
      shots_checked: [1A, 2A, 3B]
      status: passed      # passed | failed
      notes: ""
```

Only after all characters show `status: passed` should the pipeline proceed to `animation-prompts.md`. Note: voice design (workflow Step 8c) can proceed in parallel with the consistency check or after it — it does not depend on storyboard image approval. But both the consistency check AND voice design must be complete before animation-prompts (Step 8d).

Mark Element creation status in `project.yaml` alongside the consistency check:

```yaml
element_creation:
  status: pending           # pending | complete | failed
  checked_date: null
  characters:
    - name: "{character}"
      element_status: created   # not-created | created
      kling_shots: true         # whether this character appears in any asset_type: kling shots
      notes: ""
```

All characters with `kling_shots: true` must show `element_status: created` before the pipeline proceeds to `animation-prompts.md`. Characters that appear in Seedance shots also need an OpenArt element — Seedance now references the same `@ElementName` elements as Kling. Only characters that appear solely in still shots do not need an element.

### Step 10 — Create Kling Elements in OpenArt (before animation prompts)

After the consistency check passes, create Kling Elements in OpenArt for every character that appears in `asset_type: kling` shots. Upload the 4 approved NanoBanana reference images (front three-quarter, side profile, back three-quarter, ECU face) per character. See `reference/kling-reference.md` → Elements Workflow for the full procedure.

**Element name binding check (before creating in OpenArt):** Verify that every `@Name` in every `nb-prompt.md` and every entry in every `shot.md` `elements` list exactly matches an `element_name` from a file in `storyboard/characters/` or `storyboard/environments/`. Also verify each `element_name` follows the derivation rule: kebab-case file prefix → PascalCase (`the-father.md` → `TheFather`, `carved-bird.md` → `CarvedBird`). A mismatch at any point means the element won't bind during generation. Fix mismatches before creating elements in OpenArt.

**When creating the element in OpenArt, name it exactly as the `element_name` from the .md file** — `TheFather`, not "The Father" or "Father". The OpenArt element name must match the `@Name` in prompts character-for-character.

Once created, update each character file's frontmatter: `element_status: not-created` → `element_status: created`. Seedance characters reference the same OpenArt elements by `@ElementName`, so create an element for every character that appears in Seedance shots too.

**Gate:** All characters appearing in Kling shots must have `element_status: created` before `animation-prompts.md` can run.

---

## Status Flow by Asset Type

| `asset_type` | Status flow | Notes |
|---|---|---|
| `still` | `draft → nb-ready → nb-done → complete` | Video stages skipped |
| `kling` | `draft → nb-ready → nb-done → kling-ready → kling-done → complete` | Seedance stages skipped |
| `seedance` | `draft → nb-ready → nb-done → seedance-ready → seedance-done → complete` | Kling stages skipped |
| `kling-reuse` | Mirrors source shot (via `reuses` field) → `complete` when source reaches `kling-done` | No independent video prompt |

All shots start at `draft`. The `nb-ready → nb-done` transition happens after NanoBanana storyboard image generation. Subsequent transitions happen after the corresponding video prompt generation and output.

**Setup-chain returns** (`start_frame_shot` set) keep their `kling`/`seedance` flow but may skip independent NanoBanana generation — their start frame is the chain predecessor's rendered last frame. Treat `nb-done` as satisfied once the predecessor is rendered (or once the optional dashboard-only image is generated).

---

## Standard Negative Prompt

Apply to every NanoBanana storyboard image:

```
flat lighting, smooth plastic skin, generic, amateur, digital noise,
morphing features, modern clothing, modern objects, photography artifacts,
oversaturated, cartoon, illustrated, anime, text, watermark, logo, extra limbs,
blurry faces
```

**Add for 9:16 vertical projects (from `reference/cinematography.md` → Vertical Negative Prompts):**

```
wide horizontal composition, landscape framing, cramped side elements,
distorted vertical proportions, stretched horizontally, empty side space,
bad vertical framing, horizon in center, weak vertical lines
```

Adjust for period and genre. Remove irrelevant exclusions, add period-specific ones.

For the full multi-layer negative prompt assembly system (identity + physics + vertical + period + artistic + shot-specific), see `animation-prompts.md` → Negative Prompt Assembly Guide. The standard block above covers the NanoBanana storyboard image layer; the assembly guide covers all layers across all tools.

---

## Output Format Rules

- Save TSV as `{project_name}_storyboard.tsv` in the project directory
- Create PromptSync directories under `storyboard/shots/` in the project directory
- Create `project.yaml` at the project root
- Do not overwrite existing files — increment version: `_v2`, `_v3` for TSV

---

## Rules

- Do not start storyboarding until the script is locked.
- **Intra-scene object continuity is mandatory.** After writing all shots for a scene, run the backward-propagation audit (Step 6b). Every object, character position, prop, **wardrobe state**, and **appearance state** that appears in a later shot must be present in all earlier shots of the same scene where the camera framing would reveal it. This applies to all layers: shot.md, nb-prompt.md, the TSV, and Kling/Seedance video prompts. Static objects visible in a Kling start frame must be anchored in the video prompt so the model doesn't erase them during generation. Wardrobe and appearance changes must propagate forward through every subsequent prompt layer — including the `[Technical]` block (do not describe fabric textures for garments the character is no longer wearing).
- **Intra-scene action continuity is mandatory.** After the object audit, run the action continuity audit (Step 6c). Each character's opening physical state in a shot must match their closing state from their **most recent on-camera appearance** — which may be one, two, or several shots back when intervening shots are inserts, cutaways, or other characters' reaction shots. The video prompt layer is the most critical: Kling/Seedance have no spatial memory, so every transition must be explicitly described. The script layer may be implicit ("crosses back"); the video prompt must spell out the full physical sequence. Identify **setup chains** (returning coverage on the same subject) and set each returning shot's `start_frame_shot` to its chain predecessor, so its start frame and opening state carry from the matching shot — not the literal previous one (see `story-saint-storyboard/reference/shot-flow-and-editing.md` → Setup Chains). **Cross-layer start-frame validation** is deferred to `animation-prompts.md` Step 12b — it runs when kling prompts are written against the nb-prompt baseline established here.
- **Environment anchor validation is mandatory for WS/MS/MLS/FS shots.** Every nb-prompt `[Environment]` block must be cross-checked against the environment lockdown file's Anchor Objects list. Visible anchors must appear; objects not defined in the environment file must not appear unless brought in by a character. For wide and medium shots, deliberate exclusions must be noted in the continuity manifest. CU/ECU/MCU/Insert shots are exempt from exclusion notes but must not contain phantom objects.
- **Action density audit is mandatory.** After continuity checks, decompose each shot's action into discrete physical beats (Step 6d). If a shot has 4+ beats, split it. If it has 3, review whether they flow as one continuous motion. Each sub-shot must serve one clear dramatic function. This catches a different problem than risk evaluation: individually low-risk actions that collectively overwhelm a single generation.
- One still prompt per shot — not per sub-beat. Shot 1A and 1B are separate rows and separate prompts.
- Crowd/multi-figure motion shots should use cinematic workarounds (see `reference/short-form.md` — HIGH RISK patterns), not direct Kling generation.
- @Element files in `storyboard/characters/` must have Identity Blocks specific enough to generate visually consistent results when expanded. "A man in period clothing" is not specific enough. The Identity Block is the single source of truth — it lives in the character file, not in every nb-prompt.md.
- Style anchors must be applied consistently. A memory shot that looks like a present shot breaks the visual grammar.
- Shot image column stays blank. It is filled by the creator after generation, not by this skill.
- Flag any shot where the script description is ambiguous for image generation — ask the creator to clarify before writing the prompt.
- Do not add new story beats that are not in the script. You MAY split a script beat into multiple shots when AI animation constraints require it (e.g., "walks to the door and opens it" → two shots to avoid multi-action risk). Document any splits in the Notes column with the original beat reference.
- For shots with `asset_type: kling`, mark `status: draft` — the Kling prompt is written later by `animation-prompts.md`. The `nb-prompt.md` serves as both the storyboard image and the Kling I2V start frame (unless `start_frame_shot` is set — a setup-chain return's start frame is the chain predecessor's last frame).
- For shots with `asset_type: seedance`, mark `status: draft` — the Seedance prompt is written later by `animation-prompts.md`. The `nb-prompt.md` serves as both the storyboard image and the I2V start frame (or as composition reference for `r2v` mode; or, for a setup-chain return with `start_frame_shot` set, deferring to the chain predecessor's last frame).
- For shots with `asset_type: kling-reuse`, mark `status: draft` and set `reuses: {source_shot_code}`. This shot reuses another shot's Kling generation — no new video prompt is written. The `nb-prompt.md` is still created for storyboard visualization.
- For status flow per asset_type, see Status Flow by Asset Type above.
- Always create the directory and `nb-prompt.md` for every shot — even Kling shots need a storyboard image / start frame. **Exception — setup-chain returns** (`start_frame_shot` set): still create the directory and `nb-prompt.md` file (for structure and dashboard visualization), but the operative start frame is the chain predecessor's rendered last frame, so generating a fresh image for this shot is optional — if generated, it is dashboard-only and must copy the predecessor's setup/lighting. Same convention as `kling-reuse`: the `nb-prompt.md` exists for visualization but isn't the operative asset.
- Every `nb-prompt.md` must use the labeled block format: `[Subject]`, `[Action]`, `[Environment]`, `[Cinematography]`, `[Optical Realism]`, `[Lighting/Style]`, `[Technical]`. The `[Optical Realism]` block is mandatory — it cannot be skipped. Use `@Element` shorthand — do not repeat full Identity Blocks in every prompt. OpenArt expands @Elements to their identity and reference images at generation time.
