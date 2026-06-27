import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  loadProject,
  loadSingleShot,
  loadSingleCharacter,
  discoverProjects,
  discoverWorkspace,
  loadGlobalElements,
  loadBibleDocs,
  safeMatter,
  isReferenceSectionHeading,
  countElementViews,
  hasReferencePrompts,
} from "./markdown-parser.js";

let tmpDir: string;

function mkdirp(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function createProjectYaml(projectDir: string, overrides: Record<string, unknown> = {}) {
  const config: Record<string, unknown> = {
    name: "Test Project",
    slug: "test-project",
    created: "2026-01-01",
    status: "in-progress",
    drive_folder_id: null,
    default_style: "cinematic",
    shot_prefix: "",
    aspect_ratio: "9:16",
    default_resolution: "1K",
    ...overrides,
  };
  const yaml = Object.entries(config)
    .map(([k, v]) => `${k}: ${v === null ? "null" : typeof v === "string" ? `"${v}"` : v}`)
    .join("\n");
  writeFile(path.join(projectDir, "project.yaml"), yaml);
}

function createShotMd(projectDir: string, code: string, overrides: Record<string, unknown> = {}) {
  const meta: Record<string, unknown> = {
    shot: code,
    setting: "Mountain slope",
    shot_type: "WS",
    camera: "Static",
    duration: "3s",
    color_mood: "warm gold",
    status: "draft",
    asset_type: "still",
    reuses: null,
    palette_group: null,
    risk: "low",
    multi_shot_group: null,
    elements: "[]",
    ...overrides,
  };

  const frontmatter = Object.entries(meta)
    .map(([k, v]) => {
      if (v === null) return `${k}: null`;
      if (typeof v === "string" && v.startsWith("[")) return `${k}: ${v}`;
      return `${k}: "${v}"`;
    })
    .join("\n");

  const body = `---
${frontmatter}
---

## Subject & Action
Sisyphus pushes the boulder uphill.

## VO / Lines
(silence)

## SFX / Audio
Grinding stone

## Notes
Test shot
`;
  writeFile(path.join(projectDir, "storyboard", "shots", code, "shot.md"), body);
}

function createNbPrompt(projectDir: string, code: string, body = "A man pushes a boulder uphill.") {
  const content = `---
shot: "${code}"
model: "v7"
style: raw
ar: "9:16"
platform: nanobanana
---

${body}
`;
  writeFile(path.join(projectDir, "storyboard", "shots", code, "nb-prompt.md"), content);
}

function createKlingPrompt(projectDir: string, code: string, body = "Slow push of boulder.") {
  const content = `---
shot: "${code}"
motion_scale: 5
aspect_ratio: "9:16"
mode: standard
multi_shot_group: null
---

${body}
`;
  writeFile(path.join(projectDir, "storyboard", "video-prompts", code, "kling-prompt.md"), content);
}

function createSeedancePrompt(projectDir: string, code: string, body = "Boulder rolling.") {
  const content = `---
shot: "${code}"
aspect_ratio: "9:16"
duration: 5
mode: i2v
character_lock: null
---

${body}
`;
  writeFile(path.join(projectDir, "storyboard", "video-prompts", code, "seedance-prompt.md"), content);
}

function createCharacterMd(projectDir: string, filename: string, overrides: Record<string, unknown> = {}) {
  const meta: Record<string, unknown> = {
    name: "Sisyphus",
    element_name: "Sisyphus",
    element_type: "character",
    appears_in: '["1A", "2A"]',
    status: "approved",
    element_status: "reference-done",
    ...overrides,
  };

  const frontmatter = Object.entries(meta)
    .map(([k, v]) => {
      if (typeof v === "string" && v.startsWith("[")) return `${k}: ${v}`;
      return `${k}: "${v}"`;
    })
    .join("\n");

  const body = `---
${frontmatter}
---

## Visual Description
Muscular man, weathered skin.

## NanoBanana 3 Reference Prompts

### Angle 1 — Front View (PRIMARY)

\`\`\`
Full body front view of Sisyphus, muscular man, ancient Greek attire.
\`\`\`

### Angle 2 — Side Profile

\`\`\`
Side profile of Sisyphus, strong jaw, determined expression.
\`\`\`

### Angle 3 — Three-Quarter View (1:1, 2K)

\`\`\`
Three-quarter view of Sisyphus, dynamic pose pushing boulder.
\`\`\`
`;
  writeFile(path.join(projectDir, "storyboard", "characters", filename), body);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parser-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("discoverProjects", () => {
  test("finds projects with project.yaml", () => {
    const projDir = path.join(tmpDir, "my-project");
    mkdirp(projDir);
    createProjectYaml(projDir, { slug: "my-project", name: "My Project" });

    const results = discoverProjects(tmpDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, "my-project");
    assert.equal(results[0].config.name, "My Project");
  });

  test("finds multiple projects", () => {
    for (const name of ["alpha", "beta", "gamma"]) {
      const dir = path.join(tmpDir, name);
      mkdirp(dir);
      createProjectYaml(dir, { slug: name, name });
    }

    const results = discoverProjects(tmpDir);
    assert.equal(results.length, 3);
    assert.deepEqual(results.map((r) => r.slug).sort(), ["alpha", "beta", "gamma"]);
  });

  test("returns correct path for each project", () => {
    const projDir = path.join(tmpDir, "my-proj");
    mkdirp(projDir);
    createProjectYaml(projDir, { slug: "my-proj" });

    const results = discoverProjects(tmpDir);
    assert.equal(results[0].path, projDir);
  });

  test("ignores directories without project.yaml", () => {
    mkdirp(path.join(tmpDir, "not-a-project"));
    const projDir = path.join(tmpDir, "real-project");
    mkdirp(projDir);
    createProjectYaml(projDir, { slug: "real-project" });

    const results = discoverProjects(tmpDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, "real-project");
  });

  test("returns empty array for nonexistent directory", () => {
    assert.deepEqual(discoverProjects("/nonexistent/path"), []);
  });

  test("skips malformed project.yaml", () => {
    const dir = path.join(tmpDir, "bad");
    mkdirp(dir);
    writeFile(path.join(dir, "project.yaml"), ": invalid: yaml: [");

    const results = discoverProjects(tmpDir);
    assert.equal(results.length, 0);
  });

  test("finds nested projects in a series/episodes layout", () => {
    // crawler-style layout: base/episodes/epNN/project.yaml (no yaml at base or episodes)
    for (const ep of ["ep01", "ep02"]) {
      const dir = path.join(tmpDir, "crawler", "episodes", ep);
      mkdirp(dir);
      createProjectYaml(dir, { slug: `crawler-${ep}`, name: `Crawler ${ep}` });
    }

    const results = discoverProjects(tmpDir);
    assert.deepEqual(
      results.map((r) => r.slug).sort(),
      ["crawler-ep01", "crawler-ep02"]
    );
  });

  test("does not descend into a project's own storyboard subfolders", () => {
    const projDir = path.join(tmpDir, "show");
    mkdirp(projDir);
    createProjectYaml(projDir, { slug: "show" });
    // A stray project.yaml buried inside the project must not register as a project.
    const buried = path.join(projDir, "storyboard", "shots", "1A");
    mkdirp(buried);
    createProjectYaml(buried, { slug: "buried" });

    const results = discoverProjects(tmpDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, "show");
  });

  test("respects maxDepth", () => {
    const deep = path.join(tmpDir, "a", "b", "c", "d", "e");
    mkdirp(deep);
    createProjectYaml(deep, { slug: "too-deep" });

    assert.equal(discoverProjects(tmpDir, 3).length, 0);
  });

  test("accepts multiple base directories and dedupes by slug", () => {
    const rootA = path.join(tmpDir, "rootA");
    const rootB = path.join(tmpDir, "rootB");
    mkdirp(path.join(rootA, "alpha"));
    createProjectYaml(path.join(rootA, "alpha"), { slug: "alpha" });
    mkdirp(path.join(rootB, "episodes", "ep01"));
    createProjectYaml(path.join(rootB, "episodes", "ep01"), { slug: "beta-ep01" });

    const results = discoverProjects([rootA, rootB]);
    assert.deepEqual(results.map((r) => r.slug).sort(), ["alpha", "beta-ep01"]);
  });

  test("ignores empty entries in a base directory list", () => {
    const projDir = path.join(tmpDir, "solo");
    mkdirp(projDir);
    createProjectYaml(projDir, { slug: "solo" });

    const results = discoverProjects(["", tmpDir]);
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, "solo");
  });
});

describe("loadProject", () => {
  test("loads project with shots", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createShotMd(projDir, "1B");
    createNbPrompt(projDir, "1A");

    const index = loadProject(projDir);
    assert.ok(index);
    assert.equal(index!.config.slug, "test-project");
    assert.equal(index!.shots.length, 2);
    assert.equal(index!.shots[0].code, "1A");
    assert.equal(index!.shots[1].code, "1B");
  });

  test("returns null when project.yaml missing", () => {
    assert.equal(loadProject(path.join(tmpDir, "empty")), null);
  });

  test("parses shot metadata correctly", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "0A", {
      setting: "Cave interior",
      shot_type: "CU",
      camera: "Dolly in",
      duration: "5s",
      status: "story-ready",
      asset_type: "kling",
      risk: "high",
    });

    const index = loadProject(projDir)!;
    const shot = index.shots[0];
    assert.equal(shot.meta.setting, "Cave interior");
    assert.equal(shot.meta.shot_type, "CU");
    assert.equal(shot.meta.camera, "Dolly in");
    assert.equal(shot.meta.duration, "5s");
    assert.equal(shot.meta.status, "story-ready");
    assert.equal(shot.meta.asset_type, "kling");
    assert.equal(shot.meta.risk, "high");
  });

  test("parses shot content sections", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");

    const index = loadProject(projDir)!;
    const shot = index.shots[0];
    assert.ok(shot.content.subject_action.includes("Sisyphus pushes"));
    assert.ok(shot.content.sfx_audio.includes("Grinding stone"));
    assert.ok(shot.content.notes.includes("Test shot"));
  });

  test("mjPrompt is null when no prompt files exist", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].mjPrompt, null);
  });

  test("loads nb-prompt when mj-prompt absent", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createNbPrompt(projDir, "1A", "NanoBanana prompt body.");

    const index = loadProject(projDir)!;
    const shot = index.shots[0];
    assert.ok(shot.mjPrompt);
    assert.equal(shot.mjPrompt!.meta.platform, "nanobanana");
    assert.equal(shot.mjPrompt!.body, "NanoBanana prompt body.");
  });

  test("attaches kling prompt from video-prompts dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "2A", { asset_type: "kling" });
    createKlingPrompt(projDir, "2A", "Kling body text.");

    const index = loadProject(projDir)!;
    const shot = index.shots[0];
    assert.ok(shot.klingPrompt);
    assert.equal(shot.klingPrompt!.meta.motion_scale, 5);
    assert.equal(shot.klingPrompt!.body, "Kling body text.");
  });

  test("attaches seedance prompt from video-prompts dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "3A", { asset_type: "seedance" });
    createSeedancePrompt(projDir, "3A", "Seedance body.");

    const index = loadProject(projDir)!;
    const shot = index.shots[0];
    assert.ok(shot.seedancePrompt);
    assert.equal(shot.seedancePrompt!.meta.duration, 5);
    assert.equal(shot.seedancePrompt!.meta.mode, "i2v");
    assert.equal(shot.seedancePrompt!.body, "Seedance body.");
  });

  test("auto-upgrades status to mj-done when still shot has image", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { status: "draft", asset_type: "still" });
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "image.png"), "fake-png-data");

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].meta.status, "mj-done");
  });

  test("does not auto-upgrade non-still shots", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { status: "draft", asset_type: "kling" });
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "image.png"), "fake-png-data");

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].meta.status, "draft");
  });

  test("does not auto-upgrade non-draft shots", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { status: "story-ready", asset_type: "still" });
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "image.png"), "fake-png-data");

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].meta.status, "story-ready");
  });

  test("loads characters and maps appears_in to shot elements", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createCharacterMd(projDir, "sisyphus.md", {
      name: "Sisyphus",
      element_name: "Sisyphus",
      appears_in: '["1A"]',
    });

    const index = loadProject(projDir)!;
    assert.equal(index.characters.length, 1);
    assert.equal(index.characters[0].name, "Sisyphus");
    assert.ok(index.shots[0].meta.elements.includes("Sisyphus"));
  });

  test("shots sorted by directory name", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "2B");
    createShotMd(projDir, "1A");
    createShotMd(projDir, "1B");

    const index = loadProject(projDir)!;
    assert.deepEqual(index.shots.map((s) => s.code), ["1A", "1B", "2B"]);
  });

  test("finds images with various extensions", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "image.webp"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].imagePath!.includes("image.webp"));
  });

  test("finds non-standard image filenames", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "custom-name.jpg"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].imagePath!.includes("custom-name.jpg"));
  });

  test("finds start-frame images", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "start-frame.png"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].startFramePath!.includes("start-frame.png"));
  });

  test("finds video files", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    mkdirp(path.join(projDir, "storyboard", "videos"));
    writeFile(path.join(projDir, "storyboard", "videos", "1A.mp4"), "video-data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].videoPath!.includes("1A.mp4"));
  });

  test("parses reference_images from mj-prompt", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "mj-prompt.md"), `---
shot: "1A"
model: "v7"
style: raw
ar: "16:9"
platform: mj
reference_images:
  sref: "https://example.com/ref.png"
  cref: null
---

A prompt with references.
`);

    const index = loadProject(projDir)!;
    const refs = index.shots[0].mjPrompt!.meta.reference_images;
    assert.equal(refs.sref, "https://example.com/ref.png");
    assert.equal(refs.cref, null);
  });

  test("reads valid openart-ref.json on shot", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(
      path.join(projDir, "storyboard", "shots", "1A", "openart-ref.json"),
      JSON.stringify({ url: "https://openart.ai/shot/abc" })
    );

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].openartRef, "https://openart.ai/shot/abc");
  });

  test("loads characters from environments dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");

    const envMd = `---
name: "Mountain"
element_name: "Mountain"
element_type: "environment"
appears_in: ["1A"]
status: "approved"
element_status: "reference-done"
---

## Visual Description
Rocky mountain terrain.
`;
    writeFile(path.join(projDir, "storyboard", "environments", "mountain.md"), envMd);

    const index = loadProject(projDir)!;
    assert.equal(index.characters.length, 1);
    assert.equal(index.characters[0].meta.element_type, "environment");
  });
});

