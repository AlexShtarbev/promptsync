const API = "http://localhost:3456/api";

const projectSelect = document.getElementById("project-select");
const filterRow = document.getElementById("filter-row");
const shotsContainer = document.getElementById("shots");
const statusEl = document.getElementById("status");
const dlBar = document.getElementById("dl-bar");
const dlShotLabel = document.getElementById("dl-shot-label");
const dlBtn = document.getElementById("dl-btn");

const tabRow = document.getElementById("tab-row");
const shotsPanel = document.getElementById("shots-panel");
const charsPanel = document.getElementById("characters-panel");
const charsContainer = document.getElementById("characters");

const autoGenBtn = document.getElementById("autogen-btn");

let shots = [];
let characters = [];
let currentProject = null;
let projectAspectRatio = "9:16";
let projectDefaultResolution = "1K";
let currentSite = null;
let activeFilter = null;
let activeShot = null;
let activeTab = "shots";
let mediaPollingInterval = null;
let mediaAvailable = false;
let autoGenRunning = false;
let autoGenStopped = false;
let elementMap = {};

async function checkServer() {
  try {
    const res = await fetch(`${API}/projects`);
    if (res.ok) {
      statusEl.textContent = "Live";
      statusEl.className = "status ok";
      return true;
    }
  } catch {}
  statusEl.textContent = "Offline";
  statusEl.className = "status err";
  return false;
}

async function loadProjects() {
  const online = await checkServer();
  if (!online) {
    shotsContainer.innerHTML = '<div class="empty">Server offline — start PromptSync platform</div>';
    return;
  }

  const res = await fetch(`${API}/projects`);
  const projects = await res.json();

  projectSelect.innerHTML = '<option value="">Select project...</option>';
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.slug;
    opt.textContent = p.name;
    projectSelect.appendChild(opt);
  }
  projectSelect.disabled = false;

  // Prefer the project the web UI currently has open; fall back to last-used.
  let active = null;
  try { active = (await (await fetch(`${API}/active`)).json()).slug; } catch {}
  if (!active) {
    const stored = await chrome.storage.local.get("activeProject");
    active = stored.activeProject;
  }
  if (active && projects.some((p) => p.slug === active)) {
    projectSelect.value = active;
    await loadShots(active);
  }
}

// Live-follow the web UI: if the active project changes while the panel is open, reflect it.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "active-changed" && msg.slug && msg.slug !== projectSelect.value) {
    projectSelect.value = msg.slug;
    loadShots(msg.slug);
  }
});

async function loadShots(project) {
  currentProject = project;
  chrome.storage.local.set({ activeProject: project });

  chrome.runtime.sendMessage({ type: "set-project", project }, (resp) => {
    if (resp?.ok) {
      shots = resp.shots;
      characters = resp.characters || [];
      projectAspectRatio = resp.aspect_ratio || "9:16";
      projectDefaultResolution = resp.default_resolution || "1K";
      elementMap = resp.elementMap || {};
      tabRow.style.display = "";
      document.getElementById("action-row").style.display = "";
      dlBar.style.display = "";
      updateTabCounts();
      buildFilters();
      renderShots();
      renderCharacters();
      syncCharResourceIds();
    } else {
      shotsContainer.innerHTML = '<div class="empty">Failed to load shots</div>';
    }
  });
}

function detectSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.url) return;
    const newSite = detectSiteFromUrl(tab.url);
    if (newSite && newSite !== currentSite) {
      currentSite = newSite;
      promptCache && Object.keys(promptCache).forEach((k) => delete promptCache[k]);
      stopMediaPolling();
      if (newSite === "openart-image" || newSite === "openart-video") startMediaPolling();
      if (shots.length) {
        renderShots();
        renderCharacters();
      }
    } else if (newSite) {
      currentSite = newSite;
      if ((newSite === "openart-image" || newSite === "openart-video") && !mediaPollingInterval) startMediaPolling();
    }
  });
}

function buildFilters() {
  const types = [...new Set(shots.map((s) => s.asset_type).filter(Boolean))];
  filterRow.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "filter-btn active";
  allBtn.textContent = `All (${shots.length})`;
  allBtn.addEventListener("click", () => {
    activeFilter = null;
    setActiveFilterBtn(allBtn);
    renderShots();
  });
  filterRow.appendChild(allBtn);

  for (const type of types) {
    const count = shots.filter((s) => s.asset_type === type).length;
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.textContent = `${type} (${count})`;
    btn.addEventListener("click", () => {
      activeFilter = type;
      setActiveFilterBtn(btn);
      renderShots();
    });
    filterRow.appendChild(btn);
  }
}

