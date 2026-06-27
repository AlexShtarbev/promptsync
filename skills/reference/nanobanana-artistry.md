# NanoBanana Artistry — Bridging Photorealism and Cinematic Beauty

How to elevate NanoBanana outputs from clean photorealism to artistically rich, emotionally evocative images. Companion to `cinematography.md` (which maps emotion → camera language). This file maps emotion → **color, lighting, film stock, lens character, and quality language**.

Read before generating any NanoBanana prompts — whether storyboard images (the standard pipeline), character reference sheets, or standalone exploration.

---

## NANOBANANA PROMPTING RULES

NanoBanana (both NB2 and Pro) is a thinking model. It interprets creative direction holistically — it responds to descriptive prose, not keyword lists. These rules apply to ALL NanoBanana prompts (character refs, storyboard images, composition frames).

### Labeled Blocks with Descriptive Prose

Write prompts using labeled blocks — `[Subject]`, `[Action]`, `[Environment]`, `[Cinematography]`, `[Lighting/Style]`, `[Technical]` — with descriptive prose inside each block. This is the same structure OpenArt uses when enhancing prompts, and aligns with the Kling prompt format. Each block should read like instructing a human photographer about that specific dimension.

- **Good:**
  ```
  [Subject]: A weary detective in a rumpled navy wool trench coat with visible
  weave and fraying at the cuffs, deep lines under his eyes, unshaven.
  [Environment]: A narrow rain-slicked alley at night, puddles reflecting
  neon signage from the street beyond.
  ```
- **Bad:** "detective, full body, alley, night, rain, navy coat, photorealistic, 8k, masterpiece"

### Lens Behavior, Not Brand Names

NanoBanana ignores raw exposure numbers (ISO 400, 1/250s, shutter speed). It also doesn't render brand names — it pattern-matches a name like "Leica Summilux" to a *vibe* and then approximates it. Describe the optical **behavior** directly and the model renders exactly that, with none of the brand-name noise. Focal length and aperture may stay in for human clarity (they communicate the intended look to the reader), but the signal is always the behavior:

| Weak (brand name or bare number) | Strong (behavior described) |
|---|---|
| `85mm f/1.4 Leica Summilux` | `short-telephoto portrait compression at a wide aperture, subtle glow blooming on highlight edges, creamy circular bokeh, 3D micro-contrast pop` |
| `Zeiss Planar 50mm` | `normal field of view, natural perspective with moderate background softness, smooth tonal transitions` |
| `24mm wide angle` | `wide field of view with slight barrel distortion at the edges` |
| `ISO 400, 1/250s` | `clean image with frozen motion` |

Describe what the glass *does* — compression, bokeh shape, edge falloff, highlight rendering, micro-contrast. The behavior is the signal; brand names and bare numbers are noise. See `animation-prompts.md` → Behavioral Camera Language Reference for the brand→behavior mapping when adapting legacy or external references.

### Positive Framing

Describe what you want, not what to exclude. Inversions work better than negatives.

- **Good:** "cold blue-gray palette with desaturated skin tones"
- **Bad:** "no yellow tones, no warm colors"
- **Good:** "anatomically correct hands with clear finger separation"
- **Bad:** "no distorted hands, no extra fingers"

### Material Specificity

Replace vague descriptors with concrete materials, textures, and conditions:

- **Good:** "heavy charcoal wool overcoat with visible weave, fraying at the cuffs"
- **Bad:** "dark coat"
- **Good:** "ornate silver filigree crown with tarnish in the recesses"
- **Bad:** "metal crown"

Surface properties to specify: matte/glossy/satin finish, rough/smooth/textured, worn/pristine/aged/patinated, translucent/opaque/refractive.

### Edit, Don't Re-Roll

When a generation is 80%+ correct, request specific changes conversationally rather than regenerating from scratch. NanoBanana adjusts lighting, reflections, and physics automatically when editing.

### Cost Optimization

Test variations at low resolution (0.5K), then upscale winners to 2K or 4K. NanoBanana Pro costs ~$0.15/image vs NB2's ~$0.04/image — use NB2 for iteration, Pro for complex multi-layered scenes.

---

## PHOTOGRAPHED, NOT RENDERED — THE COHERENCE MODEL

The "rendered / CG" look is **not a style NanoBanana adds.** It is what fills the gap wherever a prompt is **ambiguous, contradictory, or redundant** — the model's smooth-symmetric prior leaking through where your instruction failed to resolve to one coherent target. Every realism technique below is doing one of two things: **specifying a photographic target** (pushing toward the photo attractor) or **removing instruction-noise** (removing the pull back to the prior). Realism = *strong photographic specification + low instruction-noise.*

This reframes the tells in `ai-slop-ban-list.md` from a symptom list into a single rule with named consequences.

### The load-bearing rules (officially backed)

These two carry most of the realism win and are confirmed by Google's own Nano Banana guidance, not just our testing:

1. **Negatives are weak — specify positively.** Gemini's image model has *no negative-prompt field by design*; its architecture has "no subtractable reverse vector" the way diffusion does. A long negative pile is noise competing with the positive cue. Keep negatives lean (~12–18 focused terms) and carry the look in **positive** description. (Google: *"describe what you want, not what you don't want."*)
2. **Photographic specification is the biggest single lever.** One concrete clause each: a real **film stock** (e.g. Cinestill 800T → cold night cast + halation + grain), a **genre** ("wildlife documentary, National Geographic"), the **capture condition** ("available moonlight only, high-ISO"), and a **per-framing real lens**. Google explicitly endorses film stock / camera body / lens / lighting terminology. This is *active push* toward photography — necessary because the training prior drifts render-ward on its own.

### The reference-complement rule (the subject-phrasing lesson, stated correctly)

When you condition on an `@Element` reference image, **the image is the authority for everything it holds** — face, color, species, wardrobe, shape-identity. Re-describing those in text makes words **compete with the reference**, and that contradiction drags the output toward the CG attractor. Google's own multimodal formula is `[Reference images] + [Relationship instruction] + [New scenario]` — identity from the image; text supplies scenario, *not* a re-description of the subject.

> **Rule: text states only what the reference image *cannot* hold; never what it already holds.**

- **Reference holds (do NOT restate in the prompt body):** colour, species, wardrobe, facial identity. An identity dump like "broad chocolate-brown sea otter, barrel build, cowlick…" piled into `[Subject]` is the redundancy that reads rendered.
- **Reference does NOT hold (you MUST state, positively):** **build/weight** (the model slims regardless — this is why `check-images --clip` exists), **posture**, **held objects**, **concealment**, and the **specific action/moment**. These are exactly the mandatory clauses the physics compiler injects into `[Subject]` — so the compiler is correct; the fix is deleting the *redundant* identity prose around it, and pouring richness into `[Action]` + lighting + film stock instead. Block placement of the build clause is not the lever; **non-contradiction** is.

### Coherence as colour — and a free machine check

A warm/amber cast on a scene whose light is cold (moonlight, overcast, fluorescent) is the **same contradiction bug** as the identity dump, in the colour channel: the grade fights the stated light source, so it reads wrong. Lock **one hue** consistent with the light condition across all shots of a setting, and forbid amber by name on cool scenes.

Because warmth is a *measurable pixel statistic*, this is the one realism tell you can enforce **deterministically and for free** — no model, no Claude. The platform gate compares each render's measured warmth against the shot's declared `color_mood`/time-of-day and flags warm-on-cool drift:

```bash
cd platform && npm run check-images -- --slug <slug> --root <dir> --colortemp   # add to --clip, or run alone
```

It fires only on the contradiction (warm pixels + cool intent) and skips legitimately warm scenes (firelight, sunset declare warm intent), so it is high-precision by design.

