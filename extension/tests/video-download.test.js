import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE = readFileSync(resolve(__dirname, "../content/shared.js"), "utf-8");

// --- Load the REAL shared.js into an isolated scope --------------------------
//
// Wrap the source in `new Function`, injecting every global it touches. This means
// regressions in the actual source (video selection + auto-download routing) fail
// these tests, and we never pollute Node's globals. A fresh load per test gives a
// fresh module scope (notably the `_lastInteractedVideo` tracker).
function loadShared(makeFetch) {
  const dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "https://openart.test/" });
  const { window } = dom;
  const doc = window.document;

  const calls = { sentMessages: [], storageSets: [] };
  const chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage: (m) => calls.sentMessages.push(m),
      lastError: null,
    },
    storage: { local: { set: (v) => calls.storageSets.push(v) } },
    tabs: {},
  };
  const quietConsole = { log() {}, warn() {}, error: (...a) => console.error(...a) };
  // showToast only uses setTimeout for cleanup — a no-op avoids leaked timers.
  const noopTimeout = () => 0;
  const fetch = makeFetch ? makeFetch(window, calls) : async () => ({ ok: true, json: async () => ({ ok: true }) });

  const factory = new Function(
    "window", "document", "console", "setTimeout", "clearTimeout",
    "getComputedStyle", "chrome", "fetch", "navigator",
    MODULE_SOURCE +
      "\n;return { videoFromInteraction, pickVideoForDownload, findLargestVisibleVideo, handleAutoDownload };"
  );
  const api = factory(
    window, doc, quietConsole, noopTimeout, noopTimeout,
    window.getComputedStyle.bind(window), chrome, fetch, window.navigator
  );
  return { dom, window, doc, api, calls };
}

function mkVideo(doc, { w, h, src = "blob:clip" }) {
  const v = doc.createElement("video");
  if (src) v.src = src;
  // jsdom does no layout, so getBoundingClientRect is all-zero by default.
  v.getBoundingClientRect = () => ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0 });
  return v;
}

// =============================================================================
// Bug 1: a download must grab the clip the user interacted with — NOT the single
// largest <video> on the page (which made 1A/1D/1E save byte-identical files).
// =============================================================================
describe("pickVideoForDownload — clip selection", () => {
  test("with no interaction, falls back to the largest visible video", () => {
    const { doc, api, window } = loadShared();
    const big = mkVideo(doc, { w: 300, h: 300, src: "blob:big" });
    const small = mkVideo(doc, { w: 100, h: 100, src: "blob:small" });
    doc.body.append(big, small);
    assert.equal(api.pickVideoForDownload(), big);
  });

  test("a clicked card's video wins over a larger video elsewhere", () => {
    const { doc, api, window } = loadShared();
    const big = mkVideo(doc, { w: 400, h: 400, src: "blob:big" });
    doc.body.append(big);

    // A grid card whose clickable overlay sits over (not on) the video element.
    const card = doc.createElement("div");
    const chosen = mkVideo(doc, { w: 120, h: 120, src: "blob:chosen" });
    const overlay = doc.createElement("button");
    card.append(chosen, overlay);
    doc.body.append(card);

    overlay.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(api.pickVideoForDownload(), chosen, "download targets the clicked card, not the biggest");
  });

  test("clicking the video element directly selects it", () => {
    const { doc, api, window } = loadShared();
    const big = mkVideo(doc, { w: 400, h: 400, src: "blob:big" });
    const target = mkVideo(doc, { w: 120, h: 120, src: "blob:target" });
    doc.body.append(big, target);
    target.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(api.pickVideoForDownload(), target);
  });

  test("a play event marks the played clip", () => {
    const { doc, api, window } = loadShared();
    const big = mkVideo(doc, { w: 400, h: 400, src: "blob:big" });
    const played = mkVideo(doc, { w: 120, h: 120, src: "blob:played" });
    doc.body.append(big, played);
    played.dispatchEvent(new window.Event("play")); // non-bubbling — capture listener still sees it
    assert.equal(api.pickVideoForDownload(), played);
  });

  test("clicking an ambiguous container (multiple videos) does not pick one — falls back to largest", () => {
    const { doc, api, window } = loadShared();
    const wrap = doc.createElement("div");
    const big = mkVideo(doc, { w: 400, h: 400, src: "blob:big" });
    const small = mkVideo(doc, { w: 120, h: 120, src: "blob:small" });
    wrap.append(big, small);
    doc.body.append(wrap);
    wrap.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(api.pickVideoForDownload(), big, "ambiguous click is ignored, not guessed");
  });

  test("a stale (removed) tracked video is ignored", () => {
    const { doc, api, window } = loadShared();
    const big = mkVideo(doc, { w: 400, h: 400, src: "blob:big" });
    const transient = mkVideo(doc, { w: 120, h: 120, src: "blob:transient" });
    doc.body.append(big, transient);
    transient.dispatchEvent(new window.Event("click", { bubbles: true }));
    transient.remove(); // user closed the overlay
    assert.equal(api.pickVideoForDownload(), big);
  });

  test("videoFromInteraction climbs to the nearest single-video ancestor", () => {
    const { doc, api, window } = loadShared();
    const card = doc.createElement("div");
    const inner = doc.createElement("span");
    const v = mkVideo(doc, { w: 100, h: 100 });
    card.append(v, inner);
    doc.body.append(card);
    assert.equal(api.videoFromInteraction(inner), v);
    assert.equal(api.videoFromInteraction(v), v);
  });
});