function setActiveFilterBtn(activeBtn) {
  filterRow.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

function getPromptLabel() {
  if (currentSite === "midjourney") return "MJ";
  if (currentSite === "openart-video") return "Kling";
  if (currentSite === "openart-image") return "NanoBanana";
  if (currentSite === "seedance") return "Seedance";
  if (currentSite === "googleflow") return "GFlow";
  return "MJ";
}

function renderShots() {
  const filtered = activeFilter
    ? shots.filter((s) => s.asset_type === activeFilter)
    : shots;

  if (!filtered.length) {
    shotsContainer.innerHTML = '<div class="empty">No shots found</div>';
    return;
  }

  shotsContainer.innerHTML = "";

  for (const shot of filtered) {
    const card = document.createElement("div");
    card.className = `shot-card${shot.has_image ? " has-image" : ""}`;
    card.dataset.code = shot.code;

    const statusClass = shot.status ? `status-${shot.status}` : "";

    const thumbHtml = thumbWithOrbit(shot.has_image
      ? `<img class="shot-thumb-ext" data-thumb="${shot.code}" src="${API}/assets/${currentProject}/shots/${shot.code}/image" alt="${shot.code}" />`
      : `<div class="shot-thumb-placeholder" data-thumb="${shot.code}">--</div>`);

    card.innerHTML = `
      <div class="shot-header">
        ${thumbHtml}
        <span class="shot-code" data-code="${shot.code}">${shot.code}</span>
        <button class="btn-info" data-code="${shot.code}" title="Show prompt">i</button>
        <div class="shot-meta">
          <span class="tag ${shot.asset_type || ""}">${shot.asset_type || "—"}</span>
          <span class="tag ${statusClass}">${shot.status || "draft"}</span>
        </div>
        <div class="shot-actions">
          <button class="btn-sm btn-inject" data-code="${shot.code}" title="Inject into page">Inject</button>
          <button class="btn-sm btn-copy" data-code="${shot.code}" title="Copy prompt">Copy</button>
          ${currentSite === "openart-video"
            ? `<button class="btn-sm btn-vid" data-code="${shot.code}" title="Download video as ${shot.code}">Vid</button>`
            : `<button class="btn-sm btn-dl" data-code="${shot.code}" title="Download page image as ${shot.code}">DL</button>`}
          ${currentSite === "openart-image" ? `<button class="btn-sm btn-api" data-code="${shot.code}" title="Dry-run API generate (logs to console)">API</button>` : ""}
          ${currentSite === "googleflow" && shot.asset_type === "kling" ? `<button class="btn-sm btn-sf" data-code="${shot.code}" title="Download start frame for ${shot.code}">SF</button>` : ""}
          ${shot.has_image ? `<button class="btn-del" data-code="${shot.code}" title="Delete image"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/></svg></button>` : ""}
        </div>
      </div>
      ${shot.setting ? `<div class="shot-setting">${truncate(shot.setting, 60)}</div>` : ""}
      <div class="shot-preview">
        <div class="preview-label">${getPromptLabel()} Prompt</div>
        <div class="preview-text" id="preview-${shot.code}">Loading...</div>
      </div>
    `;

    const header = card.querySelector(".shot-header");
    header.style.cursor = "pointer";
    header.addEventListener("click", (e) => {
      if (e.target.closest(".shot-actions") || e.target.closest(".btn-info")) return;
      toggleExpand(card, shot.code);
    });

    // Script tooltip on shot code hover
    const codeEl = card.querySelector(".shot-code");
    codeEl.addEventListener("mouseenter", () => {
      const script = [shot.subject_action, shot.vo_lines].filter(Boolean).join("\n\n");
      showTooltip(codeEl, "Script", script || "No script");
    });
    codeEl.addEventListener("mouseleave", hideTooltip);

    // Prompt tooltip on info icon hover
    const infoBtn = card.querySelector(".btn-info");
    infoBtn.addEventListener("mouseenter", async () => {
      showTooltip(infoBtn, `${getPromptLabel()} Prompt`, "Loading...");
      const prompt = await getPromptCached(shot.code);
      if (tooltipEl) showTooltip(infoBtn, `${getPromptLabel()} Prompt`, prompt || "No prompt");
    });
    infoBtn.addEventListener("mouseleave", hideTooltip);

    card.querySelector(".btn-inject").addEventListener("click", () => injectShot(shot.code));
    card.querySelector(".btn-copy").addEventListener("click", (e) => copyShot(shot.code, e.target));

    const dlBtn = card.querySelector(".btn-dl");
    if (dlBtn) dlBtn.addEventListener("click", (e) => downloadImage(shot.code, e.target));

    const vidBtn = card.querySelector(".btn-vid");
    if (vidBtn) vidBtn.addEventListener("click", (e) => downloadVideo(shot.code, e.target));

    const sfBtn = card.querySelector(".btn-sf");
    if (sfBtn) sfBtn.addEventListener("click", (e) => downloadStartFrame(shot.code, e.target));

    const apiBtn = card.querySelector(".btn-api");
    if (apiBtn) apiBtn.addEventListener("click", (e) => apiDryRun(shot.code, e.target));

    const delBtn = card.querySelector(".btn-del");
    if (delBtn) delBtn.addEventListener("click", (e) => deleteShotImage(shot.code, e.currentTarget));

    shotsContainer.appendChild(card);
  }

  if (currentSite === "openart-image" || currentSite === "openart-video") updateMediaButtonStates();
}

async function toggleExpand(card, code) {
  const wasExpanded = card.classList.contains("expanded");
  card.classList.toggle("expanded");

  if (!wasExpanded) {
    const previewEl = card.querySelector(`#preview-${code}`);
    try {
      const res = await fetch(`${API}/extension/shot?project=${currentProject}&code=${code}`);
      if (!res.ok) {
        previewEl.textContent = "Not found";
        return;
      }
      const shot = await res.json();
      const [previewTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const previewSite = previewTab?.url ? detectSiteFromUrl(previewTab.url) : null;
      if (previewSite && previewSite !== currentSite) {
        currentSite = previewSite;
        renderShots();
      }
      const prompt = getPromptForSite(shot, previewSite || currentSite || "midjourney");
      previewEl.textContent = prompt || "No prompt for current site";
    } catch (err) {
      previewEl.textContent = err.message;
    }
  }
}

function getPromptForSite(shot, site) {
  if (site === "midjourney") return shot.mjPrompt?.body;
  if (site === "openart-video") return shot.klingPrompt?.body ?? shot.seedancePrompt?.body;
  if (site === "openart-image") return shot.nanoBanana?.body ?? shot.mjPrompt?.body;
  if (site === "seedance") return shot.seedancePrompt?.body;
  if (site === "googleflow") {
    if (shot.mjPrompt?.meta?.platform === "googleflow") return shot.mjPrompt.body;
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body;
  }
  return shot.mjPrompt?.body;
}

function getPromptForCurrentSite(shot) {
  return getPromptForSite(shot, currentSite || "midjourney");
}

// --- Feedback helpers ---

function flashBtn(btn, text, color) {
  const orig = btn.textContent;
  const origBg = btn.style.background;
  btn.textContent = text;
  if (color) btn.style.background = color;
  setTimeout(() => { btn.textContent = orig; btn.style.background = origBg; }, 1200);
}

async function getPromptText(code) {
  const res = await fetch(`${API}/extension/shot?project=${currentProject}&code=${code}`);
  if (!res.ok) return null;
  const shot = await res.json();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const site = tab?.url ? detectSiteFromUrl(tab.url) : null;
  if (site && site !== currentSite) {
    currentSite = site;
    renderShots();
  }
  return getPromptForSite(shot, site || currentSite || "midjourney");
}

// --- Inject ---

function setActiveShot(code) {
  activeShot = code;
  chrome.storage.local.set({ activeShot: code });
  dlShotLabel.textContent = code;
  dlBar.style.display = "";
  dlBtn.disabled = false;
}

async function injectShot(code) {
  if (!currentProject) return;
  setActiveShot(code);

  const btn = shotsContainer.querySelector(`.btn-inject[data-code="${code}"]`);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const site = tab?.url ? detectSiteFromUrl(tab.url) : null;
  if (site && site !== currentSite) {
    currentSite = site;
    renderShots();
  }

  if (!tab?.id || !site) {
    const prompt = await getPromptText(code);
    await copyToClipboard(prompt, btn);
    return;
  }

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "inject-prompt",
        project: currentProject,
        code,
        site,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (resp.ok && !resp.fallback) {
      if (btn) flashBtn(btn, "Done", "#22c55e");
    } else {
      await copyToClipboard(prompt, btn);
    }
  } catch {
    await copyToClipboard(prompt, btn);
  }
}

// --- Copy ---

async function copyToClipboard(prompt, btn) {
  try {
    await navigator.clipboard.writeText(prompt);
    if (btn) flashBtn(btn, "Copied!", "#eab308");
  } catch {
    if (btn) flashBtn(btn, "Failed", "#ef4444");
  }
}

async function copyShot(code, btn) {
  setActiveShot(code);
  const prompt = await getPromptText(code);
  if (!prompt) {
    flashBtn(btn, "None", "#ef4444");
    return;
  }
  await copyToClipboard(prompt, btn);
}

// --- Generation "orbit" indicator -------------------------------------------
// A blue light circling a thumbnail while its image is generating. Driven by
// generation-start (Google Flow, from the request correlator) and cleared by
// auto-download-complete (all sites); also wired to the OpenArt per-view batch
// progress. Wraps the thumb so it overlays a placeholder OR an existing image.
function thumbWithOrbit(innerHtml) {
  return `<span class="thumb-orbit-wrap">${innerHtml}<span class="thumb-orbit" aria-hidden="true"></span></span>`;
}

const orbitSafetyTimers = new Map();
function orbitKey(t) {
  return t.type === "shot" ? `shot:${t.code}` : `char:${t.charSlug}-${t.viewSlug}`;
}
function orbitWrapForTarget(t) {
  if (!t) return null;
  let el = null;
  if (t.type === "shot") el = shotsContainer && shotsContainer.querySelector(`[data-thumb="${t.code}"]`);
  else if (t.type === "char") el = charsContainer && charsContainer.querySelector(`[data-char-thumb="${t.charSlug}-${t.viewSlug}"]`);
  return el && el.closest(".thumb-orbit-wrap");
}
function setThumbGenerating(target, on) {
  if (!target) return;
  const key = orbitKey(target);
  const prev = orbitSafetyTimers.get(key);
  if (prev) { clearTimeout(prev); orbitSafetyTimers.delete(key); }
  const wrap = orbitWrapForTarget(target);
  if (wrap) wrap.classList.toggle("generating", !!on);
  if (on) {
    // Never leave a ring spinning forever if a completion signal is dropped (e.g.
    // a generation that errors out on the page without an auto-download).
    orbitSafetyTimers.set(key, setTimeout(() => {
      orbitSafetyTimers.delete(key);
      const w = orbitWrapForTarget(target);
      if (w) w.classList.remove("generating");
    }, 180000));
  }
}

function updateThumbnail(code) {
  const el = shotsContainer.querySelector(`[data-thumb="${code}"]`);
  if (!el) return;
  const img = document.createElement("img");
  img.className = "shot-thumb-ext";
  img.dataset.thumb = code;
  img.alt = code;
  img.src = `${API}/assets/${currentProject}/shots/${code}/image?v=${Date.now()}`;
  el.replaceWith(img);
}

const DEL_ICON_SVG = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/></svg>';

function ensureShotDeleteButton(code) {
  const card = shotsContainer.querySelector(`.shot-card[data-code="${code}"]`);
  if (!card || card.querySelector(".btn-del")) return;
  const actions = card.querySelector(".shot-actions");
  if (!actions) return;
  const btn = document.createElement("button");
  btn.className = "btn-del";
  btn.dataset.code = code;
  btn.title = "Delete image";
  btn.innerHTML = DEL_ICON_SVG;
  btn.addEventListener("click", (e) => deleteShotImage(code, e.currentTarget));
  actions.appendChild(btn);
}

function ensureCharDeleteButton(charSlug, viewSlug) {
  const key = `${charSlug}-${viewSlug}`;
  const thumb = charsContainer.querySelector(`[data-char-thumb="${key}"]`);
  if (!thumb) return;
  const item = thumb.closest(".char-view-item");
  if (!item || item.querySelector(".btn-del")) return;
  const actions = item.querySelector(".shot-actions");
  if (!actions) return;
  const btn = document.createElement("button");
  btn.className = "btn-del";
  btn.title = "Delete image";
  btn.innerHTML = DEL_ICON_SVG;
  btn.addEventListener("click", (e) => deleteCharImage(charSlug, viewSlug, e.currentTarget));
  actions.appendChild(btn);
}

// --- API Dry Run ---

async function collectElementVisualReferences(shot) {
  const elements = shot.elements || [];
  const refs = [];
  for (const elName of elements) {
    const raw = elName.replace(/^@/, "");
    const key = `openart-cw:${raw.toLowerCase()}`;
    const stored = await new Promise((r) => chrome.storage.local.get(key, r));
    const cwElement = stored[key];
    if (!cwElement) {
      console.warn(`[PromptSync] No C&W data for "${raw}" — character not found in OpenArt C&W library`);
      continue;
    }
    const ext = (cwElement.url || "").split(".").pop()?.split("?")[0] || "png";
    const refType = cwElement.type === "background" ? "world" : "character";
    refs.push({
      type: refType,
      id: cwElement.id,
      name: cwElement.name,
      elementName: raw,
      label: cwElement.label || cwElement.name,
      url: cwElement.url,
      imageUrl: cwElement.imageUrl,
      extraUrls: cwElement.extraUrls || [],
      klingElementId: cwElement.klingElementId || null,
      metadata: {
        media_type: "image",
        format: ext,
        width: 1024,
        height: 1024,
        file_size_bytes: 0,
      },
    });
  }
  return refs;
}

async function apiDryRun(code, btn) {
  if (!currentProject) return;
  setActiveShot(code);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    if (btn) flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  if (btn) flashBtn(btn, "...", "#3b82f6");

  const shot = shots.find((s) => s.code === code);
  const elementRefs = shot ? await collectElementVisualReferences(shot) : [];

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "api-dry-run",
        project: currentProject,
        code,
        site: currentSite,
        projectAspectRatio,
        projectDefaultResolution,
        visualReferences: elementRefs,
      }, (r) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(r || { ok: false });
      });
    });

    if (resp.ok) {
      flashBtn(btn, "Logged", "#22c55e");
    } else {
      flashBtn(btn, resp.error?.slice(0, 8) || "Failed", "#ef4444");
    }
  } catch {
    flashBtn(btn, "Failed", "#ef4444");
  }
}

