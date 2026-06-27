import { useMemo, useState, useRef, type MouseEvent } from "react";
import { renderMarkdown, extractToc } from "../utils/markdown";

interface Props {
  name: string;
  content: string;
  /** Episode docs: clicking a "SCENE N" heading cross-references the storyboard. */
  onSceneClick?: (scene: number) => void;
}

export function MarkdownDoc({ name, content, onSceneClick }: Props) {
  const [raw, setRaw] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(content), [content]);
  const toc = useMemo(() => extractToc(content), [content]);

  const scrollTo = (id: string) => {
    const el = bodyRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBodyClick = (e: MouseEvent<HTMLElement>) => {
    if (!onSceneClick) return;
    const h = (e.target as HTMLElement).closest<HTMLElement>("[data-scene]");
    if (h) onSceneClick(parseInt(h.getAttribute("data-scene")!, 10));
  };

  return (
    <div className="md-doc">
      <div className="md-doc-bar">
        <span className="md-doc-name">{name}</span>
        <div className="md-toggle">
          <button className={!raw ? "active" : ""} onClick={() => setRaw(false)}>Rendered</button>
          <button className={raw ? "active" : ""} onClick={() => setRaw(true)}>Raw</button>
        </div>
      </div>
      <div className="md-doc-main">
        {toc.length > 1 && (
          <nav className="md-outline">
            <div className="md-outline-title">Outline</div>
            {toc.map((t, n) => (
              <button key={n} className={`md-outline-item lvl-${t.level}`} onClick={() => scrollTo(t.id)} title={t.text}>
                {t.text}
              </button>
            ))}
          </nav>
        )}
        <div className="md-doc-body" ref={bodyRef}>
          {raw ? (
            <pre className="md-raw">{content}</pre>
          ) : (
            <article className="doc-rendered" dangerouslySetInnerHTML={{ __html: html }} onClick={handleBodyClick} />
          )}
        </div>
      </div>
    </div>
  );
}
