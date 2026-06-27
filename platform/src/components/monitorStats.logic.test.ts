import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, WARN } from "./monitorStats.logic.js";
import type { ResourceSample } from "../api/client.js";

function sample(over: Partial<ResourceSample> = {}): ResourceSample {
  return {
    t: "2026-06-09T00:00:00.000Z",
    uptimeSec: 10,
    rssMB: 200,
    heapUsedMB: 70,
    heapTotalMB: 100,
    externalMB: 5,
    arrayBuffersMB: 1,
    openFds: 30,
    cpuUserMs: 0,
    cpuSystemMs: 0,
    eventLoopLag: { meanMs: 0, maxMs: 0, p99Ms: 0 },
    ws: { clients: 0, terminatedDead: 0, droppedBackpressure: 0, totalConnections: 0 },
    ...over,
  };
}

function byKey(stats: ReturnType<typeof computeStats>) {
  const map: Record<string, { value: string; warn: boolean; title: string }> = {};
  for (const s of stats ?? []) map[s.key] = { value: s.value, warn: s.warn, title: s.title };
  return map;
}

describe("computeStats", () => {
  test("returns null when there is no sample yet", () => {
    assert.equal(computeStats(null), null);
  });

  test("produces RAM, WS, and lag figures in order", () => {
    const stats = computeStats(sample());
    assert.ok(stats);
    assert.deepEqual(stats!.map((s) => s.key), ["ram", "ws", "lag"]);
  });

  test("formats values: RAM rounded to MB, lag to whole ms, clients as count", () => {
    const stats = byKey(computeStats(sample({
      rssMB: 197.6,
      eventLoopLag: { meanMs: 1, maxMs: 9, p99Ms: 12.7 },
      ws: { clients: 4, terminatedDead: 2, droppedBackpressure: 1, totalConnections: 9 },
    })));
    assert.equal(stats.ram.value, "198MB");
    assert.equal(stats.lag.value, "13ms");
    assert.equal(stats.ws.value, "4");
  });

  test("nothing is flagged when all figures are below thresholds", () => {
    const stats = byKey(computeStats(sample()));
    assert.equal(stats.ram.warn, false);
    assert.equal(stats.ws.warn, false);
    assert.equal(stats.lag.warn, false);
  });

  test("RAM warns strictly above the threshold", () => {
    assert.equal(byKey(computeStats(sample({ rssMB: WARN.rssMB }))).ram.warn, false);
    assert.equal(byKey(computeStats(sample({ rssMB: WARN.rssMB + 1 }))).ram.warn, true);
  });

  test("WS warns strictly above the threshold", () => {
    const at = { clients: WARN.clients, terminatedDead: 0, droppedBackpressure: 0, totalConnections: 0 };
    const over = { ...at, clients: WARN.clients + 1 };
    assert.equal(byKey(computeStats(sample({ ws: at }))).ws.warn, false);
    assert.equal(byKey(computeStats(sample({ ws: over }))).ws.warn, true);
  });

  test("lag warns strictly above the threshold", () => {
    const at = { meanMs: 0, maxMs: 0, p99Ms: WARN.lagMs };
    const over = { meanMs: 0, maxMs: 0, p99Ms: WARN.lagMs + 1 };
    assert.equal(byKey(computeStats(sample({ eventLoopLag: at }))).lag.warn, false);
    assert.equal(byKey(computeStats(sample({ eventLoopLag: over }))).lag.warn, true);
  });

  test("WS stat tolerates a null ws block (treats clients as 0)", () => {
    const stats = byKey(computeStats(sample({ ws: null })));
    assert.equal(stats.ws.value, "0");
    assert.equal(stats.ws.warn, false);
    assert.equal(stats.ws.title, "WebSocket clients");
  });

  test("WS tooltip surfaces reaped/dropped counts (the leak signature)", () => {
    const stats = byKey(computeStats(sample({
      ws: { clients: 3, terminatedDead: 7, droppedBackpressure: 2, totalConnections: 40 },
    })));
    assert.match(stats.ws.title, /Reaped 7/);
    assert.match(stats.ws.title, /dropped 2/);
  });
});
