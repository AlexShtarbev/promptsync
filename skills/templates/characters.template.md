# Character Bible

> Fill one block per key character. Minimum: protagonist + antagonist. Ideally: every character who appears in more than three scenes.
>
> After script lock, each character here becomes a character element file (`storyboard/characters/{name}.md`) during the Character Design phase (workflow Step 8a). The Visual Identity and Reference Sheet Prompts sections below are the source of truth for the character's visual DNA — all storyboard and animation prompts reference these locked descriptions.

---

## Character Element File — Production Frontmatter

> When converting a character bible entry into a production element file (`storyboard/characters/{name}.md`), wrap the content in this YAML frontmatter. This is the canonical format — `animation-prompts.md` references it during prompt generation.

```yaml
---
name: "{Display Name}"
element_name: "{ElementName}"
element_type: character       # or: prop | environment | creature
appears_in: [1A, 2A, 3B]     # shot codes where this element appears
status: reference-done        # set after reference images are approved
element_status: not-created   # tracks whether Kling Element has been created in OpenArt
---
```

**`element_name` MUST be PascalCase with NO spaces.** This is the `@ElementName` used in nb-prompts, shot.md `elements` lists, and Kling/Seedance prompts. Spaces break OpenArt element binding.

**Derivation rule:** `element_name` is the kebab-case file prefix converted to PascalCase. Every word in the file prefix (including articles like "the") becomes a capitalized segment. The same PascalCase name is used everywhere — the element file's `element_name` field, the `@Name` in nb-prompts, the `elements` list in shot.md, and the element name when creating in OpenArt.

| File prefix | `element_name` | @-mention |
|---|---|---|
| `the-father` | `TheFather` | `@TheFather` |
| `carved-bird` | `CarvedBird` | `@CarvedBird` |
| `cafe-center` | `CafeCenter` | `@CafeCenter` |
| `beethoven-young` | `BeethovenYoung` | `@BeethovenYoung` |

**All four must agree:** file prefix (kebab) → `element_name` (PascalCase) → shot.md `elements` list → nb-prompt `@Name` → OpenArt element name. A mismatch at any point means the element won't bind during generation.

| Field | Values | Meaning |
|-------|--------|---------|
| `name` | Free text | Human-readable display name |
| `element_name` | PascalCase, no spaces — e.g. `DadAfter`, `DaughterNight` | The `@ElementName` used in prompts. Must match `elements` list in shot.md and `@Name` in nb-prompts exactly |
| `element_type` | `character \| prop \| environment \| creature` | What kind of element |
| `appears_in` | List of shot codes | Which shots reference this element |
| `status` | `draft \| reference-done` | `reference-done` = reference images approved and visual anchors locked |
| `element_status` | `not-created \| created` | Whether the Kling Element has been created in OpenArt |

---

## CHARACTER 1 — [NAME]

### Basic
- **Age:**
- **Role in the story:** (hero / antagonist / ally / mentor / shadow / trickster / threshold guardian)
- **Profession / position:**
- **Origin:**

