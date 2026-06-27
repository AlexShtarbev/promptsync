import fs from "fs";
import { monitorEventLoopDelay, type IntervalHistogram } from "perf_hooks";
import type { WsHubStats } from "./ws-hub.js";

// Lightweight self-monitoring. Samples process resource usage on an interval into
// a bounded in-memory ring AND (best-effort) a JSON file on disk. The file is the
// point: if the process is OOM-killed or the VM locks up, the last samples survive
// so you can open the file afterwards and see what was climbing (RSS, heap, open
// FDs, event-loop lag, tracked WebSocket clients) right before it died.

export interface EventLoopLag {
  meanMs: number;
  maxMs: number;
  p99Ms: number;
}

export interface ResourceSample {
  t: string;            // ISO timestamp
  uptimeSec: number;
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  openFds: number | null;     // Linux only (via /proc/self/fd); null elsewhere
  cpuUserMs: number;          // CPU time consumed since the previous sample
  cpuSystemMs: number;
  eventLoopLag: EventLoopLag; // since the previous sample
  ws: WsHubStats | null;
}

export interface MonitorHandle {
  stop(): void;
  history(): ResourceSample[];
  /** Take a sample immediately (also used internally on each tick). */
  sampleNow(): ResourceSample;
  filePath: string | null;
}

export interface MonitorOptions {
  intervalMs?: number;
  /** How much trailing history to keep (default 15 min). Sets the ring/file size. */
  retentionMs?: number;
  /** Explicit ring size; overrides retentionMs when given. */
  historySize?: number;
  filePath?: string | null;
  wsStats?: () => WsHubStats | null;
  /** Emit a console warning when a sample crosses one of these thresholds. */
  warn?: { rssMB?: number; eventLoopLagMs?: number; clients?: number };
}

const MB = 1024 * 1024;
const toMB = (bytes: number) => Math.round((bytes / MB) * 10) / 10;
// Histogram getters return NaN before any data is recorded; report that as 0.
const nsToMs = (ns: number) => (Number.isFinite(ns) ? Math.round((ns / 1e6) * 100) / 100 : 0);

function countOpenFds(): number | null {
  try {
    return fs.readdirSync("/proc/self/fd").length;
  } catch {
    return null; // not Linux, or /proc unavailable
  }
}

export function startMonitor(opts: MonitorOptions = {}): MonitorHandle {
  const intervalMs = opts.intervalMs ?? 15_000;
  const retentionMs = opts.retentionMs ?? 15 * 60_000; // 15 min
  // Keep only the last `retentionMs` worth of samples (min 1). At 15s/sample
  // the default is 60 samples — enough to see the leak's slope before a lockup.
  const historySize = opts.historySize ?? Math.max(1, Math.ceil(retentionMs / intervalMs));
  const filePath = opts.filePath ?? null;
  const wsStats = opts.wsStats ?? (() => null);
  const warn = opts.warn;

  const history: ResourceSample[] = [];
  const loopDelay: IntervalHistogram = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();
  let lastCpu = process.cpuUsage();

  function sampleNow(): ResourceSample {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage(lastCpu);
    lastCpu = process.cpuUsage();

    const lag: EventLoopLag = {
      meanMs: nsToMs(loopDelay.mean),
      maxMs: nsToMs(loopDelay.max),
      p99Ms: nsToMs(loopDelay.percentile(99)),
    };
    loopDelay.reset();

    const sample: ResourceSample = {
      t: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      rssMB: toMB(mem.rss),
      heapUsedMB: toMB(mem.heapUsed),
      heapTotalMB: toMB(mem.heapTotal),
      externalMB: toMB(mem.external),
      arrayBuffersMB: toMB(mem.arrayBuffers ?? 0),
      openFds: countOpenFds(),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      eventLoopLag: lag,
      ws: wsStats(),
    };

    history.push(sample);
    while (history.length > historySize) history.shift();

    if (filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(history));
      } catch {
        /* disk full / read-only — monitoring must never take the server down */
      }
    }

    if (warn) {
      const flags: string[] = [];
      if (warn.rssMB && sample.rssMB > warn.rssMB) flags.push(`rss=${sample.rssMB}MB`);
      if (warn.eventLoopLagMs && lag.p99Ms > warn.eventLoopLagMs) flags.push(`loopLagP99=${lag.p99Ms}ms`);
      if (warn.clients && sample.ws && sample.ws.clients > warn.clients) flags.push(`wsClients=${sample.ws.clients}`);
      if (flags.length) console.warn(`[monitor] elevated: ${flags.join(" ")}`);
    }

    return sample;
  }

  const timer = setInterval(sampleNow, intervalMs);
  timer.unref?.();
  sampleNow(); // seed history immediately so there's always data to read

  return {
    stop() {
      clearInterval(timer);
      loopDelay.disable();
    },
    history() {
      return history;
    },
    sampleNow,
    filePath,
  };
}
