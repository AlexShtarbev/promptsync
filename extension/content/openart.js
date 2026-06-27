// OpenArt / Kling prompt injection (openart.ai)

const OPENART_SELECTORS = [
  'div.tiptap.ProseMirror[contenteditable="true"]',
  'div.ProseMirror[contenteditable="true"]',
  '.tiptap[contenteditable="true"]',
  'textarea[placeholder="Describe your image"]',
  'textarea[placeholder="Describe your video"]',
  'textarea[placeholder*="Describe your"]',
  'textarea[placeholder*="prompt"]',
  'textarea[placeholder*="Prompt"]',
  'textarea[placeholder*="Describe"]',
  'input[placeholder*="Describe your"]',
  '[role="textbox"]',
  '[contenteditable="true"]:not(input)',
  '.MuiInputBase-inputMultiline',
  '.MuiInputBase-input',
  '[class*="prompt"] textarea',
  '[data-testid="prompt-input"]',
  '.prompt-area textarea',
];

function findOpenArtInput() {
  for (const sel of OPENART_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return el;
  }
  const textareas = document.querySelectorAll("textarea");
  for (const ta of textareas) {
    if (isVisible(ta)) return ta;
  }
  return null;
}

function isVisible(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Audio Toggle ---

function setAudioOff() {
  const switches = document.querySelectorAll('[role="switch"]');
  for (const sw of switches) {
    const parent = sw.closest("div[class]");
    if (!parent) continue;
    const label = parent.textContent.trim().toLowerCase();
    if (!label.includes("audio")) continue;

    const inp = sw.querySelector("input");
    const isOn = inp ? inp.checked : sw.getAttribute("aria-checked") === "true";
    if (isOn) {
      sw.click();
      console.log("[PromptSync] Turned audio OFF");
    } else {
      console.log("[PromptSync] Audio already off");
    }
    return;
  }
  console.warn("[PromptSync] Audio toggle not found");
}

// --- Generic Toggle ---

function setToggleOn(label) {
  const switches = document.querySelectorAll('[role="switch"]');
  for (const sw of switches) {
    const parent = sw.closest("div[class]");
    if (!parent) continue;
    const text = parent.textContent.trim().toLowerCase();
    if (!text.includes(label.toLowerCase())) continue;

    const inp = sw.querySelector("input");
    const isOn = inp ? inp.checked : sw.getAttribute("aria-checked") === "true";
    if (!isOn) {
      sw.click();
      console.log(`[PromptSync] Turned ${label} ON`);
    } else {
      console.log(`[PromptSync] ${label} already on`);
    }
    return;
  }
  console.warn(`[PromptSync] ${label} toggle not found`);
}

// --- Open Settings Panel ---

function findSettingsPanel() {
  // Find the clickable settings row showing "Setting" icon + "Output" + summary
  // Video page: "SettingOutput1:1 | 10s | 720p"
  // Image page:  "SettingOutput1:1 | 1K" (no duration)
  const all = document.querySelectorAll("div");
  for (const el of all) {
    const t = el.textContent.trim();
    if (t.match(/^(?:Setting)?Output\d/) && isVisible(el)) {
      const clickable = el.querySelector('div[class*="bg-background"][class*="self-stretch"]') || el;
      return clickable;
    }
  }
  console.warn("[PromptSync] findSettingsPanel: no match");
  return null;
}

// --- Find and Click Option by Label ---

function findAndClickOption(label, value) {
  const all = document.querySelectorAll("div, p, span");
  for (const el of all) {
    const t = el.textContent.trim();
    if (t === label && el.children.length === 0 && isVisible(el)) {
      // Walk up 1-4 levels to find a container that holds both label and options
      let section = el.parentElement;
      for (let i = 0; i < 4 && section; i++) {
        const sectionText = section.textContent.trim();
        // Check if this container has the option we want
        if (sectionText.includes(value) || sectionText.includes(value.replace(":", "∶"))) {
          const candidates = section.querySelectorAll("div, span, button");
          const targets = [value, value.replace(":", "∶")];

          for (const target of targets) {
            const lower = target.toLowerCase();
            for (const opt of candidates) {
              const ot = opt.textContent.trim().toLowerCase();
              if (ot === lower && isVisible(opt)) {
                opt.click();
                console.log(`[PromptSync] Set ${label}: ${value}`);
                return true;
              }
            }
          }
        }
        section = section.parentElement;
      }
      console.warn(`[PromptSync] ${label} option "${value}" not found near label`);
      return false;
    }
  }
  console.warn(`[PromptSync] ${label} section not found`);
  return false;
}

// --- Duration Slider ---

async function setDurationSlider(targetSecs) {
  const targetVal = parseInt(targetSecs);
  let slider = null;
  const labels = document.querySelectorAll("div");
  for (const el of labels) {
    if (el.textContent.trim() === "Duration" && el.children.length === 0 && isVisible(el)) {
      let section = el.parentElement;
      for (let i = 0; i < 3 && section; i++) {
        const s = section.querySelector('span[role="slider"]');
        if (s) { slider = s; break; }
        section = section.parentElement;
      }
      if (slider) break;
    }
  }
  if (!slider) {
    console.warn("[PromptSync] Duration slider not found");
    return;
  }

  const max = parseInt(slider.getAttribute("aria-valuemax") || "10");
  const min = parseInt(slider.getAttribute("aria-valuemin") || "5");
  const current = parseInt(slider.getAttribute("aria-valuenow") || min);
  const clamped = Math.max(min, Math.min(max, targetVal));

  if (current === clamped) {
    console.log(`[PromptSync] Duration already at ${clamped}s`);
    return;
  }

  // Pointer events on the track work where synthetic keyboard events don't
  const track = slider.closest('[class*="touch-none"]') || slider.parentElement;
  if (!track) {
    console.warn("[PromptSync] Duration slider track not found");
    return;
  }

  const rect = track.getBoundingClientRect();
  const ratio = (clamped - min) / (max - min);
  const x = rect.left + ratio * rect.width;
  const y = rect.top + rect.height / 2;
  const opts = { bubbles: true, clientX: x, clientY: y, pointerId: 1 };

  track.dispatchEvent(new PointerEvent("pointerdown", opts));
  await sleep(50);
  track.dispatchEvent(new PointerEvent("pointermove", opts));
  await sleep(50);
  track.dispatchEvent(new PointerEvent("pointerup", opts));
  await sleep(100);

  const after = parseInt(slider.getAttribute("aria-valuenow") || "0");
  if (after === clamped) {
    console.log(`[PromptSync] Set Duration: ${clamped}s`);
  } else {
    console.warn(`[PromptSync] Duration: wanted ${clamped}s, slider shows ${after}s — retrying with click`);
    track.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    await sleep(100);
    console.log(`[PromptSync] Duration retry done, slider now: ${slider.getAttribute("aria-valuenow")}s`);
  }
}

// --- Configure All Settings ---

// Video model per shot asset_type (the video page uses the same model picker as
// create-image). Extend as more video models are supported.
const VIDEO_MODELS = {
  seedance: "Seedance 2.0",
};

async function configureSettings(shot, project) {
  const klingMeta = shot.klingPrompt?.meta;
  const shotMeta = shot.meta || {};

  // 0. Pick the video model (e.g. Seedance 2.0) before touching the settings panel.
  const videoModel = VIDEO_MODELS[shotMeta.asset_type];
  if (videoModel) await selectModelByName(videoModel);

  // 1. Audio off
  setAudioOff();

  // 2. Open the settings panel if not already open
  const settingsLabels = ["Aspect ratio", "Duration", "Resolution"];
  function isSettingsContentVisible() {
    return [...document.querySelectorAll("div, span, p")].some(
      (el) => el.children.length === 0 && isVisible(el) && settingsLabels.includes(el.textContent.trim())
    );
  }

  const alreadyOpen = isSettingsContentVisible();
  let settingsPanelToggle = null;

  if (alreadyOpen) {
    console.log("[PromptSync] Settings panel already open");
  } else {
    settingsPanelToggle = findSettingsPanel();
    if (settingsPanelToggle) {
      settingsPanelToggle.click();
      console.log("[PromptSync] Opened settings panel");
      let settingsLoaded = false;
      for (let i = 0; i < 15; i++) {
        await sleep(200);
        if (isSettingsContentVisible()) {
          console.log("[PromptSync] Settings content loaded");
          settingsLoaded = true;
          break;
        }
      }
      if (!settingsLoaded) {
        settingsPanelToggle.click();
        console.log("[PromptSync] Settings content not found, closing panel");
        await sleep(300);
        return;
      }
    } else {
      console.warn("[PromptSync] Settings panel not found");
      return;
    }
  }

  // 3. Now the Aspect ratio / Duration / Resolution sections should be visible
  const ar = klingMeta?.aspect_ratio;
  if (ar) {
    findAndClickOption("Aspect ratio", ar);
    await sleep(200);
  }

  const duration = shotMeta.duration;
  if (duration) {
    const match = duration.match(/(\d+)/);
    if (match) {
      await setDurationSlider(match[1]);
      await sleep(200);
    }
  }

  findAndClickOption("Resolution", "720p");
  await sleep(200);

  // 4. Auto-polish on
  setToggleOn("Auto-polish");

  // 5. Close the settings panel so it doesn't block character/world library access
  await sleep(200);
  if (settingsPanelToggle) {
    settingsPanelToggle.click();
    console.log("[PromptSync] Closed settings panel");
    await sleep(300);
  } else if (!alreadyOpen) {
    const toggle = findSettingsPanel();
    if (toggle) {
      toggle.click();
      console.log("[PromptSync] Closed settings panel (re-found)");
      await sleep(300);
    }
  }
}

// --- Start Frame Image Settings (create-image for kling shots) ---

async function configureStartFrameSettings(aspectRatio) {
  await configureImageOutput({ aspect_ratio: aspectRatio || "9:16", resolution: "1K", model: "Nano Banana 2" });
}

// --- Model Selection (create-image) ---

function findModelTrigger() {
  const all = document.querySelectorAll("div, span, p");
  for (const el of all) {
    if (el.textContent.trim() === "Model" && el.children.length === 0 && isVisible(el)) {
      let container = el.parentElement;
      for (let i = 0; i < 4 && container; i++) {
        if (container.classList.contains("group") || container.className.includes("rounded-[16px]")) {
          return container;
        }
        container = container.parentElement;
      }
    }
  }
  return null;
}

function getCurrentImageModel() {
  const trigger = findModelTrigger();
  if (!trigger) return null;
  const truncated = trigger.querySelector(".truncate");
  return truncated ? truncated.textContent.trim() : null;
}

// Select a model by name via the "Model" picker. Shared by the create-image path
// and the video path (the video page uses the same control). No-op if already set
// or the picker isn't found.
async function selectModelByName(model) {
  if (!model) return;
  const currentModel = getCurrentImageModel();
  if (currentModel && currentModel.toLowerCase() === model.toLowerCase()) {
    console.log(`[PromptSync] Model already set to ${model}`);
    return;
  }
  const trigger = findModelTrigger();
  if (!trigger) {
    console.warn(`[PromptSync] Model picker not found — cannot set model to ${model}`);
    return;
  }
  trigger.click();
  console.log("[PromptSync] Opened model picker");
  await sleep(500);
  const lower = model.toLowerCase();
  const candidates = document.querySelectorAll("div, span, p, button");
  for (const el of candidates) {
    if (el.children.length > 2) continue;
    if (el.textContent.trim().toLowerCase() !== lower) continue;
    if (!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) continue;
    if (trigger.contains(el)) continue;
    el.click();
    console.log(`[PromptSync] Selected model: ${model}`);
    break;
  }
  await sleep(300);
}

// --- Image Output Settings (create-image: model, aspect ratio, resolution) ---

async function configureImageOutput({ aspect_ratio, resolution, model }) {
  console.log("[PromptSync] configureImageOutput called with:", { aspect_ratio, resolution, model });
  await sleep(300);

  if (model) await selectModelByName(model);

  const panelLabels = ["Aspect ratio", "Size", "Resolution"];
  function isPanelOpen() {
    return [...document.querySelectorAll("div, span, p")].some(
      (el) => el.children.length === 0 && isVisible(el) && panelLabels.includes(el.textContent.trim())
    );
  }

  const alreadyOpen = isPanelOpen();
  let toggle = null;

  if (!alreadyOpen) {
    toggle = findSettingsPanel();
    if (toggle) {
      toggle.click();
      console.log("[PromptSync] Opened output panel");
      let loaded = false;
      for (let i = 0; i < 15; i++) {
        await sleep(200);
        if (isPanelOpen()) {
          loaded = true;
          break;
        }
      }
      if (!loaded) {
        toggle.click();
        console.log("[PromptSync] Output content not found after opening, closing");
        await sleep(300);
        return;
      }
    } else {
      console.warn("[PromptSync] Output panel toggle not found");
    }
  }

  if (aspect_ratio) {
    findAndClickOption("Aspect ratio", aspect_ratio) || findAndClickOption("Aspect ratio", aspect_ratio.replace(":", "∶"));
    await sleep(200);
  }

  if (resolution) {
    findAndClickOption("Size", resolution) || findAndClickOption("Resolution", resolution);
    await sleep(200);
  }

  if (toggle) {
    await sleep(200);
    toggle.click();
    console.log("[PromptSync] Closed output panel");
    await sleep(300);
  }

  const parts = [model, aspect_ratio, resolution].filter(Boolean).join(", ");
  console.log(`[PromptSync] Configured image output: ${parts}`);
}

async function configureCharImageOutput(settings) {
  console.log("[PromptSync] configureCharImageOutput called with:", settings);
  if (!settings) { console.warn("[PromptSync] configureCharImageOutput: no settings, returning"); return; }
  const mode = getOpenArtMode();
  console.log("[PromptSync] configureCharImageOutput: mode =", mode);
  if (mode !== "openart-image") { console.warn("[PromptSync] configureCharImageOutput: wrong mode, returning"); return; }
  await configureImageOutput({
    aspect_ratio: settings.aspect_ratio,
    resolution: settings.resolution,
    model: "Nano Banana 2",
  });
}

// --- Characters & Worlds library ---
// Uses createImageCharacters module (create-image-characters.js)

// An attached image reference renders as a visible Remove/Delete button next to an
// <img>. clearImageReferences finds them to remove; countAttachedImageRefs counts
// them so an upload can be confirmed as attached (the panel may auto-attach without
// ever exposing a separate gallery thumbnail to click).
function imageRefRemoveButtons() {
  const btns = document.querySelectorAll('button[aria-label="Remove"], button[aria-label="Delete"], button[aria-label="remove"]');
  const out = [];
  for (const btn of btns) {
    if (!isVisible(btn)) continue;
    const nearby = btn.closest("div");
    if (!nearby) continue;
    if (nearby.querySelector("img") || nearby.parentElement?.querySelector("img")) out.push(btn);
  }
  return out;
}

function countAttachedImageRefs() {
  return imageRefRemoveButtons().length;
}

async function clearImageReferences() {
  const removeButtons = imageRefRemoveButtons();
  let removed = 0;
  for (const btn of removeButtons) {
    btn.click();
    removed++;
  }
  if (removed) console.log(`[PromptSync] Cleared ${removed} image references`);
  return removed;
}

async function clearAllReferences() {
  await createImageCharacters.selectCharacters([]);
  await clearImageReferences();
  console.log("[PromptSync] Cleared all references");
}

function deriveElementsFromPrompt(shot) {
  const body = shot.mjPrompt?.body || "";
  if (!body) return shot.meta?.elements || [];
  const allElements = shot.meta?.elements || [];
  const mentioned = new Set();
  for (const el of allElements) {
    if (body.includes(`@${el} `) || body.includes(`@${el}\n`) || body.includes(`@${el}'s`) || body.includes(`@${el}.`) || body.includes(`@${el},`) || body.includes(`@${el}:`)) {
      mentioned.add(el);
    }
  }
  if (!mentioned.size) return allElements;
  return [...mentioned];
}

async function addShotElements(shot, project) {
  const elements = shot.meta?.elements || [];
  console.log("[PromptSync] addShotElements called, elements:", elements);
  const names = elements.map((el) => el.replace(/^@/, ""));
  await createImageCharacters.selectCharacters(names);
}

// --- React-based visual reference selection ---
// Uses visualReferencesReact module (visual-references-react.js)

// --- Find and click Generate/Create button ---

function findGenerateButton() {
  const btns = document.querySelectorAll("button");
  for (const btn of btns) {
    if (!isVisible(btn)) continue;
    const t = btn.textContent.trim();
    if (!/^(Create|Generate|Animate)$/i.test(t)) continue;
    if (btn.disabled) continue;
    const r = btn.getBoundingClientRect();
    if (r.width < 50 || r.height < 20) continue;
    return btn;
  }
  return null;
}

async function clickGenerateButton() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const btn = findGenerateButton();
    if (btn) {
      btn.click();
      console.log("[PromptSync] Clicked generate button:", btn.textContent.trim());
      return true;
    }
    await sleep(500);
  }
  console.warn("[PromptSync] Generate button not found or disabled");
  return false;
}