### Reference hygiene

Condition on **clean** reference images, not a busy multi-panel board crammed into one frame (the model has to parse sub-images and gets confused). Multi-angle character sheets are fine and even recommended — as *separate clean references* — but there's a real threshold (~6 images) past which more references *degrade* structural accuracy. Fewer, cleaner refs beat one cluttered grid.

> **Caveat — not yet isolated.** The session these lessons came from moved all five levers at once on one night-time project, so the relative credit is unproven. Rule 2 (film-stock + capture condition) is plausibly doing most of the work. Before treating the reference-complement rule as absolute, run an isolation test: same shot, add *only* the photographic-specification clauses, change nothing else, and judge how much of the realism jump survives.

---

## THE GAP

NanoBanana excels at photorealism, coherence, text rendering, and consistency. But it tends to be literal and "clean" — it defaults to competent photographic output that lacks dramatic, stylized artistry. It needs explicit direction for painterly flair, cinematic mood, emotional depth, and compositional elegance.

The fix is not more detail about *what* is in the frame — it's richer direction about *how* the frame should feel. Narrative-driven, evocative prompts work better than keyword lists.

---

## ARTISTIC PROMPT STRUCTURE

All NanoBanana prompts use labeled blocks with descriptive prose. This is the same structure OpenArt uses when enhancing prompts.

```
[Frame Map]: (OPTIONAL — for 2+ subject shots) Anchor each subject to screen position, depth layer, contact points, and gaze BEFORE identity is described. "Foreground-left, the taller figure at three-quarter angle, gaze toward camera-right; midground-right, the seated figure facing away." Lock the frame first so the model can't drift a character to the wrong side of frame or depth plane. Omit for single-subject shots. See FRAME MAP below.
[Subject]: Character @ElementName + shot-specific appearance, expression, visible state
[Action]: Physical pose at frame 1 — weight distribution, muscle tension, micro-expression
[Environment]: @EnvironmentName + shot-specific atmosphere, depth, weather
[Cinematography]: Format, shot size, angle, behavioral camera + lens description (no brand names), aperture
[Optical Realism]: Capture behavior + lens behavior as a physics package (no brand names). Film look + grain intensity. Physical imperfections: grain, halation, chromatic aberration, vignette, barrel distortion. Depth-dependent effects: atmospheric haze, highlight roll-off, lifted blacks in distance. See OPTICAL REALISM section below.
[Lighting/Style]: Motivated light sources → what they illuminate. Color grading. Emotional palette.
[Technical]: Photorealistic rendering, quality boosters, resolution, texture emphasis
```

**`@ElementName` must be PascalCase, matching the `element_name` from the character/environment file exactly.** See `templates/characters.template.md` for the naming derivation rule (kebab-case file prefix → PascalCase). A mismatch means the element won't bind during generation.

The emotion driving the shot determines choices in `[Optical Realism]` (film look, imperfections), `[Lighting/Style]` (color grading, palette), `[Cinematography]` (lens character), and `[Environment]` (atmosphere). Look up the shot's dominant emotion in the Emotion → Color/Mood table below.

Prioritize: **Frame Map (if multi-subject) > Subject > Action > Optical Realism > Lighting/Style > Environment > Cinematography > Technical.** If you must cut for length, cut from the bottom up. `[Optical Realism]` is mandatory — it cannot be cut. `[Frame Map]` is mandatory for any shot with 2+ subjects.

### FRAME MAP — Position Before Identity

For any shot with 2+ subjects, open the prompt with a `[Frame Map]` block that anchors every subject to **screen position, depth layer, contact points, and gaze** — *before* any identity is described. Locking the spatial layout first stops the model from drifting a character to the wrong side of frame or the wrong depth plane, because the positions are pinned when identity arrives. This does more for multi-character consistency in a single still than any amount of identity detail.

Each subject gets: where in frame (screen-left / center / right, foreground / midground / background), contact points (what touches what or whom), and gaze direction. No identity description in the Frame Map — only position, depth, contact, gaze. Identity follows in `[Subject]`.

```
[Frame Map]: Two figures, eye-level two-shot. Foreground screen-left, the taller figure
stands at a three-quarter angle facing camera-right, one hand on the railing. Midground
screen-right, the seated figure faces away toward the window, head turned back over the
left shoulder to meet the standing figure's gaze. Clear depth gap between them, railing
crossing the lower third.
```

For multi-shot video sequences, the same tool extends per-shot with a Subject Lock and Cross-Frame Rules contract — see `reference/seedance-reference.md` → Frame Map, Subject Lock & Cross-Frame Rules.

---

## ADVANCED PROMPTING MODES

Beyond standard text-to-image generation, NanoBanana supports distinct prompting modes that require different prompt structures.

### Production-Grade Prose Mode (Hero Shots)

For hero shots, key frames, and any image that defines the project's visual quality ceiling, expand each labeled block into **dense continuous prose** — each block becomes a full paragraph, 500-1000 words total, briefing NanoBanana like a director of photography.

NanoBanana Pro is a thinking model. It responds to rich descriptive prose. The standard labeled block structure works for standard shots; prose mode expands each block for the shots where hit rate matters most.

**When to use prose mode:**
- Hero shots / thumbnail frames
- Shots that define a new world or location for the first time
- Any shot that has failed 2+ times in standard mode

**When to stay standard:**
- Iteration / exploration at NB2 resolution
- Character reference sheets (flat lighting, neutral background)
- Standard storyboard images where the labeled block structure is sufficient

**Prose mode anatomy** — same labeled blocks, but each expanded to a full paragraph:

1. **`[Subject]`** — full visual description by @Element + markers. Pose, weight distribution, hand placement, gaze direction, expression described as physical state not emotion label. Every garment with material, condition, and how light catches it. 100-150 words.
2. **`[Action]`** — physical micro-actions, tension in specific body parts, breathing state.
3. **`[Environment]`** — @Element + specific materials (concrete-and-glass, water staining, grime), background elements at described distances with scale cues. Architectural detail. What's broken, what's pristine. Volumetric haze, ground fog, dust particulate, mist — density, movement direction, which light sources they catch.
4. **`[Cinematography]`** — specific height, distance, angle, behavioral lens description (compression, bokeh, edge falloff — no brand names), aperture (T-stop or f-stop), filter stack, bokeh character, aspect ratio. Write as if placing a physical camera on set.
5. **`[Optical Realism]`** — full capture behavior + lens behavior + film look + grain intensity (no brand names). Every physical imperfection described with optical cause: where grain is heaviest, how halation wraps which highlights, where chromatic aberration appears, how atmospheric haze degrades the background. Depth-dependent: describe foreground vs midground vs background imperfection gradient. Highlight roll-off behavior. 80-120 words.
6. **`[Lighting/Style]`** — fully motivated (Cardinal Rule 4 from `seedance-reference.md`). Name every source visible in frame. Map warm sources to specific body parts, cool ambient to others. State the split. State what is absent ("no clean studio light"). Color grade description and emotional palette direction.
7. **`[Technical]`** — the full Hyperrealistic Photography Block (see below), customized for this shot. 150+ words.

**Cost note:** Prose mode prompts are significantly longer and should be used with NanoBanana Pro (~$0.15/image), not NB2. Test composition and framing in standard mode at NB2 first, then promote to prose mode at Pro resolution.

### Text Rendering & the Text-First Hack

NanoBanana has strong text rendering. Rules for best results:

1. **Enclose exact text in quotes:** `"MIDNIGHT REVERIE"` — the model renders what's inside quotes
2. **Specify font style:** "bold art deco typography", "thin minimalist Century Gothic", "flowing Brush Script"
3. **Separate text lines:** describe each line's content and styling independently

