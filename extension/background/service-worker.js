const API = "http://localhost:3456/api";
const WS_URL = "ws://localhost:3456/ws";

let cachedIndex = null;
let currentProject = null;
let currentShotIdx = 0;

async function loadIndex(project) {
  const res = await fetch(`${API}/extension/index?project=${project}`);
  if (!res.ok) throw new Error("Failed to load index");
  cachedIndex = await res.json();
  currentProject = project;
  currentShotIdx = 0;
  return cachedIndex;
}

// Tell any open panel/popup that the active project changed so they re-render.
function notifyActiveChanged(slug) {
  chrome.runtime.sendMessage({ type: "active-changed", slug }).catch(() => {});
}

// Adopt a project as the active one (loads its index, remembers it, notifies UIs).
async function adoptProject(slug) {
  if (!slug) return;
  if (slug === currentProject && cachedIndex) return;
  await loadIndex(slug);
  chrome.storage.local.set({ activeProject: slug });
  notifyActiveChanged(slug);
}

// Reconcile local state with the server's active project (set by the web UI).
async function syncActiveFromServer() {
  try {
    const res = await fetch(`${API}/active`);
    if (!res.ok) return;
    const { slug } = await res.json();
    if (slug && slug !== currentProject) await adoptProject(slug);
  } catch {
    // server offline — keep whatever we have
  }
}

// Persist a new active project to the server so the web UI mirrors the extension too.
async function pushActiveToServer(slug) {
  try {
    await fetch(`${API}/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
  } catch {
    // server offline — non-fatal
  }
}

// Live link to the platform: follow the UI's active project, refresh on file changes.
let ws = null;
function connectWs() {
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    return;
  }
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === "active-changed") {
      if (msg.slug) adoptProject(msg.slug).catch(() => {});
    } else if (msg.type === "files-changed" && currentProject) {
      loadIndex(currentProject).then(() => notifyActiveChanged(currentProject)).catch(() => {});
    }
  };
  ws.onclose = () => { ws = null; setTimeout(connectWs, 3000); };
  ws.onerror = () => { try { ws.close(); } catch {} };
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

// Keyboard shortcut: inject next shot
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "inject-next") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;

  const site = detectSite(tab.url);
  if (!site) return;

  // Always target the project the web UI currently has open.
  await syncActiveFromServer();

  if (!cachedIndex || !currentProject) {
    const stored = await chrome.storage.local.get("activeProject");
    if (!stored.activeProject) return;
    await loadIndex(stored.activeProject);
  }

  if (!cachedIndex?.shots?.length) return;

  const shot = cachedIndex.shots[currentShotIdx];
  if (!shot) return;

  chrome.tabs.sendMessage(tab.id, {
    type: "inject-prompt",
    project: currentProject,
    code: shot.code,
    site,
  });

  currentShotIdx = (currentShotIdx + 1) % cachedIndex.shots.length;
});

// Open side panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Messages from panel
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "set-project") {
    loadIndex(msg.project)
      .then((idx) => {
        chrome.storage.local.set({ activeProject: msg.project });
        pushActiveToServer(msg.project); // keep the web UI's active project in sync
        sendResponse({ ok: true, shots: idx.shots, characters: idx.characters || [], aspect_ratio: idx.aspect_ratio, default_resolution: idx.default_resolution, elementMap: idx.elementMap || {} });
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "get-active") {
    syncActiveFromServer().finally(() => sendResponse({ slug: currentProject }));
    return true;
  }

  if (msg.type === "get-state") {
    sendResponse({
      project: currentProject,
      shotIdx: currentShotIdx,
      shots: cachedIndex?.shots ?? [],
    });
    return true;
  }

  if (msg.type === "set-shot-index") {
    currentShotIdx = msg.index;
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "inject-shot") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id || !tab.url) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      const site = detectSite(tab.url);
      if (!site) {
        sendResponse({ ok: false, error: "Not on a supported site" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, {
        type: "inject-prompt",
        project: msg.project,
        code: msg.code,
        site,
      }, sendResponse);
    });
    return true;
  }
});

// Startup: follow the web UI's active project, falling back to the last-used one,
// then open a live link to stay in sync.
syncActiveFromServer().then(() => {
  if (!currentProject) {
    chrome.storage.local.get("activeProject", (data) => {
      if (data.activeProject) loadIndex(data.activeProject).catch(() => {});
    });
  }
});
connectWs();
