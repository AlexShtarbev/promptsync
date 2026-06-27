import { Router } from "express";
import { discoverProjects, loadProject } from "../services/markdown-parser.js";

export function projectRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const projects = discoverProjects(projectsDir);
    res.json(projects.map((p) => ({ slug: p.slug, name: p.config.name, status: p.config.status })));
  });

  router.get("/:slug", (req, res) => {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });
    res.json(index);
  });

  return router;
}