// --- Image/video detail overlay detection ---

function isImageDetailOpen() {
  // Detect if user has clicked on a generated image (detail overlay visible)
  // DEBUG: Inspect OpenArt DOM with DevTools when clicking an image to tune
  const imgs = [...document.querySelectorAll("img")].filter((img) => {
    if (!isVisible(img)) return false;
    const r = img.getBoundingClientRect();
    if (r.width < 300 || r.height < 300) return false;
    if (!img.src || img.src.startsWith("data:")) return false;

    let el = img.parentElement;
    for (let i = 0; i < 10 && el; i++) {
      const style = getComputedStyle(el);
      const z = parseFloat(style.zIndex || "0");
      if (style.position === "fixed" && z > 10) return true;
      if (el.tagName === "DIALOG" || el.getAttribute("role") === "dialog") return true;
      if (z > 100) return true;
      el = el.parentElement;
    }
    return false;
  });

  return imgs.length > 0;
}

function isVideoDetailOpen() {
  // Detect if user has clicked on a generated video (detail overlay visible)
  // DEBUG: Inspect OpenArt DOM with DevTools when clicking a video to tune
  const videos = [...document.querySelectorAll("video")].filter((v) => {
    if (!isVisible(v)) return false;
    const r = v.getBoundingClientRect();
    if (r.width < 200 || r.height < 200) return false;
    if (!v.src && !v.querySelector("source")?.src) return false;

    let el = v.parentElement;
    for (let i = 0; i < 10 && el; i++) {
      const style = getComputedStyle(el);
      const z = parseFloat(style.zIndex || "0");
      if (style.position === "fixed" && z > 10) return true;
      if (el.tagName === "DIALOG" || el.getAttribute("role") === "dialog") return true;
      if (z > 100) return true;
      el = el.parentElement;
    }
    return false;
  });

  return videos.length > 0;
}

