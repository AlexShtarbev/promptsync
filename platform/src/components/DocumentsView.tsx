import { useState, useEffect, useCallback, useMemo } from "react";
import { MarkdownDoc } from "./MarkdownDoc";
import { DocTree } from "./DocTree";
import type { Shot, Character } from "../api/client";
import { PromptSectionView } from "./PromptSectionView";

export interface Document {
  name: string;
  slug: string;
  content: string;
}

interface Props {
  documents: Document[];
  shots: Shot[];
  characters: Character[];
  sceneMap: Record<string, string>;
  slug: string;
}

type PanelTab = "shot" | "video" | "elements";

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

const CHAR_STATUS_COLORS: Record<string, string> = {
  "needs-reference": "#ef4444",
  "has-reference": "#22c55e",
  "reference-done": "#22c55e",
  "element-ready": "#8b5cf6",
  "not-created": "#f59e0b",
};

function copyToClipboard(text: string, label: string): void {
  navigator.clipboard.writeText(text).then(
    () => console.log(`Copied ${label}`),
    (err) => console.error(`Failed to copy ${label}:`, err)
  );
}

export function DocumentsView({ documents, shots, characters, sceneMap, slug }: Props) {
  const [activeDoc, setActiveDoc] = useState<string>(
    () => localStorage.getItem("promptsync-doc-tab") ?? documents[0]?.slug ?? ""
  );
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("shot");

  useEffect(() => {
    if (documents.length && !documents.find((d) => d.slug === activeDoc)) {
      setActiveDoc(documents[0].slug);
    }
  }, [documents, activeDoc]);

  const handleSelectDoc = useCallback((docSlug: string) => {
    setActiveDoc(docSlug);
    setSelectedScene(null);
    localStorage.setItem("promptsync-doc-tab", docSlug);
  }, []);

  const handleSceneClick = useCallback((scene: number) => {
    if (isNaN(scene)) return;
    setSelectedScene((prev) => (prev === scene ? null : scene));
    setPanelTab("shot");
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedScene !== null) {
        setSelectedScene(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedScene]);

  const doc = documents.find((d) => d.slug === activeDoc);

  const selectedShot = useMemo(() => {
    if (selectedScene === null) return null;
    const code = sceneMap[String(selectedScene)];
    if (code) return shots.find((s) => s.code === code) ?? null;
    return shots[selectedScene - 1] ?? null;
  }, [selectedScene, sceneMap, shots]);

  const sceneElements = useMemo(() => {
    if (!selectedShot) return [];
    const elementNames = selectedShot.meta.elements;
    if (!elementNames.length) return [];
    return characters.filter((c) => {
      const eName = (c.meta as Record<string, unknown>).element_name as string || c.name;
      return elementNames.includes(eName);
    });
  }, [selectedShot, characters]);

  if (!documents.length) {
    return <div className="empty-state">No documents found.</div>;
  }

  const panelOpen = selectedScene !== null;
  const sceneMissing = selectedScene !== null && selectedShot === null;

  return (
    <div className="doc-browser">
      <DocTree
        docs={documents.map((d) => ({ name: d.name, slug: d.slug, group: "documents" }))}
        activeSlug={activeDoc}
        onSelect={handleSelectDoc}
      />
      <div className={`doc-detail ${panelOpen ? "panel-open" : ""}`}>
        {doc && <MarkdownDoc key={doc.slug} name={doc.name} content={doc.content} onSceneClick={handleSceneClick} />}
        {panelOpen && (
          <aside className="scene-panel">
            <div className="scene-panel-header">
              <span className="scene-panel-title">Scene {selectedScene}{selectedShot ? ` — ${selectedShot.code}` : ""}</span>
              <button className="scene-panel-close" onClick={() => setSelectedScene(null)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>
            {sceneMissing ? (
              <div className="scene-panel-body">
                <div className="scene-warning">
                  Scene {selectedScene} has no storyboard data yet.
                </div>
              </div>
            ) : selectedShot && (
              <>
                <div className="scene-panel-tabs">
                  <button className={`scene-tab-btn ${panelTab === "shot" ? "active" : ""}`} onClick={() => setPanelTab("shot")}>Shot</button>
                  <button className={`scene-tab-btn ${panelTab === "video" ? "active" : ""}`} onClick={() => setPanelTab("video")}>Video</button>
                  <button className={`scene-tab-btn ${panelTab === "elements" ? "active" : ""}`} onClick={() => setPanelTab("elements")}>Elements ({sceneElements.length})</button>
                </div>
                <div className="scene-panel-body">
                  {panelTab === "shot" && <ShotPanel shot={selectedShot} slug={slug} />}
                  {panelTab === "video" && <VideoPanel shot={selectedShot} />}
                  {panelTab === "elements" && <ElementsPanel elements={sceneElements} />}
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ShotPanel({ shot, slug }: { shot: Shot; slug: string }) {
  const ar = shot.mjPrompt?.meta?.ar as string | undefined;
  const aspectRatio = ar === "9:16" ? "9 / 16" : ar === "1:1" ? "1 / 1" : ar === "4:3" ? "4 / 3" : "9 / 16";

  return (
    <div className="scene-panel-shot">
      <div className="lightbox-meta">
        <span className="shot-code">{shot.code}</span>
        <span className="shot-status" style={{ backgroundColor: STATUS_COLORS[shot.meta.status] ?? "#6b7280" }}>{shot.meta.status}</span>
        <span className="shot-type">{shot.meta.shot_type}</span>
        <span className="shot-duration">{shot.meta.duration}</span>
        <span className="shot-asset" data-type={shot.meta.asset_type}>{shot.meta.asset_type}</span>
        <span className="shot-risk" style={{ color: RISK_COLORS[shot.meta.risk] ?? "#6b7280" }}>{shot.meta.risk}</span>
      </div>
      {shot.meta.setting && <div className="lightbox-setting">{shot.meta.setting}</div>}
      {shot.content.subject_action && <div className="lightbox-action">{shot.content.subject_action}</div>}
      {shot.content.vo_lines && shot.content.vo_lines !== "(silence)" && (
        <div className="lightbox-vo">VO: {shot.content.vo_lines}</div>
      )}

      <div className="shot-details" style={{ marginTop: 12 }}>
        <div><strong>Camera:</strong> {shot.meta.camera}</div>
        <div><strong>Color/Mood:</strong> {shot.meta.color_mood}</div>
        {shot.meta.elements.length > 0 && (
          <div><strong>Elements:</strong> {shot.meta.elements.join(", ")}</div>
        )}
        {shot.content.sfx_audio && <div><strong>SFX:</strong> {shot.content.sfx_audio}</div>}
        {shot.content.notes && <div><strong>Notes:</strong> {shot.content.notes}</div>}
      </div>

      {shot.imagePath && (
        <div className="scene-panel-image">
          <img src={shot.imagePath} alt={shot.code} style={{ aspectRatio }} />
        </div>
      )}

      <div className="shot-prompts" style={{ marginTop: 12 }}>
        {shot.mjPrompt && (
          <PromptSectionView
            prompt={shot.mjPrompt}
            label={`${shot.mjPrompt.meta.platform === "googleflow" ? "Google Flow" : shot.mjPrompt.meta.platform === "nanobanana" ? "NanoBanana" : "MJ"} Prompt`}
            onCopyFull={() => copyToClipboard(shot.mjPrompt!.body, `MJ prompt for ${shot.code}`)}
          />
        )}
        {shot.klingPrompt && (
          <PromptSectionView
            prompt={shot.klingPrompt}
            label="Kling Prompt"
            onCopyFull={() => copyToClipboard(shot.klingPrompt!.body, `Kling prompt for ${shot.code}`)}
          />
        )}
        {shot.seedancePrompt && (
          <PromptSectionView
            prompt={shot.seedancePrompt}
            label="Seedance Prompt"
            onCopyFull={() => copyToClipboard(shot.seedancePrompt!.body, `Seedance prompt for ${shot.code}`)}
          />
        )}
        {shot.nanoBanana && (
          <PromptSectionView
            prompt={shot.nanoBanana}
            label="NanoBanana Prompt"
            onCopyFull={() => copyToClipboard(shot.nanoBanana!.body, `NanoBanana prompt for ${shot.code}`)}
          />
        )}
        {!shot.mjPrompt && !shot.klingPrompt && !shot.seedancePrompt && !shot.nanoBanana && (
          <div className="lightbox-no-prompts">No prompts available</div>
        )}
      </div>
    </div>
  );
}

function VideoPanel({ shot }: { shot: Shot }) {
  if (!shot.videoPath) {
    return (
      <div className="scene-panel-empty">
        <span className="shot-thumb-label">{shot.code}</span>
        <span>No video available</span>
      </div>
    );
  }
  return (
    <div className="scene-panel-video">
      <video src={shot.videoPath} controls playsInline preload="metadata" />
    </div>
  );
}

function ElementsPanel({ elements }: { elements: Character[] }) {
  if (!elements.length) {
    return <div className="scene-panel-empty"><span>No elements linked to this scene</span></div>;
  }
  return (
    <div className="scene-panel-elements">
      {elements.map((c) => {
        const meta = c.meta as Record<string, unknown>;
        const elementStatus = (meta.element_status as string) ?? "needs-reference";
        const elementType = (meta.element_type as string) ?? "character";
        const isEnv = elementType === "environment";
        const viewAr = isEnv ? "16 / 9" : "3 / 4";
        const primaryView = c.views[0] ?? null;

        return (
          <div key={c.slug} className="scene-element-card">
            <div className="character-header">
              <span className="character-name">{c.name}</span>
              <span className="character-type">{elementType}</span>
              <span
                className="character-status"
                style={{ backgroundColor: (CHAR_STATUS_COLORS[elementStatus] ?? "#6b7280") + "22", color: CHAR_STATUS_COLORS[elementStatus] ?? "#6b7280" }}
              >
                {elementStatus}
              </span>
            </div>
            {primaryView && primaryView.imagePath && (
              <div className="scene-element-image" style={{ aspectRatio: viewAr }}>
                <img src={primaryView.imagePath} alt={c.name} />
              </div>
            )}
            {c.views.length > 1 && (
              <div className="scene-element-views">
                {c.views.map((v) => (
                  <div key={v.slug} className="scene-element-view-thumb" style={{ aspectRatio: viewAr }}>
                    {v.imagePath ? (
                      <img src={v.imagePath} alt={`${c.name} - ${v.name}`} />
                    ) : (
                      <span className="char-view-placeholder-sm"><span>{v.name}</span></span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
