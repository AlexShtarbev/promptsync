import { Router } from "express";
import fs from "fs";
import { discoverProjects, loadProject } from "../services/markdown-parser.js";
import type { Character } from "../types.js";

export function toApiCharacter(char: Character, slug: string): Record<string, unknown> {
  const views = char.views.map((v) => {
    let imagePath: string | null = null;
    if (v.imagePath) {
      let vParam = "";
      try { vParam = `?v=${fs.statSync(v.imagePath).mtimeMs | 0}`; } catch {}
      imagePath = `/api/assets/${slug}/characters/${char.slug}/${v.slug}/image${vParam}`;
    }
    return { ...v, imagePath };
  });
  return { ...char, views };
}

export function characterRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/:slug/characters", (req, res) => {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });
    res.json(index.characters.map((c) => toApiCharacter(c, req.params.slug)));
  });

  return router;
}