function isMediaDetailOpen() {
  const mode = getOpenArtMode();
  if (mode === "openart-video") return isVideoDetailOpen();
  return isImageDetailOpen();
}

// --- URL mode detection ---

function getOpenArtMode() {
  if (window.location.pathname.includes("/animate-video") || window.location.pathname.includes("/create-video")) return "openart-video";
  return "openart-image";
}

// --- Start Frame Reference (animate-video) ---

function findImagesButton() {
  // Only match buttons/tabs — avoid sidebar nav links (<a> tags)
  const candidates = document.querySelectorAll("button, div[role='button'], [role='tab']");
  for (const el of candidates) {
    if (el.children.length > 2) continue;
    const t = el.textContent.trim();
    if (t === "Images" && isVisible(el)) return el;
  }
  return null;
}

function findImagesUploadInput() {
  const allDivs = document.querySelectorAll("div");
  for (const div of allDivs) {
    const t = div.textContent.trim().toLowerCase();
    if (t.includes("image") && (t.includes("upload") || t.includes("drop") || t.includes("add") || t.includes("click"))) {
      const input = div.querySelector('input[type="file"]');
      if (input) return input;
    }
  }
  const inputs = document.querySelectorAll('input[type="file"][accept*="image"]');
  if (inputs.length) return inputs[inputs.length - 1];
  return null;
}

