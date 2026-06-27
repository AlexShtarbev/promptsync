function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, href) => `<a href="${href}" target="_blank" rel="noopener">${t}</a>`);
  out = out.replace(/~~(.+?)~~/g, "<del>$1</del>");
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/`(.+?)`/g, "<code>$1</code>");
  return out;
}

/** Slugify a heading to a stable, de-duplicated anchor id. `seen` tracks collisions. */
export function headingSlug(text: string, seen: Map<string, number>): string {
  const base = text.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "section";
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

/** Extract a heading outline (TOC) from markdown, skipping fenced code blocks. */
export function extractToc(md: string): TocEntry[] {
  const lines = md.split("\n");
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      const text = m[2].trim();
      toc.push({ level: m[1].length, text, id: headingSlug(text, seen) });
    }
  }
  return toc;
}

function parseTable(lines: string[]): string {
  const headerCells = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
  const rows = lines.slice(2);
  let html = "<table><thead><tr>";
  for (const cell of headerCells) html += `<th>${inlineMarkdown(cell)}</th>`;
  html += "</tr></thead><tbody>";
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
    html += "<tr>";
    for (const cell of cells) html += `<td>${inlineMarkdown(cell)}</td>`;
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  const seen = new Map<string, number>();
  let i = 0;

  const heading = (level: number, text: string, extra = ""): string => {
    const id = headingSlug(text, seen);
    return `<h${level} id="${id}"${extra}>${inlineMarkdown(text)}</h${level}>`;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
      i++; // closing fence
      const lang = fence[1] ? ` class="language-${fence[1]}"` : "";
      out.push(`<pre class="md-code"><code${lang}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    if (line.trim() === "---") { out.push("<hr>"); i++; continue; }

    if (line.startsWith("# ")) { out.push(heading(1, line.slice(2).trim())); i++; continue; }
    if (line.startsWith("## ")) { out.push(heading(2, line.slice(3).trim())); i++; continue; }
    if (line.startsWith("### ")) {
      const text = line.slice(4).trim();
      const sceneMatch = text.match(/^SCENE\s+(\d+)/i);
      out.push(heading(3, text, sceneMatch ? ` class="scene-heading" data-scene="${sceneMatch[1]}"` : ""));
      i++;
      continue;
    }
    if (line.startsWith("#### ")) { out.push(heading(4, line.slice(5).trim())); i++; continue; }

    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*[-:]+/.test(lines[i + 1])) {
      const tableLines = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].includes("|")) { tableLines.push(lines[j]); j++; }
      out.push(parseTable(tableLines));
      i = j;
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i])) { item += " " + lines[i].trim(); i++; }
        items.push(item);
      }
      out.push("<ul>" + items.map((it) => `<li>${inlineMarkdown(it)}</li>`).join("") + "</ul>");
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\.\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i])) { item += " " + lines[i].trim(); i++; }
        items.push(item);
      }
      out.push("<ol>" + items.map((it) => `<li>${inlineMarkdown(it)}</li>`).join("") + "</ol>");
      continue;
    }

    if (line.startsWith("> ")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { bqLines.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote><p>${inlineMarkdown(bqLines.join(" "))}</p></blockquote>`);
      continue;
    }

    {
      const paraLines: string[] = [line];
      i++;
      while (
        i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") &&
        lines[i].trim() !== "---" && !/^\s*[-*]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) &&
        !lines[i].startsWith("> ") && !/^\s*```/.test(lines[i]) &&
        !(lines[i].includes("|") && i + 1 < lines.length && /^\s*\|?\s*[-:]+/.test(lines[i + 1]))
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      out.push(`<p>${inlineMarkdown(paraLines.join("\n").replace(/\n\s{2,}/g, " "))}</p>`);
    }
  }

  return out.join("\n");
}
