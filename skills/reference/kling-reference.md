# Kling Reference — Capabilities, Limits, and Prompt Patterns

## Multi-Shot Mode Strategy (Kling 3.0)

Multi-shot mode generates seamless transitions between shots and maintains character consistency within a single generation. Use it when narrative continuity across 3–6 shots matters more than per-shot compositional control.

**The default pipeline is I2V** — each shot gets a NanoBanana storyboard image (`nb-prompt.md`) that serves as both a visual storyboard cell for the PromptSync dashboard and the Kling I2V start frame. Multi-shot T2V is an alternative mode for continuous arcs where internal transitions matter more than per-shot framing precision.

### When to Use Multi-Shot (T2V)

- **Continuous emotional arcs:** Branch drop → sinking → kneeling → doubt close-up (all one generation)
- **Dialogue scenes:** Shem speaks → Noah answers → environment beat (character switches, same setting)
- **Character persistence across shots:** Same character's identity locked across 3-6 shots
- **Scene spanning:** Shots that tell one story even if the camera moves or characters change

### How to Structure Multi-Shot Batches

- Group 3-6 shots that tell one narrative arc
- Each shot gets its own prompt within the batch
- Total duration: 1-12 seconds per shot, max 15 seconds for the entire batch
- Kling handles transitions automatically — no jarring cuts
- Use this ONLY when narrative continuity matters; split into separate generations if shots are unrelated

### Element Limits Force Natural Narrative Breaks

- Max 3 Elements per generation
- If a scene needs 4+ Elements, split at the story break
- **Example:** Scene with Shem + Noah + Ark (Gen 1) → Noah + Dove + Ark (Gen 2)
- The split happens exactly where the dove arrives in the story — no awkward breaks

### NanoBanana Start Frames in Multi-Shot Mode

- Every shot still gets an `nb-prompt.md` during the storyboard phase — these are required for the PromptSync dashboard regardless of generation mode
- In multi-shot T2V, the NanoBanana images serve as visual storyboard reference, not as start frames — Kling handles internal transitions
- If a multi-shot generation fails, the NanoBanana image becomes the I2V fallback for re-generating individual shots
- HIGH RISK shots that need precise compositional control should use I2V with the NanoBanana start frame instead of multi-shot T2V

## Aesthetic Reliability

Kling 3.0's architecture is trained primarily on cinematic footage. Visual styles that align with this training render more reliably — physics, lighting, motion, and consistency all degrade as the aesthetic moves further from photorealism.

| Tier | Style | Reliability | Notes |
|------|-------|-------------|-------|
| 1 | **Photorealistic cinematic** | Highest | Best physics, lighting, motion, consistency. Default for production. |
| 1 | **Golden hour / moody cinematic** | Highest | Subset of photorealistic — warm light + god rays + rim light are in Kling's strongest zone. |
| 2 | **Subtle handheld / documentary** | High | Slight organic camera shake adds life. Keep subtle — intense shake compounds with motion risk. |
| 3 | **Stylized realism** (period, fantasy, sci-fi) | Good | Works well with strong style anchors. The further from "real camera footage" the look gets, the more Kling struggles with consistency. |
| 4 | **Anime / cel-shaded** | Moderate | Character consistency is decent, but physics and motion feel less grounded. |
| 5 | **Highly stylized** (Wes Anderson, cyberpunk, surreal) | Variable | Requires very specific prompting. Physics interaction often breaks — objects feel weightless, lighting flattens. |

The project's aesthetic should be driven by the story's emotional requirements (emotion → style anchors → palette), not by platform trends. But when choosing *how* to execute a mood, prefer the higher-reliability tier that achieves the same emotional effect.

### Style Family Success Rates [community-tested]

| Style Family | First-Take Success | Reroll Budget |
|-------------|-------------------|---------------|
| Photorealistic | ~75% | Standard |
| Cinematic film grades | ~65% | 1.5x standard |
| Retro / analog | ~55-65% | 1.5x standard |
| Painterly / illustrated | ~50-60% | 2x standard |
| Anime / stylized 2D | ~40-50% | 2-3x standard |

Factor these rates into production planning. An anime-styled project burns 2-3x the credits of photorealistic for the same shot count.

---

## V3 (3.0) vs O3 — Model Selection per Shot

Kling 3.0 ("V3") and Kling O3 are distinct models. The skill should select the right model per shot based on the shot's demands.

| Signal | Use V3 (3.0) | Use O3 |
|--------|-------------|--------|
| Hero cinematic / peak photorealism | **Yes** — superior fabric, hair, water, skin pores | No |
| Close-up product / texture detail | **Yes** — best metal, glass, skin rendering | No |
| Color-critical / HDR priority | **Yes** | No |
| Fast action sequences | No — 2/6 shots may artifact | **Yes** — fewer motion artifacts |
| Complex multi-instruction prompts | No — may drop camera under complexity | **Yes** — CoT planning handles all instructions |
| Rapid iteration / exploration | No | **Yes** — ~2x faster generation |
| Abstract / experimental creative | No — V3 pushes toward cinematic | **Yes** — more flexible aesthetic |
| Video-to-video editing | No — not available | **Yes** |
| Budget-conscious volume | **Yes** — ~25% cheaper | No |

**Hybrid workflow:** Use O3 to find the right prompt and composition (fast iterations), then switch to V3 for the final hero render. O3 produces 3-4 variations in the time V3 produces 2.

**Default:** V3 for all shots unless the shot matches an O3-specific advantage above. The NanoBanana → Element → Kling I2V pipeline is optimized for V3.

---

## What Kling Handles Well

| Category | Examples | Notes |
|----------|----------|-------|
| Environmental motion | Rain, fog, fire, smoke, ash, snow, embers, water ripples, wind in trees, clouds | Particle effects and atmospheric motion are Kling's strongest suit |
| Slow character motion | Walking, turning, slow head turn, standing up, sitting down, kneeling | One deliberate motion at a time |
| Emotional close-ups | Expression shifts, tears, blinking, gaze shifts, jaw tightening | Micro-expressions with the right prompt language land well |
| Hair and cloth physics | Hair blowing, cloaks, scarves, flags, fabric in wind | Natural secondary motion |
| Camera moves | Slow push-in, slow pull-back, slow dolly, static, slow zoom | Kling responds well to cinematography vocabulary |
| Lighting effects | Rim light, underlight, backlight, firelight flicker, moonlight shafts | Named light sources give better results |
| Silhouettes | Backlit figures, shadow play, figures against bright backgrounds | Hides detail issues, looks inherently cinematic |
| Scale reveals | Camera pulling back to show something large, pushing in to show something small | Slow reveals are reliable and high-impact |
| Atmospheric environments | Fog-filled forests, burning villages, rainy streets, snowy landscapes | Environmental atmosphere with no character is nearly always successful |

## What Kling Handles Poorly

| Category | What Goes Wrong | Severity |
|----------|----------------|----------|
| Fight choreography | Limbs warp, physics break, timing is off, body proportions distort | Critical — avoid entirely |
| Running / fast movement | Legs blur, body stretches, proportions shift mid-stride | Critical — replace with walking or aftermath |
| Multi-character interaction | Characters merge, phase through each other, limbs entangle | Critical — generate separately, composite in editor |
| Hand gestures / finger detail | Extra fingers, fused fingers, impossible hand positions | High — **anchor hands to objects** ("fingers wrapped around railing" not "hands at sides"). Fallback: silhouette, mid-action starts, or hide hands |
| Lip sync (pre-3.0) | Mouths don't track, jaw moves randomly, uncanny valley | High — use text cards or VO over non-speaking visuals |
| Lip sync (3.0 Omni) | Standard tier still artifacts on scrutiny; Master tier works for close-ups with simple dialogue | Medium — match tier to framing (Standard=wide, Pro=medium, Master=close-up). See Lip-Sync Tier Selection. |
| Rapid camera movement | Warping, smearing, artifacts, loss of spatial coherence | High — keep all camera moves slow and deliberate |
| Complex physics chains | Impact→reaction sequences don't maintain causality | High — split cause and effect into separate clips |
| Crowd scenes | Individuals merge, faces duplicate, bodies overlap | High — imply crowds through environmental storytelling |
| Structural destruction | Buildings collapse unrealistically, debris floats, physics breaks | Medium-High — show aftermath, not the collapse itself |
| Object manipulation | Picking up, putting down, passing between hands | Medium-High — start mid-action with object already in hand |
| Relative scale and depth ordering | Multiple elements at different depths default to "everything together" — wrong proportions, floating objects, wrong layer order | High — use explicit depth labels and body-relative size language (see Spatial Scale section) |

## Spatial Scale and Depth Ordering

Kling defaults to "everything kinda together" unless the 3D stage layout is forced explicitly. Scale, depth, and camera direction must all be stated — Kling will not infer them.

### Depth Labels in [Context]

For shots with multiple elements at different depths, use `foreground:` / `midground:` / `background:` sub-labels inside `[Context]`:

```
[Context]:
foreground: @Arthur 's extended arm and hand, closest to camera
midground: @Stone — a mossy rock reaching only to @Arthur 's knee — at end of reach. @Sword hilt protrudes vertically from @Stone 's flat top.
background: blurred forest clearing, soft natural light
```

### Body-Relative Size Language

Never rely on Kling to guess scale. Always state sizes relative to the human figure:

| Vague | Explicit |
|-------|----------|
| "small rock" | "rock reaching only to @Arthur 's knee" |
| "large sword" | "@Sword blade as long as @Arthur 's forearm" |
| "nearby" | "arm's length from @Arthur" |
| "waist-high" | "rock that reaches @Arthur 's waist" |

### Contact Physics

Describe the physical contact point explicitly for any interaction. Kling floats objects or clips limbs through them otherwise:

```
fingers wrapped around @Sword hilt, knuckles visible
@Sword blade still embedded in @Stone , only hilt and top quarter of blade above surface
palm hovering 10cm above @Sword hilt, not touching
both hands gripping @Sword hilt, thumbs overlapping at crossguard
```

### Spatial Negative Prompts

Add these when generating shots with multiple elements at different depths:
```
wrong proportions, giant rock, sword floating, arm in wrong layer, distorted perspective, mismatched scale
```

---

## Dynamic Physics — Prompting Realistic Motion and Interaction

Kling 3.0 has improved physics simulation (depth estimation, Newtonian mechanics, gravity/inertia/collision), but it still interprets physics from text — it's not running a physics engine. Explicit, specific physics language in prompts activates much better simulation than vague verbs. "Falls" → mediocre. "Falls in a natural parabolic arc with proper weight and rotation, bounces once with realistic impact and slight rebound, then settles" → reliable.

### Physics Prompt Structure

For any shot involving physical interaction, forces, or motion through space, structure the prompt to foreground the physics:

```
[Camera/Shot] + [Environment & Spatial Layout with surface properties]
+ [Subject(s) with explicit size/proportions/position]
+ [Action with explicit physics: force, gravity, friction, momentum]
+ [Lighting/Style]
```

The existing `[Cinematography] + [Subject] + [Action] + [Context] + [Style]` template still applies — physics language goes primarily in `[Action]` and `[Context]`.

### Dynamic Physics Vocabulary

Use these terms in `[Action]` blocks. Kling responds to explicit physics verbs and descriptors — the more specific the force description, the more believable the result.

#### Force & Gravity