function findStartFrameSection() {
  const els = document.querySelectorAll("div, span, p");
  for (const el of els) {
    if (el.children.length > 0) continue;
    const t = el.textContent.trim();
    if (t === "Start/End Frame" || t === "Start Frame" || t === "Start / End Frame") {
      for (let i = 0; i < 6; i++) {
        const parent = el.parentElement;
        if (!parent) break;
        if (parent.querySelector('input[type="file"]') || parent.querySelector("img")) {
          return parent;
        }
      }
    }
  }
  return null;
}

function getImagePanelThumbnails() {
  // Scope to start frame section if found, otherwise fall back to full page
  const scope = findStartFrameSection() || document;
  return [...scope.querySelectorAll("img")].filter((img) => {
    if (!isVisible(img)) return false;
    const r = img.getBoundingClientRect();
    if (r.width < 30 || r.height < 30) return false;
    if (r.width > 400) return false;
    if (!img.src || img.src.startsWith("data:")) return false;
    const parent = img.closest("div");
    if (!parent) return false;
    const pText = parent.textContent.trim().toLowerCase();
    if (pText.includes("characters") && pText.includes("worlds")) return false;
    return true;
  });
}

async function openImagesPanel() {
  if (findImagesUploadInput()) return true;

  const btn = findImagesButton();
  if (!btn) {
    console.warn("[PromptSync] Images button not found");
    return false;
  }
  btn.click();
  for (let i = 0; i < 15; i++) {
    await sleep(300);
    if (findImagesUploadInput()) return true;
  }
  console.warn("[PromptSync] Images panel did not open");
  return false;
}

