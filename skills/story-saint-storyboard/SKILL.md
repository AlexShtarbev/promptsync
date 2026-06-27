---
name: story-saint-storyboard
description: >-
  Katz-enhanced storyboarding skill for AI-animated short films and long-form projects.
  Use when the user says "storyboard it", "create the storyboard", "image prompts",
  "create stills", "design characters", "character sheets", "lock the characters",
  "reference sheets", "visual DNA", or when story-saint-scriptwriter hands off after
  script lock. Integrates Steven D. Katz's Shot by Shot methodology (scene classification,
  7-question dramatic analysis, staging patterns, shot flow design) with the PromptSync
  production pipeline. Outputs TSV storyboard, per-shot PromptSync directories (shot.md +
  nb-prompt.md), character element files, environment plates, and project.yaml.
  This is the THIRD skill in the pipeline — receives from story-saint-scriptwriter,
  hands off to story-saint-prompter.
---

# Story Saint — Storyboard

Production skill that converts a locked script into storyboard assets for the PromptSync visual production pipeline. Integrates Steven D. Katz's *Film Directing Shot by Shot* methodology to provide rigorous dramatic analysis and staging decisions before camera assignment.

**Two methodological layers:**

**Layer 1 — PromptSync Pipeline (existing):**
The production backbone. TSV storyboard, per-shot directories, NanoBanana image prompts, character elements, environment plates, consistency checks. All output formats preserved exactly.

**Layer 2 — Katz Shot by Shot (new):**
Scene classification, 7-question dramatic analysis, staging patterns (I/A/L), two-player positions, triangle camera system, Q&A editing structure, shot flow design. These enhance the "why" behind every camera decision.

---

## REQUIRED READING WHEN ACTIVATED

### Core — always load
1. **`../storyboard.md`** — The full storyboard pipeline specification. This new skill integrates and enhances it with Katz; the original remains the source of truth for output format details (environment plate prompt structure, prop plate structure, NB2 vs Pro guidance, aspect ratio consistency rules, full spatial continuity audit, element naming derivation examples).
2. **`../reference/cinematography.md`** — emotion→shot size, angle, movement lookup + combination patterns.
3. **`../reference/video-dramaturgy.md`** — film theory: scene formula, Murch Rule of Six, blocking, staging, environment plays, three-layer storyboard method.
4. **`../reference/nanobanana-artistry.md`** — NanoBanana prompting rules, film stocks, lens character, [Optical Realism], emotion→palette.
4b. **`../reference/ai-slop-ban-list.md`** — Named AI-tells catalog + per-shot PRE-FLIGHT GATE. For stills you own the **NanoBanana column**: tells are enforced with **POSITIVE phrasing + reference-image conditioning** (negatives are weak on NB). The body/beautify and color-drift tells are the highest-frequency still failures. Every `nb-prompt.md` is gated against this before it ships.
5. **`../reference/short-form.md`** — pacing, hooks, AI-animation constraints, HIGH RISK patterns.
5b. **`../reference/clip-yield.md`** — *(short-form / serialized-for-platform only)* the Spike's single money-shot frame and the Cold Hook frame. Load when storyboarding a series episode for a swipe feed; skip for long-form.

### Load for asset_type and risk decisions
6. **`../reference/kling-reference.md`** — Kling capabilities, motion scales, expression control, organic camera.
7. **`../reference/seedance-reference.md`** — Seedance 2.0 character locking, multi-shot, Details Law, forces-not-appearances.
8. **`../animation-prompts.md`** — Read for the 11-factor shot risk evaluation matrix (Step 4) and generation mode decision tree (Step 5). Not for prompt generation — that belongs to `story-saint-prompter`.

### Load for character design
9. **`../templates/characters.template.md`** — character bible template with reference sheet prompts.
10. **`../reference/nanobanana-artistry.md`** — NanoBanana prompting rules (already loaded from Core).

### Load for environment lockdown
11. **`../templates/environments.template.md`** — environment lockdown file template: spatial map, master plates, canonical environment block, anchor objects, forbidden drift list, depth map notes.

### Katz references (local — load per phase)
12. **`reference/algorithm.md`** — The master script-to-storyboard pipeline. **Always read first** when entering Storyboard Mode.
13. **`reference/scene-analysis.md`** — 7-question dramatic analysis method. Read during scene analysis (enhanced Step 1).
14. **`reference/staging-rules.md`** — I/A/L patterns, 10 two-player positions, triangle camera system, 180° rule. Read during camera assignment.
15. **`reference/shot-flow-and-editing.md`** — Q&A editing structure, cutting rhythm, progressive/conflicting flow, transitions. Read during shot sequencing.
16. **`reference/output-format.md`** — Katz's native storyboard format (for reference — output uses PromptSync format, not this).

---

## MODES

- **CHARACTER DESIGN MODE**: Triggered by "design characters," "character sheets," "lock the characters," "reference sheets," or "visual DNA." Runs after script lock, before storyboarding. See CHARACTER DESIGN section below.
- **STORYBOARD MODE**: Triggered by "storyboard it," "create the storyboard," "image prompts," or "create stills." Requires character designs to be locked first. See STORYBOARD PIPELINE section below.

---

## INPUTS REQUIRED

Before starting, confirm:
- Script is locked (all shots have VISUAL, TEXT, AUDIO, CHARACTER MOTION, CAMERA MOTION, DURATION, BEAT defined)
- For Storyboard Mode: character designs are locked — `storyboard/characters/{name}.md` exists for every recurring character with `status: reference-done`
- AI animation pre-flight is complete (no unresolved HIGH RISK shots)
- Tool split is confirmed (which shots are Kling, Seedance, or stills)
- Project name and slug are confirmed

If any are missing, say so and direct the user to the appropriate upstream skill.

---

## PROJECT LAYOUT — SINGLE PROJECT vs SERIES

Output goes into one of two layouts. Decide which before writing any element file.

### Single project (one self-contained film/Short)

```
{project}/
├── project.yaml
└── storyboard/
    ├── characters/   environments/   props/
    ├── shots/{code}/
    └── video-prompts/{code}/
```

Every element lives under the project's own `storyboard/`. This is the default for a one-off piece.

### Series (multiple episodes sharing a cast and world)

```
{series}/
├── series.yaml                  ← series manifest (name, slug, global_elements dir, bible dir, episodes)
├── bible/                       ← narrative canon (story truth) — NOT visual reference
│   └── characters/{name}.md
├── storyboard/                  ← GLOBAL element library (shared across every episode)
│   ├── characters/   environments/   props/
└── episodes/{epNN-slug}/
    ├── project.yaml             ← episode manifest
    └── storyboard/              ← EPISODE-LOCAL elements + this episode's shots
        ├── characters/   environments/   props/
        ├── shots/{code}/
        └── video-prompts/{code}/
```

**Global vs local — the test:** does this element recur across episodes?
- **Global** (series `storyboard/`): the protagonist and recurring cast, the persistent world (the tower, recurring locations), hero props that travel between episodes. A character that *evolves* keeps each visual state as its own global file with a `body_state` (`hale-s0.md`, `hale-s1.md`).
- **Local** (episode `storyboard/`): anything that appears only in this episode — a one-off creature, a floor that's never revisited, a single-scene prop.