| Vague (avoid) | Explicit (use) |
|---------------|----------------|
| "falls" | "falls in a natural parabolic arc respecting center of mass" |
| "drops" | "drops with realistic gravity, accelerating as it descends" |
| "tips over" | "reaches unstable equilibrium, tips over, falling with natural weight and momentum" |
| "goes uphill" | "moves slowly uphill against gravity with heavy resistance" |
| "rolls down" | "rolls downhill with accelerating speed due to gravity, rotating heavily" |
| "heavy" | "visible weight — impacts land with a thud, surfaces depress slightly" |
| "pushes" | "applies continuous force, leaning full body weight into the object" |

#### Momentum & Inertia

| Term | When to use | Example |
|------|-------------|---------|
| `realistic momentum` | Object in motion maintains speed/direction | "boulder gains momentum rolling downhill" |
| `natural inertia` | Resistance to starting/stopping motion | "heavy crate resists the initial push, then moves with building inertia" |
| `weight transfer` | Force shifting through a body | "weight transfers from back foot to front foot as he pushes" |
| `center of mass` | How an object tips/rotates | "tips around its center of mass, toppling forward" |
| `deceleration` | Slowing naturally | "slides forward, decelerating due to friction, coming to rest" |
| `conservation of energy` | Transfer between objects | "impact transfers force, sending the smaller object sliding" |

#### Friction & Surface Interaction

| Term | When to use | Example |
|------|-------------|---------|
| `realistic friction` | General surface resistance | "feet grip the rough stone with visible traction" |
| `slipping on [surface]` | Loss of traction | "feet slipping backward on loose gravel despite digging in" |
| `scraping` | Dragging contact | "boulder scraping against rocky slope, grinding contact" |
| `poor traction` | Unreliable footing | "loose gravelly slope with poor traction" |
| `rolling friction` | Round objects on surfaces | "barrel rolls forward with natural resistance on wood planks" |
| `static friction` | Object resisting initial movement | "object resists initial push, then breaks free" |

#### Collision & Impact

| Term | When to use | Example |
|------|-------------|---------|
| `realistic impact` | Any collision | "lands with heavy thud, realistic impact" |
| `slight rebound/bounce` | Post-collision behavior | "bounces once with slight rebound, then settles" |
| `debris on impact` | Environmental reaction | "kicking up dust and small stones on every bounce" |
| `surface deformation` | Heavy impacts | "dents the surface slightly on impact" |
| `sound-implying impact` | When audio matters | "lands with force that implies a heavy thud" |
| `chain reaction` | Caution — split into separate clips | "impact sends nearby objects shifting — keep each reaction in its own shot" |

### Body Mechanics Under Load

When a character is pushing, pulling, lifting, carrying, or struggling with physical effort, describe the **biomechanics** explicitly. Kling uses these cues to animate realistic strain, not just "moving near an object."

#### Pushing (uphill, against resistance)

```
Leans full body weight forward, shoulder pressed firmly against the surface.
Feet dig into the ground with strong heel strikes, weight transferring from
back foot to front. Small laborious steps, muscles straining visibly.
```

Key terms: `leans into`, `shoulder pressing`, `feet digging in`, `heel strikes and weight transfer`, `muscles straining`, `laborious steps`, `leveraging body weight`

#### Pulling / Dragging

```
Grips the rope with both hands, leans backward with full body weight,
heels planted. Arms taut, back arched, each step a deliberate backward
pull with visible effort and strain.
```

Key terms: `heels planted`, `leans backward`, `arms taut`, `deliberate pull`, `whole body engaged`

#### Lifting

```
Bends knees, grips the object at its base, drives upward from the legs.
Object rises with visible weight — arms shaking slightly, back straight,
slow controlled ascent.
```

Key terms: `drives from the legs`, `arms shaking`, `slow controlled ascent`, `visible weight`

#### Carrying (heavy)

```
Staggers forward under the weight, center of gravity shifted,
each step deliberate and heavy, arms wrapped around the object
pressing it against the chest.
```

Key terms: `staggers`, `center of gravity shifted`, `deliberate heavy steps`, `pressing against chest`

#### Struggle / Fatigue Cues

Add these to sell physical effort:
- `muscles straining visibly` — visible tension in arms, shoulders, neck
- `sweat dripping` / `sweat beading on forehead` — physical exertion marker
- `heavy breathing visible in chest and shoulders` — pairs with breathing micro-motion
- `small steps with readjusting grip` — suggests near-failure
- `knees buckling slightly` — approaching exhaustion
- `trembling arms` — maximum effort
- `gritted teeth, jaw clenched` — combines with expression control

### Terrain & Surface Interaction

For scenes on slopes, uneven ground, or specific surfaces, describe the terrain properties explicitly. Kling defaults to flat ground unless told otherwise.

#### Slope / Incline

| Element | How to describe |
|---------|-----------------|
| Steepness | Specify in degrees: "steep 35-degree slope", "gentle 15-degree incline", "near-vertical 60-degree cliff face" |
| Surface type | "loose gravel and boulders", "smooth wet stone", "crumbling dirt", "solid bedrock" |
| Traction | "poor traction — feet slip backward on loose material", "good grip on rough dry stone" |
| Uphill body position | "body leaned forward at the angle of the slope", "center of gravity low and forward" |
| Downhill body position | "braking with heel-first steps", "leaning back against the slope's pull" |
| Object on slope | "boulder resting at equilibrium on the slope, gravity pulling it downward along the incline" |

#### Surface Properties (general)

| Surface | Physics cues to include |
|---------|------------------------|
| Ice / wet stone | "slick surface, feet sliding, minimal traction, careful balance" |
| Sand / gravel | "feet sinking slightly, loose material shifting, poor traction" |
| Mud | "viscous surface, feet pulling free with effort, suction" |
| Metal / concrete | "hard surface, sharp impact sounds, no give, firm footing" |
| Wood planks | "slight flex, hollow resonance, visible wood grain and wear" |

### Physics Negative Prompts

Categorized by failure type. These are **vocabularies to pick from, not templates to paste wholesale** — select 5-8 terms relevant to the specific shot's failure risks. Combining all blocks would yield 50+ terms and degrade output quality (see Negative Prompts in Elements Workflow).

#### Base Physics Block (pick 5-8 terms relevant to the shot)

```
floating objects, weightless, low gravity, sliding feet, gliding motion,
inconsistent physics, unrealistic momentum, wrong center of mass, distorted scale,
bad depth, incorrect parallax, objects clipping through surfaces
```

#### Core Gravity & Force Failures

```
floating, levitating, weightless motion, low gravity, anti-gravity, objects defying gravity,
incorrect weight, unrealistic momentum, bad inertia, wrong center of mass,
unnatural tipping, delayed gravity, slow motion fall without intent
```

#### Foot & Ground Contact Failures

```
sliding feet, moonwalk, gliding walk, skating motion, missing foot contact, floating steps,
stiff legs, robotic movement, distorted gait, heel not striking first,
poor weight shift, feet not planted
```

#### Friction & Collision Failures

```
sliding instead of rolling, frictionless surface, excessive slip, rubbery objects,
jelly-like, bouncy without reason, overly soft bodies, plastic deformation,
bad collisions, objects passing through each other, missing impact reaction,
weak impacts, unrealistic bounce, missing dust on impact
```

#### Scale & Spatial Consistency Failures

```
distorted proportions, morphing size, objects changing scale, inconsistent relative size,
bad perspective, incorrect foreshortening, wrong depth cues, inconsistent parallax,
objects not diminishing correctly with distance, wrong occlusion,
warped space, distorted environment geometry, background shifting unnaturally
```

#### Slope / Incline Specific

```
floating boulder, weightless rock, gliding boulder, sliding without rotation,
man sliding feet on slope, effortless push, boulder passing through ground,
bad depth on slope, warped incline, missing dust on impact, unrealistic bounce
```

### Physics Prompt Examples

#### Object Falling with Realistic Impact

```
[Cinematography]: Static camera, medium shot, eye level. Shot on ARRI Alexa.
[Subject]: A heavy metal hammer (2kg) on the edge of a wooden workbench.
[Action]: The hammer slides off the edge due to gravity, falls in a natural
parabolic arc with proper weight and rotation, bounces once on the concrete
floor with realistic impact and slight rebound, then settles. Dust puffs on impact.
[Context]: Sunlit workshop, 2-meter wooden ladder leaning against left wall,
tools scattered on workbench surface. Accurate perspective — objects maintain
consistent proportions with distance.
[Style & Ambiance]: Photorealistic. Natural lighting. Detailed wood grain
and metal textures. Accurate shadows.
[MOTION SCALE: 0.6]
Negative prompt: floating objects, weightless, delayed gravity, unrealistic bounce,
missing impact debris, objects clipping through floor, sliding without rotation.
```

#### Character Pushing Heavy Object Uphill (Sisyphus pattern)

```
[Cinematography]: Side tracking shot, eye level, slow dolly following the action.
[Subject]: @Sisyphus — full body visible, straining with maximum effort.
[Action]: Pushes a massive granite boulder (3 meters wide) up a steep 35-degree
rocky slope. Leans full body weight forward, shoulder pressed against the rock,
feet digging into loose gravel with heel strikes and weight transfer. Muscles
straining visibly, small laborious steps. Boulder slowly rolls uphill against
gravity with realistic resistance, occasional slips on gravel.
[Context]:
foreground: loose rocks and dust kicked up by @Sisyphus 's feet
midground: @Sisyphus and boulder, locked in struggle on the incline
background: steep grey mountain continuing upward, no summit visible
[Style & Ambiance]: Photorealistic cinematic. Cold desaturated grey. Harsh
directional side light. Volumetric dust.
[MOTION SCALE: 0.5]
Negative prompt: floating boulder, weightless, effortless push, sliding feet,
moonwalk on slope, missing dust and debris, bad depth on incline, warped slope.
```

#### Boulder Rolling Downhill (gravity-driven acceleration)

```
[Cinematography]: High angle tracking shot, following the boulder's descent.
[Subject]: Massive granite boulder, 3 meters wide.
[Action]: Boulder tips over the crest and begins rolling back down the steep
rocky slope. Accelerates due to gravity, rotating heavily, bouncing and scraping
on rocky terrain, kicking up dust and small stones with each impact. Natural
momentum builds — each bounce sends debris further. Reaches the base with
terrifying speed.
[Context]:
foreground: dust and debris spraying from boulder impacts
midground: boulder tumbling down the slope with chaotic rotation
background: the slope stretching up to the crest above
[Style & Ambiance]: Photorealistic cinematic. Harsh overhead sun, deep
cast shadows. Impact dust catching backlit rim light.
[MOTION SCALE: 0.7]
Negative prompt: floating rock, sliding without rotation, frictionless surface,
unrealistic bounce, missing debris, delayed gravity, weightless, smooth rolling
without terrain interaction.
```

---

## Motion Scale Guide

Use `[MOTION SCALE: X]` in the prompt to explicitly set motion intensity. Placement is flexible — end of prompt, inside `[Style & Ambiance]`, or inline in `[Action]` all work. Values run from `0.1` (near-stillness) to `1.0` (maximum intensity). Without it, Kling defaults to medium. Always set this explicitly for predictable results.

```
[MOTION SCALE: 0.3]   → near-stillness, micro-expressions, atmospheric holds
[MOTION SCALE: 0.5]   → controlled action — single deliberate motion
[MOTION SCALE: 0.7]   → dynamic action — one forceful burst
[MOTION SCALE: 1.0]   → full chaos — environmental only, no characters
```

