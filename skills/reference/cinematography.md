# Cinematography — Camera Language for Story Saint

How to translate emotional states into shot size, camera angle, and camera movement.
Read after `short-form.md` and `timing-and-cutting.md`. Apply during storyboard handoff and image prompt writing.

---

## PRINCIPLE

Camera language is emotional subtext. Every choice — how far, from where, moving how — tells the viewer what to feel before a single word is spoken. The wrong shot can undercut a scene no matter how strong the writing. The right shot amplifies it without the viewer noticing why.

Three decisions per shot:
1. **Shot size** — how much of the world the viewer sees (how close the camera is)
2. **Angle / height** — where the camera is positioned relative to the subject
3. **Movement** — what the camera does during the shot

All three work together. Specify all three in every storyboard row.

---

## SHOT SIZE REFERENCE

Shots listed widest to tightest. Focal length in parentheses is the real-world equivalent — use it in image prompts to specify compression and depth of field.

| Shot | Framing | Focal Length | Emotional Baseline |
|------|---------|-------------|-------------------|
| **EWS** — Extreme Wide | Subject tiny or absent; full environment | 16–24mm | Scale, isolation, world-building |
| **WS** — Wide Shot | Environment dominates; subject provides scale | 16–35mm | Setting as story; context; exposure |
| **LS** — Long Shot | Full body head to toe; environment gives meaning to the subject | 24–35mm | Character placed in the world; distance; isolation |
| **FS** — Full Shot | Full body head to toe; subject and background balanced equally | 35mm | Movement, body language, environment together |
| **MLS** — Medium Long Shot | Knees to top of head | 35mm | Spatial awareness + detail; standing dialogue or action |
| **MWS** — Medium Wide / Cowboy | Mid-thigh to top of head | 35–50mm | Action-ready; physical presence; confrontation |
| **MS** — Medium Shot | Waist to top of head | 35–50mm | Conversational; neutral; balanced coverage |
| **MCU** — Medium Close-Up | Chest to top of head | 50–85mm | Emotional investment begins; facial + body cues |
| **CU** — Close-Up | Shoulders or neck to top of head | 85–135mm | High emotion; internal state visible; background falls away |
| **ECU** — Extreme Close-Up | Single feature: eyes, hands, mouth | 85–135mm | Peak intensity; detail as meaning |
| **Profile** | Subject at 90° to camera; side view | 35–55mm | Contemplation, withdrawal, emotional distance |
| **POV** — Point of View | What the character sees | Variable | Subjective; viewer becomes character |
| **OTS** — Over the Shoulder | Subject framed over another's shoulder | 50–85mm | Power dynamic; dialogue; surveillance |
| **Reverse** | Opposite perspective of a POV or OTS | 35–50mm | Reaction; other side of dialogue; spatial continuity |
| **Insert / Cut-in** | Object or detail isolated in frame | 85–135mm | Importance; Chekhov's gun; directs attention |
| **Two-Shot** | Two subjects in frame together | 35–85mm | Relationship, dynamic, connection |
| **Three-Shot** | Three subjects in frame | 35–50mm | Group unity (evenly spaced) or conflict (one separated) |

**Note on perspective shots:** Profile and Reverse describe the camera's position relative to the subject, not the framing distance. They combine with any shot size: Profile CU, Profile MS, Reverse MCU, etc. Specify both in the storyboard: "Profile — MCU" or "Reverse — MS."

**Focal length note for image prompts:** Longer focal lengths (85–135mm) compress facial features, blur backgrounds, and feel intimate or pressured. Wider lenses (16–35mm) expand space, create depth, and feel open or exposed. Specify in the prompt opening: `Shot on 85mm lens.` or `Wide 24mm lens — expansive depth.`

---

## CAMERA ANGLE / HEIGHT REFERENCE

| Angle | Position | Emotional Effect |
|-------|----------|-----------------|
| **Eye Level** | Camera at subject's eye line | Neutral; equality; connection; "you are them" |
| **Shoulder Level** | Camera at shoulder height | Slightly more cinematic than eye level; subtle dominance; standard |
| **Low Angle** | Camera below eye line, pointing up | Power, dominance, authority, fear, heroism |
| **High Angle** | Camera above, pointing down | Vulnerability, inferiority, exposure, pity |
| **Overhead / Bird's Eye** | 90° directly above | Omniscience; god's-eye; spatial clarity; dehumanising at extremes |
| **Aerial** | Very high elevation (drone / crane) | Awe, scale, context, grandeur; subject becomes a dot |
| **Hip Level** | Camera at waist/hip | Action-readiness; weapon-draw; confrontation |
| **Knee Level** | Camera at knee height | Emphasises movement; character feels larger |
| **Ground Level** | Camera at floor | Tension; dread; gritty realism; character as force above viewer |
| **Dutch Angle / Tilt** | Frame rotated off-axis | Disorientation, instability, wrongness, psychological distress |

