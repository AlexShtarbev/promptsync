import { test, after } from "node:test";
import assert from "node:assert/strict";
import { MemFileStore, FsStore, setFileStore } from "./file-store.js";
import { loadProject } from "./markdown-parser.js";
import { buildExtensionIndex } from "./extension-index.js";

after(() => setFileStore(new FsStore()));

function seed(): MemFileStore {
  const mem = new MemFileStore();
  mem.set("/p/project.yaml", `name: P\nslug: p\naspect_ratio: "9:16"\ndefault_resolution: "1K"\n`);
  mem.set(
    "/p/storyboard/shots/1A/shot.md",
    `---\nshot: 1A\nsetting: lake\nstatus: draft\nasset_type: still\nelements: []\n---\n## Subject & Action\nOtto drifts.\n## VO / Lines\n"hi"\n`
  );
  mem.set("/p/storyboard/shots/1A/nb-prompt.md", `---\nshot: 1A\nplatform: nanobanana\n---\n[Subject]: an otter\n`);
  mem.set(
    "/p/storyboard/characters/otto.md",
    `---\nname: Otto\nelement_name: Otto\nelement_type: character\nappears_in: ["1A"]\n---\n## Reference Sheet\n### Angle 1 — Front (PRIMARY)\n\`\`\`\nan otter\n\`\`\`\n`
  );
  return mem;
}

test("buildExtensionIndex produces the compact panel payload from a (Drive-style) snapshot", () => {
  setFileStore(seed());
  const idx = loadProject("/p");
  assert.ok(idx);

  const ext = buildExtensionIndex(idx!, "p");
  assert.equal(ext.project, "p");
  assert.equal(ext.aspect_ratio, "9:16");

  assert.equal(ext.shots.length, 1);
  const s = ext.shots[0];
  assert.equal(s.code, "1A");
  assert.equal(s.setting, "lake");
  assert.equal(s.has_mj, true); // nb-prompt lands in mjPrompt
  assert.equal(s.has_kling, false);
  assert.equal(s.subject_action, "Otto drifts.");
  assert.match(s.vo_lines, /hi/);
  assert.deepEqual(s.elements, ["Otto"]); // auto-linked via appears_in

  assert.equal(ext.characters.length, 1);
  const c = ext.characters[0];
  assert.equal(c.name, "Otto");
  assert.equal(c.views.length, 1);
  assert.equal(c.views[0].primary, true);
  // element_name === name here, so no elementMap entry is added.
  assert.deepEqual(ext.elementMap, {});
});
