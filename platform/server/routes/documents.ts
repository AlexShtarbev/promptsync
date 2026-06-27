import { Router } from "express";
import fs from "fs";
import path from "path";
import { discoverProjects, safeMatter } from "../services/markdown-parser.js";

// Docs that lead the list (in this order) when present; everything else is
// any other root-level .md/.txt file, sorted alphabetically after these.
const PRIORITY_BASES = ["pre-production", "script"];

const DOC_EXT = /\.(md|txt)$/i;
const baseName = (file: string) => file.replace(DOC_EXT, "");

/**
 * Root-level document files for a project: every `.md`/`.txt` directly in the
 * project dir. When a base name has both a `.md` and `.txt` twin (e.g. a prompt
 * exported in both forms), the `.md` wins so it renders cleanly in the tab.
 * Returns filenames with priority docs first, then the rest alphabetically.
 */
export function projectDocFiles(dir: string): string[] {
  let names: string[];
  try {
    names = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && DOC_EXT.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }

  // Dedupe by base name, preferring .md over .txt.
  const byBase = new Map<string, string>();
  for (const file of names) {
    const existing = byBase.get(baseName(file));
    if (!existing || (/\.txt$/i.test(existing) && /\.md$/i.test(file))) {
      byBase.set(baseName(file), file);
    }
  }

  const rank = (file: string) => PRIORITY_BASES.indexOf(baseName(file));
  return [...byBase.values()].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return (ra === -1 ? Infinity : ra) - (rb === -1 ? Infinity : rb);
    return a.localeCompare(b);
  });
}

function parseSceneMap(content: string): Record<string, string> {
  const map: Record<string, string> = {};
  const lines = content.split("\n");
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/Shot Code Map/i.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.includes("|")) { if (inTable && line.trim() && !line.startsWith("#")) continue; if (line.startsWith("#")) break; continue; }
    if (/^[\s|:-]+$/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2) {
      const scene = cells[0];
      const code = cells[1];
      if (/^\d+$/.test(scene) && /^[A-Z0-9]+$/i.test(code)) {
        map[scene] = code;
      }
    }
  }
  return map;
}

export function documentRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/:slug/documents", (req, res) => {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const docs: { name: string; slug: string; content: string }[] = [];
    let sceneMap: Record<string, string> = {};

    for (const file of projectDocFiles(proj.path)) {
      let raw: string;
      try {
        raw = fs.readFileSync(path.join(proj.path, file), "utf-8");
      } catch {
        continue; // removed between listing and read — skip, don't 500
      }
      const { content } = safeMatter(raw);
      const slug = baseName(file);
      const name = slug
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      docs.push({ name, slug, content: content.trim() });

      if (slug === "script") {
        sceneMap = parseSceneMap(content);
      }
    }

    res.json({ docs, sceneMap });
  });

  return router;
}
