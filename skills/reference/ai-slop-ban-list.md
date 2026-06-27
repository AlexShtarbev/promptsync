# AI Slop Ban List — Named Tells + Pre-Flight Gate

Adapted from the "anti-slop" method used by frontend design skills (a catalog of *named* AI defaults plus a mandatory pre-flight checklist), ported to the AI-image / AI-video pipeline.

**The whole idea in one sentence:** name the specific things the model reaches for by default, then verify every prompt against the list *before* it ships — instead of catching slop after a bad generation.

> **The disease under the symptoms.** This catalog is a symptom list. The underlying cause is one thing: **the "rendered / CG" look is what fills a vacuum of unresolved intent** — wherever a prompt is ambiguous, contradictory, or redundant, the model's smooth-symmetric prior leaks through. So every tell below is a place the prompt failed to *resolve* intent. The two deepest fixes are general: **specify a coherent photographic target** (film stock, lens, capture condition, lighting) and **remove contradiction/redundancy** (don't restate what a reference image already holds; don't grade warm against a cold light). See `nanobanana-artistry.md` → "Photographed, not rendered — the coherence model" for the full model and the official-source backing.

This file is **one catalog, two enforcement columns**, because the two stages obey different physics:

- **NanoBanana (stills):** negative prompts are **weak** — the model ignores "not fat / not pretty" and slims, smooths, and beautifies anyway. Enforce tells here with **POSITIVE phrasing** in the prompt body + reference-image conditioning. (See `nanobanana-artistry.md` → Positive Framing.)
- **Kling / Seedance (video):** negative prompts **work**. Enforce tells here with **negative-prompt terms + staging**. (See `kling-reference.md` → Physics Negative Prompts, `animation-prompts.md` → Negative Prompt Assembly.)

A tell that strikes at *both* stages gets fixed twice — once positively on the still that becomes the I2V start frame, once with a negative on the video.

---

## HOW TO USE THIS FILE

1. **Per shot, before writing the prompt:** scan the catalog, identify which tells this shot is exposed to (by subject, contact, palette, camera, motion), and bake the listed enforcement into the prompt.
2. **Per shot, before the prompt ships:** run the PRE-FLIGHT GATE (bottom of file). Any unchecked box = the prompt is not done.
3. **This list is additive, not a replacement.** It points to the existing enforcement blocks (`[Optical Realism]`, Hyperrealism block, Physics Negatives, two-body staging) rather than duplicating them.

This file is a **vocabulary to select from, not a wall to paste.** Kling/Seedance degrade past ~8 negative terms (`kling-reference.md` → Limits). Pick the 5-8 terms that match *this* shot's actual exposure.

---

## THE CATALOG

Each tell: what the model does by default → the named tell → where it strikes → how to enforce.

### 1. The body/face tells — *the model slims and beautifies, and identity dumps read CG*

Two failures live here, and they pull in opposite directions — which is the whole subtlety. NanoBanana narrows waists and beautifies faces **regardless of the reference** (so build must be stated positively in text); but *re-describing the reference's identity* in text (colour, species, wardrobe) **fights the reference image** and reads rendered (so those must NOT be restated). The rule that resolves both: **state only what the reference can't hold; never what it already holds.** Build is the named exception — the reference can't hold it, so it stays.

| Tell | Strikes | Enforcement |
|---|---|---|
| **Auto-slimming** — waist/build narrowed toward a fashion default | NB (stills) | POSITIVE, and build is the **one identity attribute the reference can't hold** — keep it: the physics compiler's mandatory build clause (`broad heavyset frame, soft belly`) + reference-image conditioning. Don't rely on negatives. |
| **Identity dump** — colour/species/wardrobe re-described in `[Subject]` alongside the `@Element` | NB (stills) | DELETE it. The reference holds identity; restating it makes text compete with the image → CG look. Keep `[Subject]` to the element ref + place + the build clause; push behaviour into `[Action]`. (See `nanobanana-artistry.md` → reference-complement rule.) |
| **Beautify / symmetry** — blemishes erased, face made model-pretty | NB | POSITIVE: name the imperfections to keep ("crooked nose, asymmetric brow, gap teeth"). Hyperrealism block's "natural unevenness" is the floor. These are *blind spots* — the reference often won't carry them, so state them. |
| **Plastic / airbrushed skin** | NB **and** video | NB: Hyperrealism block (pores, subsurface scattering, peach fuzz). Video: negative `plastic skin, smooth airbrushed skin, waxy, CG skin`. |

