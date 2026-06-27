import type { MonitorLatest, ResourceSample } from "../api/client";

export interface MonitorPollerDeps {
  /** Fetch the latest monitor snapshot (normally api.getMonitor). */
  fetchLatest: () => Promise<MonitorLatest>;
  /** Called with each result; null signals "no data / fetch failed". */
  onSample: (sample: ResourceSample | null) => void;
  intervalMs: number;
  // Timers are injectable so the behaviour is unit-testable without real time.
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

/**
 * Polls the monitor endpoint immediately and then on an interval, pushing each
 * result through onSample. Returns a stop() that clears the interval AND blocks
 * any in-flight request from reporting after teardown (avoids setting state on
 * an unmounted component). All the logic the component's effect relies on lives
 * here so it can be tested without a DOM.
 */
export function startMonitorPolling(deps: MonitorPollerDeps): () => void {
  const setIv = deps.setIntervalFn ?? setInterval;
  const clearIv = deps.clearIntervalFn ?? clearInterval;
  let stopped = false;

  const tick = async () => {
    try {
      const res = await deps.fetchLatest();
      if (!stopped) deps.onSample(res.latest);
    } catch {
      if (!stopped) deps.onSample(null);
    }
  };

  tick();
  const timer = setIv(tick, deps.intervalMs);

  return () => {
    stopped = true;
    clearIv(timer);
  };
}