describe("loadSingleShot", () => {
  test("loads a single shot by code", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createNbPrompt(projDir, "1A");

    const shot = loadSingleShot(projDir, "1A");
    assert.ok(shot);
    assert.equal(shot!.code, "1A");
    assert.ok(shot!.mjPrompt);
  });

  test("returns null for nonexistent shot", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    assert.equal(loadSingleShot(projDir, "99Z"), null);
  });

  test("attaches kling and seedance prompts", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "2A", { asset_type: "kling" });
    createKlingPrompt(projDir, "2A", "Kling single shot.");
    createSeedancePrompt(projDir, "2A", "Seedance single shot.");

    const shot = loadSingleShot(projDir, "2A")!;
    assert.ok(shot.klingPrompt);
    assert.equal(shot.klingPrompt!.body, "Kling single shot.");
    assert.ok(shot.seedancePrompt);
    assert.equal(shot.seedancePrompt!.body, "Seedance single shot.");
  });

  test("uses default aspect_ratio when project.yaml is missing", () => {
    const projDir = path.join(tmpDir, "proj");
    mkdirp(path.join(projDir, "storyboard", "shots", "1A"));
    const shotContent = `---
shot: "1A"
---

## Subject & Action
Test.
`;
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "shot.md"), shotContent);

    const shot = loadSingleShot(projDir, "1A");
    assert.ok(shot);
    assert.equal(shot!.code, "1A");
  });

  test("resolves elements from character files", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createCharacterMd(projDir, "sisyphus.md", {
      name: "Sisyphus",
      element_name: "Sisyphus",
      appears_in: '["1A"]',
    });

    const shot = loadSingleShot(projDir, "1A")!;
    assert.ok(shot.meta.elements.includes("Sisyphus"));
  });
});

