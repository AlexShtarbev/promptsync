# Seedance 2.0 Reference — Character Locking, Multi-Shot, and Prompt Structure

Seedance (ByteDance) is a video generation model with multi-shot capability, character locking via OpenArt `@ElementName` element references (same mechanism as Kling), and diegetic audio support. Use alongside Kling — Seedance excels at multi-shot montage and character-locked sequences; Kling excels at expression control. The single uploaded image is the storyboard start frame, referenced as `@image1`.

**Default to 720p, 9:16 vertical for short-form content.** Upscale in post with Topaz Video. Adjust aspect ratio per shot if the project requires mixed formats.

---

## THREE CARDINAL RULES

These three rules have the highest impact on consistency and hit rate. They are non-negotiable.

### 1. Wardrobe First, Image Prompt Second

Never ask for outfit and image in one shot — characters drift. Describe the fit in plain language, get approval, *then* render. This is the difference between a character showing up as herself every time and slowly becoming a different person across forty generations.

### 2. Visual Markers, Never Names

Seedance treats a character name like "Sol" as noise. It treats "rose-pink braids, red lollipop, bumblebee yellow armor" as signal. **Names must never appear in prompts.** Every character is described by hair color, wardrobe, and identity markers only. In group scenes this means describing by depth and position: "the jet-black-haired figure in the foreground," "the silver-white-platinum-bob figure behind her left shoulder," etc.

### 3. Diegetic Audio Only

Only describe what the camera would physically pick up — footsteps, fabric rustle, breath, room tone. Writing music cues into prompts creates visual ghosts and artifacts. Let the generation UI handle anything musical. A muffled track bleeding from a green room down the hall is fine — a score cue is not.

### 4. Motivated Lighting Only

Every photon hitting the subject must have a clear source visible in (or inferable from) the frame. Never write "well-lit" or "studio lighting." Instead, name the source and map it to the body:

- **Name the source:** "warm gold-amber dawn light from the eastern horizon," "cool blue-grey pre-dawn ambient from the western shadow side," "faint uplight bouncing from the cracked fountain basin below."
- **Map warm/cool to body parts:** describe which side of the face, which limbs, which surfaces receive warm light vs cool ambient. "The building dawn light wraps across her chest and thighs. Cool pre-dawn shadow fills the back of her shoulders and arms."
- **State what is absent:** "There is no clean studio light on her face. Every photon hitting her has a clear source visible in the frame."

Motivated lighting is the single biggest realism gate. The moment you add an unexplained light source — a convenient fill, a soft box that doesn't exist in the scene — the image reads as rendered, not photographed. When a prompt fails the "where is this light coming from?" test, the generation will look like AI.

For BTS footage: motivated lighting is even more critical. The only sources are practicals (overhead fluorescents, phone screens, monitor glow, LED accent strips on set equipment). No theatrical hard light, no atmospheric haze — just honest, flat, production-grade working light.

---

## THE DETAILS LAW

The core principle of Seedance prompting: **details intensify emotion; laziness kills the prompt.**

Every shot needs three concrete elements:
1. One **environmental pressure** (cold light, steam, wet surfaces, flickering fixtures)
2. One **physical micro-action** (jaw locks, finger taps, knuckles whiten, lips press)
3. One **sound anchor or visual motif** (stomach growl timing, reflections, repeated visual element)

### Forces Not Appearances

Describe the physics acting on objects, not the visual result. Seedance's motion model activates on force descriptions — appearance descriptions produce plastic, weightless motion.

| Weak (appearance) | Strong (forces) |
|---|---|
| `"hair moves"` | `"wind catches loose strands, pulling them across her face"` |
| `"car turns"` | `"tires smoke as the car drifts 90 degrees, rubber scraping asphalt"` |
| `"glass breaks"` | `"fist drives through glass, shards spray outward with the force of impact"` |
| `"walks forward"` | `"each step lands heel-first, weight rolling forward, coat fabric swaying behind"` |

### Camera-Subject Motion Separation

The #1 Seedance prompting mistake is mixing camera motion and subject motion in the same sentence. Always describe them separately:

- **Wrong:** `"The dancer spins as the camera tracks around her"`
- **Right:** `"The dancer spins slowly, arms rising. Camera holds fixed framing."`

Seedance interprets mixed motion instructions as a single chaotic movement — shaky, uncontrollable. Separate the two layers and let each resolve independently.

### Lighting as Biggest Quality Lever

Among all prompt elements, **lighting descriptions have the biggest impact on Seedance output quality** (Seedance official prompt guide). If you can add only one element to improve a weak prompt, add motivated lighting. Name the source, state its color temperature, map it to the body, state what is absent.

These are the same three elements as the Three-Detail Audit in `reference/kling-reference.md` → Dramaturgical Framework and the scene formula in `reference/video-dramaturgy.md` §1. The audit is the enforcement mechanism; this is the Seedance-native formulation.

**Never use:** "cinematic," "professional," "beautiful lighting," "epic," "amazing," or bare emotion labels ("he is sad"). Translate every emotion into a physical, filmable detail.

---

## IDENTITY vs. STYLING — LAYER SEPARATION

Separate identity from styling at the system level. They are different layers and must never live in the same prompt block.

- **Identity** = locked canonical reference sheets (front, three-quarter, profile, full-body plates). Defines face, bone structure, body, skin tone, identity markers. Hair *color* stays locked per member.
- **Styling** = wardrobe description. Outfit, hairstyle, makeup, accessories — swaps freely per scene.

They merge at generation time, not at writing time.

### Practical Workflow

- **Identity** = the character's OpenArt element, referenced by `@ElementName`. Locks face, bone structure, body, skin tone, hair color. These NEVER change between shots.
- **Styling** = the wardrobe-state OpenArt element, referenced by `@ElementName`. New outfit carried by its own element with the same face/identity. Swaps per scene.

At generation time: the character element locks the person, the wardrobe-state element locks the look. Reference both by name in the prompt body — the elements carry identity, so no Identity Block text is pasted into the prompt.

When the character's wardrobe does NOT change from their base element, there is no separate wardrobe element — the base character element carries the look.

---

## CHARACTER LOCKING — `@ElementName` Syntax

Seedance locks character identity through OpenArt **elements referenced by name** — exactly like Kling. The element carries the visual DNA; no Identity Block text is pasted into the prompt.

### Inline Usage

```
[Subject]: @ElementName — {per-shot motion/state only}
```

Reference the element by `@ElementName` (PascalCase, no spaces; space-after before text or a possessive, e.g. `@Pip 's face`, `@Otto reaches`). The element resolves to the locked identity — describe only the per-shot motion/state after the dash, never the appearance.

