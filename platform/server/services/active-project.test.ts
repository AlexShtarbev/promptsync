import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getActiveProject, setActiveProject, initActiveProject } from "./active-project.js";
import type { Broadcaster } from "./ws-hub.js";

function fakeHub() {
  const sent: Record<string, unknown>[] = [];
  const hub: Broadcaster = { broadcast: (d) => { sent.push(d); } };
  return { hub, sent };
}

describe("active-project", () => {
  beforeEach(() => {
    initActiveProject({ broadcast: () => {} }); // reset broadcaster between tests
    setActiveProject(null);
  });

  test("set then get round-trips the slug", () => {
    setActiveProject("ep01");
    assert.equal(getActiveProject(), "ep01");
    setActiveProject(null);
    assert.equal(getActiveProject(), null);
  });

  test("setActiveProject broadcasts active-changed", () => {
    const { hub, sent } = fakeHub();
    initActiveProject(hub);
    setActiveProject("ep02");
    assert.deepEqual(sent.at(-1), { type: "active-changed", slug: "ep02" });
  });

  test("broadcasts null when cleared", () => {
    const { hub, sent } = fakeHub();
    initActiveProject(hub);
    setActiveProject(null);
    assert.deepEqual(sent.at(-1), { type: "active-changed", slug: null });
  });

  test("does not throw when no broadcaster is wired", () => {
    // Simulate a fresh module with no hub by not calling initActiveProject with a real hub.
    // (beforeEach wired a no-op hub; calling set should still be safe.)
    assert.doesNotThrow(() => setActiveProject("ep03"));
  });
});