**The text-first hack:** When generating text-heavy compositions, first have a conversational exchange with the model to develop the text concepts, *then* ask for the image with that text. NanoBanana renders text more accurately when the text content has been established in context before the image generation request.

### Conversational Editing (Don't Re-Roll)

When a generated image is 80%+ correct, request specific changes conversationally rather than regenerating from scratch:

- "Change the sunny day to a rainy night"
- "Remove the person in the background and add a potted plant"
- "Make the text neon blue instead of white"
- "Shift the color grade to cooler tones"

NanoBanana adjusts lighting, reflections, and physics automatically when editing. This is especially valuable when iterating on composition frames.

---

## FILM LOOK VOCABULARY

Film looks act as powerful emotional shorthand — they encode color science, grain structure, and contrast curves that NanoBanana interprets as a holistic aesthetic package. Describe the *look* behaviorally rather than naming a stock; the model renders the behavior directly instead of pattern-matching a brand to a vibe.

### Color Looks

| Look | Behavioral Description | Emotional Signature | Best For |
|------|------------------------|--------------------:|----------|
| **Warm fine-grain negative** | Warm skin tones, creamy highlights, soft contrast, forgiving latitude, subtle fine grain | Timeless, professional, slightly nostalgic | Portraits, emotional close-ups, humanistic scenes |
| **Refined warm negative** | Same warm family, finer grain, slightly more saturation | Refined warmth, studio quality | Controlled lighting, beauty shots |
| **Grainy warm negative** | Warm skin with more visible grain, wide exposure latitude | Gritty warmth, available-light intimacy | Low-light portraits, candid emotion |
| **Vivid saturated negative** | Highly saturated, punchy contrast, very fine grain | Vivid, modern, poppy | Landscapes, travel, bright daylight |
| **Faded consumer warm** | Slightly faded warm consumer look, rich yellows/oranges | Nostalgic, 90s, family/vacation, casual beauty | Candid everyday beauty, nostalgia scenes |
| **Soft pastel negative** | Dreamy pastels, warm tones, gentle contrast | Muted, romantic, fashion-editorial | Romantic portraits, dreamy scenes, soft light |
| **Ultra-saturated slide** | Hyper-vivid, high contrast, deep blues/greens | Dramatic, painterly, larger-than-life | Epic landscapes, nature, establishing shots |
| **Tungsten night film w/ halation** | Tungsten-balanced, distinctive **red halation** (glowing blooms around lights), cool shadows, warm highlights | Dreamy, cinematic, neo-noir, atmospheric | Night scenes, neon, street photography, cyber-noir |
| **Lo-fi imperfect** | Unpredictable color shifts, heavy vignetting, light leaks | Imperfect, artistic, lo-fi charm | Experimental, alternative, dream sequences |

### Black & White Looks

| Look | Behavioral Description | Emotional Signature | Best For |
|------|------------------------|--------------------:|----------|
| **Gritty high-contrast B&W** | Versatile, visible grain, high contrast | Gritty, timeless, raw | Street photography, documentary, noir |
| **Reportage B&W** | Classic high contrast, strong blacks, visible grain | Iconic reportage, journalistic weight | Dramatic B&W portraits, editorial, confrontation |
| **Fine-grain elegant B&W** | Smooth, very fine grain, excellent tonal range | Refined, elegant, sculptural | B&W beauty, architecture, quiet drama |
| **Available-light B&W** | Fine grain for its speed, good tonal range, slightly grittier | Versatile elegance | Available-light B&W, night scenes |

### Prompt Usage

Describe the look behaviorally:
- `"warm fine-grain color-negative rendition with creamy highlights and soft contrast"`
- `"tungsten-balanced night-film look with red halation blooming around the lights"`
- `"ultra-saturated slide-film contrast and color"`

Combine looks for hybrid effects:
- `"warm-negative skin tones with subtle tungsten-film halation"`
- `"faded consumer warmth with slide-film landscape saturation"`

Add texture modifiers:
- `"subtle fine grain"`, `"scanned-negative texture"`, `"light leaks"`, `"halation bloom"`, `"natural vignette"`, `"imperfect edges"`

---

## LENS ARTISTIC CHARACTER

Beyond focal length and framing (covered in `cinematography.md`), lenses have **rendering character** — how they draw the image, shape out-of-focus areas, handle light. These are style cues for NanoBanana.

### Bokeh Types

| Bokeh | Look | Optical Character | Emotional Effect |
|-------|------|-------------------|-----------------|
| **Smooth circular** | Even, creamy, round highlights in background | Modern well-corrected glass | Clean, professional, elegant |
| **Swirly** | Vortex-like spiral toward edges, dreamy | Uncorrected vintage field curvature | Artistic, dreamlike, hypnotic |
| **Oval / cats-eye** | Elliptical highlight shapes, wider toward edges | Anamorphic squeeze, vintage edge rendering | Cinematic, filmic, professional |
| **Soap bubble** | Bright-rimmed circular highlights | Over-corrected spherical aberration | Whimsical, fairy-tale, magical |
| **Busy / nervous** | Harsh, distracting background blur | Cheap or mirror-lens rendering | Gritty, documentary, raw (use intentionally) |

Prompt usage: `"swirly vortex bokeh spiraling toward the edges"`, `"oval anamorphic bokeh"`, `"creamy circular bokeh"`

### Signature Lens Effects

| Effect | Description | Prompt Phrase |
|--------|-------------|---------------|
| **Lens flare** | Streaks or starbursts from bright light sources | `"subtle lens flare"`, `"dramatic anamorphic flare"`, `"horizontal blue lens flares"` |
| **Vignetting** | Darker corners drawing the eye to center | `"subtle natural vignette"`, `"dark vignetting at edges"` |
| **Chromatic aberration** | Color fringing (purple/green) on high-contrast edges | `"subtle chromatic aberration"`, `"vintage color fringing"` |
| **Soft focus / glow** | Ethereal halo around highlights, especially at wide apertures | `"soft highlight glow"`, `"soft focus halo on highlights"`, `"ethereal highlight bloom"` |
| **Barrel distortion** | Slight outward bulge from wide-angle lenses | `"subtle barrel distortion"` |
| **Tilt-shift** | Selective plane of focus, miniature effect | `"tilt-shift selective focus"`, `"miniature effect"` |
| **Anamorphic flare** | Horizontal streaks + oval bokeh + widescreen feel | `"anamorphic lens, oval bokeh, horizontal lens flares, cinematic widescreen"` |

### Lens Character References

Describe the rendering behavior directly — no brand names. Each row is a behavioral profile you can drop into a prompt.

| Lens Character | Behavioral Description | When to Reference |
|----------------|------------------------|-------------------|
| **Glowing normal portrait** | Normal field of view at a wide aperture, micro-contrast with 3D pop, soft glow blooming on highlight edges, intimate rendering | Emotional portraits, character close-ups |
| **Ultra-fast dreamy** | Extreme shallow depth of field, dreamy wide-open glow, ethereal falloff | Dream sequences, romance, magic |
| **Clinical-yet-beautiful tele** | Short-telephoto compression, clinical sharpness with beautiful rendering, exquisite detail | When you want sharp + beautiful simultaneously |
| **Classic balanced normal** | Normal field of view, balanced contrast, smooth tonal transitions | General cinematic beauty |
| **Swirly vintage** | Swirly vortex bokeh, vintage character, soft glow, uncorrected edges | Artistic flair, dream sequences, surreal |
| **Warm imperfect vintage** | Warm rendering with characterful glow and gentle aberrations, slightly imperfect | Vintage, nostalgic, retro feel |
| **Soft hazy tele** | Short-telephoto softness, unique bokeh, slight veiling haze wide open | Moody portraits, mystery |
| **Anamorphic widescreen** | Horizontal streak flares, oval bokeh, widescreen compression | Maximum cinematic drama |
| **Medium-format smooth** | Larger-format smoothness, exceptional tonal range, shallow falloff at equivalent framing | Beauty, fashion, refined portraits |
| **Warm gentle-rolloff cine** | Warm color rendition, gentle highlight roll-off, smooth bokeh | Period drama, warmth, golden-age cinema |

