import { useState, useCallback } from "react";
import type { ContinuityReport } from "../api/client";

interface Props {
  report: ContinuityReport;
  onClose: () => void;
}

type Filter = "all" | "errors" | "warnings";

// What each lint enforces — shown so a failure is self-explanatory.
const RULE_LABEL: Record<string, string> = {
  L01: "State continuity",
  L02: "Manifest → prompt",
  L03: "Build asserted",
  L04: "Action target present",
  L05: "Board ↔ shot.md",
  L06: "Held-object continuity",
  L07: "Concealment positive",
  L09: "On-screen text",
  L11: "Action density",
};

export function ContinuityModal({ report, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const onOverlay = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const issues = report.issues.filter((i) =>
    filter === "all" ? true : filter === "errors" ? i.severity === "error" : i.severity === "warning",
  );

  return (
    <div className="modal-overlay" onClick={onOverlay}>
      <div className="modal-dialog structure-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>
          Continuity engine — {report.project}{" "}
          <span className={report.totalErrors ? "ws-status disconnected" : "ws-status connected"}>
            {report.totalErrors === 0 && report.totalWarnings === 0
              ? "✓ clean"
              : `${report.totalErrors} error(s), ${report.totalWarnings} warning(s)`}
          </span>
        </h3>

        <div className="tab-bar">
          {(["all", "errors", "warnings"] as Filter[]).map((f) => (
            <button key={f} className={`tab-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? `All (${report.issues.length})` : f === "errors" ? `Errors (${report.totalErrors})` : `Warnings (${report.totalWarnings})`}
            </button>
          ))}
        </div>

        {issues.length === 0 ? (
          <p className="empty-state">
            {report.issues.length === 0
              ? `No continuity issues across scenes [${report.scenes.join(", ")}].`
              : "Nothing matches this filter."}
          </p>
        ) : (
          <ul className="issue-list">
            {issues.map((i, n) => (
              <li key={n} className={`issue-row ${i.severity}`}>
                <span className={`issue-badge ${i.severity}`}>{i.severity === "error" ? "✗" : "!"}</span>
                <code className="issue-code" title={RULE_LABEL[i.rule] ?? i.rule}>
                  {i.rule}
                </code>
                <code className="issue-shot">{i.shotCodeB ? `${i.shotCode}→${i.shotCodeB}` : i.shotCode}</code>
                <span className="issue-msg">{i.message}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <span className="muted">Re-runs automatically on every save.</span>
          <button className="toolbar-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