// --- Download image ---

async function downloadImage(code, btn) {
  setActiveShot(code);
  const shot = shots.find((s) => s.code === code);
  if (shot?.has_image) {
    if (!confirm(`Shot ${code} already has an image. Overwrite it?`)) return;
  }
  await doDownload(code, btn);
}

async function doDownload(code, btn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    if (btn) flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  if (btn) flashBtn(btn, "...", "#3b82f6");

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "download-image",
        project: currentProject,
        code,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (resp.ok) {
      if (btn) flashBtn(btn, "Saved!", "#22c55e");
      const card = shotsContainer.querySelector(`.shot-card[data-code="${code}"]`);
      if (card) card.classList.add("has-image");
      updateThumbnail(code);
      ensureShotDeleteButton(code);
      const shot = shots.find((s) => s.code === code);
      if (shot) shot.has_image = true;
    } else {
      if (btn) flashBtn(btn, resp.error || "Failed", "#ef4444");
    }
  } catch (err) {
    if (btn) flashBtn(btn, "Failed", "#ef4444");
  }
}

// --- Video download ---

async function downloadVideo(code, btn) {
  setActiveShot(code);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    if (btn) flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  if (btn) flashBtn(btn, "...", "#3b82f6");

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "download-video",
        project: currentProject,
        code,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (resp.ok) {
      if (btn) flashBtn(btn, "Saved!", "#22c55e");
    } else {
      if (btn) flashBtn(btn, resp.error || "Failed", "#ef4444");
    }
  } catch (err) {
    if (btn) flashBtn(btn, "Failed", "#ef4444");
  }
}

