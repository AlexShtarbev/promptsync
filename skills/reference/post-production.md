# Post-Production — Dirtying the AI Output

How to add physical camera artifacts and organic texture to AI-generated footage AFTER generation. Companion to the `[Optical Realism]` block in `nanobanana-artistry.md` (which bakes realism into the start frame) and the Organic Camera Vocabulary in `kling-reference.md` (which adds camera imperfection during video generation). This file covers the third layer: post-processing that defeats the residual AI cleanliness.

Read after storyboard images and video clips are generated — during the editing/compositing phase.

---

## WHY POST-PROCESSING MATTERS

Even with `[Optical Realism]` in the start frame and organic camera vocabulary in the video prompt, AI output retains tells:
- **Uniform texture distribution** — grain intensity is the same across all depth zones
- **Perfect highlight clipping** — digital hard-clip instead of film's logarithmic shoulder
- **Missing halation** — highlights don't scatter through emulsion layers
- **Absent light wrap** — foreground edges cut too cleanly against bright backgrounds
- **Symmetrical noise** — AI noise patterns repeat; real sensor noise is stochastic

Post-production adds the final layer of physical reality that generation models cannot yet produce natively.

---

## THE DIRTYING PIPELINE

Apply in order. Each step builds on the previous — skipping steps degrades the cumulative effect.

### Step 1 — Reduce Synthetic Sharpness

AI output is often hyper-sharp across the entire frame. Real footage has depth-dependent sharpness — sharp at the focal plane, softening everywhere else.

**Tools:**
- **DaVinci Resolve:** Blur → Gaussian Blur on a node, masked to background zones using a depth matte (generate via Depth Anything V2 or similar)
- **Color.io:** Film Resolution slider — reduces high-frequency detail that makes images feel 3D-rendered

Apply to the background only. Leave the focal-plane subject untouched.

### Step 2 — Add Depth-Dependent Film Grain

The most important single step. Film grain is NOT uniform noise — it varies with brightness, color, and distance from the camera. A flat grain overlay is better than nothing, but physically simulated grain is dramatically better.

**Tools (ranked by quality):**

| Tool | Grain Type | Quality | Cost |
|---|---|---|---|
| **Dehancer** (DaVinci Resolve / After Effects / Premiere) | Physically simulated — granules respond to brightness and color per film profile. 60+ film profiles. 8mm, 16mm, 35mm, 65mm formats | Best — grain interacts with the image the way real emulsion does | $99-199/year |
| **Color.io** | Pixel-by-pixel re-rendering through a grain matrix, like a Bayer pattern on real film | Excellent — not an overlay, a re-render | Free tier + paid |
| **ComfyUI-Optical-Realism** | Depth-aware grain — uses depth map to vary grain intensity with distance from camera | Excellent for images — requires ComfyUI pipeline | Free (open source) |
| **Topaz Video AI** — Grain filter | Gaussian grain with size control | Good — amount ~10, size 3 for visible filmic grain; amount 5, size 2 for subtle | $199 one-time |
| **DaVinci Resolve** — built-in Film Grain | Basic grain generator with intensity/size controls | Adequate | Included (free version) |
| **Overlay compositing** | Pre-made grain scan footage composited over the timeline | Adequate — static pattern, no image interaction | Various (free to $50) |

**Dehancer recommended settings (starting point):**
- Film profile: match the project's `[Optical Realism]` film look
- Grain intensity: 40-60% (subtle) or 70-90% (prominent — noir, documentary)
- Format: 35mm for standard, 16mm for grittier look

### Step 3 — Add Halation and Bloom

Halation (red-orange glow around highlights from light scattering in film emulsion) and bloom (soft glow around bright sources) are the artifacts most responsible for "filmic warmth." Their absence is one of the biggest AI tells.

**Tools:**
- **Dehancer:** Halation module — red-orange halo around light sources and contrasting edges. Makes skin tones more vivid as a side effect. Bloom module — soft glow with format-specific profiles
- **Color.io:** Halation toggle — subtle glow/bloom around highlights and skin
- **DaVinci Resolve:** Glow effect in the Effects library — apply on a separate node, blend with Screen or Add mode

**Where halation matters most:** Night scenes, any shot with practical light sources against dark backgrounds, tungsten/warm lighting, candle/firelight scenes.

### Step 4 — Apply Highlight Roll-Off (Lifted Blacks + Shoulder)

AI images clip highlights to hard white and crush shadows to pure black. Real film compresses both ends logarithmically — the "shoulder" on highlights and "toe" on shadows.