**Rule:** Pair high and low angles within a scene to establish a power relationship. The character filmed from below dominates the one filmed from above — the viewer feels it even if they can't name it.

**Eye level caveat:** Eye level is "the angle of everyday life" — many filmmakers actively avoid it because it carries no perspective. When you choose eye level, it should be a deliberate choice for neutrality, equality, or realism — not a default. Shoulder level is often more cinematic and reads as subtly more dominant without calling attention to itself.

**Dutch angle precision:** Tilt the frame 15–45 degrees off its horizontal axis. A 15° tilt reads as uneasy; 30–45° reads as full destabilisation or madness.

---

## CAMERA MOVEMENT REFERENCE

| Movement | Description | Emotional Effect | AI Risk |
|----------|------------|-----------------|---------|
| **Static** | Camera fixed | Stability, weight, observation, dread (if held long) | SAFE |
| **Pan** | Rotate left/right on fixed axis | Reveals; follows action; smooth transitions | SAFE — keep slow and deliberate |
| **Tilt Up** | Rotate upward on fixed axis | Scale reveal; hope; aspiration; power | SAFE |
| **Tilt Down** | Rotate downward | Defeat; weight; reveals aftermath | SAFE |
| **Dolly In / Push** | Camera physically moves toward subject | Intensity rising; emphasis; threat approaching | SAFE |
| **Dolly Out / Pull** | Camera physically moves away | Loss; isolation; world receding; breathing room | SAFE |
| **Track / Truck L-R** | Camera moves sideways parallel to subject | Parallax depth; accompaniment; elegant reveal | MEDIUM |
| **Crane / Jib Up** | Camera rises on arc | Liberation; escape; hope; end-of-scene closure | MEDIUM |
| **Crane / Jib Down** | Camera descends on arc | Arrival; weight; pressure descending | MEDIUM |
| **Handheld** | Organic micro-shake | Realism, urgency, intimacy, chaos | SAFE |
| **Whip Pan** | Fast motion-blur pan | Energy; time jump; attention redirect | MEDIUM — fast motion can cause smearing artifacts |
| **Crash Zoom** | Sudden aggressive zoom in | Shock; surprise; comedy punctuation | SAFE |
| **Rack Focus** | Shift focus from near to far object (or reverse) | Reveals what was hidden; redirects attention; duality | MEDIUM |
| **Dolly Zoom / Vertigo Effect** | Dolly out + zoom in simultaneously (or reverse) | Panic, shock, sudden realization; world warps around static subject | HIGH |
| **Tracking Shot** | Camera follows subject (alongside, ahead, or behind) | Momentum; viewer is part of the action; accompaniment | MEDIUM |
| **360° Orbit** | Camera circles subject | Hero moment; reveal of full power; climax | HIGH |
| **Drone Sweep** | High aerial glide | Grandeur; scale; arrival; transition | HIGH |
| **Bullet Time** | Camera moves while subject freezes | Peak-of-action; heroic; time suspended | HIGH |

**AI risk key:**
- SAFE — reliable in Kling and similar AI video generators. Specify in prompt directly.
- MEDIUM — achievable but may require re-generation or a workaround.
- HIGH — often fails. Use still frame + post-movement, or cut around it.

---

## EMOTION → CAMERA LANGUAGE

The lookup table. For any emotional state in a scene, start here. All combinations are starting points — adjust for context.

