import { Router } from "express";
import { discoverProjects, loadProject } from "../services/markdown-parser.js";
import { emitProject } from "../services/prompt-emitter.js";
import { getAutoEmit, setAutoEmit } from "../services/file-watcher.js";

export function emitRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  // Regenerate projections for one project. ?dryRun=1 reports what WOULD change without writing.
  router.post("/projects/:slug/emit", (req, res) => {
    const slug = req.params.slug;
    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
    const proj = discoverProjects(projectsDir).find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    const result = emitProject(index, proj.path, slug, { write: !dryRun });
    res.json(result);
  });

  // The hands-off loop toggle (global to the dev server).
  router.get("/emit/autoemit", (_req, res) => res.json({ enabled: getAutoEmit() }));
  router.post("/emit/autoemit", (req, res) => {
    const enabled = !!req.body?.enabled;
    setAutoEmit(enabled);
    res.json({ enabled });
  });

  return router;
}