async function selectImageByUrl(url) {
  const imgs = getImagePanelThumbnails();
  for (const img of imgs) {
    if (img.src === url) {
      img.click();
      await sleep(300);
      console.log("[PromptSync] Selected start frame by exact URL match");
      return true;
    }
  }
  return false;
}

async function selectImageByPartialUrl(url) {
  try {
    const refPath = new URL(url).pathname;
    const imgs = getImagePanelThumbnails();
    for (const img of imgs) {
      try {
        const imgPath = new URL(img.src).pathname;
        if (imgPath === refPath || imgPath.includes(refPath) || refPath.includes(imgPath)) {
          img.click();
          await sleep(300);
          console.log("[PromptSync] Selected start frame by partial URL match");
          return true;
        }
      } catch { continue; }
    }
  } catch { /* invalid URL */ }
  return false;
}

// Upload an image (by platform URL) into the OpenArt Images/reference panel and
// select it — but skip the upload if we've already uploaded it before (cached) or
// it's already present as a thumbnail. Returns true if an image got selected.
async function uploadAndSelectReferenceImage(imageUrl, filename, cacheKey) {
  const opened = await openImagesPanel();
  if (!opened) return false;

  // Already uploaded on a previous inject? Re-select the cached thumbnail.
  const stored = cacheKey ? await new Promise((r) => chrome.storage.local.get(cacheKey, r)) : {};
  if (cacheKey && stored[cacheKey]) {
    if (await selectImageByUrl(stored[cacheKey])) return true;
    if (await selectImageByPartialUrl(stored[cacheKey])) return true;
  }

  let blob;
  try {
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
      console.warn("[PromptSync] reference image not found on server:", imageUrl);
      return false;
    }
    blob = await resp.blob();
  } catch (err) {
    console.warn("[PromptSync] failed to fetch reference image:", err.message);
    return false;
  }

  const input = findImagesUploadInput();
  if (!input) {
    console.warn("[PromptSync] Images upload input not found");
    return false;
  }

  const attachedBefore = countAttachedImageRefs();
  const thumbsBefore = getImagePanelThumbnails().length;
  triggerFileUpload(input, new File([blob], filename, { type: blob.type || "image/png" }));
  console.log("[PromptSync] Uploaded reference image:", filename);

  // OpenArt uploads to its server (can take several seconds), then EITHER auto-attaches
  // the image (a new Remove-able reference appears) OR drops it into the gallery as a
  // thumbnail we must click. Poll for either, up to ~25s. Counting attached refs is the
  // reliable signal — the old count-the-gallery-thumbnails check missed large/auto-
  // attached previews and left the reference unselected.
  for (let i = 0; i < 50; i++) {
    await sleep(500);
    if (countAttachedImageRefs() > attachedBefore) {
      if (cacheKey) chrome.storage.local.set({ [cacheKey]: imageUrl });
      console.log("[PromptSync] Reference attached:", filename);
      return true;
    }
    const thumbs = getImagePanelThumbnails();
    if (thumbs.length > thumbsBefore) {
      const newImg = thumbs[thumbs.length - 1];
      newImg.click();
      await sleep(500);
      if (countAttachedImageRefs() > attachedBefore) {
        if (cacheKey) chrome.storage.local.set({ [cacheKey]: newImg.src });
        console.log("[PromptSync] Reference selected from gallery:", newImg.src);
        return true;
      }
    }
  }
  console.warn(
    "[PromptSync] Reference uploaded but attachment not confirmed:", filename,
    "| attached refs:", countAttachedImageRefs(), "| gallery thumbs:", getImagePanelThumbnails().length
  );
  return false;
}