| Emotion | Shot Size | Angle | Movement | Why It Works |
|---------|-----------|-------|----------|--------------|
| **Power / Dominance** | MCU → CU | Low angle | Slow dolly in | Subject towers over viewer; grows as camera closes |
| **Vulnerability / Defeat** | MS → WS | High angle | Slow dolly out | Character is shrunk and exposed; world pulls away |
| **Heroism / Defiance** | MCU or CU | Low angle | Static or slow push | Unflinching; elevated; fills the frame |
| **Isolation / Loneliness** | WS or EWS | Eye level or slight high | Extremely slow pull back | Subject swallowed by empty space |
| **Intimacy / Tenderness** | MCU → CU | Eye level | Very slow dolly in, or static | Equal footing; no distance; we're in their space |
| **Connection (two people)** | Two-Shot → intercut CUs | Eye level | Static, or very slow push on each CU | Space between them closes emotionally |
| **Tension / Dread** | MCU or CU | Dutch angle or low | Slow push, or static hold | Frame is wrong; something is coming |
| **Paranoia / Being Watched** | OTS from unknown POV, or WS | High angle or eye level | Slow dolly in from behind | Surveillance framing; viewer becomes the threat |
| **Disorientation / Madness** | ECU or MS | Dutch angle (steep) | Handheld, or whip pan | World is literally tilted; no stable ground |
| **Awe / Wonder** | EWS or Aerial | Aerial or high angle | Slow crane up, or drone sweep | Scale dwarfs the subject; viewer gasps |
| **Hope / Aspiration** | MS or WS | Low angle, or tilt up | Slow tilt up, or dolly back revealing sky | Movement is upward; possibility above |
| **Loss / Grief** | ECU (face or hands) OR WS | Eye level (intimate) or high (exposed) | Dolly out, very slow | ECU: pain is close. Wide: they are alone in the world. |
| **Determination / Resolve** | CU or MCU | Eye level or slight low | Static, or slow push | Direct gaze; no wavering |
| **Urgency / Chase** | MCU or MWS | Eye level or ground level | Handheld tracking | Kinetic camera mirrors physical urgency |
| **Revelation / Surprise** | Wide → smash cut to ECU | Eye level | Static, then crash zoom (if comedic) | Information hits hard; no preparation |
| **Emptiness / Numbness** | WS or EWS | Eye level | Very slow lateral track or static | Quiet movement through empty space; no urgency |
| **Nostalgia / Memory** | CU or MCU | Eye level | Slight handheld drift, or slow dolly | Warm, close, slightly unstable — not quite present |
| **Fear (the character is afraid)** | CU on face, then POV of threat | Eye level (face) + low angle (threat) | Static on face; push on threat | We feel what they feel; threat is elevated |
| **Contempt / Cruelty** | MCU of perpetrator | Low angle (perpetrator) + high (victim) | Static or slow push on perpetrator | Visual hierarchy does the moral work |
| **Climactic Impact** | ECU or MCU | Eye level or slight low | Static, or bullet time freeze | Time slows at peak; maximum compression |
| **Liberation / Release** | WS → EWS | Low angle | Crane up, or dolly out + tilt up | Frame opens; constraint releases |
| **Entrapment / Compression** | MCU → CU → ECU | High angle increasing | Slow push; or cut tighter each beat | Frame closes around subject |
| **Quiet Dignity** | MS or MCU | Eye level | Static | No manipulation; just presence |
| **Contemplation / Withdrawal** | Profile (MS or MLS) | Eye level | Static, or very slow lateral track | No eye contact; character is inside themselves; observational detachment |
| **Group Unity** | Three-Shot, evenly spaced | Eye level | Static | Physical equality in frame = shared purpose or shared fate |
| **Group Conflict / Imbalance** | Three-Shot, one figure separated or at different height | Eye level or slight high on outlier | Static | Spatial separation does the narrative work without dialogue |
| **Discovery (unknown threat)** | Cutaway to object or location | Eye level or slight high | Static or slow push | Viewer sees what character hasn't noticed yet; dread from information gap |
| **Emotional Response / Reaction** | CU reaction shot (face only) | Eye level | Static | Internal state revealed; often stronger than showing the cause |
| **Shock / Panic / Rupture** | MCU | Eye level | Dolly zoom | World literally warps; psychological break made physical |
| **Anger / Rage** | CU or ECU | Low angle or eye level | Static or very slow push | Face fills frame; low angle = dangerous; stillness before eruption |
| **Shame / Humiliation** | MS or MCU | High angle | Static; or slow dolly out | Looked down upon; camera pulls away as if repelled |
| **Anticipation / Buildup** | MCU or Insert | Eye level | Very slow dolly in; or rack focus to object | Creeping intensity; attention narrows to the thing that matters |

---

## COMBINATION PATTERNS

Named combinations for recurring cinematic moments. Reference these in the storyboard Notes column.

**THE REVEAL PUSH**
Slow dolly in on CU, static angle. Used at the moment a character understands something. The camera closes the distance as the realisation hits.

**THE ISOLATION PULL**
Dolly out from MCU to WS or EWS, eye level. Used for loss, departure, death, or the moment a character is left behind.