describe("loadSingleCharacter", () => {
  test("loads character by slug", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");

    const char = loadSingleCharacter(projDir, "sisyphus");
    assert.ok(char);
    assert.equal(char!.name, "Sisyphus");
    assert.equal(char!.slug, "sisyphus");
  });

  test("returns null for nonexistent character", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    assert.equal(loadSingleCharacter(projDir, "nobody"), null);
  });

  test("parses character views from reference prompts", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    assert.equal(char.views.length, 3);
    assert.equal(char.views[0].name, "Front View");
    assert.equal(char.views[0].index, 1);
    assert.ok(char.views[0].prompt.includes("Full body front view"));
    assert.equal(char.views[1].name, "Side Profile");
    assert.equal(char.views[1].index, 2);
    assert.equal(char.views[2].name, "Three-Quarter View");
    assert.equal(char.views[2].index, 3);
  });

  test("parses aspect_ratio and resolution from view heading", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    const view3 = char.views.find((v) => v.name === "Three-Quarter View");
    assert.ok(view3);
    assert.equal(view3!.aspect_ratio, "1:1");
    assert.equal(view3!.resolution, "2K");
  });

  test("finds character images by slug-viewslug pattern", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");
    writeFile(
      path.join(projDir, "storyboard", "characters", "sisyphus-front-view.png"),
      "img-data"
    );

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    const frontView = char.views.find((v) => v.slug === "front-view");
    assert.ok(frontView!.imagePath!.includes("sisyphus-front-view.png"));
  });

  test("finds openart-ref.json for character views", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");
    writeFile(
      path.join(projDir, "storyboard", "characters", "sisyphus-front-view-openart-ref.json"),
      JSON.stringify({ url: "https://openart.ai/ref/123", resourceId: "res-456" })
    );

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    const frontView = char.views.find((v) => v.slug === "front-view");
    assert.equal(frontView!.openartRef, "https://openart.ai/ref/123");
    assert.equal(frontView!.openartResourceId, "res-456");
  });

  test("searches environments dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const envMd = `---
name: "Boulder"
element_name: "Boulder"
element_type: "environment"
appears_in: []
status: "draft"
element_status: "needs-reference"
---

## Visual Description
Large grey boulder.

## NanoBanana Environment Plate Prompts

### Prompt 1 — Wide View

\`\`\`
A massive grey boulder on rocky terrain.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "environments", "boulder.md"), envMd);

    const char = loadSingleCharacter(projDir, "boulder");
    assert.ok(char);
    assert.equal(char!.name, "Boulder");
    assert.equal(char!.views.length, 1);
  });

  test("views without aspect_ratio/resolution have null values", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    const view1 = char.views.find((v) => v.name === "Front View");
    assert.equal(view1!.aspect_ratio, null);
    assert.equal(view1!.resolution, null);
  });

  test("view with aspect_ratio but no resolution", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const charMd = `---
name: "Hero"
element_name: "Hero"
element_type: "character"
appears_in: []
status: "draft"
element_status: "needs-reference"
---

## NanoBanana 1 Reference Prompt

### Angle 1 — Headshot (16:9)

\`\`\`
Close-up headshot of hero.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "characters", "hero.md"), charMd);

    const char = loadSingleCharacter(projDir, "hero")!;
    assert.equal(char.views[0].aspect_ratio, "16:9");
    assert.equal(char.views[0].resolution, null);
  });

  test("parses MJ Character Reference Prompt heading", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const charMd = `---
name: "Warrior"
element_name: "Warrior"
element_type: "character"
appears_in: []
status: "draft"
element_status: "needs-reference"
---

## MJ Character Reference Prompt

### Angle 1 — Action Pose

\`\`\`
Dynamic action pose of warrior.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "characters", "warrior.md"), charMd);

    const char = loadSingleCharacter(projDir, "warrior")!;
    assert.equal(char.views.length, 1);
    assert.equal(char.views[0].name, "Action Pose");
    assert.ok(char.views[0].prompt.includes("Dynamic action pose"));
  });

  test("finds start-frame with .jpg extension", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "start-frame.jpg"), "data");

    const shot = loadSingleShot(projDir, "1A")!;
    assert.ok(shot.startFramePath!.endsWith("start-frame.jpg"));
  });

  test("character sections are parsed", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    assert.ok(char.sections.visual_description.includes("Muscular man"));
  });
});

describe("edge cases", () => {
  test("empty shots directory", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    mkdirp(path.join(projDir, "storyboard", "shots"));

    const index = loadProject(projDir)!;
    assert.equal(index.shots.length, 0);
  });

  test("shot directory without shot.md is skipped", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    mkdirp(path.join(projDir, "storyboard", "shots", "1A"));

    const index = loadProject(projDir)!;
    assert.equal(index.shots.length, 0);
  });

  test("openart-ref.json with invalid JSON returns null", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "openart-ref.json"), "not-json");

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].openartRef, null);
  });

  test("openart-ref.json without url field returns null", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(
      path.join(projDir, "storyboard", "shots", "1A", "openart-ref.json"),
      JSON.stringify({ resourceId: "abc" })
    );

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].openartRef, null);
  });

  test("mj-prompt.md takes precedence over nb-prompt.md", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");

    writeFile(path.join(projDir, "storyboard", "shots", "1A", "mj-prompt.md"), `---
shot: "1A"
model: "v7"
style: raw
ar: "16:9"
platform: mj
---

MJ prompt body.
`);
    createNbPrompt(projDir, "1A", "NB prompt body.");

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].mjPrompt!.body, "MJ prompt body.");
    assert.equal(index.shots[0].mjPrompt!.meta.platform, "mj");
  });

  test("project with no storyboard dir returns empty shots", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const index = loadProject(projDir)!;
    assert.equal(index.shots.length, 0);
    assert.equal(index.characters.length, 0);
  });

  test("nanoBanana prompt attached from video-prompts dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { asset_type: "kling" });
    const nbContent = `---
shot: "1A"
source: generate-new
---

NanoBanana video prompt body.
`;
    writeFile(path.join(projDir, "storyboard", "video-prompts", "1A", "nanobanana.md"), nbContent);

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].nanoBanana);
    assert.equal(index.shots[0].nanoBanana!.body, "NanoBanana video prompt body.");
    assert.equal(index.shots[0].nanoBanana!.meta.source, "generate-new");
  });

  test("project aspect_ratio propagates to prompt ar default", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir, { aspect_ratio: "16:9" });
    createShotMd(projDir, "1A");
    const nbContent = `---
shot: "1A"
model: "v7"
style: raw
platform: nanobanana
---

Prompt without explicit ar.
`;
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "nb-prompt.md"), nbContent);

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].mjPrompt!.meta.ar, "16:9");
  });

  test("shot with pre-populated elements skips character resolution", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { elements: '["ManualElement"]' });
    createCharacterMd(projDir, "sisyphus.md", {
      name: "Sisyphus",
      element_name: "Sisyphus",
      appears_in: '["1A"]',
    });

    const index = loadProject(projDir)!;
    assert.deepEqual(index.shots[0].meta.elements, ["ManualElement"]);
    assert.ok(!index.shots[0].meta.elements.includes("Sisyphus"));
  });

  test("element_name fallback to char.name when empty", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createCharacterMd(projDir, "hero.md", {
      name: "The Hero",
      element_name: "",
      appears_in: '["1A"]',
    });

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].meta.elements.includes("The Hero"));
  });

  test("image.{ext} preferred over arbitrary filenames", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "random-name.jpg"), "data");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "image.png"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].imagePath!.endsWith("image.png"));
  });

  test("default meta values when frontmatter keys missing", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    const minimalShot = `---
shot: "1A"
---

## Subject & Action
Minimal shot.
`;
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "shot.md"), minimalShot);

    const index = loadProject(projDir)!;
    const meta = index.shots[0].meta;
    assert.equal(meta.camera, "Static");
    assert.equal(meta.status, "draft");
    assert.equal(meta.asset_type, "still");
    assert.equal(meta.risk, "low");
    assert.equal(meta.reuses, null);
    assert.equal(meta.palette_group, null);
    assert.equal(meta.multi_shot_group, null);
    assert.deepEqual(meta.elements, []);
  });

  test("finds .webm video files", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    mkdirp(path.join(projDir, "storyboard", "videos"));
    writeFile(path.join(projDir, "storyboard", "videos", "1A.webm"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].videoPath!.endsWith("1A.webm"));
  });

  test("finds .mov video files", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    mkdirp(path.join(projDir, "storyboard", "videos"));
    writeFile(path.join(projDir, "storyboard", "videos", "1A.mov"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].videoPath!.endsWith("1A.mov"));
  });

  test("section key fallback for headings without slashes", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    const shotMd = `---
shot: "1A"
---

## Subject Action
Hero runs forward.

## VO Lines
Narrator speaks.

## SFX Audio
Wind blowing.

## Notes
Alternate heading format.
`;
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "shot.md"), shotMd);

    const index = loadProject(projDir)!;
    const shot = index.shots[0];
    assert.ok(shot.content.subject_action.includes("Hero runs"));
    assert.ok(shot.content.vo_lines.includes("Narrator speaks"));
    assert.ok(shot.content.sfx_audio.includes("Wind blowing"));
  });

  test("loads characters from props dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");

    const propMd = `---
name: "Sword"
element_name: "Sword"
element_type: "prop"
appears_in: ["1A"]
status: "approved"
element_status: "reference-done"
---

## Visual Description
Ancient bronze sword.
`;
    writeFile(path.join(projDir, "storyboard", "props", "sword.md"), propMd);

    const index = loadProject(projDir)!;
    assert.equal(index.characters.length, 1);
    assert.equal(index.characters[0].meta.element_type, "prop");
    assert.ok(index.shots[0].meta.elements.includes("Sword"));
  });

  test("shot with broken frontmatter is skipped", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "2A", "shot.md"), "no frontmatter at all");

    const index = loadProject(projDir)!;
    assert.equal(index.shots.length, 2);
  });

  test("character file with no reference prompts has empty views", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const charMd = `---
name: "Ghost"
element_name: "Ghost"
element_type: "character"
appears_in: []
status: "draft"
element_status: "needs-reference"
---

## Visual Description
A translucent specter.
`;
    writeFile(path.join(projDir, "storyboard", "characters", "ghost.md"), charMd);

    const char = loadSingleCharacter(projDir, "ghost")!;
    assert.ok(char);
    assert.equal(char.views.length, 0);
  });

  test("shot with empty body has empty content sections", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "shot.md"), `---
shot: "1A"
---
`);

    const index = loadProject(projDir)!;
    assert.equal(index.shots.length, 1);
    assert.equal(index.shots[0].content.subject_action, "");
    assert.equal(index.shots[0].content.vo_lines, "");
    assert.equal(index.shots[0].content.sfx_audio, "");
    assert.equal(index.shots[0].content.notes, "");
  });

  test("discoverProjects ignores nested subdirectories", () => {
    const projDir = path.join(tmpDir, "outer");
    mkdirp(projDir);
    createProjectYaml(projDir, { slug: "outer" });

    const nested = path.join(projDir, "inner");
    mkdirp(nested);
    createProjectYaml(nested, { slug: "inner" });

    const results = discoverProjects(tmpDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, "outer");
  });

  test("character appears_in referencing nonexistent shot does not crash", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createCharacterMd(projDir, "phantom.md", {
      name: "Phantom",
      element_name: "Phantom",
      appears_in: '["1A", "99Z"]',
    });

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].meta.elements.includes("Phantom"));
    assert.equal(index.shots.length, 1);
  });

  test("multiple image files — image.* preferred over others", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "something.jpg"), "data");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "image.webp"), "data");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "another.png"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].imagePath!.endsWith("image.webp"));
  });

  test("loadSingleCharacter from props dir", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const propMd = `---
name: "Shield"
element_name: "Shield"
element_type: "prop"
appears_in: []
status: "draft"
element_status: "needs-reference"
---

## Visual Description
Bronze shield.
`;
    writeFile(path.join(projDir, "storyboard", "props", "shield.md"), propMd);

    const char = loadSingleCharacter(projDir, "shield");
    assert.ok(char);
    assert.equal(char!.name, "Shield");
    assert.equal(char!.meta.element_type, "prop");
  });

  test("parses views from NanoBanana Prop Plate Prompt heading", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const propMd = `---
name: "Carved Bird"
element_name: "CarvingBird"
element_type: "prop"
appears_in: ["1A"]
status: "draft"
element_status: "not-created"
---

## Identity Block

A small hand-carved wooden bird.

## NanoBanana Prop Plate Prompt (16:9, 1K)

\`\`\`
A photorealistic multi-angle product reference sheet of a small hand-carved wooden bird.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "props", "carved-bird.md"), propMd);

    const char = loadSingleCharacter(projDir, "carved-bird")!;
    assert.ok(char);
    assert.equal(char.views.length, 1);
    assert.ok(char.views[0].prompt.includes("photorealistic multi-angle"));
    assert.equal(char.views[0].aspect_ratio, "16:9");
    assert.equal(char.views[0].resolution, "1K");
  });

  test("parses prop plate prompt with different aspect ratio", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const propMd = `---
name: "Wall Cross"
element_name: "WallCross"
element_type: "prop"
appears_in: []
status: "draft"
element_status: "not-created"
---

## NanoBanana Prop Plate Prompt (1:1, 1K)

\`\`\`
A simple wooden wall cross reference sheet.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "props", "wall-cross.md"), propMd);

    const char = loadSingleCharacter(projDir, "wall-cross")!;
    assert.ok(char);
    assert.equal(char.views.length, 1);
    assert.equal(char.views[0].aspect_ratio, "1:1");
    assert.equal(char.views[0].resolution, "1K");
  });

  test("prop views appear in loadProject characters list", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");

    const propMd = `---
name: "Photograph"
element_name: "Photograph"
element_type: "prop"
appears_in: ["1A"]
status: "draft"
element_status: "not-created"
---

## NanoBanana Prop Plate Prompt (16:9, 1K)

\`\`\`
A vintage black-and-white photograph reference sheet.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "props", "photograph.md"), propMd);

    const index = loadProject(projDir)!;
    const prop = index.characters.find((c) => c.name === "Photograph");
    assert.ok(prop);
    assert.equal(prop!.meta.element_type, "prop");
    assert.equal(prop!.views.length, 1);
    assert.ok(prop!.views[0].prompt.includes("vintage black-and-white"));
    assert.ok(index.shots[0].meta.elements.includes("Photograph"));
  });

  test("prop with multiple NanoBanana Prop Plate Prompt sub-views", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const propMd = `---
name: "Dagger"
element_name: "Dagger"
element_type: "prop"
appears_in: []
status: "draft"
element_status: "not-created"
---

## NanoBanana Prop Plate Prompts

### Prompt 1 — Blade Detail (1:1, 1K)

\`\`\`
Close-up of the blade edge and engravings.
\`\`\`

### Prompt 2 — Full View (16:9, 2K)

\`\`\`
Full dagger on white background.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "props", "dagger.md"), propMd);

    const char = loadSingleCharacter(projDir, "dagger")!;
    assert.ok(char);
    assert.equal(char.views.length, 2);
    assert.equal(char.views[0].name, "Blade Detail");
    assert.equal(char.views[0].aspect_ratio, "1:1");
    assert.equal(char.views[0].resolution, "1K");
    assert.equal(char.views[1].name, "Full View");
    assert.equal(char.views[1].aspect_ratio, "16:9");
    assert.equal(char.views[1].resolution, "2K");
  });

  test("prop finds images by slug-viewslug pattern", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);

    const propMd = `---
name: "Carved Bird"
element_name: "CarvingBird"
element_type: "prop"
appears_in: []
status: "draft"
element_status: "not-created"
---

## NanoBanana Prop Plate Prompt (16:9, 1K)

\`\`\`
Bird reference sheet.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "props", "carved-bird.md"), propMd);
    writeFile(
      path.join(projDir, "storyboard", "props", "carved-bird-nanobanana-prop-plate-prompt.png"),
      "img-data"
    );

    const char = loadSingleCharacter(projDir, "carved-bird")!;
    assert.ok(char.views[0].imagePath);
    assert.ok(char.views[0].imagePath!.includes("carved-bird-nanobanana-prop-plate-prompt.png"));
  });

  test("project.yaml with extra fields does not crash", () => {
    const projDir = path.join(tmpDir, "proj");
    mkdirp(projDir);
    writeFile(path.join(projDir, "project.yaml"), `name: "Test"
slug: "test"
created: "2026-01-01"
status: "in-progress"
drive_folder_id: null
default_style: "cinematic"
shot_prefix: ""
aspect_ratio: "9:16"
default_resolution: "1K"
unknown_future_field: "whatever"
another_one: 42
`);

    const index = loadProject(projDir);
    assert.ok(index);
    assert.equal(index!.config.slug, "test");
  });

  test("video-prompts dir missing does not crash loadProject", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { asset_type: "kling" });

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].klingPrompt, null);
    assert.equal(index.shots[0].seedancePrompt, null);
  });

  test("nb-prompt.md uses project aspect_ratio when ar field missing", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir, { aspect_ratio: "16:9" });
    createShotMd(projDir, "1A");
    writeFile(path.join(projDir, "storyboard", "shots", "1A", "nb-prompt.md"), `---
shot: "1A"
model: "v7"
style: raw
platform: nanobanana
---

Prompt without ar.
`);

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].mjPrompt!.meta.ar, "16:9");
  });

  test("multiple characters appearing in same shot all resolve to elements", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    createCharacterMd(projDir, "sisyphus.md", {
      name: "Sisyphus",
      element_name: "Sisyphus",
      appears_in: '["1A"]',
    });
    createCharacterMd(projDir, "athena.md", {
      name: "Athena",
      element_name: "Athena",
      appears_in: '["1A"]',
    });

    const index = loadProject(projDir)!;
    assert.equal(index.characters.length, 2);
    assert.ok(index.shots[0].meta.elements.includes("Sisyphus"));
    assert.ok(index.shots[0].meta.elements.includes("Athena"));
  });

  test("seedance prompt with non-null character_lock is preserved", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A", { asset_type: "seedance" });
    const content = `---
shot: "1A"
aspect_ratio: "9:16"
duration: 5
mode: i2v
character_lock: "Sisyphus"
---

Seedance with lock.
`;
    writeFile(path.join(projDir, "storyboard", "video-prompts", "1A", "seedance-prompt.md"), content);

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].seedancePrompt);
    assert.equal(index.shots[0].seedancePrompt!.meta.character_lock, "Sisyphus");
  });

  test("shot with both mp4 and webm — first found is used", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    mkdirp(path.join(projDir, "storyboard", "videos"));
    writeFile(path.join(projDir, "storyboard", "videos", "1A.mp4"), "data");
    writeFile(path.join(projDir, "storyboard", "videos", "1A.webm"), "data");

    const index = loadProject(projDir)!;
    assert.ok(index.shots[0].videoPath, "should find at least one video");
  });

  test("openart-ref.json with resourceId but no url returns null for openartRef", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createShotMd(projDir, "1A");
    writeFile(
      path.join(projDir, "storyboard", "shots", "1A", "openart-ref.json"),
      JSON.stringify({ resourceId: "abc123" })
    );

    const index = loadProject(projDir)!;
    assert.equal(index.shots[0].openartRef, null);
  });

  test("character openartResourceId from ref json", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    createCharacterMd(projDir, "sisyphus.md");
    writeFile(
      path.join(projDir, "storyboard", "characters", "sisyphus-side-profile-openart-ref.json"),
      JSON.stringify({ url: "https://openart.ai/ref/side", resourceId: "res-side" })
    );

    const char = loadSingleCharacter(projDir, "sisyphus")!;
    const sideView = char.views.find((v) => v.slug === "side-profile");
    assert.ok(sideView);
    assert.equal(sideView!.openartRef, "https://openart.ai/ref/side");
    assert.equal(sideView!.openartResourceId, "res-side");
  });
});

// ---- Series / global element library ----

function createSeries(
  seriesDir: string,
  opts: { slug?: string; episodes?: string[] } = {}
) {
  const slug = opts.slug ?? "show";
  const episodes = opts.episodes ?? ["episodes/ep01"];
  writeFile(
    path.join(seriesDir, "series.yaml"),
    `name: "${slug}"\nslug: ${slug}\ntype: series\nglobal_elements: storyboard\nbible: bible\nepisodes:\n${episodes
      .map((e) => `  - ${e}`)
      .join("\n")}\n`
  );
}

function writeElement(filePath: string, fm: Record<string, string>, body = "## Visual Description\nAn element.\n") {
  const frontmatter = Object.entries(fm)
    .map(([k, v]) => (v.startsWith("[") ? `${k}: ${v}` : `${k}: "${v}"`))
    .join("\n");
  writeFile(filePath, `---\n${frontmatter}\n---\n\n${body}`);
}

function globalDirsOf(seriesDir: string): string[] {
  return ["characters", "environments", "props"].map((d) => path.join(seriesDir, "storyboard", d));
}

describe("series & global elements", () => {
  test("discoverWorkspace finds a series with global dir and episodes", () => {
    const series = path.join(tmpDir, "show");
    createSeries(series);
    createProjectYaml(path.join(series, "episodes", "ep01"), { slug: "show-ep01", name: "Ep1" });

    const ws = discoverWorkspace(tmpDir);
    assert.equal(ws.series.length, 1);
    assert.equal(ws.series[0].slug, "show");
    assert.equal(ws.series[0].episodes.length, 1);
    assert.equal(ws.series[0].episodes[0].slug, "show-ep01");
    assert.ok(ws.series[0].globalElementDirs.some((d) => d.endsWith(path.join("storyboard", "characters"))));
    // episodes are NOT also listed as standalone projects
    assert.equal(ws.projects.length, 0);
  });

  test("discoverProjects flattens episodes and attaches globalElementDirs", () => {
    const series = path.join(tmpDir, "show");
    createSeries(series);
    createProjectYaml(path.join(series, "episodes", "ep01"), { slug: "show-ep01" });

    const all = discoverProjects(tmpDir);
    const ep = all.find((p) => p.slug === "show-ep01")!;
    assert.ok(ep);
    assert.equal(ep.seriesSlug, "show");
    assert.ok(ep.globalElementDirs.length > 0);
  });

  test("series episodes without project.yaml are skipped", () => {
    const series = path.join(tmpDir, "show");
    createSeries(series, { episodes: ["episodes/ep01", "episodes/ep02"] });
    createProjectYaml(path.join(series, "episodes", "ep01"), { slug: "show-ep01" });
    mkdirp(path.join(series, "episodes", "ep02")); // beat-sheet stage, no project.yaml

    const ws = discoverWorkspace(tmpDir);
    assert.equal(ws.series[0].episodes.length, 1);
  });

  test("loadProject merges series-global elements and tags scope", () => {
    const series = path.join(tmpDir, "show");
    const ep = path.join(series, "episodes", "ep01");
    createProjectYaml(ep, { slug: "show-ep01" });
    createShotMd(ep, "1A");
    writeElement(path.join(series, "storyboard", "characters", "hero.md"), {
      name: "Hero", element_name: "Hero", element_type: "character", scope: "global", appears_in: '["1A"]',
    });
    createCharacterMd(ep, "monster.md", { name: "Monster", element_name: "Monster", appears_in: '["1A"]' });

    const index = loadProject(ep, globalDirsOf(series))!;
    const hero = index.characters.find((c) => c.name === "Hero")!;
    const monster = index.characters.find((c) => c.name === "Monster")!;
    assert.equal(hero.meta.scope, "global");
    assert.equal(monster.meta.scope, "local");
    assert.ok(index.shots[0].meta.elements.includes("Hero"));
    assert.ok(index.shots[0].meta.elements.includes("Monster"));
  });

  test("local element overrides a global with the same element_name", () => {
    const series = path.join(tmpDir, "show");
    const ep = path.join(series, "episodes", "ep01");
    createProjectYaml(ep, { slug: "show-ep01" });
    writeElement(path.join(series, "storyboard", "characters", "hero.md"), {
      name: "Hero", element_name: "Hero", element_type: "character", element_status: "global-look",
    });
    writeElement(path.join(ep, "storyboard", "characters", "hero-local.md"), {
      name: "Hero", element_name: "Hero", element_type: "character", element_status: "episode-look",
    });

    const index = loadProject(ep, globalDirsOf(series))!;
    const heroes = index.characters.filter((c) => (c.meta.element_name || c.name) === "Hero");
    assert.equal(heroes.length, 1);
    assert.equal(heroes[0].meta.scope, "local");
    assert.equal(heroes[0].meta.element_status, "episode-look");
  });

  test("loadGlobalElements parses scope and canon", () => {
    const series = path.join(tmpDir, "show");
    writeElement(path.join(series, "storyboard", "characters", "hero.md"), {
      name: "Hero", element_name: "Hero", element_type: "character",
      scope: "global", canon: "../../bible/characters/hero.md",
    });

    const chars = loadGlobalElements(globalDirsOf(series));
    assert.equal(chars.length, 1);
    assert.equal(chars[0].meta.scope, "global");
    assert.equal(chars[0].meta.canon, "../../bible/characters/hero.md");
  });

  test("episode inherits aspect_ratio/default_resolution from series.yaml", () => {
    const dir = path.join(tmpDir, "show");
    writeFile(path.join(dir, "series.yaml"),
      `name: "S"\nslug: show\ntype: series\naspect_ratio: "16:9"\ndefault_resolution: "2K"\nglobal_elements: storyboard\nbible: bible\nepisodes:\n  - episodes/ep01\n`);
    writeFile(path.join(dir, "episodes", "ep01", "project.yaml"),
      `name: "E1"\nslug: show-ep01\nstatus: in-progress\n`); // no aspect_ratio

    const ep = discoverWorkspace(tmpDir).series[0].episodes[0];
    const idx = loadProject(ep.path, ep.globalElementDirs, ep.seriesDefaults)!;
    assert.equal(idx.config.aspect_ratio, "16:9");
    assert.equal(idx.config.default_resolution, "2K");
  });

  test("episode project.yaml aspect_ratio overrides the series default", () => {
    const dir = path.join(tmpDir, "show");
    writeFile(path.join(dir, "series.yaml"),
      `name: "S"\nslug: show\ntype: series\naspect_ratio: "16:9"\nglobal_elements: storyboard\nbible: bible\nepisodes:\n  - episodes/ep01\n`);
    writeFile(path.join(dir, "episodes", "ep01", "project.yaml"),
      `name: "E1"\nslug: show-ep01\naspect_ratio: "1:1"\nstatus: in-progress\n`);

    const ep = discoverWorkspace(tmpDir).series[0].episodes[0];
    assert.equal(loadProject(ep.path, ep.globalElementDirs, ep.seriesDefaults)!.config.aspect_ratio, "1:1");
  });

  test("loadBibleDocs reads canon + character docs grouped", () => {
    const b = path.join(tmpDir, "bible");
    writeFile(path.join(b, "series-bible.md"), "# Bible\nWorld stuff");
    writeFile(path.join(b, "characters", "hero.md"), "# Hero\nArc");

    const docs = loadBibleDocs(b);
    assert.equal(docs.length, 2);
    assert.equal(docs.find((d) => d.slug === "series-bible")!.group, "canon");
    const hero = docs.find((d) => d.slug === "characters/hero")!;
    assert.equal(hero.group, "characters");
    assert.match(hero.content, /Arc/);
  });

  test("loadBibleDocs returns [] for a missing dir", () => {
    assert.deepEqual(loadBibleDocs(path.join(tmpDir, "nope")), []);
  });
});

describe("safeMatter", () => {
  test("parses valid frontmatter into data + body", () => {
    const r = safeMatter(`---\ntitle: Hello\nn: 3\n---\n\n# Body\n`);
    assert.equal(r.data.title, "Hello");
    assert.equal(r.data.n, 3);
    assert.equal(r.content.trim(), "# Body");
  });

  test("no frontmatter → raw content, empty data", () => {
    const r = safeMatter(`# Just a body\n\ntext`);
    assert.deepEqual(r.data, {});
    assert.equal(r.content, "# Just a body\n\ntext");
  });

  test("malformed frontmatter does not throw and is stripped", () => {
    const mal = `---\ntitle: "The One" — Locked\nstatus: locked\n---\n\n# Body Heading\n`;
    const r = safeMatter(mal);
    assert.deepEqual(r.data, {});
    assert.ok(r.content.startsWith("\n# Body Heading") || r.content.startsWith("# Body Heading"));
    assert.doesNotMatch(r.content, /title:/);
  });

  test("REGRESSION: malformed file is stripped on EVERY call (no gray-matter cache leak)", () => {
    const mal = `---\ntitle: "X" — Y\n---\n\n# Heading\n`;
    for (let i = 0; i < 3; i++) {
      const r = safeMatter(mal);
      assert.doesNotMatch(r.content, /title:/, `call ${i} leaked frontmatter`);
    }
  });
});

