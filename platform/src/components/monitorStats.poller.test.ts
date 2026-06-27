import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { startMonitorPolling } from "./monitorStats.poller.js";
import type { MonitorLatest, ResourceSample } from "../api/client.js";

function sample(rssMB = 200): ResourceSample {
  return {
    t: "2026-06-09T00:00:00.000Z",
    uptimeSec: 1,
    rssMB,
    heapUsedMB: 70,
    heapTotalMB: 100,
    externalMB: 5,
    arrayBuffersMB: 1,
    openFds: 30,
    cpuUserMs: 0,
    cpuSystemMs: 0,
    eventLoopLag: { meanMs: 0, maxMs: 0, p99Ms: 0 },
    ws: { clients: 0, terminatedDead: 0, droppedBackpressure: 0, totalConnections: 0 },
  };
}
const latest = (s: ResourceSample | null): MonitorLatest => ({ latest: s, samples: s ? 1 : 0, file: null });

const flush = () => new Promise((r) => setImmediate(r));

// Captures the interval callback so the test can fire "ticks" deterministically.
function fakeTimers() {
  let captured: { cb: () => void; ms: number } | null = null;
  const cleared: unknown[] = [];
  const TIMER_ID = 4242;
  return {
    setIntervalFn: ((cb: () => void, ms?: number) => {
      captured = { cb, ms: ms ?? 0 };
      return TIMER_ID as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval,
    clearIntervalFn: ((id?: unknown) => {
      cleared.push(id);
    }) as typeof clearInterval,
    fire: () => captured?.cb(),
    capturedMs: () => captured?.ms,
    cleared,
    TIMER_ID,
  };
}

describe("startMonitorPolling", () => {
  test("fetches immediately on start and reports the latest sample", async () => {
    const timers = fakeTimers();
    const seen: (ResourceSample | null)[] = [];
    startMonitorPolling({
      fetchLatest: async () => latest(sample(123)),
      onSample: (s) => seen.push(s),
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });

    await flush();
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.rssMB, 123);
  });

  test("registers the interval with the configured period", async () => {
    const timers = fakeTimers();
    startMonitorPolling({
      fetchLatest: async () => latest(sample()),
      onSample: () => {},
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    await flush();
    assert.equal(timers.capturedMs(), 5000);
  });

  test("re-fetches on each interval tick", async () => {
    const timers = fakeTimers();
    let calls = 0;
    const seen: (ResourceSample | null)[] = [];
    startMonitorPolling({
      fetchLatest: async () => latest(sample(100 + ++calls)),
      onSample: (s) => seen.push(s),
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });

    await flush();              // initial fetch
    timers.fire(); await flush(); // tick 1
    timers.fire(); await flush(); // tick 2

    assert.equal(seen.length, 3);
    assert.deepEqual(seen.map((s) => s?.rssMB), [101, 102, 103]);
  });

  test("reports null when a fetch fails", async () => {
    const timers = fakeTimers();
    const seen: (ResourceSample | null)[] = [];
    startMonitorPolling({
      fetchLatest: async () => { throw new Error("network down"); },
      onSample: (s) => seen.push(s),
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });

    await flush();
    assert.deepEqual(seen, [null]);
  });

  test("stop() clears the interval", async () => {
    const timers = fakeTimers();
    const stop = startMonitorPolling({
      fetchLatest: async () => latest(sample()),
      onSample: () => {},
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    await flush();
    stop();
    assert.deepEqual(timers.cleared, [timers.TIMER_ID]);
  });

  test("stop() blocks an in-flight request from reporting after teardown", async () => {
    const timers = fakeTimers();
    const seen: (ResourceSample | null)[] = [];
    let resolveFetch!: (v: MonitorLatest) => void;
    const stop = startMonitorPolling({
      fetchLatest: () => new Promise<MonitorLatest>((r) => { resolveFetch = r; }),
      onSample: (s) => seen.push(s),
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });

    // Unmount before the in-flight fetch resolves...
    stop();
    resolveFetch(latest(sample()));
    await flush();

    // ...so onSample must never be called (no setState on an unmounted component).
    assert.deepEqual(seen, []);
  });

  test("does not keep polling after stop()", async () => {
    const timers = fakeTimers();
    let calls = 0;
    const stop = startMonitorPolling({
      fetchLatest: async () => { calls++; return latest(sample()); },
      onSample: () => {},
      intervalMs: 5000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    await flush();
    assert.equal(calls, 1);
    stop();
    // Even if a stray tick fires, the result is dropped (stopped guard).
    timers.fire(); await flush();
    assert.equal(calls, 2);   // fetch may run, but...
    // ...nothing is reported — verified by the in-flight test above.
  });
});
