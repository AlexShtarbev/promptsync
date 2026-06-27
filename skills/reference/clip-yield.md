# Clip Yield — Designing Discovery Into the Story

**Scope: short-form / serialized-for-platform work only** (vertical Shorts, episodic AI-animated series distributed on TikTok / YouTube Shorts / Reels). Does **not** apply to features, one-off long-form, or anything not posted to a swipe feed. If the project is long-form, skip this file.

This is the single source of truth for the **clip-yield contract**. Every story-saint skill points here; each owns one slice (see *Ownership* at the bottom). Read it once; apply your slice.

---

## The problem it solves

On a swipe feed, **discovery and retention are two different games.** Depth, subtext, slow-burn, and back-loaded payoffs are *retention* tools — they reward the viewer already watching. But retention is the second gate. The first gate is **discovery**, won by loud, clippable, thumb-stopping moments. A retention-strong series with no discovery surface dies in obscurity regardless of quality — the algorithm doesn't reward quality it has never shown anyone.

The failure mode this prevents: treating clips as a **post-production salvage problem** (hunt a finished episode for something to clip). Clips cut from a slow episode are still slow. The fix is to move clip-ability **upstream**, into story design — so the loud beats are *built in*, not chopped out.

**The principle: lead loud, carry deep.** Spectacle is the *delivery vehicle* for theme, not its enemy. The platform-winning version puts a loud, legible hook on top and lets the subtext ride in behind it. The loved-and-respected works (*Arcane*, *Edgerunners*) never chose between the two; neither should the piece.

---

## The Spike — a required engine thread

Whatever per-episode engine the series runs (e.g. a four-thread floor: external trial / internal arc / mystery / signpost), it must carry one more thread:

> **The Spike** — every episode contains one loud, front-loaded, **visible** spectacle or power beat: the thumbnail and the dopamine hit. It is *binding*, the same way an anti-repetition contract is binding. An episode that cannot point to its Spike is not done.

The Spike is AI-animation-safe by design — it's a single engineered money-shot / single impact / one reveal frame, not sustained choreography (see `short-form.md` → AI ANIMATION CAPABILITIES). The storyboard skill owns building it; the storyteller owns mandating it; the scriptwriter owns writing it at clip strength.

---

## The clip taxonomy — 6 types, each harvested from a beat

Most of these are beats a well-built episode is **already required to contain** — so clipping them is harvesting, not extra production.

| Clip type | Beat it harvests | Length | Job | Hook-back |
|---|---|---|---|---|
| **Cold Hook** | the episode cold-open | 6–15s | Discovery — top of funnel, for strangers | ends on the gut-line; card points into the episode |
| **The Spike** | the loud visible spectacle/power beat | 8–15s | Discovery — the dopamine, most shareable | leaves "how is he *here*?" — needs context |
| **Voice-Quote** | one razor, dual-meaning character line | 8–15s | Conversion — the moat as meme, screenshot-bait | the "what *is* this" question |
| **Mystery Drop** | the mystery thread's wrong-note + the silence | 10–20s | Retention — theory/comment fuel | unanswerable without following |
| **Transformation** | the visible character/arc-change beat | 8–20s | Discovery — aspirational; compiles across episodes | "watch them become" |
| **Reframe** | the emotional/no-shame turn | 12–25s | Reach-broadening — the cry-share clip | universal mirror; pulls non-genre viewers |

Discovery clips (Cold Hook, Spike, Transformation) are written to land with **zero prior context** — they're for strangers. Conversion/retention clips (Voice-Quote, Mystery Drop, Reframe) reward the viewer who follows and build the fanbase that watches the full episodes (where a rewatch/subtext layer finally pays).

---

## The two rules that keep it storytelling, not marketing

1. **Built-in, never chopped-out.** A clip is only allowed to exist because the episode was *designed* to contain that beat at clip strength. If you find yourself hunting an episode for something to clip, the episode failed the Spike thread — fix the episode, not the clip.
2. **Self-contained + a hook, never a trailer.** Each clip must land as a complete little hit for the viewer who *never* clicks through, **and** leave one unanswered question for the one who does. Most viewers never convert — that's reach, and reach is a win.

---

## The cadence playbook

- **Yield:** ~4–6 native clips per episode.
- **Rhythm:** the episode is the *event*; its clips are the *heartbeat* metered across the gap to the next episode (1 clip every 1–2 days). This is how the channel stays alive in the feed between drops — it solves the volume/cadence problem without producing more episodes.
- **Order within the gap:** lead with widest reach (Spike or Cold Hook) → conversion clips (Voice-Quote, Mystery Drop) → Reframe to broaden → Transformation as the recurring arc-payoff.
- **Cross-platform free:** a 9:16-locked piece posts to TikTok + Shorts + Reels with zero reframe. One clip = three surfaces.
- **Compounding asset:** every few episodes, recut the Transformation beats into a "the becoming" supercut — the clip that retroactively sells the whole series to a new viewer.

The honest tradeoff this addresses: "depth over volume" as a *posting strategy* fights the algorithm. The resolution is a two-layer funnel — a high-frequency **clip layer** (discovery + heartbeat) feeding a lower-frequency **episode layer** (depth). Don't make the deep episodes carry discovery; the clips do that.

---

## Ownership — who applies which slice

| Skill | Owns |
|---|---|
| **storyteller** | Mandates **The Spike** as an engine thread; adds the **clip-yield gate** to the pre-production lock (a short-form series can't lock unless each episode can mint Cold Hook + Spike + Voice-Quote + Mystery Drop). Design-time. |
| **scriptwriter** | The **Clip Test** — each designated clip-beat must stand alone *and* leave a hook; Mamet's uninflected-image discipline makes this checkable. Execution. |
| **storyboard** | Builds the **Spike's single money-shot frame** (one engineered reveal/impact, AI-safe), and the Cold Hook frame. |
| **prompter** | Viral extraction targets the **pre-designated** clip beats (the Spike etc.), not freshly hunted ones; see `../viral-extraction.md`. |
