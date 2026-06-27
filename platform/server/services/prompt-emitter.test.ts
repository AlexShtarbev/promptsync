import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { emitProject } from "./prompt-emitter.js";
import { loadProject, invalidateWorkspaceCache } from "./markdown-parser.js";

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "emit-test-")); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); invalidateWorkspaceCache(); });

function mk(p: string, c: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c);
}

/** A project: one shot WITH state (3C, Hale pinned) and one WITHOUT (9Z, no manifest row). */
function writeProject(thinSubject: string) {
  mk(path.join(tmp, "project.yaml"), `name: T\nslug: t\naspect_ratio: "9:16"\n`);
  mk(path.join(tmp, "storyboard/characters/hale.md"),
    `---\nname: Hale\nelement_name: HaleS0\nelement_type: character\nappears_in: [3C]\n---\n\n# Hale\n\n## Identity Block\n\n\`\`\`\nFace: round heavy face.\nBuild: noticeably overweight, heavy soft belly.\n\`\`\`\n`);
  mk(path.join(tmp, "storyboard/continuity/scene-1-objects.md"),
    `---\nscene: 1\n---\n\n## Hale — action/state timeline\n\n| Shot | Opening state | Closing state |\n|---|---|---|\n| 3C | pinned flat on his back, shard in fist | mid-strike |\n`);
  mk(path.join(tmp, "storyboard/shots/3C/shot.md"), `---\nshot: 3C\nshot_type: "Low MCU"\nelements: [HaleS0]\n---\n\n## Subject & Action\nx\n`);
  mk(path.join(tmp, "storyboard/shots/3C/nb-prompt.md"),
    `---\nshot: "3C"\nplatform: nanobanana\n---\n\n[Subject]: ${thinSubject}\n[World Plate]: @Floor1Chamber, cold blue-black chamber\nNegative prompt: blurry`);
  // 9Z: a shot with NO manifest state and an authored prompt that must NOT be clobbered.
  mk(path.join(tmp, "storyboard/shots/9Z/shot.md"), `---\nshot: 9Z\nshot_type: WS\n---\n\n## Subject & Action\ny\n`);
  mk(path.join(tmp, "storyboard/shots/9Z/nb-prompt.md"),
    `---\nshot: "9Z"\nplatform: nanobanana\n---\n\n[Subject]: a hand-authored establishing shot, no character state\n[World Plate]: a wide vista`);
}

describe("emitProject", () => {
  test("emits [Subject] from state, preserves creative blocks, and leaves stateless shots untouched", () => {
    writeProject("@HaleS0 swinging");
    const before9Z = fs.readFileSync(path.join(tmp, "storyboard/shots/9Z/nb-prompt.md"), "utf-8");

    const res = emitProject(loadProject(tmp)!, tmp, "t", { write: true });

    const nb3C = fs.readFileSync(path.join(tmp, "storyboard/shots/3C/nb-prompt.md"), "utf-8");
    assert.match(nb3C, /noticeably overweight/);                 // build injected from state (mechanical)
    assert.match(nb3C, /@HaleS0 swinging/);                      // authored subject preserved (append-only)
    assert.doesNotMatch(nb3C, /pinned flat on his back/);        // posture NOT auto-written (left to L02 / author judgment)
    assert.match(nb3C, /\[World Plate\]: @Floor1Chamber/);       // creative block preserved

    // stateless shot untouched
    assert.equal(fs.readFileSync(path.join(tmp, "storyboard/shots/9Z/nb-prompt.md"), "utf-8"), before9Z);
    assert.ok(res.skipped >= 1);
    assert.ok(res.changes.some((c) => c.shotCode === "3C"));
    assert.ok(!res.changes.some((c) => c.shotCode === "9Z"));
  });

  test("is idempotent — a second emit changes nothing (no write-loop)", () => {
    writeProject("@HaleS0 swinging");
    emitProject(loadProject(tmp)!, tmp, "t", { write: true });
    invalidateWorkspaceCache();
    const second = emitProject(loadProject(tmp)!, tmp, "t", { write: true });
    assert.deepEqual(second.changes, []);
  });

  test("dry-run reports changes without writing", () => {
    writeProject("@HaleS0 swinging");
    const before = fs.readFileSync(path.join(tmp, "storyboard/shots/3C/nb-prompt.md"), "utf-8");
    const res = emitProject(loadProject(tmp)!, tmp, "t", { write: false });
    assert.ok(res.changes.some((c) => c.shotCode === "3C"));     // would change
    assert.equal(fs.readFileSync(path.join(tmp, "storyboard/shots/3C/nb-prompt.md"), "utf-8"), before); // but didn't
  });
});
