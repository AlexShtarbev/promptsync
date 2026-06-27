import type { WorkspaceTree } from "../api/client";

// What the UI currently has open: a project/episode, or a series-global view.
export type Selection =
  | { kind: "project"; slug: string; seriesSlug: string | null }
  | { kind: "series-global"; seriesSlug: string };

/**
 * Is a (possibly stale, restored-from-localStorage) selection still present in the
 * current workspace tree? Guards the restore path so we never try to load a project
 * or series that no longer exists.
 */
export function selectionExists(ws: WorkspaceTree, sel: Selection): boolean {
  if (sel.kind === "project") {
    return (
      ws.projects.some((p) => p.slug === sel.slug) ||
      ws.series.some((s) => s.episodes.some((e) => e.slug === sel.slug))
    );
  }
  return ws.series.some((s) => s.slug === sel.seriesSlug);
}
