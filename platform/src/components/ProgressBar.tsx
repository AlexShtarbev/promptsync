import type { Shot } from "../api/client";

interface Props {
  shots: Shot[];
}

export function ProgressBar({ shots }: Props) {
  if (!shots.length) return null;

  const total = shots.length;
  const withImage = shots.filter((s) => s.imagePath).length;
  const mjDone = shots.filter((s) => ["mj-done", "kling-ready", "kling-done", "seedance-ready", "seedance-done", "complete"].includes(s.meta.status)).length;
  const klingDone = shots.filter((s) => ["kling-done", "complete"].includes(s.meta.status)).length;
  const seedanceDone = shots.filter((s) => ["seedance-done", "complete"].includes(s.meta.status)).length;
  const videoDone = klingDone + seedanceDone;
  const complete = shots.filter((s) => s.meta.status === "complete").length;

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="progress-bar">
      <div className="progress-stats">
        <span className="progress-stat">
          <span className="progress-dot" style={{ background: "#22c55e" }} />
          Images: {withImage}/{total}
        </span>
        <span className="progress-stat">
          <span className="progress-dot" style={{ background: "#3b82f6" }} />
          Stills done: {mjDone}/{total}
        </span>
        <span className="progress-stat">
          <span className="progress-dot" style={{ background: "#8b5cf6" }} />
          Video done: {videoDone}/{total}
        </span>
        <span className="progress-stat">
          <span className="progress-dot" style={{ background: "#f59e0b" }} />
          Complete: {complete}/{total}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct(withImage)}%`, background: "#22c55e" }} />
      </div>
    </div>
  );
}
