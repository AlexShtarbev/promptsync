import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  pascalCase, slugify,
  scaffoldSeries, scaffoldProject, scaffoldEpisode, scaffoldElement,
  validateStructure, fixStructure,
} from "./structure.js";

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "struct-test-")); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function element(name: string, scope: "global" | "local", extra = "") {
  return `---\nname: "${name}"\nelement_name: "${name}"\nelement_type: character\n${scope === "global" ? "scope: global\n" : ""}${extra}appears_in: []\nstatus: draft\nelement_status: not-created\n---\n\n# ${name}\n`;
}
function codes(issues: { code: string }[]) { return issues.map((i) => i.code).sort(); }

describe("naming helpers", () => {
  test("pascalCase", () => {
    assert.equal(pascalCase("the father"), "TheFather");
    assert.equal(pascalCase("hale-s0"), "HaleS0");
  });
  test("slugify", () => {
    assert.equal(slugify("Captain Vire"), "captain-vire");
  });
});

describe("scaffold", () => {
  test("scaffoldSeries creates the canonical series layout", () => {
    const dir = path.join(tmp, "show");
    const res = scaffoldSeries(dir, "show", "Show", ["ep01"], "2026-01-01");
    assert.ok(fs.existsSync(path.join(dir, "series.yaml")));
    assert.ok(fs.existsSync(path.join(dir, "storyboard", "characters")));
    assert.ok(fs.existsSync(path.join(dir, "storyboard", "environments")));
    assert.ok(fs.existsSync(path.join(dir, "storyboard", "props")));
    assert.ok(fs.existsSync(path.join(dir, "bible", "characters")));
    assert.ok(fs.existsSync(path.join(dir, "episodes", "ep01", "project.yaml")));
    assert.ok(fs.existsSync(path.join(dir, "episodes", "ep01", "storyboard", "characters")));
    assert.ok(res.created.length > 0);
  });

  test("scaffoldSeries registers episodes in series.yaml", () => {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", ["ep01"], "2026-01-01");
    const sy = fs.readFileSync(path.join(dir, "series.yaml"), "utf-8");
    assert.match(sy, /episodes:/);
    assert.match(sy, /episodes\/ep01/);
  });

  test("scaffoldEpisode appends to an existing series.yaml", () => {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", ["ep01"], "2026-01-01");
    scaffoldEpisode(dir, "ep02", "Episode 2", "2026-01-02");
    const sy = fs.readFileSync(path.join(dir, "series.yaml"), "utf-8");
    assert.match(sy, /episodes\/ep02/);
    assert.ok(fs.existsSync(path.join(dir, "episodes", "ep02", "project.yaml")));
  });

  test("scaffoldElement writes correct frontmatter into the correct dir", () => {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", [], "2026-01-01");
    scaffoldElement(dir, { type: "character", scope: "global", name: "Captain Vire", canon: "../../bible/characters/vire.md" });
    const file = path.join(dir, "storyboard", "characters", "captain-vire.md");
    assert.ok(fs.existsSync(file));
    const body = fs.readFileSync(file, "utf-8");
    assert.match(body, /element_name: "CaptainVire"/);
    assert.match(body, /scope: global/);
    assert.match(body, /canon: \.\.\/\.\.\/bible\/characters\/vire\.md/);
  });

  test("environment element goes to environments/ with a plate prompt", () => {
    const dir = path.join(tmp, "proj");
    scaffoldProject(dir, "proj", "Proj", "2026-01-01");
    scaffoldElement(dir, { type: "environment", scope: "local", name: "The Tower" });
    const file = path.join(dir, "storyboard", "environments", "the-tower.md");
    assert.ok(fs.existsSync(file));
    assert.match(fs.readFileSync(file, "utf-8"), /Environment Plate Prompt/);
  });

  test("scaffold never overwrites an existing file", () => {
    const dir = path.join(tmp, "proj");
    scaffoldProject(dir, "proj", "Proj", "2026-01-01");
    fs.writeFileSync(path.join(dir, "project.yaml"), "custom: true");
    const res = scaffoldProject(dir, "proj", "Proj", "2026-01-01");
    assert.ok(res.skipped.some((s) => s.endsWith("project.yaml")));
    assert.equal(fs.readFileSync(path.join(dir, "project.yaml"), "utf-8"), "custom: true");
  });
});

