import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { startMonitor, type MonitorHandle } from "./monitor.js";

const open: MonitorHandle[] = [];
const NEVER = 1_000_000_000; // effectively-never interval; we drive sampling manually

describe("monitor", () => {
  afterEach(() => {
    for (const m of open) m.stop();
    open.length = 0;
  });

  test("sampleNow returns a populated resource sample", () => {
    const m = startMonitor({ intervalMs: NEVER });
    open.push(m);
    const s = m.sampleNow();
    assert.ok(s.rssMB > 0, "rss should be positive");
    assert.ok(s.heapUsedMB > 0, "heapUsed should be positive");
    assert.equal(typeof s.uptimeSec, "number");
    assert.ok(s.eventLoopLag && typeof s.eventLoopLag.p99Ms === "number");
    assert.ok("openFds" in s);
    assert.ok(typeof s.t === "string");
  });

  test("includes WebSocket stats from the provider", () => {
    const stats = { clients: 3, terminatedDead: 1, droppedBackpressure: 2, totalConnections: 9 };
    const m = startMonitor({ intervalMs: NEVER, wsStats: () => stats });
    open.push(m);
    assert.deepEqual(m.sampleNow().ws, stats);
  });

  test("history is a bounded ring buffer", () => {
    const m = startMonitor({ intervalMs: NEVER, historySize: 3 });
    open.push(m);
    for (let i = 0; i < 5; i++) m.sampleNow();
    assert.equal(m.history().length, 3);
  });

  test("retention bounds the ring by time (15 min default at 15s = 60)", () => {
    const m = startMonitor({ intervalMs: 15_000 }); // default retention 15 min
    open.push(m);
    for (let i = 0; i < 100; i++) m.sampleNow();
    assert.equal(m.history().length, 60);
  });

  test("explicit retentionMs sets the ring size", () => {
    const m = startMonitor({ intervalMs: 15_000, retentionMs: 30 * 60_000 }); // 30 min
    open.push(m);
    for (let i = 0; i < 200; i++) m.sampleNow();
    assert.equal(m.history().length, 120);
  });

  test("seeds one sample immediately on start", () => {
    const m = startMonitor({ intervalMs: NEVER });
    open.push(m);
    assert.equal(m.history().length, 1);
  });

  test("persists history to disk for post-mortem inspection", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-test-"));
    const fp = path.join(dir, "monitor.json");
    try {
      const m = startMonitor({ intervalMs: NEVER, filePath: fp });
      open.push(m);
      m.sampleNow();
      const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
      assert.ok(Array.isArray(data));
      assert.ok(data.length >= 1);
      assert.ok(data[0].rssMB > 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a bad file path does not throw", () => {
    const m = startMonitor({ intervalMs: NEVER, filePath: "/nonexistent-dir/x/y/z.json" });
    open.push(m);
    assert.doesNotThrow(() => m.sampleNow());
  });

  test("stop is idempotent", () => {
    const m = startMonitor({ intervalMs: NEVER });
    open.push(m);
    assert.doesNotThrow(() => { m.stop(); m.stop(); });
  });
});
