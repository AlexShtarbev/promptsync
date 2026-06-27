import type { WorkspaceTree as Tree } from "../api/client";
import type { Selection } from "../hooks/useWorkspace";

interface Props {
  workspace: Tree;
  selection: Selection | null;
  onSelectProject: (slug: string, seriesSlug: string | null) => void;
  onSelectSeriesGlobal: (seriesSlug: string) => void;
}

function isActiveProject(sel: Selection | null, slug: string): boolean {
  return sel?.kind === "project" && sel.slug === slug;
}

export function WorkspaceTree({ workspace, selection, onSelectProject, onSelectSeriesGlobal }: Props) {
  const { projects, series } = workspace;

  if (projects.length === 0 && series.length === 0) {
    return <div className="tree-empty">No projects found</div>;
  }

  return (
    <nav className="tree">
      {series.map((s) => (
        <div className="tree-series" key={s.slug}>
          <div className="tree-series-name" title={s.status}>{s.name}</div>

          <button
            className={`tree-node tree-global ${selection?.kind === "series-global" && selection.seriesSlug === s.slug ? "active" : ""}`}
            onClick={() => onSelectSeriesGlobal(s.slug)}
          >
            <span className="tree-icon">◆</span> Global
          </button>

          <div className="tree-section-label">Episodes</div>
          {s.episodes.length === 0 && <div className="tree-muted">— none yet —</div>}
          {s.episodes.map((ep) => (
            <button
              key={ep.slug}
              className={`tree-node tree-episode ${isActiveProject(selection, ep.slug) ? "active" : ""}`}
              onClick={() => onSelectProject(ep.slug, s.slug)}
              title={ep.status}
            >
              <span className="tree-dot">{isActiveProject(selection, ep.slug) ? "●" : "○"}</span> {ep.name}
            </button>
          ))}
        </div>
      ))}

      {projects.length > 0 && (
        <div className="tree-series">
          {series.length > 0 && <div className="tree-section-label">Projects</div>}
          {projects.map((p) => (
            <button
              key={p.slug}
              className={`tree-node tree-project ${isActiveProject(selection, p.slug) ? "active" : ""}`}
              onClick={() => onSelectProject(p.slug, null)}
              title={p.status}
            >
              <span className="tree-dot">{isActiveProject(selection, p.slug) ? "●" : "○"}</span> {p.name}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
