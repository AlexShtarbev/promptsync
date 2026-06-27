import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "http";
import { monitorRoutes } from "./monitor.js";
import type { MonitorHandle, ResourceSample } from "../services/monitor.js";

function fakeSample(over: Partial<ResourceSample> = {}): ResourceSample {
  return {
    t: "2026-06-09T00:00:00.000Z",
    uptimeSec: 1,
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

// A MonitorHandle stub backed by a fixed in-memory history.
function fakeMonitor(history: ResourceSample[], filePath: string | null = "/tmp/x.json"): MonitorHandle {
  return {
    stop() {},
    history: () => history,
    sampleNow: () => history[history.length - 1],
    filePath,
  };
}

let server: Server;
let base: string;

function startWith(monitor: MonitorHandle): Promise<void> {
  const app = express();
  app.use("/api/monitor", monitorRoutes(monitor));
  server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      base = `http://localhost:${port}/api/monitor`;
      resolve();
    });
  });
}

describe("monitor routes", () => {
  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  test("GET / returns the latest sample plus a summary", async () => {
    const history = [fakeSample({ rssMB: 100 }), fakeSample({ rssMB: 250 })];
    await startWith(fakeMonitor(history, "/data/.promptsync-monitor.json"));

    const body = await (await fetch(base)).json();
    assert.equal(body.samples, 2);
    assert.equal(body.file, "/data/.promptsync-monitor.json");
    // The contract the frontend reads — must stay stable.
    assert.equal(body.latest.rssMB, 250);
    assert.equal(typeof body.latest.eventLoopLag.p99Ms, "number");
    assert.equal(typeof body.latest.ws.clients, "number");
  });

  test("GET / returns latest=null when there is no history", async () => {
    await startWith(fakeMonitor([]));
    const body = await (await fetch(base)).json();
    assert.equal(body.latest, null);
    assert.equal(body.samples, 0);
  });

  test("GET /history returns the full ring oldest→newest", async () => {
    const history = [fakeSample({ rssMB: 100 }), fakeSample({ rssMB: 150 }), fakeSample({ rssMB: 200 })];
    await startWith(fakeMonitor(history));

    const body = await (await fetch(`${base}/history`)).json();
    assert.ok(Array.isArray(body));
    assert.deepEqual(body.map((s: ResourceSample) => s.rssMB), [100, 150, 200]);
  });
});