Prompt usage: `"normal-FOV portrait at a wide aperture with soft glow blooming on highlight edges"`, `"swirly vortex bokeh background"`, `"anamorphic character — horizontal streak flares, oval bokeh, widescreen compression"`

### Aperture as Style

| Aperture | Depth of Field | Artistic Effect | Prompt Phrase |
|----------|---------------|-----------------|---------------|
| f/0.95–f/1.4 | Paper-thin | Subject pops, dreamlike isolation | `"f/1.4, razor-thin depth of field, subject isolated in creamy blur"` |
| f/2–f/2.8 | Shallow | Subject clear, background soft but recognizable | `"f/2.8, shallow depth of field"` |
| f/4–f/5.6 | Moderate | Environmental context with some separation | `"f/5.6, subject and environment both readable"` |
| f/8–f/16 | Deep | Everything sharp, landscape style | `"f/8, deep depth of field, everything in sharp focus"` |

---

## EMOTION → COLOR / MOOD / PALETTE

Companion to the emotion → camera language table in `cinematography.md` and the Environment → Emotion Mapping in `video-dramaturgy.md` § 8. Use all three tables together: camera language tells you *how to frame*; this table tells you *how the frame should feel visually*; the environment mapping tells you *which physical environment amplifies the emotion*.

| Emotion | Color Palette | Lighting | Film Look | Atmosphere |
|---------|--------------|----------|-----------|------------|
| **Melancholy / Sadness** | Desaturated cool tones, muted blues/greys | Soft diffused light, overcast, low contrast | Warm fine-grain negative with cool shift, or fine-grain elegant B&W | Subtle rain, fog, mist, empty space |
| **Tension / Dread** | High contrast, cool blues with red accents | Harsh chiaroscuro, single hard source, deep shadows | Tungsten night film w/ halation, or reportage B&W | Volumetric smoke, haze, darkness encroaching |
| **Wonder / Awe** | Warm golden highlights, rich sky blues, luminous | Golden hour volumetric light, god rays | Ultra-saturated slide (landscapes) or vivid saturated negative | Volumetric god rays, atmospheric glow, expansive space |
| **Intimacy / Tenderness** | Warm skin tones, soft pastels, amber | Soft window light, warm practical sources | Warm fine-grain negative or soft pastel negative | Gentle, close, quiet, domestic warmth |
| **Nostalgia** | Warm faded tones, rich yellows/oranges, slightly washed | Warm afternoon light, soft, slightly overexposed | Faded consumer warm | Slightly hazy, soft-focus, imperfect edges |
| **Hope / Aspiration** | Warm highlights bleeding into cool shadows, emerging light | Dawn or sunrise, light breaking through | Warm fine-grain negative, or vivid saturated negative | Mist clearing, light emerging, upward space |
| **Anger / Rage** | High saturation reds/oranges, or stark desaturated with one hot color | Harsh, contrasty, aggressive side-light | Pushed vivid saturated negative, or gritty high-contrast B&W | Heat shimmer, tight space, no breathing room |
| **Fear / Horror** | Desaturated with sickly green/yellow accent, or deep noir | Underlit, practical sources only, deep shadows | Tungsten night film w/ halation, or pushed reportage B&W | Fog, darkness, barely visible, cold |
| **Power / Dominance** | Rich, saturated, deep tones, gold and dark | Strong directional light, rim light, heroic key | Vivid saturated negative, or refined warm negative | Clear atmosphere, subject commands the frame |
| **Vulnerability / Defeat** | Washed out, low saturation, pale | Flat overcast, or harsh overhead | Grainy warm negative, or gritty high-contrast B&W | Empty, exposed, nowhere to hide |
| **Romance / Love** | Warm pastels, soft pink/gold, creamy | Golden hour backlight, lens flare, warm | Soft pastel negative or warm fine-grain negative | Soft, glowing, dreamy, ethereal |
| **Isolation / Loneliness** | Monochromatic or very limited palette | Cold, distant, single source | Available-light B&W, or desaturated warm negative | Vast empty space, silence made visible |
| **Contemplation** | Muted earth tones, subdued | Soft side-light, window light, gentle | Warm fine-grain negative, or fine-grain elegant B&W | Quiet, still, interior space |
| **Urgency / Chaos** | High contrast, clashing colors, saturated | Harsh mixed sources, flickering | Pushed vivid saturated negative, or tungsten night film w/ halation | Motion, blur, debris, instability |
| **Liberation / Joy** | Bright, high-key, open highlights, vivid | Open sunlight, fill everywhere, bright | Vivid saturated negative, or ultra-saturated slide for landscapes | Open sky, wind, movement, expansive |
| **Mystery / The Unknown** | Teal and deep blue, limited warm accents | Underlit, pool-of-light, most of frame dark | Tungsten night film w/ halation, or pushed reportage B&W | Fog, smoke, silhouettes, partially revealed |
| **Shame / Humiliation** | Washed out, sickly warm, unflattering | Overhead or fluorescent, flat, nowhere to hide | Faded consumer warm (unflattering greens) or gritty high-contrast B&W | Nowhere to hide, exposed |
| **Determination / Resolve** | Clean, direct, moderate contrast | Even lighting with slight heroic key | Refined warm negative, or vivid saturated negative | Clear, focused, no clutter |

### Color Scheme Shorthands

These named palettes encode specific color grading directions. Use in the prompt's color/grading section:

| Name | Description | Prompt Phrase |
|------|-------------|---------------|
| **Teal & Orange** | Cool shadows, warm skin/highlights — blockbuster cinema standard | `"cinematic teal and orange color grading"` |
| **Warm Earth** | Amber, ochre, sienna, brown — comfort, nostalgia, the past | `"warm earth tone palette"` |
| **Desaturated + Pop** | Muted overall with one saturated accent color — isolation, focus | `"desaturated palette with vivid red accent"` |
| **Monochromatic** | Single hue in varying tones — cohesion, mood, stylization | `"monochromatic blue palette"` |
| **Muted Pastels** | Soft, low-saturation pastels — dreamy, romantic, gentle | `"muted pastel tones, soft and dreamy"` |
| **High Key** | Bright, blown highlights, minimal shadows — innocence, hope, clinical | `"high-key lighting, bright and airy"` |
| **Low Key** | Deep shadows, minimal fill — drama, noir, menace | `"low-key lighting, deep shadows"` |
| **Cross-Processed** | Unexpected color shifts (greens in shadows, magentas in highlights) — surreal, edgy | `"cross-processed color shift"` |
| **Bleach Bypass** | Desaturated with increased contrast and silver overlay — gritty, war, raw | `"bleach bypass look, desaturated high contrast"` |

---

## QUALITY & BEAUTY BOOSTERS

Phrases that elevate NanoBanana output aesthetically without altering subject matter. Layer these at the end of prompts.

### Artistic Elevation

| Phrase | Effect |
|--------|--------|
| `"cinematic masterpiece"` | Broad quality signal — composition, lighting, mood |
| `"fine art photography"` | Elevates beyond snapshot to gallery quality |
| `"painterly realism"` | Photorealistic with painting-like composition and color |
| `"painterly yet photorealistic"` | Explicit hybrid — real textures with artistic framing |
| `"breathtaking beauty"` | General aesthetic boost |
| `"emotional depth"` | Encourages expressive, resonant imagery |
| `"ethereal beauty"` | Soft, luminous, otherworldly quality |
| `"epic composition"` | Stronger compositional intent |
| `"dramatic atmosphere"` | Heightened mood and environmental storytelling |
| `"exquisite textures"` | Surface detail and tactile quality |
| `"emotional atmosphere"` | Scene carries feeling beyond the literal content |

