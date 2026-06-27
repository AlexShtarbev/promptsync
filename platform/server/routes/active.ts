import { Router } from "express";
import { getActiveProject, setActiveProject } from "../services/active-project.js";

// Tracks which project/episode the UI has open so the extension can mirror it.
export function activeRoutes(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ slug: getActiveProject() });
  });

  router.post("/", (req, res) => {
    const slug = (req.body?.slug ?? null) as string | null;
    setActiveProject(slug);
    res.json({ ok: true, slug });
  });

  return router;
}
