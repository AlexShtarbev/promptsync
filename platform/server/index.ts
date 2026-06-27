import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { projectRoutes } from "./routes/projects.js";
import { shotRoutes } from "./routes/shots.js";
import { characterRoutes } from "./routes/characters.js";
import { extensionRoutes } from "./routes/extension.js";
import { assetRoutes } from "./routes/assets.js";
import { statusRoutes } from "./routes/status.js";
import { exportRoutes } from "./routes/export.js";
import { driveSyncRoutes } from "./routes/drive-sync.js";
import { documentRoutes } from "./routes/documents.js";
import { debugRoutes } from "./routes/debug.js";
import { validateRoutes } from "./routes/validate.js";
import { emitRoutes } from "./routes/emit.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { activeRoutes } from "./routes/active.js";
import { monitorRoutes } from "./routes/monitor.js";
import { captionRoutes } from "./routes/captions.js";
import { initDrive } from "./services/drive-sync.js";
import { startWatcher } from "./services/file-watcher.js";
import { initActiveProject } from "./services/active-project.js";
import { discoverWorkspace } from "./services/markdown-parser.js";
import { WsHub } from "./services/ws-hub.js";
import { startMonitor } from "./services/monitor.js";

const PORT = parseInt(process.env.PORT ?? "3456", 10);
// PROJECTS_DIR may list several roots separated by the platform path delimiter
// (":" on POSIX, ";" on Windows). Each entry is resolved relative to the cwd so
// both absolute paths and repo-relative paths (e.g. "../../crawler") work.
const PROJECTS_DIRS = (process.env.PROJECTS_DIR ?? path.resolve(process.cwd(), ".."))
  .split(path.delimiter)
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => path.resolve(process.cwd(), p));

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
// The hub owns the WebSocket lifecycle: ping/pong heartbeat reaps dead/half-open
// sockets, and broadcast() drops back-pressured peers instead of buffering forever.
const hub = new WsHub(wss);

// Self-monitoring: sample resource usage into a rolling ring + a JSON file on the
// first projects root, so a post-OOM/post-lockup inspection has the last data.
const monitor = startMonitor({
  filePath: path.join(PROJECTS_DIRS[0], ".promptsync-monitor.json"),
  wsStats: () => hub.stats(),
  warn: { rssMB: 1024, eventLoopLagMs: 250, clients: 50 },
});

app.use("/api/projects", projectRoutes(PROJECTS_DIRS));
app.use("/api/projects", shotRoutes(PROJECTS_DIRS));
app.use("/api/projects", characterRoutes(PROJECTS_DIRS));
app.use("/api/extension", extensionRoutes(PROJECTS_DIRS));
app.use("/api/assets", assetRoutes(PROJECTS_DIRS));
app.use("/api/projects", statusRoutes(PROJECTS_DIRS));
app.use("/api/projects", exportRoutes(PROJECTS_DIRS));
app.use("/api/drive", driveSyncRoutes(PROJECTS_DIRS));
app.use("/api/projects", documentRoutes(PROJECTS_DIRS));
app.use("/api/debug", debugRoutes(PROJECTS_DIRS));
app.use("/api/projects", validateRoutes(PROJECTS_DIRS));
app.use("/api", emitRoutes(PROJECTS_DIRS));
app.use("/api/workspace", workspaceRoutes(PROJECTS_DIRS));
app.use("/api/active", activeRoutes());
app.use("/api/monitor", monitorRoutes(monitor));
app.use("/api/projects", captionRoutes(PROJECTS_DIRS));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "..", "dist", "client");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

initDrive();
initActiveProject(hub);

const workspace = discoverWorkspace(PROJECTS_DIRS);
const allProjects = [...workspace.projects, ...workspace.series.flatMap((s) => s.episodes)];
if (allProjects.length > 0 || workspace.series.length > 0) {
  // Watch episode/project dirs plus each series root (covers the global library + bible).
  const watchDirs = [...allProjects.map((p) => p.path), ...workspace.series.map((s) => s.path)];
  startWatcher(watchDirs, hub);
  const labels = [
    ...workspace.series.map((s) => `${s.slug} [series: ${s.episodes.length} ep]`),
    ...workspace.projects.map((p) => p.slug),
  ];
  console.log(`Watching ${watchDirs.length} dir(s): ${labels.join(", ")}`);
} else {
  console.log(`No projects found in ${PROJECTS_DIRS.join(", ")}`);
}

server.listen(PORT, () => {
  console.log(`PromptSync server running at http://localhost:${PORT}`);
  console.log(`Projects directories: ${PROJECTS_DIRS.join(", ")}`);
});
