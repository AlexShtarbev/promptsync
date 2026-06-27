// DEBUG SCRIPT — paste in OpenArt DevTools console to observe generation lifecycle
// Run this BEFORE clicking "Generate" to see what DOM changes happen
//
// What we're looking for:
// 1. Does a loading/progress indicator appear? What element?
// 2. When the image/video is done, what new elements appear?
// 3. Can we identify WHICH generation is ours vs. others?
// 4. Is there an API call we can intercept?

// --- Part 1: DOM Mutation Observer ---
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    // New nodes added
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const el = node;
      const tag = el.tagName?.toLowerCase();

      // New images
      if (tag === "img" && el.src && !el.src.startsWith("data:")) {
        const r = el.getBoundingClientRect();
        console.log(`[GEN-DEBUG] New <img> added: ${r.width}x${r.height}`, el.src.slice(0, 100), el);
      }

      // New videos
      if (tag === "video") {
        const src = el.src || el.querySelector("source")?.src;
        console.log("[GEN-DEBUG] New <video> added:", src?.slice(0, 100), el);
      }

      // Progress indicators
      if (el.querySelector?.('[role="progressbar"]') || el.getAttribute?.("role") === "progressbar") {
        console.log("[GEN-DEBUG] Progress bar appeared:", el);
      }

      // Loading spinners / skeleton screens
      const classes = el.className || "";
      if (typeof classes === "string" && (classes.includes("loading") || classes.includes("skeleton") || classes.includes("spinner") || classes.includes("generating"))) {
        console.log("[GEN-DEBUG] Loading element:", classes, el);
      }

      // Check all descendant images/videos added
      if (el.querySelectorAll) {
        el.querySelectorAll("img").forEach((img) => {
          if (img.src && !img.src.startsWith("data:")) {
            const r = img.getBoundingClientRect();
            if (r.width > 50) console.log(`[GEN-DEBUG] Nested <img>: ${r.width}x${r.height}`, img.src.slice(0, 100));
          }
        });
        el.querySelectorAll("video").forEach((v) => {
          const src = v.src || v.querySelector("source")?.src;
          if (src) console.log("[GEN-DEBUG] Nested <video>:", src.slice(0, 100));
        });
      }
    }

    // Attribute changes (e.g. src changes on existing elements)
    if (m.type === "attributes" && m.target.nodeType === 1) {
      const el = m.target;
      if (m.attributeName === "src" && el.tagName === "IMG") {
        console.log("[GEN-DEBUG] <img> src changed:", el.src?.slice(0, 100), el);
      }
      if (m.attributeName === "src" && el.tagName === "VIDEO") {
        console.log("[GEN-DEBUG] <video> src changed:", el.src?.slice(0, 100), el);
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src", "class", "data-state", "aria-valuenow"],
});

console.log("[GEN-DEBUG] DOM observer started — now click Generate");

// --- Part 2: Fetch/XHR interceptor ---
// Watch for API calls that might indicate generation status
const origFetch = window.fetch;
window.fetch = async function (...args) {
  const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
  const method = args[1]?.method || "GET";

  // Filter to interesting API calls (skip static assets)
  if (url.includes("/api/") || url.includes("/generate") || url.includes("/task") || url.includes("/creation") || url.includes("/status")) {
    console.log(`[GEN-DEBUG] fetch ${method} ${url.slice(0, 150)}`);
    const resp = await origFetch.apply(this, args);
    // Clone to read body without consuming
    const clone = resp.clone();
    try {
      const body = await clone.json();
      console.log(`[GEN-DEBUG] fetch response:`, body);
    } catch {
      // not JSON
    }
    return resp;
  }

  return origFetch.apply(this, args);
};

console.log("[GEN-DEBUG] Fetch interceptor active");

// --- Part 3: Helper to snapshot current state ---
window.genDebugSnapshot = function () {
  const imgs = [...document.querySelectorAll("img")].filter((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 50 && r.height > 50 && i.src && !i.src.startsWith("data:");
  });
  const vids = [...document.querySelectorAll("video")].filter((v) => {
    const r = v.getBoundingClientRect();
    return r.width > 50 && r.height > 50;
  });
  console.log(`[GEN-DEBUG] Snapshot: ${imgs.length} visible images, ${vids.length} visible videos`);
  imgs.forEach((img, i) => {
    const r = img.getBoundingClientRect();
    console.log(`  img[${i}] ${r.width}x${r.height} at (${Math.round(r.left)},${Math.round(r.top)})`, img.src.slice(0, 80));
  });
  vids.forEach((v, i) => {
    const r = v.getBoundingClientRect();
    const src = v.src || v.querySelector("source")?.src;
    console.log(`  vid[${i}] ${r.width}x${r.height} at (${Math.round(r.left)},${Math.round(r.top)})`, src?.slice(0, 80));
  });
};

console.log("[GEN-DEBUG] Call genDebugSnapshot() at any time to see current images/videos");
console.log("[GEN-DEBUG] To stop: observer.disconnect(); window.fetch = origFetch;");
