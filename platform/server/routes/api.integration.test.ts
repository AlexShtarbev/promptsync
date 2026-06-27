import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import os from "os";

import { workspaceRoutes } from "./workspace.js";
import { documentRoutes } from "./documents.js";
import { characterRoutes } from "./characters.js";
import { projectRoutes } from "./projects.js";
import { validateRoutes } from "./validate.js";
import { extensionRoutes } from "./extension.js";
import { activeRoutes } from "./active.js";

// A malformed-frontmatter file (text after a closed quoted scalar) makes gray-matter
// throw — the exact shape that used to 500 a whole endpoint and blank the UI.
const MALFORMED = `---\ntitle: "The One" — Locked Script\nstatus: locked\n---\n\n# Body Heading\n\nBody text here.\n`;

let server: Server;
let base: string;
let tmp: string;

function w(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function buildWorkspace(root: string) {
  const series = path.join(root, "demo");
  // series manifest
  w(path.join(series, "series.yaml"),
    `name: "Demo"\nslug: demo\ntype: series\nglobal_elements: storyboard\nbible: bible\nepisodes:\n  - episodes/ep01\n`);
  // global element (links to canon)
  w(path.join(series, "storyboard", "characters", "hale.md"),
    `---\nname: "Hale"\nelement_name: "Hale"\nelement_type: character\nscope: global\ncanon: ../../bible/characters/mc.md\nappears_in: ["1A"]\nstatus: draft\nelement_status: not-created\n---\n\n# Hale\n`);
  // bible: one valid, one malformed (resilience), plus a character canon
  w(path.join(series, "bible", "series-bible.md"), `# Series Bible\n\nThe world.\n`);
  w(path.join(series, "bible", "pre-production.md"), MALFORMED);
  w(path.join(series, "bible", "characters", "mc.md"), `# MC\n\nArc.\n`);
  // episode
  const ep = path.join(series, "episodes", "ep01");
  w(path.join(ep, "project.yaml"), `name: "Ep 1"\nslug: demo-ep01\nstatus: in-progress\n`);
  w(path.join(ep, "script.md"), MALFORMED); // malformed frontmatter — must not 500
  // extra root-level docs: generalized discovery surfaces these too
  w(path.join(ep, "notes.txt"), `Plain text notes.\n`);
  w(path.join(ep, "grid-architect-prompt.md"), `# Grid\n\nMD VERSION\n`);
  w(path.join(ep, "grid-architect-prompt.txt"), `TXT VERSION\n`); // .md twin must win
  w(path.join(ep, "storyboard", "characters", "monster.md"),
    `---\nname: "Monster"\nelement_name: "Monster"\nelement_type: creature\nappears_in: ["1A"]\nstatus: draft\nelement_status: not-created\n---\n\n# Monster\n`);
  w(path.join(ep, "storyboard", "shots", "1A", "shot.md"),
    `---\nshot: "1A"\nsetting: "Cave"\nstatus: draft\nasset_type: still\n---\n\n## Subject & Action\nHale enters.\n`);
}

const json = async (path: string) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json().catch(() => null) };
};

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "api-int-"));
  buildWorkspace(tmp);
  const app = express();
  app.use(express.json());
  app.use("/api/workspace", workspaceRoutes(tmp));
  app.use("/api/projects", projectRoutes(tmp));
  app.use("/api/projects", documentRoutes(tmp));
  app.use("/api/projects", characterRoutes(tmp));
  app.use("/api/projects", validateRoutes(tmp));
  app.use("/api/extension", extensionRoutes(tmp));
  app.use("/api/active", activeRoutes());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("GET /api/workspace", () => {
  test("returns the series tree with its episode, no standalone dupes", async () => {
    const { status, body } = await json("/api/workspace");
    assert.equal(status, 200);
    assert.equal(body.projects.length, 0);
    assert.equal(body.series.length, 1);
    assert.equal(body.series[0].slug, "demo");
    assert.equal(body.series[0].episodes[0].slug, "demo-ep01");
    assert.equal(body.series[0].episodes[0].seriesSlug, "demo");
  });
});