// Switch the create-video composer to "Text with Reference" mode. Seedance needs
// this — its elements (Characters & Worlds) are rejected on the Start/End Frame tab.
// Heuristic: click a visible tab/segmented-control whose text matches; logged so the
// selector can be tuned against the live DOM if it misses.
async function switchToTextWithReference() {
  const wanted = ["text with reference", "text + reference", "text & reference"];
  const candidates = document.querySelectorAll("button, div[role='button'], [role='tab'], [role='radio']");
  for (const el of candidates) {
    if (el.children.length > 3) continue;
    const t = el.textContent.trim().toLowerCase();
    if (!wanted.some((w) => t === w || t.includes(w))) continue;
    if (!isVisible(el)) continue;
    el.click();
    console.log("[PromptSync] Switched to 'Text with Reference' mode");
    await sleep(500);
    return true;
  }
  console.warn("[PromptSync] 'Text with Reference' tab not found — elements may not attach (tune switchToTextWithReference selectors)");
  return false;
}

// Attach the shot's storyboard image as the single reference image (@image1 / start
// frame) in Text-with-Reference mode. Reuses the robust upload+attach detection.
async function attachStoryboardReference(shot, project) {
  if (!project) return;
  await uploadAndSelectReferenceImage(
    `${PROMPTSYNC_API}/assets/${project}/shots/${shot.code}/image`,
    `${project}-${shot.code}-start-frame.png`,
    `openart-sf:${project}:${shot.code}`
  );
}

async function handleStartFrame(shot, project) {
  // Storyboard image IS the start frame now
  if (!shot.imagePath && !shot.openartRef) return;

  const cacheKey = `openart-sf:${project}:${shot.code}`;

  const opened = await openImagesPanel();
  if (!opened) return;

  // Try OpenArt ref URL first (image generated on OpenArt, may be in history)
  if (shot.openartRef) {
    console.log("[PromptSync] Trying OpenArt ref for start frame:", shot.openartRef);
    const selected = await selectImageByUrl(shot.openartRef);
    if (selected) return;
    const selected2 = await selectImageByPartialUrl(shot.openartRef);
    if (selected2) return;
    console.log("[PromptSync] OpenArt ref not found in thumbnails");
  }

  // Upload the storyboard image as the start frame, reusing the robust upload+attach
  // detection (auto-attach or click-gallery-thumbnail) shared with character sheets.
  await uploadAndSelectReferenceImage(
    `${PROMPTSYNC_API}/assets/${project}/shots/${shot.code}/image`,
    `${project}-${shot.code}-start-frame.png`,
    cacheKey
  );
}

// --- Main Injection ---

