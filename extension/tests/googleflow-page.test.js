import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(resolve(__dirname, "../content/googleflow-page.js"), "utf-8");

// Load the REAL googleflow-page.js into a jsdom window. The file's IIFE runs on
// load (patching window.fetch, adding the message listener); the factory also
// returns its pure correlation helpers so we can unit-test them. Pass `fetchImpl`
// to control what the page's fetch resolves to (it becomes the module's origFetch).
function loadPage(dom, fetchImpl) {
  const { window } = dom;
  window.fetch = fetchImpl || (() => Promise.resolve({ clone: () => ({ json: async () => ({}) }) }));
  const factory = new Function(
    "window", "document", "console", "setTimeout", "performance", "location", "XMLHttpRequest", "URL",
    PAGE_SOURCE +
      "\n;return { flowIsGenerationRequest, flowIsVideoRequest, flowMediaRedirectUrl," +
      " flowTakeRequestTarget, flowDownloadsFromResponse, flowNormalizeText, flowPromptFingerprint };"
  );
  return factory(
    window, window.document, { log() {}, warn() {} }, setTimeout,
    window.performance || { now: () => 0 }, window.location, window.XMLHttpRequest, window.URL || URL
  );
}

function makeDom() {
  return new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://labs.google/fx/tools/flow/project/x",
  });
}

const tick = () => new Promise((r) => setTimeout(r, 5));

const GEN = "https://aisandbox-pa.googleapis.com/v1/projects/x/flowMedia:batchGenerateImages";
const GEN_VID = "https://aisandbox-pa.googleapis.com/v1/projects/x/flowMedia:batchGenerateVideos";

describe("googleflow-page — correlation helpers", () => {
  test("flowIsGenerationRequest matches only the batch-generate calls", () => {
    const flow = loadPage(makeDom());
    assert.equal(flow.flowIsGenerationRequest(GEN), true);
    assert.equal(flow.flowIsGenerationRequest(GEN_VID), true);
    // The noise from the same session must NOT be treated as a generation:
    assert.equal(flow.flowIsGenerationRequest("https://aisandbox-pa.googleapis.com/v1/flowWorkflows/abc"), false);
    assert.equal(flow.flowIsGenerationRequest("https://aisandbox-pa.googleapis.com/v1/flow:batchLogFrontendEvents"), false);
    assert.equal(flow.flowIsGenerationRequest("https://www.google.com/recaptcha/enterprise/clr"), false);
    assert.equal(flow.flowIsGenerationRequest(""), false);
  });

  test("flowIsVideoRequest distinguishes video from image", () => {
    const flow = loadPage(makeDom());
    assert.equal(flow.flowIsVideoRequest(GEN_VID), true);
    assert.equal(flow.flowIsVideoRequest(GEN), false);
  });

  test("flowMediaRedirectUrl builds the getMediaUrlRedirect url with ?name=", () => {
    const flow = loadPage(makeDom());
    assert.equal(
      flow.flowMediaRedirectUrl("8ce0f801-b10a"),
      "https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=8ce0f801-b10a"
    );
  });

  test("flowTakeRequestTarget consumes armed targets FIFO, then content-gates the lastTarget fallback", () => {
    const flow = loadPage(makeDom());
    const A = { code: "1A" }, B = { code: "1B" }, L = { code: "LAST" };
    const lastFp = flow.flowPromptFingerprint("the injected prompt that was set as the last target");
    const matchingBody = JSON.stringify({ prompt: "THE injected prompt that was set as the last target!" });
    const state = { armed: [{ target: A, fp: "" }, { target: B, fp: "" }], lastTarget: L, lastFp };
    assert.equal(flow.flowTakeRequestTarget(state, ""), A);
    assert.equal(flow.flowTakeRequestTarget(state, ""), B);
    // Armed drained: fall back to lastTarget ONLY when the body carries its prompt.
    assert.equal(flow.flowTakeRequestTarget(state, matchingBody), L, "falls back to lastTarget when its prompt is present");
    assert.equal(flow.flowTakeRequestTarget(state, matchingBody), L, "fallback is non-consuming");
    assert.equal(flow.flowTakeRequestTarget(state, "some unrelated edit request"), null, "no blind fallback for an un-armed, non-matching request");
  });

  test("flowPromptFingerprint normalizes and ignores too-short prompts", () => {
    const flow = loadPage(makeDom());
    assert.equal(flow.flowNormalizeText("A Sea-Otter, wet FUR!"), "a sea otter wet fur");
    assert.equal(flow.flowPromptFingerprint("short"), "", "too short to match safely");
    const fp = flow.flowPromptFingerprint("A river stone reference sheet on a neutral background, studio light");
    assert.ok(fp.length > 0 && fp.startsWith("a river stone reference sheet"));
  });

  test("flowTakeRequestTarget binds by prompt content, consuming the matching arm (not FIFO)", () => {
    const flow = loadPage(makeDom());
    const otto = { charSlug: "otto" }, rock = { charSlug: "rock" }, lake = { charSlug: "night-lake" };
    const state = {
      armed: [
        { target: otto, fp: flow.flowPromptFingerprint("A sea otter studio capture, wet fur, soft light") },
        { target: rock, fp: flow.flowPromptFingerprint("A river stone reference sheet on a neutral background") },
        { target: lake, fp: flow.flowPromptFingerprint("A calm lake under a starry night sky") },
      ],
      lastTarget: null,
    };
    // The "otter" arm is stranded (its Create went to the creation agent). A request
    // carrying the lake prompt must still bind to night-lake, not shift onto otto.
    const body = JSON.stringify({ prompt: "a CALM lake under a starry night sky", recaptcha: "zzz" });
    assert.equal(flow.flowTakeRequestTarget(state, body), lake);
    assert.equal(state.armed.length, 2, "only the matched arm is consumed");
    assert.deepEqual(state.armed.map((a) => a.target.charSlug), ["otto", "rock"]);
  });

  test("flowDownloadsFromResponse maps each media name to an auto-download payload", () => {
    const flow = loadPage(makeDom());
    const target = { type: "shot", project: "p", code: "1A" };
    const out = flow.flowDownloadsFromResponse(target, false, {
      media: [{ name: "resA", workflowId: "w" }, { name: "resA2" }],
    });
    assert.equal(out.length, 2);
    assert.equal(out[0].type, "promptsync-auto-download-ready");
    assert.equal(out[0].resourceId, "resA");
    assert.equal(out[0].creationType, "image");
    assert.equal(out[0].target, target);
    assert.match(out[0].url, /name=resA$/);
    assert.equal(out[1].resourceId, "resA2");
  });

  test("flowDownloadsFromResponse tolerates empty/odd responses and flags video", () => {
    const flow = loadPage(makeDom());
    assert.deepEqual(flow.flowDownloadsFromResponse({ code: "1A" }, false, {}), []);
    assert.deepEqual(flow.flowDownloadsFromResponse({ code: "1A" }, false, { media: [{}, { name: "" }] }), []);
    const vid = flow.flowDownloadsFromResponse({ code: "1A" }, true, { media: [{ name: "v1" }] });
    assert.equal(vid[0].creationType, "video");
  });
});