describe("reference sheet prompt parsing", () => {
  test("skips the blockquote intro before '### Prompt N' (no phantom/empty view)", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    const md = `---
name: "Hale"
element_name: "HaleS0"
element_type: character
appears_in: []
status: draft
element_status: not-created
---

## Reference Sheet Prompts (NanoBanana) — WIDE / full-canvas identity anchors

> Generate wide — these are identity anchors, not the 9:16 shot. Flat even studio light.

### Prompt 1 — Front Three-Quarter (3:4, 1K)
\`\`\`
Front three-quarter prompt body.
\`\`\`

### Prompt 2 — Side Profile (3:4, 1K)
\`\`\`
Side profile prompt body.
\`\`\`
`;
    writeFile(path.join(projDir, "storyboard", "characters", "hale-s0.md"), md);

    const char = loadSingleCharacter(projDir, "hale-s0")!;
    assert.equal(char.views.length, 2, "exactly the two real prompts, no phantom");
    assert.deepEqual(char.views.map((v) => v.name), ["Front Three-Quarter", "Side Profile"]);
    assert.ok(char.views.every((v) => v.prompt.length > 0), "every view has a prompt");
    assert.ok(!char.views.some((v) => /Reference Sheet Prompts/.test(v.name)), "no section-heading phantom");
    assert.equal(char.views[0].aspect_ratio, "3:4");
  });
});

