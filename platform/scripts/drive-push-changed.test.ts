import { test } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { resolveTargets } from "./drive-push-changed.js";

const REPO = "/home/u/src";
// Projects in this fake repo: otto-and-pip (standalone) and series episode wren/episodes/ep1.
const PROJECTS = new Set([
  path.join(REPO, "otto-and-pip"),
  path.join(REPO, "wren/episodes/ep1"),
]);
const hasProjectYaml = (dir: string) => PROJECTS.has(dir);

test("maps changed markdown to its owning project with the right relPath", () => {
  const targets = resolveTargets(
    REPO,
    ["otto-and-pip/storyboard/shots/1A/shot.md", "otto-and-pip/project.yaml"],
    hasProjectYaml
  );
  assert.equal(targets.length, 2);
  assert.deepEqual(
    targets.map((t) => [t.projectName, t.relPath]).sort(),
    [
      ["otto-and-pip", "project.yaml"],
      ["otto-and-pip", "storyboard/shots/1A/shot.md"],
    ]
  );
});

test("resolves a nested series-episode project root, not the series dir", () => {
  const targets = resolveTargets(REPO, ["wren/episodes/ep1/storyboard/shots/2B/shot.md"], hasProjectYaml);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].projectName, "ep1");
  assert.equal(targets[0].relPath, "storyboard/shots/2B/shot.md");
});

test("skips non-text (assets) and files outside any project", () => {
  const targets = resolveTargets(
    REPO,
    [
      "otto-and-pip/storyboard/shots/1A/image.png", // asset → MCP's job, not git-mirrored
      "some-other-work-dir/notes.md", // not under a project
      "README.md", // repo root, no project
    ],
    hasProjectYaml
  );
  assert.deepEqual(targets, []);
});

test("a file directly in the project root maps to relPath with no subdirs", () => {
  const targets = resolveTargets(REPO, ["otto-and-pip/series.yaml"], hasProjectYaml);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].relPath, "series.yaml");
  assert.equal(path.dirname(targets[0].relPath), ".");
});
