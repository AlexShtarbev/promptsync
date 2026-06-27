import { Router } from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { discoverProjects } from "../services/markdown-parser.js";
import { notifyChange } from "../services/file-watcher.js";

// In-dashboard caption editor: read/write the canonical captions.json and kick
// off a render via the project's Remotion CLI tool (tooling/captions).
export function captionRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  function resolveProject(slug: string): string | null {
    const proj = discoverProjects(projectsDir).find((p) => p.slug === slug);
    return proj ? proj.path : null;
  }

  function captionsFile(projPath: string): string {
    return path.join(projPath, "storyboard", "captions.json");
  }

  const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
  // Clip codes actually present on disk, natural-sorted (1B < 1K < 1L).
  function discoverClips(projPath: string): string[] {
    const dir = path.join(projPath, "storyboard", "videos");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => VIDEO_EXT.test(f))
      .map((f) => f.replace(VIDEO_EXT, ""))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  }

  // The Remotion render tool lives either inside a single project (tooling/captions)
  // or at the series root for an episode (../../tooling/captions). Use the first found.
  function resolveToolDir(projPath: string): string | null {
    const candidates = [
      path.join(projPath, "tooling", "captions"),
      path.resolve(projPath, "..", "..", "tooling", "captions"),
    ];
    return candidates.find((d) => fs.existsSync(path.join(d, "package.json"))) ?? null;
  }

  router.get("/:slug/captions", (req, res) => {
    const projPath = resolveProject(req.params.slug);
    if (!projPath) return res.status(404).json({ error: "Project not found" });
    const file = captionsFile(projPath);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "No captions.json" });
    try {
      const doc = JSON.parse(fs.readFileSync(file, "utf-8"));
      res.json({ ...doc, clips: discoverClips(projPath) });
    } catch (err) {
      res.status(500).json({ error: `Invalid captions.json: ${(err as Error).message}` });
    }
  });

  router.put("/:slug/captions", (req, res) => {
    const projPath = resolveProject(req.params.slug);
    if (!projPath) return res.status(404).json({ error: "Project not found" });
    const doc = req.body;
    // Minimal shape guard so a bad PUT can't corrupt the render source.
    if (!doc || !Array.isArray(doc.shots) || typeof doc.fps !== "number") {
      return res.status(400).json({ error: "Body must be a caption doc with {fps, shots[]}" });
    }
    const file = captionsFile(projPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
    notifyChange(file);
    res.json({ ok: true });
  });

  router.post("/:slug/captions/render", (req, res) => {
    const projPath = resolveProject(req.params.slug);
    if (!projPath) return res.status(404).json({ error: "Project not found" });
    const toolDir = resolveToolDir(projPath);
    if (!toolDir) return res.status(404).json({ error: "No tooling/captions render project found" });

    // `npm run render` runs `prerender` (pull-captions) first, so the just-saved
    // captions.json is synced into the bundle automatically.
    const child = spawn("npm", ["run", "render"], { cwd: toolDir });
    let log = "";
    child.stdout.on("data", (d) => (log += d.toString()));
    child.stderr.on("data", (d) => (log += d.toString()));
    child.on("error", (err) => res.status(500).json({ error: err.message }));
    child.on("close", (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: `Render failed (exit ${code})`, log: log.slice(-4000) });
      }
      const out = path.join(toolDir, "out", "ep01-drift-captioned.mp4");
      res.json({ ok: true, output: out, exists: fs.existsSync(out) });
    });
  });

  return router;
}
