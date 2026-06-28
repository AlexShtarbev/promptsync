// PromptSync service worker — reads project data DIRECTLY from Google Drive (no localhost).
// The read pipeline (Drive snapshot → parser → ExtensionIndex) is the browser bundle built
// from platform/server/services (scripts/build-drive.mjs). Auth is the OAuth device flow;
// tokens live in chrome.storage. The panel drives a one-time "Connect Drive" (client creds
// + device code); content scripts/panel then ask the SW for index/shot/character data.
import {
  driveRestApi, buildSnapshot, setFileStore,
  loadProject, loadSingleShot, loadSingleCharacter, discoverProjects, buildExtensionIndex,
  requestDeviceCode, pollForToken, refreshAccessToken,
} from "../vendor/promptsync-drive.mjs";

const DRIVE_ROOT = "promptsync";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/drive"; // read + write (Writer 3)
const FOLDER_MIME = "application/vnd.google-apps.folder";

let cachedIndex = null;   // ExtensionIndex of the loaded project
let cachedProj = null;    // discovered project { slug, path, globalElementDirs, seriesDefaults }
let currentProject = null;
let currentShotIdx = 0;

// ---------------- auth (device flow; tokens in chrome.storage) ----------------
async function getCfg() {
  const { driveConfig } = await chrome.storage.local.get("driveConfig");
  return driveConfig || null; // { clientId, clientSecret, scope? }
}
async function getTokens() {
  const { driveTokens } = await chrome.storage.local.get("driveTokens");
  return driveTokens || null;
}
async function setTokens(t) { await chrome.storage.local.set({ driveTokens: t }); }

async function getToken() {
  const cfg = await getCfg();
  if (!cfg?.clientId) throw new Error("Drive not connected — open the panel and Connect Drive.");
  const t = await getTokens();
  const now = Date.now();
  if (t?.access_token && t.expiry && now < t.expiry - 60000) return t.access_token;
  if (t?.refresh_token) {
    const r = await refreshAccessToken(cfg.clientId, cfg.clientSecret, t.refresh_token);
    const merged = { refresh_token: t.refresh_token, ...r, expiry: now + (r.expires_in || 3600) * 1000 };
    await setTokens(merged);
    return merged.access_token;
  }
  throw new Error("Drive not authorized — open the panel and Connect Drive.");
}

// Start the device flow; returns the user code/URL for the panel to show, then polls in bg.
async function authStart() {
  const cfg = await getCfg();
  if (!cfg?.clientId) throw new Error("Set Client ID and Secret first.");
  const dc = await requestDeviceCode(cfg.clientId, cfg.scope || DEFAULT_SCOPE);
  pollForToken(cfg.clientId, cfg.clientSecret, dc)
    .then((tok) => setTokens({ ...tok, expiry: Date.now() + (tok.expires_in || 3600) * 1000 }))
    .then(() => chrome.runtime.sendMessage({ type: "drive-auth-done" }).catch(() => {}))
    .catch((e) => chrome.runtime.sendMessage({ type: "drive-auth-error", error: e.message }).catch(() => {}));
  return { user_code: dc.user_code, verification_url: dc.verification_url, expires_in: dc.expires_in };
}

// ---------------- Drive helpers ----------------
function api() { return driveRestApi(getToken); }

async function findChildFolder(parentId, name) {
  const kids = await api().listFolder(parentId);
  return kids.find((c) => c.name === name && c.mimeType === FOLDER_MIME) || null;
}
async function rootFolderId() {
  const f = await findChildFolder("root", DRIVE_ROOT);
  if (!f) throw new Error(`Drive folder '${DRIVE_ROOT}' not found (push a project first).`);
  return f.id;
}
// slug -> how to load it: which top folder to snapshot, its mount, and the project path
// inside that snapshot. A series top folder (has an `episodes/` child) contributes one
// route per episode (snapshotting the whole series so shared globals resolve); a standalone
// project contributes itself.
let projectRoutes = {};

async function buildRoutes() {
  const rid = await rootFolderId();
  const tops = (await api().listFolder(rid)).filter((c) => c.mimeType === FOLDER_MIME);
  const routes = {};
  for (const top of tops) {
    const kids = await api().listFolder(top.id);
    const epDir = kids.find((k) => k.name === "episodes" && k.mimeType === FOLDER_MIME);
    if (epDir) {
      const eps = (await api().listFolder(epDir.id)).filter((k) => k.mimeType === FOLDER_MIME);
      for (const ep of eps) {
        routes[ep.name] = { snapFolderId: top.id, mount: `/drive/${top.name}`, projPath: `/drive/${top.name}/episodes/${ep.name}`, series: top.name };
      }
    } else {
      routes[top.name] = { snapFolderId: top.id, mount: `/drive/${top.name}`, projPath: `/drive/${top.name}` };
    }
  }
  projectRoutes = routes;
  return routes;
}

