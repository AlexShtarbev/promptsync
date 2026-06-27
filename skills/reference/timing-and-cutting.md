# Timing and Cutting

How to estimate real screen time, and how to cut to a target runtime.

---

## THE BASE RULE

"1 page of Hollywood format ≈ 1 minute of screen" is an **average** rule. It works for mixed dialogue/action scripts. It does **not** work literally for action-heavy and montage scenes.

For short-form (15-90s), forget the page rule entirely. Count beats and seconds — see `short-form.md`.

---

## SCENE TYPES BY SPEED

### Very fast (5-15 seconds)

- **Montage scenes** — 5-10 short action lines in a visual flow. Half a page → 8-12 seconds on screen.
- **Establishing shots** — a location frame, no dialogue, no action. 3-5 seconds.
- **Match-cut transitions** — 2-3 seconds.

Example for 8-10 seconds:

```
INT. ARMOURY — DAY
The door OPENS.
Walls hung with swords.
QUICK MONTAGE:
— Hand grabs a spear.
— A sword slides from its sheath.
— Bare feet running down a corridor.
```

Half a page → 10 seconds on screen.

### Fast (15-45 seconds)

- **Action beats with short dialogue** — chase with one line, single skirmish.
- **Cut-back scenes** — a brief return to a parallel storyline.

### Medium (45 seconds — 1:30)

- **Dialogue with action** — 2-3 lines + physical business.
- **Breathing scenes** — a beat of silence before or after a climax.

### Long (1:30 — 3:00)

- **Dramatic dialogue with a turn** — confrontation, confession, breakup.
- **Action sequence** — chase + fight + escape.
- **Complex scene with multiple beats** — setup, conflict, resolution within one location.

### Very long (3:00 — 7:00)

- **Climax** — the final showdown with a moral choice; all storylines converge.
- **Big set-piece** — a directed segment with multiple tempo shifts.

---

## HOW TO CALCULATE SCREEN TIME

Not by pages. By beats inside each scene.

**Algorithm for one scene:**

1. **Slug-line + establishing** — 3-5 seconds (or 0 if matched cut from the previous).
2. **Each action line, separately:**
   - Simple action (1 verb, 1 object): 1-2 seconds.
   - Complex action (multiple movements in one line): 3-5 seconds.
   - Major physical event (explosion, fall, transformation): 5-10 seconds.
3. **Each line of dialogue:** Use ~130 words per minute as the script-stage default (≈ 2.2 words per second). This matches the `normal` pace tier. For production-phase clip duration calculation, use the precise pace tiers in `animation-prompts.md` → Speech Duration System: dramatic=100 WPM, normal=130 WPM, fast=160 WPM. Always default to `dramatic` (100 WPM) when in doubt — it's safer to overestimate duration than to clip a line.
   - Short line "Go." — 1 second.
   - Medium "The plan in the sanctum — lower floor, back side, quiet." — 4-5 seconds.
   - Long (10+ words) — 6-10 seconds.
4. **Pauses and silence** — count separately. "A long pause" = 3-5 seconds minimum.
5. **Reaction shots** (no words, no big action) — 2-3 seconds each.

Add it all up — that's the real screen time of the scene.

---

## DOUBLE-CHECK

If your calculated time strongly disagrees with your gut, recalculate. Most people overestimate length (they think "this is a long scene" but on screen it's 30 seconds).

Good check: watch a similar scene in any reference film with a stopwatch. Compare with what you've written.

---

## CUTTING TO A TARGET RUNTIME

When the user wants to "fit in X minutes":

1. **Calculate current time per scene** (table format).
2. **Determine the gap** "what we have − what we need."
3. **Sort scenes by cut priority:**
   - Lowest priority for cutting (= safest to remove): repeats, parallel beats of the same emotion, excess reaction shots.
   - Medium priority: long breathing scenes, extended landscape shots.
   - Never touch: climax, peripeteias, anagnorisis, key turning points.

---

## CUT POINTS — FROM SAFE TO RISKY

### Safe (cut without loss)

1. **Duplicate beats** — the same emotion in three scenes. Keep the strongest, delete the rest.
2. **Parallel hits** — three battering-ram strikes, four hero attempts, five crowd reactions. Trim to 2 iterations (rule of threes: show, show, point).
3. **Lines that duplicate the action** — the hero is crying and says "I'm sad." Delete the line.
4. **Transition scenes with no value movement** — hero travels from A to B, the conversation doesn't move the story.

### Medium (cut with care)

5. **Long parametric description** — detailed costume / location descriptions. Compress to one line.
6. **Extended actions** — the hero does three things where one would do. Keep the main one.
7. **Within-scene reaction shots** — 4 reaction faces in a montage trimmed to 2.

### Risky (only if necessary)

8. **An entire comedic or emotional cut-back scene.** May weaken rhythm but adds a minute.
9. **A character's subplot.** If a character has a secondary arc, you can shrink it. Don't remove it entirely.

### Never touch

10. Inciting Incident.
11. Peripeteias.
12. Anagnorisis.
13. Crisis dilemma.
14. Climax.
15. Setup of "mine" objects that fire later.

---

## THE "IF I REMOVE IT, DOES THE FILM CHANGE?" TEST

For every scene: mentally remove it. Does anything in the ending change?

- **Yes, it changes** → the scene is needed.
- **No, nothing changes** → the scene is extraneous. Cut without regret.
- **Only the tone / mood changes** → the scene is a breathing scene. Cuttable in a minute crunch — but it is a loss.

---

## BILINGUAL SCRIPTS AND TIME

If the script is bilingual (dialogue in English + Russian translation in parens, or vice versa) — **the doubled dialogue does not count toward screen time.** Only the primary language counts. Translation is for reading, not for shooting.

When estimating length of a bilingual document: page count is +1-2 pages because of translations, but actual screen time is the same as the monolingual version.

---

## SHORT-FORM TIMING (15-90s)

For Shorts, ignore the page rule entirely. Use beat counts.

| Length | Target beats | No shot longer than |
|---|---|---|
| 15s | 5-7 | 3s |
| 30s | 10-15 | 4s (one allowed) |
| 60s | 20-25 | 5s (one allowed) |
| 90s | 25-35 | 6s (one allowed) |

A new visual stimulus every 2-3 seconds. If a Short is longer than its target and was meant to be shorter, the cut plan is the same as for features but compressed: identify duplicate beats, parallel hits, and any line that duplicates a visual.