// --- Start frame download ---

async function downloadStartFrame(code, btn) {
  setActiveShot(code);
  const shot = shots.find((s) => s.code === code);
  if (shot?.has_start_frame) {
    if (!confirm(`Shot ${code} already has a start frame. Overwrite it?`)) return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    if (btn) flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  if (btn) flashBtn(btn, "...", "#3b82f6");

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "download-start-frame",
        project: currentProject,
        code,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (resp.ok) {
      if (btn) flashBtn(btn, "Saved!", "#22c55e");
      const shot = shots.find((s) => s.code === code);
      if (shot) shot.has_start_frame = true;
    } else {
      if (btn) flashBtn(btn, resp.error || "Failed", "#ef4444");
    }
  } catch {
    if (btn) flashBtn(btn, "Failed", "#ef4444");
  }
}

// --- Delete image ---

async function deleteShotImage(code, btn) {
  if (!confirm(`Delete image for shot ${code}?`)) return;
  try {
    const resp = await fetch(`${API}/assets/${currentProject}/shots/${code}/image`, { method: "DELETE" });
    const result = await resp.json();
    if (result.ok) {
      const shot = shots.find((s) => s.code === code);
      if (shot) shot.has_image = false;
      renderShots();
    }
  } catch {
    if (btn) flashBtn(btn, "Err", "#ef4444");
  }
}

async function deleteCharImage(charSlug, viewSlug, btn) {
  const char = characters.find((c) => c.slug === charSlug);
  const viewName = char?.views.find((v) => v.slug === viewSlug)?.name || viewSlug;
  if (!confirm(`Delete image for ${char?.name || charSlug} - ${viewName}?`)) return;
  try {
    const resp = await fetch(`${API}/assets/${currentProject}/characters/${charSlug}/${viewSlug}/image`, { method: "DELETE" });
    const result = await resp.json();
    if (result.ok) {
      if (char) {
        const view = char.views.find((v) => v.slug === viewSlug);
        if (view) view.has_image = false;
      }
      renderCharacters();
    }
  } catch {
    if (btn) flashBtn(btn, "Err", "#ef4444");
  }
}

// Download bar button handler
dlBtn.addEventListener("click", () => {
  if (activeShot) doDownload(activeShot, dlBtn);
});

// Batch inject — sequentially inject all visible shots
const batchBtn = document.getElementById("batch-btn");
let batchRunning = false;

batchBtn.addEventListener("click", async () => {
  if (batchRunning || !currentProject) return;
  batchRunning = true;
  batchBtn.textContent = "Running...";
  batchBtn.style.background = "#6d28d9";

  const filtered = activeFilter
    ? shots.filter((s) => s.asset_type === activeFilter)
    : shots;

  for (let i = 0; i < filtered.length; i++) {
    const shot = filtered[i];
    batchBtn.textContent = `${i + 1}/${filtered.length}`;
    setActiveShot(shot.code);

    const prompt = await getPromptText(shot.code);
    if (!prompt) continue;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) break;

    const site = detectSiteFromUrl(tab.url || "");
    if (!site) {
      await copyToClipboard(prompt, null);
      continue;
    }

    await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "inject-prompt",
        project: currentProject,
        code: shot.code,
        site,
      }, () => resolve());
    });

    // Wait between injections so the user can submit each one
    if (i < filtered.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  batchRunning = false;
  batchBtn.textContent = "Batch";
  batchBtn.style.background = "#2a2a2a";
});

// --- Auto Generate ---

function waitForAutoDownload(code, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handler);
      resolve(false);
    }, timeout);

    function handler(msg) {
      if (msg.type === "auto-download-complete" && msg.target?.code === code) {
        chrome.runtime.onMessage.removeListener(handler);
        clearTimeout(timer);
        resolve(true);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  });
}

async function collectShotVisualReferences() {
  const refs = [];
  const shotsWithImages = shots.filter((s) => s.has_image && s.asset_type !== "seedance");
  for (const shot of shotsWithImages) {
    const key = `openart-res:${currentProject}:shot:${shot.code}`;
    const stored = await new Promise((r) => chrome.storage.local.get(key, r));
    const refInfo = stored[key];
    if (refInfo?.resourceId && refInfo?.url) {
      refs.push({ resourceId: refInfo.resourceId, url: refInfo.url, code: shot.code });
    }
  }
  return refs;
}

const AUTO_GEN_CONCURRENCY = 5;
const AUTO_GEN_TIMEOUT = 3600000;