**Effective elements for an episode = global ∪ local.** On an `element_name` collision, the episode-local file wins (lets an episode override a global look). Shots resolve `@Element` references against this union, so an episode shot may reference a global element (e.g. `@HaleS0`) without redefining it.

### Element frontmatter for global elements

Global element files carry two extra fields:

```yaml
scope: global                       # local files may omit this or set scope: local (implied by location)
canon: ../../bible/characters/mc.md  # link to the narrative canon this visual sheet realizes
```

`canon` keeps the two layers linked without duplication: the **bible** holds story truth (arc, want/need/flaw), the **storyboard** sheet holds visual DNA (Identity Block, reference prompts). One canon character may have several visual sheets across its `body_state` evolution, each pointing back to the same canon file.

### Referencing elements from an episode `project.yaml`

Relative paths encode scope:
- `../../storyboard/characters/hale-s0.md` → **global** (series library)
- `storyboard/characters/floor1-monster.md` → **episode-local**

### STRUCTURE AUDIT (gate — run, don't assume)

The layout above is **enforced, not optional.** There is a deterministic tool — **use it, don't eyeball:**

```bash
cd platform
# scaffold the correct skeleton (creates dirs + stub files with correct frontmatter):
npm run structure -- scaffold-series  <dir> <slug> "<name>" ep01-slug ep02-slug
npm run structure -- scaffold-episode <seriesDir> <epSlug> "<name>"
npm run structure -- scaffold-project <dir> <slug> "<name>"          # single project
npm run structure -- new-element <baseDir> <character|environment|prop> <global|local> "<Name>" [canonPath]
# validate (and auto-fix the safe issues — missing dirs, missing scope:global):
npm run structure -- validate --root <seriesOrProjectDir> --fix
```

Scaffold **before** writing content so every file is born in the right place with the right frontmatter; then fill the stubs. Run `validate --fix` at three points: (a) when you enter Character Design or Storyboard Mode, (b) each time you create or move an element file, and (c) as a hard gate before handoff to the prompter. `validate` exits non-zero if any **error** remains.

### CONTINUITY ENGINE (gate — the physics-engine, mechanical not eyeballed)

The intra-scene continuity audits below (Steps 6f/6g/6g-i/6g-ii/6g-iii/6g-iv/6h, on-screen text, held objects) are now **backed by a deterministic engine** — author the state, then let code enforce it. Run it; do not hand-audit in its place.

```bash
cd platform
# 1. GATE — lint the continuity manifests against every shot's nb-prompt:
npm run lint:continuity -- --slug <episode-slug> --root <seriesDir>   # exits non-zero on errors
# 2. COMPILE — emit a shot's mandatory state clauses FROM the manifest + element sheets,
#    and report round-trip coverage vs the hand-authored prompt:
npm run compile  -- --slug <episode-slug> --root <seriesDir> <shotCode>
# 3. ASSEMBLE — write the full prompt from state (compiler owns [Subject] + Negative,
#    author owns the creative blocks). Preview, or --write to overwrite; --kling for motion:
npm run assemble -- --slug <episode-slug> --root <seriesDir> <shotCode> [--write] [--kling]
# 4. SYNC-BOARD — keep the storyboard TSV a projection of shot.md (run at handoff):
npm run sync-board -- --slug <episode-slug> --root <seriesDir>            # check (exits non-zero on structured drift)
npm run sync-board -- --slug <episode-slug> --root <seriesDir> --write    # regenerate the board from shot.md
# 5. EMIT — regenerate ALL projections at once from authored state (the reliable one-shot):
npm run emit -- --slug <episode-slug> --root <seriesDir>                  # dry-run: lists what would change + lint
npm run emit -- --slug <episode-slug> --root <seriesDir> --write          # inject MISSING build/held/concealment + sync board
npm run emit -- --slug <episode-slug> --root <seriesDir> --watch          # auto-emit on every change (idempotent)
# 6. CHECK-IMAGES — verify the GENERATED pixels (text→pixels gap, B5) — cheap, local, no Claude:
npm run check-images -- --slug <episode-slug> --root <seriesDir>              # free: aspect-ratio + corruption/blank checks
npm run check-images -- --slug <episode-slug> --root <seriesDir> --colortemp  # free: warm/amber drift on cool-declared shots (the moonlight→honey tell)
npm run check-images -- --slug <episode-slug> --root <seriesDir> --clip       # + local CLIP: posture (pinned≠standing) & build (overweight≠slim)
```

`--clip` needs the optional local model once: `cd platform && npm install @xenova/transformers` (CPU, ~150MB, downloaded on first run). Without it, `--clip` prints a hint and runs the free header checks only. This is the ONLY check that sees a default-pose / beautification failure in the rendered frame — text gates can't.

`emit` is **non-destructive and idempotent**: it INJECTS only the mandatory clauses a prompt is *missing* (build, held-object, concealment, target) into the authored `[Subject]`, never overwriting your prose, and regenerates the board. **Posture is deliberately NOT auto-written** — which moment a still depicts is creative judgment, so posture omissions/contradictions surface as the L02 lint for you to resolve. **Hands-off by default:** a Claude Code Stop hook (`.claude/settings.json` → `platform/scripts/claude-hook.ts`) auto-runs emit + lint after every turn for any storyboard project you edited, so authoring through the skill stays in sync with **no command to remember and no server required**. Auto-emit is also ON by default in the dashboard (persisted; toggle **⚡ Auto-emit** off if you want manual control, **Emit now** for a one-shot). `PHYSICS_AUTOEMIT=0/1` forces the dashboard default.

### AI SLOP PRE-FLIGHT (gate — authoring-time companion to the engine)

The continuity engine above is *mechanical* (structured-state lint) and the `check-images` pixel tiers are *pixel-time* — `--clip` catches beautification + default-pose, `--colortemp` catches warm-on-cool colour drift, both in the rendered frame. The **AI Slop Ban List** (`../reference/ai-slop-ban-list.md`) is the third leg: the **authoring-time** per-prompt checklist that prevents the tells *before* generation — `[World Plate]`↔camera-angle mismatch, default-center composition, redundant identity dumps that fight the reference, and the *positive* phrasing that keeps named imperfections and the exact build (negatives are weak on NanoBanana, so the prompt must lock these positively *before* any pixel check runs). Run the **NanoBanana still gate** from that file against every `nb-prompt.md` before generating. The layers are complementary, not redundant: the ban list stops the failure at authoring; `--clip`/`--colortemp` catch what slipped through at the pixels.