function injectIntoPage(prompt, shot, project) {
  const input = findOpenArtInput();
  if (!input) {
    console.warn("[PromptSync] OpenArt input not found. Selectors tried:", OPENART_SELECTORS);
    return false;
  }

  const mode = getOpenArtMode();

  const tag = input.tagName.toLowerCase();
  const isContentEditable = input.getAttribute("contenteditable") === "true" || input.isContentEditable;

  if (isContentEditable) {
    input.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, prompt);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt }));
  } else if (tag === "textarea" || tag === "input") {
    const nativeSet = Object.getOwnPropertyDescriptor(
      tag === "textarea"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (nativeSet) nativeSet.call(input, prompt);
    else input.value = prompt;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  } else {
    input.focus();
    input.textContent = prompt;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  if (shot) {
    if (mode === "openart-video") {
      _ps.queue = _ps.queue.then(async () => {
        await sleep(400);
        // Seedance only accepts elements (Characters & Worlds) in "Text with Reference"
        // mode — the Start/End Frame tab rejects them. Switch first, then select elements
        // and attach the storyboard as the @image1 reference. Kling keeps Start/End Frame.
        const isSeedance = shot.meta?.asset_type === "seedance";
        if (isSeedance) await switchToTextWithReference();
        await visualReferencesReact.clearElements();
        await clearImageReferences();
        if (project) {
          const elements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
          if (elements.length) {
            const result = await visualReferencesReact.selectElements(elements);
            if (!result.ok) {
              console.warn("[PromptSync] React selection failed:", result.error);
            } else if (result.idMap && Object.keys(result.idMap).length) {
              window.postMessage({ type: "promptsync-set-element-id-map", idMap: result.idMap }, "*");
            }
          }
        }
        await configureSettings(shot, project);
        if (isSeedance) {
          await attachStoryboardReference(shot, project);
        } else {
          await handleStartFrame(shot, project);
        }
      });
    } else {
      _ps.queue = _ps.queue.then(async () => {
        await sleep(400);
        window.postMessage({ type: "promptsync-set-visual-references", references: null }, "*");
        await clearImageReferences();
        if (shot.meta?.asset_type === "kling") {
          await configureStartFrameSettings(shot.mjPrompt?.meta?.ar);
        } else {
          const ar = shot.mjPrompt?.meta?.ar;
          await configureImageOutput({
            aspect_ratio: ar || null,
            resolution: null,
            model: "Nano Banana 2",
          });
        }
        const imageElements = deriveElementsFromPrompt(shot).map((el) => el.replace(/^@/, ""));
        await addShotElements({ ...shot, meta: { ...shot.meta, elements: imageElements } }, project);
      });
    }
  }

  return true;
}

// --- Character image selection from OpenArt history ---
// Used when character view images have OpenArt refs (were generated on OpenArt)
// DEBUG: This needs tuning based on actual OpenArt character creation DOM

async function selectCharImagesFromHistory(openartRefs, charName, charDescription) {
  // On OpenArt's create-image page (character creation flow),
  // we look for a way to select images from generation history
  // instead of uploading files.
  //
  // The "Image" radio tab in the C&W panel shows generated images.
  // We try to find and select the images by their OpenArt URLs there.

  console.log("[PromptSync] Attempting to select char images from history:", openartRefs);

  // Fill in name and description first
  fillOpenArtField("Name", charName);
  fillOpenArtField("Background Story", charDescription);
  await sleep(500);

  // Try to switch to "Image" radio in the right panel
  const radios = document.querySelectorAll('button[role="radio"]');
  let imageRadio = null;
  for (const radio of radios) {
    if (radio.textContent.trim() === "Image" && isVisible(radio)) {
      imageRadio = radio;
      break;
    }
  }

  if (!imageRadio) {
    console.log("[PromptSync] 'Image' radio tab not found — can't select from history");
    return null;
  }

  imageRadio.click();
  await sleep(500);

  // Look for generated images that match our refs
  const allImgs = [...document.querySelectorAll("img")].filter((img) => {
    if (!isVisible(img)) return false;
    if (!img.src || img.src.startsWith("data:")) return false;
    const r = img.getBoundingClientRect();
    return r.width > 40 && r.height > 40;
  });

  let matched = 0;
  for (const refUrl of openartRefs) {
    let found = false;
    for (const img of allImgs) {
      if (img.src === refUrl) {
        img.click();
        await sleep(300);
        matched++;
        found = true;
        console.log("[PromptSync] Selected char image from history:", refUrl.slice(0, 60));
        break;
      }
    }
    if (!found) {
      // Try partial match
      try {
        const refPath = new URL(refUrl).pathname;
        for (const img of allImgs) {
          try {
            if (new URL(img.src).pathname === refPath) {
              img.click();
              await sleep(300);
              matched++;
              found = true;
              console.log("[PromptSync] Selected char image by partial match:", refUrl.slice(0, 60));
              break;
            }
          } catch { continue; }
        }
      } catch { /* invalid URL */ }
    }
    if (!found) {
      console.warn("[PromptSync] Char image ref not found in history:", refUrl.slice(0, 60));
    }
  }

  if (matched === openartRefs.length) {
    showToast(`Selected ${matched} images from history for ${charName}`);
    return { ok: true, uploaded: matched, fromHistory: true };
  }

  console.log(`[PromptSync] Only matched ${matched}/${openartRefs.length} — falling back to upload`);
  return null;
}

// --- API capture: log generation requests for reverse-engineering ---

window.addEventListener("message", (event) => {
  if (event.data?.type === "promptsync-generation-captured") {
    const { url, requestBody, responseData } = event.data;
    console.log("[PromptSync] 📋 Generation captured in content script — copy from console or check /api/debug/generations on platform");
    window.__promptsyncLastCapture = event.data;

    if (requestBody?.projectId) {
      chrome.storage.local.set({ "openart-project-id": requestBody.projectId });
    }

    fetch(`${PROMPTSYNC_API}/debug/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, requestBody, responseData, capturedAt: new Date().toISOString() }),
    }).catch(() => {});
  }
});

// --- Restore persisted projectId to page script ---

chrome.storage.local.get("openart-project-id", (stored) => {
  if (stored["openart-project-id"]) {
    window.postMessage({ type: "promptsync-set-project-id", projectId: stored["openart-project-id"] }, "*");
  }
});

// --- Persist projectId when auto-captured from /projects/default ---

window.addEventListener("message", (event) => {
  if (event.data?.type === "promptsync-project-id-captured" && event.data.projectId) {
    chrome.storage.local.set({ "openart-project-id": event.data.projectId });
  }
});

// --- Persist C&W element data from generations ---

window.addEventListener("message", (event) => {
  if (event.data?.type === "promptsync-cw-elements-captured" && event.data.elements?.length) {
    for (const el of event.data.elements) {
      if (!el.id || !el.name) continue;
      const key = `openart-cw:${el.name.toLowerCase().trim()}`;
      chrome.storage.local.set({
        [key]: {
          id: el.id,
          name: el.name,
          type: el.type || "character",
          label: el.label || el.name,
          url: el.url,
          imageUrl: el.imageUrl,
          extraUrls: el.extraUrls || [],
          klingElementId: el.klingElementId || null,
          capturedAt: new Date().toISOString(),
        },
      });
      console.log(`[PromptSync] Persisted C&W element: ${el.name} (${el.id})`);
    }
  }
});

// handleAutoDownload + the promptsync-auto-download-ready listener now live in
// shared.js (universal across OpenArt and Google Flow).

// --- Direct generation: call OpenArt API without UI interaction ---

function directGenerate(params) {
  const requestId = `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ ok: false, error: "No response from page script" });
    }, 3600000);

    function handler(event) {
      if (event.data?.type === "promptsync-direct-generate-result" && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve(event.data);
      }
    }
    window.addEventListener("message", handler);
    window.postMessage({ type: "promptsync-direct-generate", ...params, requestId }, "*");
  });
}

