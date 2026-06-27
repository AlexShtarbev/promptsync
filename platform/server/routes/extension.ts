import { Router } from "express";
import { discoverProjects, loadProject, loadSingleShot, loadSingleCharacter } from "../services/markdown-parser.js";

export function extensionRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/index", (req, res) => {
    const slug = req.query.project as string;
    if (!slug) return res.status(400).json({ error: "project query param required" });

    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    const compact = index.shots.map((s) => ({
      code: s.code,
      status: s.meta.status,
      asset_type: s.meta.asset_type,
      setting: s.meta.setting,
      elements: s.meta.elements || [],
      has_mj: !!s.mjPrompt,
      has_kling: !!s.klingPrompt,
      has_seedance: !!s.seedancePrompt,
      has_image: !!s.imagePath,
      has_start_frame: !!s.startFramePath,
      openart_ref: s.openartRef || null,
      vo_lines: s.content.vo_lines || "",
      subject_action: s.content.subject_action || "",
      character_lock: s.seedancePrompt?.meta?.character_lock || null,
    }));

    const compactChars = index.characters.map((c) => ({
      name: c.name,
      element_name: c.meta.element_name || c.name,
      slug: c.slug,
      element_type: c.meta.element_type,
      element_status: c.meta.element_status,
      appears_in: c.meta.appears_in,
      kling_description: c.sections.kling_element_description || "",
      views: c.views.map((v) => ({
        index: v.index,
        name: v.name,
        slug: v.slug,
        prompt: v.prompt,
        has_image: !!v.imagePath,
        openart_ref: v.openartRef || null,
        openart_resource_id: v.openartResourceId || null,
        aspect_ratio: v.aspect_ratio || null,
        resolution: v.resolution || null,
        primary: !!v.primary,
      })),
    }));

    const elementMap: Record<string, string> = {};
    for (const c of index.characters) {
      const eName = c.meta.element_name || c.name;
      if (eName !== c.name) {
        elementMap[eName] = c.name;
      }
    }

    res.json({
      project: slug,
      aspect_ratio: index.config.aspect_ratio,
      default_resolution: index.config.default_resolution,
      shots: compact,
      characters: compactChars,
      elementMap,
    });
  });

  router.get("/shot", (req, res) => {
    const slug = req.query.project as string;
    const code = req.query.code as string;
    if (!slug || !code) return res.status(400).json({ error: "project and code query params required" });

    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const shot = loadSingleShot(proj.path, code, proj.globalElementDirs, proj.seriesDefaults);
    if (!shot) return res.status(404).json({ error: "Shot not found" });

    res.json(shot);
  });

  router.get("/character", (req, res) => {
    const slug = req.query.project as string;
    const charSlug = req.query.char as string;
    if (!slug || !charSlug) return res.status(400).json({ error: "project and char query params required" });

    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const char = loadSingleCharacter(proj.path, charSlug, proj.globalElementDirs);
    if (!char) return res.status(404).json({ error: "Character not found" });

    res.json({
      name: char.name,
      slug: char.slug,
      element_type: char.meta.element_type,
      element_status: char.meta.element_status,
      kling_description: char.sections.kling_element_description || "",
      views: char.views.map((v) => ({
        index: v.index,
        name: v.name,
        slug: v.slug,
        prompt: v.prompt,
        has_image: !!v.imagePath,
        openart_ref: v.openartRef || null,
        openart_resource_id: v.openartResourceId || null,
        aspect_ratio: v.aspect_ratio || null,
        resolution: v.resolution || null,
        primary: !!v.primary,
      })),
    });
  });

  return router;
}
