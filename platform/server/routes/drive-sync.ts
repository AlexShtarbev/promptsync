import { Router } from "express";
import path from "path";
import fs from "fs";
import { discoverProjects, loadProject } from "../services/markdown-parser.js";
import {
  getDrive,
  isDriveEnabled,
  getAuthUrl,
  exchangeCodeForTokens,
  ensureFolder,
  uploadFile,
} from "../services/drive-sync.js";

export function driveSyncRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    // File-based check only — must not trigger the googleapis import.
    res.json({ enabled: isDriveEnabled() });
  });

  router.get("/auth-url", async (_req, res) => {
    try {
      res.json({ url: await getAuthUrl() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  router.get("/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing code");

    try {
      await exchangeCodeForTokens(code);
      res.send("<h2>Google Drive connected! You can close this tab.</h2>");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).send(`Failed to connect Google Drive: ${message}`);
    }
  });

  router.post("/sync/:slug", async (req, res) => {
    const drive = await getDrive();
    if (!drive) return res.status(400).json({ error: "Drive not configured" });

    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const index = loadProject(proj.path, proj.globalElementDirs, proj.seriesDefaults);
    if (!index) return res.status(500).json({ error: "Failed to load project" });

    try {
      const rootFolderId = index.config.drive_folder_id ?? undefined;
      const projectFolder = await ensureFolder(drive, index.config.name, rootFolderId);
      const imagesFolder = await ensureFolder(drive, "images", projectFolder);

      const images: { code: string; driveId: string; link: string }[] = [];
      const videos: { code: string; driveId: string; link: string }[] = [];
      // Created lazily so a project with no rendered videos doesn't get an empty folder.
      let videosFolder: string | null = null;

      for (const shot of index.shots) {
        if (shot.imagePath) {
          const shotDir = path.join(proj.path, "storyboard", "shots", shot.code);
          const exts = [".png", ".jpg", ".jpeg", ".webp"];
          let imgFile: string | null = null;
          for (const ext of exts) {
            const p = path.join(shotDir, `image${ext}`);
            if (fs.existsSync(p)) { imgFile = p; break; }
          }
          if (imgFile) {
            const ext = path.extname(imgFile);
            const { id, webViewLink } = await uploadFile(drive, imgFile, imagesFolder, `${shot.code}${ext}`);
            images.push({ code: shot.code, driveId: id, link: webViewLink });
          }
        }

        // Rendered videos live in storyboard/videos/{code}.{mp4,webm,mov};
        // the parser resolves the path into shot.videoPath.
        if (shot.videoPath && fs.existsSync(shot.videoPath)) {
          if (!videosFolder) videosFolder = await ensureFolder(drive, "videos", projectFolder);
          const ext = path.extname(shot.videoPath);
          const { id, webViewLink } = await uploadFile(drive, shot.videoPath, videosFolder, `${shot.code}${ext}`);
          videos.push({ code: shot.code, driveId: id, link: webViewLink });
        }
      }

      res.json({
        ok: true,
        synced: images.length + videos.length,
        syncedImages: images.length,
        syncedVideos: videos.length,
        images,
        videos,
        // Back-compat alias for older clients that read `results`.
        results: images,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
