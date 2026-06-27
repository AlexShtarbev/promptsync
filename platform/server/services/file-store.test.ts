import { test, after } from "node:test";
import assert from "node:assert/strict";
import { MemFileStore, FsStore, setFileStore } from "./file-store.js";
import { loadProject, loadSingleShot } from "./markdown-parser.js";

// Restore the Node default so sibling suites (which rely on real fs) are unaffected
// even if node runs these in the same process.
after(() => setFileStore(new FsStore()));

/** Seed a minimal but realistic project into an in-memory store. */
function seedProject(): MemFileStore {
  const mem = new MemFileStore();
  mem.set(
    "/proj/project.yaml",
    `name: Test
slug: test
created: 2026-01-01
status: in-progress
aspect_ratio: "9:16"
default_resolution: "1K"
`
  );
  mem.set(
    "/proj/storyboard/shots/1A/shot.md",
    `---
shot: 1A
setting: lake
status: draft
asset_type: still
elements: []
---
## Subject & Action
Otto drifts on the raft.
`
  );
  mem.set(
    "/proj/storyboard/shots/1A/nb-prompt.md",
    `---
shot: 1A
platform: nanobanana
---
[Subject]: a chocolate otter
[Action]: drifting on a raft
`
  );
  mem.set(
    "/proj/storyboard/characters/otto.md",
    `---
name: Otto
element_name: Otto
element_type: character
appears_in: ["1A"]
---
## Reference Sheet
### Angle 1 — Front (PRIMARY)
\`\`\`
a chocolate otter, front view
\`\`\`
`
  );
  return mem;
}

test("loadProject parses a project entirely from a non-fs FileStore (the browser/Drive path)", () => {
  setFileStore(seedProject());

  const idx = loadProject("/proj");
  assert.ok(idx, "project loaded");
  assert.equal(idx!.config.slug, "test");

  // Shot parsed, with its nb-prompt landing in mjPrompt tagged nanobanana.
  assert.equal(idx!.shots.length, 1);
  const shot = idx!.shots[0];
  assert.equal(shot.code, "1A");
  assert.equal(shot.meta.setting, "lake");
  assert.equal(shot.mjPrompt?.meta.platform, "nanobanana");
  assert.match(shot.mjPrompt!.body, /chocolate otter/);

  // Character parsed, with one reference view, and auto-linked to the shot via appears_in.
  assert.equal(idx!.characters.length, 1);
  const otto = idx!.characters[0];
  assert.equal(otto.name, "Otto");
  assert.equal(otto.views.length, 1);
  assert.equal(otto.views[0].primary, true);
  assert.ok(shot.meta.elements.includes("Otto"), "shot picked up Otto from appears_in");
});

test("loadSingleShot resolves a shot from the in-memory store", () => {
  setFileStore(seedProject());
  const shot = loadSingleShot("/proj", "1A");
  assert.ok(shot);
  assert.equal(shot!.code, "1A");
  assert.equal(shot!.mjPrompt?.meta.platform, "nanobanana");
});

test("MemFileStore.readDir infers directories and lists files", () => {
  const mem = new MemFileStore();
  mem.set("/r/a/x.md", "x");
  mem.set("/r/a/y.md", "y");
  mem.set("/r/b/z.md", "z");

  const top = mem.readDir("/r").sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(top, [
    { name: "a", isDirectory: true },
    { name: "b", isDirectory: true },
  ]);
  const a = mem.readDir("/r/a").map((e) => e.name).sort();
  assert.deepEqual(a, ["x.md", "y.md"]);
  assert.equal(mem.exists("/r/a"), true);
  assert.equal(mem.exists("/r/a/x.md"), true);
  assert.equal(mem.exists("/r/nope"), false);
});