describe("validateStructure", () => {
  function series(eps: string[] = ["ep01"]) {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", eps, "2026-01-01");
    return dir;
  }

  test("clean scaffolded series with a linked global element passes", () => {
    const dir = series();
    write(path.join(dir, "bible", "characters", "hero.md"), "# Hero\n");
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "global", "canon: ../../bible/characters/hero.md\n"));
    const issues = validateStructure(tmp).filter((i) => i.level === "error");
    assert.deepEqual(issues, []);
  });

  test("flags a global element missing scope (fixable)", () => {
    const dir = series();
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "local" /* no scope field */, "canon: ../../bible/characters/hero.md\n"));
    write(path.join(dir, "bible", "characters", "hero.md"), "# Hero\n");
    const issue = validateStructure(tmp).find((i) => i.code === "SCOPE_MISSING");
    assert.ok(issue);
    assert.equal(issue!.fixable, true);
  });

  test("flags a broken canon link", () => {
    const dir = series();
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "global", "canon: ../../bible/characters/nope.md\n"));
    assert.ok(validateStructure(tmp).some((i) => i.code === "CANON_BROKEN"));
  });

  test("flags a dangling project.yaml reference", () => {
    const dir = series();
    const ep = path.join(dir, "episodes", "ep01");
    fs.appendFileSync(path.join(ep, "project.yaml"), "\nelements:\n  characters:\n    - Ghost\n");
    const issue = validateStructure(tmp).find((i) => i.code === "DANGLING_REF");
    assert.ok(issue);
    assert.match(issue!.message, /Ghost/);
  });

  test("resolves a project.yaml reference against the global library", () => {
    const dir = series();
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "global", "canon: ../../bible/characters/hero.md\n"));
    write(path.join(dir, "bible", "characters", "hero.md"), "# Hero\n");
    const ep = path.join(dir, "episodes", "ep01");
    fs.appendFileSync(path.join(ep, "project.yaml"), "\nelements:\n  characters:\n    - Hero\n");
    assert.ok(!validateStructure(tmp).some((i) => i.code === "DANGLING_REF"));
  });

  test("flags an element duplicated as local across multiple episodes", () => {
    const dir = series(["ep01", "ep02"]);
    for (const ep of ["ep01", "ep02"]) {
      write(path.join(dir, "episodes", ep, "storyboard", "characters", "vibe.md"), element("Vibe", "local"));
    }
    const issue = validateStructure(tmp).find((i) => i.code === "SHOULD_BE_GLOBAL");
    assert.ok(issue);
    assert.match(issue!.message, /ep01/);
    assert.match(issue!.message, /ep02/);
  });

  test("flags a bible character with no linking visual sheet (info)", () => {
    series();
    write(path.join(tmp, "show", "bible", "characters", "ghost.md"), "# Ghost\n");
    const issue = validateStructure(tmp).find((i) => i.code === "BIBLE_NO_SHEET");
    assert.ok(issue);
    assert.equal(issue!.level, "info");
    assert.match(issue!.message, /ghost/);
  });

  test("a bible character WITH a linking sheet is not flagged", () => {
    const dir = series();
    write(path.join(dir, "bible", "characters", "hero.md"), "# Hero\n");
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "global", "canon: ../../bible/characters/hero.md\n"));
    assert.ok(!validateStructure(tmp).some((i) => i.code === "BIBLE_NO_SHEET" && /hero/.test(i.message)));
  });

  test("treats a local override of a global as valid (no DUP_ELEMENT)", () => {
    const dir = series();
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "global", "canon: ../../bible/characters/hero.md\n"));
    write(path.join(dir, "bible", "characters", "hero.md"), "# Hero\n");
    write(path.join(dir, "episodes", "ep01", "storyboard", "characters", "hero-ep.md"), element("Hero", "local"));
    assert.ok(!validateStructure(tmp).some((i) => i.code === "DUP_ELEMENT"));
  });
});

describe("fixStructure", () => {
  test("adds scope: global to global element files and reports it", () => {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", ["ep01"], "2026-01-01");
    write(path.join(dir, "storyboard", "characters", "hero.md"),
      element("Hero", "local" /* missing scope */, "canon: ../../bible/characters/hero.md\n"));
    write(path.join(dir, "bible", "characters", "hero.md"), "# Hero\n");

    const { applied, remaining } = fixStructure(tmp);
    assert.ok(applied.some((a) => /scope: global/.test(a)));
    assert.ok(!remaining.some((i) => i.code === "SCOPE_MISSING"));
    assert.match(fs.readFileSync(path.join(dir, "storyboard", "characters", "hero.md"), "utf-8"), /scope: global/);
  });

  test("creates missing global subdirs", () => {
    const dir = path.join(tmp, "show");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "series.yaml"),
      `name: "S"\nslug: show\ntype: series\nglobal_elements: storyboard\nbible: bible\nepisodes: []\n`);
    fixStructure(tmp);
    assert.ok(fs.existsSync(path.join(dir, "storyboard", "characters")));
    assert.ok(fs.existsSync(path.join(dir, "storyboard", "props")));
  });
});

describe("ELEMENT_NO_VIEWS (silent-breakage detector)", () => {
  test("flags an element whose reference prompts render no views", () => {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", ["ep01"], "2026-01-01");
    write(path.join(dir, "storyboard", "characters", "broken.md"),
      "---\nname: \"Broken\"\nelement_name: \"Broken\"\nelement_type: character\nscope: global\ncanon: ../../bible/characters/broken.md\n---\n\n## Reference Sheet (NanoBanana)\n\n### Prompt 1 — Front\n```\n```\n");
    write(path.join(dir, "bible", "characters", "broken.md"), "# Broken\n");
    const issue = validateStructure(tmp).find((i) => i.code === "ELEMENT_NO_VIEWS");
    assert.ok(issue, "should flag a reference section with an empty prompt");
    assert.equal(issue!.level, "warning");
  });

  test("a well-formed element with a real prompt is NOT flagged", () => {
    const dir = path.join(tmp, "show");
    scaffoldSeries(dir, "show", "Show", ["ep01"], "2026-01-01");
    write(path.join(dir, "storyboard", "characters", "ok.md"),
      "---\nname: \"Ok\"\nelement_name: \"Ok\"\nelement_type: character\nscope: global\ncanon: ../../bible/characters/ok.md\n---\n\n## Reference Sheet (NanoBanana)\n\n### Prompt 1 — Front\n```\nA real prompt body.\n```\n");
    write(path.join(dir, "bible", "characters", "ok.md"), "# Ok\n");
    assert.ok(!validateStructure(tmp).some((i) => i.code === "ELEMENT_NO_VIEWS"));
  });
});