### Technical Quality

| Phrase | Effect |
|--------|--------|
| `"8K resolution"` | Maximum detail signal |
| `"highly detailed"` | General detail boost |
| `"hyper-detailed"` | Extreme detail in textures and surfaces |
| `"sharp focus with shallow depth of field"` | Subject crisp, background creamy |
| `"subtle film grain"` | Organic texture, anti-digital smoothness |
| `"natural skin textures"` | Prevents plastic/airbrushed skin |
| `"visible skin pores"` | Maximum skin realism |
| `"masterpiece"` | General quality boost (use at end) |

### Camera/Photographic References

| Phrase | Effect |
|--------|--------|
| `"modern high-resolution digital capture"` | Clean, sharp, contemporary look |
| `"short-telephoto prime at a wide aperture"` | Subject isolation with creamy bokeh |
| `"larger-format capture"` | Smoother tonal transitions, shallower DoF at same framing |
| `"medium-format luxury rendering"` | Exceptional tonal range, refined |
| `"National Geographic style"` | Documentary beauty, rich but real |
| `"Vogue editorial"` | Fashion/beauty photography aesthetic |

### Negative Prompt Additions (Artistic)

Append to any negative prompt block to prevent common aesthetic failures:

```
blurry, low quality, artifacts, overexposed, plastic skin, generic, flat lighting,
amateur, oversaturated, HDR look, digital noise, smooth airbrushed skin
```

> ⚠️ On NanoBanana, negatives are **weak** — the model slims and beautifies regardless. These help at the margins but do not lock build/imperfections/palette. For those, enforce **positively** in the prompt body and run the NanoBanana still gate in `ai-slop-ban-list.md` before generating.

---

## HYPERREALISTIC PHOTOGRAPHY BLOCK

A canonical paragraph to append to any NanoBanana prompt that requires photographic realism. This block encodes material-level detail that separates "clean AI image" from "photograph." Customize per project — replace bracketed placeholders with project-specific details.

### The Block (copy and adapt)

```
Hyperrealistic photography. Real human skin texture with fine, soft, even pores,
subtle subsurface scattering, fine peach fuzz catching light along the jawline and
cheekbones. Per-zone specular kill — zero shine on forehead, nose bridge, cheekbones,
temples, and chin. Flattering ceiling: natural unevenness but never harsh — no acne,
no blemishes, no enlarged or cratered pores; the lived-in realism of good cinema skin
under a flattering key, not the brutal macro-detail of a dermatology photo. Resolve any
tension toward fine-and-flattering — a face should look real and good at the same time.
[Body type] body proportions matching the reference image exactly. Hair rendered
strand by strand in [hair color] with realistic flyaways, baby hairs at the
hairline, individual strands catching [light source description]. Fabric rendered
with real [primary fabric] on [garment] with [texture/condition detail], real
[secondary fabric] with [detail], visible texture variation across all surfaces.
Eyes with real reflection, real moisture, real depth in the iris, real catchlights
from [light source]. [Jewelry/accessories] with real metal surface detail and
slight tarnish, catching [light source] in [warm/cool] reflections. Real
environmental lighting integration — the character lit by [environment]'s actual
[light sources], fully embedded in [atmosphere description]. [Film look]
rendition, visible fine grain, subtle chromatic aberration at the
edges, soft lens vignette, cinematic color grade with [shadow color] shadows,
[highlight color] highlights, neutral mid-tones, lifted blacks. Reference grade
similar to [2-3 film/show references]. Lived-in, not pristine. Photographic,
not rendered.
```

### Relationship to `[Optical Realism]`

The Hyperrealistic Photography Block is a `[Technical]` appendage — it describes material-level detail (skin, hair, fabric, eyes, metal). The `[Optical Realism]` block describes the camera-level physics (grain, halation, aberration, depth effects). They work together: `[Optical Realism]` makes the camera feel real; the Hyperrealistic Photography Block makes the subjects feel real.

### When to Use

- **Hero shots and key frames** — always (both the block AND `[Optical Realism]`). These shots define the visual quality ceiling.
- **Character reference sheets** — skip. Reference sheets use flat studio lighting and neutral backgrounds; the hyperrealism block's environmental lighting language conflicts with that intent. `[Optical Realism]` is also skipped for reference sheets.
- **Iteration / exploration** — skip during NB2 drafts. Apply when promoting to NanoBanana Pro for final assets.

### Per-Project Customization

Define a project-specific hyperrealism block in the project's style file (`storyboard/styles/{name}.md`). Lock the film look, grain intensity, color grade, and grade references once — every hero prompt inherits the same block. Only the per-shot variables change (light source, fabric, jewelry, atmosphere).

### Checklist — Does Your Hyperrealism Block Cover:

- [ ] Skin: pores, subsurface scattering, peach fuzz, imperfections
- [ ] Hair: strand-by-strand, flyaways, baby hairs, light interaction
- [ ] Fabric: named material, weave/grain detail, condition (worn/pristine/distressed)
- [ ] Eyes: reflection, moisture, iris depth, catchlights from named source
- [ ] Metal/jewelry: surface detail, tarnish, reflections from named light
- [ ] Environmental lighting integration: character lit by scene's actual sources, not studio light
- [ ] Film look: rendition described behaviorally, grain intensity, chromatic aberration, vignette
- [ ] Color grade: shadow color, highlight color, mid-tone treatment, black level
- [ ] Reference grade: 2-3 named productions for overall grade direction

---

## OPTICAL REALISM — DEFEATING THE AI CLEAN LOOK

AI image generation strips out the physical artifacts that real cameras produce. The human eye doesn't consciously notice film grain, chromatic aberration, or highlight roll-off — but their absence screams "digital render." The fix is not "add realism keywords." It's prompting for the **physics of the glass and emulsion** between the scene and the viewer.

Core insight (Olivier Hero Dressen / DesignHero): *"Saying 'ultra-realistic, photorealistic' doesn't tell the AI how to achieve realism. It's just asking it to try harder."* Instead, prompt for **specific optical physics** — camera body, lens, aperture, film stock, and the imperfections each produces.

### The Frequency Distribution Problem

AI distributes high-frequency detail (noise, texture, grain) uniformly across the image. In real photography:
- **Foreground:** sharp grain, crisp texture, visible chromatic aberration at edges
- **Midground:** moderate grain, full detail
- **Background:** grain softened by atmosphere, contrast loss, blue-shift from aerial perspective, detail dissolved into bokeh

This depth-dependent variation is what makes a photograph feel three-dimensional. AI's uniform distribution makes everything feel equally "there" — flat despite technically correct perspective. The `[Optical Realism]` block counters this by encoding depth-aware imperfections.

### The `[Optical Realism]` Block

**Mandatory for every `nb-prompt.md`.** Placed between `[Cinematography]` and `[Lighting/Style]`. Encodes the physical camera system — body, lens, film stock, and the imperfections each introduces.

```
[Optical Realism]: {capture behavior}, {lens behavior + focal-length feel} at {aperture}.
{Film look} with {grain intensity}. {2-4 physical imperfections appropriate to the lens and look}.
{1-2 depth-dependent effects}.
```

The block has three layers:

**Layer 1 — Capture + Lens Behavior as Physics Package.** Don't name a camera body or lens — describe what they *do*. The model renders behavior, not gear; brand names just get pattern-matched to a vibe and approximated. Always specify: capture behavior (latitude, highlight handling), lens behavior (compression/FOV, bokeh, edge falloff), and aperture (for depth-of-field clarity).

