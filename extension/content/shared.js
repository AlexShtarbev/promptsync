const PROMPTSYNC_API = "http://localhost:3456/api";

var _ps = { queue: Promise.resolve() };

async function fetchShot(project, code) {
  const res = await fetch(`${PROMPTSYNC_API}/extension/shot?project=${project}&code=${code}`);
  if (!res.ok) throw new Error(`Shot ${code} not found`);
  return res.json();
}

async function fetchIndex(project) {
  const res = await fetch(`${PROMPTSYNC_API}/extension/index?project=${project}`);
  if (!res.ok) throw new Error(`Project ${project} not found`);
  return res.json();
}

function copyFallback(text, shotCode) {
  navigator.clipboard.writeText(text).then(
    () => showToast(`Copied ${shotCode} to clipboard (inject failed)`),
    () => showToast(`Failed to copy ${shotCode}`, true)
  );
}

function showToast(message, isError = false) {
  const existing = document.getElementById("promptsync-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "promptsync-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "10px 18px",
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    color: "#fff",
    background: isError ? "#ef4444" : "#8b5cf6",
    zIndex: "999999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    transition: "opacity 0.3s",
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function stripVideoPromptMeta(body) {
  if (!body) return body;
  return body
    .replace(/^\[MOTION SCALE:[^\]]*\]\s*$/gm, "")
    .replace(/^Aspect ratio:.*$/gm, "")
    .replace(/^Negative prompt:.*$/gm, "")
    .replace(/\n---\n[\s\S]*$/, "")
    .trim();
}

function resolveElementMentions(prompt, _elementMap) {
  return prompt || "";
}

// Seedance references characters/worlds as OpenArt elements (by name, like Kling);
// the one reference image is the storyboard start frame, declared as @image1. Append
// that declaration if the body doesn't already carry it (bridges older prompt bodies).
function withSeedanceStartFrame(body) {
  if (!body) return body;
  if (/@image1\b/i.test(body)) return body;
  return `${body.trimEnd()}\n\nUse @image1 as start frame.`;
}

function getPromptForSite(shot, site) {
  if (site === "midjourney") {
    return shot.mjPrompt?.body ?? null;
  }
  if (site === "openart-video") {
    const isSeedance = shot.meta?.asset_type === "seedance";
    const raw = shot.klingPrompt?.body ?? shot.seedancePrompt?.body ?? null;
    const body = stripVideoPromptMeta(raw);
    return isSeedance ? withSeedanceStartFrame(body) : body;
  }
  if (site === "openart-image") {
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
  }
  if (site === "seedance") {
    return withSeedanceStartFrame(shot.seedancePrompt?.body ?? null);
  }
  if (site === "googleflow") {
    if (shot.mjPrompt?.meta?.platform === "googleflow") {
      return shot.mjPrompt.body;
    }
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
  }
  return null;
}

function findLargestVisibleImage() {
  const imgs = [...document.querySelectorAll("img")].filter((img) => {
    const r = img.getBoundingClientRect();
    if (r.width < 100 || r.height < 100) return false;
    const style = getComputedStyle(img);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (!img.src || img.src.startsWith("data:")) return false;
    return true;
  });

  if (!imgs.length) return null;

  return imgs.reduce((best, img) => {
    const area = img.naturalWidth * img.naturalHeight;
    const bestArea = best.naturalWidth * best.naturalHeight;
    return area > bestArea ? img : best;
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "inject-prompt") {
    handleInject(msg.project, msg.code, msg.site).then(sendResponse);
    return true;
  }
  if (msg.type === "inject-text") {
    const ok = injectIntoPage(msg.prompt, null);
    if (ok) {
      if (msg.autoDownload) {
        window.postMessage({ type: "promptsync-set-target", target: msg.autoDownload, prompt: msg.prompt }, "*");
      }
      if (msg.visualReferences?.length) {
        window.postMessage({
          type: "promptsync-set-visual-references",
          references: msg.visualReferences,
        }, "*");
      }
      showToast(`Injected ${msg.label || "prompt"}${msg.visualReferences?.length ? ` (+${msg.visualReferences.length} refs)` : ""}`);
      const outputSettings = msg.outputSettings;
      _ps.queue = _ps.queue.then(async () => {
        await new Promise((r) => setTimeout(r, 400));
        if (typeof clearAllReferences === "function") {
          await clearAllReferences();
        }
        if (outputSettings && typeof configureCharImageOutput === "function") {
          await configureCharImageOutput(outputSettings);
        }
      });
    }
    sendResponse({ ok, fallback: !ok });
    return true;
  }
  if (msg.type === "check-media-available") {
    const available = typeof isMediaDetailOpen === "function"
      ? isMediaDetailOpen()
      : msg.mediaType === "video" ? !!findLargestVisibleVideo() : !!findLargestVisibleImage();
    sendResponse({ available });
    return true;
  }
  if (msg.type === "download-image") {
    handleDownloadImage(msg.project, msg.code).then(sendResponse);
    return true;
  }
  if (msg.type === "download-video") {
    handleDownloadVideo(msg.project, msg.code).then(sendResponse);
    return true;
  }
  if (msg.type === "download-start-frame") {
    handleDownloadStartFrame(msg.project, msg.code).then(sendResponse);
    return true;
  }
  if (msg.type === "download-char-image") {
    handleDownloadCharImage(msg.project, msg.charSlug, msg.viewSlug).then(sendResponse);
    return true;
  }
  if (msg.type === "upload-char-images") {
    handleUploadCharImages(msg.imageUrls, msg.charName, msg.charDescription, msg.openartRefs).then(sendResponse);
    return true;
  }
  if (msg.type === "auto-generate-shot") {
    handleAutoGenerateShot(msg.project, msg.code, msg.site).then(sendResponse);
    return true;
  }
  if (msg.type === "auto-generate-shot-direct") {
    handleAutoGenerateShotDirect(msg.project, msg.code, msg.site, msg.visualReferences, msg.projectAspectRatio, msg.projectDefaultResolution).then(sendResponse);
    return true;
  }
  if (msg.type === "api-dry-run") {
    handleApiDryRun(msg.project, msg.code, msg.site, msg.projectAspectRatio, msg.projectDefaultResolution, msg.visualReferences).then(sendResponse);
    return true;
  }
  if (msg.type === "generate-char-views") {
    if (typeof generateCharViews !== "function") {
      sendResponse({ ok: false, error: "Only available on OpenArt" });
      return true;
    }
    generateCharViews(msg.project, msg.charSlug, (progress) => {
      chrome.runtime.sendMessage({ type: "gen-char-progress", charSlug: msg.charSlug, ...progress });
    }).then((results) => {
      sendResponse({ ok: true, results });
    }).catch((err) => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }
});

function findLargestVisibleVideo() {
  const videos = [...document.querySelectorAll("video")].filter((v) => {
    const r = v.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return false;
    const style = getComputedStyle(v);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (!v.src && !v.querySelector("source")?.src) return false;
    return true;
  });

  if (!videos.length) return null;

  return videos.reduce((best, v) => {
    const area = v.getBoundingClientRect().width * v.getBoundingClientRect().height;
    const bestArea = best.getBoundingClientRect().width * best.getBoundingClientRect().height;
    return area > bestArea ? v : best;
  });
}

// The video the user most recently clicked or played. A page can show many videos at
// once (a grid of results, a background hero player), so "largest on the page" picks the
// same clip for every shot — that's how 1A/1D/1E all ended up byte-identical. Tracking
// the user's last interaction lets a download grab the clip they actually selected.
var _lastInteractedVideo = null;

function videoFromInteraction(target) {
  if (!target || !target.closest) return null;
  // Clicked the video itself (or its <source>/poster inside the same element).
  const direct = target.closest("video");
  if (direct) return direct;
  // Clicked an overlay/button stacked over a card: climb to the nearest ancestor that
  // holds exactly one video and use that. Bail if an ancestor holds several — ambiguous.
  let el = target;
  for (let i = 0; i < 6 && el; i++) {
    const vids = el.querySelectorAll ? el.querySelectorAll("video") : [];
    if (vids.length === 1) return vids[0];
    if (vids.length > 1) return null;
    el = el.parentElement;
  }
  return null;
}

function rememberInteractedVideo(e) {
  const v = e.type === "play" ? e.target : videoFromInteraction(e.target);
  if (v && v.tagName === "VIDEO") _lastInteractedVideo = v;
}

// Capture phase so we still see the event even when the site stops propagation.
document.addEventListener("click", rememberInteractedVideo, true);
document.addEventListener("play", rememberInteractedVideo, true);

function pickVideoForDownload() {
  const v = _lastInteractedVideo;
  if (v && v.isConnected) {
    const r = v.getBoundingClientRect();
    const hasSrc = v.src || v.querySelector("source")?.src;
    // Offscreen is fine (still has a size); only reject removed/collapsed/hidden elements.
    if (hasSrc && r.width >= 50 && r.height >= 50) return v;
  }
  return findLargestVisibleVideo();
}

async function handleDownloadVideo(project, code) {
  const video = pickVideoForDownload();
  if (!video) {
    showToast("No video found on page", true);
    return { ok: false, error: "No video found" };
  }

  const videoSrc = video.src || video.querySelector("source")?.src;
  if (!videoSrc) {
    showToast("Video has no source URL", true);
    return { ok: false, error: "No video source" };
  }

  try {
    showToast(`Downloading video ${code}...`);
    const resp = await fetch(videoSrc);
    if (!resp.ok) throw new Error(`Video fetch failed: ${resp.status}`);
    const blob = await resp.blob();

    const uploadResp = await fetch(
      `${PROMPTSYNC_API}/assets/${project}/shots/${code}/video/upload`,
      {
        method: "POST",
        headers: { "Content-Type": blob.type || "video/mp4" },
        body: blob,
      }
    );

    const result = await uploadResp.json();
    if (result.ok) {
      showToast(`Saved video ${code}`);
    } else {
      showToast(`Save failed: ${result.error}`, true);
    }
    return result;
  } catch (err) {
    showToast(`Video download failed: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}

function getReactOnChange(el) {
  const propsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  return propsKey ? el[propsKey]?.onChange : null;
}

function triggerFileUpload(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;

  const onChange = getReactOnChange(input);
  if (onChange) {
    onChange({ target: input, currentTarget: input });
  } else {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function setReactInputValue(input, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    input.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype,
    "value"
  )?.set;
  if (nativeSetter) nativeSetter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillOpenArtField(labelText, value) {
  if (!value) return;
  const labels = document.querySelectorAll("label, span, div, p");
  for (const lbl of labels) {
    if (lbl.children.length > 2) continue;
    const t = lbl.textContent.trim().toLowerCase();
    if (t !== labelText.toLowerCase()) continue;

    let container = lbl.parentElement;
    for (let i = 0; i < 3 && container; i++) {
      const input = container.querySelector("input:not([type='file']):not([type='hidden']), textarea");
      if (input) {
        setReactInputValue(input, value);
        console.log(`[PromptSync] Set ${labelText}: ${value.slice(0, 50)}`);
        return true;
      }
      container = container.parentElement;
    }
  }
  console.warn(`[PromptSync] Field "${labelText}" not found`);
  return false;
}

async function handleUploadCharImages(imageUrls, charName, charDescription, openartRefs) {
  if (!imageUrls?.length) {
    return { ok: false, error: "No image URLs" };
  }

  // If all images have OpenArt refs, try to use them from history instead of uploading
  // This avoids re-uploading and uses the original generated images
  if (openartRefs?.length === imageUrls.length && typeof selectCharImagesFromHistory === "function") {
    console.log("[PromptSync] All char images have OpenArt refs, trying history selection");
    const historyResult = await selectCharImagesFromHistory(openartRefs, charName, charDescription);
    if (historyResult?.ok) return historyResult;
    console.log("[PromptSync] History selection failed, falling back to upload");
  }

  try {
    showToast(`Fetching ${imageUrls.length} images for ${charName}...`);

    const files = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const resp = await fetch(imageUrls[i]);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const file = new File([blob], `${charName.toLowerCase().replace(/\s+/g, "-")}-${i + 1}.${ext}`, { type: blob.type });
      files.push(file);
    }

    if (!files.length) {
      showToast("Failed to fetch images", true);
      return { ok: false, error: "Failed to fetch images" };
    }

    // Fill in Name and Background Story fields
    fillOpenArtField("Name", charName);
    fillOpenArtField("Background Story", charDescription);
    await new Promise((r) => setTimeout(r, 500));

    // Step 1: Upload primary image via the single-file input
    showToast(`Uploading primary image for ${charName}...`);
    const primaryInput = document.querySelector('input[type="file"]:not([multiple]):not([disabled])');
    if (!primaryInput) {
      showToast("No upload area found on page", true);
      return { ok: false, error: "No primary upload input found" };
    }
    triggerFileUpload(primaryInput, files[0]);

    if (files.length === 1) {
      showToast(`Uploaded 1 image for ${charName}`);
      return { ok: true, uploaded: 1 };
    }

    // Step 2: Wait for processing, then upload remaining via the multiple-file input
    await new Promise((r) => setTimeout(r, 3000));
    showToast(`Uploading ${files.length - 1} additional angles for ${charName}...`);

    let anglesInput = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      anglesInput = document.querySelector('input[type="file"][multiple]:not([disabled])');
      if (anglesInput) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!anglesInput) {
      showToast(`Uploaded 1/${files.length} — additional angles input not found`, true);
      return { ok: true, uploaded: 1 };
    }

    const dt = new DataTransfer();
    for (let i = 1; i < files.length; i++) {
      dt.items.add(files[i]);
    }
    anglesInput.files = dt.files;

    const onChange = getReactOnChange(anglesInput);
    if (onChange) {
      onChange({ target: anglesInput, currentTarget: anglesInput });
    } else {
      anglesInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    showToast(`Uploaded ${files.length} images for ${charName}`);
    return { ok: true, uploaded: files.length };
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}

async function handleDownloadCharImage(project, charSlug, viewSlug) {
  const img = findLargestVisibleImage();
  if (!img) {
    showToast("No image found on page", true);
    return { ok: false, error: "No image found" };
  }

  try {
    showToast(`Downloading ${charSlug} ${viewSlug}...`);
    const resp = await fetch(img.src);
    if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
    const blob = await resp.blob();

    const headers = { "Content-Type": blob.type || "image/png" };
    if (img.src && !img.src.startsWith("data:") && !img.src.startsWith("blob:")) {
      headers["X-OpenArt-Ref"] = img.src;
      console.log("[PromptSync] Storing OpenArt ref for char:", img.src);
    }

    const uploadResp = await fetch(
      `${PROMPTSYNC_API}/assets/${project}/characters/${charSlug}/${viewSlug}/image/upload`,
      {
        method: "POST",
        headers,
        body: blob,
      }
    );

    const result = await uploadResp.json();
    if (result.ok) {
      showToast(`Saved ${charSlug} - ${viewSlug}`);
    } else {
      showToast(`Save failed: ${result.error}`, true);
    }
    return result;
  } catch (err) {
    showToast(`Download failed: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}

async function handleDownloadStartFrame(project, code) {
  const img = findLargestVisibleImage();
  if (!img) {
    showToast("No image found on page", true);
    return { ok: false, error: "No image found" };
  }

  try {
    showToast(`Downloading start frame ${code}...`);
    const resp = await fetch(img.src);
    if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
    const blob = await resp.blob();

    const uploadResp = await fetch(
      `${PROMPTSYNC_API}/assets/${project}/shots/${code}/start-frame/upload`,
      {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/png" },
        body: blob,
      }
    );

    const result = await uploadResp.json();
    if (result.ok) {
      showToast(`Saved start frame ${code}`);
    } else {
      showToast(`Save failed: ${result.error}`, true);
    }
    return result;
  } catch (err) {
    showToast(`Download failed: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}

async function handleDownloadImage(project, code) {
  const img = findLargestVisibleImage();
  if (!img) {
    showToast("No image found on page", true);
    return { ok: false, error: "No image found" };
  }

  try {
    showToast(`Downloading ${code}...`);
    const resp = await fetch(img.src);
    if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
    const blob = await resp.blob();

    const headers = { "Content-Type": blob.type || "image/png" };
    if (img.src && !img.src.startsWith("data:") && !img.src.startsWith("blob:")) {
      headers["X-OpenArt-Ref"] = img.src;
      console.log("[PromptSync] Storing OpenArt ref:", img.src);
    }

    const uploadResp = await fetch(
      `${PROMPTSYNC_API}/assets/${project}/shots/${code}/image/upload`,
      {
        method: "POST",
        headers,
        body: blob,
      }
    );

    const result = await uploadResp.json();
    if (result.ok) {
      showToast(`Saved ${code} image`);
    } else {
      showToast(`Save failed: ${result.error}`, true);
    }
    return result;
  } catch (err) {
    showToast(`Download failed: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}

async function handleAutoGenerateShot(project, code, site) {
  const injectResult = await handleInject(project, code, site);
  if (!injectResult.ok || injectResult.fallback) {
    return { ok: false, error: injectResult.error || "Injection failed" };
  }

  await _ps.queue;
  await new Promise((r) => setTimeout(r, 800));

  if (typeof clickGenerateButton !== "function") {
    return { ok: false, error: "Not on OpenArt" };
  }

  // Re-assert target right before Generate in case another injection changed it
  const target = { type: "shot", project, code };
  window.postMessage({ type: "promptsync-set-target", target }, "*");

  const clicked = await clickGenerateButton();
  if (!clicked) {
    return { ok: false, error: "Generate button not found" };
  }

  return { ok: true };
}

async function handleApiDryRun(project, code, site, projectAspectRatio, projectDefaultResolution, visualReferences) {
  if (typeof directGenerate !== "function") {
    return { ok: false, error: "Direct generation only available on OpenArt" };
  }

  const defaultAr = projectAspectRatio || "9:16";
  const defaultRes = projectDefaultResolution || "1K";

  const shot = await fetchShot(project, code);
  const rawPrompt = getPromptForSite(shot, site);
  if (!rawPrompt) return { ok: false, error: `No ${site} prompt for ${code}` };
  const prompt = resolveElementMentions(rawPrompt, shot.elementMap);

  const ar = shot.nanoBanana?.meta?.ar || shot.meta?.aspect_ratio || defaultAr;
  const target = { type: "shot", project, code };
  window.postMessage({ type: "promptsync-set-target", target }, "*");

  let transformedPrompt = prompt;
  for (const ref of (visualReferences || [])) {
    if (ref.id && (ref.elementName || ref.name)) {
      if (ref.elementName) transformedPrompt = transformedPrompt.replaceAll(`@${ref.elementName}`, `@${ref.id}`);
      if (ref.name && ref.name !== ref.elementName) transformedPrompt = transformedPrompt.replaceAll(`@${ref.name}`, `@${ref.id}`);
    }
  }

  showToast(`Generating ${code}...`);

  const result = await directGenerate({
    prompt: transformedPrompt,
    aspectRatio: ar,
    resolution: defaultRes,
    visualReferences: visualReferences || [],
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    const imgResp = await fetch(result.url);
    if (!imgResp.ok) throw new Error(`Image fetch failed: ${imgResp.status}`);
    const blob = await imgResp.blob();

    const uploadResp = await fetch(
      `${PROMPTSYNC_API}/assets/${project}/shots/${code}/image/upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "image/jpeg",
          "X-OpenArt-Ref": result.url,
        },
        body: blob,
      }
    );

    const uploadResult = await uploadResp.json();
    if (uploadResult.ok) {
      showToast(`Saved ${code}`);
      chrome.runtime.sendMessage({
        type: "auto-download-complete",
        target,
        thumbnailUrl: result.thumbnailUrl || null,
        resourceId: result.resourceId,
        imageUrl: result.url,
      });
      return { ok: true };
    }
    return { ok: false, error: uploadResult.error || "Upload failed" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleAutoGenerateShotDirect(project, code, site, visualReferences, projectAspectRatio, projectDefaultResolution) {
  if (typeof directGenerate !== "function") {
    return { ok: false, error: "Direct generation only available on OpenArt" };
  }

  const defaultAr = projectAspectRatio || "9:16";
  const defaultRes = projectDefaultResolution || "1K";

  const shot = await fetchShot(project, code);
  const rawPrompt = getPromptForSite(shot, site);
  if (!rawPrompt) return { ok: false, error: `No ${site} prompt for ${code}` };
  const prompt = resolveElementMentions(rawPrompt, shot.elementMap);

  const target = { type: "shot", project, code };
  window.postMessage({ type: "promptsync-set-target", target }, "*");

  const refs = visualReferences || [];

  let transformedPrompt = prompt;
  for (const ref of refs) {
    if (ref.id && (ref.elementName || ref.name)) {
      if (ref.elementName) transformedPrompt = transformedPrompt.replaceAll(`@${ref.elementName}`, `@${ref.id}`);
      if (ref.name && ref.name !== ref.elementName) transformedPrompt = transformedPrompt.replaceAll(`@${ref.name}`, `@${ref.id}`);
    }
  }

  console.log(`[PromptSync] Direct generating ${code} with ${refs.length} visual references`);
  showToast(`Generating ${code}${refs.length ? ` with ${refs.length} references` : ""}...`);

  const ar = shot.nanoBanana?.meta?.ar || shot.meta?.aspect_ratio || defaultAr;

  const result = await directGenerate({
    prompt: transformedPrompt,
    aspectRatio: ar,
    resolution: defaultRes,
    visualReferences: refs,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    const imgResp = await fetch(result.url);
    if (!imgResp.ok) throw new Error(`Image fetch failed: ${imgResp.status}`);
    const blob = await imgResp.blob();

    const uploadResp = await fetch(
      `${PROMPTSYNC_API}/assets/${project}/shots/${code}/image/upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "image/jpeg",
          "X-OpenArt-Ref": result.url,
        },
        body: blob,
      }
    );

    const uploadResult = await uploadResp.json();
    if (uploadResult.ok) {
      showToast(`Saved ${code} (with ${refs.length} references)`);
      chrome.runtime.sendMessage({
        type: "auto-download-complete",
        target,
        thumbnailUrl: result.thumbnailUrl || null,
        resourceId: result.resourceId,
        imageUrl: result.url,
      });
      return { ok: true };
    }
    return { ok: false, error: uploadResult.error || "Upload failed" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleInject(project, code, site) {
  try {
    const shot = await fetchShot(project, code);
    const rawPrompt = getPromptForSite(shot, site);
    if (!rawPrompt) {
      showToast(`No ${site} prompt for ${code}`, true);
      return { ok: false };
    }
    const prompt = resolveElementMentions(rawPrompt, shot.elementMap);

    const injected = injectIntoPage(prompt, shot, project);
    if (!injected) {
      copyFallback(prompt, code);
      return { ok: true, fallback: true };
    }

    const target = { type: "shot", project, code };
    window.postMessage({ type: "promptsync-set-target", target, prompt }, "*");

    showToast(`Injected ${code}`);
    const newStatus = site === "openart-video" ? "kling-ready" : "mj-ready";
    fetch(`${PROMPTSYNC_API}/projects/${project}/shots/${code}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}

// --- Auto-download: save a finished generation back to the platform ---
// Universal across sites. OpenArt's MAIN-world page script posts a
// `promptsync-auto-download-ready` window message; Google Flow's content script
// calls handleAutoDownload() directly. The upload triggers the platform file
// watcher → WebSocket → live UI refresh.

const handledAutoDownloads = new Set();

window.addEventListener("message", (event) => {
  if (event.data?.type === "promptsync-auto-download-ready") {
    handleAutoDownload(event.data);
  }
});

async function handleAutoDownload({ url, thumbnailUrl, resourceId, creationType, target }) {
  if (resourceId && handledAutoDownloads.has(resourceId)) return;
  if (resourceId) handledAutoDownloads.add(resourceId);

  if (!target) {
    console.log("[PromptSync] Auto-download ready but no target, skipping");
    return;
  }

  console.log("[PromptSync] Auto-downloading:", url, "for", target.type, target.code || target.charSlug);

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Media fetch: ${resp.status}`);
    const blob = await resp.blob();

    // Treat the generation as video when the site says so, or the fetched bytes are video.
    // Without this, a shot's video generation gets POSTed to the IMAGE endpoint, which
    // deletes the storyboard still and writes unrenderable video bytes in its place —
    // the shot then "disappears" from the board.
    const isVideo = creationType === "video" || (blob.type || "").startsWith("video/");

    let uploadUrl;
    let label;
    if (target.type === "shot") {
      uploadUrl = isVideo
        ? `${PROMPTSYNC_API}/assets/${target.project}/shots/${target.code}/video/upload`
        : `${PROMPTSYNC_API}/assets/${target.project}/shots/${target.code}/image/upload`;
      label = target.code;
    } else if (target.type === "char") {
      if (isVideo) {
        // Characters are stills only — never overwrite a reference sheet with video.
        console.warn("[PromptSync] Ignoring video auto-download for character target", target.charSlug);
        showToast(`Skipped video for ${target.charSlug} (characters are stills only)`, true);
        return;
      }
      uploadUrl = `${PROMPTSYNC_API}/assets/${target.project}/characters/${target.charSlug}/${target.viewSlug}/image/upload`;
      label = `${target.charSlug} - ${target.viewSlug}`;
    }

    if (!uploadUrl) return;

    const headers = isVideo
      ? { "Content-Type": (blob.type || "").startsWith("video/") ? blob.type : "video/mp4" }
      : (() => {
          const h = { "Content-Type": blob.type || "image/jpeg", "X-OpenArt-Ref": url };
          if (resourceId) h["X-OpenArt-Resource-Id"] = resourceId;
          return h;
        })();

    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: blob,
    });

    const result = await uploadResp.json();
    if (result.ok) {
      showToast(`Auto-saved ${label}`);
      if (target.type === "char" && resourceId) {
        chrome.storage.local.set({
          [`openart-res:${target.project}:${target.charSlug}:${target.viewSlug}`]: { resourceId, url },
        });
      }
      chrome.runtime.sendMessage({
        type: "auto-download-complete",
        target,
        thumbnailUrl,
        resourceId,
        imageUrl: url,
        isVideo,
      });
    } else {
      showToast(`Auto-save failed: ${result.error}`, true);
    }
  } catch (err) {
    console.warn("[PromptSync] Auto-download failed:", err.message);
    showToast(`Auto-download failed: ${err.message}`, true);
  }
}