### Low — `[MOTION SCALE: 0.2–0.4]`
Best for: emotional close-ups, stillness, subtle expression shifts, atmospheric holds, eyes opening, slow breathing, static scenes with environmental motion only.

Prompt indicators: `blinks slowly`, `gaze shifts`, `still and silent`, `expression changes subtly`, `wind moves hair`.

Use when: the power is in stillness and the visual composition carries the scene.

### Medium (default) — `[MOTION SCALE: 0.5]`
Best for: walking, slow turns, single gestures, head turns, kneeling, standing up, one deliberate action.

Prompt indicators: `walks forward slowly`, `turns to face camera`, `reaches out one hand`, `steps through doorway`.

Use when: the character needs to do one clear thing.

### Medium-High — `[MOTION SCALE: 0.6–0.7]`
Best for: fire eruptions, environmental destruction (pre-generated, not physics-chain), strong wind effects, a single forceful action.

Prompt indicators: `flames erupt outward`, `throws arms wide`, `slams fist down`, `collapses to knees`.

Use when: the scene needs energy but contains only one burst of action. Keep the clip short (3s standalone, or 1.5–2.5s within multi-shot).

### High — `[MOTION SCALE: 0.8–1.0]`
**Rarely use.** Introduces drift, instability, and artifact generation. Only consider for pure environmental chaos (firestorm, ocean waves, blizzard) with NO characters in frame.

## Camera Vocabulary

Use these exact terms — Kling responds to cinematography language. For which movement to use per emotion, see `reference/cinematography.md` → Emotion → Camera Language.

> **Behavioral over brand:** When describing camera/lens/stock in prompts, prefer behavioral descriptions over brand names. The model renders behavior, not gear — "wide-latitude cinema capture, vintage 75mm anamorphic at wide aperture, oval bokeh" produces the same look as "ARRI Alexa 35, Panavision 75mm" with less noise for the model to translate. See the Behavioral Camera Language Reference table in `animation-prompts.md` → Camera Rig Definitions for the full mapping.

### Basic Movements

| Term | Effect |
|------|--------|
| `static camera` | No camera movement — locked off |
| `slow push-in` | Camera moves toward subject slowly |
| `slow pull-back` | Camera moves away from subject slowly |
| `dolly` | Camera moves laterally on a track |
| `slow dolly` | Lateral move, slow speed |
| `pan` | Camera rotates horizontally on axis |
| `tilt` | Camera rotates vertically on axis |
| `tracking shot` | Camera follows a moving subject |
| `low angle` | Camera below subject, looking up |
| `high angle` | Camera above subject, looking down |
| `eye level` | Camera at subject's eye height |
| `extreme close-up` | Fills frame with a small detail (eyes, hands) |
| `close-up` | Head and shoulders |
| `medium shot` | Waist up |
| `wide shot` | Full body with environment |
| `establishing shot` | Wide environment, setting the scene |

### Organic Camera Vocabulary — Breaking the Locked-Off Look

AI video defaults to unnaturally stable, perfectly smooth camera movement. Real footage has operator presence — breathing, micro-adjustments, subtle weight shifts. These terms inject organic imperfection into camera behavior. Use ONE per shot alongside the primary movement.

| Term | Effect | Realism Signal |
|------|--------|---------------|
| `handheld drift` | Subtle natural sway as if held by an operator | "You are here, this is real" — 78% of top TikTok ads use handheld over tripod (Tubular Labs) |
| `breathing camera` | Slight rhythmic rise and fall matching a human breathing cycle | Adds life to static holds — the camera is alive, not a robot |
| `operator micro-adjustments` | Tiny reframing corrections mid-shot | Implies a human behind the camera making real-time decisions |
| `shoulder-rig sway` | Gentle lateral oscillation from a shoulder-mounted camera | Documentary intimacy, run-and-gun energy |
| `imperfect tracking` | Tracking that almost keeps up with the subject, slight lag | Real camera operators don't track perfectly — the imperfection sells the footage |
| `settling camera` | Camera finds its frame after a cut — slight overshoot then locks | Simulates the first second after a camera operator arrives at the new framing |

**Usage:** Append one organic term to any primary movement. "Slow dolly in with subtle handheld drift." "Static frame with breathing camera." "Tracking shot with imperfect tracking lag." Do not combine multiple organic terms — one is sufficient. Two creates conflicting instability signals.

**When NOT to use:** Character reference sheets, product hero shots where geometry must be perfect, any shot where facial expression change is the primary action (organic camera motion during expression shifts compounds failure modes).

### Advanced Movements

| Term | Effect |
|------|--------|
| `crane shot` | Camera rises or descends vertically (dramatic reveals) |
| `handheld` | Intentional camera instability — tension, urgency, realism. **Use subtle/slight only.** Intense shake during high-motion or physics-heavy shots compounds failure modes — Kling interprets "shake" as frame-wide instability, not camera-operator response. For chaotic scenes, keep camera stable and let the action provide the energy. |
| `rack focus` | Selective focus shift from foreground to background (or reverse) — e.g., `rack focus from rain on glass to figure outside` |
| `whip-pan` | Rapid horizontal rotation — used for transitions or disorientation |
| `orbit` | Circular camera path around subject — `slow 180-degree orbit`, `360-degree orbit` |
| `snap zoom` | Sudden fast zoom into subject — impact, shock |
| `dolly zoom (Vertigo shot)` | Subject stays same size, background perspective distorts — dread, disorientation |
| `FPV drone` | First-person drone flying through environment — fast, immersive, adrenaline |
| `aerial top-down` | Straight down from above — abstract, scale reveal |
| `bullet-time orbit` | Camera orbits while subject is frozen / in slow motion — debris suspended, aura flows at normal speed |
| `speed ramp` | Camera-synchronized temporal shift — action starts normal speed, slows mid-motion, snaps back — `Upon takeoff transitions into extreme slow-motion, snaps back to normal on landing` |
| `ground level` | Camera only inches above surface — amplifies size and power of subject |
| `parallax tracking` | Sideways tracking with strong depth layering — foreground elements pass faster than background, enhancing 3D feel and spatial awareness |

### Movement Speed Specification

Always specify camera speed explicitly — Kling defaults to a medium pace that may not match your intent.

| Speed Term | Effect | When to Use |
|------------|--------|-------------|
| `slow steady` | Even, controlled pace | Emotional scenes, establishing, contemplation |
| `gradual` | Starting slow, building smoothly | Reveals, building tension |
| `dramatic acceleration` | Speed increases noticeably | Following a falling object, urgency building |
| `slow over [X] seconds` | Timed to clip duration | When speed must sync with action timing |
| `speed ramp — normal to slow to normal` | Temporal shift mid-shot | Peak-of-action emphasis |

Prompt example: `"Slow steady crane up over 6 seconds"`, `"Tracking shot with gradual acceleration matching the boulder's descent"`

### Combining Camera Instructions

**Hard rule: one camera move per clip.** Two camera moves in one clip costs 1.8 extra rerolls on average. Split complex camera sequences across multi-shot mode or separate generations.

Use **one primary movement** per shot. Combine with framing and angle:
```
Low angle, static camera, extreme close-up on lips and eyes
Wide shot, slow dolly left to right, eye level
Ground level tracking shot, smooth backward movement to keep subject centered
Slow 180-degree orbit while debris suspends in slow motion
```

**Caution:** Requesting multiple simultaneous camera transformations (e.g., "360-degree rotation while zooming and moving laterally") causes geometric distortion and morphing artifacts.

**Exception — safe compound movements:** Some combinations of a primary movement + a secondary adjustment work reliably in Kling because they describe a single coherent camera intention rather than two conflicting ones:

| Compound | Why It Works | Example |
|----------|-------------|---------|
| Crane up + slight tilt down | Camera rises but keeps subject in frame — one physical rig motion | `"Smooth crane up while tilting down slightly, maintaining man and boulder in frame"` |
| Tracking + slight tilt up | Following alongside while revealing height — natural operator behavior | `"Side tracking paralleling the slope, tilting up gradually to reveal the crest"` |
| Dolly in + slight crane down | Approaching while descending to subject level — single converging path | `"Slow dolly in with subtle descent to eye level"` |
| Parallax tracking + static tilt | Sideways movement with fixed vertical angle — like looking out a train window | `"Sideways parallax tracking, foreground rocks rushing past, background mountains drifting slowly"` |

**Rule of thumb:** If the compound describes what a single camera operator on a single rig would naturally do, it's safe. If it requires two independent rigs or contradictory directions, it breaks.

## Expression Control for Emotional Scenes

See the **Performance Direction Language** section below for the full micro-expression table, body language phrases, emotion keywords, and combination examples. That section is the canonical reference for all expression and performance prompting.

## Audio / Sound Design Architecture

Kling 3.0 generates audio alongside video. Use structured audio notation for best-effort results. **Reliability caveat:** T2V prompts have audio notes stripped by OpenArt auto-enhancement. I2V prompts pass through unchanged but Kling's response to audio cues is inconsistent. Treat audio prompting as directional guidance, not reliable control — plan critical audio design in post-production or via Suno/ElevenLabs.

### SFX Notation

Use `SFX:` as a prefix for explicit sound effect instructions:
```
SFX: sharp wooden crack as board pops
SFX: heels clicking on wet cobblestone
SFX: ceramic jar placed precisely on surface
```

### Material + Action + Sound Formula

For physical impacts and texture sounds, describe the material, the action, and the resulting sound:
```
[Material: Wood] + [Action: Pop] + [Sound: Sharp crack]
[Material: Concrete] + [Action: Landing] + [Sound: Heavy thud and roll]
[Material: Metal] + [Action: Sliding] + [Sound: Grinding scrape]
```

### Time-Coded Audio (Multi-Shot)

For multi-shot sequences, sync audio to time brackets to match the visual cuts:
```
[0–3s]: Heavy rain texture, distant thunder. Sharp intake of breath.
[3–4s]: Silence drops — the vacuum effect.
[4s]: A powerful voice yells the command.
[5–10s]: Thunderous explosion (sub-bass drop), high-frequency electricity hiss, concrete crumbling.
```

### Dialogue Attribution Format

Bind dialogue to a specific character with tone descriptors:
```
[Character A: Detective, controlled serious voice]: "Let's stop pretending."
Immediately, the suspect shifts in their seat.
[Character B: Suspect, sharp defensive voice]: "I already told you everything."
```

Use `@element_name` for bound characters:
```
[@Noah , deep weathered voice]: "The rain will come."
Immediately, [@Shem , fearful whisper]: "Father… how long?"
```

### Voice Tone Keyword Vocabulary

Use these descriptors in dialogue attribution brackets for richer vocal direction:

| Category | Keywords |
|----------|----------|
| Quality | raspy, clear, deep, breathy, gravelly, silky, nasal, resonant, thin, booming |
| Delivery | trembling, shouting, whispering, monotone, singsong, clipped, drawling, stammering |
| Emotional state | frustrated, fearful, nostalgic, tender, bitter, elated, resigned, contemptuous |
| Professional | newscaster crisp, narrator warm, announcer authoritative, teacher patient |

Combine one from each relevant category: `[@Noah , deep gravelly voice, resigned]:`

### Dialogue Word Count Limits

Dialogue that exceeds these limits garbles or cuts off — 2.0 extra rerolls per violation. The skill must validate word count against shot duration.