What the engine enforces (each maps to a hand audit it replaces): **L01** state continuity (6g) · **L02** manifest→prompt conformance, *silence is a failure* (6g-i) · **L03** build asserted for build-sensitive characters (6g-ii) · **L04** action-target presence (6g-iii) · **L06** held-object continuity (6f/7b) · **L07** concealment kept positive — presence not negated (B4) · **L09** on-screen-text canonical · **L11** action density (≥4 beats → split, advisory) · **L12** perspective coherence (6g-iv — a strict top-down/bird's-eye shot must not describe a horizon/sky/shoreline). L05 (board↔shot.md) is enforced by `sync-board`, not the per-save gate. The manifest (`storyboard/continuity/scene-{N}-objects.md`) is the **source of truth for physical state**; the engine compiles the posture/build/held-object/concealment clauses into the prompt so they cannot be silently omitted, and the validator catches anything authored off-spec. The dev server also runs `lint:continuity` automatically on every save. The pixel-level posture/build check at image review (Step 9) still stands — text gates cannot see a default-pose/beautification failure.

The tool enforces the checks below; each has a **correction** the tool either applies (`--fix`) or reports for you to resolve — never just note a failure:

1. **Layout chosen correctly.** Does this share a cast/world across episodes? → it's a **series**; otherwise a **single project**. Correction: if series and no `series.yaml` exists at the series root, create it (`name`, `slug`, `type: series`, `global_elements`, `bible`, `episodes`). If single-project and a stray `series.yaml`/`episodes/` exists, flatten to the single-project layout.
2. **Global library present.** For a series, `{series}/storyboard/{characters,environments,props}/` exist. Correction: create any missing dirs.
3. **Placement correct (global vs local).** For every element file, apply the test: appears in >1 episode, or is protagonist/recurring cast/persistent world/recurring prop → **global**; appears in exactly one episode → **episode-local**. Correction: **move** any misplaced file to the correct dir and update every `project.yaml` / `@Element` reference to it. A recurring element duplicated as a fresh local copy (instead of referencing the global) is a placement error — delete the duplicate and reference the global, unless it is a deliberate episode override (see check 5).
4. **Global frontmatter complete + canon resolves.** Every file under the global library has `scope: global` and a `canon:` path. Correction: add `scope: global`; resolve the `canon:` path relative to the file — it must point to an existing `bible/characters/{name}.md`. If the bible entry is missing, create a stub and link it; if the path is broken, fix it.
5. **`element_name` uniqueness across global ∪ local.** For each episode, compute the effective set. Any `element_name` collision must be an **intentional** local override of a global (local wins). Correction: rename unintended collisions; for an intentional override, confirm the local file is the one meant to win and leave a one-line note in it.
6. **`project.yaml` references resolve.** Every path in an episode's `elements` lists points to a real file, with `../../storyboard/...` = global and `storyboard/...` = local. Correction: fix or remove dangling references.
7. **Bible ↔ visual linkage (series).** Every visually-designed canon character has at least one global visual sheet whose `canon:` points back to it. Correction: create the missing sheet or fix the link.
8. **Reference prompts render (`ELEMENT_NO_VIEWS`).** Every element file with a reference section produces ≥1 view in the UI. The validator flags element files whose reference prompts parse to 0 views (empty fence, or a prompt placed under a non-reference heading). Correction: fix the section to the standard format (see "Reference prompt section format") so the prompt actually renders.

If any check fails and you cannot safely auto-correct (e.g. ambiguous whether an element is global), ask the user one binary question rather than guessing.

---

## CHARACTER DESIGN MODE

**First, run the STRUCTURE AUDIT** (PROJECT LAYOUT → STRUCTURE AUDIT): confirm single-project vs series, and for a series ensure `series.yaml` and the global library exist before writing any element file. A recurring character is created **once** in the global library; only episode-specific characters go in an episode's `storyboard/`.

Runs after script lock, before storyboarding. For each recurring character: generate 4 separate photorealistic NanoBanana reference images (front three-quarter, side profile, back three-quarter, extreme close-up face), plus an optional expression sheet and a Seedance Combined Reference Sheet (Prompt 6) — a single 6-panel image that authors the `@Name` OpenArt element (the same element Kling uses).

Write the character element file (`storyboard/characters/{name}.md`) with:
- **Identity Block** (visual DNA)
- **Kling Element description**
- **Seedance `@Name` element lock** (same element as Kling)
- **NanoBanana reference prompts** (4 angles + optional expression sheet + Seedance combined sheet)
- **Visual Anchors** (the checklist for consistency checking)

If a character transforms visually during the story (costume change, aging, injury altering silhouette, supernatural transformation), each state gets its own element file (`storyboard/characters/{name}-{state}.md`) with its own Identity Block, reference images, and Element/character lock. Each wardrobe state also gets its own Seedance Combined Reference Sheet. Threshold: would the reference images need to change?

Guide the creator through generation, selection, and approval. Lock each character with `status: reference-done`. No storyboarding begins until all character designs are locked.

### Character File Output

```
{project}/                            ← single project, OR a series episode
└── storyboard/
    └── characters/
        ├── {name}.md                 ← Identity Block, NanoBanana ref prompts, visual anchors
        └── {name}-{state}.md         ← transformation variant (if character changes visually)
```

**In a series**, a recurring character belongs in the **global** library at the series root (`{series}/storyboard/characters/`) with `scope: global` and a `canon:` link, not inside an episode. Each `body_state` is its own global file (`{name}-s0.md`, `{name}-s1.md`). Only characters unique to one episode go in that episode's `storyboard/characters/`. See PROJECT LAYOUT.

### Reference prompt section format (the platform reads this — keep it standard)

The platform renders each reference prompt as a "view" in the UI. It recognises a reference section by **intent**, not an exact string, so wording can vary — but follow this standard so every element file is consistent:

- A reference section is an **`## ` heading that names the artifact**: it contains one of `reference` / `sheet` / `plate` / `prompt` / `angle` (e.g. `## Reference Sheet Prompts (NanoBanana)`, `## Creature Reference Sheet (NanoBanana)`, `## Master Plates`, `## NanoBanana Prop Plate Prompt`). Append output hints in parens and a free dash-clause: `## Reference Sheet Prompts (NanoBanana) — WIDE identity anchors`.
- Each prompt is a **fenced code block** (```), optionally under a `### ` subheading named `Angle N — …`, `Prompt N — …`, `Prompt — …`, or `Master Plate X — …`. Put the output spec in the subheading parens: `### Prompt 1 — Front Three-Quarter (3:4, 1K)`.
- **Do NOT** name a prose block with a reference word. Identity Block, Kling Element Description, Seedance Character Lock, Canonical Environment Block, Visual Anchors, Consistency Notes are **not** reference sections — they're skipped (even though some contain fences).
- An empty fence or a section with no prompt renders **0 views**. The structure validator flags this as `ELEMENT_NO_VIEWS` (see STRUCTURE AUDIT) — run `npm run structure -- validate` and fix any element whose prompts don't render.

---

## STORYBOARD PIPELINE

### The Katz-Enhanced Process

The storyboard pipeline follows the existing 10-step process from `../storyboard.md` (loaded during activation), enhanced with Katz's scene analysis at key decision points. Read `reference/algorithm.md` before starting. When this skill abbreviates a step, refer to `../storyboard.md` for the full specification.

**Before Step 1, run the STRUCTURE AUDIT** (PROJECT LAYOUT → STRUCTURE AUDIT) so element loading in Step 2 resolves against a correct global ∪ local layout. Re-run it as a hard gate before handoff.

**Where Katz integrates into the existing pipeline:**

| Existing Step | Katz Enhancement |
|---|---|
| Step 1 (Extract Shots) | + Katz Step 0 (Parse Input) + Step 1 (Scene Classification) |
| Step 1b (Spatial Continuity) | Unchanged — already strong |
| Step 2 (Load Elements) | Unchanged |
| Step 3 (Style Anchors) | Unchanged |
| Step 4 (Risk Levels) | Unchanged |
| Step 5 (Batching) | + Katz Step 5 (Shot Sequencing) for cutting rhythm |
| Step 6 (Write TSV) | + Katz Step 2 (7-Question Analysis) + Step 3 (Staging) + Step 4 (Camera Setups) |
| Step 7 (Write PromptSync) | Unchanged — output format stays PromptSync |
| Steps 8-10 | Unchanged |

---

### Step 1 — Extract Shots + Scene Classification

Read the locked script. For each scene:

**1a. Extract** — List every shot ID, duration, visual description, VO line, audio notes, and tool assignment. Do not begin writing until you have the full shot list.

**1b. Classify the scene type** (from `reference/algorithm.md` → Step 1):

| Type | Characteristics |
|------|----------------|
| **DIALOGUE-STATIC** | 2+ characters talking, minimal movement |
| **DIALOGUE-MOBILE** | Characters talk AND reposition during scene |
| **ACTION** | Physical movement is primary |
| **ESTABLISHING** | Introduce location, mood, time |
| **TRANSITION** | Bridge between scenes or time periods |
| **REVEAL** | Information disclosed to character or audience |
| **REACTION** | Character processes information/event |
| **MONTAGE** | Compressed time, multiple mini-scenes |

Most scenes are compound (e.g., ESTABLISHING → DIALOGUE-STATIC → REVEAL). Note the classification — it determines which staging rules apply in Step 6.

**1c. Spatial Continuity Audit** — Walk through every consecutive pair of shots and check for location changes. For every setting change, answer:
1. **Bridge:** Can the audience track how the character got from A to B?
2. **Geography:** Does the new location need establishing before the drama begins?
3. **Pre-plant:** Is there a character already in the new location whose presence needs planting?

If any answer is yes and no bridging shot exists, write the missing shot(s) before proceeding.

### Step 2 — Load @Elements from Character Design

Character elements are already locked in `storyboard/characters/{name}.md`. Load them — do not redefine.

1. Read every file in `storyboard/characters/`. Verify `status: reference-done` and complete visual anchors.
2. Add non-character elements (environments, props) that appear across multiple shots.

**In a series**, load the effective set = **global ∪ local** (see PROJECT LAYOUT): read both the series global library (`../../storyboard/{characters,environments,props}/`) and this episode's own `storyboard/`. A recurring character/world element should already exist in the global library — reference it, do not re-create a local copy. Only write a new file under the episode's `storyboard/` when the element is genuinely episode-specific. If an episode needs a different look for a global element, create a local file with the same `element_name` (local wins on collision).

**Element naming rules:**
- Every element: unique `@Name` in **PascalCase with NO spaces**: `@Beethoven`, `@Study`, `@Piano`
- Naming derivation: kebab-case file prefix → PascalCase. `the-father.md` → `TheFather`
- Same PascalCase name in: element file's `element_name`, all `@Name` references in nb-prompts, all `elements` lists in shot.md, OpenArt element name
- Max 3 elements per Kling generation batch

### Step 2b — Environment Lockdown

AI models have no spatial memory — without explicit control, backgrounds drift between shots (furniture moves, objects appear/disappear, architecture changes). Environment lockdown is the countermeasure: build the set empty first, lock the spatial geometry, then place characters into the locked set.

For the full methodology, see `../storyboard.md` → Step 2b. The abbreviated sequence:

1. **Identify environments and assess risk** — interiors with 10+ shots are highest risk
2. **Write a spatial map** per location — exact layout, anchor objects with fixed positions, camera angles used, what's visible from each angle
3. **Generate master plates** — character-free reference images from primary and reverse camera directions. Zero-character guard: `IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame.`
4. **Write a canonical `[Environment]` / `[World Plate]` block — PER CAMERA ANGLE.** A frozen paragraph copy-pasted verbatim into every `nb-prompt.md` that uses that camera relationship. Names anchor objects and their spatial positions; no per-shot improvisation on the background. ⚠ **If the location is shot from more than one camera relationship (e.g. true top-down AND eye-level of the same lake), write a SEPARATE block + master plate per angle** and have each shot pull the one matching its `shot_type`. A single block pasted across incompatible angles imports a horizon into an overhead frame — the fake-perspective clash (enforced by **L12**; see Step 6g-iv). A true top-down / bird's-eye block describes ONLY the surface — moon, sky and stars as reflections, never a horizon / sky band / distant shoreline.
5. **Write a forbidden drift list** — objects/elements the AI must NOT hallucinate in this space
6. **Assemble the environment lockdown file** — save all of the above to `storyboard/environments/{world-name}.md`
7. **Subject Visibility Audit** — for each environment angle, walk its `appears_in` list and verify that every shot's primary subject is physically visible from that angle with the set in its scripted state. Check: is the subject on the camera's side of all barriers (doors, walls)? Has the subject arrived at this location? Is the subject in front of the camera? If not — the angle assignment is wrong. Reassign the shot or create a new environment/angle. See `../storyboard.md` → Step 2b.6 for the full algorithm.

For Seedance projects, also generate a combined multi-angle environment sheet that authors the `@Name` environment element (the same element Kling uses). For high-risk interiors, consider depth map extraction for ControlNet pipelines (see `../storyboard.md` → Step 2b.8).

### Step 2c — Generate Prop Plates (optional)

For hero props appearing in 3+ shots or carrying narrative weight. Multi-angle product reference sheet on clean mid-grey seamless background. Save to `storyboard/props/{prop-name}.md`.

### Step 3 — Define Style Anchors

Define the visual style for each timeline layer (PRESENT, MEMORY, TRANSITION, PAYOFF). These are conceptual anchors — production-ready style files are generated during animation-prompts (Step 10 of `../animation-prompts.md`).

### Step 4 — Assign Risk Levels

Use the full 11-factor risk matrix from `../animation-prompts.md` → Shot Risk Evaluation. Take the HIGHEST risk level across all factors.

| Risk | Action |
|---|---|
| LOW | Generate normally |
| MEDIUM | Note watch-for, provide fallback |
| HIGH | Must be resolved before proceeding |

### Step 5 — Group into Batches, Palette Groups, and Multi-Shot Groups

Batch shots sharing 1-3 elements. Apply Katz's cutting rhythm analysis (`reference/shot-flow-and-editing.md` → Rhythmic Principles) to inform grouping:
- Progressive flow (increasingly tight shots) suggests grouping continuous sequences
- Conflicting flow (jarring angle changes) suggests separate batches at the transition point

Assign multi-shot groups (Kling only) using the Generation Mode Decision Tree from `../animation-prompts.md`.

### Step 6 — Write TSV (Katz-Enhanced Camera Decisions)

**This is where the Katz methodology has its deepest impact.** Before writing each row, run the Katz analysis for each scene.

**6a. Run the 7-Question Dramatic Analysis** (from `reference/scene-analysis.md`):

For each scene, answer:
1. What is the **purpose** of this scene? → determines pacing
2. What does the **main character want**? → determines whose CU we favor
3. What does the character **see/experience**? → generates shots directly
4. What does the character **expect**? → determines setup shots before the turn
5. What **actually happens**? → the TURN — where staging/size shifts
6. What should the **audience learn, and when**? → information control (suspense/surprise/mystery)
7. What should the **audience feel**? → maps to shot size, angle, movement, lens

**6b. Determine Staging Pattern** (from `reference/staging-rules.md`):

For scenes with 2+ characters on screen:
- 2 characters → Pattern I. Select position (P1-P10) based on dramatic relationship.
- 3 characters → Pattern A (flanked), L (isolated), or I (line)
- 4+ characters → Identify 2-3 central characters, apply pattern to them, background the rest

If the scene has a **TURN**: start with one position, shift to another at the turn. Example: P3 (casual 90°) → P1 (face-to-face confrontation) when conflict emerges.

**6c. Assign Camera Using Triangle System** (from `reference/staging-rules.md`):

For each shot, derive camera setup from the dramatic analysis:

| Setup | When |
|-------|------|
| Master two-shot | Scene opening, reestablishing geography |
| Angular singles | Standard coverage, differentiation |
| OTS (over-the-shoulder) | Dialogue exchange |
| POV singles | Intimate reaction, emotional peak |
| Profile shots | Formal opposition, symmetry |

Shot size from emotional distance (Q7):
| Audience Should Feel | Shot Size |
|---------------------|-----------|
| Detached, epic | ELS / WS |
| Contextual, grounded | WS / MS |
| Engaged, present | MS / MCU |
| Intimate, vulnerable | CU / ECU |

**6d. Apply Q&A Editing Structure** (from `reference/shot-flow-and-editing.md`):

For the shot sequence within each scene:
- **Q → A (standard):** Character looks → what they see
- **A → Q (suspense):** Show danger → show character approaching
- **Q, delay, A (tension):** Raise question, insert shots, answer later

At the scene's TURN, mark it with a visual shift: shot size change, angle change, or line crossing.

**6e. Set Cutting Rhythm:**
- Tension building → shots get progressively tighter and shorter
- Release → cut to wider, hold longer
- Shock → abrupt size change (WS → ECU)

**6f. Intra-Scene Object Continuity Audit.** Before writing rows, build the **Object Continuity Manifest** and run the backward-propagation check from `reference/algorithm.md` → Step 7b. For each scene:

1. **Build the manifest** — create `storyboard/continuity/scene-{N}-objects.md`. For every persistent object and character, build a shot-by-shot table tracking: Location, State, Visible?, Notes. Include hidden objects (in pockets, closed cabinets) with their actual location. This is the source of truth the audit checks against.
2. For each item, find which shot introduces it first.
3. Walk backward using the manifest's Visible? column. If an item is marked visible but not described in the shot text — add it. Keep additions proportional to the shot's framing.
4. Track items that move — when a character puts an object down or picks one up, update the manifest and ensure subsequent shots reflect the new state.
5. **Prefer visible placement.** When the script hides an object ("under the pulpit"), consider moving it to a visible surface. Hidden objects are invisible to AI models. Visible planting makes pickups feel earned.

This audit catches the most common AI-animation continuity break: an object that appears mid-scene as if from nowhere because earlier shots didn't plant it. The manifest catches a second failure mode: objects that SHOULD be mentioned but aren't — the audit alone can only verify objects that ARE mentioned.

**6g. Intra-Scene Action Continuity Audit.** After the object audit, verify that character physical states flow correctly between shots. For each character in the scene, walk through their on-camera appearances in order. The opening state of each appearance (position, posture, held objects, facing direction) must match the closing state from their **most recent on-camera shot** — which may be one, two, or several shots back. Inserts, cutaways, CU shots of a different subject, and reaction shots of other characters are all skipped when finding the "previous" state. Example: A (Peter kneeling) → B (insert of phone) → C (Peter again) — C bridges from A, not B.

Record the per-character state timeline in the continuity manifest (`storyboard/continuity/scene-{N}-objects.md`) so it becomes the source of truth. If a gap exists — character was kneeling and now stands, was at the pew and now at the altar, was holding a screwdriver and now hands are empty — bridge it in the Subject & Action. The video prompt layer is the most critical: Kling/Seedance have no memory of previous shots, so every physical transition must be spelled out (starting posture → movement → arriving posture). The nb-prompt.md inherits from the opening state since it captures frame 1. See `reference/algorithm.md` → Step 7c for the full algorithm and common miss patterns.

> ⚠ **A correct manifest is not enough — it must be propagated and enforced.** The manifest timeline being internally consistent (each opening state chains from the prior closing state) does NOT mean the prompts honor it. Two gates close the loop; both are mandatory:
>
> **6g-i. Manifest → prompt conformance gate.** For every on-camera shot, diff the manifest's opening-state row against the words actually in that shot's `shot.md` Subject & Action AND `nb-prompt.md` `[Action]`/`[Subject]`. The prompt must **explicitly state** the manifest's posture, position, held objects, and facing. **Silence is a failure, not just contradiction** — a prompt that says "swings the shard" without restating "on his back, propped on one elbow" FAILS this gate even though it contradicts nothing on paper. Do not accept a manifest ✔ as proof the prompts conform; the ✔ means the timeline is logical, not that the prompts match it. Fix by writing the manifest state into the prompt verbatim.
>
> **6g-ii. Model-default (prior) check.** For every shot, ask: *if I left this unstated, what would the image model default to for this subject + action?* The model fills any unspecified slot with its training prior, and the prior is **not neutral** — it defaults toward two things:
> - **Default posture/position.** "Heavy man swinging a rock" → a standing batter's stance; "person at a desk" → seated upright; "figure in a doorway" → standing centered.
> - **Default toward the flattering/average ("beautification drift").** The model quietly slims, straightens, de-ages, and fitness-improves a body — *especially as a character goes vertical or active*. A deliberately unflattering, overweight, or hunched character will drift toward fit/average unless the unflattering build is positively re-asserted **every shot**. A character reference / Kling Element locks **identity (face, wardrobe), not pose and not reliably build** — do not assume it holds the body; restate the build in words. (Worked example: Hale rendered noticeably slimmer in his stand-and-swing shot even with his Element attached.)
>
> **The fix is POSITIVE phrasing first — this is the load-bearing control.** State the correct posture AND the correct build as positive, present-tense physical clauses ("hips, backside and legs in full contact with the floor, not risen"; "heavy soft belly straining the stretched t-shirt, body unchanged, only the posture lifts"). Do **not** rely on the negative prompt to do this work on a NanoBanana/Gemini-class still: those models are conversational/autoregressive and expose **no true negative-prompt parameter** — Google's own guidance is "describe the scene positively, don't list what to exclude," and a `standing` negative there is a weak hint that can even *introduce* the concept. Treat any negative-prompt line on a `platform: nanobanana` prompt as a low-weight backup, never the primary lock; the wrong default must be **crowded out by an explicit positive assertion**, not merely named in the negatives. (Negative prompts ARE a real, supported lever at the **Kling/Seedance video stage** — use them there as a secondary guardrail, but still positive-anchor the pose/build/held-object in the motion prompt.)
>
> Apply this hardest right after an insert (the last full-body anchor is ≥2 shots back, so the prior dominates) and on any shot whose action reads as a default-standing motion (swing, throw, reach, lift) or whose drama depends on an unflattering/grounded body (rock-bottom, exhaustion, defeat).
>
> **6g-iii. Action-target presence check.** A **transitive** action directed AT something needs its target *in the frame*. For every shot whose Subject & Action strikes / reaches for / looks at / pushes / aims at something, that something (the antagonist, object, eyeline target) must be present in the shot's `elements:` and described in `[Subject]`/`[Action]` — otherwise the model renders the action happening to **empty space** (a man swinging at nothing). This is distinct from the object-continuity audit (6f), which catches a target *appearing from nowhere* in a later shot; this catches the inverse — a target that was present in the prior shot, is still the object of the action, and gets **silently dropped** from the continuation. Watch especially when the target is a **concealed** element (a creature kept in shadow): the instinct is to omit it to keep it hidden, but omission removes the action's anchor. The fix is to keep it present **as what little is shown** — "a shapeless shadow-mass looming above him, no anatomy" — so the strike lands somewhere, while concealment is preserved positively (per 6g-ii) and only the *impact* is hidden by the cut.
> **Exceptions — when absence is deliberate, not a defect:** (a) *fleeing* an unseen pursuer (the threat is behind/off-frame on purpose — the running shot needs only the runner); (b) addressing a *disembodied or intentionally-absent* presence (e.g. the guardian-voice — Hale speaks/looks into an empty void by design because the voice has no source; do NOT invent a target there). The test: would the empty space read as *broken* (swinging at nothing) or as *intentional* (alone with a voice)? Only the broken case fails this gate.
> (Worked example: 3C — Hale swings up from the floor, continuing 3A where the creature loomed over him; the first pass dropped the creature from 3C's elements and even negated `visible creature`, leaving him striking air. Fix: re-add the creature as an above-frame shadow-mass target; suppress only the *reveal* — lit anatomy/eyes — not the presence. Contrast 4B, where Hale speaks to the empty dark — that void is intentional and correctly stays empty.)

> **6g-iv. Camera-perspective coherence.** Reconcile each shot's framing with its environment plate's perspective. A **true top-down / bird's-eye** frame (camera straight down) is a *plan view*: it physically cannot contain a horizon, sky band, or distant shoreline — sky, moon and stars may appear ONLY as **reflections** on the surface. Pulling an eye-level `[World Plate]` (with a horizon / distant shore) into an overhead shot produces the *fake-perspective clash* — the subject reads as **pasted onto a backdrop**, because its ground-plane and the background's don't share a vanishing geometry (the otters that came out "standing" against a horizon-vista lake). Fix: give the environment a **per-angle** `[World Plate]` + master plate (Step 2b.4) and pull the one matching the shot's `shot_type`; on top-down shots add `horizon, sky band, shoreline, eye-level view, perspective view` to the negatives. **Enforced by L12:** a strict top-down `shot_type`/`camera` whose `[World Plate]`/`[Camera]` names an un-negated horizon/sky/shore fails the gate. An *angled* "high wide overhead" shot (e.g. a Spike) legitimately sees a horizon and is exempt — the rule fires only on straight-down/bird's-eye language. Text can't see a plane mismatch the tokens miss, so confirm at image review (Step 9) that the subject's plane and the background's plane agree.

**6h. Action Density Audit.** For each shot, decompose the Subject & Action into discrete physical beats (one beat = one change in body state: stand, walk, reach, pick up, react). Apply the capacity rule: 1-2 beats per 3-5s is safe; 3 beats needs review (can they flow as one continuous motion?); 4+ beats must be split. When splitting, each sub-shot gets one clear dramatic function (movement, insert, reaction). Append a suffix to preserve ordering: `1E` → `1E-1`, `1E-2`, `1E-3`. A split must preserve the original beat's dramatic value. See `reference/algorithm.md` → Step 7d for the full algorithm.

**6i. Write the TSV row.** One row per shot. Tab-separated. 12 columns:

| Column | Content |
|---|---|
| Shot | `0A`, `1A`, `1B`, `2A`, etc. |
| Place / Setting | Location and period |
| Emotion | Dominant emotion → maps to camera language and color/palette |
| Shot Type | Angle + size (derived from Katz analysis) |
| Camera Movement | Static / Dolly in / Dolly out / Tilt / Rack focus / etc. |
| Duration | In seconds |
| Color & Mood | Film stock + palette + lighting |
| Subject & Action | What is visible + what is happening. Present tense. **Three-detail audit mandatory** |
| VO/Lines | Exact VO line, or TEXT: card, or (silence) |
| SFX / Audio | Sound design notes |
| Shot image | Leave blank |
| Notes | Tool, risk level, format, physics notes |

**Three-detail audit (mandatory).** Every Subject & Action cell must name:
1. **Environmental pressure** — physical fact about the space
2. **Physical micro-action** — emotion translated into the body
3. **Sound anchor or visual motif** — recurring perceptual hook

Build the TSV using the three-layer storyboard method from `../reference/video-dramaturgy.md` § 10: (1) map dramatic beats, (2) assign shot functions, (3) set editing rhythm.

Save as `{project_name}_storyboard.tsv`.

### Step 7 — Write PromptSync Shot Directories

For each shot in the TSV, create `storyboard/shots/{code}/` containing:

#### `shot.md` — Shot metadata

```markdown
---
shot: "{code}"
setting: "{place/setting}"
emotion: "{dominant emotion}"
shot_type: "{from Katz analysis → camera language}"
camera: "{movement}"
duration: "{Xs}"
color_mood: "{film look + palette + lighting}"
aspect_ratio: "{16:9|9:16|1:1}"
status: draft
asset_type: "{still|kling|seedance|kling-reuse}"
reuses: null
start_frame_shot: null   # setup-chain predecessor (same subject + angle + closeness) whose last frame becomes this shot's I2V start frame; null = fresh storyboard image (different-closeness returns stay null — Step 6c state carry). See reference/shot-flow-and-editing.md → Setup Chains
palette_group: "{name or null}"
risk: "{low|medium|high}"
multi_shot_group: null
speech_pace: null
speech_on_camera: null
elements:
  - {ElementName1}
  - {ElementName2}
---

## Subject & Action
{Present tense. Three-detail audit: environmental pressure + physical micro-action + sound anchor/visual motif.}

## VO / Lines
{Exact VO line, or (silence)}

## SFX / Audio
{Sound design notes}

## Notes
{Tool, risk level, key production notes.}
```

#### `nb-prompt.md` — NanoBanana image prompt

Uses `@ElementName` shorthand. Labeled block format:

```markdown
---
shot: "{code}"
aspect_ratio: "{9:16|16:9|1:1}"
platform: "nanobanana"
---

[Scene & Mood]: {emotional register, palette direction, atmospheric tone. Volumetric: haze density, particulate behavior, light shaft presence.}
[Frame Map]: {depth-plane decomposition — foreground/midground/background with atmospheric separation between planes.}
[Subject]: @CharacterName , {shot-specific appearance details}.
[Action]: {Physical state at frame 1 — pose, weight, tension. Static frame, no motion verbs. State the inherited posture/position AND the character's build EXPLICITLY (from the manifest opening-state + element sheet, Step 6g) even when "obvious" — silence lets the model default to a standing/flattering prior. Carry the correct pose/build as POSITIVE physical clauses; on a NanoBanana/Gemini still the negative prompt is a weak backup, not the lock (Step 6g-ii).}
[World Plate]: @EnvironmentName , {canonical environment block + shot-specific atmosphere}.
[Optical Realism]: {Behavioral capture + lens + aperture as physics package (no brand names). Film look + grain intensity. 2-4 physical imperfections. 1-2 depth effects. MANDATORY.}
[Camera Capture]: {Format. Shot size + angle (from Katz analysis). Behavioral lens feel. Quality boosters, resolution signal.}
[Skin & Surface]: {Anti-plastic defaults for MCU/CU/ECU — specular control, peach fuzz, subsurface scattering. Skip for WS/LS.}

Negative prompt: {Standard + anti-plastic + volumetric + vertical (for 9:16) + period-specific.}
```

**Rules for image prompts:**
- Use `@Element` shorthand — do not copy Identity Blocks into every prompt
- Always add a space after every `@Element` name
- Pose and blocking represent the shot's starting state, not mid-action
- **Posture and build are stated, never implied.** The `[Action]`/`[Subject]` blocks must spell out the manifest opening-state (posture, position, held objects, facing) AND restate the character's build from the element sheet — in positive words. An "obvious" posture or an "already-locked" body left unstated will be filled by the model's prior, which defaults to standing and to a slimmer/more flattering physique (worst in vertical/active shots). On NanoBanana/Gemini the negative prompt is a low-weight backup, not the lock — crowd out the wrong default with an explicit positive assertion (Step 6g-ii). This is the gate that prevents grounded characters from being rendered standing and overweight characters from being rendered fit.
- Static frame only — no motion verbs, no temporal language
- Every `nb-prompt.md` must include the `[Optical Realism]` block — it cannot be skipped
- **No off-screen references.** Only describe characters and elements visible in the frame. Do not mention characters who are off-frame, off-screen, or in a previous/next shot — NanoBanana cannot see them and the reference is meaningless noise. When an off-frame character is needed as a spatial anchor (eyeline target, action direction), replace the name with a visual or spatial description: "toward the figure in the doorway", "facing the visitor off-frame" — never "toward Peter", "facing Sarah"

### Step 8 — Write project.yaml (and series.yaml for a series)

For a **single project** or for each **episode**, write `project.yaml`:

```yaml
name: "{Project Title}"
slug: {project-slug}
created: {YYYY-MM-DD}
status: in-progress

drive_folder_id: null
default_style: null
shot_prefix: ""

consistency_check:
  status: pending
  checked_date: null
  characters: []

element_creation:
  status: pending
  checked_date: null
  characters: []
```

For a **series**, also write `series.yaml` once at the series root. It is the manifest that ties the episodes and the global library together (the platform reads it to present the series as one openable project with its global element tabs):

```yaml
name: "{Series Title}"
slug: {series-slug}
type: series
status: in-progress

aspect_ratio: "9:16"
default_resolution: "1K"

global_elements: storyboard      # dir holding the shared characters/ environments/ props/
bible: bible                     # narrative canon dir (Documents only)
episodes:                        # story order; auto-discovered under episodes/ if omitted
  - episodes/{ep01-slug}
  - episodes/{ep02-slug}
```

### Step 9 — Character Consistency Check (after image generation)

After NanoBanana storyboard images are generated, compare every image against the character's visual anchors. For each character, for each shot:
1. Open the generated image alongside reference images
2. Check every Visual Anchors item
3. Check Consistency Notes → "Watch for" items
4. Verify wardrobe materials and distinctive features under cinematic lighting
5. **Posture/blocking AND build conformance** — look at the actual pixels and check the generated pose + body against the continuity manifest's opening-state (Step 6g) and the element sheet's build. A face/wardrobe match is NOT a pass if the body is wrong on either axis: a character the manifest places on the floor must not be rendered standing, and a "noticeably overweight" character must not be rendered slim/fit. Both are model-default failures (Step 6g-ii) — identity can be perfect while posture silently defaulted to standing and the physique silently drifted toward flattering. Beautification drift is worst in vertical/active/hero shots, so scrutinize those hardest. This pixel check is the only thing that catches these — the upstream text gates cannot see them.

If drift is detected: regenerate `nb-prompt.md` with stronger anchoring (for posture drift, add the explicit grounding cue + the wrong default in the negative prompt). Do NOT proceed to animation prompts until all characters pass.

Update `project.yaml` → `consistency_check`.

### Step 10 — Create Kling Elements in OpenArt

After consistency check passes, create Kling Elements for every character in `asset_type: kling` shots. Upload the 4 approved reference images per character.

**Element name binding check:** Verify every `@Name` matches an `element_name` from a character/environment file. Fix mismatches before creating in OpenArt.

Update character files: `element_status: not-created` → `element_status: created`.

**Gate:** All characters in Kling shots must have `element_status: created` before handing off to `story-saint-prompter`.

---

## KATZ → PROMPTSYNC BRIDGE

The Katz reference files use their own output vocabulary. This bridge maps Katz concepts to PromptSync fields:

| Katz Concept | PromptSync Field / Location |
|---|---|
| Scene heading (INT/EXT, location, time) | `shot.md` → `setting` |
| Scene classification (DIALOGUE-STATIC, ACTION, etc.) | Not stored — used during analysis to select staging rules |
| 7-Question answers | Not stored — used during analysis to derive camera choices |
| Staging pattern (I/A/L) | Not stored — used to determine character positions in Subject & Action |
| Two-player position (P1-P10) | Reflected in `shot.md` → `shot_type` and in nb-prompt `[Subject]` blocking |
| Shot size (ELS/WS/MS/MCU/CU/ECU) | `shot.md` → `shot_type` field |
| Camera angle (eye level/low/high/dutch) | `shot.md` → `shot_type` field (combined with size: "Low angle MCU") |
| Camera height | nb-prompt `[Camera Capture]` block |
| Lens choice (wide/normal/telephoto) | nb-prompt `[Camera Capture]` + `[Optical Realism]` blocks |
| Camera movement | `shot.md` → `camera` field |
| Frame Description | nb-prompt `[Subject]` + `[Action]` + `[World Plate]` blocks |
| Action (what happens during shot) | `shot.md` → Subject & Action section |
| Dialogue/Sound | `shot.md` → VO / Lines + SFX / Audio sections |
| Edit → Next | TSV Notes column (e.g., "hard cut on action", "match cut to next") |
| Narrative Function (Q/A) | TSV Notes column (e.g., "Q: raises question about...", "A: reveals...") |
| Scene Turn marker | TSV Notes column (e.g., "TURN — shift from P3 to P1") |

**Key principle:** Katz's analysis is the thinking process. PromptSync is the output format. The thinking enriches the output — the output format doesn't change.

---

## STATUS FLOW BY ASSET TYPE

| `asset_type` | Status flow |
|---|---|
| `still` | `draft → nb-ready → nb-done → complete` |
| `kling` | `draft → nb-ready → nb-done → kling-ready → kling-done → complete` |
| `seedance` | `draft → nb-ready → nb-done → seedance-ready → seedance-done → complete` |
| `kling-reuse` | Mirrors source shot → `complete` when source reaches `kling-done` |

---

## STANDARD NEGATIVE PROMPT

Apply to every NanoBanana storyboard image:

```
flat lighting, smooth plastic skin, generic, amateur, digital noise,
morphing features, modern clothing, modern objects, photography artifacts,
oversaturated, cartoon, illustrated, anime, text, watermark, logo, extra limbs,
blurry faces
```

**Add for 9:16 vertical:**

```
wide horizontal composition, landscape framing, cramped side elements,
distorted vertical proportions, stretched horizontally, empty side space,
bad vertical framing, horizon in center, weak vertical lines
```

Adjust for period and genre.

---

## HANDOFF TO PROMPTER

When the storyboard is complete — all shots written, three-detail audit passed, consistency check passed, **Structure Audit passed** (PROJECT LAYOUT → STRUCTURE AUDIT), Kling Elements created — tell the user:

> "Storyboard is locked. Use **story-saint-prompter** to generate animation prompts, voice design, and music blocks."

The handoff payload:
- `{project}_storyboard.tsv`
- `storyboard/shots/{code}/shot.md + nb-prompt.md` for every shot
- `storyboard/characters/{name}.md` for every character (with `status: reference-done`, `element_status: created`)
- `storyboard/environments/{name}.md` for locked environments
- `project.yaml` with `consistency_check.status: passed`
- `pre-production.md` (from storyteller, for visual grammar and creative decisions)

---

## RULES

- Do not start storyboarding until the script is locked and characters are designed.
- **Structure Audit is mandatory.** Run the PROJECT LAYOUT → STRUCTURE AUDIT gate when you enter a mode, whenever you create or move an element file, and as a hard gate before handoff. A failed check must be **corrected**, not just noted: misplaced elements get moved, missing `series.yaml`/dirs get created, broken `canon:` links get fixed, unintended `element_name` collisions get renamed. For a series, global (recurring) elements live in `{series}/storyboard/`, never duplicated into an episode.
- **Intra-scene object continuity is mandatory.** After writing all shots for a scene, run the backward-propagation audit (Step 6f / `reference/algorithm.md` → Step 7b). Every object, character position, and prop that appears in a later shot must be present in all earlier shots of the same scene where the camera framing would reveal it. This applies to all layers: shot.md Subject & Action, nb-prompt.md blocks, the TSV Subject & Action column, and Kling/Seedance video prompts (`[Subject]` or `[Context]` blocks). Static objects that appear in a Kling start frame must be anchored in the video prompt so the model doesn't erase them during generation.
- **Intra-scene action continuity is mandatory.** After the object audit, run the action continuity audit (Step 6g / `reference/algorithm.md` → Step 7c). Each character's opening physical state in a shot must match their closing state from their **most recent on-camera appearance** — which may be one, two, or several shots back when intervening shots are inserts, cutaways, or other characters' reaction shots. Position, posture, held objects, and facing direction must all bridge correctly. The video prompt layer is the most critical: Kling/Seedance have no spatial memory across shots, so every transition (rise, walk, turn, put down, pick up) must be spelled out explicitly. The script layer may use implicit phrasing ("crosses back"), but the video prompt must describe the full physical sequence from the character's last known state. **A correct manifest does not close this audit** — you must then run the two enforcement gates (Step 6g-i / 6g-ii): diff every prompt against its manifest row (silence = failure, not just contradiction), and for any shot whose unstated default posture OR build would be wrong, crowd out the model's prior with explicit POSITIVE pose + build clauses (the negative prompt is a weak backup on NanoBanana, not the lock). Re-check the rendered image's posture AND build against the manifest and element sheet again at image review (Step 9) — text-vs-text cannot see a default-pose/beautification failure; only looking at the pixels can. And confirm every transitive action has its target IN the frame (Step 6g-iii): a strike/reach/flee/look directed at a target that was dropped from the shot's elements renders as action against empty space — keep a concealed target present as shadow rather than omitting it.
- **Action density audit is mandatory.** After continuity checks, decompose each shot's action into discrete physical beats (Step 6h / `reference/algorithm.md` → Step 7d). A beat is one change in body state: stand, walk, reach, pick up, react. If a shot has 4+ beats, split it. If it has 3, review whether they flow as one continuous motion — if not, split. Each sub-shot must serve one clear dramatic function (movement, insert, reaction). This audit catches a different problem than risk evaluation: individually low-risk actions that collectively overwhelm a single generation.
- **Camera-perspective coherence is mandatory.** Run the perspective audit (Step 6g-iv): a true top-down / bird's-eye shot must not describe a horizon, sky band, or distant shoreline (sky/moon/stars only as reflections). Author **per-camera-angle `[World Plate]` blocks** (Step 2b.4) and pull the one matching each shot's `shot_type`; never paste one block across top-down + eye-level — that imports a horizon into an overhead frame and the subject reads as pasted onto a backdrop. Enforced by **L12** in the continuity engine (strict straight-down only; an angled high-wide shot is exempt), but confirm at image review (Step 9) that the subject's ground-plane and the background's perspective agree.
- **The Spike frame is mandatory (short-form / serialized-for-platform series only).** Per `../reference/clip-yield.md`, each episode carries one **Spike** — a loud, visible spectacle/power beat that doubles as the discovery clip and thumbnail. Build it as a single engineered money-shot / single-impact / one-reveal frame (AI-safe per the action grammar — no sustained choreography), and give the **Cold Hook** opening its strongest frame too. These are the shots the prompter's viral extraction targets; if the episode has no shot that can stand as its Spike, flag it to the user rather than shipping a discovery-less episode. Skip this rule for long-form.
- One still prompt per shot. Shot 1A and 1B are separate rows and separate prompts.
- @Element files must have Identity Blocks specific enough to generate consistent results.
- Style anchors must be applied consistently. A memory shot that looks like a present shot breaks the visual grammar.
- Shot image column stays blank — filled by creator after generation.
- Do not add new story beats not in the script. You MAY split beats for AI animation constraints.
- Every `nb-prompt.md` must use labeled block format with mandatory `[Optical Realism]`.
- Do not overwrite existing files — increment version: `_v2`, `_v3` for TSV.

---

## THINGS THIS SKILL DOES NOT DO

1. Does not develop stories or write scripts. Receives from `story-saint-scriptwriter`.
2. Does not generate Kling/Seedance video prompts, voice profiles, or music blocks. Hands off to `story-saint-prompter`.
3. Does not write 5 variants. One version + one argument.
4. Does not "improve" content the user did not ask to change.
5. Does not invent new story beats.
