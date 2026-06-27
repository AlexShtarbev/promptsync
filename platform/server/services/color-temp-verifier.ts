/**
 * Color-temperature verifier — Tier-1 of the text→pixels checks. Local, free, NO model inference,
 * NO Claude. It decodes each render to a mean RGB and flags the single most common AI color tell:
 * a frame that drifts WARM/AMBER when the shot's declared intent is COOL (e.g. a moonlit night that
 * came back honey-toned). This is the "panel color drift" failure made mechanical.
 *
 * Why this is sound where a text lint can't be: warmth is a measurable pixel statistic, and the
 * check fires only on a CONTRADICTION — measured-warm vs declared-cool. It never flags a legitimately
 * warm scene (firelight, sunset, tungsten), because those declare warm intent via `color_mood` and
 * are skipped. Precision over recall by design: a false flag erodes trust faster than a missed drift.
 *
 * Decode backend is the SAME optional dependency as `--clip` (transformers.js `RawImage`), so this
 * adds no new install. The check logic is pure and unit-tested via an injected `PixelSampler`; the
 * decoder is just one implementation, lazy-loaded and degrading to a clear hint when absent.
 */
import type { ImageFinding, ImageVerifier } from "./image-checker.js";
import type { Shot } from "../types.js";

export interface MeanRGB {
  r: number; // 0..255
  g: number;
  b: number;
}

/** Where the cool-intent signal came from — governs how strong the warm drift must be to flag. */
export type IntentSource = "mood" | "setting" | "none";
export interface IntendedWarmth {
  lean: "cool" | "warm" | "neutral";
  source: IntentSource;
}

// Keyword vocabularies for reading declared palette intent off the shot. Warm wins ties: if a scene
// names ANY warm source we treat it as warm and never flag, since the warmth is then motivated.
const WARM_WORDS =
  /\b(warm|amber|golden|gold|sunset|sunrise|firelight|fire|flame|ember|hearth|candle|candlelit|tungsten|orange|sepia|honey|sodium|lamplight|incandescent)\b/i;
const COOL_WORDS =
  /\b(cold|cool|blue|teal|cyan|moonlit|moonlight|silver|steel|icy|ice|frost|fluorescent|cyanotic|aquatic|underwater)\b/i;
// Only NIGHT/MIDNIGHT lean cool as a weak fallback. DUSK/DAWN are ambiguous (often warm) — left neutral.
const COOL_TIME = /\b(night|midnight)\b/i;

/** Read the shot's DECLARED palette intent from color_mood (primary) then the slug-line time-of-day. */
export function parseIntendedWarmth(shot: Shot): IntendedWarmth {
  const mood = shot.meta.color_mood ?? "";
  if (WARM_WORDS.test(mood)) return { lean: "warm", source: "mood" };
  if (COOL_WORDS.test(mood)) return { lean: "cool", source: "mood" };
  const setting = shot.meta.setting ?? "";
  if (COOL_TIME.test(setting) && !WARM_WORDS.test(setting)) return { lean: "cool", source: "setting" };
  return { lean: "neutral", source: "none" };
}

/**
 * Warmth of a mean color, normalized to roughly -1..+1. Positive = red dominant (warm/amber),
 * negative = blue dominant (cool/moonlit). The +1 floor keeps near-black frames from exploding.
 */
export function measureWarmth(rgb: MeanRGB): number {
  return (rgb.r - rgb.b) / (rgb.r + rgb.b + 1);
}

/** Flag thresholds by intent source. An explicit cool MOOD is trusted; a NIGHT-only inference needs more. */
export const COOL_MOOD_THRESHOLD = 0.06;
export const COOL_SETTING_THRESHOLD = 0.14;

/** Pure verdict: does the measured warmth contradict the declared cool intent hard enough to flag? */
export function classifyColorDrift(intent: IntendedWarmth, warmth: number, shotCode: string, fileName: string): ImageFinding | null {
  if (intent.lean !== "cool") return null; // only cool-declared shots can drift warm; warm/neutral are skipped
  const threshold = intent.source === "mood" ? COOL_MOOD_THRESHOLD : COOL_SETTING_THRESHOLD;
  if (warmth <= threshold) return null;
  const pct = Math.round(warmth * 100);
  const via = intent.source === "mood" ? "color_mood is cool" : "shot is NIGHT";
  return {
    shotCode,
    severity: "warning",
    kind: "colortemp",
    message: `${fileName}: render reads WARM/amber (warmth +${pct}%) but ${via} — the classic moonlight→honey color drift; re-grade cooler or pin the hue before reusing this frame`,
  };
}

/** Mean RGB from a decoded raw buffer (RGBA/RGB/grayscale), sampling every `stride`-th pixel. Pure. */
export function meanRgbFromRaw(data: Uint8Array | Uint8ClampedArray, channels: number, stride = 4): MeanRGB | null {
  if (channels < 1 || data.length < channels) return null;
  let r = 0, g = 0, b = 0, n = 0;
  const step = channels * Math.max(1, stride);
  for (let i = 0; i + channels - 1 < data.length; i += step) {
    if (channels >= 3) {
      r += data[i]; g += data[i + 1]; b += data[i + 2];
    } else {
      r += data[i]; g += data[i]; b += data[i]; // grayscale → neutral
    }
    n++;
  }
  return n ? { r: r / n, g: g / n, b: b / n } : null;
}

/** A decoder that returns a render's mean RGB. Local + cheap; never Claude. Injectable for tests. */
export type PixelSampler = (imagePath: string, buf: Buffer) => Promise<MeanRGB | null>;

/** An ImageVerifier (for checkImages) that flags warm-drift against each shot's declared cool intent. */
export function makeColorTempVerifier(sampler: PixelSampler): ImageVerifier {
  return async (shot, imagePath, buf) => {
    const intent = parseIntendedWarmth(shot);
    if (intent.lean !== "cool") return []; // nothing to contradict — skip the decode entirely
    const rgb = await sampler(imagePath, buf);
    if (!rgb) return [];
    const finding = classifyColorDrift(intent, measureWarmth(rgb), shot.code, imagePath.split(/[/\\]/).pop() ?? imagePath);
    return finding ? [finding] : [];
  };
}

/**
 * Lazy-load a PixelSampler backed by transformers.js `RawImage` (the same optional dep as `--clip`).
 * Throws a clear, actionable error if absent — callers should catch and fall back to Tier-0 checks.
 */
export async function loadPixelSampler(): Promise<PixelSampler> {
  const spec = "@xenova/transformers"; // variable specifier → not statically resolved by tsc
  let mod: any;
  try {
    mod = await import(spec);
  } catch {
    throw new Error("Pixel decoder not installed. Run: npm install @xenova/transformers");
  }
  const RawImage = mod.RawImage;
  return async (imagePath: string) => {
    const img = await RawImage.read(imagePath);
    return meanRgbFromRaw(img.data as Uint8ClampedArray, img.channels as number);
  };
}
