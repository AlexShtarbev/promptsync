import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { parsePromptBlocks, assembleNbPrompt, subjectText } from "./prompt-assembler.js";
import { loadProject, invalidateWorkspaceCache } from "./markdown-parser.js";
import { validateContinuity } from "./continuity-validator.js";
import { compileShot, loadManifestsForProject } from "./state-importer.js";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "assembler-test-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  invalidateWorkspaceCache();
});

describe("parsePromptBlocks", () => {
  test("preserves original labels and multi-line content", () => {
    const blocks = parsePromptBlocks(
      `[Subject]: a man\nstill standing\n[World Plate]: a cold chamber\nNegative prompt: blurry`,
    );
    assert.equal(blocks[0].label, "Subject");
    assert.match(blocks[0].content, /still standing/);
    assert.equal(blocks[1].label, "World Plate");
    assert.equal(blocks[2].type, "negative");
  });
});

describe("assembleNbPrompt", () => {
  test("rewrites [Subject] + Negative, preserves frontmatter and other blocks", () => {
    const raw = `---\nshot: "3C"\nplatform: "nanobanana"\n---\n\n[Subject]: thin subject\n[World Plate]: @Floor1Chamber, cold blue-black chamber\n[Camera Capture]: 9:16 low angle\nNegative prompt: old negative`;
    const out = assembleNbPrompt(raw, {
      subjectClauses: ["@HaleS0, sallow", "noticeably overweight", "pinned flat on his back, NOT rising, NOT standing"],
      taggedClauses: [],
      negative: "lean, fit",
      notes: [],
    });
    assert.match(out, /platform: nanobanana/); // frontmatter kept (YAML re-normalized, unquoted)
    assert.match(out, /\[World Plate\]: @Floor1Chamber/); // creative block kept verbatim
    assert.match(out, /\[Camera Capture\]: 9:16 low angle/);
    assert.match(out, /\[Subject\]: @HaleS0, sallow\. noticeably overweight\. pinned flat on his back, NOT rising, NOT standing\./);
    assert.match(out, /Negative prompt: lean, fit/);
    assert.doesNotMatch(out, /thin subject|old negative/);
  });
});

// ── The closed loop: thin prompt → validator flags → assemble → write → lint green ──

function writeProject(thinSubject: string): void {
  const mk = (p: string, c: string) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  };
  mk(path.join(tmp, "project.yaml"), `name: "T"\nslug: t\naspect_ratio: "9:16"\n`);
  mk(
    path.join(tmp, "storyboard/characters/hale.md"),
    `---\nname: "Hale"\nelement_name: "HaleS0"\nelement_type: character\nappears_in: [3C]\n---\n\n# Hale\n\n## Identity Block\n\n\`\`\`\nFace: round heavy face, sallow skin.\nBuild: noticeably overweight, heavy soft belly straining the t-shirt, thick neck.\n\`\`\`\n`,
  );
  mk(
    path.join(tmp, "storyboard/continuity/scene-1-objects.md"),
    `---\nscene: 1\n---\n\n## Hale — action/state timeline\n\n| Shot | Opening state | Closing state |\n|---|---|---|\n| 3C | pinned flat on his back, shard in fist | mid-strike |\n`,
  );
  mk(
    path.join(tmp, "storyboard/shots/3C/shot.md"),
    `---\nshot: 3C\nshot_type: "Low MCU"\nelements: [HaleS0]\n---\n\n## Subject & Action\n@HaleS0 swings the shard up.\n`,
  );
  mk(
    path.join(tmp, "storyboard/shots/3C/nb-prompt.md"),
    `---\nshot: "3C"\nplatform: "nanobanana"\n---\n\n[Subject]: ${thinSubject}\n[World Plate]: @Floor1Chamber, cold blue-black chamber\n[Camera Capture]: 9:16 vertical, low angle\nNegative prompt: blurry`,
  );
}

describe("closed loop — compile → assemble → write → re-lint", () => {
  test("a thin prompt is flagged, then passes after assembly writes the state back in", () => {
    // Thin: names Hale + a pose-prone action, but states no posture and no build.
    writeProject("@HaleS0 swinging the shard upward");

    const before = validateContinuity(loadProject(tmp)!, tmp, "t");
    assert.ok(
      before.issues.some((i) => i.rule === "L02" && i.shotCode === "3C"),
      `expected L02 on 3C, got ${JSON.stringify(before.issues)}`,
    );

    // Compile from state and assemble into the real nb-prompt file.
    const project = loadProject(tmp)!;
    const manifests = loadManifestsForProject(project, tmp);
    const result = compileShot(project, manifests, "3C");
    assert.ok(!("error" in result));
    if ("error" in result) return;

    const nbPath = path.join(tmp, "storyboard/shots/3C/nb-prompt.md");
    const assembled = assembleNbPrompt(fs.readFileSync(nbPath, "utf-8"), result.compiled);
    fs.writeFileSync(nbPath, assembled);
    invalidateWorkspaceCache();

    // The creative block survived; the state is now present.
    assert.match(assembled, /\[World Plate\]: @Floor1Chamber/);
    assert.match(assembled, /noticeably overweight/);
    assert.match(assembled, /NOT rising, NOT standing/);

    const after = validateContinuity(loadProject(tmp)!, tmp, "t");
    assert.deepEqual(
      after.issues.filter((i) => i.shotCode === "3C" && i.rule === "L02"),
      [],
      `expected clean after assembly, got ${JSON.stringify(after.issues)}`,
    );
  });
});