| Weak (aesthetic label or brand) | Strong (behavior described) |
|---|---|
| `"cinematic camera"` / `"ARRI ALEXA Mini"` | `"wide-latitude cinema capture, clean highlight roll-off, normal-FOV prime at a wide aperture, smooth bokeh"` |
| `"professional lens"` | `"short-telephoto prime at a wide aperture, shallow depth of field, creamy circular bokeh"` |
| `"vintage look"` | `"normal-FOV prime at a wide aperture, slightly decentered rendering, characterful aberrations toward the edges"` |

**Layer 2 — Film Look + Grain Intensity.** The film look determines color science and contrast curve; grain intensity is its own dial. Describe both behaviorally — no stock names, no ASA numbers.

| Grain Intensity | Grain Character | When |
|---|---|---|
| Near-clean | Near-invisible grain, hyper-clean tonal range | Beauty, product, still life |
| Fine | Fine visible grain, the sweet spot for naturalism | Most narrative work |
| Prominent | Prominent grain, gritty texture | Low-light, documentary, noir |
| Heavy | Heavy grain dominates, high contrast | Extreme conditions, abstract, dream |

Cross-reference with the Film Look Vocabulary table above for emotional signature per look.

**Layer 3 — Physical Imperfections.** Select 2-4 from the vocabulary below based on the lens, stock, and shot emotion. These are not decorative — each has a specific optical cause.

### Imperfection Vocabulary

| Imperfection | Optical Cause | Prompt Phrase | When to Use |
|---|---|---|---|
| **Film grain** | Silver halide crystals in emulsion responding to light | `"natural film grain at {grain intensity}"`, `"visible grain structure"` | Every shot — the single most important realism cue |
| **Halation** | Light scattering through film emulsion, reflecting off base layer | `"subtle halation on highlights"`, `"warm halation glow around practical lights"` | Night scenes, any shot with bright light sources against dark backgrounds. Strongest with a tungsten night-film look |
| **Chromatic aberration** | Lens failing to focus all wavelengths at the same point | `"subtle chromatic aberration at frame edges"`, `"color fringing on high-contrast edges"` | Wide-angle lenses, vintage glass, high-contrast scenes |
| **Vignetting** | Light fall-off at frame edges from lens barrel obstruction | `"natural lens vignette darkening corners"`, `"gentle optical vignetting"` | Wide apertures (f/1.4-2.0), vintage lenses — draws eye to center |
| **Barrel distortion** | Wide-angle lens bending straight lines outward | `"subtle barrel distortion from wide-angle lens"` | 24mm and wider — environment shots, establishing shots |
| **Highlight roll-off** | Film's logarithmic shoulder compressing bright values | `"gentle highlight roll-off, no hard clipping to white"` | Any shot with bright windows, sky, practicals — prevents the digital hard-clip look |
| **Lifted blacks** | Atmospheric light scattering prevents true black in distance | `"lifted blacks in deep background, atmospheric grey-blue not pure black"` | Any shot with visible depth — the "secret sauce" for spatial realism |
| **Light wrap** | Bright background light bleeding over foreground subject edges | `"subtle light wrap from backlight bleeding over shoulder edges"` | Backlit subjects, rim-lit scenes — prevents the "cutout sticker" look |
| **Lens breathing** | Subtle focal length shift during focus change | `"subtle lens breathing"` | Rack focus shots, vintage primes — adds life to static frames |
| **Bokeh character** | Shape and quality of out-of-focus highlights — unique per lens | `"oval anamorphic bokeh"`, `"nervous busy bokeh from a vintage zoom"`, `"creamy smooth bokeh"` | Any shot with shallow DoF — the bokeh character signals which kind of glass is "filming" |
| **Sensor bloom** | Digital highlight blooming from overexposed pixels | `"gentle sensor bloom on specular highlights"` | Clean digital capture looks, not film looks |
| **Pro-Mist diffusion** | Tiffen Black Pro-Mist filter softening highlights | `"Pro-Mist 1/4 diffusion softening highlights with gentle warm bloom"` | Narrative/beauty shots — the filter that makes digital look filmic |

### Depth-Dependent Imperfections

Real imperfections vary with distance from the camera. Encode this depth gradient:

| Depth Zone | What Happens | Prompt Language |
|---|---|---|
| **Foreground** (0-2m) | Sharpest grain, visible chromatic aberration at edges, maximum texture detail, possible focus softness if beyond DoF | `"foreground elements show crisp grain and full texture"` |
| **Midground** (2-10m) | Peak sharpness zone (focal plane), moderate grain, full detail | `"subject at focal plane, maximum sharpness"` |
| **Background** (10m+) | Grain dissolved into atmosphere, contrast drops, colors desaturate, detail collapses into bokeh, blue-shift from aerial perspective | `"distant background softened by atmospheric haze, contrast loss, desaturated toward blue-grey"` |

### `[Optical Realism]` by Emotion

Cross-reference with the Emotion → Color/Mood table. Each emotional register has a natural optical signature:

| Emotion | Optical Profile |
|---|---|
| **Melancholy / Sadness** | Soft fine grain (warm fine-grain negative), gentle halation, heavy atmospheric haze, lifted blacks, quarter-strength highlight diffusion |
| **Tension / Dread** | Prominent grain (tungsten night film w/ halation), strong halation on practicals, chromatic aberration, deep vignette, no diffusion |
| **Intimacy / Tenderness** | Fine grain (refined warm negative), soft glow on highlights, gentle vignette, shallow-DoF bokeh character, subtle light wrap |
| **Nostalgia** | Visible grain (faded consumer warm), light leaks, heavy vignette, barrel distortion from a wide lens, lifted blacks |
| **Power / Dominance** | Near-clean grain (vivid saturated negative), anamorphic streak flares, oval bokeh, strong highlight roll-off, wide dynamic range |
| **Fear / Horror** | Coarse grain (pushed reportage B&W), extreme vignette, chromatic aberration, no highlight roll-off (let it clip), no diffusion |
| **Wonder / Awe** | Near-clean grain (ultra-saturated slide), no imperfections except gentle halation on god rays, maximum clarity — awe should feel hyper-real, not degraded |

### Example `[Optical Realism]` Blocks

**Night street scene (tension):**
```
[Optical Realism]: Wide-latitude cinema capture, moderate-wide prime at a wide aperture.
Tungsten night-film look with prominent grain. Visible grain with strong red-orange halation
around neon signage and streetlights. Subtle chromatic aberration at frame edges.
Deep natural vignette. Distant background loses contrast into atmospheric
blue-grey haze. No hard highlight clipping — gentle roll-off on neon.
```

**Intimate portrait (tenderness):**
```
[Optical Realism]: Larger-format smooth capture, short-telephoto prime at a wide aperture.
Refined warm-negative look with fine grain barely visible, subtle
glow on highlight edges of cheekbones and hair. Gentle optical vignette
darkening corners. Creamy circular bokeh in background. Subtle light wrap
from window backlight bleeding over shoulder contour.
```

**Epic landscape (wonder):**
```
[Optical Realism]: Large-format clean cinema capture, wide-angle prime at a deep aperture.
Ultra-saturated slide look, near-invisible grain, hyper-sharp across deep
focus. Gentle halation on sun rays piercing cloud layer. Atmospheric haze
building with distance — foreground rock crisp, midground trees softened,
distant peaks dissolved into blue-grey aerial perspective.
```

**Documentary / raw (vulnerability):**
```
[Optical Realism]: Normal-FOV prime at a wide aperture, slightly decentered
rendering. Pushed gritty high-contrast B&W look with heavy visible grain
and gritty silver texture. Strong vignette from the wide aperture. Busy nervous
bokeh from imperfect vintage glass. Lifted blacks throughout — no pure shadows.
Chromatic aberration on high-contrast edges.
```

