import { useState, useEffect, useCallback } from "react";
import { api, type WorkspaceTree, type Shot, type Character, type DocumentEntry } from "../api/client";
import { selectionExists, type Selection } from "./workspace-selection";

export type { Selection };

const SEL_KEY = "promptsync-selection";

function readSavedSelection(): Selection | null {
  try {
    return JSON.parse(localStorage.getItem(SEL_KEY) || "null") as Selection | null;
  } catch {
    return null;
  }
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceTree>({ projects: [], series: [] });
  const [selection, setSelection] = useState<Selection | null>(readSavedSelection);
  const [shots, setShots] = useState<Shot[]>([]);
  // For a project selection this holds the merged (scope-tagged) element set; for a
  // series-global selection it holds the series' global elements.
  const [characters, setCharacters] = useState<Character[]>([]);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [sceneMap, setSceneMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // `background: true` refreshes the data in place without flipping `loading`. The loading flag
  // gates the whole content subtree's mount in App, so toggling it on a background refresh (e.g. a
  // WS "files-changed" fired by the user's own image upload) unmounts/remounts the view and resets
  // scroll + cursor to the top — looking exactly like a full page reload. Only initial loads and
  // explicit project switches should show the loading state.
  const loadSelection = useCallback((sel: Selection | null, opts?: { background?: boolean }) => {
    if (!sel) {
      setShots([]); setCharacters([]); setDocuments([]); setSceneMap({});
      return;
    }
    if (!opts?.background) setLoading(true);
    if (sel.kind === "project") {
      // allSettled so one failing endpoint (e.g. a malformed doc) doesn't blank every tab.
      Promise.allSettled([api.getShots(sel.slug), api.getCharacters(sel.slug), api.getDocuments(sel.slug)])
        .then(([s, c, d]) => {
          if (s.status === "fulfilled") setShots(s.value); else { console.error(s.reason); setShots([]); }
          if (c.status === "fulfilled") setCharacters(c.value); else { console.error(c.reason); setCharacters([]); }
          if (d.status === "fulfilled") { setDocuments(d.value.docs); setSceneMap(d.value.sceneMap); }
          else { console.error(d.reason); setDocuments([]); setSceneMap({}); }
        })
        .finally(() => setLoading(false));
    } else {
      setShots([]); setDocuments([]); setSceneMap({});
      api.getGlobalElements(sel.seriesSlug)
        .then((g) => setCharacters(g.characters))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, []);

  const refreshWorkspace = useCallback(() => api.getWorkspace().then(setWorkspace), []);

  // On mount: load the tree, then restore a still-valid saved selection.
  useEffect(() => {
    api.getWorkspace().then((ws) => {
      setWorkspace(ws);
      const saved = readSavedSelection();
      if (saved && selectionExists(ws, saved)) loadSelection(saved);
    }).catch(console.error);
  }, [loadSelection]);

  const selectProject = useCallback((slug: string, seriesSlug: string | null = null) => {
    const sel: Selection = { kind: "project", slug, seriesSlug };
    setSelection(sel);
    localStorage.setItem(SEL_KEY, JSON.stringify(sel));
    api.setActive(slug).catch(() => {}); // tell the extension which project is open
    loadSelection(sel);
  }, [loadSelection]);

  const selectSeriesGlobal = useCallback((seriesSlug: string) => {
    const sel: Selection = { kind: "series-global", seriesSlug };
    setSelection(sel);
    localStorage.setItem(SEL_KEY, JSON.stringify(sel));
    loadSelection(sel);
  }, [loadSelection]);

  // Reload is a background refresh: keep the current view mounted (preserve scroll + cursor) and
  // just swap the data underneath. Initial load and project switches still show "Loading…".
  const reload = useCallback(() => {
    refreshWorkspace().catch(console.error);
    if (selection) loadSelection(selection, { background: true });
  }, [selection, loadSelection, refreshWorkspace]);

  return {
    workspace,
    selection,
    selectProject,
    selectSeriesGlobal,
    shots,
    characters,
    documents,
    sceneMap,
    loading,
    reload,
  };
}
