import { Router } from "express";
import type { MonitorHandle } from "../services/monitor.js";

// Exposes the self-monitoring ring buffer so you can inspect resource trends
// (RSS, heap, open FDs, event-loop lag, WebSocket client count) live. The same
// data is also persisted to disk by the monitor for post-mortem inspection.
export function monitorRoutes(monitor: MonitorHandle): Router {
  const router = Router();

  // Latest collected snapshot plus a small summary of where things stand.
  // Reads the most recent ring entry rather than sampling on demand, so hitting
  // this endpoint doesn't perturb the event-loop-lag measurement.
  router.get("/", (_req, res) => {
    const history = monitor.history();
    res.json({
      latest: history[history.length - 1] ?? null,
      samples: history.length,
      file: monitor.filePath,
    });
  });

  // Full ring buffer (oldest → newest) for charting / trend inspection.
  router.get("/history", (_req, res) => {
    res.json(monitor.history());
  });

  return router;
}
