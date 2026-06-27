import type { ResourceSample } from "../api/client";

// Thresholds at which a figure is shown as "elevated" (red). These mirror the
// server's warn config in server/index.ts — keep them in sync.
export const WARN = { rssMB: 1024, lagMs: 250, clients: 50 };

export interface StatView {
  key: string;
  label: string;
  value: string;
  warn: boolean;
  title: string;
}

/**
 * Pure mapping from a resource sample to the figures shown next to the logo.
 * Returns null when there's nothing to show yet (no sample collected), so the
 * component renders nothing rather than placeholders.
 */
export function computeStats(sample: ResourceSample | null): StatView[] | null {
  if (!sample) return null;

  const lag = sample.eventLoopLag.p99Ms;
  const clients = sample.ws?.clients ?? 0;

  return [
    {
      key: "ram",
      label: "RAM",
      value: `${Math.round(sample.rssMB)}MB`,
      warn: sample.rssMB > WARN.rssMB,
      title: `Resident memory. Heap ${Math.round(sample.heapUsedMB)}/${Math.round(sample.heapTotalMB)}MB`,
    },
    {
      key: "ws",
      label: "WS",
      value: `${clients}`,
      warn: clients > WARN.clients,
      title: sample.ws
        ? `WebSocket clients. Reaped ${sample.ws.terminatedDead}, dropped ${sample.ws.droppedBackpressure}`
        : "WebSocket clients",
    },
    {
      key: "lag",
      label: "lag",
      value: `${lag.toFixed(0)}ms`,
      warn: lag > WARN.lagMs,
      title: "Event-loop lag (p99) since last sample",
    },
  ];
}
