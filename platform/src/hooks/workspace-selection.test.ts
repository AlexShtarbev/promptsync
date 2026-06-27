import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { selectionExists } from "./workspace-selection.js";
import type { WorkspaceTree } from "../api/client.js";

const ws: WorkspaceTree = {
  projects: [{ slug: "ends-cross", name: "End's Cross", status: "in-progress" }],
  series: [{
    slug: "crawler", name: "CRAWLER", status: "in-progress",
    episodes: [{ slug: "crawler-ep01", name: "Ep1", status: "in-progress", seriesSlug: "crawler" }],
  }],
};

describe("selectionExists", () => {
  test("a standalone project is present", () => {
    assert.ok(selectionExists(ws, { kind: "project", slug: "ends-cross", seriesSlug: null }));
  });

  test("a series episode is present", () => {
    assert.ok(selectionExists(ws, { kind: "project", slug: "crawler-ep01", seriesSlug: "crawler" }));
  });

  test("an unknown project is absent (stale restore is rejected)", () => {
    assert.equal(selectionExists(ws, { kind: "project", slug: "ghost", seriesSlug: null }), false);
  });

  test("a series-global selection tracks the series", () => {
    assert.ok(selectionExists(ws, { kind: "series-global", seriesSlug: "crawler" }));
    assert.equal(selectionExists(ws, { kind: "series-global", seriesSlug: "nope" }), false);
  });
});
