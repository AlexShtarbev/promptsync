import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  classifyContacts,
  parseManifestFile,
  validateContinuity,
  type ContinuityRule,
} from "./continuity-validator.js";
import type { ProjectIndex, Shot, Character } from "../types.js";

// ── fixture builders ─────────────────────────────────────────────────────────

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "continuity-test-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

interface ShotSpec {
  shotType?: string;
  subject?: string;
  action?: string;
  subjectAction?: string; // shot.md "Subject & Action" prose (drives L11 beat counting)
  screenText?: string;
  negative?: string;
  elements?: string[];
}

function makeShot(code: string, s: ShotSpec): Shot {
  const sections: Record<string, string> = {};
  if (s.subject) sections["subject"] = s.subject;
  if (s.action) sections["action"] = s.action;
  if (s.screenText) sections["screen_text"] = s.screenText;
  if (s.negative) sections["negative_prompt"] = s.negative;
  const body = Object.entries(sections)
    .map(([k, v]) => `[${k}]: ${v}`)
    .join("\n");
  return {
    code,
    meta: {
      shot: code,
      setting: "",
      emotion: "",
      shot_type: s.shotType ?? "MS",
      camera: "Static",
      duration: "3s",
      color_mood: "",
      status: "draft",
      asset_type: "still",
      reuses: null,
      palette_group: null,
      risk: "low",
      multi_shot_group: null,
      elements: s.elements ?? [],
    },
    content: { subject_action: s.subjectAction ?? "", vo_lines: "", sfx_audio: "", notes: "" },
    mjPrompt: {
      meta: { shot: code, model: "v7", style: "raw", ar: "9:16", platform: "nanobanana", reference_images: {} },
      body,
      sections,
    },
    klingPrompt: null,
    seedancePrompt: null,
    nanoBanana: null,
    elementMap: {},
    imagePath: null,
    startFramePath: null,
    videoPath: null,
    openartRef: null,
  } as Shot;
}

function makeChar(name: string, elementName: string, sections: Record<string, string> = {}): Character {
  return {
    name,
    slug: elementName,
    meta: { element_name: elementName } as Character["meta"],
    sections,
    views: [],
  } as Character;
}

function writeManifest(scene: number, body: string): void {
  const dir = path.join(tmp, "storyboard", "continuity");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `scene-${scene}-objects.md`),
    `---\nscene: ${scene}\nsetting: "INT. Test"\n---\n\n${body}\n`,
  );
}

function index(shots: Shot[], chars: Character[]): ProjectIndex {
  return { config: { slug: "test" } as ProjectIndex["config"], shots, characters: chars };
}

function rules(report: { issues: { rule: ContinuityRule }[] }): ContinuityRule[] {
  return report.issues.map((i) => i.rule).sort();
}
function rulesFor(report: { issues: { rule: ContinuityRule; shotCode: string }[] }, code: string): ContinuityRule[] {
  return report.issues.filter((i) => i.shotCode === code).map((i) => i.rule).sort();
}

// ── classifyContacts ─────────────────────────────────────────────────────────

describe("classifyContacts", () => {
  test("recognises the load-bearing down-group postures", () => {
    assert.ok(classifyContacts("pinned flat on his back").has("grounded"));
    assert.ok(classifyContacts("prone on the floor").has("grounded"));
    assert.ok(classifyContacts("kneeling at the pew").has("kneeling"));
    assert.ok(classifyContacts("seated in the chair").has("seated"));
    assert.ok(classifyContacts("standing to full height").has("standing"));
  });
  test("distinguishes transitional from settled postures", () => {
    assert.ok(classifyContacts("rising from the chair, about to stand").has("rising"));
    assert.ok(classifyContacts("walking to the door").has("walking"));
    assert.equal(classifyContacts("a heavy oak desk").size, 0);
  });
});

// ── manifest parser (both on-disk schemas) ───────────────────────────────────

