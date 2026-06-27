// MAIN-world script for Google Flow. Two jobs:
//
// 1. (ALWAYS) Auto-download correlation. The isolated content-script world
//    (googleflow.js) cannot see Flow's own fetch/XHR, so it used to guess which
//    finished image belonged to which shot by watching the DOM and pairing in
//    FIFO-by-completion order. Concurrent runs finish out of order, so that mixed
//    downloads up. Here in the PAGE world we DO see the generation network call:
//    Flow POSTs `…/flowMedia:batchGenerateImages` and the RESPONSE carries
//    `media[].name`, which is exactly the result image's getMediaUrlRedirect
//    `?name=`. So we bind each shot to its generation REQUEST (armed at the Create
//    click, FIFO by request order) and emit a precise auto-download from that
//    request's RESPONSE — completion order no longer matters. This mirrors
//    OpenArt's resourceId→target map in openart-page.js.
//
// 2. (DEBUG ONLY) A verbose network probe, for diagnosing future changes.
//    Enable with (then reload):  localStorage.setItem("promptsync-debug", "1")
//
// It NEVER blocks or alters requests — it wraps fetch/XHR, observes, forwards.

// --- correlation core (pure, unit-tested) ------------------------------------

// The generation calls whose response carries the result media name(s).
function flowIsGenerationRequest(url) {
  return /flowMedia:batchGenerate(?:Images|Videos)\b/.test(url || "");
}
function flowIsVideoRequest(url) {
  return /:batchGenerateVideos\b/.test(url || "");
}
function flowMediaRedirectUrl(name) {
  return (
    "https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=" +
    encodeURIComponent(name)
  );
}

