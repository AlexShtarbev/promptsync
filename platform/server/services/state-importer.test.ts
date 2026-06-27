import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  identityFields,
  parseBuildSpec,
  extractHeldObjects,
  concealmentSpec,
  resolvedStateForShot,
  compileShot,
  coverageVsPrompt,
  loadManifestsForProject,
} from "./state-importer.js";
import type { ProjectIndex, Shot, Character } from "../types.js";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "importer-test-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function char(name: string, elementName: string, sections: Record<string, string>, appearsIn: string[] = []): Character {
  return {
    name,
    slug: elementName,
    meta: { element_name: elementName, appears_in: appearsIn } as Character["meta"],
    sections,
    views: [],
  } as Character;
}

function shot(code: string, subject: string, action: string, opts: Partial<{ shotType: string; elements: string[]; platform: string }> = {}): Shot {
  return {
    code,
    meta: {
      shot: code,
      setting: "",
      emotion: "",
      shot_type: opts.shotType ?? "MS",
      camera: "",
      duration: "",
      color_mood: "",
      status: "draft",
      asset_type: "still",
      reuses: null,
      palette_group: null,
      risk: "low",
      multi_shot_group: null,
      elements: opts.elements ?? [],
    },
    content: { subject_action: action, vo_lines: "", sfx_audio: "", notes: "" },
    mjPrompt: {
      meta: { shot: code, model: "", style: "", ar: "9:16", platform: (opts.platform as "nanobanana") ?? "nanobanana", reference_images: {} },
      body: `[Subject]: ${subject}\n[Action]: ${action}`,
      sections: { subject, action },
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

const HALE_IDENTITY = `\`\`\`
Face: round heavy face, sallow skin, tired hollow eyes.
Build: 31, noticeably overweight and out of shape, heavy soft belly straining the t-shirt, thick neck, soft heavy arms.
Wardrobe: faded grey t-shirt, olive trackpants.
\`\`\``;
const CREATURE_VISUAL = `- **On-screen rule:** shadow, silhouette, or partial-in-red-rimlight only. No full daylight reveal.`;

function writeManifest(body: string): void {
  const dir = path.join(tmp, "storyboard", "continuity");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scene-1-objects.md"), `---\nscene: 1\n---\n\n${body}\n`);
}

describe("element-sheet parsing", () => {
  test("identityFields parses the fenced Identity Block", () => {
    const c = char("Hale", "HaleS0", { identity_block: HALE_IDENTITY });
    const f = identityFields(c);
    assert.match(f["build"], /noticeably overweight/);
    assert.match(f["face"], /round heavy face/);
  });
  test("parseBuildSpec flags an unflattering build and sets forbidden terms", () => {
    const c = char("Hale", "HaleS0", { identity_block: HALE_IDENTITY });
    const b = parseBuildSpec(c)!;
    assert.equal(b.unflattering, true);
    assert.ok(b.forbidden!.includes("slimmed"));
    assert.ok(b.positiveClauses.some((p) => /overweight/.test(p)));
  });
  test("parseBuildSpec prefers declared typed frontmatter over prose", () => {
    const c = char("Hale", "HaleS0", { identity_block: HALE_IDENTITY });
    c.meta.build = { positive: ["barrel-chested, broad"], forbidden: ["scrawny"], unflattering: true };
    const b = parseBuildSpec(c)!;
    assert.deepEqual(b.positiveClauses, ["barrel-chested, broad"]); // frontmatter, not the prose "overweight"
    assert.deepEqual(b.forbidden, ["scrawny"]);
    assert.equal(b.unflattering, true);
  });
  test("concealmentSpec prefers declared frontmatter", () => {
    const c = char("Creature", "Floor1Creature", {});
    c.meta.concealment = { positive: "a wet black mass, no features", hide_only: ["eyes"] };
    const cs = concealmentSpec(c)!;
    assert.equal(cs.positiveDescription, "a wet black mass, no features");
    assert.deepEqual(cs.hideOnly, ["eyes"]);
  });
  test("concealmentSpec recognises a shadow-only on-screen rule", () => {
    const c = char("Floor-1 Creature", "Floor1Creature", { visual_identity: CREATURE_VISUAL });
    const cs = concealmentSpec(c)!;
    assert.match(cs.positiveDescription, /shadow-mass|silhouette/);
    assert.ok((cs.hideOnly ?? []).length > 0);
  });
});

describe("extractHeldObjects", () => {
  test("pulls objects from in-hand phrasing", () => {
    assert.deepEqual(extractHeldObjects("pinned on back, shard in fist"), ["shard"]);
    assert.deepEqual(extractHeldObjects("phone in his right hand"), ["phone"]);
  });
  test("returns nothing for empty hands", () => {
    assert.deepEqual(extractHeldObjects("collapsed, empty hands"), []);
  });
});

describe("resolvedStateForShot", () => {
  test("reads the opening state + held objects from the timeline", () => {
    writeManifest(
      `## Hale — action/state timeline

| Shot | Opening state | Closing state |
|---|---|---|
| 3C | pinned flat on back, shard in fist | mid-strike |`,
    );
    const project: ProjectIndex = { config: { slug: "t" } as ProjectIndex["config"], shots: [], characters: [char("Hale", "HaleS0", {})] };
    const manifests = loadManifestsForProject(project, tmp);
    const st = resolvedStateForShot(manifests, "Hale", "3C")!;
    assert.match(st.posture, /pinned flat on back/);
    assert.deepEqual(st.heldObjects, ["shard"]);
  });
});

describe("compileShot — round-trip", () => {
  function project(promptSubject: string): { project: ProjectIndex } {
    writeManifest(
      `## Hale — action/state timeline

| Shot | Opening state | Closing state |
|---|---|---|
| 3C | pinned flat on his back, shard in fist | mid-strike, creature recoils |`,
    );
    const hale = char("Hale", "HaleS0", { identity_block: HALE_IDENTITY }, ["3C"]);
    const creature = char("Floor-1 Creature", "Floor1Creature", { visual_identity: CREATURE_VISUAL }, ["3C"]);
    const s = shot("3C", promptSubject, "swings the shard up", { shotType: "Low MCU", elements: ["HaleS0", "Floor1Creature"] });
    return { project: { config: { slug: "t" } as ProjectIndex["config"], shots: [s], characters: [hale, creature] } };
  }

  test("compiles posture/build/held/concealment from state", () => {
    const { project: p } = project("@HaleS0 pinned on his back, shard in fist, swinging up at the shadow above");
    const manifests = loadManifestsForProject(p, tmp);
    const r = compileShot(p, manifests, "3C");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    const sub = r.compiled.subjectClauses.join(" | ");
    assert.match(sub, /NOT rising, NOT standing/); // posture anchored (pose-prone action)
    assert.match(sub, /noticeably overweight/); // build positive
    assert.match(sub, /shard/); // held object present (deduped into the posture clause, not restated)
    assert.equal(sub.match(/shard/g)!.length, 1); // not double-stated
    assert.match(sub, /shadow-mass|silhouette/); // concealment positive
    assert.doesNotMatch(r.compiled.negative, /batter|standing/); // nanobanana: thin negative
  });

  test("coverage converges when the hand-authored prompt already carries the state", () => {
    const { project: p } = project(
      "@HaleS0 noticeably overweight, heavy soft belly, pinned flat on his back, the shard in his fist driving up into the shadow-mass above",
    );
    const manifests = loadManifestsForProject(p, tmp);
    const r = compileShot(p, manifests, "3C");
    if ("error" in r) throw new Error(r.error);
    const cov = coverageVsPrompt(r, p);
    assert.equal(cov.additions, 0, JSON.stringify(cov.items, null, 2));
  });

  test("coverage flags additions when the prompt is thin (the engine would improve it)", () => {
    const { project: p } = project("@HaleS0 swinging the shard"); // no posture, no build
    const manifests = loadManifestsForProject(p, tmp);
    const r = compileShot(p, manifests, "3C");
    if ("error" in r) throw new Error(r.error);
    const cov = coverageVsPrompt(r, p);
    assert.ok(cov.additions > 0);
    assert.ok(cov.items.some((i) => i.kind === "build" && !i.covered));
  });
});
