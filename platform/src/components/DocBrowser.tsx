import { useState } from "react";
import { MarkdownDoc } from "./MarkdownDoc";
import { DocTree } from "./DocTree";

interface Doc {
  name: string;
  slug: string;
  group: string;
  content: string;
}

interface Props {
  docs: Doc[];
}

export function DocBrowser({ docs }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  if (!docs.length) {
    return <div className="empty-state">No documents — narrative canon lives in the series <code>bible/</code> dir.</div>;
  }

  const active = docs.find((d) => d.slug === activeSlug) ?? docs[0];

  return (
    <div className="doc-browser">
      <DocTree docs={docs} activeSlug={active.slug} onSelect={setActiveSlug} />
      <div className="doc-detail">
        <MarkdownDoc key={active.slug} name={active.name} content={active.content} />
      </div>
    </div>
  );
}
