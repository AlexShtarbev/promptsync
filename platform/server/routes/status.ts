import { Router } from "express";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { discoverProjects } from "../services/markdown-parser.js";

export function statusRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.patch("/:slug/shots/:code/status", (req, res) => {
    const { status } = req.body;
    if (!status || typeof status !== "string") {
      return res.status(400).json({ error: "status required" });
    }

    const valid = ["draft", "story-ready", "mj-done", "kling-ready", "kling-done", "complete"];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(", ")}` });
    }

    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const shotMd = path.join(proj.path, "storyboard", "shots", req.params.code, "shot.md");
    if (!fs.existsSync(shotMd)) {
      return res.status(404).json({ error: "Shot not found" });
    }

    const raw = fs.readFileSync(shotMd, "utf-8");
    const { data, content } = matter(raw);
    data.status = status;
    const updated = matter.stringify(content, data);
    fs.writeFileSync(shotMd, updated);

    res.json({ ok: true, code: req.params.code, status });
  });

  return router;
}
