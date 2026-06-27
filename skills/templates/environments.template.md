# Environment Lockdown File

> One file per distinct location. Generated during Step 2b of the storyboard pipeline.
> This file is the single source of truth for the location's spatial geometry, lighting,
> and visual identity. Every nb-prompt in this location copies the canonical environment
> block from this file verbatim.
>
> **The principle:** Generate environments empty first, then insert characters. Never let
> the model invent the room around the character.

---

## Production Frontmatter

```yaml
---
name: "{Location Display Name}"
element_name: "{EnvironmentName}"
element_type: environment
appears_in: [{shot codes where this environment is visible}]
status: draft              # draft | reference-done (after master plates approved)
element_status: not-created # not-created | created (after OpenArt element created)
risk: "{low|medium|high}"  # spatial drift risk — see risk assessment table
---
```

**`element_name` MUST be PascalCase with NO spaces.** Derivation: kebab-case file prefix → PascalCase. `cemetery-bench.md` → `CemeteryBench`. Used as `@CemeteryBench` in all nb-prompts.

---

## Risk Assessment

| Risk factor | HIGH | MEDIUM | LOW |
|---|---|---|---|
| Interior vs exterior | Interior (walls, furniture, windows) | Semi-enclosed (porch, gate, archway) | Open exterior (landscape, field) |
| Shot count | 10+ shots | 3-9 shots | 1-2 shots |
| Recurring across episodes | Yes — geometry must carry | No — single episode | N/A |
| Anchor objects | Many (table, cross, bed, window) | Some (bench, tree, gate) | Few (sky, ground) |
| Camera angle variety | Multiple angles including reverse | 2-3 similar angles | Single angle |

Take the highest risk across all factors.

---

## Spatial Map

> Describe the exact physical layout. Use compass directions or stage directions
> (camera-left, camera-right, upstage, downstage) consistently throughout. This is
> a production document, not a prompt — be precise about positions and distances.

### Layout

{Written description of the physical space — dimensions, materials, key objects and
their exact positions relative to each other. Name every surface and object that appears
in any shot from this location.}

### Camera Angles Used

| Angle | Shots | What is visible | What is behind camera |
|---|---|---|---|
| {e.g., "Facing gate from bench"} | {1A, 4E, 5A} | {gate, path, headstones} | {tree canopy, bench} |
| {e.g., "Reverse — facing bench"} | {6A, 6G} | {bench, tree, entrance} | {graves, interior cemetery} |

---

## Anchor Objects (MUST appear)

> Objects that must be present in every shot from this location where they would be
> visible from the camera angle. These are the geometry locks that prevent spatial drift.
> Kept at the top level (not nested in Spatial Map) for quick reference during generation.

- {Object 1} — {fixed position}
- {Object 2} — {fixed position}
- {Object 3} — {fixed position}

---

## Forbidden Drift List (must NOT appear)

> Objects and elements that AI models tend to hallucinate in this type of space.
> Be specific to the setting. Think about what went wrong in previous generations
> and what common objects the AI likes to insert.

- {e.g., "No flowers on the bench"}
- {e.g., "No modern signage or lampposts"}
- {e.g., "No additional furniture — only the one bench"}
- {e.g., "No other people unless scripted (mourners in 3B only)"}

---

## Lighting Lockdown

> Every light source, its direction, color temperature, and what it illuminates.
> This must be consistent across all shots in this location unless the script
> specifies a change (e.g., time passing, light shift in Beat 8).

{Light source 1}: {direction, color temp, what it illuminates}
{Light source 2}: {direction, color temp, what it illuminates}
Time of day: {specific}
Weather: {specific}

---

## Master Plates

> Character-free reference images. Generate at NanoBanana Pro resolution (1K minimum).
> Primary angle first, then reverse if needed, then additional angles.

### Master Plate A — {Primary Angle Description} ({aspect_ratio}, 1K)

```
{NanoBanana prompt — full environment description matching the spatial map,
camera position relative to landmarks, behavioral lens/film-look description (no brand names).
IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame.
The space feels inhabited but empty.}
```

### Master Plate B — {Reverse Angle Description} ({aspect_ratio}, 1K)

```
{NanoBanana prompt for opposite camera direction. Describe what is now visible
that was behind camera A. Anchor objects must remain in their fixed positions
relative to the room — only the camera has moved.
IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame.}
```

### Additional Angle — {Description} ({aspect_ratio}, 1K)

> Only if the shot list requires camera directions not covered by A and B.

```
{NanoBanana prompt}
```

---

## Canonical Environment Block

> **This is the most important section.** This frozen paragraph is copy-pasted verbatim
> into the `[Environment]` block of every `nb-prompt.md` for shots in this location.
> It names the `@EnvironmentName` element and the anchor objects in their fixed positions.
>
> Rules:
> - Written once, never improvised per-shot
> - Names anchor objects and their spatial positions
> - Includes baseline atmosphere and lighting direction
> - Shot-specific atmospheric additions (dust, wind, etc.) are appended AFTER this block
>   in the nb-prompt, clearly separated, and must not contradict any anchor or position

```
[Environment]: @{EnvironmentName} , {canonical description: key spatial relationships,
anchor objects in their fixed positions, lighting direction, atmospheric baseline.
Every detail here is invariant across all shots in this location.}
```

---

## Seedance Environment Reference

> Combined multi-angle environment sheet that authors the `@Name` environment element
> for Seedance (the same element Kling uses). Shows the location
> from 2-3 camera positions on one canvas.

### Seedance Combined Environment Sheet ({aspect_ratio}, 1K)

```
{NanoBanana prompt for combined multi-angle sheet.
IMPORTANT: No humans, no people, no silhouettes, no living beings anywhere in the frame.}
```

---

## Depth Map Notes (high-risk interiors only)

> For interior environments with 10+ shots and multiple camera angles, consider
> extracting depth maps from approved master plates for ControlNet Depth pipelines.
> Note here whether depth maps have been extracted and where they are stored.

Depth map extracted: {yes/no}
Stored at: {path or N/A}
Pipeline: {ComfyUI + ControlNet Depth / N/A}

---

## Consistency Notes

- **Always:** {What must be true in every shot from this location}
- **Never:** {What must never appear}
- **Watch for:** {Known AI failure modes for this type of space — furniture duplication, window teleportation, lighting direction flipping, etc.}
