import { test } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { resolveTargets } from "./drive-push-changed.js";

const REPO = "/home/u/src";
// Fake repo: otto-and-pip is standalone (project.yaml); wren is a SERIES (series.yaml) with
// an episode wren/episodes/ep1 (project.yaml) and a shared global library under wren/storyboard.
const SERIES = new Set([path.join(REPO, "wren")]);
const PROJECTS = new Set([path.join(REPO, "otto-and-pip"), path.join(REPO, "wren/episodes/ep1")]);
const hasFile = (dir: string, name: string) =>
  name === "series.yaml" ? SERIES.has(dir) : name === "project.yaml" ? PROJECTS.has(dir) : false;

test("standalone project: maps changed markdown to its project with the right relPath", () => {
  const targets = resolveTargets(
    REPO,
    ["otto-and-pip/storyboard/shots/1A/shot.md", "otto-and-pip/project.yaml"],
    hasFile
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

test("series episode: mirrors under the SERIES root, keeping the episode path", () => {
  const targets = resolveTargets(REPO, ["wren/episodes/ep1/storyboard/shots/2B/shot.md"], hasFile);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].projectName, "wren");
  assert.equal(targets[0].relPath, "episodes/ep1/storyboard/shots/2B/shot.md");
});

test("series globals: shared library files mirror under the series root too", () => {
  const targets = resolveTargets(REPO, ["wren/storyboard/characters/otto.md"], hasFile);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].projectName, "wren");
  assert.equal(targets[0].relPath, "storyboard/characters/otto.md");
});

test("skips non-text (assets) and files outside any project", () => {
  const targets = resolveTargets(
    REPO,
    [
      "otto-and-pip/storyboard/shots/1A/image.png", // asset → MCP's job, not git-mirrored
      "some-other-work-dir/notes.md", // not under a project
      "README.md", // repo root, no project
    ],
    hasFile
  );
  assert.deepEqual(targets, []);
});

test("a file directly in the project root maps to relPath with no subdirs", () => {
  const targets = resolveTargets(REPO, ["otto-and-pip/project.yaml"], hasFile);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].relPath, "project.yaml");
  assert.equal(path.dirname(targets[0].relPath), ".");
});