| Duration | Max Words | Example Length |
|----------|----------|---------------|
| 3s | 4-6 | "The rain will come." |
| 4s | 6-9 | "I already told you everything I know." |
| 5s | 8-12 | "Father, how long before the waters rise above us?" |
| 8s | 15-20 | Two short sentences or one compound sentence |
| 10s | 25-30 | Brief exchange between two characters |

For multi-shot dialogue, keep each shot's dialogue self-contained — never split one sentence across shots.

### Lip-Sync Tier Selection

Match lip-sync quality tier to shot framing:

| Framing | Tier | Why |
|---------|------|-----|
| Wide shot / background dialogue | Standard | Mouth detail not visible — save credits |
| Medium shot / social content | Pro | Good alignment at this distance |
| Close-up / hero dialogue | Master | Convincing at scrutiny distance |

Language quality ranking: Mandarin Chinese (best) > English > Spanish/Japanese/Korean > other.

### Temporal Connectors for Sequencing

Use these words to control the precise order of audio events within a shot:
- `Immediately,` — next event fires at the exact same moment
- `Then,` — next event follows after the current one resolves
- `Suddenly,` — abrupt, unexpected transition
- `As X, Y` — two events running simultaneously: `As the sword ignites, thunder rolls overhead`

### Ambient vs. Subject-Linked Audio

Separate the two layers explicitly:
```
Ambient: snowfall hiss, distant muffled gala chatter.
Subject-linked: heels clicking on cobblestone, fabric rustling on exit from car.
Sync: snowflake landing → brief silence; heel strike → sharp echo.
```

### Music Direction

For commercial / mood pieces:
```
Deep house emotional track, slow intro, building tension, soft drop at the final scene, warm bass, atmospheric, not aggressive.
Fast-paced punk rock guitar riff, SFX dominant, music pumping behind.
```

---

## Performance Direction Language

Kling interprets specific physical and gestural cues. These outperform vague verbs like "acts dramatically" or "moves intensely."

### Body Language

| Phrase | Effect |
|--------|--------|
| `shakes head slowly in disbelief` | Doubt, denial |
| `arms open wide as if pleading` | Vulnerability, appeal |
| `leans forward slowly` | Intensity, focus, threat |
| `tense shoulder shift` | Suppressed emotion, holding back |
| `walks close to camera` | Dominance, intimacy |
| `collapses to one knee` | Defeat, exhaustion, reverence |
| `gauntleted fist rotates with visible weight and inertia` | Physical realism in action |
| `knuckles tighten until white` | Resolve, fear, controlled rage |
| `single knee drops to ground, mechanical hand extends slowly` | Precision + emotional reveal |

### Micro-Expression Language

| Phrase | Effect |
|--------|--------|
| `blinks slowly` | Visible eyelid travel, catchlight shift |
| `eyes close with visible effort` | Contentment, grief, acceptance |
| `turns head slightly, light catching wet eyes` | Awareness — the light reflection sells realism |
| `gaze shifts, catchlight moves across iris` | Thought, decision |
| `brow furrows, skin around eyes tenses` | Worry, determination |
| `jaw tightens visibly` | Resolve, anger — facial muscle shift visible |
| `a single tear cuts through ash/grime on cheek` | Grief — clean track through grime is the visual anchor |
| `eyes open slowly` | Waking, realization, resolve |
| `breathing visible in chest and shoulders` | Life, exhaustion, fear |

### Emotion Keywords

Combine micro-expressions with state words:
`fearful` · `determined` · `resolute` · `exhausted` · `grieving` · `peaceful` · `calm` · `anxious` · `defiant` · `tender` · `broken` · `hopeful`

### Combination Example

```
@Tithen_Ash 's eyes open slowly, wet with tears. Gaze shifts, catchlight moves. Fearful expression gradually settles — jaw tightens, brow steadies. Determined.
```

---

## Film Aesthetic & Lens Reference Tags

Front-load any of these to modify the entire visual treatment. Combine one camera/film reference with one color treatment.

### Camera / Film Stock

| Tag | Result |
|-----|--------|
| `Shot on ARRI Alexa` | Professional cinema — clean, high dynamic range |
| `Shot on 35mm film` | Organic grain, film latitude, natural color |
| `Kodak Portra 400` | Warm skin tones, fine grain, photographic feel |
| `Shot on RED Camera` | Hyper-sharp digital cinema, clinical clarity |
| `Shot on Leica SL2S` | Luxury editorial look, precise tonal rendering |
| `Super 8` | Vintage, lo-fi, nostalgic — coarser grain |
| `VHS camcorder aesthetic` | Retro consumer video — scan lines, color bleed |
| `Anamorphic lens` | Horizontal lens flares, oval bokeh, widescreen cinematic feel |

### Lens Focal Length as Style Cue

These act as stylistic intent signals, not literal optics:

| Focal Length | Effect |
|---|---|
| `8mm–16mm` | Extreme wide, distorted perspective — environment dominates |
| `24mm` | Wide cinematic — environment + subject balanced |
| `35mm` | Natural field of view, grounded realism |
| `50mm` | Intimacy — slightly compressed, human scale |
| `85mm` | Portrait compression — subject isolation, background blur |
| `macro` | Extreme detail on small surfaces — droplets, textures, fabric weave |

Combine in sequences: `start 35mm, shift to 50mm for intimacy, pull to 24mm for wide tension`

### Color Grade / Treatment

| Tag | Result |
|-----|--------|
| `shallow depth of field` | Background blur, subject isolation |
| `film grain` | Organic texture, not clinical |
| `desaturated teal grade, crushed blacks` | Gritty action / thriller look |
| `warm golden hour tones` | Safe, nostalgic, emotional |
| `cold blue-grey desaturated` | Dread, detachment, clinical |
| `high-key studio lighting` | Commercial / product — pure white, no shadows |
| `anamorphic lens flare` | Cinematic prestige — horizontal streak flares |

### Lens Flare — Types and Reliability

Lens flares add premium cinematic polish, but their reliability in Kling varies significantly by type. Use as a *style anchor* (consistent visual treatment front-loaded in the prompt), not as a dynamic per-frame effect.

| Type | Visual Effect | Kling Reliability | Prompt Language |
|------|-------------|-------------------|-----------------|
| **Anamorphic streak** | Horizontal blue/purple streaks across the frame | **Reliable** | `"35mm anamorphic lens, horizontal lens flare, anamorphic streaks"` |
| **Veiling flare** | Soft haze / wash of light over the image | **Reliable** | `"subtle veiling flare, soft optical haze"` |
| **Starburst** | Sharp star-shaped rays from a point light source | **Inconsistent** | `"sun starburst flare"` — often over- or under-renders |
| **Circular ghosting** | Round glowing orbs and ghost artifacts | **Inconsistent** | `"circular lens flare ghosting"` — flickers between frames |
| **Dynamic / moving flare** | Flare shifts with camera movement | **Unreliable** | Kling has no optical simulation — it pattern-matches, and "flare moves with camera" is sparse in training data. Flickers and detaches from light source. |

**Production-safe approach:** Use anamorphic streaks or veiling flare as consistent style treatment. For starburst, ghosting, or dynamic flares, add them in post-production (After Effects, DaVinci) where you have frame-level control.

**Positioning the light source:** Always specify where the sun/light is: `"low sun from frame-left"`, `"sun peeking behind the boulder"`, `"backlit golden hour sun in upper frame"`. Without a stated position, Kling places flares arbitrarily.

**Intensity control:**
- Subtle: `"gentle lens flare"`, `"subtle anamorphic streak"`, `"tasteful flare"`
- Dramatic: `"strong horizontal lens flare"`, `"prominent anamorphic streak"`, `"intense flare"`

**Flare + dust interaction:** `"lens flare interacting with airborne dust particles"` grounds flares in the scene's physics. Works well at MOTION SCALE 0.3–0.5; at higher scales dust particles become chaotic and light shafts flicker.

**Multi-shot consistency:** If the sun position shifts between shots, the flare direction shifts, breaking spatial continuity. Pick one sun position for the sequence and maintain it across all shots.

**Negative prompts for flare failures:**
```
flickering flare, flare appearing and disappearing, inconsistent flare position,
flare detached from light source, artificial lens flare, overexposed flare
```

---

## Micro-Motion Integration

For shots that are compositionally static, add environmental micro-motion to prevent the "frozen painting" effect. These details cost almost no prompt characters and significantly improve realism:

### Environmental Micro-Motion

```
Steam rising from coffee surface
Dust motes floating in a shaft of light
Fabric sway from a subtle air current
Hair drifting in a gentle breeze
Embers orbiting slowly around a blade
Candle flame flickering
Neon sign pulsing rhythmically
Water condensation forming on glass
Snowflakes drifting past frame
Smoke curling from a distant source
```

### Character Micro-Motion (no major action)

```
Visible slow breathing in chest and shoulders
Single slow blink
Eyes tracking left to right
Fingers settling slightly on a surface
Robes settling after coming to rest
```

### Particle / Atmosphere Micro-Motion

```
Magical ember particles orbiting the blade
Rune-glyphs pulsing rhythmically, casting shifting shadows
Arcane energy rippling outward in slow concentric rings
Sakura petals caught in the wake of motion
```

These are most effective in close-up and medium shots where there's no dominant character action. They signal "living world" rather than static image.

**Note:** Ambient micro-motion (steam, dust motes, fabric sway) does not need explicit end states — it loops naturally. The "every motion needs an end state" rule applies to intentional character actions and object movements with a clear beginning and end.

---

## Emphasis Syntax

Use `++element++` to flag critical components that must be preserved through generation:

```
++sleek black glass jar++ centered on white platform
++rune-etched longsword++ igniting in cold blue-white light
++dark brindle French Bulldog++ sitting at kitchen table
```

Use sparingly — reserve for the primary subject of a product ad or the key visual that absolutely cannot drift. Overusing emphasis reduces its effect.

---

## Image-to-Video Prompting

When using a first-frame reference image (NanoBanana start frame or Element), shift the prompt strategy entirely.

**The image handles:** environment, composition, character appearance, lighting setup, color mood.

**The prompt handles:** motion, camera movement, what changes, emotional arc.

### What to Remove from I2V Prompts
- Scene descriptions (the image IS the scene)
- Character appearance (already visible)
- Lighting setup (already established)
- Color palette (already set)

### What to Add to I2V Prompts
- Exactly what moves and how — **describe forces, not appearances**
- Camera movement direction and speed — add ONE organic camera term (see Organic Camera Vocabulary)
- What changes between start and end of the clip
- Subtle environmental motion to prevent freezing

### Forces Not Appearances

Describe the physics acting on objects, not what the result looks like. Kling's physics simulation activates on force descriptions — it pattern-matches appearance descriptions and often fails.

| Weak (appearance) | Strong (forces) |
|---|---|
| `"car turns"` | `"tires smoke as the car drifts 90 degrees, rubber gripping and releasing"` |
| `"flag waves"` | `"wind snaps the flag taut, fabric ripples propagate from the pole outward"` |
| `"rain falls"` | `"rain drives at 30 degrees from frame-left, droplets shattering on stone"` |
| `"door opens"` | `"door swings inward under its own weight, hinges creaking, air pressure shifts curtain behind"` |

### I2V Example

**Weak (re-describing the image):**
```
A French Bulldog sits at a wooden kitchen table in the morning light wearing blue pajamas, holding a coffee mug, with coffee beans on the table. The dog slowly reaches for the phone alarm.
```