function markShotComplete(shot) {
  shot.has_image = true;
  const card = shotsContainer.querySelector(`.shot-card[data-code="${shot.code}"]`);
  if (card) card.classList.add("has-image");
  updateThumbnail(shot.code);
  ensureShotDeleteButton(shot.code);
}

function updateAutoGenStatus(inFlight, completed, total) {
  const codes = [...inFlight].join(",");
  autoGenBtn.textContent = `${completed}/${total} [${inFlight.size}] ${codes}`;
}

autoGenBtn.addEventListener("click", async () => {
  if (autoGenRunning) {
    autoGenStopped = true;
    autoGenBtn.textContent = "Stopping...";
    return;
  }
  if (!currentProject) return;

  autoGenRunning = true;
  autoGenStopped = false;
  autoGenBtn.textContent = "Stop";
  autoGenBtn.style.background = "#ef4444";

  const filtered = (activeFilter
    ? shots.filter((s) => s.asset_type === activeFilter)
    : shots
  ).filter((s) => !s.has_image);

  if (!filtered.length) {
    autoGenBtn.textContent = "Auto Gen";
    autoGenBtn.style.background = "#1e3a5f";
    autoGenRunning = false;
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    autoGenRunning = false;
    autoGenBtn.textContent = "Auto Gen";
    autoGenBtn.style.background = "#1e3a5f";
    return;
  }
  const site = detectSiteFromUrl(tab.url);
  if (!site?.startsWith("openart")) {
    autoGenBtn.textContent = "Not OpenArt";
    await new Promise((r) => setTimeout(r, 1500));
    autoGenRunning = false;
    autoGenBtn.textContent = "Auto Gen";
    autoGenBtn.style.background = "#1e3a5f";
    return;
  }

  // Seedance shots go last — they need all other images as visual references
  const regularShots = filtered.filter((s) => s.asset_type !== "seedance");
  const seedanceShots = filtered.filter((s) => s.asset_type === "seedance");
  const queue = [...regularShots, ...seedanceShots];
  const totalShots = queue.length;
  let completed = 0;
  let nextIdx = 0;
  const inFlight = new Set();
  let seedanceVisualRefs = null;

  async function generateOne() {
    while (nextIdx < queue.length && !autoGenStopped) {
      const shot = queue[nextIdx++];
      const isSeedance = shot.asset_type === "seedance";

      let shotVisualRefs;
      if (isSeedance) {
        if (!seedanceVisualRefs) {
          seedanceVisualRefs = await collectShotVisualReferences();
          console.log(`[AutoGen] Collected ${seedanceVisualRefs.length} visual references for seedance shots`);
        }
        shotVisualRefs = seedanceVisualRefs.map((ref, i) => ({
          type: "image",
          id: ref.resourceId,
          url: ref.url,
          label: `image${i + 1}`,
          name: `image${i + 1}`,
          imageUrl: ref.url,
          metadata: { media_type: "image", width: 1024, height: 1024, format: null, file_size_bytes: 0 },
        }));
      } else {
        shotVisualRefs = await collectElementVisualReferences(shot);
      }

      inFlight.add(shot.code);
      updateAutoGenStatus(inFlight, completed, totalShots);
      setActiveShot(shot.code);

      const resp = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {
          type: "auto-generate-shot-direct",
          project: currentProject,
          code: shot.code,
          site,
          projectAspectRatio,
          projectDefaultResolution,
          visualReferences: shotVisualRefs,
        }, (r) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(r || { ok: false });
        });
      });

      inFlight.delete(shot.code);

      if (resp.ok) {
        markShotComplete(shot);
      } else {
        console.warn(`[AutoGen] Failed for ${shot.code}:`, resp.error);
      }

      completed++;
      updateAutoGenStatus(inFlight, completed, totalShots);

      if (nextIdx < queue.length && !autoGenStopped) {
        const delay = 5000 + Math.random() * 10000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(AUTO_GEN_CONCURRENCY, queue.length); i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));
    if (autoGenStopped) break;
    workers.push(generateOne());
  }
  await Promise.all(workers);

  autoGenRunning = false;
  autoGenStopped = false;
  autoGenBtn.textContent = "Auto Gen";
  autoGenBtn.style.background = "#1e3a5f";
});

// --- Tooltip ---

let tooltipEl = null;

function showTooltip(anchor, label, text) {
  hideTooltip();
  if (!text) return;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "tooltip";
  tooltipEl.innerHTML = `<div class="tooltip-label">${label}</div>${escapeHtml(text)}`;
  document.body.appendChild(tooltipEl);

  const rect = anchor.getBoundingClientRect();
  const tipRect = tooltipEl.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
  if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 4;
  tooltipEl.style.left = `${Math.max(4, left)}px`;
  tooltipEl.style.top = `${Math.max(4, top)}px`;
}

