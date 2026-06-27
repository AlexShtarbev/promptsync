import { Router } from "express";
import path from "path";
import { discoverWorkspace, loadGlobalElements, loadBibleDocs } from "../services/markdown-parser.js";
import { validateStructure } from "../services/structure.js";
import { toApiCharacter } from "./characters.js";

// The navigable workspace: standalone projects + series (with episodes), and each
// series' global element library for the always-visible Global tab.
export function workspaceRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const ws = discoverWorkspace(projectsDir);
    res.json({
      projects: ws.projects.map((p) => ({
        slug: p.slug,
        name: p.config.name,
        status: p.config.status,
      })),
      series: ws.series.map((s) => ({
        slug: s.slug,
        name: s.config.name,
        status: s.config.status,
        episodes: s.episodes.map((e) => ({
          slug: e.slug,
          name: e.config.name,
          status: e.config.status,
          seriesSlug: s.slug,
        })),
      })),
    });
  });

  // Structural validation across the whole workspace (read-only; --fix is CLI-only).
  router.get("/validate", (_req, res) => {
    const issues = validateStructure(projectsDir);
    res.json({
      ok: !issues.some((i) => i.level === "error"),
      counts: {
        error: issues.filter((i) => i.level === "error").length,
        warning: issues.filter((i) => i.level === "warning").length,
        info: issues.filter((i) => i.level === "info").length,
      },
      issues,
    });
  });

  // Series-global elements, addressed by the SERIES slug (asset URLs resolve via the
  // series slug too — see assets resolveElementDirs).
  router.get("/series/:slug/global", (req, res) => {
    const ws = discoverWorkspace(projectsDir);
    const series = ws.series.find((s) => s.slug === req.params.slug);
    if (!series) return res.status(404).json({ error: "Series not found" });
    const characters = loadGlobalElements(series.globalElementDirs);
    res.json({
      slug: series.slug,
      name: series.config.name,
      characters: characters.map((c) => toApiCharacter(c, series.slug)),
    });
  });

  // Series bible (narrative canon) markdown docs.
  router.get("/series/:slug/bible", (req, res) => {
    const ws = discoverWorkspace(projectsDir);
    const series = ws.series.find((s) => s.slug === req.params.slug);
    if (!series) return res.status(404).json({ error: "Series not found" });
    const bibleDir = path.resolve(series.path, series.config.bible || "bible");
    res.json({ slug: series.slug, name: series.config.name, docs: loadBibleDocs(bibleDir) });
  });

  return router;
}
