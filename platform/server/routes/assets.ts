import { Router } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import { discoverProjects, discoverWorkspace } from "../services/markdown-parser.js";
import { notifyChange } from "../services/file-watcher.js";

// Sniff container magic bytes so the image endpoints can refuse video payloads. A
// misrouted video (e.g. a shot's video generation sent here) would otherwise delete the
// storyboard still and write unrenderable bytes in its place — the shot "disappears".
function looksLikeVideo(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  // ISO Base Media Format (mp4/mov/m4v): a "ftyp"/"moov"/... box at offset 4.
  const box = buf.toString("latin1", 4, 8);
  if (["ftyp", "moov", "mdat", "free", "skip", "wide"].includes(box)) return true;
  // Matroska / WebM: EBML header.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  // RIFF AVI (WEBP is also RIFF, so check the form type and exclude it).
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "AVI ") return true;
  return false;
}

export function assetRoutes(projectsDir: string | string[]): Router {
  const router = Router();

  function resolveShotDir(slug: string, code: string): string | null {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return null;
    const dir = path.join(proj.path, "storyboard", "shots", code);
    return fs.existsSync(dir) ? dir : null;
  }

  router.get("/:slug/shots/:code/image", (req, res) => {
    res.set("Cache-Control", "no-cache");
    const dir = resolveShotDir(req.params.slug, req.params.code);
    if (!dir) return res.status(404).json({ error: "Shot not found" });

    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    for (const ext of exts) {
      const p = path.join(dir, `image${ext}`);
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (exts.some((ext) => f.toLowerCase().endsWith(ext))) {
        return res.sendFile(path.join(dir, f));
      }
    }
    res.status(404).json({ error: "No image" });
  });

  router.post("/:slug/shots/:code/image/upload",
    express.raw({ type: ["image/*", "application/octet-stream"], limit: "50mb" }),
    (req, res) => {
      const dir = resolveShotDir(req.params.slug, req.params.code);
      if (!dir) return res.status(404).json({ error: "Shot not found" });

      if (looksLikeVideo(req.body as Buffer)) {
        return res.status(415).json({ error: "Refusing to save video bytes as a shot image — use the /video/upload endpoint" });
      }

      const ct = req.headers["content-type"] ?? "image/png";
      let ext = ".png";
      if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";

      for (const old of [".png", ".jpg", ".jpeg", ".webp"]) {
        if (old === ext) continue;
        const p = path.join(dir, `image${old}`);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }

      const destPath = path.join(dir, `image${ext}`);
      fs.writeFileSync(destPath, req.body as Buffer);

      const openartRef = req.headers["x-openart-ref"] as string | undefined;
      const openartResourceId = req.headers["x-openart-resource-id"] as string | undefined;
      if (openartRef) {
        const refData: Record<string, string> = { url: openartRef };
        if (openartResourceId) refData.resourceId = openartResourceId;
        fs.writeFileSync(path.join(dir, "openart-ref.json"), JSON.stringify(refData));
      }

      notifyChange(destPath);
      res.json({ ok: true, path: destPath, filename: `image${ext}` });
    }
  );

  router.post("/:slug/shots/:code/image", async (req, res) => {
    const dir = resolveShotDir(req.params.slug, req.params.code);
    if (!dir) return res.status(404).json({ error: "Shot not found" });

    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url required in body" });
    }

    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        return res.status(502).json({ error: `Failed to fetch image: ${response.status}` });
      }

      const ct = response.headers.get("content-type") ?? "";
      if (ct.startsWith("video/")) {
        return res.status(415).json({ error: "Refusing to save a video as a shot image — use the /video/upload endpoint" });
      }
      let ext = ".png";
      if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";

      for (const old of [".png", ".jpg", ".jpeg", ".webp"]) {
        if (old === ext) continue;
        const op = path.join(dir, `image${old}`);
        if (fs.existsSync(op)) fs.unlinkSync(op);
      }

      const destPath = path.join(dir, `image${ext}`);

      const fileStream = fs.createWriteStream(destPath);
      // fetch() returns a web ReadableStream; pipeline() needs a Node stream.
      // Cast bridges the DOM vs stream/web ReadableStream type mismatch.
      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeWebReadableStream<Uint8Array>),
        fileStream
      );
      notifyChange(destPath);
      res.json({ ok: true, path: destPath, filename: `image${ext}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.delete("/:slug/shots/:code/image", (req, res) => {
    const dir = resolveShotDir(req.params.slug, req.params.code);
    if (!dir) return res.status(404).json({ error: "Shot not found" });

    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    let deleted = false;
    for (const ext of exts) {
      const p = path.join(dir, `image${ext}`);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        deleted = true;
        notifyChange(p);
      }
    }
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (exts.some((ext) => f.toLowerCase().endsWith(ext))) {
        const p = path.join(dir, f);
        fs.unlinkSync(p);
        deleted = true;
        notifyChange(p);
      }
    }
    if (!deleted) return res.status(404).json({ error: "No image to delete" });
    res.json({ ok: true });
  });

  router.delete("/:slug/shots/images/all", (req, res) => {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === req.params.slug);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const shotsDir = path.join(proj.path, "storyboard", "shots");
    if (!fs.existsSync(shotsDir)) return res.json({ ok: true, deleted: 0 });

    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    let deleted = 0;
    const shotDirs = fs.readdirSync(shotsDir).filter((f) =>
      fs.statSync(path.join(shotsDir, f)).isDirectory()
    );
    for (const dir of shotDirs) {
      const dirPath = path.join(shotsDir, dir);
      const files = fs.readdirSync(dirPath);
      for (const f of files) {
        if (f.startsWith("image") && exts.some((ext) => f.toLowerCase().endsWith(ext))) {
          const p = path.join(dirPath, f);
          fs.unlinkSync(p);
          deleted++;
          notifyChange(p);
        }
      }
    }
    res.json({ ok: true, deleted });
  });

  router.get("/:slug/shots/:code/start-frame", (req, res) => {
    res.set("Cache-Control", "no-cache");
    const dir = resolveShotDir(req.params.slug, req.params.code);
    if (!dir) return res.status(404).json({ error: "Shot not found" });

    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    for (const ext of exts) {
      const p = path.join(dir, `start-frame${ext}`);
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    res.status(404).json({ error: "No start frame" });
  });

  router.post("/:slug/shots/:code/start-frame/upload",
    express.raw({ type: ["image/*", "application/octet-stream"], limit: "50mb" }),
    (req, res) => {
      const dir = resolveShotDir(req.params.slug, req.params.code);
      if (!dir) return res.status(404).json({ error: "Shot not found" });

      const ct = req.headers["content-type"] ?? "image/png";
      let ext = ".png";
      if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";

      const destPath = path.join(dir, `start-frame${ext}`);
      fs.writeFileSync(destPath, req.body as Buffer);
      notifyChange(destPath);
      res.json({ ok: true, path: destPath, filename: `start-frame${ext}` });
    }
  );

  // Element dirs for a slug. Local dirs first (so a local override wins over a global
  // of the same filename), then the owning series' global library. Also resolves a
  // series slug directly (global library only) for the always-visible Global tab.
  function resolveElementDirs(slug: string): string[] {
    const ws = discoverWorkspace(projectsDir);
    const proj = [...ws.projects, ...ws.series.flatMap((s) => s.episodes)].find((p) => p.slug === slug);
    if (proj) {
      const local = ["characters", "environments", "props"].map((d) =>
        path.join(proj.path, "storyboard", d)
      );
      return [...local, ...proj.globalElementDirs].filter((d) => fs.existsSync(d));
    }
    const series = ws.series.find((s) => s.slug === slug);
    if (series) return series.globalElementDirs.filter((d) => fs.existsSync(d));
    return [];
  }

  function resolveElementFile(slug: string, base: string, exts: string[]): string | null {
    for (const dir of resolveElementDirs(slug)) {
      for (const ext of exts) {
        const p = path.join(dir, `${base}${ext}`);
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  function resolveElementDirForWrite(slug: string, charSlug: string): string | null {
    const dirs = resolveElementDirs(slug);
    for (const dir of dirs) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const f of files) {
        if (f.replace(/\.md$/, "") === charSlug || path.basename(f, ".md").replace(/\s+/g, "-").toLowerCase() === charSlug) {
          return dir;
        }
      }
    }
    return dirs[0] ?? null;
  }

  router.get("/:slug/characters/:charSlug/:viewSlug/image", (req, res) => {
    res.set("Cache-Control", "no-cache");
    const base = `${req.params.charSlug}-${req.params.viewSlug}`;
    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    const found = resolveElementFile(req.params.slug, base, exts);
    if (found) return res.sendFile(found);
    res.status(404).json({ error: "No image" });
  });

  router.post("/:slug/characters/:charSlug/:viewSlug/image/upload",
    express.raw({ type: ["image/*", "application/octet-stream"], limit: "50mb" }),
    (req, res) => {
      const dir = resolveElementDirForWrite(req.params.slug, req.params.charSlug);
      if (!dir) return res.status(404).json({ error: "Not found" });

      if (looksLikeVideo(req.body as Buffer)) {
        return res.status(415).json({ error: "Refusing to save video bytes as a character image" });
      }

      const ct = req.headers["content-type"] ?? "image/png";
      let ext = ".png";
      if (ct.includes("webp")) ext = ".webp";
      else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";

      const base = `${req.params.charSlug}-${req.params.viewSlug}`;
      const destPath = path.join(dir, `${base}${ext}`);
      fs.writeFileSync(destPath, req.body as Buffer);

      const openartRef = req.headers["x-openart-ref"] as string | undefined;
      const openartResourceId = req.headers["x-openart-resource-id"] as string | undefined;
      if (openartRef) {
        const refData: Record<string, string> = { url: openartRef };
        if (openartResourceId) refData.resourceId = openartResourceId;
        fs.writeFileSync(path.join(dir, `${base}-openart-ref.json`), JSON.stringify(refData));
      }

      notifyChange(destPath);
      res.json({ ok: true, path: destPath, filename: `${base}${ext}` });
    }
  );

  router.delete("/:slug/characters/:charSlug/:viewSlug/image", (req, res) => {
    const base = `${req.params.charSlug}-${req.params.viewSlug}`;
    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    let deleted = false;
    for (const dir of resolveElementDirs(req.params.slug)) {
      for (const ext of exts) {
        const p = path.join(dir, `${base}${ext}`);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          deleted = true;
          notifyChange(p);
        }
      }
    }
    if (!deleted) return res.status(404).json({ error: "No image to delete" });
    res.json({ ok: true });
  });

  router.patch("/:slug/characters/:charSlug/:viewSlug/openart-ref",
    express.json(),
    (req, res) => {
      const dir = resolveElementDirForWrite(req.params.slug, req.params.charSlug);
      if (!dir) return res.status(404).json({ error: "Not found" });

      const base = `${req.params.charSlug}-${req.params.viewSlug}`;
      const refPath = path.join(dir, `${base}-openart-ref.json`);

      let existing: Record<string, string> = {};
      try { existing = JSON.parse(fs.readFileSync(refPath, "utf-8")); } catch {}

      const { resourceId, url } = req.body;
      if (resourceId) existing.resourceId = resourceId;
      if (url) existing.url = url;

      fs.writeFileSync(refPath, JSON.stringify(existing));
      res.json({ ok: true });
    }
  );

  function resolveVideosDir(slug: string): string | null {
    const projects = discoverProjects(projectsDir);
    const proj = projects.find((p) => p.slug === slug);
    if (!proj) return null;
    const dir = path.join(proj.path, "storyboard", "videos");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  router.post("/:slug/shots/:code/video/upload",
    express.raw({ type: ["video/*", "application/octet-stream"], limit: "500mb" }),
    (req, res) => {
      const videosDir = resolveVideosDir(req.params.slug);
      if (!videosDir) return res.status(404).json({ error: "Project not found" });

      const ct = req.headers["content-type"] ?? "video/mp4";
      let ext = ".mp4";
      if (ct.includes("webm")) ext = ".webm";
      else if (ct.includes("quicktime") || ct.includes("mov")) ext = ".mov";

      const destPath = path.join(videosDir, `${req.params.code}${ext}`);
      fs.writeFileSync(destPath, req.body as Buffer);
      notifyChange(destPath);
      res.json({ ok: true, path: destPath, filename: `${req.params.code}${ext}` });
    }
  );

  router.get("/:slug/shots/:code/video", (req, res) => {
    res.set("Cache-Control", "no-cache");
    const videosDir = resolveVideosDir(req.params.slug);
    if (!videosDir) return res.status(404).json({ error: "Project not found" });

    const exts = [".mp4", ".webm", ".mov"];
    for (const ext of exts) {
      const p = path.join(videosDir, `${req.params.code}${ext}`);
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    res.status(404).json({ error: "No video" });
  });

  router.get("/:slug/videos", (req, res) => {
    const videosDir = resolveVideosDir(req.params.slug);
    if (!videosDir) return res.status(404).json({ error: "Project not found" });

    const files = fs.readdirSync(videosDir).filter((f) =>
      [".mp4", ".webm", ".mov"].some((ext) => f.toLowerCase().endsWith(ext))
    );
    res.json(files);
  });

  router.get("/:slug/videos/dir", (req, res) => {
    const videosDir = resolveVideosDir(req.params.slug);
    if (!videosDir) return res.status(404).json({ error: "Project not found" });
    res.json({ path: videosDir });
  });

  return router;
}
