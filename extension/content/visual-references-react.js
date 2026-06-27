// Programmatic visual reference selection via React component internals.
// Runs in the content script world; delegates React fiber access to the
// page script (openart-page.js) via window.postMessage since content
// scripts cannot see expando properties like __reactFiber.

// eslint-disable-next-line no-unused-vars
var visualReferencesReact = (function () {

  function cwDataToVisualRef(cw) {
    const urlPath = (cw.url || "").split("/").pop() || "";
    const ext = urlPath.includes(".") ? urlPath.split(".").pop().split("?")[0] : "png";
    return {
      id: cw.id,
      sourceType: "upload",
      userId: "current-user",
      url: cw.imageUrl || cw.url,
      resourceType: cw.type === "background" ? "world" : "character",
      status: "completed",
      isStarred: false,
      isDownloaded: false,
      createdAt: Date.now(),
      input: {
        referenceType: cw.type === "background" ? "world" : "character",
        label: cw.label || cw.name,
        name: cw.name,
        imageUrl: cw.imageUrl || cw.url,
        extraUrls: cw.extraUrls || [],
        klingElementId: cw.klingElementId || null,
      },
      metadata: {
        media_type: "image",
        format: ext,
        width: 1024,
        height: 1024,
        file_size_bytes: 0,
      },
    };
  }

  function sendToPageScript(references) {
    return new Promise((resolve) => {
      const requestId = `vr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({ ok: false, error: "Page script did not respond" });
      }, 5000);

      function handler(event) {
        if (event.data?.type === "promptsync-select-visual-refs-result" && event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data);
        }
      }
      window.addEventListener("message", handler);
      window.postMessage({ type: "promptsync-select-visual-refs", requestId, references }, "*");
    });
  }

  async function selectElements(names, storageGet) {
    if (!names.length) return { ok: true, added: 0 };

    const lookup = storageGet || ((key) => new Promise((r) => chrome.storage.local.get(key, r)));

    const refs = [];
    const missing = [];
    const idMap = {};
    for (const name of names) {
      const key = `openart-cw:${name.toLowerCase()}`;
      const stored = await lookup(key);
      const cw = stored[key];
      if (!cw) {
        missing.push(name);
        continue;
      }
      refs.push(cwDataToVisualRef(cw));
      if (cw.id) idMap[name] = cw.id;
    }

    if (missing.length) {
      console.warn("[PromptSync:React] No cached C&W data for:", missing.join(", "));
    }

    if (!refs.length) {
      return { ok: false, error: "No C&W data found for any element", idMap };
    }

    const result = await sendToPageScript(refs);
    if (result.ok) {
      console.log(`[PromptSync:React] Selected ${result.added} visual references via React`);
    }
    result.idMap = idMap;
    return result;
  }

  function clearElements() {
    return sendToPageScript([]);
  }

  return {
    selectElements,
    clearElements,
    cwDataToVisualRef,
  };
})();
