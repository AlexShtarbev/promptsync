export type ViewMode = "list" | "grid";

interface Props {
  assetFilter: string;
  statusFilter: string;
  onAssetChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  shotCount: number;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  videoMode: boolean;
  onVideoModeChange: (v: boolean) => void;
  hasVideos: boolean;
  onValidate?: () => void;
  validating?: boolean;
}

const ASSET_TYPES = ["all", "still", "kling", "seedance", "kling-reuse", "googleflow"];
const STATUSES = ["all", "draft", "story-ready", "mj-done", "kling-ready", "kling-done", "seedance-ready", "seedance-done", "complete"];

export function FilterBar({ assetFilter, statusFilter, onAssetChange, onStatusChange, shotCount, viewMode, onViewModeChange, videoMode, onVideoModeChange, hasVideos, onValidate, validating }: Props) {
  return (
    <div className="filter-bar">
      <label>
        Type:
        <select value={assetFilter} onChange={(e) => onAssetChange(e.target.value)}>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Status:
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      {hasVideos && (
        <button
          className={`video-toggle-btn ${videoMode ? "active" : ""}`}
          onClick={() => onVideoModeChange(!videoMode)}
          title={videoMode ? "Show images" : "Show videos"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h5A1.5 1.5 0 0110 3.5v9A1.5 1.5 0 018.5 14h-5A1.5 1.5 0 012 12.5v-9zM11 5l3-1.5v9L11 11V5z" />
          </svg>
          Video
        </button>
      )}
      {onValidate && (
        <button
          className="video-toggle-btn"
          onClick={onValidate}
          disabled={validating}
          title="Validate @element mentions in all prompts"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1zm-1.3 9.3l-2-2 .7-.7L7 9l3.3-3.3.7.7-4 4-.3-.1z" />
          </svg>
          {validating ? "Validating..." : "Validate @"}
        </button>
      )}
      <span className="shot-count">{shotCount} shots</span>
      <div className="view-toggle">
        <button
          className={viewMode === "list" ? "active" : ""}
          onClick={() => onViewModeChange("list")}
          title="List view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="14" height="2" rx="0.5" />
            <rect x="1" y="7" width="14" height="2" rx="0.5" />
            <rect x="1" y="12" width="14" height="2" rx="0.5" />
          </svg>
        </button>
        <button
          className={viewMode === "grid" ? "active" : ""}
          onClick={() => onViewModeChange("grid")}
          title="Grid view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
