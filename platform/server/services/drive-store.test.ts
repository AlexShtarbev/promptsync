import { test, after } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, DRIVE_FOLDER_MIME, type DriveApi, type DriveFile } from "./drive-store.js";
import { FsStore, setFileStore } from "./file-store.js";
import { loadProject } from "./markdown-parser.js";

after(() => setFileStore(new FsStore()));

/**
 * Fake Drive: an in-memory tree of folders/files addressed by synthetic ids. Mirrors the
 * two calls the snapshot makes — listFolder (children) and downloadText (file contents).
 */
interface FakeNode {
  id: string;
  name: string;
  mimeType: string;
  text?: string;
  children?: FakeNode[];
}

function makeFakeDrive(root: FakeNode): { api: DriveApi; downloads: string[] } {
  const byId = new Map<string, FakeNode>();
  const index = (n: FakeNode) => {
    byId.set(n.id, n);
    n.children?.forEach(index);
  };
  index(root);
  const downloads: string[] = [];

  const api: DriveApi = {
    async listFolder(folderId: string): Promise<DriveFile[]> {
      const node = byId.get(folderId);
      return (node?.children ?? []).map((c) => ({ id: c.id, name: c.name, mimeType: c.mimeType }));
    },
    async downloadText(fileId: string): Promise<string> {
      downloads.push(fileId);
      return byId.get(fileId)?.text ?? "";
    },
  };
  return { api, downloads };
}

function folder(id: string, name: string, children: FakeNode[]): FakeNode {
  return { id, name, mimeType: DRIVE_FOLDER_MIME, children };
}
function file(id: string, name: string, text: string): FakeNode {
  return { id, name, mimeType: "text/markdown", text };
}
function binary(id: string, name: string): FakeNode {
  return { id, name, mimeType: "image/png" };
}

// The Picker-selected SYNC ROOT contains one or more project folders (here: otto-and-pip).
// buildSnapshot mounts the root's CONTENTS at mountPath, so the project folder name lands
// in the path: /drive/otto-and-pip/...
const PROJECT_TREE = folder("root", "promptsync-sync-root", [
 folder("otto", "otto-and-pip", [
  file(
    "f-proj",
    "project.yaml",
    `name: Otto
slug: otto-and-pip
created: 2026-01-01
status: in-progress
aspect_ratio: "9:16"
default_resolution: "1K"
`
  ),
  folder("storyboard", "storyboard", [
    folder("shots", "shots", [
      folder("1A", "1A", [
        file(
          "f-shot",
          "shot.md",
          `---
shot: 1A
setting: lake
status: draft
asset_type: still
elements: []
---
## Subject & Action
Otto drifts.
`
        ),
        file(
          "f-nb",
          "nb-prompt.md",
          `---
shot: 1A
platform: nanobanana
---
[Subject]: a chocolate otter
[Action]: drifting
`
        ),
        binary("f-img", "image.png"), // presence marker → status should bump to mj-done
      ]),
    ]),
    folder("characters", "characters", [
      file(
        "f-otto",
        "otto.md",
        `---
name: Otto
element_name: Otto
element_type: character
appears_in: ["1A"]
---
## Reference Sheet
### Angle 1 — Front (PRIMARY)
\`\`\`
a chocolate otter
\`\`\`
`
      ),
    ]),
  ]),
 ]),
]);

test("buildSnapshot materialises a Drive subtree the parser can load end-to-end", async () => {
  const { api, downloads } = makeFakeDrive(PROJECT_TREE);
  const { store, assetIds, stats } = await buildSnapshot(api, "root", "/drive");

  // Only text files are downloaded; the binary is a presence marker, not a download.
  assert.equal(stats.textFiles, 4); // project.yaml, shot.md, nb-prompt.md, otto.md
  assert.equal(stats.assets, 1);
  assert.ok(!downloads.includes("f-img"), "image bytes were NOT downloaded");
  assert.equal(assetIds.get("/drive/otto-and-pip/storyboard/shots/1A/image.png"), "f-img");

  // The snapshot drives the real parser with zero filesystem.
  setFileStore(store);
  const idx = loadProject("/drive/otto-and-pip");
  assert.ok(idx, "project loaded from Drive snapshot");
  assert.equal(idx!.config.slug, "otto-and-pip");
  assert.equal(idx!.shots.length, 1);

  const shot = idx!.shots[0];
  assert.equal(shot.code, "1A");
  assert.equal(shot.mjPrompt?.meta.platform, "nanobanana");
  // Presence marker made findImage() succeed → still-shot status auto-bumped.
  assert.equal(shot.imagePath, "/drive/otto-and-pip/storyboard/shots/1A/image.png");
  assert.equal(shot.meta.status, "mj-done");

  assert.equal(idx!.characters.length, 1);
  assert.equal(idx!.characters[0].name, "Otto");
  assert.ok(shot.meta.elements.includes("Otto"));
});
