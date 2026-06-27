import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  compile,
  postureClause,
  heldObjectClause,
  negativePolicy,
  type CompileInput,
} from "./state-compiler.js";
import { classifyContacts } from "./continuity-validator.js";

// The worked example: crawler ep01 shot 3C — Hale PINNED, swinging UP, shard in fist,
// creature concealed above. The shot whose first render defaulted to standing + slim.
function hale3C(platform: CompileInput["platform"]): CompileInput {
  return {
    platform,
    framing: { bodyVisible: true, handInFrame: true, defaultPoseProne: true },
    characters: [
      {
        identityClause: "@HaleS0, sallow skin, gritted effort",
        state: { posture: "pinned flat on his back on the cold stone floor", heldObjects: ["jagged stone shard"] },
        build: {
          positiveClauses: ["noticeably overweight", "heavy soft belly straining the stretched grey t-shirt", "thick soft arms"],
          forbidden: ["lean", "fit", "slimmed", "athletic"],
          unflattering: true,
        },
      },
    ],
    concealment: [
      {
        positiveDescription: "directly above him a shapeless black shadow-mass fills the upper frame, no eyes, no anatomy, pure silhouette",
        hideOnly: ["visible creature anatomy", "eyes", "teeth", "recognizable animal"],
      },
    ],
    targetDescription: "his shard arcs UP into the shadow-mass above",
  };
}

describe("postureClause", () => {
  test("anchors a grounded posture against the standing default on a pose-prone shot", () => {
    const clause = postureClause(
      { posture: "pinned flat on his back" },
      { bodyVisible: true, defaultPoseProne: true },
    );
    assert.match(clause, /NOT rising, NOT standing/);
    assert.ok(classifyContacts(clause).has("grounded"));
  });
  test("does not over-annotate a standing pose", () => {
    const clause = postureClause({ posture: "standing to full height" }, { bodyVisible: true, defaultPoseProne: true });
    assert.doesNotMatch(clause, /NOT rising/);
  });
});

describe("heldObjectClause framing-awareness (A4)", () => {
  test("emits the object when the hand is in frame", () => {
    assert.match(heldObjectClause({ posture: "x", heldObjects: ["shard"] }, { bodyVisible: true, handInFrame: true })!, /shard/);
  });
  test("omits the object when the hand is out of frame", () => {
    assert.equal(heldObjectClause({ posture: "x", heldObjects: ["shard"] }, { bodyVisible: true, handInFrame: false }), null);
  });
});

describe("negativePolicy per platform (B3)", () => {
  test("nanobanana keeps the negative thin and carries control positively", () => {
    const { negative } = negativePolicy(hale3C("nanobanana"));
    // build is positive; the negative must NOT include posture-default crowd-out terms here
    assert.doesNotMatch(negative, /batter's stance|heroic pose/);
    // and must never suppress the creature's PRESENCE
    assert.doesNotMatch(negative, /\bcreature\b(?!.*anatomy)/);
  });
  test("kling emits the full negative crowd-out list", () => {
    const { negative } = negativePolicy(hale3C("kling"));
    assert.match(negative, /standing/);
    assert.match(negative, /batter's stance/);
  });
  test("kling compile drops the face identity clause but keeps build/posture (start frame locks identity)", () => {
    const out = compile(hale3C("kling"));
    const sub = out.subjectClauses.join(" | ");
    assert.doesNotMatch(sub, /sallow skin, gritted effort/); // identity omitted for video
    assert.match(sub, /noticeably overweight/); // build still re-anchored
    assert.match(sub, /NOT rising, NOT standing/); // posture still re-anchored
    assert.match(out.negative, /batter's stance/);
  });
});

describe("compile — the round-trip guarantee", () => {
  test("nanobanana 3C: posture, build, held object, concealment, target all present positively", () => {
    const out = compile(hale3C("nanobanana"));
    const subject = out.subjectClauses.join(" | ");
    // L02 (posture present + correct contact)
    assert.ok(classifyContacts(subject).has("grounded"));
    assert.match(subject, /NOT rising, NOT standing/);
    // L03 (build present positively)
    assert.match(subject, /noticeably overweight/);
    // L06 (held object present)
    assert.match(subject, /stone shard/);
    // L07 (concealment positive, presence preserved)
    assert.match(subject, /shadow-mass/);
    // A5 (target described — not striking air)
    assert.match(subject, /arcs UP/);
  });

  test("face CU: posture + build omitted (A4), identity kept", () => {
    const input = hale3C("nanobanana");
    input.framing = { bodyVisible: false };
    const out = compile(input);
    const subject = out.subjectClauses.join(" | ");
    assert.match(subject, /@HaleS0/);
    assert.doesNotMatch(subject, /noticeably overweight/);
    assert.ok(out.notes.some((n) => /body not visible/.test(n)));
  });

  test("hand out of frame: held object omitted but body/posture kept", () => {
    const input = hale3C("nanobanana");
    input.framing = { bodyVisible: true, handInFrame: false, defaultPoseProne: true };
    const out = compile(input);
    const subject = out.subjectClauses.join(" | ");
    assert.doesNotMatch(subject, /stone shard/);
    assert.match(subject, /noticeably overweight/);
  });
});
