import { useState } from "react";

interface Doc {
  name: string;
  slug: string;
  group: string;
}

interface Props {
  docs: Doc[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

const GROUP_LABEL: Record<string, string> = {
  canon: "Canon",
  characters: "Characters",
  environments: "Environments",
  props: "Props",
  documents: "Documents",
};

function FolderIcon() {
  return (
    <svg className="tree-icon" width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5v6A1.5 1.5 0 0 1 13 12.5H3A1.5 1.5 0 0 1 1.5 11z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="tree-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M4 1.5h5L13 5v9.5H4z" />
      <path d="M9 1.5V5h4" />
    </svg>
  );
}

/** Collapsible folder/file tree for grouped documents. */
export function DocTree({ docs, activeSlug, onSelect }: Props) {
  const groups = [...new Set(docs.map((d) => d.group))];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (g: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });

  return (
    <nav className="doc-tree">
      {groups.map((g) => {
        const open = !collapsed.has(g);
        const items = docs.filter((d) => d.group === g);
        return (
          <div className="tree-folder" key={g}>
            <button className="tree-folder-row" onClick={() => toggle(g)} aria-expanded={open}>
              <span className={`tree-caret ${open ? "open" : ""}`}>▶</span>
              <FolderIcon />
              <span className="tree-folder-name">{GROUP_LABEL[g] ?? g}</span>
              <span className="tree-count">{items.length}</span>
            </button>
            {open && (
              <div className="tree-children">
                {items.map((d) => (
                  <button
                    key={d.slug}
                    className={`tree-leaf ${d.slug === activeSlug ? "active" : ""}`}
                    onClick={() => onSelect(d.slug)}
                    title={d.name}
                  >
                    <FileIcon />
                    <span className="tree-leaf-name">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