// =============================================================================
// Bug 2: a shot's VIDEO generation must go to the video endpoint — never the
// image endpoint, which deletes the storyboard still (the "shot disappeared").
// =============================================================================
function recordingFetch(blobType) {
  return (window, calls) => async (url, opts) => {
    if (opts && opts.method === "POST") {
      calls.uploadUrl = url;
      calls.uploadHeaders = opts.headers;
      return { ok: true, json: async () => ({ ok: true }) };
    }
    calls.mediaUrl = url;
    return { ok: true, blob: async () => new window.Blob([new Uint8Array([0, 1, 2])], { type: blobType }) };
  };
}

const SHOT = { type: "shot", project: "p", code: "1B" };
const CHAR = { type: "char", project: "p", charSlug: "otto", viewSlug: "front" };

describe("handleAutoDownload — image vs video routing", () => {
  test("creationType 'video' routes a shot to the VIDEO endpoint", async () => {
    const { api, calls } = loadShared(recordingFetch("image/jpeg"));
    await api.handleAutoDownload({ url: "https://m/v", resourceId: "v1", creationType: "video", target: SHOT });
    assert.match(calls.uploadUrl, /\/assets\/p\/shots\/1B\/video\/upload$/);
    // and never sends video as image/jpeg
    assert.equal(calls.uploadHeaders["Content-Type"], "video/mp4");
    assert.equal(calls.uploadHeaders["X-OpenArt-Ref"], undefined);
  });

  test("creationType 'image' routes a shot to the IMAGE endpoint", async () => {
    const { api, calls } = loadShared(recordingFetch("image/jpeg"));
    await api.handleAutoDownload({ url: "https://m/i", resourceId: "i1", creationType: "image", target: SHOT });
    assert.match(calls.uploadUrl, /\/assets\/p\/shots\/1B\/image\/upload$/);
    assert.equal(calls.uploadHeaders["X-OpenArt-Ref"], "https://m/i");
  });

  test("video blob bytes route to the video endpoint even if creationType is absent", async () => {
    const { api, calls } = loadShared(recordingFetch("video/webm"));
    await api.handleAutoDownload({ url: "https://m/v2", resourceId: "v2", target: SHOT });
    assert.match(calls.uploadUrl, /\/shots\/1B\/video\/upload$/);
    assert.equal(calls.uploadHeaders["Content-Type"], "video/webm");
  });

  test("a video for a character target is refused (reference sheets are stills)", async () => {
    const { api, calls } = loadShared(recordingFetch("video/mp4"));
    await api.handleAutoDownload({ url: "https://m/v3", resourceId: "v3", creationType: "video", target: CHAR });
    assert.equal(calls.uploadUrl, undefined, "no upload performed for a character video");
  });

  test("an image for a character target routes to the character image endpoint", async () => {
    const { api, calls } = loadShared(recordingFetch("image/png"));
    await api.handleAutoDownload({ url: "https://m/i2", resourceId: "ci1", creationType: "image", target: CHAR });
    assert.match(calls.uploadUrl, /\/assets\/p\/characters\/otto\/front\/image\/upload$/);
  });

  test("auto-download-complete reports isVideo so the panel won't mark has_image", async () => {
    const { api, calls } = loadShared(recordingFetch("video/mp4"));
    await api.handleAutoDownload({ url: "https://m/v4", resourceId: "v4", creationType: "video", target: SHOT });
    const done = calls.sentMessages.find((m) => m.type === "auto-download-complete");
    assert.ok(done, "completion message sent");
    assert.equal(done.isVideo, true);
  });
});