**Strong (motion-only, image does the rest):**
```
The Frenchie's arm extends slowly toward the vibrating phone. Paw slaps down on the phone abruptly. Brief pause. Then lifts the coffee mug with both paws, takes one slow deliberate sip. Eyes open wide. Messy fur on head bursts upward as if electrified.
[MOTION SCALE: 0.6]
```

### I2V Negative Prompt for Element Consistency
```
character appearance change, background shift, lighting change, morphing, unstable texture, extra limbs
```

---

## Kling 3.0 Hard Limits

| Constraint | Value |
|-----------|-------|
| Images per Element | 2-4 (JPG/PNG, max 10MB each) |
| Elements per task | Max 3 |
| Text characters per shot prompt (multi-shot mode) | Max 500 (prompt body only — negative prompt block excluded) |
| Optimal words per multi-shot prompt | 15-25 (over this causes jitter) |
| Character cost of `@element_name` | 37 characters each |
| Multi-shot mode | Up to 6 shots per generation |
| Shot duration (multi-shot) | 1-12 seconds per shot |
| Total duration | 3-15 seconds |
| Multi-shot + end frame | **Mutually exclusive** — cannot combine |
| `cfg_scale` | 0-1 range. Default varies by provider. Use **0.8 for character consistency**. |
| Aspect ratios | 16:9, 9:16, 1:1 |
| Resolutions (std) | 1280x720, 720x1280, 720x720 |
| Resolutions (pro) | 1920x1080, 1080x1920, 1080x1080 |
| Resolutions (4K) | 3840x2160, 2160x3840, 2880x2880 (native 4K, not upscaled) |
| Negative prompt terms | 5-8 optimal (15+ degrades quality) |
| Dialogue word limit | 4-6/3s, 6-9/4s, 8-12/5s, 15-20/8s, 25-30/10s |

## Elements Workflow

### How Kling 3.0 Elements Work

Kling 3.0 treats reference images as a **3D spatial anchor**, not just a starting frame. The AI maps the character in 3D space, ensuring clothing and features remain consistent even as the character moves and turns. This is the "Element Binding" or "Bind Subject" feature — it locks specific visual tokens (eye color, hair style, clothing) to the reference images, suppressing the latent space randomness that caused character drift in earlier versions.

### Creating Elements (do once per project)

1. Go to **Image-to-Video** → click **Elements** (or use the API `kling_elements` array)
2. For each character/environment/prop:
   - Give it a short, clear **name** (e.g., `Noah`, not `The Elderly Biblical Patriarch`)
   - Write a **brief** description — short is better since the images carry the visual DNA
   - Upload **4 reference images** from NanoBanana (the maximum Kling accepts per Element):
     1. Front three-quarter (PRIMARY identity anchor)
     2. Profile/side view
     3. Back three-quarter
     4. Extreme close-up face
   - Add **tags** for organization by episode/project
3. Save — the element is now reusable across all generations

### Element Best Practices

| Practice | Why |
|----------|-----|
| Upload exactly 4 images per character element | Maxes out Kling's 3D spatial anchor — front three-quarter + side profile + back three-quarter + ECU face = complete Visual DNA |
| Keep names short and clear | Easier to reference in prompts, and each `@name` costs 37 characters |
| **Do NOT re-describe character appearance in prompts** | Element binding handles identity. Prompt space is for action, camera, environment, and emotion ONLY |
| Use tags to organize by episode/project | Keeps library clean at scale |
| Keep element descriptions brief | The 4 reference images carry the visual information, not the text description |
| Separate elements for different character states | "Tithen" (clean) vs "Tithen Ash" (damaged) — don't mix |
| Environment elements for each state | "Burning Village" and "Destroyed Village" as separate elements |
| Use neutral lighting and clean backgrounds in NanoBanana refs | Prevents environment/lighting from bleeding into the Element's identity |

### Referencing Elements in Prompts

Use the structured block format. Each `@element_name` resolves to its internal `@ID` at generation time — in OpenArt, the platform maps descriptive names to IDs automatically.

```
[Cinematography]: [camera / framing / angle / lens / depth of field]
[Subject]: @element_name — [shot-specific state or render focus]
[Action]: [what moves — pronouns or body part names after Subject established]
[Context]: [background @elements, non-element figures, environment]
[Style & Ambiance]: [style anchor / lighting / mood / motion scale]
```

#### Element Distribution by Spatial Role

| Location in frame | Block |
|-------------------|-------|
| Foreground primary subject | `[Subject]` |
| Foreground co-subject (e.g. weapon in hand) | `[Subject]` alongside character |
| Background bound Elements | `[Context]` with inline descriptor |
| Non-element background figures | `[Context]` — explicit description prevents erasure |

**Background @IDs get an inline descriptor:**
```
[Context]: @Stone , a flat-topped mossy pedestal, sword slot now empty.
           @Sword hilt emerging from @Stone 's flat top, catching light.
```

#### @-Mention Economy in [Action]

Each `@element_name` costs 37 characters. [Subject] pays the cost; [Action] uses cheap references:

| [Subject] establishes... | [Action] uses |
|--------------------------|---------------|
| Single character, description first, @ID parenthetical | Pronouns: *"He lifts. His jaw sets."* |
| Single character, @ID leads directly | @ID once at start, then body part names |
| Body part as subject (*"the right arm of @ID"*) | Body part names: *"The arm extends. The fingers spread."* |
| Complex multi-beat sequence | @ID at each major action phase transition |
| Multi-element | @ID wherever referent is ambiguous |

**Never repeat @ID more than needed.** The maximum observed in any single shot is @ID in [Subject] + @ID at phase transitions in [Action] + @ID in [Style & Ambiance] when lighting is physically tied to the character's face.

**Spacing after @element_name:** Always add a space after every `@element_name` mention, before any character that follows — apostrophes, commas, periods, anything. The `@` parser closes on the space — without it, any immediately following character breaks the element binding.
- `@Arthur 's arm` ✓ — `@Arthur's arm` ✗
- `@Stone , a mossy rock` ✓ — `@Stone, a mossy rock` ✗
- `@Sword .` ✓ — `@Sword.` ✗

#### [Subject] Render Quality by Shot Type

| Shot type | [Subject] instruction |
|-----------|----------------------|
| ECU face | Name the specific feature + texture detail: *"focusing solely on the eyes and brow ridge. Hyper-detailed iris and eyelash texture."* |
| ECU body part | Name body part + render detail: *"The right arm and hand of @ID, highly detailed skin texture and visible muscular tension."* |
| Close-up whole face | Emotional/physical state entering the shot: *"bearing heavy exhaustion, lower lids slightly risen, muscles slack"* |
| Wider / medium | Identity hook + entering physical state |
| Multiple foreground elements | Both @IDs together: *"@Arthur — both arms raised, @Sword blade pointing upward"* |

#### [Context] Uses

1. **Background bound Elements** — `@ID, brief inline descriptor`
2. **Non-element background figures** — explicit description to prevent erasure (no @ID = no visual anchor = text is their only preservation instruction)
3. **ECU framing** — how environment *manifests* at this scale: *"forest abstracted into organic dappled bokeh"*, *"implied in iris reflections"*
4. **Narrative situation** — relational meaning involving unseen entities: *"implying confrontation with something powerful and unhearing"*

#### Motion Scale Placement

Flexible — appears in [Cinematography], [Action], or [Style & Ambiance]. Format varies freely:
- `[MOTION SCALE: 0.3]` (tag)
- `"Motion scale: 0.3"` (prose)
- `"Motion scale is set to 0.3"` (prose)

All are equivalent. Must appear somewhere in the prompt.

#### Audio Notes Behaviour

| Mode | Audio notes |
|------|-------------|
| T2V | **Dropped** by OpenArt auto-enhancement. Write as production metadata in source files only — they do not reach Kling. |
| I2V | **Preserved** — I2V prompts pass through unchanged, so audio notes survive. Whether Kling acts on them is a separate question. |

#### Cross-Reference Warning

Relative references to other shots (`"slightly warmer than Shot 06b"`, `"same light as previous"`) do not survive T2V enhancement and mean nothing to Kling. Always write absolute descriptions.

### I2V — OpenArt Behaviour and Non-Element Figures

**OpenArt does not apply auto-enhancement to I2V prompts.** The prompt passes through unchanged — no structured block conversion, no vocabulary enrichment, no error correction. Consequences:

- Write I2V prompts in final-quality form directly
- @ID consistency is critical — mixed `@element_name` / `@ID` references will not be caught
- Typos pass through uncorrected
- Audio notes survive (nothing is processed)

**Non-element background figures must be described explicitly** — they have no visual DNA anchor. Without a description, Kling treats them as unimportant and erases them:

```
In the soft-blurred background, a semi-circle of men in plain medieval clothes
stand completely motionless, facing forward. They do not move or reposition.
```

This applies to both I2V and T2V. In T2V the description goes in `[Context]`. In I2V it goes directly in the prompt body.

### Negative Prompts

Always include negative prompts as identity guardrails. These prevent the AI from drifting away from the bound Element data.

**Optimal count: 5-8 focused terms.** Testing across 1500+ generations shows 5-8 terms hits the sweet spot — 23% higher quality than 20+ terms, 57% reroll reduction vs no negatives. Beyond 15 terms, output becomes generic and lifeless.

**Priority ordering matters.** Earlier terms carry more weight. Order: identity-threatening terms first → motion artifacts → style drift.

**General template (8 terms, priority-ordered):**
```
morphing features, shifting jawline, extra limbs, distorted joints, changing clothes, flickering background, smooth plastic skin, airbrushed texture, sliding feet
```

**Period/fantasy template (replace general — 7 terms):**
```
morphing features, shifting jawline, extra limbs, modern clothing, shifting armor plating, power lines, changing hair length
```

**Corporate/professional template (replace general — 7 terms, remove `glasses` if character wears them):**
```
morphing features, shifting jawline, suit color shift, de-aging, missing tie, open collar, messy hair
```

**Audio-enabled template (swap last 3 base terms for audio terms when `generate_audio: true` — keeps total ≤8):**
```
morphing features, shifting jawline, extra limbs, distorted joints, changing clothes, garbled speech, audio desync, overlapping voices
```

**Multi-shot template (swap last 3 base terms for continuity terms — keeps total ≤8):**
```
morphing features, shifting jawline, extra limbs, distorted joints, changing clothes, character drift between shots, tonal shift between cuts, inconsistent lighting across shots
```

### Multi-Shot Mode

Kling 3.0 supports generating up to 6 shots in a single request. The model treats these shots as one scene, handling transitions internally. Character identity persists across shots within the same generation.

Use `Shot 1:`, `Shot 2:`, etc. in prompts, or the `multi_prompt` array in the API with individual prompt + duration per shot.

**Multi-shot constraints:**
- Max 500 characters per shot prompt (prompt body only — the negative prompt block at the end is separate and does not count toward this limit)
- **Optimal: 15-25 words per shot prompt** — over-described shots cause jittery transitions between cuts. Stay concise.
- Each `@element` consumes 37 characters
- **Multi-shot and end frame conditioning are mutually exclusive** — they CANNOT be used together in a single generation. If you need end-frame control, use single-shot I2V.
- Sound effects default to enabled
- Gradual camera angle changes between adjacent shots — abrupt angle jumps cause visual discontinuity

### Element Binding Best Practices

Once an Element is bound (e.g., `@Noah`), the character's appearance, clothing, age, and identity are already determined by the 4 reference images uploaded (the API accepts 2-4, but always upload 4). Don't re-describe these in the prompt.

