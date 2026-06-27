import { useState, useMemo, useCallback, useEffect } from "react";
import { api } from "../api/client";
import type { Shot, ValidationReport } from "../api/client";
import { ShotCard } from "./ShotCard";
import { FilterBar, type ViewMode } from "./FilterBar";
import { ValidationModal } from "./ValidationModal";

interface Props {
  shots: Shot[];
  slug: string;
  onReload?: () => void;
}

export function ShotList({ shots, slug, onReload }: Props) {
  const [assetFilter, setAssetFilter] = useState(() => localStorage.getItem("promptsync-asset-filter") ?? "all");
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem("promptsync-status-filter") ?? "all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("promptsync-view-mode") as ViewMode) ?? "grid");
  const [videoMode, setVideoMode] = useState(() => localStorage.getItem("promptsync-video-mode") === "true");

  const handleAssetFilter = useCallback((v: string) => { setAssetFilter(v); localStorage.setItem("promptsync-asset-filter", v); }, []);
  const handleStatusFilter = useCallback((v: string) => { setStatusFilter(v); localStorage.setItem("promptsync-status-filter", v); }, []);
  const handleViewMode = useCallback((v: ViewMode) => { setViewMode(v); localStorage.setItem("promptsync-view-mode", v); }, []);
  const handleVideoMode = useCallback((v: boolean) => { setVideoMode(v); localStorage.setItem("promptsync-video-mode", String(v)); }, []);

  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);

  const handleValidate = useCallback(async () => {
    if (!slug || validating) return;
    setValidating(true);
    try {
      const report = await api.validateElements(slug);
      setValidationReport(report);
    } catch (err) {
      console.error("Validation failed:", err);
    } finally {
      setValidating(false);
    }
  }, [slug, validating]);

  const hasVideos = useMemo(() => shots.some((s) => s.videoPath), [shots]);

  useEffect(() => {
    if (videoMode && !hasVideos) {
      setVideoMode(false);
      localStorage.setItem("promptsync-video-mode", "false");
    }
  }, [hasVideos, videoMode]);

  const filtered = useMemo(() => {
    return shots.filter((s) => {
      if (assetFilter !== "all" && s.meta.asset_type !== assetFilter) return false;
      if (statusFilter !== "all" && s.meta.status !== statusFilter) return false;
      return true;
    });
  }, [shots, assetFilter, statusFilter]);

  return (
    <div className="shot-list">
      <FilterBar
        assetFilter={assetFilter}
        statusFilter={statusFilter}
        onAssetChange={handleAssetFilter}
        onStatusChange={handleStatusFilter}
        shotCount={filtered.length}
        viewMode={viewMode}
        onViewModeChange={handleViewMode}
        videoMode={videoMode}
        onVideoModeChange={handleVideoMode}
        hasVideos={hasVideos}
        onValidate={handleValidate}
        validating={validating}
      />
      <div className={viewMode === "grid" ? "shot-cards grid" : "shot-cards"}>
        {filtered.map((s) => (
          <ShotCard key={s.code} shot={s} slug={slug} compact={viewMode === "grid"} onImageUploaded={onReload} videoMode={videoMode} />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">No shots match the current filters.</div>
        )}
      </div>
      {validationReport && (
        <ValidationModal
          report={validationReport}
          slug={slug}
          onClose={() => setValidationReport(null)}
          onFixed={() => onReload?.()}
        />
      )}
    </div>
  );
}