describe("googleflow-page — request↔response binding (concurrent runs)", () => {
  // Drives the real fetch hook: arm targets, fire generation requests, resolve
  // their responses, and capture the auto-download messages the module posts.
  function setup() {
    const dom = makeDom();
    const { window } = dom;
    const deferreds = [];
    const fetchImpl = (url) => {
      let resolve;
      const p = new Promise((res) => (resolve = res));
      deferreds.push({ url: String(url), resolve });
      return p;
    };
    loadPage(dom, fetchImpl);
    const downloads = [];
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "promptsync-auto-download-ready") downloads.push(e.data);
    });
    const arm = (target) =>
      window.dispatchEvent(new window.MessageEvent("message", { data: { type: "promptsync-flow-arm", target } }));
    const setTargetMsg = (target, prompt) =>
      window.dispatchEvent(new window.MessageEvent("message", { data: { type: "promptsync-set-target", target, prompt } }));
    const respond = (name) => ({ clone: () => ({ json: async () => ({ media: [{ name }] }) }) });
    const genWithPrompt = (prompt) => window.fetch(GEN, { method: "POST", body: JSON.stringify({ prompt }) });
    return { window, deferreds, downloads, arm, setTargetMsg, respond, genWithPrompt };
  }

  test("out-of-order completion does NOT mix downloads (the bug, now fixed)", async () => {
    const { window, deferreds, downloads, arm, respond } = setup();
    const A = { type: "shot", project: "p", code: "1A" };
    const B = { type: "shot", project: "p", code: "1B" };

    arm(A);            // Create clicked for A
    arm(B);            // Create clicked for B
    window.fetch(GEN); // generation request A → bound to A
    window.fetch(GEN); // generation request B → bound to B
    assert.equal(deferreds.length, 2);

    // B finishes FIRST, then A — the scenario that used to swap them.
    deferreds[1].resolve(respond("nameB"));
    deferreds[0].resolve(respond("nameA"));
    await tick();
    await tick();

    const byCode = Object.fromEntries(downloads.map((d) => [d.target.code, d.resourceId]));
    assert.deepEqual(byCode, { "1A": "nameA", "1B": "nameB" }, "each shot got its own image despite reverse completion");
    assert.match(downloads.find((d) => d.target.code === "1A").url, /name=nameA$/);
  });

  test("in-order completion still maps correctly", async () => {
    const { window, deferreds, downloads, arm, respond } = setup();
    arm({ type: "shot", project: "p", code: "1A" });
    arm({ type: "shot", project: "p", code: "1B" });
    window.fetch(GEN);
    window.fetch(GEN);
    deferreds[0].resolve(respond("nameA"));
    deferreds[1].resolve(respond("nameB"));
    await tick();
    await tick();
    const byCode = Object.fromEntries(downloads.map((d) => [d.target.code, d.resourceId]));
    assert.deepEqual(byCode, { "1A": "nameA", "1B": "nameB" });
  });

  test("falls back to the last set-target for an un-armed generation that carries the injected prompt", async () => {
    const { deferreds, downloads, setTargetMsg, respond, genWithPrompt } = setup();
    // Inject a prompt (sets the target) then submit it without our Create-click arm,
    // e.g. via the keyboard. The request body carries the injected prompt, so it's ours.
    setTargetMsg({ type: "shot", project: "p", code: "3D" }, "a lone lighthouse on a storm-battered cliff at dusk");
    genWithPrompt("a lone lighthouse on a storm-battered cliff at dusk");
    deferreds[0].resolve(respond("nameX"));
    await tick();
    await tick();
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].target.code, "3D");
    assert.equal(downloads[0].resourceId, "nameX");
  });

  test("does NOT auto-download an edit of an existing image after an injected-but-unrun prompt", async () => {
    const { deferreds, downloads, setTargetMsg, respond, genWithPrompt } = setup();
    // Inject a prompt (sets the target) but never run it...
    setTargetMsg({ type: "shot", project: "p", code: "3D" }, "a lone lighthouse on a storm-battered cliff at dusk");
    // ...then edit an existing image: a generation we never armed, whose body is the
    // edit's own content, NOT our injected prompt.
    genWithPrompt("make the sky a warmer orange and remove the boat");
    deferreds[0].resolve(respond("editResult"));
    await tick();
    await tick();
    assert.equal(downloads.length, 0, "the edit result must not be saved onto the injected prompt's target");
  });

  test("desync-proof: a stranded arm (agent mode) does not misplace later images", async () => {
    // Reproduces the reported bug: the first Create went to the creation AGENT
    // (no batchGenerateImages), stranding an arm; concurrent runs then finished
    // out of order. Pure FIFO shifted every image onto the wrong character.
    const dom = makeDom();
    const { window } = dom;
    const deferreds = [];
    const fetchImpl = (url, init) => {
      let resolve;
      const p = new Promise((res) => (resolve = res));
      deferreds.push({ url: String(url), body: init && init.body, resolve });
      return p;
    };
    loadPage(dom, fetchImpl);
    const downloads = [];
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "promptsync-auto-download-ready") downloads.push(e.data);
    });
    const armP = (target, prompt) =>
      window.dispatchEvent(new window.MessageEvent("message", { data: { type: "promptsync-flow-arm", target, prompt } }));
    const respond = (name) => ({ clone: () => ({ json: async () => ({ media: [{ name }] }) }) });
    const gen = (prompt) => window.fetch(GEN, { method: "POST", body: JSON.stringify({ prompt, recaptcha: "x" }) });

    const otto = { type: "char", project: "p", charSlug: "otto", viewSlug: "primary" };
    const rock = { type: "char", project: "p", charSlug: "rock", viewSlug: "primary" };
    const lake = { type: "char", project: "p", charSlug: "night-lake", viewSlug: "primary" };

    armP(otto, "A sea otter studio capture, wet fur, soft light");           // Create → creation agent (stranded)
    armP(rock, "A river stone reference sheet on a neutral background");
    armP(lake, "A calm lake under a starry night sky");

    // Only rock and lake fire real generation requests — and finish out of order.
    gen("a CALM lake under a starry night sky");
    gen("a river STONE reference sheet on a neutral background");
    deferreds[0].resolve(respond("lakeImg"));
    deferreds[1].resolve(respond("rockImg"));
    await tick();
    await tick();

    const byChar = Object.fromEntries(downloads.map((d) => [d.target.charSlug, d.resourceId]));
    assert.deepEqual(byChar, { "night-lake": "lakeImg", "rock": "rockImg" },
      "each image bound by prompt content; the stranded otto arm shifts nothing");
  });

  test("non-generation requests are ignored (no spurious downloads)", async () => {
    const { window, deferreds, downloads, arm, respond } = setup();
    arm({ type: "shot", project: "p", code: "1A" });
    window.fetch("https://aisandbox-pa.googleapis.com/v1/flowWorkflows/abc"); // PATCH-like noise
    window.fetch("https://aisandbox-pa.googleapis.com/v1/flow:batchLogFrontendEvents");
    deferreds.forEach((d) => d.resolve(respond("nope")));
    await tick();
    await tick();
    assert.equal(downloads.length, 0, "only batchGenerate* requests produce downloads; the armed target stays queued");
  });
});