### NanoBanana Generation Notes

- **Always generate at 4K** when the shot includes optical imperfections. NanoBanana needs resolution to render grain patterns — at low res, grain collapses into digital noise (Chase Jarvis / NanoBanana Pro documentation).
- **Lock seed** for optical consistency across a series — same film look + same seed = consistent grain character.
- Film look in `[Optical Realism]` replaces film look in `[Lighting/Style]`. The look now lives in the block that owns the physics. `[Lighting/Style]` retains emotional palette and color grading direction.

### Checklist — Does Your `[Optical Realism]` Block Have:

- [ ] Capture behavior described (latitude, highlight handling — no brand names)
- [ ] Lens behavior described (compression/FOV, bokeh, edge falloff) with aperture
- [ ] Film look + grain intensity described behaviorally
- [ ] At least 2 physical imperfections from the vocabulary table
- [ ] At least 1 depth-dependent effect (atmospheric haze, lifted blacks, contrast loss)
- [ ] Highlight behavior stated (roll-off, bloom, or hard clip — choose one)
- [ ] Imperfections matched to the shot's emotion (cross-reference the Optical Realism by Emotion table)

---

## PHOTOGRAPHER & CINEMATOGRAPHER REFERENCES

Named references pull in compositional and aesthetic knowledge. Use as style anchors.

| Name | Domain | Aesthetic Signature | When to Reference |
|------|--------|--------------------:|-------------------|
| **Roger Deakins** | Cinematography | Masterful naturalistic yet dramatic lighting, clean frames | Any cinematic lighting challenge |
| **Annie Leibovitz** | Portraiture | Dramatic, intimate celebrity portraits, rich lighting, emotional depth | Character portraits, emotional close-ups |
| **Gregory Crewdson** | Staged photography | Cinematic suburban scenes, theatrical lighting, mysterious, narrative | Environmental portraits, uncanny scenes |
| **Henri Cartier-Bresson** | Street | Decisive moment, elegant composition, perfect timing | Street scenes, candid moments |
| **Steve McCurry** | Documentary | Vibrant National Geographic, saturated, powerful faces | Vivid character portraits, travel |
| **Vivian Maier** | Street | Candid, observational, intimate distance, B&W | Street scenes, found moments, B&W |
| **Ansel Adams** | Landscape | Epic B&W landscapes, full tonal range, majesty | B&W landscapes, nature establishing shots |
| **Emmanuel Lubezki** | Cinematography | Extended takes, natural light, fluid camera, spiritual | Natural light scenes, spiritual/transcendent moments |
| **Syd Mead** | Concept art | Futuristic industrial design, cinematic sci-fi | Sci-fi environments, cyberpunk, technology |
| **Edward Hopper** | Painting | Isolation, urban light, loneliness, empty spaces | Isolation scenes, urban loneliness, night |
| **Caravaggio** | Painting | Extreme chiaroscuro, dramatic religious scenes | Dramatic lighting, power, confrontation |
| **Vermeer** | Painting | Soft window light, domestic intimacy, luminous skin | Intimate interiors, soft-light portraits |
| **Greg Rutkowski** | Digital art | Dramatic fantasy realism, rich lighting, epic scenes | Fantasy, dramatic compositions |
| **Wes Anderson** | Film direction | Symmetrical composition, pastel palettes, whimsical | Stylized, symmetrical, color-coordinated scenes |

Prompt usage: `"in the style of fine art photography by Gregory Crewdson"`, `"lighting inspired by Roger Deakins"`, `"Caravaggio chiaroscuro"`, `"Vermeer window light"`, `"Wes Anderson symmetrical composition, pastel palette"`

---

## VISUAL LANGUAGE FRAMEWORK — Script to Prompt

A systematic method for expanding sparse script lines into rich NanoBanana prompts. Think of it as directing a film: the script gives you *what*; this framework gives you *how it should look and feel*.

### The Translation Layers

```
SCRIPT LINE (sparse)
    "The detective enters the dimly lit alley, rain falling, haunted by the past."

↓ Identify EMOTION (the core — drives all visual choices)
    Melancholy + Tension + Isolation
    → Look up in Emotion → Color/Mood table above

↓ Fill each labeled block:

[Subject]: @Detective , a weary figure in a rumpled navy wool trench coat with
visible weave and fraying at the cuffs, rain-soaked, deep lines under hollow eyes.
[Action]: Standing still at the mouth of the alley, weight on back foot, one hand
braced against the brick wall, staring into the dark passage ahead.
[Environment]: A narrow rain-slicked alley at night, puddles reflecting cold neon
signage from the street beyond, steam rising from a grate, wet brick walls glistening.
[Cinematography]: Vertical 9:16. Medium shot, eye level. Moderate-wide
spherical prime at a wide aperture.
[Optical Realism]: Wide-latitude cinema capture, moderate-wide spherical prime at a wide aperture.
Tungsten night-film look with prominent grain. Visible grain, red halation around neon sign and
streetlight. Chromatic aberration at frame edges. Natural vignette. Distant
alley end lost in atmospheric haze with lifted blacks — deep blue-grey, not
pure black. Gentle highlight roll-off on neon reflections in puddles.
[Lighting/Style]: Dramatic rim lighting from a single neon sign frame-right
casting cool teal across his shoulder, warm amber streetlight from behind.
Cool desaturated teal color grading with subtle warm neon accents. No studio fill.
[Technical]: Photorealistic rendering, hyper-detailed textures of wet fabric
and brick, 4K resolution.
```

### Voice-Over Integration

When the shot has narration or voice-over, use the spoken tone to inform visual choices:

| Voice-Over Tone | Visual Implication |
|-----------------|-------------------|
| Somber narration describing loss | Quiet sorrowful atmosphere, reflective mood, empty spaces, desaturated |
| Urgent whispered warning | Tight framing, harsh shadows, tension lighting, shallow DoF |
| Warm reminiscence | Golden tones, soft focus, warm-negative warmth, gentle light leaks |
| Cold factual observation | Clinical lighting, neutral palette, sharp focus, clean composition |
| Hopeful, rising emotion | Warming palette, light entering frame, opening composition |

### Building a Project Style Bible

For consistency across a project's NanoBanana prompts, define 3–5 core moods with fixed visual parameters:

```markdown
## Project: [Name] — Visual Language

### MOOD: Melancholy
- Film look: Warm fine-grain negative, cool shift
- Lens: normal-FOV prime at a wide aperture, soft window light + shadows
- Palette: Desaturated, muted blues and greys
- Atmosphere: Fog, overcast, empty space
- Boosters: "emotional depth, painterly realism"

### MOOD: Confrontation
- Film look: Tungsten night film w/ halation
- Lens: moderate-wide prime at a wide aperture, close range
- Palette: High contrast, teal shadows, amber highlights
- Atmosphere: Volumetric haze, hard light
- Boosters: "dramatic atmosphere, cinematic masterpiece"

### MOOD: Revelation
- Film look: Vivid saturated negative
- Lens: short-telephoto prime at a wide aperture, soft glow on highlights
- Palette: Building from muted to vivid, golden light emerging
- Atmosphere: Dust motes, god rays, clearing mist
- Boosters: "breathtaking beauty, ethereal glow"
```

Reference the mood by name in the storyboard, and the NanoBanana prompt inherits the full visual treatment.

---

## EXAMPLE PROMPTS BY GENRE

### Portrait — Warm & Emotional

