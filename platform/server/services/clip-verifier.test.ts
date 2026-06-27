import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildClipChecks, runClipChecks, type ClipScorer } from "./clip-verifier.js";

describe("buildClipChecks", () => {
  test("a grounded, unflattering character gets posture + build checks", () => {
    const checks = buildClipChecks("pinned flat on his back", true, "HaleS0");
    const axes = checks.map((c) => c.axis).sort();
    assert.deepEqual(axes, ["build", "posture"]);
    assert.match(checks.find((c) => c.axis === "posture")!.expected, /lying down/);
    assert.match(checks.find((c) => c.axis === "posture")!.against, /standing/);
  });
  test("a standing character gets no posture check (default is correct)", () => {
    const checks = buildClipChecks("standing to full height", false);
    assert.equal(checks.length, 0);
  });
  test("a transitional posture (rising) is skipped — ambiguous frame", () => {
    assert.equal(buildClipChecks("rising from the chair", false).length, 0);
  });
  test("seated maps to the sitting label", () => {
    const checks = buildClipChecks("seated at the desk", false);
    assert.equal(checks.length, 1);
    assert.match(checks[0].expected, /sitting/);
  });
});

describe("runClipChecks", () => {
  // Mock scorer: returns a score for each label based on which keyword it's told to favor.
  const scorerFavoring = (winner: RegExp): ClipScorer => async (_img, labels) =>
    labels.map((l) => (winner.test(l) ? 0.9 : 0.1));

  test("flags when the image reads as the failure mode (standing while grounded)", async () => {
    const checks = buildClipChecks("pinned flat on his back", false);
    const f = await runClipChecks("x.png", checks, scorerFavoring(/standing/), "3C");
    assert.equal(f.length, 1);
    assert.match(f[0].message, /reads as .*standing/);
    assert.equal(f[0].kind, "vision");
  });

  test("passes when the image matches the expected state", async () => {
    const checks = buildClipChecks("pinned flat on his back", true);
    const f = await runClipChecks("x.png", checks, scorerFavoring(/lying|overweight/), "3C");
    assert.equal(f.length, 0);
  });

  test("respects the confidence margin (no flag on a near-tie)", async () => {
    const checks = buildClipChecks("seated at the desk", false);
    const nearTie: ClipScorer = async (_i, labels) => labels.map((l) => (/standing/.test(l) ? 0.55 : 0.45));
    const f = await runClipChecks("x.png", checks, nearTie, "3D", 0.15);
    assert.equal(f.length, 0); // 0.55 vs 0.45 → margin 0.10 < 0.15 → not flagged
  });
});