**THE POWER RISE**
Low angle static on subject, combined with tilt up or crane up. Used for the first moment of genuine authority — the character who was small is now enormous.

**THE VERTIGO MOMENT**
Dolly out + zoom in simultaneously (Vertigo / Jaws effect). World warps around a static character. Use for psychological rupture: a revelation that breaks their world. HIGH AI risk — best achieved as a still frame in post.

**THE DUTCH ESCALATION**
Intercut two characters in conversation, each on a Dutch angle that tilts slightly further with each cut. Used for arguments, power struggles, or breakdown. The frame breaks apart as the scene does.

**THE SURVEILLANCE APPROACH**
High angle static on character from a distance. Cut to slow dolly in from slightly behind, at shoulder level. The viewer becomes the threat. Used for paranoia and being-watched sequences.

**THE GRIEF TWO-SHOT**
Begin on two-shot (both characters in frame). Cut to individual CUs at eye level — no Dutch, no high angle, just straight on. The plainness is the emotion. Do not add camera movement. The stillness is the weight.

**THE HERO FREEZE**
At the peak moment of action: cut to MCU or CU, low angle, static or extreme slow push. Hold one beat longer than feels comfortable. The discomfort is the gravity.

**THE REACTION CUTAWAY**
Cutaway to the cause (insert or wide) → cut back to CU reaction shot on the character's face. The reaction shot often carries more emotion than the event itself. The sequence: establish the cause, then let the face do the rest.

**THE PROFILE TURN**
Begin on a profile shot (character in 90° view, no eye contact). At the emotional peak — a realization, a decision, a break — cut to or pan to a frontal CU at eye level. The turn into the camera is the moment of emotional opening.

**THE TRACKING FOLLOW**
Camera tracks alongside or slightly behind a walking character at their height (eye or shoulder level). Used during internal monologue moments, approach to a destination, or the aftermath of a scene. The movement says: we are with them, wherever they're going.

**THE EMOTIONAL ARC PROGRESSION**
Begin the scene on wide shots. As the character becomes more emotionally open or vulnerable, progressively cut tighter: WS → MLS → MS → MCU → CU. The shot size mirrors the internal state. Do not jump — let the tightening earn the close-up.

**THE TWO-SHOT EDITORIAL RULE**
Use the two-shot as the default coverage for a scene between two characters. Hold it. Then cut to a tight single only for the killer line or the most important emotional beat. The two-shot builds; the single lands.

---

## SHOT SEQUENCING

How shots work in sequence matters as much as individual shot choices.

**The 180-degree rule:** Keep the camera on one side of an imaginary axis drawn between characters. Crossing the axis disorients the viewer's spatial map of the scene. Only break it intentionally — to signal a power shift, a break in reality, or a perspective change.

**Pacing through cut rhythm:**
- Fast cuts (under 2s per shot) = tension, excitement, chaos, urgency
- Slow cuts (4s+ per shot) = weight, contemplation, dread, beauty
- A single slow shot after rapid cutting = everything stops; maximum emotional weight
- A rapid cut after stillness = jolt, shock, intrusion

**Screen direction:** If a character moves left-to-right in one shot, maintain that direction in the next or the viewer's spatial sense breaks. Reversal of direction signals reversal of momentum — use it purposefully.

**Eyeline match:** When cutting between two characters looking at each other, the eyelines must cross. Character A looks screen-right; Character B looks screen-left. Breaking this breaks the conversation.

**Wide → tight as emotional vulnerability arc:** Starting a scene wide and cutting progressively closer mirrors a character becoming emotionally exposed. A scene that opens tight and pulls back signals control giving way to isolation.

---

## FUNCTIONAL SHOTS

These are defined by editorial purpose, not by framing or distance. A reaction shot is a CU; a master shot is a WS; but what makes them distinct is *why* you cut to them. Some overlap with the Shot Size or Movement tables — this table tells you when to reach for them.

| Shot | What It Is | When to Use |
|------|-----------|-------------|
| **Master Shot** | Wide or long shot capturing all action in one take; anchor for the scene | Scene opening; pauses in action; gives the edit coverage to breathe |
| **Establishing Shot** | Wide or EWS at the start of a scene; sets tone, time, location | Opening of any new location; reorienting after time jump |
| **Cutaway** | Jump to something related but outside the main frame | Builds tension by showing what the character hasn't seen; adds context without dialogue |
| **Reaction Shot** | CU of a character's face in response to an off-screen event | After a key line, reveal, or action; often more powerful than showing the event itself |
| **Tracking Shot** | Camera follows subject through environment (see Movement table) | Momentum; accompaniment; approach sequences; characters in transit |
| **Sequence Shot** | Single continuous take without cuts | Viewer experiences moment in real time; used for maximum impact at a peak scene |