### Rules

- Reference each character by its `@ElementName` element — the element carries identity, so **no Identity Block** is pasted into the prompt body
- The single uploaded image is the storyboard **start frame**, referenced as `@image1`. Reserve `@image1` for the start frame only; end the prompt body with `Use @image1 as start frame.`
- For multiple subjects: give each its own `@ElementName` and its own `[Subject]:` line. State each subject's per-shot state inline
- No nudity, no glasses (unless in the element's reference images)

### Identity Block Format (element authoring only)

The Identity Block lives in the character element file (`storyboard/characters/{name}.md`) and is used to **author the OpenArt element and its reference images** (and for NanoBanana character-design prompts). It is NOT pasted into Seedance prompt bodies — the element carries it. It contains:

```
Face: [shape, skin tone, eye color, brow shape, nose, lip shape, jaw, scars/marks]
Hair: [color, texture, length, style]
Build: [height, body type]
Wardrobe: [every visible garment — see Wardrobe Description Depth below]
Distinctive: [2-3 features that make this character recognizable]
```

### Wardrobe Description Depth

"Material and condition" is the minimum. Production-grade wardrobe descriptions go deeper — each garment described at the level of: **garment type → fit → fabric/material → print technique and content (if any) → ink/print condition → construction detail → hem/neckline position → how light interacts with the surface.**

- **Sparse (too little):** "black graphic tee, denim shorts, boots"
- **Minimum:** "black fitted cropped tee in cotton jersey, dark wash raw-frayed denim micro shorts, black knee-high pointed-toe leather boots with stiletto heel"
- **Production-grade:** "black short-sleeve fitted cropped tee in cotton jersey with a tour-poster-style graphic printed across the chest in faded distressed white ink showing a stylized halftone close-up portrait in high-contrast black-and-white photographic treatment with motion blur texture, layered behind decorative non-readable stylized typography, faux barcode strip at the bottom, ink showing real wear, fade, and cracked-print texture, hem cropped at the navel exposing midriff"

The production-grade level is required for hero shots and prose mode prompts. The minimum level is acceptable for standard storyboard images and compact templates. All printed graphics should be described as non-readable or unidentifiable to avoid text rendering artifacts and copyright issues.

---

## MULTI-SUBJECT ELEMENT WORKFLOW

Seedance 2.0 references characters, environments, props, and creatures as OpenArt **elements by name** — exactly like Kling. There is no slot budget: every identity-critical subject (each character, each hero prop, the environment) gets its own `@ElementName`, referenced inline in the prompt body. The single uploaded image is reserved for the storyboard **start frame** (`@image1`).

### Subject Assignment

Give each subject its own element. There is no fixed slot order — name each element where it appears in the prompt body.

| Subject | How to Reference | Element Source |
|------|------|---------------|
| Primary character identity | `@ElementName` in a `[Subject]:` line | Character element (OpenArt) from the character file |
| Environment / location | `@ElementName` in the `[World Plate]` block | Environment element from `storyboard/environments/` |
| Wardrobe-state OR secondary character | `@ElementName` in its own `[Subject]:` line | Wardrobe-state element OR a second character's element |
| Additional characters, hero props, creatures | `@ElementName` where each appears | Each subject's own canonical element (see Canonical Element Rule) |

Reference every named subject by its own element; the start frame is `@image1` and is never used to carry identity.

### When to Use Each Combination

| Combination | When |
|---|---|
| One character element | Single character, environment described in text only |
| Character element + environment element | Character in a pre-generated environment — environment lighting must transfer to character |
| Character element + wardrobe-state element | Character with wardrobe change from base identity |
| Character + environment + wardrobe-state elements | Character in environment with wardrobe change |
| Multiple character elements + environment element | Ensemble scenes — give each character its own element |
| Characters + environment + prop/creature elements | A hero prop or creature gets its own canonical element alongside the characters and the environment |

### Lighting-Transfer Note

When a character and an environment element appear together, the character must be **lit by the environment's actual light sources**. Name those sources and map them to the character's body in the `[Camera Capture]`/lighting block (Cardinal Rule 4). State explicitly: "not by clean studio light." This is the same lighting-transfer discipline that previously lived in the TASK role declaration — it now lives in the prompt body's lighting block, since identity comes from the elements.

### Elements vs Start Frame

Identity and world are carried by named OpenArt elements (`@ElementName`), exactly as in Kling. The single image is the storyboard start frame, referenced as `@image1` and declared at the end of the body with `Use @image1 as start frame.` Do not upload reference sheets to carry identity — the elements do that.

---

## ENVIRONMENT REFERENCE — `@ElementName`

Reference the environment as its OpenArt element `@ElementName` in the `[World Plate]` block. The element locks the setting's architecture, lighting, atmosphere, and color palette.

### Environment Element

The environment element is authored during storyboarding (Step 2b) and saved to `storyboard/environments/{world-name}.md`, carrying the locked location identity and its reference images. Reference it by name in the prompt body — no per-shot upload.

### Zero-Character Guard (element authoring)

When authoring the environment element's reference images, they must contain no people. End every environment reference prompt with: `IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame. The space feels inhabited but empty.`

### Motivated Lighting Transfer

The environment element's lighting becomes the shot's lighting. The character must be lit by those sources — name them and map them to the character's body in the prompt (Cardinal Rule 4). State explicitly: "not by clean studio light."

### Canonical Element Rule (anti-drift)

Every named subject that appears in the scene gets its own canonical `@ElementName` — **even when that subject is also visible inside the start frame.** The start frame (`@image1`) carries the *composition* (where things sit, the opening pose); the canonical element carries *identity* (face, body, livery, markings, silhouette). Never let the start frame stand in for a canonical element: a character visible in the start frame still gets their `@ElementName` and their own `[Subject]:` line; a hero vehicle or prop visible in the start frame still gets its own element. `[Subject]:` lines anchor to the character/prop elements; the `[World Plate]` block anchors to the environment element. This is the rule that prevents identity drift between the start frame and the rendered output.

Give every named subject + the environment its own element — only drop a subject to markers-only description when no element exists for it (see Group Scenes).

---

## PROP AND CREATURE REFERENCES

Hero props and creatures that appear across multiple shots get their own OpenArt elements, authored from multi-angle reference sheets — same format as character sheets but on clean mid-grey seamless studio backgrounds (mid-grey gives the model a neutral value to render skin, scales, fur, and reflective surfaces against, and keeps the reference library visually consistent).

Reference each by its `@ElementName` where it appears in the prompt body. The element anchors visual consistency; the per-shot text describes only its motion/state.

### Prop Reference Sheet Prompt Structure

    A photorealistic multi-angle product reference sheet of [prop], displayed as
    [N] panels against a clean mid-grey seamless backdrop: [panel layout with angles].
    The [prop] is identical in every panel — same dimensions, same surface detail.
    [Full material description]. Soft even studio product-render lighting, consistent
    across all panels. IMPORTANT: No humans, no hands. Product render only.

### Creature Reference Sheet Prompt Structure

    A photorealistic multi-angle creature reference sheet of [creature], displayed
    as six panels against a clean mid-grey seamless studio backdrop: [panel layout with
    angles and poses]. The creature is identical in every panel — same anatomy, same
    surface detail, same coloration. [Full anatomical and material description]. Soft
    even studio lighting, consistent across all panels.

---

## NO REAL BRAND NAMES

Branded items pull AI artifacts. "Tan Timberland-style work boots" works. "Timberlands" does not. Any printed label on any product — describe as blank, unprinted, or skip entirely. The realism gate breaks the second readable text shows up on a product. This also avoids copyright issues.

---

## PROMPT ANATOMY

Use this anatomy for single-shot, composition-focused generations (one camera setup, one action). For dramatic multi-shot sequences with character locking and editing rhythm, use the 11-Block Production Skeleton below instead.

The project's aspect ratio determines framing language and lens choice. **Confirm aspect ratio before writing prompts** (see `animation-prompts.md` → Resolution and Aspect Ratio Confirmation Gate).

### 9:16 Vertical Anatomy (default for short-form)

Composition is stacked (top-to-bottom), not lateral. The tall frame favors close-ups, medium shots, and vertical depth — use height, layers, and overhead/low-angle perspectives to fill the frame.

1. **Shot declaration** — "A vertical 9:16 photograph, the kind of frame a DP would grab shooting a music video on a phone-rigged Steadicam — a single moment held in a frozen frame."
2. **Camera position & angle** — specific height, distance, angle (dutch tilt in degrees, low-angle, overhead), lens focal length. Vertical favors low-angle (subject towers in frame) and overhead/bird's-eye. For static shots, set `--camerafixed true` in CLI parameters (see CLI Parameters section below); for moving camera, set `--camerafixed false`.
3. **Character description by visual markers** — hair color/style, wardrobe with material + condition, jewelry, skin details, body pose, expression. Never names.
4. **Lighting — fully motivated by environment (Cardinal Rule 4)** — name every source visible in frame. Map each source to the body parts it hits and state its color temperature. Describe the warm/cool split across the subject's form. Explicitly state "no clean studio light" when appropriate. See Cardinal Rule 4 above for the full technique.
5. **Atmosphere & volumetric depth** — volumetric haze, ground fog, ash, dust particulate, mist. Describe density, movement direction, which light sources they catch. **Always include atmospheric separation between depth planes** — haze thickening between subject and background, particulate catching light shafts, contrast falloff with distance. This is the single biggest factor in eliminating the "flat air" AI look. In 9:16, atmosphere stacks above and below subject — ground fog pooling low, haze thickening overhead.
6. **Environment detail** — specific materials (concrete-and-glass curtain walls, water staining, grime), background elements at described distances with scale cues. In 9:16, environment stacks above and below the subject — sky/ceiling above, ground/floor below.
7. **Camera/lens spec block** — Prefer behavioral descriptions over brand names: "wide-latitude cinema capture with [spherical prime, focal length feel] at wide aperture, [diffusion behavior], [film look], [color behavior], spherical bokeh, natural falloff toward frame edges, 9:16 vertical aspect ratio." No anamorphic — use spherical primes for vertical. See `animation-prompts.md` → Camera Rig Definitions → Behavioral Camera Language Reference for the brand-to-behavior mapping. (Seedance renders anamorphic cues as visual artifacts rather than clean horizontal streaks; the oval bokeh and flare effects that work in NanoBanana/Kling don't translate.)
8. **Hyperrealistic photography block** — use the canonical block from `reference/nanobanana-artistry.md` → Hyperrealistic Photography Block, customized for this shot. Every material described with real physical properties.
9. **Film reference** — "Reference grade similar to [2-3 films]. Lived-in, not pristine. Photographic, not rendered."

### 16:9 Horizontal Anatomy (for widescreen / cinematic projects)

Composition is lateral (left-to-right). The wide frame favors group shots, environmental context, tracking shots, and anamorphic lens character. Use width, horizontal depth, and lateral movement to fill the frame.

1. **Shot declaration** — "A cinematic anamorphic photograph, 16:9 widescreen aspect ratio, the kind of frame a director of photography would shoot for a music video sequence — a single moment held in a frozen frame." For 2.39:1 ultra-wide: state the ratio explicitly.
2. **Camera position & angle** — specific height, distance, angle (dutch tilt in degrees if used), lens focal length from the anamorphic family. 16:9 favors chest-height, eye-level, and slightly low-angle. Dutch tilts work well in widescreen — state the angle in degrees.
3. **Character description by visual markers** — same rules as 9:16. Hair color/style, wardrobe with material + condition, body pose, expression. Never names. For group shots: describe characters by position in frame (left-to-right reading order), not by depth stacking.
4. **Lighting — fully motivated by environment (Cardinal Rule 4)** — same as 9:16. Name every source, map to body parts, state warm/cool split.
5. **Atmosphere & volumetric depth** — same principles as 9:16. Volumetric haze, ground fog, particulate. **Always include atmospheric separation between depth planes.** In 16:9, atmospheric depth reads horizontally — haze building between subject and background across the width of frame, contrast loss in deep background, particulate catching light across the lateral spread.
6. **Environment detail** — same principles, but 16:9 environment fills the frame laterally. Background elements described at distances with scale cues. Architecture and landscape frame the subject from both sides.
7. **Camera/lens spec block** — Prefer behavioral descriptions: "wide-latitude cinema capture with vintage [focal length] 2x anamorphic character at T[stop], [diffusion behavior], [film look], [color behavior], anamorphic horizontal streak flares, oval bokeh, organic anamorphic falloff toward frame edges, 16:9 cinematic anamorphic aspect ratio." See `animation-prompts.md` → Camera Rig Definitions → Behavioral Camera Language Reference for the brand-to-behavior mapping. Anamorphic behavior is the native language of widescreen — oval bokeh, horizontal streak flares, and widescreen compression are all positive signals.
8. **Hyperrealistic photography block** — same as 9:16. Use the canonical block from `reference/nanobanana-artistry.md` → Hyperrealistic Photography Block.
9. **Film reference** — same as 9:16. "Reference grade similar to [2-3 films]. Lived-in, not pristine. Photographic, not rendered."

### Format Selection Summary

| Aspect | 9:16 Vertical | 16:9 Horizontal |
|---|---|---|
| Primary use | Short-form (Shorts, Reels, TikTok) | Cinematic (music videos, short films, trailers) |
| Lens family | Spherical primes | Anamorphic primes (2x squeeze) |
| Composition | Top-to-bottom stacking, vertical depth | Left-to-right lateral, horizontal depth |
| Group shots | Staggered depth, 2 side-by-side max | Left-to-right reading order, 4+ side-by-side |
| Strong camera moves | Tilt, crane, low-angle push, dolly in | Pan, tracking, dolly, dutch tilt |
| Weak camera moves | Pan, tracking (narrow width limits them) | Tilt (limited vertical space) |
| Bokeh | Spherical circular | Oval anamorphic |
| Flares | Minimal (spherical) | Horizontal streak flares (anamorphic) |

### Technical Layer Separation

Encode camera rig, lens family, movement style, film stock, and color grade once per project or world in the style file's Camera Rig Definitions (see `animation-prompts.md` → Style File template → Camera Rig Definitions). Don't rewrite the full spec into every prompt by hand. Describe only the energy and action per-prompt. The model gets a complete cinematography setup instead of a vibe.

---

## ANTI-MUSH GUARD

Deploy at the **top of the prompt** when multi-shot sequences collapse into continuous takes or character drift:

```
Important direction:
This must be a clearly edited multi-shot sequence with visible cuts between shots.
Do not generate a single continuous take. Each shot must have a different camera angle
and different framing. Use rapid montage pacing with rhythmic escalation. Keep the same
character appearance throughout. Preserve the same clothing, face, body type, facial
hair, and hairstyle in every shot. The tone is [genre/mood].
```

This is the highest-leverage paragraph in any Seedance prompt.

---

## MULTI-SHOT SYNTAX

Seedance reads explicit cut markers and generates distinct shots with visible cuts.

### Supported Cut Markers

- `Shot 1. [description]`
- `Cut to. [description]`
- `Camera cut to. [description]`
- `Camera switching. [description]`
- `Lens switch to. [description]`

### Inline Timeline

```
[Shot A] -> Cut to -> [Shot B] -> Camera cut to -> [Shot C]
```

### Shot Budget

- 2-3 shots per 5-second clip for tight cinematic montage
- 4-5 short beats only when physically distinct
- 6+ shots per 5s = incoherent motion, avoid

**Clips longer than 5s:**
- **6–8s:** Acceptable for single continuous actions (one character, one motion arc). Scale shot budget to 3–5 shots.
- **9–12s:** Quality degrades — prefer splitting into stitched clips with matched END STATE → start-state anchors.
- **15s+:** Must be split into stitched 3×5s clips. Never generate as a single clip.

---

## 5-SECOND SHOT RHYTHM TEMPLATE

Uses the same Five-Second Rhythm Scaffold from `kling-reference.md` → Dramaturgical Framework, adapted for both aspect ratios:

| Timecode | Function | 9:16 Vertical | 16:9 Horizontal |
|---|---|---|---|
| 0.0–0.8s | Establish | Low-angle or overhead to fill vertical frame. Close-up or insert anchoring emotion. | Wide establishing or medium shot. Environment context fills the width. |
| 0.8–1.6s | Action | Subject fills center of tall frame. Medium-close shot, hero moves or reacts. | Subject enters or moves laterally. Tracking or pan follows action across the width. |
| 1.6–2.5s | Turn | Vertical reveals work best (tilt, rack focus). New framing reveals shift. | Hard cut to new angle. Dutch tilt, reverse, or lateral reveal. Anamorphic flare on cut. |
| 2.5–3.6s | Reaction | Face fills upper third. Tight close-up, slow push-in, emotion on body. | MCU or CU. Shallow anamorphic DoF isolates face from wide background. Oval bokeh. |
| 3.6–5.0s | Climax/Hero | Subject towers in frame. Low angle, slow-mo if earned, final image. | Wide hero frame. Subject commands the width. Low angle or crane. Horizontal streak flare. |

For 10s: double the structure or insert pause before climax. For 15s+: split into 3×5s clips and stitch in editor. See `kling-reference.md` → Dramaturgical Framework → Rhythm Ladder for pacing variants (slow-burn, anxiety build, impact scene).

---

## FRAME MAP, SUBJECT LOCK & CROSS-FRAME RULES

Three structural tools for multi-shot, multi-character sequences. They are the single biggest lever on multi-character consistency — more than any identity block alone. Use all three for any sequence with 2+ characters across 2+ shots. (The per-shot Seedance template in `animation-prompts.md` already carries `[Frame Map]`, `[Subject Lock]`, and `[Cross-Frame Rules]` blocks — this section is the reference behind them.)

### 1. Frame Map — Position Before Identity

Open the prompt by anchoring every subject to **screen position, depth layer, contact points, and gaze** — *before* any identity is described. Lock the frame first and the model can't drift a character to the wrong side of frame or the wrong depth plane, because the spatial layout is already pinned when identity arrives.

For multi-shot sequences, write a Frame Map line per shot:

```
Frame Map: Shot 1 — exterior wide, the car anchored midground-left at a three-quarter angle, two faint silhouettes inside, heavy rain on every surface. Shot 2 — interior medium close-up, the espresso-brown-hair woman in the passenger seat leaning into the visor mirror upper-left of frame, the ponytail woman off-frame screen-left. Shot 3 — tight close-up on the ponytail woman in the driver's seat, her right hand reaching screen-right toward the off-frame passenger.
```

Each subject gets: which shot, where in frame (screen-left/center/right, foreground/midground/background), contact points (what touches what), and gaze direction. No identity description here — only position, depth, contact, gaze.

### 2. Subject Lock — One Block Per Character

After the Frame Map, give each `@ElementName`-referenced subject a dedicated **Subject Lock** block. It pins the per-shot **state** (pose, gaze, contact, wardrobe state) and closes with an explicit hold:

```
Subject Lock — @EspressoWoman: leaned forward into the visor mirror, gloss wand raised mid-application in her right hand, amber raincoat across her shoulders. @EspressoWoman keeps the same face, hair, identity markers, wardrobe, jewelry, and silhouette throughout.
```

The Subject Lock does **not** re-describe the element — identity is anchored to the `@ElementName` element. The Subject Lock only describes what changes shot to shot (pose, state) plus the closing hold line. One block per `@ElementName` subject. (For a single-shot prompt, the compact `[Subject]: @ElementName — {motion}` line carries this; the Subject Lock block is the multi-shot expansion.)

### 3. Cross-Frame Rules — The Consistency Contract

A dedicated block stating what holds **identical across shots** — the contract the model must not break between cuts. This is the missing piece most multi-shot drift comes from: each shot is internally fine but the wardrobe state, lighting state, or who-is-where shifts at the cut.

State explicitly, per element that persists:

```
Cross-Frame Rules: The ponytail woman holds in the driver's seat across Shots 2–5, bare-shouldered jacket-removed state identical throughout. The espresso-brown-hair woman holds in the passenger seat across Shots 2–5, amber raincoat state identical. The cabin interior, dome-light state, and skyline bokeh hold identical across Shots 2–5. Time of day, weather, and atmospheric register stay locked across the full sequence. The windshield holds heavy rain accumulation across Shots 1–4; ONLY in Shot 5 do the wipers execute one clean sweep.
```

Cover: which character holds which position/wardrobe state across which shots; environment/lighting state that persists; time of day / weather / atmosphere lock; and any single deliberate change (state it as the explicit exception, e.g. "ONLY in Shot 5…"). The exceptions are as important as the holds — naming them prevents the model from applying the change to every shot.

---

## 11-BLOCK PRODUCTION SKELETON

For dramatic, multi-shot, character-locked sequences — use this when the piece has editing rhythm, multiple camera setups, and character identity that must hold across cuts. The Prompt Anatomy above is for single-shot work; this skeleton is for multi-shot production.

1. **Character Lock** — reference each character by its `@ElementName` element (no identity block in the body). **For 2+ character sequences:** open with a **Frame Map** (anchor each subject to screen position, depth, contact, and gaze *before* identity) and give each `@ElementName` subject a **Subject Lock** block (per-shot state + a "keeps the same … throughout" hold line). See Frame Map, Subject Lock & Cross-Frame Rules above
2. **Length + Genre + Editing Intent** — duration, genre, pacing (fast/slow/staircase)
3. **Story** — one paragraph, concrete physical events in present tense, name the break point
4. **Visual Style** — palette, contrast, grain, color temperature, texture cues. State what to avoid
5. **Camera Style** — camera body/look. Assign lens character with purpose (wide for silhouettes, tight for emotion, macro for inserts). Handheld micro-shake or static
6. **Editing Style** — hard cuts vs match cuts. Rhythmic escalation: long → shorter → shorter → pause → impact
7. **Audio** — diegetic sounds in order: ambient, micro-actions, impact, silence moment, final cue. No dialogue/subtitles
8. **Shot-by-Shot Timeline** — each shot: timecode, framing, lens character, camera move, action, environment detail, body-based emotion
8b. **Cross-Frame Rules** (multi-shot) — the consistency contract: state what holds identical across shots (which character holds which position and wardrobe state across which shots, persistent environment/lighting state, time-of-day/weather/atmosphere lock) and name any single deliberate change as an explicit exception ("ONLY in Shot N…"). See Frame Map, Subject Lock & Cross-Frame Rules above
9. **Lighting** — main source, fill, rim. Direction, color temperature, psychological carry
10. **Composition** — subject placement, negative space, reflections, silhouettes. Name the final image. For 9:16: apply vertical composition strategies from `reference/cinematography.md` → 9:16 Vertical Format (depth layering, vertical rule of thirds, center-frame, vertical negative space). For 16:9: apply horizontal strategies (lateral spacing, left-to-right reading, anamorphic width, horizontal negative space). Include positive-framed quality guards
11. **Output Specs** — duration, aspect ratio (9:16 or 16:9 — as confirmed at project start), realism level, CLI parameters

---

## THREE-SECTION NARRATIVE FORMAT (16:9 long-form alternative)

An alternative to the 11-Block Skeleton for **16:9 cinematic long-form** work — short films, music videos, narrative sequences. Use when the prompt should read as a flowing sequence brief rather than a structured shot card. Better suited for multi-shot sequences where the editing rhythm emerges from the prose rather than from explicit timecoded shot lists.

**When to use this vs the 11-Block:**

| Scenario | Format |
|---|---|
| Short-form (15–90s), tight editorial control, shot-level timing matters | 11-Block Production Skeleton |
| Long-form (2+ min), narrative-driven, 4+ shots flowing as a scene | Three-Section Narrative Format |
| Complex character locking across rapid montage | 11-Block (explicit character lock block) |
| Multi-character dialogue scenes with naturalistic rhythm | Three-Section (Dynamic Description handles flow) |

### Structure

Three labeled sections, each a dense paragraph. Labels inline in the prompt body.

**Style & Mood:** Genre, aesthetic, lighting philosophy, color grade, camera body and lens, film grain, tonal register (the emotional vocabulary of the piece — e.g., "grounded summer-blockbuster action film"), emotional register (the characters' baseline — e.g., "flat and dry, completely unbothered"). Sound philosophy: diegetic only, or score-driven.

**Dynamic Description:** What moves — camera behavior, action, transitions, cuts. Write the multi-shot sequence as continuous prose with natural transition language: "cuts to," "hard cut to," "pushes into," "whip pans to." Each shot within the sequence gets its own sentence or clause specifying framing (handheld wide, stabilized tracking, tight close-up), camera behavior (frame lurching, drifting, holding steady), and the action within it. Describe shots in sequence order. Let the editing rhythm emerge from sentence length and cut frequency — short sentences for rapid cuts, longer sentences for held shots.

**Static Description:** What's locked — every subject described by visual markers only (never names), full wardrobe with material specificity, setting with architectural detail and material textures, props, creature designs, sound design. This section restates the world from scratch — Seedance has no memory between generations. Every element that appears in the Dynamic Description must be fully described here. For 2+ character sequences, embed Frame Map positioning (screen position, depth, contact, gaze per subject) and a Cross-Frame Rules consistency contract stating what holds identical across shots — see Frame Map, Subject Lock & Cross-Frame Rules above.

### Rules

- Labels inline, one paragraph per section
- English only
- No `@image` tags in the prompt text — image references go in the Seedance UI
- Characters described by visual markers: "the girl in the bumblebee yellow suit with rose-pink braids," not "Sol"
- Every prompt is self-contained — restate wardrobe, setting, creature design in full
- Sound cues go at the end of Static Description as a "Sound:" line — diegetic only
- Camera/lens spec lives in Style & Mood, not repeated per shot
- The Dynamic Description is the beating heart — it carries the editing rhythm, the camera energy, and the emotional escalation. Write it like a shot list in prose form

### Multi-Reference with Three-Section Format

When using the Three-Section Narrative Format with multiple reference images:

- Reference characters/worlds by their OpenArt `@ElementName` elements (like Kling); the single uploaded image is the start frame, `@image1`
- Each subject's per-shot state is stated where its element appears — no TASK role declaration block
- Characters are described by per-shot state in the Static Description; the `@ElementName` element carries their locked identity
- The Static Description must restate the full visual world from scratch — Seedance has no memory between generations
- Every material, every garment, every architectural surface must be described even if visible in the reference images — the text instructs, the image anchors

### Example skeleton

```
Style & Mood: multi-shot action sequence, cinematic handheld energy, photorealistic
live-action, wide-latitude cinema capture with vintage 2x anamorphic character, fine 35mm
film grain, crushed blacks, desaturated midtones, warm dusty daylight with long shadows, no music, diegetic sound only —
dialogue and sound effects, the tonal register of a grounded summer-blockbuster action film,
the emotional register [character's baseline].

Dynamic Description: Shot 1 opens on [framing, camera behavior] — [action]. Cuts to Shot 2,
[framing, camera behavior] — [action, character emotion through physical detail]. Cuts to
Shot 3, [framing] — [environment reaction or escalation]. Cuts to Shot 4, [framing] —
[dialogue delivered with specific physical delivery, never at the camera].

Static Description: The subject is [full visual description by markers — age, build, beauty
standard, skin, features, hair color/style/length, distinctive props]. She wears [full
wardrobe with material specificity per the Wardrobe Description Depth rules above]. The
setting is [location with architectural materials, time of day, atmospheric conditions,
ground surface, background elements with no readable signage]. [Creature/prop descriptions
if applicable — full anatomy, coloration, scale, material detail]. Sound: [diegetic sounds
in sequence order — impacts, mechanical, environmental, voice delivery quality].
```

---

## MOVEMENT LAYERS — NAME ALL FOUR

The `[Movement]` block describes motion across the runtime in flowing prose, but four distinct layers must each appear — never tangle them into one blur. Write them in this order:

1. **Character motion** — what the subjects physically do across the runtime, with per-beat timestamps on multi-beat shots ("takes one slow step across the first two seconds, then holds").
2. **Micro-motion** — what moves on the body while the dominant action plays (breath, hair drift, fabric rustle, jewelry sway). This is what keeps a "held" shot alive instead of frozen.
3. **Environmental motion** — what the world does around the subjects (rain, smoke, dust, traffic, wind, particulate, steam).
4. **Camera motion** — usually carried by `[Camera Capture]`; include here only if not stated there.

**Saying nothing moves is a directive, not an omission.** When a layer is static, state it ("boots stay planted, only breath and hair move," "nothing else moves in the frame"). Absence stated holds; absence implied drifts. This complements the Camera-Subject Motion Separation rule (Details Law) — that rule keeps camera and subject from blurring into one chaotic move; the four layers make sure every moving thing is accounted for.

---

## CAMERA MOVEMENTS

Aspect ratio reweights the movement palette. 9:16 favors vertical moves; 16:9 favors horizontal moves.

| Movement | Effect | 9:16 Strength | 16:9 Strength |
|---|---|---|---|
| Tilt Up/Down | Vertical reveal | **Strong** | Moderate |
| Crane/Aerial | Overhead or rising | **Strong** | **Strong** |
| Dolly In | Pushes into subject, builds tension | **Strong** | **Strong** |
| Dolly Out | Reveals context, pulling away | Good | **Strong** |
| Low-angle Push | Subject towers/commands frame | **Strong** | **Strong** |
| Handheld | Documentary, intimate | Good | Good |
| Zoom In/Out | Tension or detail | Good | Good |
| Tracking | Follows moving subject | Moderate | **Strong** |
| Pan Left/Right | Horizontal reveal | Weak | **Strong** |
| Dutch Tilt | Asymmetric tension | Good | **Strong** |
| Hitchcock Zoom | Dolly out + zoom in (vertigo effect) | Moderate | Good |
| Static | Via `--camerafixed true` | Good | Good |

Combine sparingly — multiple moves in 5s rarely resolve cleanly.

---

## GROUP SCENES

Four+ characters on screen, each referenced by its own `@ElementName` element (the element name is PascalCase, but no character *name* appears in the prose description). Give each identity-critical character its own element and its own `[Subject]:` line. Only describe a character by visual markers alone (hair color + wardrobe + identity markers) when no element exists for it — characters without an element drift more across generations, so author elements for the characters who carry the scene; prioritize by screen time and how identity-critical each one is.

### Count Guard

State the exact number of characters AND explicitly negate extras: "Exactly four women, exactly four figures no fifth no sixth." Without this, the model may add phantom characters. Repeat the count after the group description as reinforcement.

### Group Expression Register

Before individual descriptions, name the group's shared expression register: "all four expressions cool and composed in predatory empress register with eyes lifted slightly upward." This anchors the emotional baseline; individual descriptions then add variation on top.

### Arrangement by Aspect Ratio

**9:16 vertical:** group arrangement is **staggered depth or top-to-bottom**, not left-to-right. Describe character positions by depth and vertical placement: "foreground center," "behind her left shoulder," "visible in the deep background above." Use depth stacking — one character close, others receding — to exploit the tall frame. Two characters can read side-by-side only in tight framing; three or more need depth layering.

**16:9 horizontal:** group arrangement is **left-to-right reading order** with depth variation. Describe character positions by horizontal placement: "the jet-black-haired figure on the left," "the silver-white-platinum-bob figure to her right," "the crimson-red-haired figure in center-right," "the rose-pink-haired figure on the right." Four+ characters can read side-by-side comfortably in 16:9 — lateral spacing is the primary tool. Add slight depth stagger for visual interest but the main axis is horizontal.

### Background / Ensemble Scale Suppression

Background elements must be described with emphatic scale language to prevent them from competing with foreground subjects. Repeat scale cues: "visible only as small distant background elements," "reading as small distant background context only," "dwarfed by the depth of frame." Without this, the model may render background objects at foreground scale.

For ensemble/background performers: describe each in a unique pose, unique wardrobe, unique mask or distinguishing element. "No synchronization, no formation, the ensemble reading as a chaotic intimate crowd of individual movements rather than a structured group."

---

## BTS (BEHIND-THE-SCENES) FOOTAGE

BTS must read as documentary. Off-duty wardrobes, hair down or messy, candid framing, single phone or follow-cam lighting.

- **Candid framing** = describe the camera as if a person is holding it. Slight handheld drift, imperfect focus, framing that almost catches the action but not quite.
- Performance shots = operated by a pro. BTS shots = operated by a friend.
- Audio: no song. Footsteps on concrete, fabric rustle, breath, ambient room tone.
- Different camera setup: lighter rig, shorter prime, wider stop, no diffusion filter, neutral color grade, no film emulation push.
- **BTS crew are characters too** — makeup artists, stage managers, camera operators in BTS shots should be described with the same visual marker technique as main characters: race, hair, wardrobe ("all-black BTS crew uniform — plain unbranded black long-sleeve crew tee and plain unbranded black tactical pants"), tools, accessories, body language. Not just "a crew member."
- **BTS register = level frame** — explicitly state "held LEVEL with no dutch tilt — clean documentary register, no theatrical angles." Performance shots may dutch tilt; BTS never does.

---

## FILTER STACK GUIDANCE

Diffusion filters soften highlights and add halation. They're part of the camera rig definition (see `animation-prompts.md` → Style File → Camera Rig Definitions). Select by context:

| Context | Filter | Effect |
|---|---|---|
| Performance / narrative (day) | Tiffen Black Pro-Mist 1/4 | Softens highlights, gentle halation around bright sources. Clean enough for faces, soft enough for cinematic mood |
| Performance / narrative (night) | Tiffen Black Pro-Mist 1/4 + Glimmerglass 1/8 stack | Extra halation bloom around practicals and colored lighting. Night sources glow more |
| Dance / high-energy | Tiffen Black Pro-Mist 1/4 | Same as day performance — the filter handles LED floor glow and magenta ambient well |
| BTS / documentary | None | No diffusion filter. Clean, flat, honest. Documentary register |
| Character reference sheets | None | Clean studio. No diffusion, no film character |

State the filter in the camera/lens spec block: "Tiffen Black Pro-Mist 1/4 filter softening highlights with gentle halation around [light source]." For no filter: "no diffusion filter, neutral color grade."

---

## REALISM DETAILS

- **Jumbotron at a concert:** show the artists at a second delay (as at a real venue).
- **Crowd signs:** hand-drawn with "messy hand-drawn black marker letters, imperfect and raw handwriting."
- **Security staff:** "barely visible at the very bottom edge of the frame."
- **Lighting integration:** the character must be lit by the environment's actual lighting, not by clean studio light. State which source casts which color on which part of the body.

---

## QUALITY GUARD DEFAULTS

Seedance 2.0 ignores traditional negative prompts (see NEGATIVE PROMPTS section below). Use positive-framed quality guards instead. Include these by default in every Seedance prompt's quality guard section:

**Skin & Surface guard (include for MCU/CU/ECU with visible skin):**
```
Natural human skin texture with fine, soft, even pore detail and subtle tonal variation. Subsurface scattering at ears, fingertips, and thin skin areas. Fine peach fuzz catching edge light on jaw and hairline. Per-zone specular kill: zero shine on forehead, nose bridge, cheekbones, temples, and chin — the blown hotspot on a nose bridge or cheekbone is the AI-skin tell, so name each zone. Warmth preserved and natural, never washed-out or cool-shifted. No airbrushed, plastic, or unnaturally smooth skin; no porcelain doll or wax figure rendering. Flattering ceiling: the texture stays fine and even, never harsh or clinical — no acne, no blemishes, no enlarged or cratered pores. Realism never makes a face look ugly; resolve any tension toward fine-and-flattering.
```

**Volumetric depth guard (include for all shots):**
```
Atmospheric depth with visible haze between depth planes. Particulate catching light sources. Natural contrast falloff with distance. Air has physical body — not flat or uniform. Background softened by atmospheric perspective.
```

**Identity guard (always include):**
```
Consistent face, hair, wardrobe, and body proportions throughout. Anatomically correct hands with clear finger separation. No morphing features, no shifting jawline, no extra limbs.
```

---

## CAPTURE REALISM BLOCK — THE ANTI-RENDER ENGINE

The three Quality Guard Defaults above (skin, volumetric, identity) consolidate into a single **Capture Realism** block placed immediately before the `[Camera Capture]` line in the per-shot Seedance prompt. `[Camera Capture]` names the *gear behavior*; `[Capture Realism]` names the *physics* — the four mechanics that, in practice, separate footage that looks photographed from footage that looks rendered. Ship it on every prompt unless the user explicitly asks for a glossy/clean/commercial register.

The most common AI-video failure isn't bad framing or wrong lens — it's the over-contrasty, over-plastic look. It comes from three model defaults: flat single-plane staging (no air between planes), glossy/specular moisture and skin, and contrast over-rendered into clipped highlights and crushed blacks. The four mechanics attack all three at the source.

**1. Depth via suspended atmosphere between planes** (default-on wherever the shot has planes to separate). State that haze/air density is *suspended between camera, subject, and background* so distant planes render softer, desaturated, lower-contrast — the subject sits *inside* the depth rather than pasted on a flat plane. Scale density to the scene (thin interior / light exterior / heavy moody-night). The single biggest lever against the flat plastic look. (Same principle as the Volumetric depth guard above — Capture Realism folds it in.)

**2. Moisture without shine** (only if the scene is wet/humid/sweaty). The default AI failure on any wet scene is glossy beads and specular sheen — an instant CGI tell. State moisture as *present but matte*: damp not beaded, wet but not glossy, surfaces that mute and saturate without a single specular hotspot (damp matte hair, slight skin moisture staying matte, wet ground with muted not-mirror reflection). Delete this mechanic entirely on dry scenes.

**3. Per-zone specular kill + flattering ceiling.** "Matte skin" is too vague to hold — name the zones: zero shine on forehead, nose bridge, cheekbones, temples, chin, collarbones. The blown hotspot on a nose bridge or cheekbone is *the* AI-skin tell; naming each zone kills each hotspot. Pair with biology cues (peach fuzz at jaw and hairline, fine soft pore texture, true subsurface scattering, warmth preserved). Flattering ceiling: texture stays fine and even, never harsh/clinical — no acne, no blemishes, no enlarged pores; realism never makes a face look ugly. Drop the skin sentence entirely on no-human (M5) plates and apply matte-not-glossy to environmental surfaces instead.

**4. Contrast curve stated three ways.** Over-contrast is the headline complaint, so attack it from three angles in the same block: (a) tonal curve — shadows lifted gently holding texture, highlights rolled off softly, nothing clipping to white or crushing to black; (b) specular removal — speculars removed from skin, hair, fabric, and surfaces, every pixel reading matte and diffuse; (c) grade — low-contrast, slightly desaturated, warmth preserved. One statement gets overridden by the model's default contrast bias; three statements hold it.

**Canonical `[Capture Realism]` block (tune every bracket to the scene):**
```
[Capture Realism]: [Foreground subject] sits inside real depth — [thin/light/heavy] atmosphere suspended between camera, subject, and [the far background element], the background rendered softer, desaturated, and lower-contrast than the foreground so the figure sits within the air, not pasted on a flat plane. [IF WET: moisture has settled on every surface — damp matte hair, slight skin moisture holding fully matte with no beading and no sheen, wet ground with muted reflection, moisture that mutes and deepens without a single specular hotspot.] Skin reads true cinematic matte — zero shine on forehead, nose bridge, cheekbones, temples, chin, collarbones, real peach fuzz at jaw and hairline, fine soft even pore texture, light absorbed like true subsurface scattering, warmth preserved and natural, never washed-out or cool-shifted, never plastic, and never harsh — no acne, no blemishes, no enlarged pores, fine flattering texture that keeps the face looking good. Low-contrast curve — shadows lifted gently holding texture, highlights rolled off softly never clipping, nothing crushed to black. All speculars removed from skin, hair, fabric, and surfaces, every pixel reading matte and diffuse. Slightly desaturated grade with warmth preserved.
```

**Tuning:** dry scenes delete the `[IF WET …]` clause; no-human M5 plates drop the skin sentence and apply matte-not-glossy to wet concrete/metal/glass instead; studio/editorial registers where intentional gloss is wanted reduce or skip the block. It does NOT name gear, grade, frame rate, or runtime — that all lives in `[Camera Capture]`. Capture Realism is physics; Camera Capture is hardware behavior.

---

## FLAT 2D STAGING

Seedance handles flat 2D staging better than Kling — Kling tends to add depth and perspective even when told not to. But Seedance still needs the instruction stated explicitly.

When the shot requires a flat, perpendicular-to-camera staging (profile shots, side-scrolling action, theatrical blocking):

```
2D flat staging. Camera perpendicular to action plane. No depth perspective.
No vanishing point. All characters arranged on the same plane parallel to the lens.
```

Reinforce with positive framing: "All action confined to a single plane parallel to the camera. Characters and objects share the same depth plane. Flat perpendicular composition maintained throughout."

---

## IMAGE-TO-VIDEO RULE

When using a reference image, describe **only motion and camera work**, not static elements already visible in the image. Re-describing creates identity drift.

- **Bad:** "A man in red shirt stands in kitchen. He walks to the fridge."
- **Good:** "He slowly walks toward the fridge, opens it with hesitation, freezes when seeing empty shelves. Tracking shot from behind."

---

## NEGATIVE PROMPTS

- Seedance 2.0: limited negative support, fragile and often ignored

**Workaround:** Invert to positive phrasing (see NanoBanana Prompting Rules — Positive Framing in `nanobanana-artistry.md`).

---

## CLI PARAMETERS

Append to prompt end:
```
--resolution 720p --aspect 9:16 --duration 5 --camerafixed false --seed 42
```

| Parameter | Values |
|---|---|
| `--resolution` | **720p.** Upscale in post with Topaz Video. Confirmed at project start via Resolution and Aspect Ratio Confirmation Gate (`animation-prompts.md`). |
| `--aspect` | **9:16** (vertical short-form) or **16:9** (horizontal cinematic). Set per project — confirmed at project start via Resolution and Aspect Ratio Confirmation Gate. |
| `--duration` | 2–12 seconds |
| `--camerafixed` | true (locked) or false (movement) |
| `--seed` | reproducibility control |

---

## AUDIO (Seedance 2.0)

Include diegetic sound cues in the prompt body:

```
Audio. fridge hum, distant rain on window, one stomach growl at 2.3 sec, final silence.
```

Dialogue supported but less robust than competing models. Keep lines short.

**Pipeline decision:** The story-saint pipeline routes ALL dialogue and voiceover to ElevenLabs via `elevenlabs.md`, regardless of whether the video shot uses Kling or Seedance. Do not write dialogue text into Seedance `[Audio]` blocks — it creates visual ghosts and artifacts. The `[Audio]` block is for diegetic environmental sound only.

---

## PIPELINE INTEGRATION

### Character Element → Seedance

1. Character element file has an Identity Block (for authoring the OpenArt element) and a Seedance Character Lock section naming the element
2. For Seedance shots, reference the character by its `@ElementName` element — same element as Kling uses
3. The OpenArt element carries identity in both `i2v` and `r2v` modes — no reference-sheet upload, no Identity Block in the prompt body. For `r2v`, the element locks character identity without constraining frame 1 composition
4. Give the character a `[Subject]: @ElementName — {motion/state}` line; do not paste identity text
5. The element carries identity across every clip of a stitched sequence — no repeated identity paste
6. **Transformation states:** if a character has multiple visual states (`{name}.md` + `{name}-{state}.md`), reference the correct state's element by `@ElementName`. Never mix states within one clip
7. **Multi-subject shots:** reference the environment (`@EnvironmentName`) and any wardrobe-state/secondary character by its own `@ElementName`. See Multi-Subject Element Workflow above

### Generation Modes

| Mode | Meaning | When |
|---|---|---|
| `i2v` | Image-to-video — NanoBanana storyboard image as start frame | Default. Frame 1 composition matters. |
| `t2v` | Text-to-video — no start frame | Multi-shot batches where Seedance handles continuity internally |
| `r2v` | Reference-to-video — `@ElementName` element character lock, not a start frame | Character consistency is the priority, but composition is free. Reference the character's OpenArt element by `@ElementName`. |

`r2v` is functionally `@ElementName` element character locking without constraining frame 1 composition. Use when the character must match but the shot composition differs from any existing storyboard image.

### When to Use Seedance vs Kling

| Scenario | Seedance | Kling |
|---|---|---|
| Multi-shot montage with cuts | Preferred — native multi-shot syntax | Works via multi-shot mode |
| Character consistency across shots | `@ElementName` element reference | Element binding with `@element_name` |
| Flat 2D staging | Preferred — respects flat plane better | Fights flat staging, adds unwanted depth |
| Expression control, micro-expressions | Limited | Preferred — fine expression vocabulary |
| Dialogue / lip sync | Supported but fragile | Better with Element binding |
| Diegetic audio | Built-in | Separate |
| I2V from NanoBanana start frame | Supported | Preferred — mature pipeline |