**What NOT to do:**
```
@Noah , elderly Middle Eastern man with long grey beard, kneels at the rail, his weathered face showing doubt, his robes blowing in the wind...
```
This wastes 60+ characters re-describing Noah's appearance when Kling already knows it from the Element reference images.

**What to do instead:**
```
@Noah kneels at the railing of @Ark_Deck . Jaw tightens. Gaze shifts downward. Wind moves robes.
```
This focuses on ACTION (kneeling, jaw tightening, gaze shifting) and ENVIRONMENT, not redundant appearance. @Noah appears once in [Subject]; body part names carry the rest (see @-Mention Economy). You saved 60+ characters and gave Kling clearer instructions.

### Eliminate Pronouns in Multi-Character Prompts

When a scene has 2+ characters, pronouns create ambiguity. Kling may misinterpret "he" or "his" in a two-character scene.

**Before (with pronouns):**
```
@Shem approaches @Noah from behind while he prays. He stops a few steps back. His eyes search for reassurance.
```
Ambiguous: Whose eyes? Who stopped? Who's praying?

**After (Element names only):**
```
@Shem approaches @Noah from behind. @Noah kneels in prayer. @Shem stops a few steps back. @Shem 's eyes search for reassurance.
```
Crystal clear: each action is tied to the correct character.

**Common replacements:**
- "he/his/him" → Use the character's @element_name
- "she/her" → Use the character's @element_name
- "their/they" → Use each character's name separately
- "father/son/mother" → Use @element_name (e.g., "@Noah" not "his father")
- "it/its" → Keep for inanimate objects (mast, branch, etc.)

## Style Anchors by Mood

Front-load every Kling prompt with the appropriate anchor. Each anchor includes lighting, atmosphere, film-look reference, and lens character. For the full Film Look Vocabulary, lens vocabulary, and emotion→palette mapping, see `reference/nanobanana-artistry.md`. The `NanoBanana look:` annotations below are behavioral (no brand names) — they feed the still prompts; see `reference/nanobanana-artistry.md` → Film Look Vocabulary.

**9:16 adaptation:** These anchors are written for general use. For 9:16 vertical projects, replace anamorphic lens references with spherical primes (e.g., "35mm anamorphic lens" → "35mm spherical prime"). Anamorphic produces horizontal flares and oval bokeh that don't suit the vertical frame — use "spherical bokeh" and "vertical lens flare" instead. Also replace "shallow depth of field" with "layered vertical depth" where appropriate. See `reference/seedance-reference.md` → Prompt Anatomy for the spherical lens spec block used in 9:16.

### Warm / Safe / Tender
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 85mm f/2 lens, shallow depth of field. Warm golden hour light with dust motes in light shafts. Kodak Portra 400 warmth, creamy highlights. Soft bokeh. Light atmospheric haze between subject and background, fine particulate catching golden light, atmospheric falloff softening background half a stop.
```
Palette: warm amber, golden skin tones, soft shadows. NanoBanana look: warm fine-grain negative or soft pastel negative.

### Fire / Danger / Threat
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 35mm lens, shallow depth of field. Flickering orange firelight against cold blue moonlight. Volumetric smoke. High contrast, teal shadows with amber highlights. Dense particulate catching firelight in foreground, atmospheric haze thickening between depth planes, smoke drifting through midground.
```
Palette: teal & orange, high contrast. NanoBanana look: tungsten night film w/ halation, or pushed vivid saturated negative.

### Devastation / Aftermath / Grief
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 50mm lens, shallow depth of field. Cold desaturated overcast. Faint ember underlighting. Volumetric ash. Muted palette, crushed blacks. Heavy atmospheric falloff dissolving background into grey, suspended ash particles catching faint ember glow, air thick with residual dust.
```
Palette: desaturated cool tones, muted blues/greys. NanoBanana look: warm fine-grain negative with cool shift, or fine-grain elegant B&W.

### Quiet / Mysterious / Forest
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 50mm f/1.4 lens, shallow depth of field. Cold moonlight through canopy. Volumetric mist. Deep shadow. Teal and deep blue, limited warm accents. Low ground mist pooling between depth planes, moonlight shafts cutting through canopy haze, atmospheric density increasing with distance.
```
Palette: teal, deep blue, minimal warm. NanoBanana look: tungsten night film w/ halation, or pushed reportage B&W.

### Horror / Dread / Tension
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 35mm f/2.8 lens, shallow depth of field. Cold desaturated blue-grey. Single harsh light source from below. Volumetric fog. Deep shadow. Chiaroscuro. Dense fog rolling through midground obscuring background detail, light source cutting a single visible shaft through the haze, atmospheric pressure thickening the air.
```
Palette: high contrast, cool blues with red accents. NanoBanana look: tungsten night film w/ halation. Lens: consider subtle chromatic aberration for unease.

### Surreal / Dream / Memory
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 50mm f/1.5 vintage lens, shallow depth of field. Soft diffused light, no hard shadows. Volumetric haze. Slight warm overexposure. Subtle Leica glow on highlights. Warm diffuse haze evenly distributed through all depth planes, light bloom softening edges between subject and background, air reading as luminous.
```
Palette: muted pastels, warm faded tones. NanoBanana look: faded consumer warm or soft pastel negative. Lens: vintage glass with soft focus glow.

### Dark / Minimal / Reveal
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 85mm f/1.4 lens, razor-thin depth of field. Near-total darkness. Single accent light source. Deep black negative space. Subject isolated by light. Faint particulate visible only where the accent light cuts through, atmosphere otherwise invisible — darkness swallows depth cues.
```
Palette: near-monochrome, single light accent. NanoBanana look: reportage B&W or fine-grain elegant B&W.

### Power / Dominance / Epic
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 35mm anamorphic lens, shallow depth of field. Strong directional light, dramatic rim light. Rich saturated tones, deep blacks. Horizontal lens flare. Oval bokeh. Atmospheric haze giving light shafts physical body, particulate catching rim light behind subject, background softened by one full stop of atmospheric falloff.
```
Palette: rich, saturated, deep gold and dark. NanoBanana look: vivid saturated negative or refined warm negative.

