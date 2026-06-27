import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Layout } from "./components/Layout";
import { WorkspaceTree } from "./components/WorkspaceTree";
import { ShotList } from "./components/ShotList";
import { CharacterList } from "./components/CharacterList";
import { DocumentsView } from "./components/DocumentsView";
import { CaptionEditor } from "./components/CaptionEditor";
import { ProgressBar } from "./components/ProgressBar";
import { DocBrowser } from "./components/DocBrowser";
import { ContinuityModal } from "./components/ContinuityModal";
import { useWorkspace } from "./hooks/useWorkspace";
import { useWebSocket } from "./hooks/useWebSocket";
import { api, type StructureReport, type BibleDoc, type ContinuityReport } from "./api/client";
import { splitByScope } from "./utils/elements";

type Tab = "storyboard" | "characters" | "global" | "documents" | "captions";

export function App() {
  const {
    workspace, selection, selectProject, selectSeriesGlobal,
    shots, characters, documents, sceneMap, loading, reload,
  } = useWorkspace();

  const [tab, setTabRaw] = useState<Tab>(() => (localStorage.getItem("promptsync-tab") as Tab) ?? "storyboard");
  const setTab = useCallback((t: Tab) => { setTabRaw(t); localStorage.setItem("promptsync-tab", t); }, []);

  // A project/episode is "open" (drives toolbar actions + the extension) only when a
  // project is selected — not for the series-global view.
  const activeSlug = selection?.kind === "project" ? selection.slug : null;
  const seriesSlug = selection?.kind === "project" ? selection.seriesSlug : null;

  // For a project, split the merged element set into episode-local vs series-global.
  const { global: globalChars, local: localChars } = useMemo(() => splitByScope(characters), [characters]);

  // Global tab only exists for an episode that belongs to a series.
  const showGlobalTab = activeSlug !== null && seriesSlug !== null;
  const effectiveTab: Tab = tab === "global" && !showGlobalTab ? "characters" : tab;

  const [continuity, setContinuity] = useState<ContinuityReport | null>(null);
  const [continuityOpen, setContinuityOpen] = useState(false);
  const [autoEmit, setAutoEmit] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [emitMsg, setEmitMsg] = useState<string | null>(null);

  const handleWsMessage = useCallback(
    (data: unknown) => {
      const msg = data as { type?: string; slug?: string; report?: ContinuityReport };
      if (msg.type === "files-changed") reload();
      // The save-hook pushes a fresh continuity report; keep the badge live for the open project.
      if (msg.type === "continuity-report" && msg.report && msg.slug === activeSlug) setContinuity(msg.report);
    },
    [reload, activeSlug]
  );
  const { connected } = useWebSocket(handleWsMessage);

  // On opening a project: if auto-emit is on, regenerate projections (and freshen the board) and
  // use the resulting lint; otherwise just fetch the continuity report. Low-touch — no click needed.
  useEffect(() => {
    if (!activeSlug) { setContinuity(null); return; }
    let cancelled = false;
    const p = autoEmit ? api.emit(activeSlug).then((r) => r.lint) : api.validateContinuity(activeSlug);
    p.then((r) => { if (!cancelled) setContinuity(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeSlug, autoEmit]);

  // Reflect the server's auto-emit state on load.
  useEffect(() => {
    api.getAutoEmit().then((r) => setAutoEmit(r.enabled)).catch(() => {});
  }, []);

  const toggleAutoEmit = useCallback(async () => {
    try {
      const r = await api.setAutoEmit(!autoEmit);
      setAutoEmit(r.enabled);
    } catch { /* ignore */ }
  }, [autoEmit]);

  const handleEmit = useCallback(async () => {
    if (!activeSlug || emitting) return;
    setEmitting(true);
    setEmitMsg(null);
    try {
      const res = await api.emit(activeSlug);
      setContinuity(res.lint);
      setEmitMsg(res.changes.length ? `Regenerated ${res.changes.length} projection(s)` : "All projections in sync");
      reload();
    } catch {
      setEmitMsg("Emit failed");
    } finally {
      setEmitting(false);
      setTimeout(() => setEmitMsg(null), 4000);
    }
  }, [activeSlug, emitting, reload]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "1" && e.altKey) { e.preventDefault(); setTab("storyboard"); }
      if (e.key === "2" && e.altKey) { e.preventDefault(); setTab("characters"); }
      if (e.key === "3" && e.altKey) { e.preventDefault(); setTab("global"); }
      if (e.key === "4" && e.altKey) { e.preventDefault(); setTab("documents"); }
      if (e.key === "5" && e.altKey) { e.preventDefault(); setTab("captions"); }
      if (e.key === "r" && e.altKey) { e.preventDefault(); reload(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [reload, setTab]);

  const handleExport = useCallback((format: "json" | "csv") => {
    if (!activeSlug) return;
    window.open(`/api/projects/${activeSlug}/export?format=${format}`, "_blank");
  }, [activeSlug]);

  const handleOpenVideosDir = useCallback(async () => {
    if (!activeSlug) return;
    try {
      const res = await fetch(`/api/assets/${activeSlug}/videos/dir`);
      const data = await res.json();
      if (data.path) {
        await navigator.clipboard.writeText(data.path);
        alert(`Videos directory path copied to clipboard:\n${data.path}`);
      }
    } catch {
      alert("Failed to get videos directory");
    }
  }, [activeSlug]);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const handleClearAllImages = useCallback(async () => {
    if (!activeSlug) return;
    setClearConfirmOpen(false);
    try {
      const res = await fetch(`/api/assets/${activeSlug}/shots/images/all`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) reload();
      else alert(`Failed: ${data.error}`);
    } catch {
      alert("Failed to clear images");
    }
  }, [activeSlug, reload]);

  const [driveEnabled, setDriveEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const driveChecked = useRef(false);

  useEffect(() => {
    if (driveChecked.current) return;
    driveChecked.current = true;
    fetch("/api/drive/status").then((r) => r.json()).then((d) => setDriveEnabled(d.enabled)).catch(() => {});
  }, []);

  const handleDriveSync = useCallback(async () => {
    if (!activeSlug || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/drive/sync/${activeSlug}`, { method: "POST" });
      const data = await res.json();
      if (data.ok) alert(`Synced ${data.syncedImages} images and ${data.syncedVideos} videos to Google Drive`);
      else alert(`Sync failed: ${data.error}`);
    } catch {
      alert("Drive sync error");
    } finally {
      setSyncing(false);
    }
  }, [activeSlug, syncing]);

  const [structure, setStructure] = useState<StructureReport | null>(null);
  const [structureOpen, setStructureOpen] = useState(false);
  const [checkingStructure, setCheckingStructure] = useState(false);

  // Series-global pane: Bible (narrative canon) first, then Elements.
  const [seriesTab, setSeriesTab] = useState<"bible" | "elements">("bible");
  const [bible, setBible] = useState<BibleDoc[]>([]);
  const [bibleLoading, setBibleLoading] = useState(false);

  useEffect(() => {
    if (selection?.kind === "series-global" && seriesTab === "bible") {
      setBibleLoading(true);
      api.getBible(selection.seriesSlug)
        .then((r) => setBible(r.docs))
        .catch(() => setBible([]))
        .finally(() => setBibleLoading(false));
    }
  }, [selection, seriesTab]);

  const handleCheckStructure = useCallback(async () => {
    setCheckingStructure(true);
    try {
      const report = await api.validateStructure();
      setStructure(report);
      setStructureOpen(true);
    } catch {
      alert("Failed to validate structure");
    } finally {
      setCheckingStructure(false);
    }
  }, []);

  const sidebar = (
    <>
      <WorkspaceTree
        workspace={workspace}
        selection={selection}
        onSelectProject={selectProject}
        onSelectSeriesGlobal={selectSeriesGlobal}
      />
      <button className="tree-check-btn" onClick={handleCheckStructure} disabled={checkingStructure}>
        {checkingStructure ? "Checking…" : "Check structure"}
      </button>
    </>
  );

  // Doc-reader views fill the viewport (Google-Docs style) and scroll internally.
  const fillMode =
    (selection?.kind === "series-global" && seriesTab === "bible") ||
    (selection?.kind === "project" && effectiveTab === "documents");

  return (
    <Layout sidebar={sidebar} connected={connected} fill={fillMode}>
      {activeSlug && (
        <div className="toolbar">
          <div className="toolbar-actions">
            {continuity && (
              <button
                className={`toolbar-btn ${continuity.totalErrors ? "danger" : ""}`}
                onClick={() => setContinuityOpen(true)}
                title="Continuity engine — physics-engine lints, re-run on every save"
              >
                {continuity.totalErrors === 0 && continuity.totalWarnings === 0
                  ? "✓ Continuity"
                  : `Continuity: ${continuity.totalErrors}✗ ${continuity.totalWarnings}!`}
              </button>
            )}
            <button className="toolbar-btn" onClick={handleEmit} disabled={emitting}
              title="Regenerate prompts + board from the authored state (injects only missing mandatory clauses)">
              {emitting ? "Emitting…" : "⚡ Emit now"}
            </button>
            <button className={`toolbar-btn ${autoEmit ? "toggle-on" : ""}`} onClick={toggleAutoEmit} role="switch" aria-checked={autoEmit}
              title="When on, the engine regenerates projections on every save (hands-off)">
              Auto-emit {autoEmit ? "●" : "○"}
            </button>
            {emitMsg && <span className="emit-msg">{emitMsg}</span>}
            <button className="toolbar-btn" onClick={() => handleExport("json")} title="Export JSON">Export JSON</button>
            <button className="toolbar-btn" onClick={() => handleExport("csv")} title="Export CSV">Export CSV</button>
            <button className="toolbar-btn" onClick={handleOpenVideosDir} title="Open Videos Directory">Videos Dir</button>
            <button className="toolbar-btn danger" onClick={() => setClearConfirmOpen(true)}>Clear All Images</button>
            {driveEnabled && (
              <button className="toolbar-btn" onClick={handleDriveSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync to Drive"}
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}

      {!loading && selection?.kind === "project" && (
        <>
          <ProgressBar shots={shots} />
          <div className="tab-bar">
            <button className={`tab-btn ${effectiveTab === "storyboard" ? "active" : ""}`} onClick={() => setTab("storyboard")}>
              Storyboard ({shots.length})
            </button>
            <button className={`tab-btn ${effectiveTab === "characters" ? "active" : ""}`} onClick={() => setTab("characters")}>
              Characters ({localChars.length})
            </button>
            {showGlobalTab && (
              <button className={`tab-btn ${effectiveTab === "global" ? "active" : ""}`} onClick={() => setTab("global")}>
                Global ({globalChars.length})
              </button>
            )}
            <button className={`tab-btn ${effectiveTab === "documents" ? "active" : ""}`} onClick={() => setTab("documents")}>
              Documents ({documents.length})
            </button>
            <button className={`tab-btn ${effectiveTab === "captions" ? "active" : ""}`} onClick={() => setTab("captions")}>
              Captions
            </button>
          </div>
          {effectiveTab === "storyboard" && <ShotList shots={shots} slug={activeSlug!} onReload={reload} />}
          {effectiveTab === "characters" && <CharacterList characters={localChars} slug={activeSlug!} onReload={reload} />}
          {effectiveTab === "global" && <CharacterList characters={globalChars} slug={activeSlug!} onReload={reload} />}
          {effectiveTab === "documents" && (
            <DocumentsView documents={documents} shots={shots} characters={characters} sceneMap={sceneMap} slug={activeSlug!} />
          )}
          {effectiveTab === "captions" && <CaptionEditor slug={activeSlug!} />}
        </>
      )}

      {!loading && selection?.kind === "series-global" && (
        <>
          <div className="global-header">Series-global — shared across all episodes</div>
          <div className="tab-bar">
            <button className={`tab-btn ${seriesTab === "bible" ? "active" : ""}`} onClick={() => setSeriesTab("bible")}>
              Bible ({bible.length})
            </button>
            <button className={`tab-btn ${seriesTab === "elements" ? "active" : ""}`} onClick={() => setSeriesTab("elements")}>
              Global elements ({characters.length})
            </button>
          </div>
          {seriesTab === "bible" && (bibleLoading ? <div className="loading">Loading…</div> : <DocBrowser key={selection.seriesSlug} docs={bible} />)}
          {seriesTab === "elements" && <CharacterList characters={characters} slug={selection.seriesSlug} onReload={reload} />}
        </>
      )}

      {!loading && !selection && (
        <div className="empty-state">Select a project or episode to get started.</div>
      )}

      {continuityOpen && continuity && (
        <ContinuityModal report={continuity} onClose={() => setContinuityOpen(false)} />
      )}

      {structureOpen && structure && (
        <div className="modal-overlay" onClick={() => setStructureOpen(false)}>
          <div className="modal-dialog structure-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>
              Structure check —{" "}
              {structure.ok ? <span className="struct-ok">passed</span> : <span className="struct-fail">{structure.counts.error} error(s)</span>}
              {structure.counts.warning > 0 && <span className="struct-warn"> · {structure.counts.warning} warning(s)</span>}
            </h3>
            {structure.issues.length === 0 ? (
              <p>No issues — every project follows the expected layout.</p>
            ) : (
              <ul className="struct-issues">
                {structure.issues.map((i, n) => (
                  <li key={n} className={`struct-issue ${i.level}`}>
                    <span className="struct-code">{i.code}</span>
                    <span className="struct-ctx">{i.context}</span>
                    {i.fixable && <span className="struct-fixable">fixable</span>}
                    <div className="struct-msg">{i.message}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="struct-hint">Auto-fix the fixable items: <code>cd platform &amp;&amp; npm run structure -- validate --fix</code></p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setStructureOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {clearConfirmOpen && (
        <div className="modal-overlay" onClick={() => setClearConfirmOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Clear All Shot Images</h3>
            <p>This will permanently delete all storyboard shot images for <strong>{activeSlug}</strong>. This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setClearConfirmOpen(false)}>Cancel</button>
              <button className="modal-btn confirm-danger" onClick={handleClearAllImages}>Delete All Images</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
