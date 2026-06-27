import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  parseIntendedWarmth,
  measureWarmth,
  classifyColorDrift,
  meanRgbFromRaw,
  makeColorTempVerifier,
  COOL_MOOD_THRESHOLD,
  type PixelSampler,
} from "./color-temp-verifier.js";
import type { Shot } from "../types.js";

// Minimal Shot stub — only the fields the verifier reads (meta.color_mood, meta.setting, code).
function shot(color_mood: string, setting = "INT. ROOM — DAY"): Shot {
  return { code: "1A", meta: { color_mood, setting } as Shot["meta"] } as Shot;
}

describe("parseIntendedWarmth", () => {
  test("explicit cool mood reads cool/mood", () => {
    assert.deepEqual(parseIntendedWarmth(shot("cold blue moonlight")), { lean: "cool", source: "mood" });
  });
  test("warm mood reads warm and wins over any cool word", () => {
    assert.equal(parseIntendedWarmth(shot("warm amber firelight, cool shadows")).lean, "warm");
  });
  test("NIGHT slug-line with no mood falls back to cool/setting", () => {
    assert.deepEqual(parseIntendedWarmth(shot("", "EXT. RIDGE — NIGHT")), { lean: "cool", source: "setting" });
  });
  test("a firelit NIGHT is NOT cool (warm word in setting suppresses the fallback, so it never false-flags)", () => {
    assert.notEqual(parseIntendedWarmth(shot("", "INT. HUT — NIGHT, firelight")).lean, "cool");
  });
  test("plain day with neutral mood is neutral", () => {
    assert.equal(parseIntendedWarmth(shot("muted")).lean, "neutral");
  });
});

describe("measureWarmth", () => {
  test("red-dominant is positive, blue-dominant is negative", () => {
    assert.ok(measureWarmth({ r: 180, g: 120, b: 60 }) > 0);
    assert.ok(measureWarmth({ r: 60, g: 90, b: 150 }) < 0);
  });
  test("near-black does not explode", () => {
    assert.ok(Math.abs(measureWarmth({ r: 1, g: 1, b: 0 })) <= 1);
  });
});

describe("classifyColorDrift", () => {
  test("warm pixels on a cool-mood shot are flagged", () => {
    const f = classifyColorDrift({ lean: "cool", source: "mood" }, 0.2, "1A", "1A.png");
    assert.ok(f);
    assert.equal(f!.kind, "colortemp");
    assert.match(f!.message, /WARM|amber/);
  });
  test("warm pixels on a WARM-declared shot are never flagged", () => {
    assert.equal(classifyColorDrift({ lean: "warm", source: "mood" }, 0.5, "1A", "1A.png"), null);
  });
  test("cool pixels on a cool shot pass", () => {
    assert.equal(classifyColorDrift({ lean: "cool", source: "mood" }, -0.1, "1A", "1A.png"), null);
  });
  test("a NIGHT-inferred shot needs MORE warm drift than an explicit cool mood", () => {
    const warmth = (COOL_MOOD_THRESHOLD + 0.14) / 2; // between the two thresholds
    assert.ok(classifyColorDrift({ lean: "cool", source: "mood" }, warmth, "1A", "x")); // flags
    assert.equal(classifyColorDrift({ lean: "cool", source: "setting" }, warmth, "1A", "x"), null); // doesn't
  });
});

describe("meanRgbFromRaw", () => {
  test("averages RGBA pixels, ignoring alpha", () => {
    const data = new Uint8ClampedArray([200, 100, 50, 255, 0, 0, 0, 255]);
    const m = meanRgbFromRaw(data, 4, 1)!;
    assert.equal(m.r, 100);
    assert.equal(m.g, 50);
    assert.equal(m.b, 25);
  });
  test("grayscale collapses to neutral (r=g=b)", () => {
    const m = meanRgbFromRaw(new Uint8ClampedArray([120, 130]), 1, 1)!;
    assert.equal(m.r, m.b);
  });
});

describe("makeColorTempVerifier", () => {
  const warmSampler: PixelSampler = async () => ({ r: 190, g: 120, b: 55 });

  test("flags a warm render on a moonlit shot", async () => {
    const v = makeColorTempVerifier(warmSampler);
    const f = await v(shot("cold moonlit"), "/p/1A.png", Buffer.alloc(0));
    assert.equal(f.length, 1);
    assert.equal(f[0].kind, "colortemp");
  });
  test("skips the decode entirely for a warm-declared shot", async () => {
    let decoded = false;
    const spy: PixelSampler = async () => { decoded = true; return { r: 190, g: 120, b: 55 }; };
    const f = await makeColorTempVerifier(spy)(shot("warm golden hour"), "/p/1A.png", Buffer.alloc(0));
    assert.equal(f.length, 0);
    assert.equal(decoded, false); // never sampled — cheap path
  });
});