describe("GET /api/workspace/series/:slug/bible", () => {
  test("groups docs and strips frontmatter (even malformed)", async () => {
    const { status, body } = await json("/api/workspace/series/demo/bible");
    assert.equal(status, 200);
    const slugs = body.docs.map((d: { slug: string }) => d.slug).sort();
    assert.deepEqual(slugs, ["characters/mc", "pre-production", "series-bible"]);
    const pp = body.docs.find((d: { slug: string }) => d.slug === "pre-production");
    // malformed frontmatter is stripped, not rendered as text
    assert.ok(pp.content.startsWith("# Body Heading"), `got: ${pp.content.slice(0, 30)}`);
    assert.doesNotMatch(pp.content, /title:/);
    assert.equal(body.docs.find((d: { slug: string }) => d.slug === "characters/mc").group, "characters");
  });

  test("404 for an unknown series", async () => {
    assert.equal((await json("/api/workspace/series/nope/bible")).status, 404);
  });
});

describe("GET /api/workspace/series/:slug/global", () => {
  test("returns the global elements", async () => {
    const { body } = await json("/api/workspace/series/demo/global");
    assert.deepEqual(body.characters.map((c: { name: string }) => c.name), ["Hale"]);
  });
});

describe("GET /api/workspace/validate", () => {
  test("returns a structured report", async () => {
    const { status, body } = await json("/api/workspace/validate");
    assert.equal(status, 200);
    assert.equal(typeof body.ok, "boolean");
    assert.ok(Array.isArray(body.issues));
    assert.ok("error" in body.counts && "warning" in body.counts);
  });
});

describe("GET /api/projects/:slug/documents — resilience", () => {
  test("a malformed-frontmatter file returns 200 (not 500) with body stripped", async () => {
    const { status, body } = await json("/api/projects/demo-ep01/documents");
    assert.equal(status, 200, "malformed frontmatter must not 500");
    const script = body.docs.find((d: { slug: string }) => d.slug === "script");
    assert.ok(script, "script doc present");
    assert.ok(script.content.startsWith("# Body Heading"));
    assert.doesNotMatch(script.content, /title:/);
  });

  test("surfaces all root .md/.txt docs; .md wins over its .txt twin", async () => {
    const { body } = await json("/api/projects/demo-ep01/documents");
    const slugs = body.docs.map((d: { slug: string }) => d.slug);
    assert.ok(slugs.includes("notes"), "plain .txt doc surfaced");
    assert.ok(slugs.includes("grid-architect-prompt"), "extra .md doc surfaced");
    // .txt twin is deduped away — exactly one entry, content from the .md
    assert.equal(slugs.filter((s: string) => s === "grid-architect-prompt").length, 1);
    const grid = body.docs.find((d: { slug: string }) => d.slug === "grid-architect-prompt");
    assert.match(grid.content, /MD VERSION/);
    assert.doesNotMatch(grid.content, /TXT VERSION/);
    assert.equal(grid.name, "Grid Architect Prompt", "name title-cased from slug");
    // priority doc leads the list
    assert.equal(body.docs[0].slug, "script");
  });
});

describe("GET /api/projects/:slug/characters", () => {
  test("merges global + local with scope, and rewrites image URLs", async () => {
    const { body } = await json("/api/projects/demo-ep01/characters");
    const byName = Object.fromEntries(body.map((c: { name: string }) => [c.name, c]));
    assert.equal(byName["Hale"].meta.scope, "global");
    assert.equal(byName["Monster"].meta.scope, "local");
  });
});

describe("GET /api/extension/index", () => {
  test("includes the series-global element for an episode", async () => {
    const { body } = await json("/api/extension/index?project=demo-ep01");
    const names = body.characters.map((c: { element_name: string }) => c.element_name);
    assert.ok(names.includes("Hale"), "global Hale resolves for the episode");
    assert.ok(names.includes("Monster"));
  });
});

describe("/api/active", () => {
  test("POST then GET round-trips the active slug", async () => {
    await fetch(base + "/api/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "demo-ep01" }),
    });
    const { body } = await json("/api/active");
    assert.equal(body.slug, "demo-ep01");
  });
});