### Intimacy / Tenderness / Contemplation
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 85mm f/1.4 Leica Summilux, shallow depth of field. Soft window light from one side. Warm creamy skin tones. Subtle highlight glow. Gentle bokeh. Light atmospheric warmth between lens and subject, dust motes drifting slowly in window light, background softly hazed.
```
Palette: warm skin tones, soft pastels, amber. NanoBanana look: warm fine-grain negative. Lens: glowing-normal rendering for 3D pop.

### Hope / Liberation / Aspiration
```
Photorealistic cinematic fantasy. Shot on ARRI Alexa, 24mm wide lens, moderate depth of field. Dawn light breaking through, warm highlights emerging from cool shadows. Volumetric god rays. Clearing mist. Dense volumetric god rays cutting through clearing morning mist, atmospheric haze thinning from foreground to background as light breaks through, particulate catching the emerging warmth.
```
Palette: warm highlights bleeding into cool shadows, emerging light. NanoBanana look: warm fine-grain negative, or vivid saturated negative.

---

## Lighting Recipes

Detailed lighting setups for conditions that Kling renders particularly well. These go beyond the style anchor (which is a front-loaded one-liner) — use them when the lighting is the shot's primary visual feature. For night scenes, also see `reference/cinematography.md` → Night Cinema Register — the mostly-dark, practical-driven discipline (anti bright-night, anti teal-everywhere) that applies to stills and video alike.

### Golden Hour

The single highest-value lighting condition for Kling. Low sun angle creates natural rim light, long shadows, and volumetric god rays — all in Kling's strongest rendering zone.

**Core elements to specify:**

| Element | Prompt language | Why it matters |
|---------|----------------|----------------|
| Sun position | `"low sun from frame-left"`, `"setting sun behind and to the right"` | Determines shadow direction, rim light placement, and flare position. Pick one side and maintain across the sequence. |
| Rim light | `"warm rim lighting on shoulders and edges"`, `"golden rim light catching the contour"` | Creates subject separation from background — essential in 9:16 where depth tools are limited. |
| Long shadows | `"long dramatic shadows stretching [direction]"` | Sells the low sun angle. Specify direction relative to the slope or ground plane. |
| God rays + dust | `"volumetric god rays through airborne dust"`, `"light shafts piercing through kicked-up particles"` | Kling's strongest atmospheric effect. Best at MOTION SCALE 0.3–0.5 — at 0.7+ dust particles become chaotic and light shafts flicker. |
| Color consequence | `"warm golden-orange highlights with cool teal shadows"` | The teal-orange split is a natural consequence of warm sunlight + cool ambient shadow — don't over-specify, or Kling saturates it into blockbuster cliché. |
| Shadow quality | `"soft long shadows"` (early/late golden hour) or `"harder directional shadows"` (mid golden hour) | Soft shadows feel warmer; hard shadows feel more dramatic. |

**Full golden hour anchor:**
```
Photorealistic cinematic. Shot on ARRI Alexa, 35mm anamorphic lens, shallow depth of field.
Golden hour sunset, warm low sun from frame-left. Long shadows stretching frame-right. Warm rim lighting
on subject edges. Volumetric god rays through airborne dust. Rich golden-orange highlights,
cool teal shadows. Subtle anamorphic streak from sun position. Film grain.
```

**Interaction with motion scale:** God rays and atmospheric dust are particle effects. They render best when the shot's overall motion is controlled:
- MOTION SCALE 0.3–0.5: God rays stable, dust drifts naturally, light shafts hold position
- MOTION SCALE 0.6–0.7: Dust becomes active, god rays may shimmer — acceptable for action shots but less stable
- MOTION SCALE 0.8+: Light shafts flicker, dust obscures the frame — avoid unless the scene is pure environment with no characters

**Multi-shot consistency:** Sun position must stay consistent across shots in the same sequence. If Shot 1 has sun from frame-left, Shot 2 cannot have sun from frame-right — shadows will flip direction and break spatial continuity.

---

## Troubleshooting

### Anti-Cleanliness Negative Prompts

When the output looks "too AI" — too smooth, too clean, too digital — add these targeted negatives. Pick 3-4 relevant to the specific failure:

```
smooth plastic skin, airbrushed texture, digital noise pattern, uniform sharpness,
CGI render, video game aesthetic, flat uniform grain, symmetrical lighting,
overly clean surfaces, perfect geometry, stock footage look
```

These target the specific tells of AI generation: uniform texture distribution, perfect symmetry, unnaturally clean surfaces, and the "CGI smooth skin" problem.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Video looks nothing like elements | Ensure 4 reference images uploaded with clear lighting. Use `@element_name` syntax. Add negative prompt to prevent drift. |
| Character face changes between clips | Upload 4 angles (front, side, back, close-up). Keep the same Element across all shots. Use negative prompt: `morphing features, shifting jawline`. |
| Character appearance re-described in prompt | **Remove all appearance descriptions.** Once bound, Kling knows the character. Prompt space is for action/camera/emotion only. |
| Prompt over 500 characters (multi-shot only — single-shot I2V has no character limit) | Cut appearance descriptions (Element handles that). Shorten style anchor. Remove redundant adjectives. Each `@element` = 37 chars. |
| Looks too CGI / video game | Strengthen style anchor: add `real animal photography` or `practical effects` or `shot on film` |
| Character inconsistent across shots | Upload all 4 reference angles. Use same Element across all batches. Keep lighting conditions similar between shots. |
| Two characters interacting poorly | Generate each character's action separately, composite in editor. |
| Motion too subtle | Increase motion scale. Use specific verbs: not "moves" but "walks forward with deliberate steps." |
| Motion too chaotic / drifting | Lower motion scale. Describe fewer simultaneous actions. Shorten clip duration. |
| Camera doesn't follow directions | Use one camera instruction per prompt. Place it near the beginning. Use exact terms from the camera vocabulary table. |
| Lighting looks flat | Name specific light sources: "rim light from fire behind", "underlight from embers", "key light from moonlight above." |
| Lighting shifts mid-clip | Use only one lighting direction per prompt. Avoid contradictory light descriptions. |
| Expression changes don't land | Use micro-expression phrases from the table above. If still failing, generate two separate clips (one per expression) and hard cut in editor. |
| Hands/fingers look wrong | **Anchor hands to objects** — "fingers wrapped around the railing" not "hands at sides." "Knuckles gripping the cup handle" not "holding a cup." The more specific the contact point, the fewer deformities. Fallback: hide in shadow/silhouette. Negative: `warping fingers, extra fingers, deformed hands`. |
| Photorealism drifts toward cartoon / plastic skin | Front-load: "Photorealistic cinematic. Real photography. Shot on ARRI Alexa." **Inject texture language** — "visible skin pores, fine lines at eye corners, slight sun damage on cheekbones" gives the super-resolution module specific targets. Similarly: "film grain," "fabric creases," "condensation on glass," "individual hair strands." Don't say "detailed" — describe the specific texture. |
| Face warps during camera movement | Use "tripod stable shot" or "locked-off camera" for dialogue close-ups. **Never combine camera movement with facial expression changes in the same clip.** Reduce camera speed for any shot featuring faces. Split into: face-expression clip (static camera) + camera-movement clip (no face change). |
| Motion hangs / infinite loop | **Every motion needs an end state.** "Hair moves in wind" → hangs. "Hair moves in wind, then settles back into place" → completes. "Hand rises" → hangs. "Hand rises, pauses, lowers" → completes. Adding termination points prevents 99% of generation hangs. |
| Background changes between clips | Add more specific environmental detail to prompt. Repeat key environment descriptors across shots. Use `@environment_element` consistently. |
| Subject leaves the frame | Specify shot type (medium, close-up, wide). Keep action within the bounds of the chosen framing. |
| Shot feels frozen / static image | Add micro-motion: `steam rising`, `fabric sway`, `hair drifting`, `embers orbiting`. These cost almost no characters. |
| Physics look unrealistic / floaty | Add explicit physics language: "realistic gravity, natural weight, proper momentum". Use the Dynamic Physics vocabulary section. Add physics negative prompts. |
| Objects float or clip through surfaces | State contact explicitly: "rests solidly on the surface", "feet firmly planted". Add `floating objects, objects clipping through surfaces` to negative prompt. |
| Character effort looks effortless | Describe body mechanics: "muscles straining, heel strikes, weight transfer, laborious steps". See Body Mechanics Under Load section. |
| Scale inconsistent in motion | Re-state body-relative sizes after motion: "boulder still chest-height to @Character". Add `objects changing scale, distorted proportions` to negative prompt. |
| Slope/incline physics wrong | Specify angle ("35-degree slope"), surface type ("loose gravel"), and body position ("leaned forward at slope angle"). Add slope-specific negatives. |
| Audio doesn't match action | Use time-coded audio with shot brackets. Use `SFX:` notation. Separate ambient from subject-linked sound. |
| Dialogue doesn't bind to correct character | Use `[Character A: vocal description]: "line"` format. Don't use pronouns after `@element_name` reference. |
| Camera does the wrong move | Put camera instruction at the very start of the prompt. Use only one movement. Use exact vocabulary from the table. |
| Speed ramp doesn't trigger | Describe it explicitly: `transitions into extreme slow-motion mid-air, snaps back to normal speed on landing`. |
| Product geometry distorts during rotation | Add to negative prompt: `distorted product geometry, unstable product focus, warped shape during rotation`. Avoid simultaneous camera + object transforms. |
| Film look not matching target style | Use specific film stock tags: `Shot on 35mm, Kodak Portra 400` or `Shot on ARRI Alexa, anamorphic lens, desaturated teal grade`. |

## Duration Guidelines

Kling 3.0 supports 3-15 seconds total per generation, and 1-12 seconds per shot in multi-shot mode.

| Clip Type | Recommended Duration | Why |
|-----------|---------------------|-----|
| Static/atmospheric hold | 3–4s | Enough for the eye to absorb, not so long it feels frozen |
| Single motion (walk, turn, gesture) | 3s | One clean motion with entry and exit |
| Expression shift | 3–5s | Needs time for the micro-expressions to read |
| Environmental reveal (camera pull-back) | 3–5s | Slow enough to build anticipation |
| Action burst (eruption, impact) | 1.5–2.5s | Short keeps it clean, prevents drift. **Multi-shot only** — standalone minimum is 3s. |
| Emotional close-up (core scene) | 4–6s | Needs breathing room for the emotion to land |
| Multi-shot narrative | Up to 15s | Use multi-shot mode with distinct prompts per shot for complex sequences |

Shorter is almost always safer. Standalone generations have a 3s minimum; sub-3s durations (1-2s) only work as individual shots within multi-shot mode. When in doubt, generate a shorter clip and let the editor control pacing.

## Prompt Philosophy (Kling 3.0)

**Think like a Director of Photography, not a photographer.**

The fundamental shift with Kling 3.0 is moving from static image descriptions to dynamic directional prompting:

- **Describe motion physics precisely** — "heel-first weight transfer" not "walking"
- **Use one camera instruction** — not "cinematic" but "slow dolly-in over 4 seconds"
- **Don't describe appearance** — the Element binding handles identity
- **Describe what changes** — the action, the expression shift, the camera move
- **End with emotional tone** — one or two words that anchor the mood

### Weak vs Strong Prompt Pattern

| Element | Weak (avoid) | Strong (use) |
|---------|-------------|-------------|
| Camera | "camera follows a man" | "Handheld shoulder-cam drifts behind the subject with subtle sway" |
| Camera | "dramatic camera move" | "Snap zoom out to medium shot" |
| Motion | "a man walking" | "He walks at a steady pace, each foot landing heel-first, rolling forward" |
| Motion | "moves dramatically" | "Arm extends with visible weight and inertia, knuckles tightening to white" |
| Lighting | "cinematic lighting" | "Flickering neon casting magenta reflections on wet asphalt" |
| Lighting | "dramatic lighting" | "Hard rim light from fire source behind, cold blue fill from moonlight above" |
| Audio | "sound effects" | "SFX: wooden board pops sharply, heavy concrete thud on landing" |
| Environment | "in a city" | "Narrow alley, steam from grates, glowing vending machines, rain on asphalt" |
| Texture | "looks realistic" | "Rain beading on leather, condensation on glass, visible breath in cold air" |
| Character | "An elderly man with grey beard and robes" | (nothing — Element handles this) |

### Prompt Structure: Which Format to Use

There are several structural approaches in common use. The time-coded multi-shot format is the most reliable — use it as the default for anything longer than a single action.

| Format | When to Use | Avoid When |
|--------|------------|------------|
| **Time-coded shots** `Shot 1 (0–4s):` | Multi-scene, action sequences, narrative arcs, product ads with multiple beats | Single static atmospheric shots |
| **Tagged sections** `[Cinematography]` `[Subject]` `[Action]` `[Context]` `[Style & Ambiance]` | Single-shot action scenes with distinct layers (see Referencing Elements in Prompts) | Multi-scene — can't express time progression |
| **Free-form paragraph** | Single-shot atmospheric / environmental holds | Anything with 2+ beats — structure collapses |
| **JSON objects** | Never preferred — adds syntax overhead with no parsing benefit | Always — use plain-text time-coded format instead |

**Default structure for any multi-beat prompt:**
```
Shot 1 (0–Xs): [camera]. [action]. [environment/atmosphere].
Shot 2 (Xs–Ys): [camera]. [action]. [environment/atmosphere].
...
Ambient: [sound layer]
SFX: [event-linked sounds]
[MOTION SCALE: X]
Aspect ratio: 9:16
Negative prompt: [block]
```

---

### Universal Closing Block

Append this to every generation. Fill in the values; don't leave any blank.

```
[MOTION SCALE: X]
Aspect ratio: 9:16
Negative prompt: morphing features, distorted limbs, flickering, warped geometry, extra fingers
```

**MOTION SCALE quick reference:**
- Atmospheric / stillness → `0.3`
- Single deliberate action → `0.5`
- Dynamic action burst → `0.7`
- Environmental chaos (no characters) → `1.0`

**Aspect ratio quick reference:**
- TikTok / Reels / vertical → `9:16` (default for short-form)
- Cinematic / widescreen → `16:9`
- Square / Instagram → `1:1`

**Negative prompt by category (5-8 terms each, priority-ordered — identity first, motion second, style third):**

*Action / fantasy / character:*
```
morphing features, shifting jawline, extra limbs, distorted joints, sliding feet, modern clothing, power lines
```

*Product ad:*
```
distorted product geometry, morphing label, extra objects, unstable focus, flickering
```

*Realistic human / commercial:*
```
de-aging, extra fingers, skin texture shift, clothing color change, blurry face
```

*With dialogue (swap last 2 base terms for these — stay ≤8 total):*
```
garbled speech, audio desync, overlapping voices
```

*Multi-shot (swap last 2 base terms for these — stay ≤8 total):*
```
character drift between shots, tonal shift between cuts, inconsistent lighting
```

---

### Negative Prompt Placement Rule

The negative prompt must always be a **separate block at the end of the prompt**, never embedded mid-sentence or after a style tag inline.

**Wrong:**
```
Shot on 35mm, Kodak Portra 400, Film grain, 8k resolution--negative_prompt: text, watermark...
```

**Correct:**
```
Shot on 35mm, Kodak Portra 400, Film grain, 8k resolution.
[MOTION SCALE: 0.5]
Aspect ratio: 9:16
Negative prompt: text, watermarks, morphing features, extra limbs, blurry faces
```

---

## Dramaturgical Framework

Creative checks that sit above model-specific prompting. Apply these before writing shot-level prompts. The three-detail audit is the *mechanism* that produces strong prompts — it turns the weak/strong distinctions in [Prompt Philosophy](#prompt-philosophy-kling-30) into a concrete checklist.

### Three-Detail Audit

Every shot must contain three concrete physical details. A shot missing any of these is filler — rewrite or delete it.

1. **Environmental pressure.** A physical fact about the space that carries the emotion. Cold refrigerator light. Wet asphalt. Flickering fluorescent. Steam from a kettle. Rain on a windowpane. Curtain breathing in the AC.
2. **Physical micro-action.** The emotion translated into the actor's body. Jaw locks. Knuckles whiten. Lips press flat. Eyes drop. He swallows hard. Fingers curl against the doorframe.
3. **Sound anchor or visual motif.** A recurring perceptual hook tied to the spine of the piece. Reflection in dark glass. The same musical sting at every turning point. Footsteps in an empty corridor.

**Banned phrasing** — each is a placeholder for absent detail. These terms are banned as substitutes for concrete detail in `[Subject]`, `[Action]`, `[Context]` blocks. They are valid in `[Style & Ambiance]` as genre/aesthetic anchors (e.g., "Photorealistic cinematic fantasy" is a legitimate style anchor; "cinematic lighting" in `[Action]` instead of naming the actual light source is not).
- "cinematic", "professional", "high quality", "masterpiece", "stunning", "epic"
- "beautiful lighting", "dynamic camera", "intense moment", "powerful scene"
- "he is sad", "she is angry" — emotions named without a body

Replace each with concrete physical facts. If you cannot translate an emotion into a body and an environment, the shot is not yet thought through.

### One-Anchor Principle

For any sequence or multi-shot batch, commit to exactly five anchors before writing shots:

1. **One main emotion.** The feeling the viewer carries out.
2. **One visual motif.** A recurring image that threads the sequence (reflections in glass, a recurring shadow, a specific color accent).
3. **One anchor object.** A physical thing the camera returns to (a phone, a branch, a door, a stone).
4. **One break.** The moment something changes irreversibly.
5. **One final image.** The last frame the viewer sees — name it before writing any shots.

This set constrains the sequence into something coherent. Without it, multi-shot batches drift into disconnected pretty frames.

### Story Spine (Multi-Shot)

Before writing shot-level prompts for a multi-shot batch, write one paragraph stating:
- What the character wants in this clip
- What blocks them
- What changes between the first and last frame

```
Story: Sisyphus strains against the boulder on the steepest section of the slope.
His foot slips on loose gravel. He catches himself, digs in harder. The boulder
moves one agonizing inch. His face shifts from desperation to grim resolve.
```

This paragraph never appears in the final Kling prompt — it's a brief for yourself that ensures every shot serves the arc. Without it, multi-shot sequences become disconnected camera exercises.

### Five-Second Rhythm Scaffold

Default dramatic micro-arc for short multi-shot clips (5s). Use as a starting template, then adjust timing per shot. Round up to 1s minimum per shot when writing actual multi-shot prompts — the sub-second beat positions below are pacing targets, not literal shot durations.

```
0.0–0.8s  | Establish    | ECU or insert anchoring emotion/situation
0.8–1.6s  | Action       | medium shot, subject moves or reacts
1.6–2.5s  | Turn         | new framing reveals the shift (POV, OTS, rack focus)
2.5–3.6s  | Reaction     | tight close-up, slow push-in, emotion lands on the body
3.6–5.0s  | Climax/hero  | hero shot, low angle, slow-mo if earned, final image
```

For 10s clips, double the structure or insert a pause before the climax. For 15s, split into 3 × 5s multi-shot batches and stitch in the editor — Kling is more reliable in shorter generations.

### Action Choreography Framework

A structured way to decompose fight sequences, chase scenes, and physical confrontations into per-beat prompts. Fight choreography as a whole is HIGH RISK (limbs warp, physics break, proportions distort) — but individual beats within a fight vary wildly in risk. The framework forces you to think in beats, evaluate each one independently, and route the dangerous ones through the Workaround Playbook while keeping the achievable ones.

#### Beat Decomposition

Every action sequence is a series of beats. Each beat has four layers:

| Layer | What it controls | Example |
|-------|-----------------|---------|
| **A-Action** | What the aggressor/initiator does | Slow overhead swing, dominant standing posture, stalking circle |
| **B-Reaction** | What the receiver does in response | Hard recoil backward, collapse to ground, slide across wet surface |
| **Cinematic** | Visual effects layer — particles, speed, atmosphere | Dust burst on impact, slow motion on contact frame, bokeh crowd lights |
| **Camera** | Shot type and movement for this beat | Low angle crash zoom, side tracking shot, overhead crane drops fast |

Write each beat as a timestamped block. The A/B structure forces you to think about both characters' physical states — critical for END STATE tracking and cross-beat continuity.

```
[00:00–00:03]
→ A: explosive forward step, boot drives into B's chest, full force
→ B: body recoils backward, slides across wet asphalt
→ CIN: impact shake, dust burst from ground contact
→ CAM: Low angle, A's boot impact fills lower frame, ground level

