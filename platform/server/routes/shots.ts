import { Router } from "express";
import fs from "fs";
import type { Shot } from "../types.js";
import { discoverProjects, loadProject, loadSingleShot } from "../services/markdown-parser.js";

function toApiShot(shot: Shot, slug: string): Record<string, unknown> {
  let imagePath: string | null = null;
  if (shot.imagePath) {
    let v = "";
    try { v = `?v=${fs.statSync(shot.imagePath).mtimeMs | 0}`; } catch {}
    imagePath = `/api/assets/${slug}/shots/${shot.code}/image${v}`;
  }
  let videoPath: string | null = null;
  if (shot.videoPath) {
    let v = "";
    try { v = `?v=${fs.statSync(shot.videoPath).mtimeMs | 0}`; } catch {}
    videoPath = `/api/assets/${slug}/shots/${shot.code}/video${v}`;
  }
  return { ...shot, imagePath, videoPath };
}

export function shotRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  function resolveProjectPath(slug: string): string | null {
    const projects = discoverProjects(projectsDir);
    return projects.find((p) => p.slug === slug)?.path ?? null;
  }

  router.get("/:slug/shots", (req, res) => {
    const slug = req.params.slug;
    const projPath = resolveProjectPath(slug);
    if (!projPath) return res.status(404).json({ error: "Project not found" });
    const index = loadProject(projPath);
    if (!index) return res.status(500).json({ error: "Failed to load project" });
    res.json(index.shots.map((s) => toApiShot(s, slug)));
  });

  router.get("/:slug/shots/:code", (req, res) => {
    const slug = req.params.slug;
    const projPath = resolveProjectPath(slug);
    if (!projPath) return res.status(404).json({ error: "Project not found" });
    const shot = loadSingleShot(projPath, req.params.code);
    if (!shot) return res.status(404).json({ error: "Shot not found" });
    res.json(toApiShot(shot, slug));
  });

  return router;
}