describe("parseManifestFile", () => {
  test("parses the rich schema (Posture/Facing/Holding columns)", () => {
    writeManifest(
      1,
      `## Peter (character position & state)

| Shot | Position | Posture | Facing | Holding | Wearing | Visible? |
|------|----------|---------|--------|---------|---------|----------|
| 1A | altar | standing | forward | screwdriver | clerical shirt | Yes — MS |
| 1B | altar | kneeling | pew | nothing | clerical shirt | No — CU insert |`,
    );
    const m = parseManifestFile(path.join(tmp, "storyboard/continuity/scene-1-objects.md"), ["Peter Nightingale"]);
    assert.ok(m);
    const sec = m!.sections[0];
    assert.equal(sec.kind, "character");
    assert.equal(sec.characterName, "Peter Nightingale");
    assert.equal(sec.rows.length, 2);
    assert.equal(sec.rows[0].posture, "standing");
    assert.equal(sec.rows[0].holding, "screwdriver");
    assert.equal(sec.rows[0].visible, true);
    assert.equal(sec.rows[1].visible, false); // "No — CU insert"
  });
  test("parses the simple schema (Location/State) and classifies objects", () => {
    writeManifest(
      2,
      `### Phone

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 2A | altar | resting | Yes | planted |`,
    );
    const m = parseManifestFile(path.join(tmp, "storyboard/continuity/scene-2-objects.md"), ["Peter Nightingale"]);
    assert.equal(m!.sections[0].kind, "object");
    assert.equal(m!.sections[0].objectNoun, "phone");
    assert.equal(m!.sections[0].rows[0].posture, "resting"); // State -> posture slot
  });
});

// ── L01 state continuity ──────────────────────────────────────────────────────

describe("L01 state continuity", () => {
  const peter = makeChar("Peter Nightingale", "peterNightingale");
  test("flags a posture teleport with no transitional beat", () => {
    writeManifest(
      3,
      `### Peter Nightingale — Position & Posture

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 3A | chair | seated, hands folded | Yes | |
| 3B | chair | standing, hands at sides | Yes | |`,
    );
    const shots = [
      makeShot("3A", { subject: "@peterNightingale seated in the chair" }),
      makeShot("3B", { subject: "@peterNightingale standing by the chair" }),
    ];
    const report = validateContinuity(index(shots, [peter]), tmp, "test");
    assert.ok(rules(report).includes("L01"), JSON.stringify(report.issues, null, 2));
  });
  test("accepts a posture change bridged by a transitional row", () => {
    writeManifest(
      3,
      `### Peter Nightingale — Position & Posture

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 3A | chair | seated | Yes | |
| 3B | chair → up | rising from the chair | Yes | |
| 3C | mid-room | standing | Yes | |`,
    );
    const shots = [
      makeShot("3A", { subject: "@peterNightingale seated" }),
      makeShot("3B", { subject: "@peterNightingale rising from the chair" }),
      makeShot("3C", { subject: "@peterNightingale standing" }),
    ];
    const report = validateContinuity(index(shots, [peter]), tmp, "test");
    assert.ok(!rules(report).includes("L01"), JSON.stringify(report.issues, null, 2));
  });
  test("skips off-camera rows when anchoring previous state", () => {
    writeManifest(
      3,
      `### Peter Nightingale — Position & Posture

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 3A | floor | pinned on his back | Yes | |
| 3B | — | (off-camera) | No | insert of the shard |
| 3C | floor | supine, swinging up | Yes | |`,
    );
    const shots = [
      makeShot("3A", { subject: "@peterNightingale pinned on his back" }),
      makeShot("3B", { subject: "a stone shard", elements: ["StoneShard"] }),
      makeShot("3C", { subject: "@peterNightingale supine, swinging the shard up" }),
    ];
    const report = validateContinuity(index(shots, [peter]), tmp, "test");
    assert.ok(!rules(report).includes("L01"), JSON.stringify(report.issues, null, 2));
  });
});

