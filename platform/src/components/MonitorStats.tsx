import { useEffect, useState } from "react";
import { api, type ResourceSample } from "../api/client";
import { computeStats } from "./monitorStats.logic";
import { startMonitorPolling } from "./monitorStats.poller";

// Compact live resource readout shown next to the logo. Polls the server's
// self-monitoring endpoint so you can spot a climb (RSS / WS clients / loop lag)
// without opening devtools. Display logic (thresholds, formatting) lives in
// monitorStats.logic.ts and the polling/cleanup in monitorStats.poller.ts — both
// unit-tested.
const POLL_MS = 5000;

export function MonitorStats() {
  const [sample, setSample] = useState<ResourceSample | null>(null);

  useEffect(
    () =>
      startMonitorPolling({
        fetchLatest: api.getMonitor,
        onSample: setSample,
        intervalMs: POLL_MS,
      }),
    []
  );

  const stats = computeStats(sample);
  if (!stats) return null;

  return (
    <div className="monitor-stats">
      {stats.map((s) => (
        <span key={s.key} className={`stat ${s.warn ? "warn" : ""}`} title={s.title}>
          <span className="stat-label">{s.label}</span>
          <span className="stat-value">{s.value}</span>
        </span>
      ))}
    </div>
  );
}
