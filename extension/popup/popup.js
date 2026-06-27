const API = "http://localhost:3456/api";

const projectSelect = document.getElementById("project-select");
const shotInput = document.getElementById("shot-input");
const shotListEl = document.getElementById("shot-list");
const injectBtn = document.getElementById("inject-btn");
const copyBtn = document.getElementById("copy-btn");
const shotInfoEl = document.getElementById("shot-info");
const previewSection = document.getElementById("preview-section");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("server-status");

let shots = [];
let selectedShot = null;
let currentSite = null;

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
  if (!online) return;

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

// Live-follow the web UI: if the active project changes while the popup is open, reflect it.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "active-changed" && msg.slug && msg.slug !== projectSelect.value) {
    projectSelect.value = msg.slug;
    loadShots(msg.slug);
  }
});

async function loadShots(project) {
  chrome.runtime.sendMessage({ type: "set-project", project }, (resp) => {
    if (resp?.ok) {
      shots = resp.shots;
      shotInput.disabled = false;
      shotInput.focus();
    }
  });
}

function detectSiteFromTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.url) return;
    if (tab.url.includes("midjourney.com")) currentSite = "midjourney";
    else if (tab.url.includes("openart.ai")) currentSite = "openart";
    else if (tab.url.includes("labs.google")) currentSite = "googleflow";
  });
}

function getPromptText(shot) {
  if (!shot) return null;
  if (currentSite === "midjourney") return shot.mjPrompt?.body;
  if (currentSite === "openart") return shot.klingPrompt?.body;
  if (currentSite === "googleflow") {
    if (shot.mjPrompt?.meta?.platform === "googleflow") return shot.mjPrompt.body;
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body;
  }
  return shot.mjPrompt?.body ?? shot.klingPrompt?.body;
}

function showShotList(filter) {
  shotListEl.innerHTML = "";
  const q = filter.toLowerCase().trim();
  const matches = q
    ? shots.filter((s) => s.code.toLowerCase().startsWith(q))
    : shots.slice(0, 10);

  for (const s of matches) {
    const div = document.createElement("div");
    div.className = "shot-option";
    div.innerHTML = `<span class="code">${s.code}</span><span class="setting">${s.setting?.slice(0, 30) ?? ""}</span>`;
    div.addEventListener("click", () => selectShot(s.code));
    shotListEl.appendChild(div);
  }
}

async function selectShot(code) {
  shotInput.value = code;
  shotListEl.innerHTML = "";

  const project = projectSelect.value;
  if (!project) return;

  try {
    const res = await fetch(`${API}/projects/${project}/shots/${code}`);
    if (!res.ok) {
      shotInfoEl.innerHTML = '<span class="tag">Not found</span>';
      return;
    }
    selectedShot = await res.json();

    shotInfoEl.innerHTML = [
      `<span class="tag ${selectedShot.meta.asset_type}">${selectedShot.meta.asset_type}</span>`,
      `<span class="tag">${selectedShot.meta.shot_type}</span>`,
      `<span class="tag">${selectedShot.meta.duration}</span>`,
      `<span class="tag">${selectedShot.meta.status}</span>`,
    ].join("");

    const prompt = getPromptText(selectedShot);
    if (prompt) {
      previewEl.textContent = prompt;
      previewSection.style.display = "";
      injectBtn.disabled = false;
      copyBtn.disabled = false;
    } else {
      previewEl.textContent = "No prompt available for current site";
      previewSection.style.display = "";
      injectBtn.disabled = true;
      copyBtn.disabled = true;
    }

    // Update the shot index in service worker for Ctrl+Shift+Right
    const idx = shots.findIndex((s) => s.code === code);
    if (idx >= 0) {
      chrome.runtime.sendMessage({ type: "set-shot-index", index: idx });
    }
  } catch (err) {
    shotInfoEl.innerHTML = `<span class="tag">${err.message}</span>`;
  }
}

// Event listeners
projectSelect.addEventListener("change", () => {
  const project = projectSelect.value;
  if (project) loadShots(project);
});

shotInput.addEventListener("input", () => {
  showShotList(shotInput.value);
});

shotInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && shotInput.value.trim()) {
    selectShot(shotInput.value.trim().toUpperCase());
  }
});

injectBtn.addEventListener("click", () => {
  if (!selectedShot || !projectSelect.value) return;
  chrome.runtime.sendMessage({
    type: "inject-shot",
    project: projectSelect.value,
    code: selectedShot.code,
  });
});

copyBtn.addEventListener("click", () => {
  const prompt = getPromptText(selectedShot);
  if (!prompt) return;
  navigator.clipboard.writeText(prompt).then(() => {
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
  });
});

// Init
detectSiteFromTab();
loadProjects();