function hideTooltip() {
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- Prompt cache for info tooltips ---

const promptCache = {};

async function getPromptCached(code) {
  const cacheKey = `${code}:${currentSite}`;
  if (promptCache[cacheKey] !== undefined) return promptCache[cacheKey];
  const text = await getPromptText(code);
  promptCache[cacheKey] = text || null;
  return promptCache[cacheKey];
}

// --- Utilities ---

function detectSiteFromUrl(url) {
  if (url.includes("midjourney.com")) return "midjourney";
  if (url.includes("openart.ai")) {
    if (url.includes("/animate-video") || url.includes("/create-video")) return "openart-video";
    return "openart-image";
  }
  if (url.includes("labs.google")) return "googleflow";
  return null;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

// --- Tabs ---

function switchTab(tab) {
  activeTab = tab;
  tabRow.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  shotsPanel.style.display = tab === "shots" ? "" : "none";
  charsPanel.style.display = tab === "characters" ? "" : "none";
}

function updateTabCounts() {
  tabRow.querySelector('[data-tab="shots"]').textContent = `Shots (${shots.length})`;
  tabRow.querySelector('[data-tab="characters"]').textContent = `Characters (${characters.length})`;
}

tabRow.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// --- Characters ---

function renderCharacters() {
  if (!characters.length) {
    charsContainer.innerHTML = '<div class="empty">No characters defined</div>';
    return;
  }

  charsContainer.innerHTML = "";

  for (const char of characters) {
    const card = document.createElement("div");
    card.className = "char-card";
    card.dataset.char = char.slug;

    const statusColor = {
      "needs-reference": "#ef4444",
      "has-reference": "#22c55e",
      "reference-done": "#22c55e",
      "element-ready": "#8b5cf6",
      "not-created": "#f59e0b",
    }[char.element_status] || "#666";

    const hasMissing = char.views.some((v) => !v.has_image && v.prompt);
    const genBtnHtml = currentSite === "openart-image" && hasMissing
      ? `<button class="btn-sm btn-gen-rest" data-char="${char.slug}" title="Auto-generate views via API">Auto Gen</button>`
      : "";
    const uploadBtnHtml = currentSite === "openart-image"
      ? `<button class="btn-sm btn-upload-openart" title="Upload reference images to OpenArt">Upload</button>`
      : "";
    const descBtnHtml = `<button class="btn-sm btn-copy-desc" title="Copy Kling Element Description">Desc</button>`;

    card.innerHTML = `
      <div class="char-header">
        <span class="char-name">${escapeHtml(char.element_name || char.name)}</span>
        <span class="char-type-tag">${char.element_type}</span>
        <span class="char-status-tag" style="background:${statusColor}22;color:${statusColor}">${char.element_status}</span>
        <div class="shot-actions">
          ${descBtnHtml}
          ${genBtnHtml}
          ${uploadBtnHtml}
        </div>
      </div>
    `;

    const descBtn = card.querySelector(".btn-copy-desc");
    if (descBtn) descBtn.addEventListener("click", (e) => copyCharDesc(char, e.target));

    const genRestBtn = card.querySelector(".btn-gen-rest");
    if (genRestBtn) genRestBtn.addEventListener("click", (e) => generateViews(char, e.target));

    const uploadBtn = card.querySelector(".btn-upload-openart");
    if (uploadBtn) uploadBtn.addEventListener("click", (e) => uploadCharToOpenArt(char, e.target));

    const header = card.querySelector(".char-header");
    const viewsList = document.createElement("div");
    viewsList.className = "char-views-list";

    for (const view of char.views) {
      const item = document.createElement("div");
      item.className = "char-view-item";

      const thumbHtml = thumbWithOrbit(view.has_image
        ? `<img class="char-view-thumb" data-char-thumb="${char.slug}-${view.slug}" src="${API}/assets/${currentProject}/characters/${char.slug}/${view.slug}/image" alt="${view.name}" />`
        : `<div class="char-view-thumb-placeholder" data-char-thumb="${char.slug}-${view.slug}">--</div>`);

      item.innerHTML = `
        ${thumbHtml}
        <span class="char-view-name" title="${escapeHtml(view.name)}">${escapeHtml(view.name)}</span>
        <div class="shot-actions">
          <button class="btn-sm btn-inject" title="Inject prompt">Inject</button>
          <button class="btn-sm btn-copy" title="Copy prompt">Copy</button>
          <button class="btn-sm btn-dl" title="Download page image">DL</button>
          ${view.has_image ? `<button class="btn-del" title="Delete image"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1H12l-.5 9a1.5 1.5 0 0 1-1.5 1.4H6A1.5 1.5 0 0 1 4.5 13L4 4H3.5a.5.5 0 0 1-.5-.5z"/></svg></button>` : ""}
        </div>
        ${view.prompt ? `<div class="char-view-prompt">${escapeHtml(view.prompt)}</div>` : ""}
      `;

      item.addEventListener("click", (e) => {
        if (e.target.closest(".shot-actions")) return;
        item.classList.toggle("expanded");
      });
      item.style.cursor = "pointer";

      item.querySelector(".btn-inject").addEventListener("click", () => injectCharView(char, view));
      item.querySelector(".btn-copy").addEventListener("click", (e) => copyCharView(char, view, e.target));
      item.querySelector(".btn-dl").addEventListener("click", (e) => downloadCharImage(char, view, e.target));

      const charDelBtn = item.querySelector(".btn-del");
      if (charDelBtn) charDelBtn.addEventListener("click", (e) => deleteCharImage(char.slug, view.slug, e.currentTarget));

      viewsList.appendChild(item);
    }

    if (char.views.length === 0) {
      viewsList.innerHTML = '<div style="font-size:10px;color:#555;padding:4px 0">No reference views defined</div>';
    }

    card.appendChild(viewsList);

    charsContainer.appendChild(card);
    checkCharGenReady(char);
  }

  if (currentSite === "openart-image" || currentSite === "openart-video") updateMediaButtonStates();
}

// --- Character actions ---

async function fetchCharView(charSlug, viewSlug) {
  try {
    const res = await fetch(`${API}/extension/character?project=${currentProject}&char=${charSlug}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.views?.find((v) => v.slug === viewSlug) || null;
  } catch {
    return null;
  }
}

async function fetchCharViewPrompt(charSlug, viewSlug) {
  const v = await fetchCharView(charSlug, viewSlug);
  return v?.prompt || null;
}

async function syncCharResourceIds() {
  for (const char of characters) {
    for (const v of char.views) {
      if (!v.has_image || v.openart_resource_id) continue;
      const key = `openart-res:${currentProject}:${char.slug}:${v.slug}`;
      const stored = await new Promise((r) => chrome.storage.local.get(key, r));
      const refInfo = stored[key];
      if (refInfo?.resourceId) {
        v.openart_resource_id = refInfo.resourceId;
        fetch(`${API}/assets/${currentProject}/characters/${char.slug}/${v.slug}/openart-ref`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: refInfo.resourceId }),
        }).catch(() => {});
      }
    }
  }
}

async function collectCharViewVisualReferences(char, excludeViewSlug) {
  const refs = [];
  for (const v of char.views) {
    if (v.slug === excludeViewSlug || !v.has_image) continue;
    const key = `openart-res:${currentProject}:${char.slug}:${v.slug}`;
    const stored = await new Promise((r) => chrome.storage.local.get(key, r));
    const refInfo = stored[key];
    const resourceId = refInfo?.resourceId || v.openart_resource_id;
    const url = refInfo?.url || v.openart_ref;
    if (!resourceId || !url) {
      console.warn(`[PromptSync] Missing ref for ${char.slug}/${v.slug}: resourceId=${!!resourceId}, url=${!!url}, storage=${!!refInfo}, server_rid=${!!v.openart_resource_id}`);
      continue;
    }
    refs.push({
      type: "image",
      id: resourceId,
      url,
      label: `image${refs.length + 1}`,
      name: `image${refs.length + 1}`,
      imageUrl: url,
      metadata: { media_type: "image", width: 1024, height: 1024, format: null, file_size_bytes: 0 },
    });
  }
  console.log(`[PromptSync] Collected ${refs.length} visual references for ${char.slug} (excluding ${excludeViewSlug})`);
  return refs;
}