### Appearance
- Description (1-2 sentences — what's visible from the first frame):
- Distinguishing marks:
- Dress code (how they dress at the start, how it changes by the end):

### Identity Block
> The identity block is the single source of truth for this character's physical appearance. It is repeated verbatim in every reference prompt and every Kling Element description, and it authors the OpenArt element that both Kling and Seedance reference by `@Name`. It is NOT pasted into Seedance prompt bodies — the element carries it. Write it once, lock it, reference it everywhere. Use material-specific language — "worn brown leather satchel with brass buckle" not "a bag."

```
Face: [shape, skin tone, eye color, brow shape, nose, lip shape, jaw, any scars/marks]
Hair: [color, texture, length, style — e.g. "dark brown wavy hair, shoulder-length, parted left, individual strands visible"]
Build: [height, body type — e.g. "tall lean frame, narrow shoulders, long limbs"]
Wardrobe: [every visible garment with material and condition — e.g. "heavy charcoal wool overcoat with visible weave, fraying at cuffs; cream linen shirt, top button open; dark brown leather belt, worn and creased"]
Distinctive: [the 2-3 features that make this character recognizable in any shot — e.g. "deep scar across left eyebrow, silver ring on right index finger, slight forward hunch"]
```

### Visual Identity (short-form especially)
- 2-3 signature visual traits:
- Distinct silhouette (recognisable in shadow):
- Signature expression:
- Consistent colour palette:

### Reference Sheet Prompts (NanoBanana)
> These prompts generate the character's visual DNA — one image per angle, each a standalone photorealistic generation. Write each prompt as a **natural language paragraph** briefing an artist, not as comma-separated keywords. NanoBanana is a thinking model — it interprets descriptive prose better than tag lists.
>
> Generate 4 separate images — one per angle. Each uploads directly to a Kling Element slot (max 4 images per Element). No cropping needed.
>
> **Heading convention:** `### Prompt N — View Name (AR, Resolution)`. The parenthetical is parsed by the PromptSync inject-text feature (Chrome extension) to set aspect ratio and output resolution when injecting prompts into OpenArt. Both values are required.
>
> **Rules:**
> - Paste the full Identity Block into every prompt — this is the character's visual DNA
> - Natural language paragraphs, not keyword lists
> - No numerical camera specs (no f-stops, no focal lengths, no ISO) — NanoBanana ignores them
> - Describe materials with specificity: "heavy charcoal wool overcoat with visible weave" not "dark coat"
> - Positive framing: describe what you want, not what to exclude
> - Flat soft even studio lighting on a mid-grey seamless backdrop — prevents environment bleed and shadow baking. Carry the **lean reference-plate close** (anti-plastic): skin matte and velvety with zero shine on forehead, nose bridge, cheekbones, temples, and chin, low-contrast milky look, true natural skin tone with warmth preserved against the neutral grey (never washed-out or cool-shifted), fine soft even pore texture and peach fuzz at the jaw and hairline, never plastic and never harsh — no acne, no blemishes, no enlarged pores. Do NOT use the full cinema / Optical Realism stack on a flat reference plate — the heavy stack pushes contrast back up and defeats the grey ground; the lean close does the matte/warmth work without re-introducing contrast
> - Generate 3-5 variations per angle at 0.5K for iteration, then upscale the winner to at least 1K (ideally 2K) before uploading to Kling Element. Do NOT upload 0.5K test images as Element references — low-res refs degrade identity anchoring

### Prompt 1 — Front Three-Quarter (3:4, 1K)
```
A photorealistic full-body three-quarter portrait of [CHARACTER NAME] facing slightly left, standing with arms relaxed slightly away from the body. [PASTE FULL IDENTITY BLOCK]. The skin has visible pores and natural texture, eyes are wet and reflective with clear catchlights, and individual hair strands are visible. Flat even studio lighting from all sides, mid-grey seamless backdrop, skin matte with zero shine on forehead, nose bridge, cheekbones, temples, and chin, true natural skin tone with warmth preserved, fine soft even texture, never plastic or harsh. This is a character reference image for maintaining visual consistency across multiple generations.
```

### Prompt 2 — Side Profile (3:4, 1K)
```
A photorealistic full-body side profile of [CHARACTER NAME] looking to the right, standing with arms relaxed slightly away from the body. [PASTE FULL IDENTITY BLOCK]. Keep facial features exactly the same as the front three-quarter reference — same bone structure, same skin texture with visible pores, same hair with individual strands visible. Flat even studio lighting, mid-grey seamless backdrop, skin matte with zero shine on forehead, nose bridge, cheekbones, temples, and chin, true natural skin tone with warmth preserved, fine soft even texture, never plastic or harsh. Character reference image for visual consistency.
```

### Prompt 3 — Back Three-Quarter (3:4, 1K)
```
A photorealistic full-body view of [CHARACTER NAME] seen from behind at a three-quarter angle, facing away from camera. [PASTE FULL IDENTITY BLOCK]. Show the back of the hair with individual strands and natural texture, the back and side details of the clothing with visible fabric weave and stitching, and natural body proportions matching the front reference. Flat even studio lighting, mid-grey seamless backdrop, skin matte with zero shine on forehead, nose bridge, cheekbones, temples, and chin, true natural skin tone with warmth preserved, fine soft even texture, never plastic or harsh. Character reference image for visual consistency.
```

### Prompt 4 — Extreme Close-Up Face (1:1, 1K)
```
An extreme close-up photorealistic portrait of [CHARACTER NAME]'s face filling the frame, neutral expression. [PASTE FACE DETAILS FROM IDENTITY BLOCK]. Visible skin pores, natural skin texture with subtle imperfections, wet reflective eyes with sharp catchlights, individual eyebrow and eyelash hairs visible. Keep facial features exactly the same as the three-quarter reference. Soft even lighting with no harsh shadows, centered framing against a mid-grey seamless backdrop. Skin matte with zero shine on forehead, nose bridge, cheekbones, temples, and chin, true natural skin tone with warmth preserved, fine soft even texture, never plastic or harsh.
```

### Expression Sheet (16:9, 1K)
```
A grid of six photorealistic head-and-shoulders portraits of [CHARACTER NAME] showing different expressions: neutral with calm eyes, genuine smile with raised cheeks, furrowed brow with clenched jaw, downturned mouth with glistening eyes, wide surprised eyes with raised brows, and quiet determination with set jaw. [PASTE FACE DETAILS FROM IDENTITY BLOCK]. Every cell uses the same three-quarter left head angle, same hairstyle, same skin texture with visible pores. Flat even studio lighting, mid-grey seamless backdrop, skin matte with zero shine on forehead, nose bridge, cheekbones, temples, and chin, true natural skin tone with warmth preserved, fine soft even texture, never plastic or harsh. Keep facial identity exactly consistent across all six expressions — only the expression changes, never the underlying face structure.
```

### Prompt 6 — Seedance Combined Reference Sheet (16:9, 1K)

> This single image authors the OpenArt element that Seedance references by `@Name`. It gives the model the character's identity from multiple angles in one frame — significantly better identity locking than a single-angle reference. Prompts 1–4 (separate angles) are for Kling Element slots; this combined sheet feeds the Seedance element.

```
A photorealistic multi-angle character reference sheet of [CHARACTER NAME], displayed as six panels side by side against a clean mid-grey seamless backdrop: far left panel shows full-body front view, second panel shows full-body rear view, third panel shows full-body left profile, fourth panel shows full-body right profile, fifth panel top shows a tight face close-up straight-on, fifth panel bottom shows a three-quarter face close-up. [PASTE FULL IDENTITY BLOCK]. The skin has visible pores and natural texture, eyes are wet and reflective with clear catchlights, and individual hair strands are visible. Soft even cinematic studio lighting across all panels, consistent exposure and color temperature. Skin matte with zero shine on forehead, nose bridge, cheekbones, temples, and chin, true natural skin tone with warmth preserved, fine soft even texture, never plastic or harsh. Each panel identical in lighting and grading so the figure reads as the same person from multiple angles.
```

### Kling Element Description
> Brief description for when creating the Element in OpenArt. Keep short — the 4 reference images carry the visual DNA. Do not re-describe appearance in Kling prompts once the Element is bound.

```
[CHARACTER NAME]. [1-2 sentences summarizing the most visually distinctive traits — enough for a human to identify the Element in a library of 20+, not enough to replace the reference images.]
```

### Seedance Character Lock
> Seedance references this character as the OpenArt element `@Name` — same as Kling. The element carries identity, so there is no reference-sheet upload and no Identity Block pasted into the Seedance prompt body. In the prompt body, write a `[Subject]: @Name — {motion/state}` line (PascalCase element name, space-after before text or a possessive, e.g. `@Name 's face`). See `reference/seedance-reference.md` → Character Locking and `animation-prompts.md` → Per-Shot Seedance Prompt File for the per-shot file format.
>
> The single uploaded image is the storyboard start frame (`@image1`), declared at the end of the body with `Use @image1 as start frame.` — it does not carry identity.

```
[Subject]: @Name — {per-shot motion/state}
```

> **Multi-subject shots:** reference the environment as `@EnvironmentName` in the `[World Plate]` block, and any wardrobe-state or secondary character by its own `@ElementName`. The character must be lit by the environment's actual light sources (not clean studio light) — state this in the lighting block. See `reference/seedance-reference.md` → Multi-Subject Element Workflow.

### Visual Anchors
> The 3-5 details that must remain consistent across every shot. These are the "if this changes, the character is broken" markers. Check every generated image against these before approving.

- **Anchor 1:**
- **Anchor 2:**
- **Anchor 3:**
- **Anchor 4 (optional):**
- **Anchor 5 (optional):**

### Consistency Notes
> Dos and don'ts for maintaining this character across generations. Include known failure modes from reference image generation and what to watch for during storyboard and video prompt phases.

- **Always:**
- **Never:**
- **Watch for:**

---

### Psychology
- **Hamartia** (the fatal flaw that triggers the tragedy or the arc):
- **Want** (visible external goal):
- **Need** (hidden internal requirement):
- **Flaw** (a defect they must *overcome* to grow — Sanderson):
- **Restriction** (a self-imposed rule they choose *not* to break — code, vow):
- **Limitation** (an external constraint they can only navigate, not change):
- **Fear** (what they fear most):
- **Values** (the principles that explain their hardest / least-obvious choices):
- **What must they sacrifice** (the price the climax will demand):
- **What they cannot forgive themselves:**
- **What they cannot forgive in others:**

### Sanderson Triad (dials, not checkboxes)
> Compelling characters don't max all three — one shines, one is moderate, one starts low. The low one is the arc. Over-dialing capability drains relatability. See `reference/methodology.md` → Character: Proactive, Relatable, Capable.
- **Proactive** — what choice does this character drive? (passive or constrained? show mental proactivity — planning, small acts)
- **Relatable** — what invites empathy or recognition? (relatable ≠ likable; fast levers: save-the-cat, self-awareness, universal detail, outside-view)
- **Capable** — what are they competent at, and where are they clearly weak?
- **Which axis starts low — i.e., what is the arc?**
- **Signature quirk** (what they're remembered for first — must connect to the core):

### Backstory (1-2 paragraphs)
[Where this person came from. How they became who they are. What event in the past made them this way.]

### Arc
- **Start point:**
- **Peripeteias / mid-arc reversals:**
- **End point:**
- **Arc type:** transformational (changes) / iconic (stays the same, world changes around them)

### Voice (SPEECH IDENTITY)
- **Line length** (short / long):
- **Register** (literary / colloquial / slang):
- **Slang** (yes/no, what kind):
- **Self-evaluation in speech** (justifies / doesn't justify):
- **Silent more than the others? Where?**
- **Patterns** (recurring phrases or words):

**Sample lines** (3-5):
1.
2.
3.

### Relationships
- **Warm with:**
- **Cold with:**
- **Tense / contradictory with:**
- **Unique form of address to key characters** (how this character calls each):

### Associated objects
- (object that signals this character on screen)

### Transformation States
> If this character's appearance changes significantly during the story — costume change, aging, injury that alters silhouette, supernatural transformation — each visually distinct state gets its own character element file (`storyboard/characters/{name}-{state}.md`) with its own Identity Block, reference images, and Kling Element.
>
> **Threshold:** would the reference images need to change? If yes → new state file. A torn sleeve or a different expression does not qualify. A full wardrobe change, visible aging, battle damage that alters silhouette, or a transformation (human → creature) does.
>
> **Naming:** Filename is kebab-case: `{name}-{state}.md` → e.g. `beethoven-young.md`, `hero-armored.md`. But `element_name` is PascalCase: `BeethovenYoung`, `HeroArmored`. Never use spaces in `element_name`.
>
> **Per-state OpenArt element:** Each transformation state file (`{name}-{state}.md`) gets its own OpenArt element for that state's wardrobe (its reference images show the new outfit from all angles with the same face/identity locked). Seedance references the state by its own `@ElementName` — same as Kling — so the correct state's element is named in the prompt body; never mix states within one clip.

| State | Appears in shots | What changes visually | Separate Element? |
|-------|-----------------|----------------------|-------------------|
| Base (default) | | | No — this IS the base Element |
| | | | Yes / No |
| | | | Yes / No |

---

## CHARACTER 2 — [NAME]

[Copy the structure above for each next character.]

---

## CHARACTER 3 — [NAME]

---

## CHECK: ARE THE VOICES DISTINGUISHABLE?

After filling everyone in, run this test:
1. Take a line from any character without the name attached.
2. Show it to someone else (or yourself the next day).
3. It should be obvious who spoke.

If two characters' lines sound identical — you don't have two characters, you have one. Sharpen the voices.
