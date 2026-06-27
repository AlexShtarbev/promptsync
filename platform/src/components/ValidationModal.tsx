import { useState, useCallback } from "react";
import { api } from "../api/client";
import type { ValidationReport, FixReport } from "../api/client";

interface Props {
  report: ValidationReport;
  slug: string;
  onClose: () => void;
  onFixed: () => void;
}

type Filter = "all" | "errors" | "warnings";

const ACTION_LABELS: Record<string, string> = {
  added: "Added to elements",
  removed: "Removed from elements",
  replaced: "Replaced in elements",
};

export function ValidationModal({ report, slug, onClose, onFixed }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [fixing, setFixing] = useState(false);
  const [fixReport, setFixReport] = useState<FixReport | null>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleFix = useCallback(async () => {
    if (fixing) return;
    setFixing(true);
    try {
      const result = await api.fixElements(slug);
      setFixReport(result);
      onFixed();
    } catch (err) {
      console.error("Fix failed:", err);
    } finally {
      setFixing(false);
    }
  }, [slug, fixing, onFixed]);

  const filtered = report.results
    .map((r) => ({
      ...r,
      errors: filter === "warnings" ? [] : r.errors,
      warnings: filter === "errors" ? [] : r.warnings,
    }))
    .filter((r) => r.errors.length > 0 || r.warnings.length > 0);

  const hasIssues = report.totalErrors > 0 || report.totalWarnings > 0;
  const canFix = hasIssues && !fixReport;

  if (fixReport) {
    return (
      <div className="lightbox-overlay" onClick={handleOverlayClick}>
        <div className="validation-modal" onClick={(e) => e.stopPropagation()}>
          <div className="validation-header">
            <h3>Fix Results</h3>
            <button className="validation-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="validation-summary">
            <span className="validation-stat validation-stat-ok">
              {fixReport.fixes.length} fix{fixReport.fixes.length !== 1 ? "es" : ""} applied
            </span>
            {fixReport.unfixable.length > 0 && (
              <span className="validation-stat validation-stat-error">
                {fixReport.unfixable.length} unfixable
              </span>
            )}
          </div>

          <div className="validation-results">
            {fixReport.fixes.length === 0 && fixReport.unfixable.length === 0 && (
              <div className="validation-success">Nothing to fix.</div>
            )}

            {fixReport.fixes.length > 0 && (
              <div className="validation-fix-section">
                {fixReport.fixes.map((fix, i) => (
                  <div key={i} className="validation-issue fix">
                    <span className="validation-severity-icon">&#x2714;</span>
                    <span className="validation-badge">{fix.shotCode}</span>
                    <span className="validation-message">
                      {ACTION_LABELS[fix.action]}: <code>@{fix.element}</code>
                      {fix.replacement && (
                        <> → <code>@{fix.replacement}</code></>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {fixReport.unfixable.length > 0 && (
              <div className="validation-fix-section">
                <div className="validation-shot-header">Unfixable</div>
                {fixReport.unfixable.map((issue, i) => (
                  <div key={i} className="validation-issue error">
                    <span className="validation-severity-icon">&#x2716;</span>
                    <span className="validation-badge">{issue.shotCode}</span>
                    <span className="validation-message">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lightbox-overlay" onClick={handleOverlayClick}>
      <div className="validation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="validation-header">
          <h3>@ Element Validation</h3>
          <div className="validation-header-actions">
            {canFix && (
              <button
                className="validation-fix-btn"
                onClick={handleFix}
                disabled={fixing}
              >
                {fixing ? "Fixing..." : "Fix All"}
              </button>
            )}
            <button className="validation-close" onClick={onClose}>
              &times;
            </button>
          </div>
        </div>

        <div className="validation-summary">
          <span className="validation-stat">
            {report.shotsChecked} / {report.totalShots} shots checked
          </span>
          {report.totalErrors > 0 && (
            <span className="validation-stat validation-stat-error">
              {report.totalErrors} error{report.totalErrors !== 1 ? "s" : ""}
            </span>
          )}
          {report.totalWarnings > 0 && (
            <span className="validation-stat validation-stat-warning">
              {report.totalWarnings} warning{report.totalWarnings !== 1 ? "s" : ""}
            </span>
          )}
          {!hasIssues && (
            <span className="validation-stat validation-stat-ok">All clear</span>
          )}
        </div>

        {hasIssues && (
          <div className="validation-filters">
            {(["all", "errors", "warnings"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`validation-filter-btn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "errors" ? "Errors" : "Warnings"}
              </button>
            ))}
          </div>
        )}

        <div className="validation-results">
          {!hasIssues && (
            <div className="validation-success">
              All @mentions resolve to known elements.
            </div>
          )}

          {filtered.map((r) => (
            <div key={r.shotCode} className="validation-shot-group">
              <div className="validation-shot-header">{r.shotCode}</div>
              {r.errors.map((issue, i) => (
                <div key={`e-${i}`} className="validation-issue error">
                  <span className="validation-severity-icon">&#x2716;</span>
                  <span className="validation-badge">{issue.promptType}</span>
                  <span className="validation-message">{issue.message}</span>
                </div>
              ))}
              {r.warnings.map((issue, i) => (
                <div key={`w-${i}`} className="validation-issue warning">
                  <span className="validation-severity-icon">&#x26A0;</span>
                  <span className="validation-badge">{issue.promptType}</span>
                  <span className="validation-message">{issue.message}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {report.knownElements.length > 0 && (
          <details className="validation-known-elements">
            <summary>Known elements ({report.knownElements.length})</summary>
            <div className="validation-element-list">
              {report.knownElements.map((e) => (
                <code key={e}>@{e}</code>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