// ── L02 manifest -> prompt ────────────────────────────────────────────────────

describe("L02 manifest -> prompt", () => {
  const hale = makeChar("Monsignor Hale", "monsignorHale");
  function withManifest(state: string) {
    writeManifest(
      3,
      `### Monsignor Hale — Position & Posture

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 3A | floor | ${state} | Yes | |`,
    );
  }
  test("flags omission — manifest declares posture, prompt is silent (the 3C bug)", () => {
    withManifest("pinned on his back");
    const shots = [makeShot("3A", { shotType: "MS", subject: "@monsignorHale, his body torquing into the swing" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), ["L02"]);
  });
  test("flags contradiction — prompt asserts a disjoint posture", () => {
    withManifest("pinned on his back");
    const shots = [makeShot("3A", { shotType: "MS", subject: "@monsignorHale standing upright, swinging the rock" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), ["L02"]);
  });
  test("passes when the prompt carries the manifest posture", () => {
    withManifest("pinned on his back");
    const shots = [makeShot("3A", { shotType: "MS", subject: "@monsignorHale pinned flat on his back, swinging up" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), []);
  });
  test("skips posture on a face close-up (framing-aware, A4)", () => {
    withManifest("pinned on his back");
    const shots = [makeShot("3A", { shotType: "CU — Hale face", subject: "@monsignorHale, jaw set, eyes hard" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), []);
  });
  test("checks posture on a body-showing MCU; reads it from a follow-on sentence (single subject)", () => {
    withManifest("seated, still");
    // Posture is in a sentence that does not repeat the name — must still attribute it.
    const shots = [makeShot("3A", { shotType: "MCU — Hale", subject: "@monsignorHale, jaw set.", action: "Seated, still. Eyes forward." })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), [], JSON.stringify(report.issues, null, 2));
  });
  test("skips a face-only MCU via the prompt cue", () => {
    withManifest("seated, still");
    const shots = [makeShot("3A", { shotType: "MCU — Hale", subject: "@monsignorHale, face and upper chest, jaw set" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), []);
  });
  test("does not misattribute a second character's posture (two-hander)", () => {
    const peter = makeChar("Peter Nightingale", "peterNightingale");
    writeManifest(
      3,
      `### Peter Nightingale — Position & Posture

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 3A | door | standing at the door | Yes | |

### Monsignor Hale — Position & Posture

| Shot | Location | State | Visible? | Notes |
|------|----------|-------|----------|-------|
| 3A | desk | seated at the desk | Yes | |`,
    );
    // Hale is named only by surname "Hale" in the prompt; Peter is standing, Hale seated.
    const shots = [
      makeShot("3A", {
        shotType: "MS",
        subject: "@peterNightingale standing at the door. In the background Hale is seated at the desk.",
      }),
    ];
    const report = validateContinuity(index(shots, [peter, hale]), tmp, "test");
    assert.deepEqual(rulesFor(report, "3A"), [], JSON.stringify(report.issues, null, 2));
  });
});

// ── L06 held-object continuity ────────────────────────────────────────────────

describe("L06 held-object continuity", () => {
  const peter = makeChar("Peter Nightingale", "peterNightingale");
  test("flags a held object missing from the prompt (Holding column)", () => {
    writeManifest(
      1,
      `## Peter Nightingale — Position & Posture

| Shot | Position | Posture | Facing | Holding | Wearing | Visible? |
|------|----------|---------|--------|---------|---------|----------|
| 1C | pew | kneeling | pew | screwdriver | clerical shirt | Yes — MS |`,
    );
    const shots = [makeShot("1C", { shotType: "MS", subject: "@peterNightingale kneeling at the pew, working the hinge" })];
    const report = validateContinuity(index(shots, [peter]), tmp, "test");
    assert.ok(rules(report).includes("L06"), JSON.stringify(report.issues, null, 2));
  });
  test("passes when the held object is named", () => {
    writeManifest(
      1,
      `## Peter Nightingale — Position & Posture

| Shot | Position | Posture | Facing | Holding | Wearing | Visible? |
|------|----------|---------|--------|---------|---------|----------|
| 1C | pew | kneeling | pew | screwdriver | clerical shirt | Yes — MS |`,
    );
    const shots = [makeShot("1C", { shotType: "MS", subject: "@peterNightingale kneeling, a screwdriver in his hand" })];
    const report = validateContinuity(index(shots, [peter]), tmp, "test");
    assert.ok(!rules(report).includes("L06"), JSON.stringify(report.issues, null, 2));
  });
});

describe("L06 held-object from the Opening/Closing timeline", () => {
  const hale = makeChar("Hale", "HaleS0");
  function timeline() {
    writeManifest(
      1,
      `## Hale — action/state timeline

| Shot | Opening state | Closing state |
|---|---|---|
| 3C | pinned on his back, shard in fist | mid-strike |`,
    );
  }
  test("flags the shard dropping out of a body-visible shot", () => {
    timeline();
    const shots = [makeShot("3C", { shotType: "Low MCU", subject: "@HaleS0 pinned on his back, arm driving up" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.ok(rules(report).includes("L06"), JSON.stringify(report.issues, null, 2));
  });
  test("passes when the shard is named", () => {
    timeline();
    const shots = [makeShot("3C", { shotType: "Low MCU", subject: "@HaleS0 pinned, the stone shard in his fist driving up" })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.ok(!rules(report).includes("L06"), JSON.stringify(report.issues, null, 2));
  });
});

describe("L09 on-screen text inline in the body (FLOOR counter)", () => {
  test("flags the same readout written with different spacing", () => {
    const shots = [
      makeShot("4D", { subject: `a recessed counter reading "FLOOR 01 / 66" in cyan` }),
      makeShot("4E", { subject: `the counter reading "FLOOR 01/66"` }),
    ];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(rules(report).includes("L09"), JSON.stringify(report.issues, null, 2));
  });
  test("does NOT flag a legitimate value change (01/66 → 02/66)", () => {
    const shots = [
      makeShot("4D", { subject: `counter reads "FLOOR 01 / 66"` }),
      makeShot("5G", { subject: `counter reads "FLOOR 02 / 66"` }),
    ];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(!rules(report).includes("L09"));
  });
});

// ── L03 build presence ─────────────────────────────────────────────────────────

describe("L03 build presence", () => {
  const overweight = (n: string, el: string) => makeChar(n, el, { identity_block: "```\nBuild: noticeably overweight, heavy soft belly straining the tee.\n```" });

  test("flags a build-sensitive character whose body-visible prompt asserts no physique", () => {
    const hale = overweight("Hale", "HaleS0");
    const shots = [makeShot("3C", { shotType: "MS", subject: "@HaleS0 swinging the shard", elements: ["HaleS0"] })];
    const report = validateContinuity(index(shots, [hale]), tmp, "test");
    assert.ok(rules(report).includes("L03"), JSON.stringify(report.issues, null, 2));
  });
  test("passes when the build is asserted", () => {
    const hale = overweight("Hale", "HaleS0");
    const shots = [makeShot("3C", { shotType: "MS", subject: "@HaleS0, noticeably overweight, swinging", elements: ["HaleS0"] })];
    assert.ok(!rules(validateContinuity(index(shots, [hale]), tmp, "test")).includes("L03"));
  });
  test("does NOT flag a normal build described as 'not bulky' (negation-guarded)", () => {
    const peter = makeChar("Peter", "peterN", { identity_block: "```\nBuild: solid working build, broad shoulders, not bulky but dense.\n```" });
    const shots = [makeShot("7G", { shotType: "MS", subject: "@peterN on the floor", elements: ["peterN"] })];
    assert.ok(!rules(validateContinuity(index(shots, [peter]), tmp, "test")).includes("L03"));
  });
  test("skips a face close-up (build not in frame)", () => {
    const hale = overweight("Hale", "HaleS0");
    const shots = [makeShot("3J", { shotType: "CU — Hale", subject: "@HaleS0 jaw set", elements: ["HaleS0"] })];
    assert.ok(!rules(validateContinuity(index(shots, [hale]), tmp, "test")).includes("L03"));
  });
});

// ── L07 concealment-as-negative ──────────────────────────────────────────────────

describe("L07 concealment negative", () => {
  const creature = makeChar("Floor-1 Creature", "Floor1Creature", { visual_identity: "- On-screen rule: shadow, silhouette only. No full reveal." });

  test("flags the bare element noun being suppressed in the negative", () => {
    const shots = [makeShot("3C", { subject: "a dark shape", negative: "blurry, creature, extra limbs", elements: ["Floor1Creature"] })];
    const report = validateContinuity(index(shots, [creature]), tmp, "test");
    assert.ok(rules(report).includes("L07"), JSON.stringify(report.issues, null, 2));
  });
  test("passes when only the REVEAL is negated", () => {
    const shots = [makeShot("3C", { subject: "a shadow-mass", negative: "visible creature anatomy, clearly-lit creature, recognizable animal", elements: ["Floor1Creature"] })];
    assert.ok(!rules(validateContinuity(index(shots, [creature]), tmp, "test")).includes("L07"));
  });
});

// ── L11 action density ───────────────────────────────────────────────────────────

describe("L11 action density", () => {
  test("warns when a shot packs 4+ distinct physical beats", () => {
    const shots = [makeShot("9A", { subjectAction: "He stands, walks to the door, turns, and reaches for the handle." })];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(rules(report).includes("L11"), JSON.stringify(report.issues, null, 2));
    assert.equal(report.issues.find((i) => i.rule === "L11")!.severity, "warning"); // advisory, not blocking
  });
  test("stays quiet at <=3 beats", () => {
    const shots = [makeShot("9B", { subjectAction: "He stands and walks to the door." })];
    assert.ok(!rules(validateContinuity(index(shots, []), tmp, "test")).includes("L11"));
  });
});

// ── L04 action-target presence ────────────────────────────────────────────────

describe("L04 action-target presence", () => {
  test("flags a transitive action whose target is not a listed element", () => {
    const shots = [
      makeShot("3C", {
        action: "@peterNightingale swings the shard up at @theCreature in the dark above",
        elements: ["peterNightingale"], // creature dropped from elements
      }),
    ];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(rules(report).includes("L04"), JSON.stringify(report.issues, null, 2));
  });
  test("passes when the target is listed", () => {
    const shots = [
      makeShot("3C", {
        action: "@peterNightingale swings the shard up at @theCreature",
        elements: ["peterNightingale", "theCreature"],
      }),
    ];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(!rules(report).includes("L04"));
  });
});

// ── L09 on-screen text canonical ──────────────────────────────────────────────

describe("L09 on-screen text", () => {
  test("flags a diegetic string that differs across shots", () => {
    const shots = [
      makeShot("1A", { screenText: `the counter reads "FLOOR 01 / 66"` }),
      makeShot("1B", { screenText: `the counter reads "FLOOR 01/66"` }),
    ];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(rules(report).includes("L09"), JSON.stringify(report.issues, null, 2));
  });
  test("passes when the string matches everywhere", () => {
    const shots = [
      makeShot("1A", { screenText: `the counter reads "FLOOR 01 / 66"` }),
      makeShot("1B", { screenText: `the counter reads "FLOOR 01 / 66"` }),
    ];
    const report = validateContinuity(index(shots, []), tmp, "test");
    assert.ok(!rules(report).includes("L09"));
  });
});
