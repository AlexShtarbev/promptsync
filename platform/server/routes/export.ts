import { Router } from "express";
import { discoverProjects, loadProject } from "../services/markdown-parser.js";

export function exportRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/:slug/export", (req, res) => {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    const format = req.query.format ?? "json";

    if (format === "csv") {
      const headers = [
        "code", "setting", "shot_type", "camera", "duration", "color_mood",
        "status", "asset_type", "risk", "has_image", "has_mj", "has_kling",
        "subject_action", "vo_lines",
      ];
      const rows = index.shots.map((s) => [
        s.code,
        `"${(s.meta.setting ?? "").replace(/"/g, '""')}"`,
        s.meta.shot_type,
        s.meta.camera,
        s.meta.duration,
        s.meta.color_mood,
        s.meta.status,
        s.meta.asset_type,
        s.meta.risk,
        s.imagePath ? "yes" : "no",
        s.mjPrompt ? "yes" : "no",
        s.klingPrompt ? "yes" : "no",
        `"${(s.content.subject_action ?? "").replace(/"/g, '""')}"`,
        `"${(s.content.vo_lines ?? "").replace(/"/g, '""')}"`,
      ].join(","));

      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.slug}-export.csv"`);
      return res.send(csv);
    }

    const manifest = {
      project: index.config,
      exported: new Date().toISOString(),
      summary: {
        total_shots: index.shots.length,
        with_image: index.shots.filter((s) => s.imagePath).length,
        by_status: Object.fromEntries(
          ["draft", "story-ready", "mj-done", "kling-ready", "kling-done", "seedance-ready", "seedance-done", "complete"].map(
            (st) => [st, index.shots.filter((s) => s.meta.status === st).length]
          )
        ),
        by_asset_type: Object.fromEntries(
          ["still", "kling", "seedance", "kling-reuse", "googleflow"].map(
            (at) => [at, index.shots.filter((s) => s.meta.asset_type === at).length]
          )
        ),
        characters: index.characters.length,
      },
      shots: index.shots.map((s) => ({
        code: s.code,
        meta: s.meta,
        has_image: !!s.imagePath,
        has_mj_prompt: !!s.mjPrompt,
        has_kling_prompt: !!s.klingPrompt,
        has_seedance_prompt: !!s.seedancePrompt,
        has_nanobanana: !!s.nanoBanana,
        subject_action: s.content.subject_action,
        vo_lines: s.content.vo_lines,
      })),
      characters: index.characters.map((c) => ({
        name: c.name,
        meta: c.meta,
      })),
    };

    res.setHeader("Content-Disposition", `attachment; filename="${req.params.slug}-export.json"`);
    res.json(manifest);
  });

  return router;
}