async function collectCharVisualReferences(project, charSlug, views) {
  const refs = [];
  for (const view of views) {
    const key = `openart-res:${project}:${charSlug}:${view.slug}`;
    const stored = await new Promise((r) => chrome.storage.local.get(key, r));
    const refInfo = stored[key];
    if (refInfo?.resourceId && refInfo?.url) {
      refs.push({
        type: "image",
        id: refInfo.resourceId,
        url: refInfo.url,
        label: `image${refs.length + 1}`,
        name: `image${refs.length + 1}`,
        imageUrl: refInfo.url,
        metadata: { media_type: "image", width: 1024, height: 1024, format: null, file_size_bytes: 0 },
      });
    }
  }
  return refs;
}

async function generateCharViews(project, charSlug, onProgress) {
  const res = await fetch(`${PROMPTSYNC_API}/extension/character?project=${project}&char=${charSlug}`);
  if (!res.ok) throw new Error("Character not found");
  const char = await res.json();

  const viewsToGenerate = char.views.filter((v) => !v.has_image && v.prompt);
  if (!viewsToGenerate.length) throw new Error("All views already have images");

  showToast(`Generating ${viewsToGenerate.length} views for ${char.name}...`);
  onProgress?.({ phase: "started", total: viewsToGenerate.length });

  const results = [];
  for (let i = 0; i < viewsToGenerate.length; i++) {
    const view = viewsToGenerate[i];

    if (i > 0) {
      const delay = 5000 + Math.random() * 10000;
      console.log(`[PromptSync] Waiting ${Math.round(delay / 1000)}s before next character view...`);
      onProgress?.({ phase: "waiting", delay: Math.round(delay / 1000), index: i, total: viewsToGenerate.length });
      await new Promise((r) => setTimeout(r, delay));
    }

    const visualReferences = await collectCharVisualReferences(project, charSlug, char.views);
    console.log(`[PromptSync] Generating ${view.name} with ${visualReferences.length} visual references`);

    onProgress?.({ phase: "generating", view: view.name, viewSlug: view.slug, index: i, total: viewsToGenerate.length });

    const result = await directGenerate({
      prompt: view.prompt,
      aspectRatio: view.aspect_ratio || "9:16",
      resolution: view.resolution || "1K",
      visualReferences,
    });

    if (!result.ok) {
      console.warn(`[PromptSync] Generation failed for ${view.name}:`, result.error);
      onProgress?.({ phase: "failed", view: view.name, viewSlug: view.slug, index: i, total: viewsToGenerate.length });
      results.push({ view: view.slug, name: view.name, ok: false, error: result.error });
      continue;
    }

    try {
      const imgResp = await fetch(result.url);
      if (!imgResp.ok) throw new Error(`Fetch failed: ${imgResp.status}`);
      const blob = await imgResp.blob();

      const uploadResp = await fetch(
        `${PROMPTSYNC_API}/assets/${project}/characters/${charSlug}/${view.slug}/image/upload`,
        {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg", "X-OpenArt-Ref": result.url, ...(result.resourceId ? { "X-OpenArt-Resource-Id": result.resourceId } : {}) },
          body: blob,
        }
      );

      const uploadResult = await uploadResp.json();
      if (uploadResult.ok) {
        chrome.storage.local.set({
          [`openart-res:${project}:${charSlug}:${view.slug}`]: { resourceId: result.resourceId, url: result.url },
        });
        onProgress?.({ phase: "done", view: view.name, viewSlug: view.slug, index: i, total: viewsToGenerate.length });
      }
      results.push({ view: view.slug, name: view.name, ok: uploadResult.ok });
    } catch (err) {
      onProgress?.({ phase: "failed", view: view.name, viewSlug: view.slug, index: i, total: viewsToGenerate.length });
      results.push({ view: view.slug, name: view.name, ok: false, error: err.message });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  showToast(`Generated ${succeeded}/${viewsToGenerate.length} views for ${char.name}`);
  return results;
}