describe("reference section heading variants", () => {
  test("'Creature Reference Sheet (NanoBanana)' + unnumbered '### Prompt —' parses", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    writeFile(path.join(projDir, "storyboard", "characters", "monster.md"), `---
name: "Floor-1 Creature"
element_name: "Floor1Creature"
element_type: creature
appears_in: []
status: draft
element_status: not-created
---

## Creature Reference Sheet (NanoBanana) — WIDE multi-angle anchor

### Prompt — Multi-angle Creature Sheet (16:9, 1K)
\`\`\`
A multi-angle creature reference sheet.
\`\`\`

> Production note: keep it in shadow on screen.
`);
    const char = loadSingleCharacter(projDir, "monster")!;
    assert.equal(char.views.length, 1);
    assert.equal(char.views[0].name, "Multi-angle Creature Sheet");
    assert.equal(char.views[0].aspect_ratio, "16:9");
    assert.ok(char.views[0].prompt.includes("multi-angle creature"));
  });

  test("environment 'Master Plates' (plural) + 'Seedance Combined Environment Sheet' parse", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    writeFile(path.join(projDir, "storyboard", "environments", "chamber.md"), `---
name: "Chamber"
element_name: "Floor1Chamber"
element_type: environment
appears_in: []
status: draft
element_status: not-created
---

## Master Plates (character-free, WIDE)

### Master Plate A — Low floor angle (3:4, 1K)
\`\`\`
Plate A prompt.
\`\`\`

### Master Plate B — Toward the stairs (3:4, 1K)
\`\`\`
Plate B prompt.
\`\`\`

## Canonical Environment Block (paste into every nb-prompt)
\`\`\`
[World Plate]: @Floor1Chamber , a vast chamber.
\`\`\`

## Seedance Combined Environment Sheet (16:9, 1K)
\`\`\`
A multi-angle environment sheet.
\`\`\`
`);
    const env = loadSingleCharacter(projDir, "chamber")!;
    assert.deepEqual(env.views.map((v) => v.name), [
      "Master Plate A — Low floor angle",
      "Master Plate B — Toward the stairs",
      "Seedance Combined Environment Sheet",
    ]);
    // the Canonical Environment Block (no prompt keyword) is NOT treated as a view
    assert.ok(!env.views.some((v) => /Canonical/.test(v.name)));
  });
});