async function injectCharView(char, view) {
  if (!currentProject) return;

  const viewData = await fetchCharView(char.slug, view.slug);
  if (!viewData?.prompt) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    await copyToClipboard(viewData.prompt, null);
    return;
  }

  const site = detectSiteFromUrl(tab.url || "");
  if (!site) {
    await copyToClipboard(viewData.prompt, null);
    return;
  }

  const isRefSheet = view.name.toLowerCase().includes("reference sheet");
  const visualReferences = isRefSheet ? await collectCharViewVisualReferences(char, view.slug) : [];

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "inject-text",
        prompt: viewData.prompt,
        label: `${char.name} - ${view.name}`,
        outputSettings: {
          aspect_ratio: viewData.aspect_ratio || null,
          resolution: viewData.resolution || null,
        },
        autoDownload: {
          type: "char",
          project: currentProject,
          charSlug: char.slug,
          viewSlug: view.slug,
        },
        visualReferences,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (!resp.ok || resp.fallback) {
      await copyToClipboard(viewData.prompt, null);
    }
  } catch {
    await copyToClipboard(viewData.prompt, null);
  }
}

async function copyCharView(char, view, btn) {
  const prompt = await fetchCharViewPrompt(char.slug, view.slug);
  if (!prompt) {
    flashBtn(btn, "None", "#ef4444");
    return;
  }
  await copyToClipboard(prompt, btn);
}

async function downloadCharImage(char, view, btn) {
  if (view.has_image) {
    if (!confirm(`${char.name} - ${view.name} already has an image. Overwrite it?`)) return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  flashBtn(btn, "...", "#3b82f6");

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "download-char-image",
        project: currentProject,
        charSlug: char.slug,
        viewSlug: view.slug,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (resp.ok) {
      flashBtn(btn, "Saved!", "#22c55e");
      view.has_image = true;
      updateCharThumb(char.slug, view.slug);
      ensureCharDeleteButton(char.slug, view.slug);
    } else {
      flashBtn(btn, resp.error || "Failed", "#ef4444");
    }
  } catch {
    flashBtn(btn, "Failed", "#ef4444");
  }
}

async function copyCharDesc(char, btn) {
  try {
    const res = await fetch(`${API}/extension/character?project=${currentProject}&char=${char.slug}`);
    if (!res.ok) { flashBtn(btn, "None", "#ef4444"); return; }
    const data = await res.json();
    if (!data.kling_description) { flashBtn(btn, "None", "#ef4444"); return; }
    await copyToClipboard(data.kling_description, btn);
  } catch {
    flashBtn(btn, "Failed", "#ef4444");
  }
}

async function uploadCharToOpenArt(char, btn) {
  if (!currentProject) return;

  const viewsWithImages = char.views.filter((v) => v.has_image);
  if (!viewsWithImages.length) {
    flashBtn(btn, "No images", "#ef4444");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  flashBtn(btn, "...", "#3b82f6");

  const imageUrls = viewsWithImages.map((v) =>
    `${API}/assets/${currentProject}/characters/${char.slug}/${v.slug}/image`
  );

  const openartRefs = viewsWithImages
    .map((v) => v.openart_ref)
    .filter(Boolean);

  let klingDesc = "";
  try {
    const res = await fetch(`${API}/extension/character?project=${currentProject}&char=${char.slug}`);
    if (res.ok) {
      const data = await res.json();
      klingDesc = data.kling_description || "";
    }
  } catch {}

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "upload-char-images",
        imageUrls,
        openartRefs,
        charName: char.element_name || char.name,
        charDescription: klingDesc,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    if (resp.ok) {
      flashBtn(btn, "Done!", "#22c55e");
    } else {
      flashBtn(btn, resp.error || "Failed", "#ef4444");
    }
  } catch {
    flashBtn(btn, "Failed", "#ef4444");
  }
}

function checkCharGenReady(char) {
  if (currentSite !== "openart-image") return;
  const hasMissing = char.views.some((v) => !v.has_image && v.prompt);
  if (!hasMissing) return;

  const card = charsContainer.querySelector(`.char-card[data-char="${char.slug}"]`);
  if (!card) return;

  const nameEl = card.querySelector(".char-name");
  if (!nameEl || nameEl.classList.contains("gen-ready")) return;
  nameEl.classList.add("gen-ready");
  nameEl.title = "Click to auto-generate views";
  nameEl.style.cursor = "pointer";
  nameEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = card.querySelector(".btn-gen-rest");
    if (btn && !btn.disabled) btn.click();
    else generateViews(char, nameEl);
  });

  let genRestBtn = card.querySelector(".btn-gen-rest");
  if (!genRestBtn) {
    genRestBtn = document.createElement("button");
    genRestBtn.className = "btn-sm btn-gen-rest";
    genRestBtn.dataset.char = char.slug;
    genRestBtn.title = "Auto-generate views via API";
    genRestBtn.textContent = "Auto Gen";
    genRestBtn.addEventListener("click", (e) => generateViews(char, e.target));
    const actions = card.querySelector(".shot-actions");
    if (actions) actions.prepend(genRestBtn);
  }
}

