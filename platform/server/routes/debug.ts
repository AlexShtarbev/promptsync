import { Router } from "express";
import fs from "fs";
import path from "path";

export function debugRoutes(projectsDir: string | string[]) {
  const router = Router();
  // Captures are a single global file; anchor it to the first configured root.
  const captureRoot = Array.isArray(projectsDir) ? projectsDir[0] : projectsDir;
  const captureFile = path.join(captureRoot, ".promptsync-captures.json");

  function readCaptures(): any[] {
    try {
      return JSON.parse(fs.readFileSync(captureFile, "utf-8"));
    } catch {
      return [];
    }
  }

  router.post("/generations", (req, res) => {
    const captures = readCaptures();
    captures.push(req.body);
    if (captures.length > 50) captures.splice(0, captures.length - 50);
    fs.writeFileSync(captureFile, JSON.stringify(captures, null, 2));
    console.log(`[debug] Generation captured → ${captureFile} (${captures.length} total)`);
    res.json({ ok: true, count: captures.length });
  });

  router.get("/generations", (_req, res) => {
    res.json(readCaptures());
  });

  router.get("/generations/latest", (_req, res) => {
    const captures = readCaptures();
    res.json(captures[captures.length - 1] ?? null);
  });

  router.delete("/generations", (_req, res) => {
    try { fs.unlinkSync(captureFile); } catch {}
    res.json({ ok: true });
  });

  return router;
}