async function listProjects() {
  const routes = await buildRoutes();
  return Object.keys(routes).map((slug) => ({ slug, name: routes[slug].series ? `${routes[slug].series} / ${slug}` : slug }));
}

// ---------------- Drive WRITE (Writer 3: extension commits its products) ----------------
const authHdr = (token) => ({ Authorization: `Bearer ${token}` });

async function findInFolder(token, parentId, name, folderOnly) {
  let q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  if (folderOnly) q += ` and mimeType='${FOLDER_MIME}'`;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, { headers: authHdr(token) });
  if (!r.ok) throw new Error(`Drive list ${r.status}`);
  return (await r.json()).files?.[0]?.id || null;
}

async function ensureFolderRest(token, parentId, name) {
  const found = await findInFolder(token, parentId, name, true);
  if (found) return found;
  const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { ...authHdr(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!r.ok) throw new Error(`Drive mkdir ${r.status}`);
  return (await r.json()).id;
}

// Upsert a binary asset to promptsync/<project>/<destPath>. base64 = the file bytes.
async function driveUpload(project, destPath, mimeType, base64) {
  const token = await getToken();
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  let parent = await ensureFolderRest(token, "root", DRIVE_ROOT);
  parent = await ensureFolderRest(token, parent, project);
  const segs = destPath.split("/").filter(Boolean);
  const fileName = segs.pop();
  for (const s of segs) parent = await ensureFolderRest(token, parent, s);

  const existing = await findInFolder(token, parent, fileName, false);
  if (existing) {
    const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media&fields=id`, {
      method: "PATCH", headers: { ...authHdr(token), "Content-Type": mimeType || "application/octet-stream" }, body: bytes,
    });
    if (!r.ok) throw new Error(`Drive update ${r.status}`);
    return { ok: true, id: existing, action: "updated" };
  }
  const boundary = "psb" + Math.random().toString(16).slice(2);
  const meta = JSON.stringify({ name: fileName, parents: [parent] });
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`;
  const body = new Blob([pre, bytes, `\r\n--${boundary}--`]);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", headers: { ...authHdr(token), "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
  if (!r.ok) throw new Error(`Drive upload ${r.status}`);
  return { ok: true, id: (await r.json()).id, action: "created" };
}

// Snapshot a project's folder from Drive (the whole series folder for an episode, so shared
// globals resolve) and parse it into an ExtensionIndex.
async function loadIndex(project) {
  if (!projectRoutes[project]) await buildRoutes();
  const route = projectRoutes[project];
  if (!route) throw new Error(`Project '${project}' not found in Drive.`);
  const { store } = await buildSnapshot(api(), route.snapFolderId, route.mount);
  setFileStore(store);
  const found = discoverProjects(route.mount);
  cachedProj = found.find((p) => p.path === route.projPath)
    || found.find((p) => p.path.endsWith("/" + project))
    || found[0];
  if (!cachedProj) throw new Error(`Failed to locate project '${project}' in snapshot.`);
  const index = loadProject(cachedProj.path, cachedProj.globalElementDirs, cachedProj.seriesDefaults);
  if (!index) throw new Error(`Failed to parse project '${project}'.`);
  cachedIndex = buildExtensionIndex(index, project);
  currentProject = project;
  currentShotIdx = 0;
  return cachedIndex;
}

async function ensureLoaded(project) {
  if (project && (project !== currentProject || !cachedIndex)) await loadIndex(project);
  if (!cachedIndex) throw new Error("No project loaded.");
}

// Mirror the server /character shaping for content scripts.
function shapeCharacter(char) {
  return {
    name: char.name,
    slug: char.slug,
    element_type: char.meta.element_type,
    element_status: char.meta.element_status,
    kling_description: char.sections.kling_element_description || "",
    views: char.views.map((v) => ({
      index: v.index, name: v.name, slug: v.slug, prompt: v.prompt,
      has_image: !!v.imagePath, openart_ref: v.openartRef || null,
      openart_resource_id: v.openartResourceId || null,
      aspect_ratio: v.aspect_ratio || null, resolution: v.resolution || null,
      primary: !!v.primary,
    })),
  };
}

function notifyActiveChanged(slug) {
  chrome.runtime.sendMessage({ type: "active-changed", slug }).catch(() => {});
}

function detectSite(url) {
  if (url.includes("midjourney.com")) return "midjourney";
  if (url.includes("openart.ai")) {
    if (url.includes("/animate-video") || url.includes("/create-video")) return "openart-video";
    return "openart-image";
  }
  if (url.includes("labs.google")) return "googleflow";
  return null;
}

// ---------------- keyboard shortcut: inject next shot ----------------
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "inject-next") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;
  const site = detectSite(tab.url);
  if (!site) return;
  try {
    if (!cachedIndex || !currentProject) {
      const { activeProject } = await chrome.storage.local.get("activeProject");
      if (!activeProject) return;
      await loadIndex(activeProject);
    }
  } catch { return; }
  if (!cachedIndex?.shots?.length) return;
  const shot = cachedIndex.shots[currentShotIdx];
  if (!shot) return;
  chrome.tabs.sendMessage(tab.id, { type: "inject-prompt", project: currentProject, code: shot.code, site });
  currentShotIdx = (currentShotIdx + 1) % cachedIndex.shots.length;
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ---------------- message router (async) ----------------
const handlers = {
  "drive-get-status": async () => {
    const cfg = await getCfg();
    const t = await getTokens();
    return { configured: !!cfg?.clientId, connected: !!(t?.access_token || t?.refresh_token), root: DRIVE_ROOT };
  },
  "drive-set-config": async (msg) => {
    await chrome.storage.local.set({ driveConfig: { clientId: msg.clientId, clientSecret: msg.clientSecret, scope: msg.scope || DEFAULT_SCOPE } });
    return { ok: true };
  },
  "drive-auth-start": async () => ({ ok: true, ...(await authStart()) }),
  "drive-disconnect": async () => { await chrome.storage.local.remove("driveTokens"); return { ok: true }; },

  "list-projects": async () => ({ ok: true, projects: await listProjects() }),

  "set-project": async (msg) => {
    const idx = await loadIndex(msg.project);
    await chrome.storage.local.set({ activeProject: msg.project });
    notifyActiveChanged(msg.project);
    return { ok: true, shots: idx.shots, characters: idx.characters || [], aspect_ratio: idx.aspect_ratio, default_resolution: idx.default_resolution, elementMap: idx.elementMap || {} };
  },
  "get-active": async () => {
    if (currentProject) return { slug: currentProject };
    const { activeProject } = await chrome.storage.local.get("activeProject");
    return { slug: activeProject || null };
  },
  "get-state": async () => ({ project: currentProject, shotIdx: currentShotIdx, shots: cachedIndex?.shots ?? [] }),
  "set-shot-index": async (msg) => { currentShotIdx = msg.index; return { ok: true }; },

  "get-index": async (msg) => { await ensureLoaded(msg.project); return { ok: true, index: cachedIndex }; },
  "get-shot": async (msg) => {
    await ensureLoaded(msg.project);
    const shot = loadSingleShot(cachedProj.path, msg.code, cachedProj.globalElementDirs, cachedProj.seriesDefaults);
    if (!shot) return { ok: false, error: "Shot not found" };
    return { ok: true, shot };
  },
  "get-character": async (msg) => {
    await ensureLoaded(msg.project);
    const char = loadSingleCharacter(cachedProj.path, msg.char, cachedProj.globalElementDirs);
    if (!char) return { ok: false, error: "Character not found" };
    return { ok: true, character: shapeCharacter(char) };
  },
  "refresh": async () => { if (currentProject) { await loadIndex(currentProject); notifyActiveChanged(currentProject); } return { ok: true }; },

  "drive-upload": async (msg) => driveUpload(msg.project, msg.destPath, msg.mimeType, msg.base64),

  "inject-shot": async (msg) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return { ok: false, error: "No active tab" };
    const site = detectSite(tab.url);
    if (!site) return { ok: false, error: "Not on a supported site" };
    return await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "inject-prompt", project: msg.project, code: msg.code, site }, (r) => resolve(r ?? { ok: true }));
    });
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  h(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true; // async
});

// ---------------- startup: warm the last project if we can ----------------
chrome.storage.local.get("activeProject", ({ activeProject }) => {
  if (activeProject) loadIndex(activeProject).then(() => notifyActiveChanged(activeProject)).catch(() => {});
});