[00:03–00:06]
→ A: sweeping low kick, full body rotation into momentum
→ B: legs swept, hard ground impact, face-down on asphalt
→ CIN: slow motion on contact frame, ambient haze thickens
→ CAM: Side tracking shot, follows B's slide across wet surface

[00:06–00:08]
→ A: slow circling, dominant posture, hood silhouetted against streetlight
→ B: crumpled on ground, one arm bracing
→ CIN: bokeh crowd lights tighten behind, amber backlight halo
→ CAM: Wide static shot, A circles B, crowd visible as depth layer
```

#### Dynamics Modifier

Each beat carries an intensity tag that maps to motion scale:

| Dynamics | Meaning | Motion Scale |
|----------|---------|-------------|
| **Explosive** | Fast, full-force, high-impact | 0.7–0.8 |
| **Deliberate** | Controlled, weighted, purposeful | 0.5 |
| **Slow** | Stalking, circling, tension-building | 0.3 |
| **Aftermath** | Stillness after violence, settling dust | 0.2–0.3 |

#### Per-Beat Risk Triage

After decomposing, run each beat through the risk matrix individually. The full sequence is HIGH RISK — individual beats may not be:

| Beat type | Typical risk | Why |
|-----------|-------------|-----|
| Single deliberate strike (one motion, one target) | MEDIUM | One focal action, predictable physics |
| Dominant standing posture over fallen opponent | LOW | Near-static, single character focus |
| Slow circling / stalking | LOW | Walking-speed motion, no contact |
| Pre-strike tension (wind-up, held fist, locked stare) | LOW | Static or near-static pose |
| Aftermath hold (winner stands, loser on ground) | LOW | Static composition |
| Sweeping kick with full rotation | HIGH | Multi-joint choreography, physics chain |
| Impact + slide across surface | HIGH | Contact physics, surface interaction |
| Rapid exchange (punch-block-counter) | HIGH | Multiple simultaneous motions |

**Route:** LOW and MEDIUM beats → write Kling prompts directly. HIGH beats → apply the Workaround Playbook (silhouette, hard cut, aftermath, split cause/effect). See `animation-prompts.md` → Workaround Playbook → Fight / Combat.

#### Converting Beats to Kling Prompts

Each viable beat becomes its own shot in a multi-shot batch or a standalone I2V generation. Expand the four layers into the standard Kling template — the beat decomposition is planning scaffolding, not prompt syntax:

```
Beat decomposition (planning):
[00:06–00:08]
→ A: slow circling, dominant posture, hood silhouetted against streetlight
→ B: crumpled on ground, one arm bracing
→ CIN: bokeh crowd lights tighten behind, amber backlight halo
→ CAM: Wide static shot, A circles B, crowd visible as depth layer

Kling prompt (output):
[Cinematography]: Wide static shot, no camera movement
[Subject]: @FighterA — slow deliberate circling movement, hood up, shoulders squared
[Action]: measured steps around fallen figure, weight shifts heel-to-toe
[Context]: @FighterB crumpled on wet asphalt, one arm bracing upward.
  foreground: @FighterB 's bracing arm
  midground: @FighterA circling at arm's length
  background: crowd silhouettes, phone flashlights as scattered bokeh points
[Style & Ambiance]: Amber streetlight backlight behind @FighterA creating hood silhouette halo. Blue-amber split grade, 35mm grain, shallow DOF on crowd
[MOTION SCALE: 0.3]
Aspect ratio: 9:16
Negative prompt: morphing features, shifting jawline, extra limbs, sliding feet, floating objects, weightless, cartoon physics, crowd merging
```

The beat's A-Action became `[Subject]` + `[Action]`. B-Reaction became part of `[Context]` (since B is not the focal character in this beat). Cinematic became `[Style & Ambiance]`. Camera became `[Cinematography]`. The dynamics modifier (Slow) mapped to motion scale 0.3.

#### When NOT to Use This Framework

- Single-character action (one person running, climbing, lifting) — use the standard template directly
- Dialogue confrontation — use Talking Shot Strategies
- The sequence has fewer than 3 beats — just write individual prompts

This framework earns its overhead when you have 4+ beats of physical interaction between characters and need to systematically decide which beats Kling can handle and which need workarounds.

### Rhythm Ladder

Pacing variants for different dramatic contexts. These are **editorial timing targets** — the rhythm of the final edited piece. Sub-1s entries are achieved by trimming longer Kling clips in post-production, not by generating sub-1s clips (Kling minimum: 1s per shot in multi-shot, 3s standalone).

| Type | Shot durations |
|------|---------------|
| Slow-burn drama | 4s, 4s, 3s, 2s, 1s, pause, 2s |
| Product arc | 3s, 2s, 1.5s, 1s, 0.5s (macro), 2s (hero) |
| Anxiety build | 2s, 1s, 1s, 0.5s, 0.5s, 0.3s, pause, 1s |
| Impact scene | pause, 0.2s (flash), 2s (aftermath stillness) |

Always insert at least one pause before the biggest cut. The pause before impact is more important than the speed of the cuts.

### Dramaturgy Check (Run Before Sending)

Six-point check before returning any multi-shot prompt:

1. **Scene formula complete?** desire + obstacle + space geometry + gaze control + editing rhythm
2. **Three-detail audit passed?** Every shot has environmental pressure + micro-action + sound/motif anchor
3. **Every shot earns its place?** Each changes emotion, advances action, or increases pressure — if it does none, delete it
4. **Camera moves motivated?** Every camera movement answers "what changed?" — if nothing changed, the camera is static
5. **Spatial geometry readable?** Viewer always knows where the subject is, where the threat is, which direction is escape
6. **Five anchors named?** emotion, motif, object, break, final image

If any answer is no, fix before generating. Check 2 is the most violated.

---

### Checklist Before Generating

This is the per-shot dramaturgical and technical checklist for Kling prompts. For the full production quality checklist (all tools, all pipeline steps), see `animation-prompts.md` → Prompt Quality Checklist. For the theoretical foundation behind these checks, see `reference/video-dramaturgy.md`.

**Dramaturgical:**
- [ ] Three-detail audit passed: each shot has environmental pressure + micro-action + sound/motif anchor
- [ ] Five anchors named for the sequence (emotion, motif, object, break, final image)
- [ ] Story spine written before shot-level prompts (multi-shot only)
- [ ] No banned lazy phrasing ("cinematic", "epic", "he is sad" — use physical facts)

**Technical:**
- [ ] Aspect ratio specified (`16:9`, `9:16`, `1:1`)
- [ ] `[MOTION SCALE: X]` set explicitly
- [ ] One camera instruction only (not multiple simultaneous movements)
- [ ] Named light sources (not "dramatic" / "cinematic")
- [ ] Negative prompt block at the end — separate, not inline, 5-8 terms, priority-ordered
- [ ] For multi-shot: shots labeled with time codes (`Shot 1 (0–4s):`)
- [ ] For multi-shot: each shot prompt ≤25 words (prevents jitter)
- [ ] For multi-shot: NOT combined with end frame conditioning (mutually exclusive)
- [ ] For dialogue: word count validated (4-6/3s, 6-9/4s, 8-12/5s, 15-20/8s, 25-30/10s)
- [ ] For I2V: prompt contains only motion/camera/change — no scene re-description
- [ ] Every motion has an end state (prevents generation hangs)
- [ ] Hands anchored to objects, not floating free
- [ ] No camera movement combined with facial expression change in same clip
- [ ] Audio/SFX specified if sound matters
- [ ] `++key subject++` emphasis added for product/hero-element shots
- [ ] No simultaneous multi-axis camera movements (causes distortion)