**Short-form note:** Establishing shots and master shots are often cut in short-form content for time. If you use them, they must earn their seconds — an establishing shot that doesn't tell the viewer something new is wasted screen time.

---

## VISUAL CONTRAST PRINCIPLE

The emotional impact of a shot depends partly on what preceded it.

- A close-up hits harder after a wide.
- A low angle reads as power only if the character was filmed neutrally or from high before.
- A static shot after frenetic handheld creates stillness with enormous weight.
- An overhead after a series of eye-level shots breaks the established relationship.

Design the sequence, not just the shot.

Minimum contrast rhythm for short-form:
- Every 3-4 shots, change at least two of: shot size / angle / movement.
- Never use the same shot size three times in a row without a reason.
- Alternate movement and static. Movement → static = emotional landing. Static → movement = tension building.

---

## FRAMING TECHNIQUES

These techniques modify any shot size or angle. Specify them in the image prompt.

**Negative space:** Empty area around the subject. More negative space = more isolation, vulnerability, or insignificance. A character framed small against a vast empty wall reads as lonely; the same character filling the frame reads as present. In image prompts: `Subject in lower-left third, rest of frame empty.`

**Looking room / lead room:** Space in the direction the character is facing or moving. A character looking screen-right with space to the right feels natural and open. Remove the looking room (character pushed to the right edge, looking right into the frame boundary) and the shot feels claustrophobic, trapped, or tense. In image prompts: `Subject faces screen-left with ample looking room` vs `Subject faces screen-left, no space ahead — pressed against frame edge.`

**Headroom:** Space above the subject's head. Standard framing leaves a small gap. Too much headroom makes the character feel small or lost. No headroom (head touching or cut by the top of frame) creates pressure or intimacy. In image prompts: `Tight headroom — top of head nearly touching frame edge.`

**Rule of thirds vs centre-frame:** Placing the subject off-centre (rule of thirds) feels dynamic, natural, and draws the eye along the frame. Centre-frame (subject dead centre, symmetrical composition) feels deliberate, confrontational, or powerful — the Kubrick one-point perspective. Choose based on the scene's tone. In image prompts: `Subject centred, symmetrical composition` vs `Subject placed on right third.`

---

## RESOLUTION-AWARE DETAIL

Describe what the camera at this position can physically resolve — not what's "true" about the subject. Before writing any visual detail, run three checks: at this **distance**, would the lens resolve it? at this **motion** level, would it read? at this **lighting**, would it be visible? If no, drop it. Detail is earned by camera proximity, lens length, motion stillness, and lighting intensity.

This kills a specific failure: over-describing detail the model then hallucinates at the wrong scale — a logo rendered crisp on a car 200 ft away and motion-blurred, a micro-expression on a figure 50 yards into a wide.

| Camera condition | What the rule does |
|---|---|
| Car from 200 ft, at speed, at dawn | Decals, badges, windshield text, wheel-spoke count NOT resolvable → drop. Reads as silhouette + colour blocks + headlights + motion-blur trails. |
| Person crossing a wide plate at 50 yards | Facial expression, jewellery, fabric weave NOT resolvable → drop. Reads as silhouette + hair colour + wardrobe colour blocks + posture. |
| Character in a moody night scene lit by one practical | Pore detail, peach fuzz, micro-expression NOT visible → drop. Reads as face shape + eye glints + key wardrobe catching light. |
| Same car tight and static at 20 ft | Decals, badge, wheel detail readable → describe them. |
| Same person in a medium two-shot at 8 ft | Expression, jewellery, wardrobe detail clear → describe them. |

Applies to both NanoBanana stills and Seedance/Kling video. In the storyboard, let it trim the Subject & Action and Color & Mood columns; in prompts, it trims `[Subject]` / `[Frame Map]` detail to what the framing can hold.

---

## NIGHT CINEMA REGISTER

Theatrical night cinema is **mostly dark, with hard practicals cutting through** — never bright-night, never saturated-teal-everywhere, never AI-fantasy-render glow. Two modes:

**A. Exterior / open night (cliffs, canyon roads, remote).** Light comes exclusively from practicals in the scene — headlights, brake lights, dash spill, distant city glow. No ambient moonlight lift. Sky and surroundings commit to deep crushed near-black. A faint contained horizon glow may read at far distance (small abstract neon — magenta / cyan / amber — not bright enough to light anything in the foreground). Atmospheric haze catches beams as visible volumetric cones. Subjects read primarily as silhouettes with practical light defining their forward edges.

**B. Interior / urban / lit night (garages, warehouses, streets, cabins).** Practicals drive the look — sodium-vapour lamps, fluorescents, neon, dash glow, brake lights. A teal-amber split reads here because the sources motivate it (cool sodium / fluorescent / neon vs warm dash / brake / amber). Haze gives light volumetric body; background subjects readable through the lit zones.

**Both modes:** deep cinematic contrast (shadows deep but holding information, highlights hot but not clipping to mush); practicals punch hard with real intensity and volumetric throw, never diffused into flat mush; subjects defined against the dark by rim / edge light from practical sources — never flat-lit, never vanishing into silhouette-soup; skin reads warm against cool ambient wherever any cool ambient exists, true skin tone preserved through the grade. The anti-pattern is uniform bright "night" with teal everywhere — the AI default. Aim for mostly-dark with motivated punch.

---

## APPLYING THIS IN STORYBOARD HANDOFF

When filling the storyboard TSV (see `storyboard.md` for the full TSV spec and PromptSync directory structure):

**Shot Type column** — combine angle + size as a single entry. The storyboard TSV has no separate angle column, so prefix the shot size with the angle when it's not eye level:
`Low angle MCU`, `High angle WS`, `Dutch CU`, `Eye level MS` (or just `MS` — eye level is the implicit default).

Shot size abbreviations:
`EWS / WS / LS / FS / MLS / MWS / MS / MCU / CU / ECU / Profile / POV / OTS / Reverse / Insert / Two-Shot / Three-Shot / Master / Establishing / Cutaway / Reaction`

**Camera Movement column** — use format: `[movement] [direction if relevant] — [speed]`
Examples: `Static`, `Dolly in — slow`, `Tilt up — fast cut`, `Handheld — slight drift`, `Rack focus near→far`

**Image Prompt** — include all three decisions (size, angle, movement) plus framing:
`Low angle medium close-up. Shot on 85mm lens. Camera static. Subject fills lower two-thirds of frame, sky behind. Ample looking room screen-right.`

If the emotion column of your storyboard is clear, camera language should follow mechanically from this file. If you're unsure which shot to use — name the emotion first, then look it up here.

---

## 9:16 VERTICAL FORMAT

Vertical (9:16) is the dominant delivery format for Shorts, Reels, and TikTok. It restricts horizontal scope but excels at intimacy, vertical scale, and dynamic vertical movement. These adaptations apply on top of all the guidance above — the emotion → camera language table, framing techniques, and combination patterns still hold; they just need vertical-aware execution.

### Vertical Strengths — Lean Into These

| Strength | Why It Works | Example |
|----------|-------------|---------|
| **Vertical scale** | Tall elements fill the frame naturally — slopes, cliffs, buildings, standing figures | Sisyphus pushing boulder uphill: man in lower third, boulder and slope dominating upper two-thirds |
| **Intimacy** | The narrow frame puts the viewer close to a single subject | Close-up fills the frame without dead side space |
| **Vertical movement** | Upward/downward motion reads powerfully | Crane up, tilt up, falling objects, climbing |
| **Depth layering** | Foreground/midground/background stack vertically | Rocks in foreground at bottom, character in midground center, sky/mountain in background top |
| **Strong vertical lines** | Architecture, trees, cliffs, standing figures, swords, staffs | Use vertical elements as natural frame guides |

### What Struggles in Vertical

| Challenge | Why | Workaround |
|-----------|-----|------------|
| Wide panoramic establishing shots | Horizontal scope is cut — environments feel cramped | Use tall establishing shots: low-angle looking up at a cliff face, or overhead looking down at a path. Vertical environments (canyons, forests, stairs) work naturally |
| Wide pans (horizontal) | Pan covers too little ground, feels constrained | Replace with vertical tilt (up/down) or dolly forward/backward. Use subtle parallax instead of panning |
| Two-shots side by side | Characters get squeezed horizontally | Stack characters: one foreground low, one background high. Or use over-shoulder with depth separation |
| Landscape-oriented scenes | Horizons feel thin, environments look narrow | Push the horizon to the upper or lower fifth. Use vertical elements to fill the frame. Embrace negative space above/below |
| Wide action choreography | Limited horizontal space for lateral movement | Channel action vertically: climbing, falling, pushing uphill. Or use tight tracking alongside |