```
[Subject]: A contemplative young woman by a window, intricate details in hair
and skin texture, gentle introspective expression, slight moisture in her eyes.
[Action]: Seated with chin resting lightly on one hand, gazing through the glass,
body still, weight settled.
[Environment]: Quiet domestic interior, soft curtain diffusing light, warm-toned
walls, a half-empty teacup on the windowsill.
[Cinematography]: Medium close-up, eye level. Short-telephoto prime at a wide aperture,
shallow depth of field with creamy bokeh.
[Optical Realism]: Short-telephoto prime at a wide aperture. Refined warm-negative
look, fine grain barely visible, subtle glow on
highlight edges of cheekbone and hair. Gentle optical vignette. Creamy
circular bokeh dissolving the background wall into warm amber patches.
Subtle light wrap from window backlight bleeding over the far shoulder.
[Lighting/Style]: Soft natural window light from frame-left, warm creamy
skin tones with cool shadow on the right cheek. No studio fill.
[Technical]: Fine art photography, hyper-detailed eyes with real moisture
and catchlights, natural skin pores, 4K resolution.
```

### Cinematic Night Scene — Neo-Noir

```
[Subject]: A lone figure in a long dark coat, collar turned up, face half in shadow,
rain droplets visible on shoulders and hair.
[Action]: Walking with deliberate pace down the center of the street, hands in pockets,
head slightly bowed against the rain.
[Environment]: A rain-slicked neon-lit city street at night, reflections shimmering on
wet pavement, atmospheric fog softening the far end of the block.
[Cinematography]: Wide shot, low angle. Anamorphic character, horizontal blue
lens flares, oval bokeh from streetlights.
[Optical Realism]: Wide-latitude cinema capture, moderate-wide anamorphic
character at a wide aperture. Tungsten night-film look with prominent grain and strong red-orange halation
around neon signage and streetlights. Chromatic aberration at frame edges. Deep
natural vignette. Horizontal anamorphic streak flares from point light sources.
Distant end of street dissolves into atmospheric haze with lifted blacks — no
pure black, only deep blue-grey.
[Lighting/Style]: Dramatic rim lighting from behind, neon signs casting teal and
magenta pools on wet pavement. Moody desaturated color grading, cool shadows.
[Technical]: Hyper-detailed wet pavement reflections, rain beading on leather
coat surface, 4K resolution.
```

### Landscape — Epic & Dramatic

```
[Subject]: A majestic misty mountain valley, dramatic clouds catching the last warm light.
[Action]: Static — no figures, no movement. The landscape itself is the subject.
[Environment]: Volumetric god rays piercing through the peaks, mist pooling in the valley
floor, detailed rock faces and alpine vegetation in the foreground.
[Cinematography]: Establishing wide shot. Wide-angle lens at a deep aperture, deep depth
of field. Epic wide composition.
[Lighting/Style]: Golden hour, warm light on the peaks fading to cool blue in the valley
shadows. Ultra-saturated slide-film saturation and contrast, fine film grain. National Geographic
style with fine art sensibility.
[Technical]: Hyper-detailed rock and vegetation textures, vibrant yet natural colors,
8K resolution. Breathtaking beauty.
```

### Gritty Street — Black & White Documentary

```
[Subject]: A weathered man smoking in a doorway, deep lines on his face, rough hands
cupping the cigarette, old wool jacket with visible wear.
[Action]: Leaning against the doorframe, one foot crossed over the other, smoke curling
upward past his squinting eyes.
[Environment]: An old European city street, crumbling plaster walls, cobblestones, a
narrow passage receding behind him.
[Cinematography]: Medium shot, three-quarter angle. Normal-FOV prime at a moderate aperture, moderate
depth of field. Decisive moment composition inspired by Henri Cartier-Bresson.
[Lighting/Style]: Harsh directional side light from frame-right. High contrast black
and white. Gritty high-contrast B&W look, classic film grain, visible texture in shadows. Natural
vignetting at edges.
[Technical]: Raw and timeless, documentary realism, hyper-detailed skin and fabric
textures, 8K resolution.
```

### Fantasy Character — Dramatic Realism

```
[Subject]: A striking warrior queen in ornate dark armor with subtle gold inlay,
cloak catching the wind, determined gaze toward the horizon.
[Action]: Standing tall on the cliff edge, weight forward, one hand resting on a
sheathed sword hilt, chin raised.
[Environment]: A windswept cliff at dawn, jagged rocks, distant army camps visible
as pinpoints of firelight in the valley below, clouds racing overhead.
[Cinematography]: Full shot, low angle. Short-telephoto prime at a wide aperture, shallow depth of field.
Low angle composition emphasizing power.
[Lighting/Style]: Dramatic rim lighting from the rising sun behind, warm gold edging
her silhouette, cool blue ambient on the shadow side. Vivid saturated-negative colors.
Painterly yet photorealistic, in the style of Greg Rutkowski.
[Technical]: Epic atmosphere, exquisite armor and fabric textures, 8K detail,
cinematic masterpiece.
```

### Dreamy / Surreal — Artistic

```
[Subject]: An ethereal woman standing among ancient trees, pale skin luminous against
dark bark, flowing white linen dress with visible weave.
[Action]: One hand resting lightly on a moss-covered trunk, head tilted back slightly,
eyes half-closed, body relaxed and still.
[Environment]: A surreal ancient forest, soft morning mist wrapping through the trees,
shafts of light filtering through the canopy, ferns and moss covering the forest floor.
[Cinematography]: Medium shot. Normal-FOV vintage prime at a wide aperture, swirly vortex bokeh
background, soft focus glow. Subtle chromatic aberration.
[Lighting/Style]: Warm light leaks from frame-left, soft diffused canopy light.
Soft pastel-negative dreamy pastels. Scanned-negative texture.
[Technical]: Painterly yet photorealistic, emotional depth, ethereal beauty,
hyper-detailed moss and bark textures, 8K resolution.
```

---

## APPLYING TO THE PIPELINE

### During Storyboard Image Generation

When writing `nb-prompt.md` files during the storyboard phase (`storyboard.md` Step 7), apply the **Artistic Enrichment Step** to each labeled block:

1. **Identify the shot's dominant emotion** from the storyboard
2. **Look up the emotion** in the Emotion → Color/Mood table above
3. **`[Optical Realism]`** — select capture behavior + lens behavior + film look + grain intensity matching the emotion (no brand names). Add 2-4 physical imperfections from the Imperfection Vocabulary. Add depth-dependent effects. Cross-reference the Optical Realism by Emotion table
4. **`[Lighting/Style]`** — add color grading direction matching the emotion. Film look moves to `[Optical Realism]`
5. **`[Cinematography]`** — add lens behavior (beyond focal length — add rendering character)
6. **`[Technical]`** — add 2–3 quality boosters appropriate to the shot
7. **Check the project style bible** if one exists — apply the mood's fixed parameters across all blocks

### During Standalone NanoBanana Generation

Use the full labeled block structure from the top of this file. Fill each block starting from the script line and the emotion.

### Prompt Length

NanoBanana handles longer prompts well (100–200 words) thanks to its reasoning model. Don't compress to the point of losing artistic direction. NanoBanana Pro handles complex multi-layered scenes better than NB2 — use Pro for final assets, NB2 for iteration.

---

## WHAT THIS FILE DOES NOT DO

1. Does not replace `cinematography.md` — that file owns shot size, angle, movement, and editorial camera language. This file owns color, mood, film stock, lens character, and artistic quality language.
2. Does not replace the storyboard image generation rules in `storyboard.md` — that file owns the `nb-prompt.md` structure and per-shot file format. This file adds the artistic enrichment layer on top.
3. Does not cover Kling prompt structure — see `kling-reference.md` and `animation-prompts.md`.
4. Does not cover Seedance prompt structure — see `seedance-reference.md`.
