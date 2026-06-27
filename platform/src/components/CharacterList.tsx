import { useState, useCallback, useEffect } from "react";
import type { Character, CharacterView } from "../api/client";
import type { ViewMode } from "./FilterBar";

interface Props {
  characters: Character[];
  slug: string;
  onReload?: () => void;
}

function copyToClipboard(text: string, label: string): void {
  navigator.clipboard.writeText(text).then(
    () => console.log(`Copied ${label}`),
    (err) => console.error(`Failed to copy ${label}:`, err)
  );
}

const STATUS_COLORS: Record<string, string> = {
  "needs-reference": "#ef4444",
  "has-reference": "#22c55e",
  "reference-done": "#22c55e",
  "element-ready": "#8b5cf6",
  "not-created": "#f59e0b",
};

export function CharacterList({ characters, slug, onReload }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("promptsync-char-view-mode") as ViewMode) ?? "grid"
  );
  const [typeFilter, setTypeFilter] = useState(
    () => localStorage.getItem("promptsync-char-type-filter") ?? "all"
  );

  const handleViewMode = useCallback((v: ViewMode) => {
    setViewMode(v);
    localStorage.setItem("promptsync-char-view-mode", v);
  }, []);

  const handleTypeFilter = useCallback((v: string) => {
    setTypeFilter(v);
    localStorage.setItem("promptsync-char-type-filter", v);
  }, []);

  const TYPE_LABEL: Record<string, string> = {
    character: "Characters", creature: "Creatures", environment: "Environments", prop: "Props",
  };
  const types = [...new Set(characters.map((c) => (c.meta.element_type as string) ?? "character"))];
  const countOf = (t: string) => characters.filter((c) => ((c.meta.element_type as string) ?? "character") === t).length;

  const filtered = typeFilter === "all"
    ? characters
    : characters.filter((c) => ((c.meta.element_type as string) ?? "character") === typeFilter);

  if (!characters.length) {
    return <div className="empty-state">No elements defined yet.</div>;
  }

  return (
    <div className="character-list">
      <div className="filter-bar">
        <div className="type-chips">
          <button className={`chip ${typeFilter === "all" ? "active" : ""}`} onClick={() => handleTypeFilter("all")}>
            All <span className="chip-count">{characters.length}</span>
          </button>
          {types.map((t) => (
            <button key={t} className={`chip ${typeFilter === t ? "active" : ""}`} onClick={() => handleTypeFilter(t)}>
              {TYPE_LABEL[t] ?? t} <span className="chip-count">{countOf(t)}</span>
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => handleViewMode("list")}
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
            onClick={() => handleViewMode("grid")}
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
      <div className={viewMode === "grid" ? "character-cards grid" : "character-cards"}>
        {filtered.map((c) => (
          <CharacterCard key={c.name} character={c} slug={slug} compact={viewMode === "grid"} onReload={onReload} />
        ))}
      </div>
    </div>
  );
}

function CharacterCard({ character, slug, compact, onReload }: {
  character: Character;
  slug: string;
  compact: boolean;
  onReload?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<CharacterView | null>(null);
  const meta = character.meta as Record<string, unknown>;
  const appearsIn = (meta.appears_in as string[]) ?? [];
  const elementStatus = (meta.element_status as string) ?? "needs-reference";
  const elementType = (meta.element_type as string) ?? "character";
  const isEnvironment = elementType === "environment";
  const viewAr = isEnvironment ? "16 / 9" : "3 / 4";

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox]);

  const handleDeleteImage = useCallback(async (e: React.MouseEvent, view: CharacterView) => {
    e.stopPropagation();
    if (!confirm(`Delete image for ${character.name} - ${view.name}?`)) return;
    try {
      const resp = await fetch(`/api/assets/${slug}/characters/${character.slug}/${view.slug}/image`, { method: "DELETE" });
      const result = await resp.json();
      if (result.ok && onReload) onReload();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }, [slug, character.slug, character.name, onReload]);

  const handleUpload = useCallback(async (view: CharacterView, file: File) => {
    try {
      const resp = await fetch(`/api/assets/${slug}/characters/${character.slug}/${view.slug}/image/upload`, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      const result = await resp.json();
      if (result.ok && onReload) onReload();
    } catch (err) {
      console.error("Upload failed:", err);
    }
  }, [slug, character.slug, onReload]);

  if (compact) {
    return (
      <>
        <div className="character-card compact" onClick={() => setLightbox(character.views[0] ?? null)} style={{ cursor: "pointer" }}>
          <div className="char-views-grid" data-count={character.views.length} style={{ "--view-ar": viewAr } as React.CSSProperties}>
            {character.views.map((v) => (
              <div
                key={v.slug}
                className="char-view-thumb"
                onClick={(e) => { e.stopPropagation(); setLightbox(v); }}
              >
                {v.imagePath ? (
                  <>
                    <img src={v.imagePath} alt={`${character.name} - ${v.name}`} />
                    <button className="delete-image-btn thumb-delete" onClick={(e) => handleDeleteImage(e, v)} title="Delete image">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/>
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="char-view-placeholder">
                    <span>{v.name}</span>
                  </div>
                )}
              </div>
            ))}
            {character.views.length === 0 && (
              <div className="char-view-placeholder"><span>No views</span></div>
            )}
          </div>
          <div className="character-compact-info">
            <span className="character-name">{character.name}</span>
            <span className="character-type">{elementType}</span>
            <span
              className="character-status"
              style={{ backgroundColor: (STATUS_COLORS[elementStatus] ?? "#6b7280") + "22", color: STATUS_COLORS[elementStatus] ?? "#6b7280" }}
            >
              {elementStatus}
            </span>
          </div>
        </div>
        {lightbox && (
          <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
            <div className="lightbox-split" onClick={(e) => e.stopPropagation()}>
              <div className="lightbox-prompts">
                <div className="lightbox-meta">
                  <span className="shot-code">{character.name}</span>
                  <span className="character-type">{elementType}</span>
                  <span
                    className="character-status"
                    style={{ backgroundColor: (STATUS_COLORS[elementStatus] ?? "#6b7280") + "22", color: STATUS_COLORS[elementStatus] ?? "#6b7280" }}
                  >
                    {elementStatus}
                  </span>
                </div>
                {appearsIn.length > 0 && (
                  <div className="lightbox-setting">Appears in: {appearsIn.join(", ")}</div>
                )}
                <div className="lightbox-action">{lightbox.name}</div>
                <div className="shot-prompts">
                  <div className="prompt-block">
                    <div className="prompt-label">
                      MJ Reference Prompt
                      <button onClick={() => copyToClipboard(lightbox.prompt, `${character.name} ${lightbox.name}`)}>Copy</button>
                    </div>
                    <pre>{lightbox.prompt}</pre>
                  </div>
                </div>
                <div className="char-lightbox-views">
                  {character.views.map((v) => (
                    <button
                      key={v.slug}
                      className={`char-view-btn ${v.slug === lightbox.slug ? "active" : ""}`}
                      onClick={() => setLightbox(v)}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="lightbox-image-side">
                {lightbox.imagePath ? (
                  <div className="lightbox-image-wrapper">
                    <img src={lightbox.imagePath} alt={`${character.name} - ${lightbox.name}`} />
                    <button className="delete-image-btn" onClick={(e) => handleDeleteImage(e, lightbox)} title="Delete image">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="lightbox-placeholder" style={{ aspectRatio: viewAr, width: isEnvironment ? "640px" : "360px" }}>
                    <span className="shot-thumb-label">{lightbox.name}</span>
                    <span className="shot-thumb-ar">{isEnvironment ? "16:9" : "3:4"}</span>
                    <UploadButton onFile={(f) => handleUpload(lightbox, f)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="character-card list-card" onClick={() => setExpanded(!expanded)}>
      <div className="character-header">
        <span className="character-name">{character.name}</span>
        <span className="character-type">{elementType}</span>
        <span
          className="character-status"
          style={{ backgroundColor: (STATUS_COLORS[elementStatus] ?? "#6b7280") + "22", color: STATUS_COLORS[elementStatus] ?? "#6b7280" }}
        >
          {elementStatus}
        </span>
      </div>
      {appearsIn.length > 0 && (
        <div className="character-appears">Appears in: {appearsIn.join(", ")}</div>
      )}
      {character.views.length > 0 && (
        <div className="char-views-row">
          {character.views.map((v) => (
            <div key={v.slug} className="char-view-inline" style={{ aspectRatio: viewAr }}>
              {v.imagePath ? (
                <img src={v.imagePath} alt={`${character.name} - ${v.name}`} onClick={(e) => { e.stopPropagation(); setLightbox(v); }} style={{ cursor: "pointer" }} />
              ) : (
                <div className="char-view-placeholder-sm">
                  <span>{v.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="character-sections">
          {Object.entries(character.sections).map(([key, value]) => (
            <div key={key} className="character-section">
              <div className="character-section-title">
                {key.replace(/_/g, " ")}
                {key.includes("prompt") && (
                  <button className="copy-section-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(value, key); }}>Copy</button>
                )}
              </div>
              <div className="character-section-body">{value}</div>
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="lightbox-overlay" onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.imagePath!} alt={`${character.name} - ${lightbox.name}`} />
            <div className="lightbox-label">{character.name} - {lightbox.name}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadButton({ onFile }: { onFile: (f: File) => void }) {
  return (
    <label className="char-upload-btn" onClick={(e) => e.stopPropagation()}>
      Upload
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
