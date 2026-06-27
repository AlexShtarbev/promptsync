import { Router } from "express";
import { discoverProjects, loadProject } from "../services/markdown-parser.js";
import { validateElements, fixElements } from "../services/element-validator.js";
import { validateContinuity } from "../services/continuity-validator.js";

export function validateRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/:slug/validate-elements", (req, res) => {
    const slug = req.params.slug;
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    const report = validateElements(index, slug);
    res.json(report);
  });

  router.post("/:slug/fix-elements", (req, res) => {
    const slug = req.params.slug;
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    const report = fixElements(index, slug, proj.path);
    res.json(report);
  });

  router.get("/:slug/validate-continuity", (req, res) => {
    const slug = req.params.slug;
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    const report = validateContinuity(index, proj.path, slug);
    res.json(report);
  });

  return router;
}