### Camera Moves — Vertical Effectiveness

| Movement | Vertical Effectiveness | Notes |
|----------|----------------------|-------|
| **Static** | Excellent | Stability, weight — works identically to 16:9 |
| **Tilt up / crane up** | Excellent | Natural vertical reveal — scale, hope, aspiration. Use heavily |
| **Tilt down** | Excellent | Weight, defeat, arrival — vertical strengths |
| **Dolly in / push** | Excellent | Intensity, approach — frame feels tighter faster |
| **Dolly out / pull** | Excellent | Isolation, loss — works well as vertical recession |
| **Low-angle static** | Excellent | Hero shots — subject towers in the vertical frame, sky behind |
| **Overhead top-down** | Excellent | Scale reveal, abstract pattern — maximizes the vertical canvas |
| **Tracking alongside** | Good | Side-tracking at character height — maintains subject in center strip |
| **Handheld** | Good | Urgency, intimacy — organic micro-shake works in any format |
| **Pan (horizontal)** | Poor | Covers too little horizontal distance — feels cramped. Avoid or keep very subtle |
| **Whip pan** | Poor | Fast horizontal sweep in narrow frame — smearing artifacts compounded by limited horizontal scope. Avoid in 9:16 |
| **Wide lateral dolly** | Poor | Same problem as pan — limited horizontal reveal |
| **Drone sweep (horizontal)** | Poor | Horizontal grandeur doesn't translate. Use vertical drone descent or ascent instead |

### Composition Strategies for 9:16

**Vertical rule of thirds:**
Place the horizon high (upper fifth) or low (lower fifth) — never center. The dominant subject should sit at one of the vertical third intersection points.

**Depth layering (critical in vertical):**
The narrow frame makes depth your primary tool for visual interest. Always layer:
```
Bottom of frame:  foreground — rocks, gravel, feet, ground detail
Center of frame:  midground — character, primary action
Top of frame:     background — sky, mountain, environment, destination
```

**Negative space above and below:**
Use empty space deliberately:
- Empty sky above a character = isolation, aspiration, scale
- Empty ground below a falling object = dread, gravity, height
- Empty space around a centered subject = quiet dignity, focus

**Vertical lines as frame guides:**
Cliffs, trees, pillars, standing figures, doorways, swords — these give the vertical frame structural backbone. A scene without vertical elements in 9:16 feels shapeless.

**Center-frame composition for vertical:**
Center-frame symmetry works exceptionally well in 9:16 — the narrow frame gives symmetrical shots a powerful, confrontational quality. Use for moments of resolve, power, or direct address.

### Emotion → Camera — Vertical Adaptations

The main emotion → camera table applies. These adaptations optimize specific emotions for 9:16:

| Emotion | 16:9 Default | 9:16 Adaptation |
|---------|-------------|-----------------|
| **Isolation / Loneliness** | EWS, slow pull-back | WS with massive negative space above and below; character tiny in center of tall frame |
| **Power / Dominance** | Low angle MCU, dolly in | Low angle CU — subject towers into the top of frame, ground visible at bottom. Sky behind gives scale |
| **Awe / Wonder** | EWS / Aerial, drone sweep | Low angle tilt up — camera starts at ground, tilts up to reveal towering environment. Vertical scale is the awe |
| **Vulnerability / Defeat** | High angle MS, dolly out | Overhead looking down — character small, exposed, surrounded by empty vertical space |
| **Heroism / Defiance** | Low angle MCU, static | Low angle full shot — full body visible, strong vertical stance fills the frame. Vertical format emphasizes standing tall |
| **Urgency / Chase** | Handheld tracking MCU | Handheld tracking slightly behind — narrow frame creates claustrophobic tunnel effect. Movement is forward into depth, not across |
| **Liberation / Release** | WS → EWS, crane up | Crane up from MCU to WS — the vertical rise IS the liberation. Frame opens upward |

### Cinematic Enhancement for Vertical

Vertical format defaults to "phone video" in the viewer's mind. These techniques signal "cinematic" even in 9:16:

**Depth of field:** Shallow DoF is more important in vertical than horizontal — it separates planes in the narrow frame and signals professional optics. Always specify: `"shallow depth of field, subject sharp, foreground and background soft."`

**Film grain and texture:** Even subtle grain signals "shot on film" rather than "phone camera". Add `"subtle film grain"` to vertical prompts.

