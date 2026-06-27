// Runs in MAIN world (page context) to intercept OpenArt API calls.
// Communicates with content script via window.postMessage.

(function () {
  const origFetch = window.fetch;
  const state = {
    currentTarget: null,
    pendingVisualReferences: null,
    pendingElementIdMap: null,
    capturedProjectId: null,
    generationObserver: null,
    knownThumbs: new Set(
      [...document.querySelectorAll('img[alt="Thumbnail"]')]
        .map((img) => img.src)
        .filter(Boolean)
    ),
  };
  const pendingResources = new Map();
  const resolvedResources = new Set();

  window.addEventListener("message", (event) => {
    if (event.data?.type === "promptsync-clear-pending") {
      pendingResources.clear();
      state.currentTarget = null;
    }
    if (event.data?.type === "promptsync-set-target") {
      state.currentTarget = event.data.target;
    }
    if (event.data?.type === "promptsync-direct-generate") {
      handleDirectGenerate(event.data);
    }
    if (event.data?.type === "promptsync-set-project-id") {
      state.capturedProjectId = event.data.projectId;
      fetchCwElements();
    }
    if (event.data?.type === "promptsync-set-visual-references") {
      state.pendingVisualReferences = event.data.references;
    }
    if (event.data?.type === "promptsync-set-element-id-map") {
      state.pendingElementIdMap = event.data.idMap;
    }
  });

  async function handleDirectGenerate({ requestId, prompt, model, aspectRatio, resolution, autoEnhancePrompt, visualReferences, projectId }) {
    const pid = projectId || state.capturedProjectId;
    if (!pid) {
      window.postMessage({ type: "promptsync-direct-generate-result", requestId, ok: false, error: "No projectId — navigate to OpenArt and wait for page to load" }, "*");
      return;
    }

    const modelSlug = model || "nano-banana-2";
    const apiUrl = `/suite/api/forms/creations/create-image%3Areference%3A${modelSlug}`;

    try {
      const resp = await origFetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          imageCount: 1,
          aspectRatio: aspectRatio || "9:16",
          resolution: resolution || "1K",
          autoEnhancePrompt: autoEnhancePrompt ?? true,
          visualReferences: visualReferences || [],
          enableUnlimited: true,
          model: modelSlug,
          projectId: pid,
          folderId: null,
        }),
      });

      const data = await resp.json();
      console.log("[PromptSync] Direct generate response:", data);

      if (!data.resourceIds?.length) {
        window.postMessage({ type: "promptsync-direct-generate-result", requestId, ok: false, error: "No resourceIds in response" }, "*");
        return;
      }

      const resourceId = data.resourceIds[0];

      await new Promise((r) => setTimeout(r, 10000));
      for (let attempt = 0; attempt < 700; attempt++) {
        try {
          const resResp = await origFetch(`/suite/api/resources/${resourceId}`);
          if (resResp.ok) {
            const { data: resData } = await resResp.json();
            if (resData?.url) {
              console.log("[PromptSync] Direct generate complete:", resourceId);
              window.postMessage({
                type: "promptsync-direct-generate-result",
                requestId,
                ok: true,
                resourceId,
                url: resData.url,
                thumbnailUrl: resData.thumbnailUrl || null,
              }, "*");
              return;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 5000));
      }

      window.postMessage({ type: "promptsync-direct-generate-result", requestId, ok: false, error: "Generation timed out" }, "*");
    } catch (err) {
      window.postMessage({ type: "promptsync-direct-generate-result", requestId, ok: false, error: err.message }, "*");
    }
  }

  // Auto-capture projectId from /projects/default response on page load
  function captureProjectIdFromResponse(url, data) {
    if (!state.capturedProjectId && data?.projectId) {
      state.capturedProjectId = data.projectId;
      console.log("[PromptSync] Auto-captured projectId:", state.capturedProjectId);
      window.postMessage({ type: "promptsync-project-id-captured", projectId: state.capturedProjectId }, "*");
      fetchCwElements();
    }
  }

  async function fetchCwElements() {
    if (!state.capturedProjectId) return;
    try {
      const elements = [];
      for (const featureType of ["character", "background"]) {
        const resp = await origFetch(
          `/suite/api/character/list?status=completed&featureTypes=${featureType}&projectId=${state.capturedProjectId}&limit=50`
        );
        if (!resp.ok) continue;
        const data = await resp.json();
        if (!data.characters?.length) continue;

        for (const c of data.characters) {
          const name = (c.characterName || c.worldName || "").trim();
          if (!name) continue;
          const primaryUrl = c.imageUrls?.[0] || "";
          elements.push({
            id: c.id,
            name,
            label: name,
            type: c.featureType || featureType,
            url: primaryUrl,
            imageUrl: primaryUrl,
            extraUrls: c.imageUrls?.slice(1) || [],
            klingElementId: c.klingElementId || null,
          });
        }
      }

      if (!elements.length) return;

      window.postMessage({
        type: "promptsync-cw-elements-captured",
        elements,
      }, "*");

      console.log("[PromptSync] Fetched C&W elements:", elements.map(e => `${e.name} (${e.type})`));
    } catch (err) {
      console.warn("[PromptSync] Failed to fetch C&W elements:", err.message);
    }
  }

  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    const method = (args[1]?.method || "GET").toUpperCase();

    const isCreation = method === "POST" && url.includes("/suite/api/forms/creations/");
    const snapshotTarget = isCreation ? state.currentTarget : null;
    if (isCreation) state.currentTarget = null;

    let requestBody = null;
    if (isCreation) {
      try {
        const raw = args[1]?.body;
        if (raw instanceof FormData) {
          requestBody = {};
          for (const [k, v] of raw.entries()) {
            requestBody[k] = v instanceof File ? `[File: ${v.name}, ${v.type}, ${v.size}b]` : v;
          }
        } else if (typeof raw === "string") {
          requestBody = JSON.parse(raw);
        } else if (raw instanceof Blob) {
          requestBody = `[Blob: ${raw.type}, ${raw.size}b]`;
        } else {
          requestBody = raw;
        }
      } catch {
        requestBody = "[could not parse]";
      }
    }

    if (isCreation && state.pendingVisualReferences?.length) {
      try {
        const raw = args[1]?.body;
        if (typeof raw === "string") {
          const body = JSON.parse(raw);
          body.visualReferences = [...(body.visualReferences || []), ...state.pendingVisualReferences];
          args[1] = { ...args[1], body: JSON.stringify(body) };
          requestBody = body;
        }
      } catch {}
      state.pendingVisualReferences = null;
    }

    if (isCreation && state.pendingElementIdMap) {
      try {
        const raw = args[1]?.body;
        if (typeof raw === "string") {
          const body = JSON.parse(raw);
          if (body.prompt && typeof body.prompt === "string") {
            for (const [name, id] of Object.entries(state.pendingElementIdMap)) {
              body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
            }
            args[1] = { ...args[1], body: JSON.stringify(body) };
            requestBody = body;
          }
        }
      } catch {}
      state.pendingElementIdMap = null;
    }

    const response = await origFetch.apply(this, args);

    // Capture projectId from /projects/default (called on every page load)
    if (!state.capturedProjectId && url.includes("/suite/api/projects/default")) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        captureProjectIdFromResponse(url, data);
      } catch {}
    }

    if (isCreation) {
      try {
        const clone = response.clone();
        const data = await clone.json();

        if (requestBody?.projectId) state.capturedProjectId = requestBody.projectId;

        window.postMessage({
          type: "promptsync-generation-captured",
          url,
          requestBody,
          responseData: data,
        }, "*");

        if (requestBody?.visualReferences?.length) {
          const cwElements = requestBody.visualReferences.filter(ref => ref.type === "character" || ref.type === "world");
          if (cwElements.length) {
            window.postMessage({
              type: "promptsync-cw-elements-captured",
              elements: cwElements.map(el => ({
                id: el.id,
                name: el.name,
                label: el.label || el.name,
                type: el.type === "world" ? "background" : "character",
                url: el.url,
                imageUrl: el.imageUrl,
                extraUrls: el.extraUrls || [],
                klingElementId: el.klingElementId || null,
              })),
            }, "*");
          }
        }

        if (data.resourceIds?.length) {
          const creationType = url.includes("create-video") || url.includes("animate-video") ? "video" : "image";
          for (const rid of data.resourceIds) {
            pendingResources.set(rid, { creationType, target: snapshotTarget });
            pollResource(rid);
          }
          ensureObserver();
        }
      } catch {}
    }

    return response;
  };

  function ensureObserver() {
    if (state.generationObserver) return;

    state.knownThumbs = new Set(
      [...document.querySelectorAll('img[alt="Thumbnail"]')]
        .map((img) => img.src)
        .filter(Boolean)
    );

    state.generationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const checkImg = (img) => {
          if (img.alt !== "Thumbnail" || !img.src || state.knownThumbs.has(img.src)) return;
          state.knownThumbs.add(img.src);
          onThumbnailDetected(img.src);
        };

        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === "IMG") checkImg(node);
            if (node.querySelectorAll) {
              node.querySelectorAll('img[alt="Thumbnail"]').forEach(checkImg);
            }
          }
        }

        if (
          m.type === "attributes" &&
          m.attributeName === "src" &&
          m.target.tagName === "IMG" &&
          m.target.alt === "Thumbnail" &&
          !state.knownThumbs.has(m.target.src)
        ) {
          state.knownThumbs.add(m.target.src);
          onThumbnailDetected(m.target.src);
        }
      }
    });

    state.generationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });

    setTimeout(() => {
      if (state.generationObserver) {
        state.generationObserver.disconnect();
        state.generationObserver = null;
      }
    }, 300000);
  }

  function stopObserverIfIdle() {
    if (pendingResources.size === 0 && state.generationObserver) {
      state.generationObserver.disconnect();
      state.generationObserver = null;
    }
  }

  async function onThumbnailDetected(thumbnailUrl) {
    for (const [resourceId, gen] of pendingResources.entries()) {
      if (resolvedResources.has(resourceId)) continue;
      try {
        const resp = await origFetch(`/suite/api/resources/${resourceId}`);
        if (!resp.ok) continue;
        const { data } = await resp.json();
        if (!data?.url) continue;

        resolvedResources.add(resourceId);
        pendingResources.delete(resourceId);
        stopObserverIfIdle();

        console.log("[PromptSync] Thumbnail triggered resolution of resource:", resourceId);
        window.postMessage({
          type: "promptsync-auto-download-ready",
          url: data.url,
          thumbnailUrl: data.thumbnailUrl || thumbnailUrl,
          resourceId,
          creationType: gen.creationType,
          target: gen.target,
        }, "*");
        return;
      } catch { continue; }
    }
  }

  async function pollResource(resourceId) {
    await new Promise((r) => setTimeout(r, 10000));

    for (let attempt = 0; attempt < 36; attempt++) {
      if (resolvedResources.has(resourceId)) return;

      try {
        const resp = await origFetch(`/suite/api/resources/${resourceId}`);
        if (!resp.ok) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        const { data } = await resp.json();
        if (data?.url) {
          if (resolvedResources.has(resourceId)) return;
          resolvedResources.add(resourceId);

          const gen = pendingResources.get(resourceId);
          pendingResources.delete(resourceId);
          stopObserverIfIdle();

          console.log("[PromptSync] Poll resolved resource:", resourceId);
          window.postMessage(
            {
              type: "promptsync-auto-download-ready",
              url: data.url,
              thumbnailUrl: data.thumbnailUrl || null,
              resourceId,
              creationType: gen?.creationType || "image",
              target: gen?.target || null,
            },
            "*"
          );
          return;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 5000));
    }

    pendingResources.delete(resourceId);
    stopObserverIfIdle();
  }

  // --- React-based visual reference selection ---

  function findVisualReferencesComponent() {
    const all = document.querySelectorAll("div");
    for (const el of all) {
      const fk = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
      if (!fk) continue;
      let f = el[fk];
      let d = 0;
      while (f && d < 5) {
        if (f.type?.name === "VisualReferences") return f;
        f = f.return;
        d++;
      }
    }
    return null;
  }

  function findOnChangeComponent(fiber) {
    if (!fiber) return null;
    if (fiber.memoizedProps?.onChange && fiber.memoizedProps?.values !== undefined) {
      return fiber.memoizedProps;
    }
    let result = findOnChangeComponent(fiber.child);
    if (result) return result;
    return findOnChangeComponent(fiber.sibling);
  }

  window.addEventListener("message", (event) => {
    if (event.data?.type !== "promptsync-select-visual-refs") return;
    const { requestId, references } = event.data;

    const vrFiber = findVisualReferencesComponent();
    if (!vrFiber) {
      window.postMessage({ type: "promptsync-select-visual-refs-result", requestId, ok: false, error: "VisualReferences component not found" }, "*");
      return;
    }

    const dProps = findOnChangeComponent(vrFiber);
    if (!dProps) {
      window.postMessage({ type: "promptsync-select-visual-refs-result", requestId, ok: false, error: "onChange component not found" }, "*");
      return;
    }

    const newRefs = references || [];
    dProps.onChange(newRefs);

    console.log(`[PromptSync:React] Set ${newRefs.length} visual references`);
    window.postMessage({ type: "promptsync-select-visual-refs-result", requestId, ok: true, added: newRefs.length }, "*");
  });

})();
