import { useState, useCallback, useEffect, useRef } from "react";
import type { Shot } from "../api/client";
import { DropZone } from "./DropZone";
import { PromptSectionView } from "./PromptSectionView";

interface Props {
  shot: Shot;
  slug: string;
  compact?: boolean;
  onImageUploaded?: () => void;
  videoMode?: boolean;
}

function copyToClipboard(text: string, label: string): void {
  navigator.clipboard.writeText(text).then(
    () => console.log(`Copied ${label}`),
    (err) => console.error(`Failed to copy ${label}:`, err)
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  "story-ready": "#f59e0b",
  "mj-done": "#10b981",
  "kling-ready": "#8b5cf6",
  "kling-done": "#3b82f6",
  "seedance-ready": "#ec4899",
  "seedance-done": "#d946ef",
  complete: "#22c55e",
};

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

export function ShotCard({ shot, slug, compact = false, onImageUploaded, videoMode = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [videoLightbox, setVideoLightbox] = useState(false);
  const hoverVideoRef = useRef<HTMLVideoElement>(null);

  const showVideo = videoMode && !!shot.videoPath;

  const openLightbox = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLightbox(true);
  }, []);

  useEffect(() => {
    if (!lightbox && !videoLightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setLightbox(false); setVideoLightbox(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox, videoLightbox]);

  const handleVideoHover = useCallback(() => {
    hoverVideoRef.current?.play().catch(() => {});
  }, []);

  const handleVideoLeave = useCallback(() => {
    const v = hoverVideoRef.current;
    if (v) { v.pause(); v.currentTime = 0; }
  }, []);

  const openVideoLightbox = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoLightbox(true);
  }, []);

  const handleCopyMj = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (shot.mjPrompt) copyToClipboard(shot.mjPrompt.body, `MJ prompt for ${shot.code}`);
    },
    [shot]
  );

  const handleCopyKling = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (shot.klingPrompt) copyToClipboard(shot.klingPrompt.body, `Kling prompt for ${shot.code}`);
    },
    [shot]
  );

  const handleCopySeedance = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (shot.seedancePrompt) copyToClipboard(shot.seedancePrompt.body, `Seedance prompt for ${shot.code}`);
    },
    [shot]
  );

  const handleCopyNb = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (shot.nanoBanana) copyToClipboard(shot.nanoBanana.body, `NanoBanana prompt for ${shot.code}`);
    },
    [shot]
  );

  const handleDeleteImage = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete image for shot ${shot.code}?`)) return;
    try {
      const resp = await fetch(`/api/assets/${slug}/shots/${shot.code}/image`, { method: "DELETE" });
      const result = await resp.json();
      if (result.ok && onImageUploaded) onImageUploaded();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }, [slug, shot.code, onImageUploaded]);

  const ar = shot.mjPrompt?.meta?.ar as string | undefined;
  const aspectRatio = ar === "9:16" ? "9 / 16" : ar === "1:1" ? "1 / 1" : ar === "4:3" ? "4 / 3" : "9 / 16";

  const promptsPanel = (
    <div className="lightbox-prompts">
      <div className="lightbox-meta">
        <span className="shot-code">{shot.code}</span>
        <span className="shot-status" style={{ backgroundColor: STATUS_COLORS[shot.meta.status] ?? "#6b7280" }}>{shot.meta.status}</span>
        <span className="shot-type">{shot.meta.shot_type}</span>
        <span className="shot-duration">{shot.meta.duration}</span>
      </div>
      {shot.meta.setting && <div className="lightbox-setting">{shot.meta.setting}</div>}
      {shot.content.subject_action && <div className="lightbox-action">{shot.content.subject_action}</div>}
      {shot.content.vo_lines && shot.content.vo_lines !== "(silence)" && (
        <div className="lightbox-vo">VO: {shot.content.vo_lines}</div>
      )}
      <div className="shot-prompts">
        {shot.mjPrompt && (
          <PromptSectionView
            prompt={shot.mjPrompt}
            label={`${shot.mjPrompt.meta.platform === "googleflow" ? "Google Flow" : shot.mjPrompt.meta.platform === "nanobanana" ? "NanoBanana" : "MJ"} Prompt`}
            onCopyFull={handleCopyMj}
          />
        )}
        {shot.klingPrompt && (
          <PromptSectionView
            prompt={shot.klingPrompt}
            label="Kling Prompt"
            onCopyFull={handleCopyKling}
          />
        )}
        {shot.seedancePrompt && (
          <PromptSectionView
            prompt={shot.seedancePrompt}
            label="Seedance Prompt"
            onCopyFull={handleCopySeedance}
          />
        )}
        {shot.nanoBanana && (
          <PromptSectionView
            prompt={shot.nanoBanana}
            label="NanoBanana Prompt"
            onCopyFull={handleCopyNb}
          />
        )}
        {!shot.mjPrompt && !shot.klingPrompt && !shot.seedancePrompt && !shot.nanoBanana && (
          <div className="lightbox-no-prompts">No prompts available</div>
        )}
      </div>
    </div>
  );

  const gridLightbox = lightbox && compact ? (
    <div className="lightbox-overlay" onClick={() => setLightbox(false)}>
      <div className="lightbox-split" onClick={(e) => e.stopPropagation()}>
        {promptsPanel}
        <div className="lightbox-image-side">
          {shot.imagePath ? (
            <div className="lightbox-image-wrapper">
              <img src={shot.imagePath} alt={shot.code} />
              <button className="delete-image-btn" onClick={handleDeleteImage} title="Delete image">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className="lightbox-placeholder">
              <span className="shot-thumb-label">{shot.code}</span>
              <span className="shot-thumb-ar">{ar ?? "9:16"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const videoLightboxEl = videoLightbox && shot.videoPath ? (
    <div className="lightbox-overlay" onClick={() => setVideoLightbox(false)}>
      <div className="lightbox-video-content" onClick={(e) => e.stopPropagation()}>
        <video
          src={shot.videoPath}
          controls
          autoPlay
          className="lightbox-video"
        />
        <div className="lightbox-label">{shot.code}</div>
      </div>
    </div>
  ) : null;

  const imageLightbox = lightbox && !compact && shot.imagePath ? (
    <div className="lightbox-overlay" onClick={() => setLightbox(false)}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-image-wrapper">
          <img src={shot.imagePath} alt={shot.code} />
          <button className="delete-image-btn" onClick={handleDeleteImage} title="Delete image">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/>
            </svg>
          </button>
        </div>
        <div className="lightbox-label">{shot.code}</div>
      </div>
    </div>
  ) : null;

  if (compact) {
    return (
      <DropZone slug={slug} code={shot.code} onUploaded={onImageUploaded}>
        <div className="shot-card compact" onClick={showVideo ? openVideoLightbox : openLightbox} style={{ cursor: "pointer" }}>
          <div
            className="shot-thumb"
            onMouseEnter={showVideo ? handleVideoHover : undefined}
            onMouseLeave={showVideo ? handleVideoLeave : undefined}
          >
            {showVideo ? (
              <video
                ref={hoverVideoRef}
                src={shot.videoPath!}
                className="shot-thumb-video"
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : videoMode && !shot.imagePath ? (
              <div className="shot-thumb-video-placeholder">
                <span className="shot-thumb-label">{shot.code}</span>
                <span className="shot-thumb-no-video">no clip</span>
              </div>
            ) : shot.imagePath ? (
              <>
                <img src={shot.imagePath} alt={shot.code} className="shot-thumb-img" />
                <button className="delete-image-btn thumb-delete" onClick={handleDeleteImage} title="Delete image">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                </button>
              </>
            ) : (
              <>
                <span className="shot-thumb-label">{shot.code}</span>
                <span className="shot-thumb-ar">{ar ?? "9:16"}</span>
              </>
            )}
          </div>
          <div className="shot-card-compact-header">
            <span className="shot-code">{shot.code}</span>
            <span
              className="shot-status"
              style={{ backgroundColor: STATUS_COLORS[shot.meta.status] ?? "#6b7280" }}
            >
              {shot.meta.status}
            </span>
          </div>
          <div className="shot-card-compact-meta">
            <span className="shot-type">{shot.meta.shot_type}</span>
            <span className="shot-duration">{shot.meta.duration}</span>
            <span className="shot-asset" data-type={shot.meta.asset_type}>
              {shot.meta.asset_type}
            </span>
          </div>
          <div className="shot-card-compact-action">{shot.content.subject_action}</div>
          {shot.content.vo_lines && shot.content.vo_lines !== "(silence)" && (
            <div className="shot-vo">VO: {shot.content.vo_lines}</div>
          )}
        </div>
        {gridLightbox}
        {videoLightboxEl}
      </DropZone>
    );
  }

  return (
    <DropZone slug={slug} code={shot.code} onUploaded={onImageUploaded}>
      <div className="shot-card list-card" onClick={() => setExpanded(!expanded)}>
        <div
          className="shot-thumb-inline"
          style={{ aspectRatio }}
          onMouseEnter={showVideo ? handleVideoHover : undefined}
          onMouseLeave={showVideo ? handleVideoLeave : undefined}
        >
          {showVideo ? (
            <video
              ref={hoverVideoRef}
              src={shot.videoPath!}
              className="shot-thumb-video"
              muted
              loop
              playsInline
              preload="metadata"
              onClick={openVideoLightbox}
              style={{ cursor: "pointer" }}
            />
          ) : videoMode && !shot.imagePath ? (
            <div className="shot-thumb-video-placeholder">
              <span className="shot-thumb-label">{shot.code}</span>
              <span className="shot-thumb-no-video">no clip</span>
            </div>
          ) : shot.imagePath ? (
            <>
              <img src={shot.imagePath} alt={shot.code} className="shot-thumb-img" onClick={openLightbox} style={{ cursor: "pointer" }} />
              <button className="delete-image-btn thumb-delete" onClick={handleDeleteImage} title="Delete image">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </button>
            </>
          ) : (
            <span className="shot-thumb-label">{shot.code}</span>
          )}
        </div>
        <div className="shot-card-content">
        <div className="shot-card-header">
          <span className="shot-code">{shot.code}</span>
          <span className="shot-type">{shot.meta.shot_type}</span>
          <span className="shot-duration">{shot.meta.duration}</span>
          <span className="shot-asset" data-type={shot.meta.asset_type}>
            {shot.meta.asset_type}
          </span>
          <span
            className="shot-status"
            style={{ backgroundColor: STATUS_COLORS[shot.meta.status] ?? "#6b7280" }}
          >
            {shot.meta.status}
          </span>
          <span
            className="shot-risk"
            style={{ color: RISK_COLORS[shot.meta.risk] ?? "#6b7280" }}
          >
            {shot.meta.risk}
          </span>
        </div>

        <div className="shot-card-body">
          <div className="shot-setting">{shot.meta.setting}</div>
          <div className="shot-action">{shot.content.subject_action}</div>
          {shot.content.vo_lines && shot.content.vo_lines !== "(silence)" && (
            <div className="shot-vo">VO: {shot.content.vo_lines}</div>
          )}
        </div>

        {expanded && (
          <div className="shot-card-expanded">
            <div className="shot-details">
              <div><strong>Camera:</strong> {shot.meta.camera}</div>
              <div><strong>Color/Mood:</strong> {shot.meta.color_mood}</div>
              {shot.meta.elements.length > 0 && (
                <div><strong>Elements:</strong> {shot.meta.elements.join(", ")}</div>
              )}
              {shot.content.sfx_audio && (
                <div><strong>SFX:</strong> {shot.content.sfx_audio}</div>
              )}
              {shot.content.notes && (
                <div><strong>Notes:</strong> {shot.content.notes}</div>
              )}
            </div>

            <div className="shot-prompts">
              {shot.mjPrompt && (
                <PromptSectionView
                  prompt={shot.mjPrompt}
                  label={`${shot.mjPrompt.meta.platform === "googleflow" ? "Google Flow" : shot.mjPrompt.meta.platform === "nanobanana" ? "NanoBanana" : "MJ"} Prompt`}
                  onCopyFull={handleCopyMj}
                />
              )}
              {shot.klingPrompt && (
                <PromptSectionView
                  prompt={shot.klingPrompt}
                  label="Kling Prompt"
                  onCopyFull={handleCopyKling}
                />
              )}
              {shot.seedancePrompt && (
                <PromptSectionView
                  prompt={shot.seedancePrompt}
                  label="Seedance Prompt"
                  onCopyFull={handleCopySeedance}
                />
              )}
              {shot.nanoBanana && (
                <PromptSectionView
                  prompt={shot.nanoBanana}
                  label="NanoBanana Prompt"
                  onCopyFull={handleCopyNb}
                />
              )}
            </div>
          </div>
        )}
        </div>
      </div>
      {imageLightbox}
      {videoLightboxEl}
    </DropZone>
  );
}