**Color grading:** Strong cinematic grading (teal/orange, desaturated with warm accents, bleach bypass) fights the "phone video" association. Reference `nanobanana-artistry.md` for palette options.

**Anamorphic-style effects in vertical:** Oval bokeh and subtle horizontal lens flares still read as cinematic even in 9:16 — they create a tension between the vertical frame and horizontal optical artifacts that feels premium. `"anamorphic-style oval bokeh, subtle horizontal lens flare"`. **Tool note:** This aesthetic works well in NanoBanana storyboard images and Kling prompts. For Seedance, use spherical primes instead — Seedance handles anamorphic poorly (see `seedance-reference.md` → Prompt Anatomy).

**Letterboxing (optional):** Thin black bars at top and bottom of 9:16 signal "cinematic crop" — useful for establishing shots or key emotional beats. In image prompts: `"thin cinematic letterbox bars at top and bottom."`

**24fps motion feel:** For Kling prompts, specify `"24fps cinematic motion cadence"` — this is the frame rate associated with cinema, vs. 30/60fps which reads as video/phone.

### Vertical Combination Patterns

Named camera patterns optimized for 9:16. Reference these in the storyboard Notes column alongside the standard Combination Patterns above.

**THE VERTICAL REVEAL**
Low angle static → crane up over 4–6 seconds. Camera starts at ground level near the character, then rises to reveal the full vertical environment (slope, building, cliff). The 9:16 frame makes the vertical reveal feel infinite. Use for first establishing shots or moments of awe/scale.

**THE HERO GROUND SHOT**
Very low ground-level dolly tracking forward, looking up at the character. Subject towers in the vertical frame, sky or environment above. Exaggerates size and power. Use for determination, defiance, heroic moments. Pair with `"35mm lens, shallow depth of field"`.

**THE PARALLAX TRACK**
Sideways parallax tracking with explicit depth layering — foreground elements (rocks, debris, vegetation) rush past frame while background (mountains, sky) drifts slowly. Enhances 3D spatial awareness in the narrow vertical frame. Use for movement through environment, following action, establishing spatial depth. Prompt: `"parallax tracking shot, foreground rocks rushing past, background mountains drifting slowly, strong depth layering."`

**THE OVERHEAD DESCENT**
High-angle overhead camera descending vertically as action happens below. The vertical frame matches the vertical camera path — the descent feels natural and dramatic. Use for scale reveals, falling objects, aftermath views. Especially effective for showing a boulder rolling downhill from above.

**THE INTIMATE PUSH**
Slow dolly in from medium shot to close-up, low angle, following a character's effort. The vertical frame tightens faster than 16:9, creating pressure. Use for physical strain, emotional intensity, building to a breaking point.

**THE VERTICAL CRANE + TILT**
Crane up while tilting down slightly to keep the subject framed. A single coherent rig motion that Kling handles well. Use for epic scale reveals where you want the environment to grow while maintaining the subject. See `kling-reference.md` — safe compound movements.

### Vertical Negative Prompts

Add to the negative block for all 9:16 generations. **Seedance note:** Seedance 2.0 ignores traditional negative prompts — convert these to positive-framed quality guards instead (see `animation-prompts.md` → Seedance Positive Quality Guard Assembly → Vertical format row).

**Framing negatives:**
```
wide horizontal composition, landscape framing, cramped side elements,
distorted vertical proportions, stretched horizontally, empty side space,
bad vertical framing, horizon in center, weak vertical lines
```

**Camera negatives (add when specifying movement):**
```
camera drift, unwanted zoom, shaky handheld unless specified,
horizontal panning, static camera when movement specified,
weak vertical movement, abrupt camera direction change
```

### Image Prompt Additions for Vertical

When writing NanoBanana prompts for 9:16 delivery, add these cues:

```
Vertical 9:16 composition. Strong vertical lines. Layered depth —
foreground detail at bottom, subject in center, environment above.
[Rule of thirds / center-frame] vertical placement. Shallow depth of field.
Cinematic vertical framing, not phone camera.
```

---

## WHAT THIS FILE DOES NOT DO

1. Does not override the AI animation risk rules in `short-form.md`. HIGH RISK movements still need cinematic workarounds.
2. Does not replace craft judgment. These are defaults and starting points, not rules.
3. Does not cover colour grading or depth of field beyond what the focal length note covers — those belong in the image prompt style prefix. Use the focal length guidance in this file to specify lens compression in prompts.
4. Does not apply to long-form page-format scripts. Use it during the storyboard phase only.