Cross-ref: `nanobanana-artistry.md` → reference-complement rule + Hyperrealistic Photography Block. Machine backstop: `check-images --clip` catches slimming at the pixels (text can't).

### 2. The color-drift tell — *warm/sunset creep*

Multi-panel boards and the **last frame of any sequence** drift toward warm/amber/sunset even when the scene is neutral or cool.

| Tell | Strikes | Enforcement |
|---|---|---|
| **Warm/sunset drift** — palette creeps amber, esp. final panel/frame | NB **and** video | Pin ONE hue explicitly in every panel's color line; **forbid amber by name** in the body. On video, add negative `amber color cast, sunset grade, warm push` and pin `[Last Frame]` color. Fix **only** the color lines — don't rewrite the panel. |
| **Per-section/per-shot palette wander** — accent color changes between shots | NB **and** video | Lock one accent/grade in the style file (`storyboard/styles/{name}.md`); every shot inherits the same grade line verbatim. |

Cross-ref: memory = storyboard panel color drift; the fix is surgical (color lines only). **Machine backstop (free, deterministic):** `npm run check-images -- --slug <slug> --root <dir> --colortemp` measures each render's warmth against its declared `color_mood`/time-of-day and flags warm-on-cool drift — the one realism tell enforceable without a model. Same contradiction as §1, in the colour channel.

### 3. The contact tell — *two-body interactions break*

Any shot where two bodies turn into, hand off to, or make contact with each other (snuggle, embrace, pass-object, handshake) breaks on **both** Kling and Seedance. Tool choice does not fix it.

| Tell | Strikes | Enforcement |
|---|---|---|
| **Two-body contact morph** — bodies merge, limbs pass through, hand-off teleports | Kling **and** Seedance | **Staging, not tool switch.** Start the shot *mid-action* (already touching), or *cut to result* (post-contact), or have bodies *drift together* slowly. Author the contact as a single continuous state, never a switch. |

Cross-ref: memory = two-body contact: stage, don't switch; `kling-reference.md` → physics/contact; `seedance-reference.md` → anti-mush guard.

### 4. The CG-tell cluster — *it looks rendered, not filmed*

The model omits the physical artifacts of real glass + emulsion, producing a clean digital render the eye reads as fake.

| Tell | Strikes | Enforcement |
|---|---|---|
| **Uniform sharpness / no grain** — every depth plane equally crisp | NB **and** video | `[Optical Realism]` block (depth-dependent grain, foreground-sharp / background-dissolved). |
| **CG fur / hair** — clumped, uniform, no flyaways | NB **and** video | NB: strand-by-strand + flyaways (Hyperrealism block). Video: negative `CG fur, clumped fur, uniform hair, video-game hair`. |
| **Flat / unmotivated lighting** — even fill, no source logic | NB **and** video | Name the actual light source and its direction; motivated lighting in `[Camera Capture]`. Video negative: `flat lighting, even fill, unmotivated light`. |
| **Camera-fingerprint absence** — no aberration, halation, roll-off, vignette | NB **and** video | `[Optical Realism]` block; post-grade/grain pass in `post-production.md`. |

Cross-ref: memory = AI realism & coherence levers; `nanobanana-artistry.md` → Optical Realism + Hyperrealism; `post-production.md`.

### 5. The perspective tell — *one plate, many angles*

Perspective/camera coherence is unguarded by the staging and continuity gates. The model will happily render a top-down beat and an eye-level beat from the *same* pasted world description, and they won't agree.

| Tell | Strikes | Enforcement |
|---|---|---|
| **One World Plate across mismatched angles** — top-down + eye-level share text → spatial contradiction | NB **and** video | Author a **separate `[World Plate]` per camera angle**. Never paste one plate across different perspectives. Generate the plates *first*, then shots. |
| **Default framing reflex** — model centers the subject / picks the most generic angle | NB | The storyboard already chose the angle for dramatic reasons (Katz). Restate it explicitly and positively; don't let NB default-center. Name the composition anchor. |

Cross-ref: memory = perspective coherence gap; composition-bias adapted from imagegen "left-text/right-image is the most overused default — allowed, but not your first instinct."

### 6. The consistency tell — *the cast drifts between shots*

Cross-shot / cross-clip character and world consistency is the pipeline's biggest manual cost. The model has no memory between generations; "one brand world" must be enforced by you.

| Tell | Strikes | Enforcement |
|---|---|---|
| **Character drift** — same character, different face/build/wardrobe across shots | NB **and** video | Bind the OpenArt element (`@Name`) on every shot; on NB restate the locked descriptors verbatim from the character sheet. The element carries identity — never re-describe it freshly. |
| **World drift** — same location renders differently shot to shot | NB **and** video | Bind `@EnvironmentName`; inherit the canonical environment block from the environment sheet verbatim. |
| **Grade/treatment drift** — color grade, grain, framing language change between shots | NB **and** video | One style file (`storyboard/styles/{name}.md`); same grade/grain/treatment line in every prompt. |

Cross-ref: keyframe/multi-shot workflow memory (cross-clip consistency is manual); imagegen "one brand world" enforcement.

---

## PRE-FLIGHT GATE

Run before any prompt ships. Adapted from the frontend skill's mandatory pre-flight checklist. **Any unchecked box = not done.** Skip a row only when the shot genuinely can't trigger that tell (e.g. no second body → skip contact).

### NanoBanana still — gate

- [ ] **Build** named positively; reference-image proportions restated (no reliance on negatives to prevent slimming)
- [ ] **Imperfections** the character should keep are named (model will erase them otherwise)
- [ ] **Skin** carries the Hyperrealism block (hero/key frames) — not "photorealistic" as a keyword
- [ ] **One hue pinned**; amber forbidden by name if the scene isn't warm
- [ ] **`[World Plate]` matches this shot's camera angle** — not pasted from a different perspective
- [ ] **Composition anchor named** — the storyboard's chosen framing, not a default center
- [ ] **`@Element` bound** for every recurring character/world; descriptors verbatim from the sheet
- [ ] **`[Optical Realism]`** present (hero/key frames; skip on flat reference sheets)
- [ ] Grade/grain line **identical** to the project style file

### Kling / Seedance video — gate

- [ ] **Negative term count 5-8** — selected for *this* shot's actual exposure, not pasted wholesale
- [ ] **Two-body contact staged** (mid-action / cut-to-result / drift-together) — never a switch — if a second body is present
- [ ] **Plastic skin / CG fur / flat lighting** negatives present *only if* the shot is exposed to them
- [ ] **Amber/sunset push** negated + `[Last Frame]` color pinned if the scene isn't warm
- [ ] **`@Name` element bound** for every character; `@EnvironmentName` for the world
- [ ] **Motivated lighting** named in `[Camera Capture]` (source + direction)
- [ ] **Start frame** is the gated NanoBanana still (its positive locks carry into I2V)
- [ ] Motion scale / staging consistent with the contact and physics risk

> **Tells are weighted, not equal.** On stills, the body/beautify (§1) and color-drift (§2) tells are the highest-frequency failures — check those first. On video, contact (§3) is the highest-severity break. Spend the gate's attention there.

---

## OPTIONAL: GENERATION DIALS (deferred — not yet wired)

The frontend skill reads numeric dials (1-10) from the brief and gates every choice on them. The pipeline analog would be per-project/per-shot dials declared in `project.yaml`:

- **Realism** (stylized ↔ photoreal) — gates how heavily `[Optical Realism]` + Hyperrealism load
- **Motion-risk** (static ↔ complex contact) — gates motion scale + contact staging
- **Stylization** — gates grade aggression
- **Density** — gates how much happens per shot

This is intentionally **not** implemented here — it touches the `project.yaml` schema and every generation decision. Pull it in as a follow-up if the named-tells catalog proves its worth first.