**Tools:**
- **ComfyUI-Optical-Realism:** `Lift Blacks` parameter — lifts distant shadows to atmospheric grey-blue. `Highlight Roll-off` — adds logarithmic shoulder to prevent harsh white clipping. These two parameters alone transform the tonal feel
- **DaVinci Resolve:** Lift/Gamma/Gain wheels — raise the Lift (shadows) slightly toward blue. Pull highlights down gently. Apply a soft S-curve with flattened endpoints
- **LUT application:** Film emulation LUTs (Kodak Vision 3, Portra 400, Cinestill 800T) inherently encode these curves

### Step 5 — Add Light Wrap and Pro-Mist Diffusion

Light wrap (bright background bleeding over foreground edges) and Pro-Mist diffusion (gentle bloom that softens the "digital edge") kill the "cutout sticker" look that plagues AI composites.

**Tools:**
- **ComfyUI-Optical-Realism:** `Pro-Mist Strength` — simulates Tiffen Black Pro-Mist diffusion filter. Creates gentle warm bloom, removes the digital edge from sharp lines. `Light Wrap Strength` — bleeds bright background light over foreground edges
- **After Effects / DaVinci Resolve:** Light wrap via channel extraction — extract the bright background, blur it, and composite over the foreground edges using Screen blend mode at low opacity

### Step 6 — Color Grade with Film Emulation

Apply the project's color grade using film emulation presets rather than manual curves. Film emulation encodes the entire response curve (toe, linear, shoulder) plus color science of the target stock.

**Tools:**
- **Dehancer:** 60+ film profiles, per-scene grading
- **Color.io:** Kodak Vision 3, Portra 400, Cinestill 800T presets with halation integration
- **DaVinci Resolve:** PowerGrade presets, LUT application, per-node film looks
- **LUTs:** Apply as the final node — after grain, after halation, after lift

**Consistency:** Batch-apply the same grade across all shots in the project. Per-shot grading destroys the visual unity that `[Optical Realism]` established.

---

## SOUND DESIGN AS REALISM MULTIPLIER

Sound covers 50% of perceived realism. An AI video with visible motion artifacts but excellent audio gets forgiven. An AI video with perfect visuals but silence or stock music reads as fake.

### High-Impact Audio Layers

| Layer | Effect on Realism | Source |
|---|---|---|
| **Room tone** | Eliminates the "dead silence" AI tell — every real space has ambient sound | Record or source per-environment |
| **Foley** — contact sounds (footsteps, fabric rustle, object placement) | Grounds characters in physical space — weight and material | ElevenLabs SFX or library |
| **Impact sounds** (thuds, cracks, splashes) | Sells physics that the video may not perfectly render | Timed to video — slight asynchrony breaks immersion |
| **Environmental ambience** (wind, rain, traffic, birds) | Expands the world beyond the frame edge | Continuous bed under all other layers |
| **Breath and vocal effort** | Sells physical exertion, emotion, presence | ElevenLabs or recorded |

### The Forgiveness Principle

When an AI video generation has minor visual artifacts (slightly wrong hand, subtle physics break), audio can COVER the defect:
- **A car drifting with slightly wrong tire physics** → massive screeching tire audio + engine roar = viewer's brain forgives the visual
- **A hand placing an object with slight float** → sharp ceramic-on-stone contact sound at the exact moment of visual "contact" = viewer perceives solid placement
- **A face with subtle uncanny expression** → a breath or vocal effort sound grounds the character as living

Sound is the cheapest fix for the most expensive visual problems.

---

## UPSCALING

AI generations are often 720p-1080p. For delivery at 4K:

**Tools:**
- **Topaz Video AI:** The industry standard for AI video upscaling. Curious Refuge recommends it for converting AI footage to 4K delivery
- **DaVinci Resolve:** Super Scale (Studio version) — real-time upscaling in the timeline

**Apply grain AFTER upscaling.** Upscaling algorithms smooth the image further — grain added before upscaling gets dissolved. Add grain as the final post-processing step.

---

## PIPELINE POSITION

Post-production happens after all generations are complete and before final assembly:

```
Step 9b: Storyboard → NanoBanana images generated
Step 9d: Animation Prompts → Kling/Seedance video clips generated
  ↓
POST-PRODUCTION (this file):
  1. Upscale to delivery resolution
  2. Reduce synthetic sharpness (depth-dependent)
  3. Add film grain (physically simulated, depth-aware)
  4. Add halation and bloom
  5. Apply highlight roll-off (lift blacks, shoulder)
  6. Add light wrap and Pro-Mist diffusion
  7. Color grade with film emulation
  8. Sound design and foley
  ↓
Final assembly and export
```

---

## WHAT THIS FILE DOES NOT DO

1. Does not replace `[Optical Realism]` in the start frame — that block bakes realism cues INTO the generation. This file adds what generation can't produce
2. Does not specify editing rhythm or shot assembly — see `reference/video-dramaturgy.md`
3. Does not cover music composition — see `suno.md` in the project directory
4. Does not cover voiceover production — see `voice-design.md` and `elevenlabs.md`