async function generateViews(char, btn) {
  if (!currentProject) return;

  const missing = char.views.filter((v) => !v.has_image);
  if (!missing.length) {
    flashBtn(btn, "All done", "#22c55e");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    flashBtn(btn, "No tab", "#ef4444");
    return;
  }

  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = `0/${missing.length}`;
  btn.style.background = "#3b82f6";

  const nameEl = charsContainer.querySelector(`.char-card[data-char="${char.slug}"] .char-name`);
  if (nameEl) nameEl.classList.remove("gen-ready");

  let completed = 0;
  const progressHandler = (msg) => {
    if (msg.type !== "gen-char-progress" || msg.charSlug !== char.slug) return;
    if (msg.phase === "generating") {
      setThumbGenerating({ type: "char", charSlug: char.slug, viewSlug: msg.viewSlug }, true);
    } else if (msg.phase === "done") {
      setThumbGenerating({ type: "char", charSlug: char.slug, viewSlug: msg.viewSlug }, false);
      completed++;
      btn.textContent = `${completed}/${missing.length}`;
      const view = char.views.find((v) => v.slug === msg.viewSlug);
      if (view) {
        view.has_image = true;
        updateCharThumb(char.slug, view.slug);
        ensureCharDeleteButton(char.slug, view.slug);
      }
    } else if (msg.phase === "failed") {
      setThumbGenerating({ type: "char", charSlug: char.slug, viewSlug: msg.viewSlug }, false);
    } else if (msg.phase === "waiting") {
      btn.textContent = `Wait ${msg.delay}s`;
    }
  };
  chrome.runtime.onMessage.addListener(progressHandler);

  try {
    const resp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, {
        type: "generate-char-views",
        project: currentProject,
        charSlug: char.slug,
      }, (r) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(r || { ok: false });
        }
      });
    });

    chrome.runtime.onMessage.removeListener(progressHandler);

    if (resp.ok) {
      const succeeded = resp.results.filter((r) => r.ok).length;
      flashBtn(btn, `${succeeded}/${missing.length}`, "#22c55e");
      renderCharacters();
    } else {
      flashBtn(btn, resp.error?.slice(0, 12) || "Failed", "#ef4444");
    }
  } catch {
    chrome.runtime.onMessage.removeListener(progressHandler);
    flashBtn(btn, "Failed", "#ef4444");
  }

  btn.disabled = false;
}

function updateCharThumb(charSlug, viewSlug) {
  const key = `${charSlug}-${viewSlug}`;
  const el = charsContainer.querySelector(`[data-char-thumb="${key}"]`);
  if (!el) return;
  const img = document.createElement("img");
  img.className = "char-view-thumb";
  img.dataset.charThumb = key;
  img.alt = viewSlug;
  img.src = `${API}/assets/${currentProject}/characters/${charSlug}/${viewSlug}/image?v=${Date.now()}`;
  el.replaceWith(img);
}

function startMediaPolling() {
  if (mediaPollingInterval) return;
  mediaAvailable = false;
  updateMediaButtonStates();
  mediaPollingInterval = setInterval(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      const mediaType = currentSite === "openart-video" ? "video" : "image";
      const resp = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: "check-media-available", mediaType }, (r) => {
          if (chrome.runtime.lastError) resolve({ available: false });
          else resolve(r || { available: false });
        });
      });
      if (resp.available !== mediaAvailable) {
        mediaAvailable = resp.available;
        updateMediaButtonStates();
      }
    } catch {}
  }, 1500);
}

function stopMediaPolling() {
  if (mediaPollingInterval) {
    clearInterval(mediaPollingInterval);
    mediaPollingInterval = null;
  }
  mediaAvailable = false;
}

function updateMediaButtonStates() {
  const isOpenArt = currentSite === "openart-image" || currentSite === "openart-video";
  const shouldDisable = isOpenArt && !mediaAvailable;
  // DL buttons (on openart-image)
  const dlButtons = shotsContainer.querySelectorAll(".btn-dl");
  for (const btn of dlButtons) {
    btn.disabled = shouldDisable;
    btn.style.opacity = shouldDisable ? "0.3" : "";
  }
  const charDlButtons = charsContainer.querySelectorAll(".btn-dl");
  for (const btn of charDlButtons) {
    btn.disabled = shouldDisable;
    btn.style.opacity = shouldDisable ? "0.3" : "";
  }
  // Vid buttons (on openart-video)
  const vidButtons = shotsContainer.querySelectorAll(".btn-vid");
  for (const btn of vidButtons) {
    btn.disabled = shouldDisable;
    btn.style.opacity = shouldDisable ? "0.3" : "";
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "generation-start" && msg.target) {
    setThumbGenerating(msg.target, true);
    return;
  }
  if (msg.type === "auto-download-complete" && msg.target) {
    setThumbGenerating(msg.target, false);
    const t = msg.target;
    if (t.type === "shot") {
      const shot = shots.find((s) => s.code === t.code);
      if (shot) {
        if (msg.isVideo) {
          // A video lands in storyboard/videos/ and must not touch the still: marking
          // has_image or rewriting the thumbnail here is what made shots look "empty".
          shot.has_video = true;
        } else {
          shot.has_image = true;
          shot.openart_ref = msg.thumbnailUrl || null;
          if (msg.resourceId && msg.imageUrl) {
            chrome.storage.local.set({
              [`openart-res:${currentProject}:shot:${t.code}`]: { resourceId: msg.resourceId, url: msg.imageUrl },
            });
          }
          const card = shotsContainer.querySelector(`.shot-card[data-code="${t.code}"]`);
          if (card) card.classList.add("has-image");
          updateThumbnail(t.code);
          ensureShotDeleteButton(t.code);
        }
      }
    } else if (t.type === "char") {
      const char = characters.find((c) => c.slug === t.charSlug);
      if (char) {
        const view = char.views.find((v) => v.slug === t.viewSlug);
        if (view) {
          view.has_image = true;
          if (msg.resourceId && msg.imageUrl) {
            chrome.storage.local.set({
              [`openart-res:${currentProject}:${t.charSlug}:${t.viewSlug}`]: { resourceId: msg.resourceId, url: msg.imageUrl },
            });
          }
          updateCharThumb(t.charSlug, t.viewSlug);
          ensureCharDeleteButton(t.charSlug, t.viewSlug);
          checkCharGenReady(char);
        }
      }
    }
  }
});

// --- Clear All Images ---
const clearAllImagesBtn = document.getElementById("clear-all-images-btn");
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmDelete = document.getElementById("confirm-delete");

clearAllImagesBtn.addEventListener("click", () => {
  confirmOverlay.style.display = "flex";
});
confirmCancel.addEventListener("click", () => {
  confirmOverlay.style.display = "none";
});
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) confirmOverlay.style.display = "none";
});
confirmDelete.addEventListener("click", async () => {
  confirmOverlay.style.display = "none";
  if (!currentProject) return;
  try {
    const res = await fetch(`${API}/assets/${currentProject}/shots/images/all`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      loadShots(currentProject);
    }
  } catch {}
});

projectSelect.addEventListener("change", () => {
  if (projectSelect.value) loadShots(projectSelect.value);
});

detectSite();
loadProjects();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentProject) {
    loadShots(currentProject);
  }
});

chrome.tabs.onActivated.addListener(() => detectSite());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") detectSite();
});