// Normalize free text to a lowercase alphanumeric-run form, so matching a prompt
// against a request body is robust to JSON escaping, whitespace and punctuation
// differences between what we injected and what Flow echoes back.
function flowNormalizeText(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// A distinctive head slice of a prompt, used to recognize that prompt inside a
// generation request body. Empty when the prompt is too short to match safely.
function flowPromptFingerprint(prompt) {
  const norm = flowNormalizeText(prompt);
  return norm.length >= 24 ? norm.slice(0, 80) : "";
}

// Pick the target for a generation request. PRIMARY: match the request body's
// prompt against the armed targets and consume the one that actually produced this
// request. This is correct even when arms and requests desync — creation-agent mode
// firing a non-generation call, concurrent runs reordering clicks vs requests,
// retries, or extra/missing requests — any of which silently shifts a pure FIFO and
// saves every image to the wrong character.
//
// FALLBACKS, in order: (a) FIFO by request order among armed targets; (b) the last
// set-target, but ONLY when the request body actually carries that injected prompt.
// Without (b)'s content gate, an un-armed generation the user starts on their own —
// e.g. EDITING an existing image after we injected a prompt they never ran — would
// be auto-downloaded onto that injected target. Returns null when nothing matches,
// which suppresses the auto-download.
//
// Armed entries are { target, fp }; state.lastFp is the fingerprint of the prompt
// that accompanied the last set-target.
function flowTakeRequestTarget(state, requestBody) {
  const body = flowNormalizeText(requestBody);
  if (body) {
    for (let i = 0; i < state.armed.length; i++) {
      const fp = state.armed[i] && state.armed[i].fp;
      if (fp && body.includes(fp)) return state.armed.splice(i, 1)[0].target;
    }
  }
  if (state.armed.length) return state.armed.shift().target;
  if (state.lastTarget && state.lastFp && body.includes(state.lastFp)) return state.lastTarget;
  return null;
}

// Build the auto-download payload(s) for a generation response. Each media item's
// `name` IS the result image's ?name=, so this correlation is exact and
// independent of which generation finished first.
function flowDownloadsFromResponse(target, isVideo, data) {
  const media = (data && data.media) || [];
  const out = [];
  for (const m of media) {
    if (!m || !m.name) continue;
    out.push({
      type: "promptsync-auto-download-ready",
      url: flowMediaRedirectUrl(m.name),
      thumbnailUrl: flowMediaRedirectUrl(m.name),
      resourceId: m.name,
      creationType: isVideo ? "video" : "image",
      target: target || null,
    });
  }
  return out;
}

// --- wiring ------------------------------------------------------------------

(function () {
  const TAG = "[Flow net]";
  let DEBUG = false;
  try {
    DEBUG = !!window.localStorage.getItem("promptsync-debug");
  } catch (e) {}

  // Targets armed at Create clicks (FIFO), and a fallback from set-target.
  const state = { armed: [], lastTarget: null, lastFp: "" };
  window.addEventListener("message", (e) => {
    const d = e && e.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "promptsync-flow-arm") state.armed.push({ target: d.target || null, fp: flowPromptFingerprint(d.prompt) });
    else if (d.type === "promptsync-set-target") {
      state.lastTarget = d.target || null;
      state.lastFp = flowPromptFingerprint(d.prompt);
    }
  });

  // When a generation request's response resolves, emit the precise auto-download.
  function onGenerationResponse(target, isVideo, promise) {
    Promise.resolve(promise)
      .then((resp) => {
        let clone;
        try {
          clone = resp.clone();
        } catch (e) {
          return;
        }
        clone
          .json()
          .then((data) => {
            const downloads = flowDownloadsFromResponse(target, isVideo, data);
            if (DEBUG) {
              console.log(
                TAG,
                "generation result ->",
                JSON.stringify(downloads.map((d) => ({ code: d.target && d.target.code, name: d.resourceId })))
              );
            }
            for (const msg of downloads) window.postMessage(msg, "*");
          })
          .catch(() => {});
      })
      .catch(() => {});
  }

  // --- debug-only network probe helpers ---
  function label(url) {
    try {
      const u = new URL(url, location.href);
      const fx = /\/fx\/api\/(?:trpc\/)?([^?]+)/.exec(u.pathname);
      return fx ? decodeURIComponent(fx[1]) : u.host + u.pathname;
    } catch (e) {
      return url || "";
    }
  }
  function interesting(url, method) {
    if (!url) return false;
    const u = url.toLowerCase();
    if (/submitbatchlog|\/log\b|logging|analytics|clientstreamz|play\.google|doubleclick|gstatic|fonts\./.test(u)) {
      return false;
    }
    if ((method || "GET").toUpperCase() !== "GET") return true;
    return /generate|imagefx|videofx|batchasync|:run|\bstream\b/.test(u);
  }
  function shortStack() {
    const s = new Error().stack || "";
    return s.split("\n").slice(3, 7).map((l) => l.trim()).join("  <  ");
  }
  function preview(body) {
    if (typeof body !== "string") return body ? `[${body.constructor?.name || "body"}]` : "";
    return body.length > 400 ? body.slice(0, 400) + "…" : body;
  }
  const KNOWN = /checkappavailability|batchlogfrontendevents|fetchuserrecommendations|getusersettings|getflowappconfig|uploadimage|submitbatchlog|getmediaurlredirect/i;
  function emit(kind, method, lbl, body) {
    const t = `+${performance.now().toFixed(0)}ms`;
    if (!KNOWN.test(lbl)) {
      console.warn(TAG, "🚨 CANDIDATE (possible generation)", t, kind, method, lbl, preview(body));
      console.warn(TAG, "  ↳ from:", shortStack());
    } else {
      console.log(TAG, t, kind, method, lbl, preview(body));
    }
  }
  function extractIds(txt) {
    if (typeof txt !== "string") return [];
    const ids = new Set();
    const keyRe = /"(name|mediaId|mediaKey|mediaGenerationId|id|operation|operationName|workflowId|sceneId|generationId|resourceId)"\s*:\s*"([^"]{6,})"/gi;
    let m;
    while ((m = keyRe.exec(txt))) ids.add(`${m[1]}=${m[2]}`);
    const nameRe = /getMediaUrlRedirect\?name=([^"'&\\\s]+)/gi;
    while ((m = nameRe.exec(txt))) ids.add(`url.name=${decodeURIComponent(m[1])}`);
    return [...ids].slice(0, 16);
  }
  function captureResponse(lbl, promise) {
    Promise.resolve(promise)
      .then((resp) => {
        try {
          resp.clone().text().then((txt) => {
            console.warn(TAG, "  ↳ RESPONSE", lbl, preview(txt));
            const ids = extractIds(txt);
            if (ids.length) console.warn(TAG, "  ↳ candidate ids:", ids);
          }).catch(() => {});
        } catch (e) {}
      })
      .catch(() => {});
  }

  // --- fetch hook: correlation (always) + probe (debug) ---
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    let gen = null;
    let candidateLbl = null;
    try {
      const url = typeof input === "string" ? input : input && input.url;
      const method = (init && init.method) || (typeof input === "object" && input && input.method) || "GET";
      if (flowIsGenerationRequest(url)) {
        const rawBody = (init && init.body != null) ? init.body
          : (typeof input === "object" && input && input.body != null ? input.body : "");
        const body = typeof rawBody === "string" ? rawBody : "";
        gen = { target: flowTakeRequestTarget(state, body), isVideo: flowIsVideoRequest(url) };
        // Tell the panel a generation is now in-flight for this target, so it can
        // show the orbiting indicator until the upload completes.
        if (gen.target) {
          try {
            window.postMessage({ type: "promptsync-generation-start", target: gen.target, isVideo: gen.isVideo }, "*");
          } catch (e) {}
        }
        if (DEBUG) {
          console.log(TAG, "generation request bound to", gen.target && gen.target.code, "| armed left:", state.armed.length);
        }
      }
      if (DEBUG && interesting(url, method)) {
        const lbl = label(url);
        emit("fetch", method.toUpperCase(), lbl, init && init.body);
        if (!KNOWN.test(lbl)) candidateLbl = lbl;
      }
    } catch (e) {}
    const p = origFetch.apply(this, arguments);
    // Only auto-download when we could attribute this generation to a target. An
    // un-attributable request (e.g. a user-initiated edit) gets no target and is
    // intentionally left alone.
    if (gen && gen.target) onGenerationResponse(gen.target, gen.isVideo, p);
    if (candidateLbl) captureResponse(candidateLbl, p);
    return p;
  };

  // --- XHR hook: debug probe only (generation goes through fetch) ---
  if (DEBUG) {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__ps_method = method;
      this.__ps_url = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (interesting(this.__ps_url, this.__ps_method)) {
          emit("xhr", (this.__ps_method || "GET").toUpperCase(), label(this.__ps_url), body);
        }
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
    console.log(TAG, "network probe installed");
  }
})();