describe("isReferenceSectionHeading (intent-based recognition)", () => {
  const yes = [
    "Reference Sheet Prompts (NanoBanana) — WIDE",
    "Creature Reference Sheet (NanoBanana)",
    "Master Plates (character-free, WIDE)",
    "NanoBanana Prop Plate Prompt (16:9, 1K)",
    "MJ Character Reference Prompt",
    "Seedance Combined Environment Sheet (16:9, 1K)",
    "Hero Reference Sheet — full body angles",   // novel wording, must still work
    "Costume Plate (NanoBanana)",
  ];
  const no = [
    "Identity Block", "Identity Block (creature)",
    "Kling Element Description", "Seedance Character Lock",
    "Canonical Environment Block (paste into every nb-prompt)",
    "Visual Anchors", "Visual identity", "Consistency Notes", "Transformation note",
  ];
  test("recognises reference/sheet/plate/prompt/angle sections (incl. novel wording)", () => {
    for (const h of yes) assert.ok(isReferenceSectionHeading(h), `should match: ${h}`);
  });
  test("excludes prose blocks", () => {
    for (const h of no) assert.ok(!isReferenceSectionHeading(h), `should NOT match: ${h}`);
  });
});

describe("view parsing robustness", () => {
  function charFile(projDir: string, name: string, body: string) {
    writeFile(path.join(projDir, "storyboard", "characters", `${name}.md`),
      `---\nname: "${name}"\nelement_name: "${name}"\nelement_type: character\nappears_in: []\nstatus: draft\nelement_status: not-created\n---\n\n${body}`);
  }

  test("a never-before-seen reference heading still yields views", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    charFile(projDir, "hero", `## Hero Reference Sheet — bespoke wording

### Prompt 1 — Front (3:4, 1K)
\`\`\`
front body prompt
\`\`\`
`);
    const char = loadSingleCharacter(projDir, "hero")!;
    assert.equal(char.views.length, 1);
    assert.ok(char.views[0].prompt.includes("front body prompt"));
  });

  test("fenced prose blocks (Identity / Kling / Canonical) are NOT turned into views", () => {
    const projDir = path.join(tmpDir, "proj");
    createProjectYaml(projDir);
    charFile(projDir, "ghost", `## Identity Block
\`\`\`
Face: round
\`\`\`

## Kling Element Description
\`\`\`
A man.
\`\`\`

## Canonical Environment Block (paste into every nb-prompt)
\`\`\`
[World Plate]: @X
\`\`\`
`);
    const char = loadSingleCharacter(projDir, "ghost")!;
    assert.equal(char.views.length, 0);
  });

  test("hasReferencePrompts detects a fenced prompt in a reference section, not prose blocks", () => {
    assert.equal(hasReferencePrompts("## Creature Reference Sheet\n\n### Prompt — X\n```\np\n```"), true);
    assert.equal(hasReferencePrompts("## Identity Block\n```\nFace:\n```"), false);
  });

  test("countElementViews counts only real prompt views", () => {
    assert.equal(countElementViews("## Reference Sheet (NanoBanana)\n\n### Angle 1 — Front\n```\np1\n```\n\n### Angle 2 — Side\n```\np2\n```"), 2);
  });
});
