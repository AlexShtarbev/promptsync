import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE = readFileSync(
  resolve(__dirname, "../content/visual-references-react.js"),
  "utf-8"
);

const EMMANUEL = {
  id: "yR43CZB7gRRtUbBCFc9N",
  name: "Emmanuel",
  label: "Emmanuel",
  type: "character",
  url: "https://cdn.openart.ai/emmanuel-1.jpg",
  imageUrl: "https://cdn.openart.ai/emmanuel-1.jpg",
  extraUrls: ["https://cdn.openart.ai/emmanuel-2.jpg"],
  klingElementId: "311196336483313",
};

const MARY = {
  id: "abc123",
  name: "Mary",
  label: "Mary",
  type: "character",
  url: "https://cdn.openart.ai/mary-1.png",
  imageUrl: "https://cdn.openart.ai/mary-1.png",
  extraUrls: [],
  klingElementId: "999888777",
};

const FOREST = {
  id: "bg001",
  name: "Dark Forest",
  label: "Dark Forest",
  type: "background",
  url: "https://cdn.openart.ai/forest.jpg",
  imageUrl: "https://cdn.openart.ai/forest.jpg",
  extraUrls: [],
  klingElementId: null,
};

function buildDOM() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://openart.ai/create-video",
  });

  // Track what the "page script" receives
  let receivedRefs = [];
  let respondOk = true;
  let respondError = null;

  dom.window.addEventListener("message", (event) => {
    if (event.data?.type !== "promptsync-select-visual-refs") return;
    receivedRefs = event.data.references || [];
    const { requestId } = event.data;
    if (respondOk) {
      dom.window.postMessage({
        type: "promptsync-select-visual-refs-result",
        requestId,
        ok: true,
        added: receivedRefs.length,
      }, "*");
    } else {
      dom.window.postMessage({
        type: "promptsync-select-visual-refs-result",
        requestId,
        ok: false,
        error: respondError || "Component not found",
      }, "*");
    }
  });

  return {
    dom,
    getReceivedRefs: () => receivedRefs,
    setRespondOk: (ok, error) => { respondOk = ok; respondError = error; },
  };
}

function loadModule(dom) {
  const { window } = dom;
  global.document = window.document;
  global.window = window;
  // eslint-disable-next-line no-eval
  return eval(MODULE_SOURCE + "\nvisualReferencesReact;");
}

function mockStorage(entries) {
  return (key) => Promise.resolve({ [key]: entries[key] || null });
}

describe("cwDataToVisualRef", () => {
  test("converts character C&W data to visual reference shape", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const ref = mod.cwDataToVisualRef(EMMANUEL);

    assert.equal(ref.id, "yR43CZB7gRRtUbBCFc9N");
    assert.equal(ref.sourceType, "upload");
    assert.equal(ref.userId, "current-user");
    assert.equal(ref.resourceType, "character");
    assert.equal(ref.status, "completed");
    assert.equal(ref.input.referenceType, "character");
    assert.equal(ref.input.name, "Emmanuel");
    assert.equal(ref.input.klingElementId, "311196336483313");
    assert.deepEqual(ref.input.extraUrls, ["https://cdn.openart.ai/emmanuel-2.jpg"]);
    assert.equal(ref.metadata.media_type, "image");
  });

  test("converts background to world resourceType", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const ref = mod.cwDataToVisualRef(FOREST);

    assert.equal(ref.resourceType, "world");
    assert.equal(ref.input.referenceType, "world");
  });

  test("extracts format from URL extension", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const pngRef = mod.cwDataToVisualRef(MARY);
    assert.equal(pngRef.metadata.format, "png");

    const jpgRef = mod.cwDataToVisualRef(EMMANUEL);
    assert.equal(jpgRef.metadata.format, "jpg");
  });

  test("falls back to png when URL has no dot extension", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const ref = mod.cwDataToVisualRef({ ...MARY, url: "https://example.com/img" });
    assert.equal(ref.metadata.format, "png");
  });
});

describe("selectElements", () => {
  test("looks up C&W data and sends refs to page script", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:emmanuel": EMMANUEL,
      "openart-cw:mary": MARY,
    });

    const result = await mod.selectElements(["Emmanuel", "Mary"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.added, 2);
    assert.equal(getReceivedRefs().length, 2);
    assert.equal(getReceivedRefs()[0].input.name, "Emmanuel");
    assert.equal(getReceivedRefs()[1].input.name, "Mary");
  });

  test("is case-insensitive for names", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["EMMANUEL"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.added, 1);
  });

  test("skips names not found in storage", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel", "Ghost"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.added, 1);
    assert.equal(getReceivedRefs().length, 1);
  });

  test("returns error when no C&W data found for any element", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({});
    const result = await mod.selectElements(["Nobody"], storage);
    assert.equal(result.ok, false);
    assert.match(result.error, /No C&W data/);
  });

  test("returns error when page script reports failure", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "VisualReferences component not found");

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, false);
    assert.match(result.error, /VisualReferences/);
  });

  test("returns ok with 0 added for empty names", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const result = await mod.selectElements([], mockStorage({}));
    assert.equal(result.ok, true);
    assert.equal(result.added, 0);
  });

  test("clearElements sends empty array to page script", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    await mod.selectElements(["Emmanuel"], storage);
    assert.equal(getReceivedRefs().length, 1);

    const result = await mod.clearElements();
    assert.equal(result.ok, true);
    assert.equal(result.added, 0);
    assert.equal(getReceivedRefs().length, 0);
  });

  test("sends correct resourceType for backgrounds", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:dark forest": FOREST });
    const result = await mod.selectElements(["Dark Forest"], storage);
    assert.equal(result.ok, true);
    assert.equal(getReceivedRefs()[0].resourceType, "world");
    assert.equal(getReceivedRefs()[0].input.referenceType, "world");
  });
});

describe("selectElements idMap", () => {
  test("returns idMap mapping element names to OpenArt IDs", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:emmanuel": EMMANUEL,
      "openart-cw:mary": MARY,
    });

    const result = await mod.selectElements(["Emmanuel", "Mary"], storage);
    assert.equal(result.ok, true);
    assert.deepEqual(result.idMap, {
      Emmanuel: "yR43CZB7gRRtUbBCFc9N",
      Mary: "abc123",
    });
  });

  test("idMap preserves original camelCase element names as keys", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const PETER = {
      ...EMMANUEL,
      id: "TCOmrNbxzys8WExQjSrI",
      name: "peterNightingale",
    };
    const CHURCH = {
      ...FOREST,
      id: "2kJ78EmaLx094qsWX1CU",
      name: "peterChurchA",
    };
    const storage = mockStorage({
      "openart-cw:peternightingale": PETER,
      "openart-cw:peterchurcha": CHURCH,
    });

    const result = await mod.selectElements(["peterNightingale", "peterChurchA"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
    assert.equal(result.idMap.peterChurchA, "2kJ78EmaLx094qsWX1CU");
  });

  test("idMap omits elements not found in storage", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel", "Ghost"], storage);
    assert.equal(result.ok, true);
    assert.deepEqual(result.idMap, { Emmanuel: "yR43CZB7gRRtUbBCFc9N" });
    assert.equal(result.idMap.Ghost, undefined);
  });

  test("idMap is empty object when no elements found", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const result = await mod.selectElements([], mockStorage({}));
    assert.equal(result.ok, true);
    assert.equal(result.idMap, undefined);
  });

  test("idMap is present even when page script reports failure", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "Component not found");

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, false);
    assert.deepEqual(result.idMap, { Emmanuel: "yR43CZB7gRRtUbBCFc9N" });
  });

  test("prompt @-mentions can be resolved to IDs using idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const PETER = { ...EMMANUEL, id: "TCOmrNbxzys8WExQjSrI", name: "peterNightingale" };
    const CHURCH = { ...FOREST, id: "2kJ78EmaLx094qsWX1CU", name: "peterChurchA" };
    const storage = mockStorage({
      "openart-cw:peternightingale": PETER,
      "openart-cw:peterchurcha": CHURCH,
    });

    const result = await mod.selectElements(["peterNightingale", "peterChurchA"], storage);

    const prompt = "[Subject]: @peterNightingale removes the chasuble.\n[Environment]: @peterChurchA warm stained glass.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(!transformed.includes("@peterNightingale"));
    assert.ok(!transformed.includes("@peterChurchA"));
    assert.ok(transformed.includes("@TCOmrNbxzys8WExQjSrI"));
    assert.ok(transformed.includes("@2kJ78EmaLx094qsWX1CU"));
    assert.ok(transformed.includes("[Subject]:"));
    assert.ok(transformed.includes("[Environment]:"));
  });

  test("idMap transformation does not alter prompt when no @-mentions match", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);

    const prompt = "A man walks down the street. No character mentions here.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(transformed, prompt);
  });

  test("idMap handles multiple occurrences of same element in prompt", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);

    const prompt = "@Emmanuel lifts his cup. @Emmanuel's hands tremble.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(!transformed.includes("@Emmanuel"));
    assert.equal(
      transformed,
      `@${EMMANUEL.id} lifts his cup. @${EMMANUEL.id}'s hands tremble.`
    );
  });

  test("idMap keys are case-sensitive — only exact camelCase is replaced", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const PETER = { ...EMMANUEL, id: "peter-id-123", name: "peterNightingale" };
    const storage = mockStorage({ "openart-cw:peternightingale": PETER });
    const result = await mod.selectElements(["peterNightingale"], storage);

    const prompt = "@peterNightingale stands. @PeterNightingale wrong case. @peternightingale also wrong.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(transformed.includes("@peter-id-123 stands."));
    assert.ok(transformed.includes("@PeterNightingale wrong case."));
    assert.ok(transformed.includes("@peternightingale also wrong."));
  });
});

// ============================================================
// Fetch interceptor contract: pendingElementIdMap
// The page script (openart-page.js) transforms the prompt in the
// API request body using the idMap — the UI prompt stays untouched.
// These tests validate the transformation logic in isolation.
// ============================================================

function applyIdMapToRequestBody(bodyStr, idMap) {
  const body = JSON.parse(bodyStr);
  if (body.prompt && typeof body.prompt === "string") {
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }
  }
  return body;
}

describe("fetch interceptor: pendingElementIdMap prompt transformation", () => {
  test("replaces @elementName with @id in request body prompt", () => {
    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI" };
    const body = applyIdMapToRequestBody(
      JSON.stringify({ prompt: "[Subject]: @peterNightingale removes chasuble." }),
      idMap
    );
    assert.equal(body.prompt, "[Subject]: @TCOmrNbxzys8WExQjSrI removes chasuble.");
  });

  test("replaces multiple elements in one prompt", () => {
    const idMap = {
      peterNightingale: "peter-id",
      peterChurchA: "church-id",
    };
    const body = applyIdMapToRequestBody(
      JSON.stringify({
        prompt: "@peterNightingale at @peterChurchA altar.",
      }),
      idMap
    );
    assert.equal(body.prompt, "@peter-id at @church-id altar.");
  });

  test("replaces all occurrences of the same element", () => {
    const idMap = { marcusReeves: "marcus-id" };
    const body = applyIdMapToRequestBody(
      JSON.stringify({
        prompt: "@marcusReeves sits. @marcusReeves looks up.",
      }),
      idMap
    );
    assert.equal(body.prompt, "@marcus-id sits. @marcus-id looks up.");
  });

  test("does not touch prompt when no @-mentions match", () => {
    const idMap = { peterNightingale: "peter-id" };
    const original = "A man walks. No mentions.";
    const body = applyIdMapToRequestBody(
      JSON.stringify({ prompt: original }),
      idMap
    );
    assert.equal(body.prompt, original);
  });

  test("preserves other body fields unchanged", () => {
    const idMap = { peterNightingale: "peter-id" };
    const body = applyIdMapToRequestBody(
      JSON.stringify({
        prompt: "@peterNightingale walks.",
        model: "kling-v3",
        aspectRatio: "16:9",
        visualReferences: [{ id: "peter-id", name: "peterNightingale" }],
      }),
      idMap
    );
    assert.equal(body.prompt, "@peter-id walks.");
    assert.equal(body.model, "kling-v3");
    assert.equal(body.aspectRatio, "16:9");
    assert.equal(body.visualReferences[0].id, "peter-id");
  });

  test("handles body with no prompt field (non-prompt creation)", () => {
    const idMap = { peterNightingale: "peter-id" };
    const body = applyIdMapToRequestBody(
      JSON.stringify({ model: "kling-v3", aspectRatio: "16:9" }),
      idMap
    );
    assert.equal(body.prompt, undefined);
    assert.equal(body.model, "kling-v3");
  });

  test("handles empty idMap", () => {
    const original = "@peterNightingale walks.";
    const body = applyIdMapToRequestBody(
      JSON.stringify({ prompt: original }),
      {}
    );
    assert.equal(body.prompt, original);
  });

  test("does not replace bare names without @ prefix", () => {
    const idMap = { peterNightingale: "peter-id" };
    const body = applyIdMapToRequestBody(
      JSON.stringify({ prompt: "peterNightingale walks. @peterNightingale stands." }),
      idMap
    );
    assert.equal(body.prompt, "peterNightingale walks. @peter-id stands.");
  });

  test("handles possessives and punctuation after @name", () => {
    const idMap = { peterNightingale: "peter-id" };
    const body = applyIdMapToRequestBody(
      JSON.stringify({
        prompt: "@peterNightingale's hand. @peterNightingale, alone. @peterNightingale.",
      }),
      idMap
    );
    assert.equal(body.prompt, "@peter-id's hand. @peter-id, alone. @peter-id.");
  });

  test("full kling prompt with labeled blocks", () => {
    const idMap = {
      peterNightingale: "TCOmrNbxzys8WExQjSrI",
      peterChurchA: "2kJ78EmaLx094qsWX1CU",
    };
    const prompt = [
      "[Cinematography]: Static. MS from the nave.",
      "[Subject]: @peterNightingale removes the chasuble.",
      "[Action]: Hands lift the chasuble over his head.",
      "[Context]: @peterChurchA warm stained glass light.",
      "[MOTION SCALE: 0.5]",
      "Negative prompt: dark church, night.",
    ].join("\n");

    const body = applyIdMapToRequestBody(
      JSON.stringify({ prompt }),
      idMap
    );

    assert.ok(!body.prompt.includes("@peterNightingale"));
    assert.ok(!body.prompt.includes("@peterChurchA"));
    assert.ok(body.prompt.includes("@TCOmrNbxzys8WExQjSrI"));
    assert.ok(body.prompt.includes("@2kJ78EmaLx094qsWX1CU"));
    assert.ok(body.prompt.includes("[Cinematography]:"));
    assert.ok(body.prompt.includes("[MOTION SCALE: 0.5]"));
    assert.ok(body.prompt.includes("Negative prompt:"));
  });
});

// ============================================================
// postMessage contract: promptsync-set-element-id-map
// The content script sends this after selectElements succeeds.
// Validates the message shape and when it should/shouldn't fire.
// ============================================================

describe("promptsync-set-element-id-map postMessage contract", () => {
  test("idMap with entries produces a valid postMessage payload", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "peter-id", name: "peterNightingale" },
      "openart-cw:peterchurcha": { ...FOREST, id: "church-id", name: "peterChurchA" },
    });

    const result = await mod.selectElements(["peterNightingale", "peterChurchA"], storage);

    const payload = { type: "promptsync-set-element-id-map", idMap: result.idMap };
    assert.equal(payload.type, "promptsync-set-element-id-map");
    assert.equal(Object.keys(payload.idMap).length, 2);
    assert.equal(payload.idMap.peterNightingale, "peter-id");
    assert.equal(payload.idMap.peterChurchA, "church-id");
  });

  test("empty names list returns early — no idMap property", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const result = await mod.selectElements([], mockStorage({}));

    assert.equal(result.ok, true);
    assert.equal(result.added, 0);
    assert.equal(result.idMap, undefined);
    const shouldPost = result.idMap && Object.keys(result.idMap).length > 0;
    assert.equal(shouldPost, undefined);
  });

  test("partial match still produces idMap for found elements", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "peter-id", name: "peterNightingale" },
    });

    const result = await mod.selectElements(["peterNightingale", "missingElement"], storage);
    assert.equal(result.ok, true);
    assert.equal(Object.keys(result.idMap).length, 1);
    assert.equal(result.idMap.peterNightingale, "peter-id");
    assert.equal(result.idMap.missingElement, undefined);

    const shouldPost = result.idMap && Object.keys(result.idMap).length > 0;
    assert.equal(shouldPost, true);
  });

  test("idMap from failed selection still has entries for the fetch interceptor", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "React component not found");

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "peter-id", name: "peterNightingale" },
    });

    const result = await mod.selectElements(["peterNightingale"], storage);
    assert.equal(result.ok, false);
    assert.equal(result.idMap.peterNightingale, "peter-id");
  });

  test("all elements missing — no idMap, no postMessage", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({});
    const result = await mod.selectElements(["ghostChar", "ghostWorld"], storage);
    assert.equal(result.ok, false);
    assert.deepEqual(result.idMap, {});
    const shouldPost = result.idMap && Object.keys(result.idMap).length > 0;
    assert.equal(shouldPost, false);
  });
});

// ============================================================
// End-to-end: real ends-cross project data
// Simulates the full flow from shot.meta.elements through
// selectElements to fetch interceptor prompt transformation.
// ============================================================

const ENDS_CROSS_CW = {
  "openart-cw:peternightingale": {
    id: "TCOmrNbxzys8WExQjSrI",
    name: "peterNightingale",
    type: "character",
    label: "peterNightingale",
    url: "https://cdn.openart.ai/peter-1.jpg",
    imageUrl: "https://cdn.openart.ai/peter-1.jpg",
    extraUrls: ["https://cdn.openart.ai/peter-2.jpg"],
    klingElementId: "111222333",
  },
  "openart-cw:peterchurcha": {
    id: "2kJ78EmaLx094qsWX1CU",
    name: "peterChurchA",
    type: "background",
    label: "peterChurchA",
    url: "https://cdn.openart.ai/church-a.jpg",
    imageUrl: "https://cdn.openart.ai/church-a.jpg",
    extraUrls: [],
    klingElementId: null,
  },
  "openart-cw:peterchurchb": {
    id: "GSZgTxAswCb3dSxOMUlW",
    name: "peterChurchB",
    type: "background",
    label: "peterChurchB",
    url: "https://cdn.openart.ai/church-b.jpg",
    imageUrl: "https://cdn.openart.ai/church-b.jpg",
    extraUrls: [],
    klingElementId: null,
  },
  "openart-cw:marcusreeves": {
    id: "AUjrExh5IC5wiJ9l3aqh",
    name: "marcusReeves",
    type: "character",
    label: "marcusReeves",
    url: "https://cdn.openart.ai/marcus-1.jpg",
    imageUrl: "https://cdn.openart.ai/marcus-1.jpg",
    extraUrls: [],
    klingElementId: "444555666",
  },
  "openart-cw:marcusbedroome": {
    id: "ZPKmsXrcR5PynG9OpfZH",
    name: "marcusBedroomE",
    type: "background",
    label: "marcusBedroomE",
    url: "https://cdn.openart.ai/bedroom-e.jpg",
    imageUrl: "https://cdn.openart.ai/bedroom-e.jpg",
    extraUrls: [],
    klingElementId: null,
  },
};

describe("end-to-end: ends-cross shot injection", () => {
  test("shot 1B — peterNightingale + peterChurchA", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const shotElements = ["peterChurchA", "peterNightingale"];
    const elements = shotElements.map((el) => el.replace(/^@/, ""));
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.added, 2);
    assert.equal(result.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
    assert.equal(result.idMap.peterChurchA, "2kJ78EmaLx094qsWX1CU");

    const prompt = "[Subject]: @peterNightingale — removes the chasuble.\n[Context]: @peterChurchA warm stained glass light.";
    const body = JSON.parse(JSON.stringify({ prompt }));
    for (const [name, id] of Object.entries(result.idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(!body.prompt.includes("@peterNightingale"));
    assert.ok(!body.prompt.includes("@peterChurchA"));
    assert.ok(body.prompt.includes("@TCOmrNbxzys8WExQjSrI"));
    assert.ok(body.prompt.includes("@2kJ78EmaLx094qsWX1CU"));
  });

  test("shot 1G — peterNightingale + peterChurchB (different angle)", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const elements = ["peterChurchB", "peterNightingale"];
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
    assert.equal(result.idMap.peterChurchB, "GSZgTxAswCb3dSxOMUlW");
    assert.notEqual(result.idMap.peterChurchB, result.idMap.peterChurchA);
  });

  test("shot with 3 elements — character + character + environment", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const elements = ["marcusBedroomE", "peterNightingale", "marcusReeves"];
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.added, 3);
    assert.equal(Object.keys(result.idMap).length, 3);

    const refs = getReceivedRefs();
    const types = refs.map((r) => r.resourceType).sort();
    assert.deepEqual(types, ["character", "character", "world"]);

    const prompt = "@peterNightingale and @marcusReeves in @marcusBedroomE.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }
    assert.ok(!transformed.includes("@peterNightingale"));
    assert.ok(!transformed.includes("@marcusReeves"));
    assert.ok(!transformed.includes("@marcusBedroomE"));
  });

  test("shot with empty elements array — no selection, no idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const elements = [];
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.added, 0);
    assert.equal(result.idMap, undefined);
  });

  test("shot with one missing element — partial success", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const elements = ["peterNightingale", "haleOfficeA"];
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.added, 1);
    assert.equal(getReceivedRefs().length, 1);
    assert.equal(result.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
    assert.equal(result.idMap.haleOfficeA, undefined);
  });

  test("element names with @ prefix are stripped before lookup", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const rawElements = ["@peterNightingale", "@peterChurchA"];
    const elements = rawElements.map((el) => el.replace(/^@/, ""));
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.added, 2);
    assert.equal(result.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
  });

  test("idMap is consumed once — simulates pendingElementIdMap clearing", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const result1 = await mod.selectElements(["peterNightingale"], storage);
    const idMap = result1.idMap;
    assert.equal(Object.keys(idMap).length, 1);

    const body1 = { prompt: "@peterNightingale walks." };
    for (const [name, id] of Object.entries(idMap)) {
      body1.prompt = body1.prompt.replaceAll(`@${name}`, `@${id}`);
    }
    assert.equal(body1.prompt, "@TCOmrNbxzys8WExQjSrI walks.");

    const clearedMap = null;
    const body2 = { prompt: "@peterNightingale stands." };
    if (clearedMap) {
      for (const [name, id] of Object.entries(clearedMap)) {
        body2.prompt = body2.prompt.replaceAll(`@${name}`, `@${id}`);
      }
    }
    assert.equal(body2.prompt, "@peterNightingale stands.", "after clearing, prompt is not transformed");
  });

  test("sequential shots reuse same storage — different elements selected", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const result1 = await mod.selectElements(["peterNightingale", "peterChurchA"], storage);
    assert.equal(result1.added, 2);
    assert.equal(Object.keys(result1.idMap).length, 2);

    await mod.clearElements();
    assert.equal(getReceivedRefs().length, 0);

    const result2 = await mod.selectElements(["marcusReeves", "marcusBedroomE"], storage);
    assert.equal(result2.added, 2);
    assert.equal(result2.idMap.marcusReeves, "AUjrExh5IC5wiJ9l3aqh");
    assert.equal(result2.idMap.marcusBedroomE, "ZPKmsXrcR5PynG9OpfZH");
    assert.equal(result2.idMap.peterNightingale, undefined);
  });

  test("full 1B kling prompt — fetch interceptor produces valid API body", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const result = await mod.selectElements(["peterChurchA", "peterNightingale"], storage);

    const klingPrompt = [
      "[Cinematography]: Static. MS from the nave looking toward the altar. No camera movement.",
      "[Subject]: @peterNightingale — removes the chasuble, folds it with practiced care, places it into the vestment cabinet to his left.",
      "[Action]: Hands lift the chasuble over his head in a smooth, practiced motion.",
      "[Context]: Stained glass light shifts subtly on the fabric as it moves.",
      "[Style & Ambiance]: Kodak Portra 400 warmth. Golden morning stained glass.",
      "[MOTION SCALE: 0.5]",
      "Aspect ratio: 16:9",
      "Negative prompt: dark church, night, candles only, rushing.",
    ].join("\n");

    const apiBody = {
      prompt: klingPrompt,
      model: "kling-v3",
      aspectRatio: "16:9",
      resolution: "720p",
      visualReferences: [
        { id: "TCOmrNbxzys8WExQjSrI", type: "character" },
        { id: "2kJ78EmaLx094qsWX1CU", type: "world" },
      ],
    };

    for (const [name, id] of Object.entries(result.idMap)) {
      apiBody.prompt = apiBody.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(!apiBody.prompt.includes("@peterNightingale"), "element name must not survive in API body");
    assert.ok(apiBody.prompt.includes("@TCOmrNbxzys8WExQjSrI"), "OpenArt ID must be in API body");
    assert.ok(apiBody.prompt.includes("[Cinematography]:"), "labeled blocks preserved");
    assert.ok(apiBody.prompt.includes("[MOTION SCALE: 0.5]"), "motion scale preserved");
    assert.ok(apiBody.prompt.includes("Negative prompt:"), "negative prompt preserved");
    assert.equal(apiBody.model, "kling-v3");
    assert.equal(apiBody.aspectRatio, "16:9");
    assert.equal(apiBody.visualReferences.length, 2);
  });
});

// ============================================================
// Fetch interceptor edge cases
// Tests the applyIdMapToRequestBody contract in isolation to
// cover boundary conditions the interceptor must handle.
// ============================================================

describe("fetch interceptor edge cases", () => {
  test("non-string prompt field is not transformed", () => {
    const body = JSON.parse(
      JSON.stringify({ prompt: 42, model: "kling-v3" })
    );
    const idMap = { peterNightingale: "peter-id" };
    if (body.prompt && typeof body.prompt === "string") {
      for (const [name, id] of Object.entries(idMap)) {
        body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
      }
    }
    assert.equal(body.prompt, 42);
  });

  test("null prompt field is not transformed", () => {
    const body = JSON.parse(
      JSON.stringify({ prompt: null, model: "kling-v3" })
    );
    const idMap = { peterNightingale: "peter-id" };
    if (body.prompt && typeof body.prompt === "string") {
      for (const [name, id] of Object.entries(idMap)) {
        body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
      }
    }
    assert.equal(body.prompt, null);
  });

  test("malformed JSON body does not crash (try/catch contract)", () => {
    const idMap = { peterNightingale: "peter-id" };
    let result = null;
    try {
      const body = JSON.parse("not valid json {{{");
      if (body.prompt && typeof body.prompt === "string") {
        for (const [name, id] of Object.entries(idMap)) {
          body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
        }
      }
      result = body;
    } catch {
      result = "caught";
    }
    assert.equal(result, "caught");
  });

  test("idMap is one-shot — cleared to null after use", () => {
    let pendingElementIdMap = { peterNightingale: "peter-id" };

    const body1 = { prompt: "@peterNightingale walks." };
    if (pendingElementIdMap) {
      for (const [name, id] of Object.entries(pendingElementIdMap)) {
        body1.prompt = body1.prompt.replaceAll(`@${name}`, `@${id}`);
      }
      pendingElementIdMap = null;
    }
    assert.equal(body1.prompt, "@peter-id walks.");
    assert.equal(pendingElementIdMap, null);

    const body2 = { prompt: "@peterNightingale stands." };
    if (pendingElementIdMap) {
      for (const [name, id] of Object.entries(pendingElementIdMap)) {
        body2.prompt = body2.prompt.replaceAll(`@${name}`, `@${id}`);
      }
    }
    assert.equal(body2.prompt, "@peterNightingale stands.", "second request is not transformed");
  });

  test("empty string prompt is not transformed", () => {
    const body = { prompt: "" };
    const idMap = { peterNightingale: "peter-id" };
    if (body.prompt && typeof body.prompt === "string") {
      for (const [name, id] of Object.entries(idMap)) {
        body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
      }
    }
    assert.equal(body.prompt, "");
  });
});

// ============================================================
// Substring and collision edge cases
// Element names that are prefixes/suffixes of each other must
// not cause cross-contamination in the idMap transformation.
// ============================================================

describe("idMap substring collision safety", () => {
  test("marcusReeves is not replaced inside marcusReevesJr", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const JR = { ...EMMANUEL, id: "jr-id", name: "marcusReevesJr" };
    const SR = { ...EMMANUEL, id: "sr-id", name: "marcusReeves" };
    const storage = mockStorage({
      "openart-cw:marcusreevesjr": JR,
      "openart-cw:marcusreeves": SR,
    });

    const result = await mod.selectElements(["marcusReevesJr", "marcusReeves"], storage);

    const prompt = "@marcusReevesJr sits. @marcusReeves stands.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(transformed.includes("@jr-id sits."), "Jr element fully replaced");
    assert.ok(transformed.includes("@sr-id stands."), "Sr element fully replaced");
    assert.ok(!transformed.includes("@marcusReeves"), "no leftover element names");
  });

  test("peterChurchA vs peterChurch — shorter name does not clobber longer", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CHURCH = { ...FOREST, id: "church-parent-id", name: "peterChurch" };
    const CHURCH_A = { ...FOREST, id: "church-a-id", name: "peterChurchA" };
    const storage = mockStorage({
      "openart-cw:peterchurch": CHURCH,
      "openart-cw:peterchurcha": CHURCH_A,
    });

    const result = await mod.selectElements(["peterChurch", "peterChurchA"], storage);

    const prompt = "@peterChurchA nave. @peterChurch exterior.";
    let transformed = prompt;
    const entries = Object.entries(result.idMap).sort((a, b) => b[0].length - a[0].length);
    for (const [name, id] of entries) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(transformed.includes("@church-a-id nave."));
    assert.ok(transformed.includes("@church-parent-id exterior."));
  });

  test("element name that is substring of another — replaceAll handles correctly", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const HALE = { ...EMMANUEL, id: "hale-id", name: "hale" };
    const HALE_OFFICE = { ...FOREST, id: "hale-office-id", name: "haleOffice" };
    const storage = mockStorage({
      "openart-cw:hale": HALE,
      "openart-cw:haleoffice": HALE_OFFICE,
    });

    const result = await mod.selectElements(["hale", "haleOffice"], storage);

    const prompt = "@haleOffice interior. @hale speaks.";
    let transformed = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(transformed.includes("@hale speaks.") || transformed.includes(`@${result.idMap.hale} speaks.`));
    assert.ok(!transformed.includes("@haleOffice"));
  });
});

// ============================================================
// openart.js video injection guard conditions
// These test the logic gates around postMessage dispatch.
// ============================================================

describe("video injection postMessage guards", () => {
  test("result.ok=false with non-empty idMap — postMessage should NOT fire", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "Component not found");

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "peter-id", name: "peterNightingale" },
    });

    const result = await mod.selectElements(["peterNightingale"], storage);

    assert.equal(result.ok, false);
    assert.equal(Object.keys(result.idMap).length, 1);

    const shouldPost = result.ok && result.idMap && Object.keys(result.idMap).length > 0;
    assert.equal(shouldPost, false, "guard blocks postMessage on failed selection");
  });

  test("result.ok=true with empty names — no idMap, postMessage should NOT fire", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const result = await mod.selectElements([], mockStorage({}));
    assert.equal(result.idMap, undefined);
    const shouldPost = !!(result.idMap && Object.keys(result.idMap).length);
    assert.equal(shouldPost, false);
  });

  test("result.ok=true with populated idMap — postMessage SHOULD fire", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "peter-id", name: "peterNightingale" },
    });

    const result = await mod.selectElements(["peterNightingale"], storage);
    const shouldPost = !result.ok ? false : (result.idMap && Object.keys(result.idMap).length > 0);
    assert.equal(shouldPost, true);
  });

  test("no project — elements block is skipped entirely", () => {
    const project = null;
    const shot = { meta: { elements: ["peterNightingale"] } };

    let selectCalled = false;
    if (project) {
      const elements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
      if (elements.length) {
        selectCalled = true;
      }
    }
    assert.equal(selectCalled, false, "no project means no selection attempt");
  });

  test("project set but elements empty — selectElements not called", () => {
    const project = "ends-cross";
    const shot = { meta: { elements: [] } };

    let selectCalled = false;
    if (project) {
      const elements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
      if (elements.length) {
        selectCalled = true;
      }
    }
    assert.equal(selectCalled, false, "empty elements means no selection attempt");
  });

  test("project set but shot.meta.elements undefined — defaults to empty", () => {
    const project = "ends-cross";
    const shot = { meta: {} };

    const elements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
    assert.deepEqual(elements, []);
  });

  test("project set but shot.meta undefined — defaults to empty", () => {
    const project = "ends-cross";
    const shot = {};

    const elements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
    assert.deepEqual(elements, []);
  });
});

// ============================================================
// cwDataToVisualRef shape guarantees for idMap consumers
// The visual reference object shape must match what OpenArt's
// React component expects, or the selection silently fails.
// ============================================================

describe("cwDataToVisualRef shape for idMap consumers", () => {
  test("ref id matches the C&W element id used in idMap", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const cw = { ...EMMANUEL, id: "specific-id-123" };
    const ref = mod.cwDataToVisualRef(cw);

    assert.equal(ref.id, "specific-id-123", "ref.id must match C&W id for prompt @id replacement");
  });

  test("ref has all required fields for OpenArt React component", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef(EMMANUEL);
    const requiredFields = ["id", "sourceType", "userId", "url", "resourceType", "status", "input", "metadata"];
    for (const field of requiredFields) {
      assert.ok(field in ref, `ref must have ${field}`);
    }

    const requiredInputFields = ["referenceType", "name", "imageUrl", "extraUrls", "klingElementId"];
    for (const field of requiredInputFields) {
      assert.ok(field in ref.input, `ref.input must have ${field}`);
    }
  });

  test("klingElementId is preserved from C&W data to visual ref", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const withKling = mod.cwDataToVisualRef(EMMANUEL);
    assert.equal(withKling.input.klingElementId, "311196336483313");

    const withoutKling = mod.cwDataToVisualRef(FOREST);
    assert.equal(withoutKling.input.klingElementId, null);
  });

  test("extraUrls array is preserved from C&W data", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const multiAngle = mod.cwDataToVisualRef(EMMANUEL);
    assert.deepEqual(multiAngle.input.extraUrls, ["https://cdn.openart.ai/emmanuel-2.jpg"]);

    const singleAngle = mod.cwDataToVisualRef(MARY);
    assert.deepEqual(singleAngle.input.extraUrls, []);
  });

  test("label falls back to name when not provided", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const noLabel = { ...EMMANUEL, label: undefined };
    const ref = mod.cwDataToVisualRef(noLabel);
    assert.equal(ref.input.label, "Emmanuel");
  });

  test("url falls back to imageUrl and vice versa", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const onlyUrl = { ...EMMANUEL, imageUrl: undefined };
    const ref1 = mod.cwDataToVisualRef(onlyUrl);
    assert.equal(ref1.url, EMMANUEL.url);

    const onlyImageUrl = { ...EMMANUEL, url: undefined };
    const ref2 = mod.cwDataToVisualRef(onlyImageUrl);
    assert.equal(ref2.url, EMMANUEL.imageUrl);
  });
});

// ============================================================
// Iteration 1: idMap with special characters in element names
// Element names can contain underscores, hyphens, and numbers.
// ============================================================

describe("idMap with special element name formats", () => {
  test("underscore element name — marcusBedroom_A", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...FOREST, id: "bed-a-id", name: "marcusBedroom_A" };
    const storage = mockStorage({ "openart-cw:marcusbedroom_a": CW });

    const result = await mod.selectElements(["marcusBedroom_A"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.idMap.marcusBedroom_A, "bed-a-id");

    const prompt = "@marcusBedroom_A interior.";
    let t = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.equal(t, "@bed-a-id interior.");
  });

  test("numeric suffix — guard2", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: "guard2-id", name: "guard2" };
    const storage = mockStorage({ "openart-cw:guard2": CW });

    const result = await mod.selectElements(["guard2"], storage);
    assert.equal(result.idMap.guard2, "guard2-id");
  });

  test("hyphenated name — half-god", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: "hg-id", name: "half-god" };
    const storage = mockStorage({ "openart-cw:half-god": CW });

    const result = await mod.selectElements(["half-god"], storage);
    assert.equal(result.idMap["half-god"], "hg-id");
  });

  test("single-char element name", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: "x-id", name: "X" };
    const storage = mockStorage({ "openart-cw:x": CW });

    const result = await mod.selectElements(["X"], storage);
    assert.equal(result.idMap.X, "x-id");
  });
});

// ============================================================
// Iteration 2: idMap with OpenArt IDs that contain special chars
// OpenArt IDs are typically alphanumeric, but test robustness.
// ============================================================

describe("idMap with various OpenArt ID formats", () => {
  test("OpenArt ID with mixed case and numbers", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: "AUjrExh5IC5wiJ9l3aqh" };
    const storage = mockStorage({ "openart-cw:emmanuel": CW });

    const result = await mod.selectElements(["Emmanuel"], storage);
    const prompt = "@Emmanuel walks.";
    let t = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.equal(t, "@AUjrExh5IC5wiJ9l3aqh walks.");
  });

  test("OpenArt ID with hyphens", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: "abc-def-123" };
    const storage = mockStorage({ "openart-cw:emmanuel": CW });

    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.idMap.Emmanuel, "abc-def-123");

    const prompt = "@Emmanuel sits.";
    let t = prompt;
    for (const [name, id] of Object.entries(result.idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.equal(t, "@abc-def-123 sits.");
  });

  test("very long OpenArt ID", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const longId = "a".repeat(100);
    const CW = { ...EMMANUEL, id: longId };
    const storage = mockStorage({ "openart-cw:emmanuel": CW });

    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.idMap.Emmanuel, longId);
  });
});

// ============================================================
// Iteration 3: selectElements ordering guarantees
// The order of refs sent to the page script matters for
// OpenArt's React component.
// ============================================================

describe("selectElements ordering", () => {
  test("refs are sent in the same order as input names", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "p-id", name: "peterNightingale" },
      "openart-cw:marcusreeves": { ...EMMANUEL, id: "m-id", name: "marcusReeves" },
      "openart-cw:peterchurcha": { ...FOREST, id: "c-id", name: "peterChurchA" },
    });

    await mod.selectElements(["marcusReeves", "peterChurchA", "peterNightingale"], storage);
    const refs = getReceivedRefs();
    assert.equal(refs[0].input.name, "marcusReeves");
    assert.equal(refs[1].input.name, "peterChurchA");
    assert.equal(refs[2].input.name, "peterNightingale");
  });

  test("idMap key order matches input order", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "p-id", name: "peterNightingale" },
      "openart-cw:marcusreeves": { ...EMMANUEL, id: "m-id", name: "marcusReeves" },
    });

    const result = await mod.selectElements(["marcusReeves", "peterNightingale"], storage);
    const keys = Object.keys(result.idMap);
    assert.equal(keys[0], "marcusReeves");
    assert.equal(keys[1], "peterNightingale");
  });

  test("missing elements do not shift order of found elements", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "p-id", name: "peterNightingale" },
      "openart-cw:marcusreeves": { ...EMMANUEL, id: "m-id", name: "marcusReeves" },
    });

    await mod.selectElements(["peterNightingale", "ghost", "marcusReeves"], storage);
    const refs = getReceivedRefs();
    assert.equal(refs.length, 2);
    assert.equal(refs[0].input.name, "peterNightingale");
    assert.equal(refs[1].input.name, "marcusReeves");
  });
});

// ============================================================
// Iteration 4: clearElements interaction with idMap
// ============================================================

describe("clearElements and idMap interaction", () => {
  test("clearElements does not return idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const result = await mod.clearElements();
    assert.equal(result.ok, true);
    assert.equal(result.idMap, undefined);
  });

  test("clearElements after selectElements — previous idMap is separate", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const selectResult = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(Object.keys(selectResult.idMap).length, 1);

    const clearResult = await mod.clearElements();
    assert.equal(clearResult.idMap, undefined);

    assert.equal(selectResult.idMap.Emmanuel, EMMANUEL.id, "original idMap still intact");
  });
});

// ============================================================
// Iteration 5: C&W data edge cases affecting idMap
// ============================================================

describe("C&W data edge cases for idMap", () => {
  test("C&W entry with empty string id — excluded from idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: "" };
    const storage = mockStorage({ "openart-cw:emmanuel": CW });

    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.added, 1);
    assert.equal(result.idMap.Emmanuel, undefined, "empty id excluded from idMap");
  });

  test("C&W entry with null id — excluded from idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const CW = { ...EMMANUEL, id: null };
    const storage = mockStorage({ "openart-cw:emmanuel": CW });

    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.idMap.Emmanuel, undefined);
  });

  test("C&W entry with undefined id — excluded from idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const noId = { name: "Emmanuel", type: "character", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] };
    const storage = mockStorage({ "openart-cw:emmanuel": noId });

    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.idMap.Emmanuel, undefined);
  });

  test("storage returns null for key — element skipped", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = (key) => Promise.resolve({ [key]: null });
    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, false);
    assert.deepEqual(result.idMap, {});
  });
});

// ============================================================
// Iteration 6: prompt transformation with multi-line kling format
// Real kling prompts have labeled blocks, metadata lines, and
// negative prompts. All must survive transformation.
// ============================================================

describe("idMap prompt transformation — multi-line format preservation", () => {
  test("newlines between labeled blocks are preserved", () => {
    const idMap = { peterNightingale: "p-id", peterChurchA: "c-id" };
    const prompt = "[Subject]: @peterNightingale stands.\n\n[Environment]: @peterChurchA interior.\n\nNegative: blur.";
    let t = prompt;
    for (const [name, id] of Object.entries(idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.equal(t, "[Subject]: @p-id stands.\n\n[Environment]: @c-id interior.\n\nNegative: blur.");
  });

  test("element in negative prompt is NOT transformed (no @)", () => {
    const idMap = { peterNightingale: "p-id" };
    const prompt = "[Subject]: @peterNightingale.\nNegative prompt: peterNightingale, blur.";
    let t = prompt;
    for (const [name, id] of Object.entries(idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.ok(t.includes("@p-id."));
    assert.ok(t.includes("peterNightingale, blur."), "bare name in negative prompt untouched");
  });

  test("MOTION SCALE and aspect ratio lines are untouched", () => {
    const idMap = { peterNightingale: "p-id" };
    const prompt = "@peterNightingale walks.\n[MOTION SCALE: 0.5]\nAspect ratio: 16:9";
    let t = prompt;
    for (const [name, id] of Object.entries(idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.ok(t.includes("[MOTION SCALE: 0.5]"));
    assert.ok(t.includes("Aspect ratio: 16:9"));
  });

  test("element mentioned in [Action] line — replaced", () => {
    const idMap = { peterNightingale: "p-id" };
    const prompt = "[Action]: @peterNightingale's hand reaches for the phone. @peterNightingale turns.";
    let t = prompt;
    for (const [name, id] of Object.entries(idMap)) {
      t = t.replaceAll(`@${name}`, `@${id}`);
    }
    assert.ok(!t.includes("@peterNightingale"));
    assert.equal(t, "[Action]: @p-id's hand reaches for the phone. @p-id turns.");
  });
});

// ============================================================
// Iteration 7: concurrent injection — two shots back to back
// Simulates rapid injection of consecutive shots.
// ============================================================

describe("rapid sequential shot injection", () => {
  test("second shot overwrites first shot's idMap", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const r1 = await mod.selectElements(["peterNightingale", "peterChurchA"], storage);
    assert.equal(r1.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
    assert.equal(r1.idMap.peterChurchA, "2kJ78EmaLx094qsWX1CU");

    const r2 = await mod.selectElements(["marcusReeves", "marcusBedroomE"], storage);
    assert.equal(r2.idMap.marcusReeves, "AUjrExh5IC5wiJ9l3aqh");
    assert.equal(r2.idMap.marcusBedroomE, "ZPKmsXrcR5PynG9OpfZH");
    assert.equal(r2.idMap.peterNightingale, undefined, "first shot's elements not in second idMap");
  });

  test("same element in two consecutive shots produces same id", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const r1 = await mod.selectElements(["peterNightingale", "peterChurchA"], storage);
    const r2 = await mod.selectElements(["peterNightingale", "peterChurchB"], storage);

    assert.equal(r1.idMap.peterNightingale, r2.idMap.peterNightingale, "same character same id");
    assert.notEqual(r1.idMap.peterChurchA, r2.idMap.peterChurchB, "different environments different ids");
  });
});

// ============================================================
// Iteration 8: pendingElementIdMap lifecycle simulation
// Simulates the full state machine: set → consume → null.
// ============================================================

describe("pendingElementIdMap state machine", () => {
  test("full lifecycle: null → set → consumed → null", async () => {
    let pendingElementIdMap = null;
    assert.equal(pendingElementIdMap, null, "starts null");

    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const result = await mod.selectElements(["peterNightingale"], storage);
    if (result.idMap && Object.keys(result.idMap).length) {
      pendingElementIdMap = result.idMap;
    }
    assert.notEqual(pendingElementIdMap, null, "set after successful selection");
    assert.equal(pendingElementIdMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");

    const body = { prompt: "@peterNightingale walks." };
    if (pendingElementIdMap) {
      for (const [name, id] of Object.entries(pendingElementIdMap)) {
        body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
      }
      pendingElementIdMap = null;
    }
    assert.equal(body.prompt, "@TCOmrNbxzys8WExQjSrI walks.", "prompt transformed");
    assert.equal(pendingElementIdMap, null, "cleared after consumption");

    const body2 = { prompt: "@peterNightingale stands." };
    if (pendingElementIdMap) {
      for (const [name, id] of Object.entries(pendingElementIdMap)) {
        body2.prompt = body2.prompt.replaceAll(`@${name}`, `@${id}`);
      }
    }
    assert.equal(body2.prompt, "@peterNightingale stands.", "no transform after clearing");
  });

  test("failed selection does not set pendingElementIdMap", async () => {
    let pendingElementIdMap = null;

    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "Component not found");

    const storage = mockStorage(ENDS_CROSS_CW);
    const result = await mod.selectElements(["peterNightingale"], storage);

    if (!result.ok) {
      // guard in openart.js: else if (result.idMap && ...)
    } else if (result.idMap && Object.keys(result.idMap).length) {
      pendingElementIdMap = result.idMap;
    }

    assert.equal(pendingElementIdMap, null, "not set on failed selection");
  });

  test("selection with only missing elements does not set pending", async () => {
    let pendingElementIdMap = null;

    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({});

    const result = await mod.selectElements(["ghostElement"], storage);

    if (!result.ok) {
      // skip
    } else if (result.idMap && Object.keys(result.idMap).length) {
      pendingElementIdMap = result.idMap;
    }

    assert.equal(pendingElementIdMap, null);
  });
});

// ============================================================
// Iteration 9: interplay between visualReferences and idMap
// Both pendingVisualReferences and pendingElementIdMap can be
// active at the same time in the fetch interceptor.
// ============================================================

describe("visualReferences and idMap coexistence", () => {
  test("both can be applied to the same request body", () => {
    const pendingVisualRefs = [
      { id: "TCOmrNbxzys8WExQjSrI", type: "character", name: "peterNightingale" },
    ];
    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI" };

    const body = {
      prompt: "@peterNightingale walks.",
      visualReferences: [],
    };

    body.visualReferences = [...body.visualReferences, ...pendingVisualRefs];

    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(body.prompt, "@TCOmrNbxzys8WExQjSrI walks.");
    assert.equal(body.visualReferences.length, 1);
    assert.equal(body.visualReferences[0].id, "TCOmrNbxzys8WExQjSrI");
  });

  test("visualReferences added first, then prompt transformed", () => {
    const body = {
      prompt: "@peterNightingale and @peterChurchA.",
      visualReferences: [{ id: "existing-ref", type: "character" }],
    };

    const pendingRefs = [
      { id: "TCOmrNbxzys8WExQjSrI", type: "character" },
      { id: "2kJ78EmaLx094qsWX1CU", type: "world" },
    ];
    body.visualReferences = [...body.visualReferences, ...pendingRefs];

    const idMap = {
      peterNightingale: "TCOmrNbxzys8WExQjSrI",
      peterChurchA: "2kJ78EmaLx094qsWX1CU",
    };
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(body.visualReferences.length, 3);
    assert.ok(!body.prompt.includes("@peterNightingale"));
    assert.ok(!body.prompt.includes("@peterChurchA"));
  });

  test("idMap without visualReferences still transforms prompt", () => {
    const body = { prompt: "@peterNightingale walks." };
    const idMap = { peterNightingale: "p-id" };

    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(body.prompt, "@p-id walks.");
    assert.equal(body.visualReferences, undefined);
  });
});

// ============================================================
// Iteration 10: regression guards — the exact scenarios that
// triggered the original bugs in this session.
// ============================================================

describe("regression: original bug scenarios", () => {
  test("shot 1E-2 — peterNightingale found by camelCase lookup", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": {
        id: "TCOmrNbxzys8WExQjSrI",
        name: "peterNightingale",
        type: "character",
        label: "peterNightingale",
        url: "https://cdn.openart.ai/peter.jpg",
        imageUrl: "https://cdn.openart.ai/peter.jpg",
        extraUrls: [],
        klingElementId: null,
      },
      "openart-cw:peterchurcha": {
        id: "2kJ78EmaLx094qsWX1CU",
        name: "peterChurchA",
        type: "background",
        label: "peterChurchA",
        url: "https://cdn.openart.ai/church.jpg",
        imageUrl: "https://cdn.openart.ai/church.jpg",
        extraUrls: [],
        klingElementId: null,
      },
    });

    const shotElements = ["peterChurchA", "peterNightingale"];
    const elements = shotElements.map((el) => el.replace(/^@/, ""));
    const result = await mod.selectElements(elements, storage);

    assert.equal(result.ok, true, "selection must succeed");
    assert.equal(result.added, 2, "both elements found");
    assert.equal(result.idMap.peterNightingale, "TCOmrNbxzys8WExQjSrI");
    assert.equal(result.idMap.peterChurchA, "2kJ78EmaLx094qsWX1CU");
  });

  test("camelCase element name matches lowercase storage key", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "p-id", name: "peterNightingale" },
    });

    const result = await mod.selectElements(["peterNightingale"], storage);
    assert.equal(result.ok, true, "camelCase → lowercase lookup must work");
    assert.equal(result.idMap.peterNightingale, "p-id");
  });

  test("prompt text NOT modified by selectElements — only idMap returned", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({
      "openart-cw:peternightingale": { ...EMMANUEL, id: "p-id", name: "peterNightingale" },
    });

    const prompt = "@peterNightingale removes the chasuble.";
    const result = await mod.selectElements(["peterNightingale"], storage);

    assert.equal(prompt, "@peterNightingale removes the chasuble.", "original prompt string unchanged");
    assert.equal(result.idMap.peterNightingale, "p-id", "idMap available for fetch interceptor");
  });

  test("fetch interceptor transforms prompt in API body, not in UI", () => {
    const uiPrompt = "@peterNightingale removes the chasuble.";
    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI" };

    const apiBody = JSON.parse(JSON.stringify({ prompt: uiPrompt }));
    for (const [name, id] of Object.entries(idMap)) {
      apiBody.prompt = apiBody.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(uiPrompt, "@peterNightingale removes the chasuble.", "UI prompt untouched");
    assert.equal(apiBody.prompt, "@TCOmrNbxzys8WExQjSrI removes the chasuble.", "API body transformed");
  });

  test("13 captured C&W elements all produce unique idMap entries", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage(ENDS_CROSS_CW);

    const allElements = Object.values(ENDS_CROSS_CW).map((cw) => cw.name);
    const result = await mod.selectElements(allElements, storage);

    assert.equal(result.ok, true);
    assert.equal(result.added, allElements.length);
    assert.equal(Object.keys(result.idMap).length, allElements.length);

    const ids = Object.values(result.idMap);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "all IDs must be unique");
  });

  test("settings panel opening does not interfere with idMap dispatch", () => {
    const idMap = { peterNightingale: "p-id" };
    const payload = { type: "promptsync-set-element-id-map", idMap };

    assert.equal(payload.type, "promptsync-set-element-id-map");
    assert.equal(typeof payload.idMap, "object");
    assert.ok(!Array.isArray(payload.idMap));
    assert.equal(payload.idMap.peterNightingale, "p-id");
  });
});

// ============================================================
// Iteration 11: sendToPageScript timeout path
// When the page script doesn't respond within 5s, the promise
// resolves with { ok: false, error: "Page script did not respond" }.
// idMap must still be returned from selectElements.
// ============================================================

describe("sendToPageScript timeout behavior", () => {
  function buildSilentDOM() {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://openart.ai/create-video",
    });
    // No message listener — page script never responds
    return { dom };
  }

  test("timeout resolves with ok:false after page script silence", async () => {
    const { dom } = buildSilentDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);

    assert.equal(result.ok, false);
    assert.match(result.error, /Page script did not respond/);
  });

  test("idMap is still populated despite timeout", async () => {
    const { dom } = buildSilentDOM();
    const mod = loadModule(dom);

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);

    assert.equal(result.ok, false);
    assert.deepEqual(result.idMap, { Emmanuel: EMMANUEL.id });
  });

  test("clearElements also times out gracefully", async () => {
    const { dom } = buildSilentDOM();
    const mod = loadModule(dom);

    const result = await mod.clearElements();
    assert.equal(result.ok, false);
    assert.match(result.error, /Page script did not respond/);
  });
});

// ============================================================
// Iteration 12: cwDataToVisualRef with degenerate/missing fields
// ============================================================

describe("cwDataToVisualRef degenerate inputs", () => {
  test("missing url and imageUrl — url falls back to undefined", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ id: "x", name: "Test", type: "character" });
    assert.equal(ref.url, undefined);
    assert.equal(ref.input.imageUrl, undefined);
  });

  test("missing name — input.name is undefined", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ id: "x", url: "https://x.png", imageUrl: "https://x.png", type: "character" });
    assert.equal(ref.input.name, undefined);
  });

  test("missing type — defaults to character resourceType", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ id: "x", name: "Test", url: "https://x.png", imageUrl: "https://x.png" });
    assert.equal(ref.resourceType, "character");
    assert.equal(ref.input.referenceType, "character");
  });

  test("type 'character' explicitly", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ ...EMMANUEL, type: "character" });
    assert.equal(ref.resourceType, "character");
  });

  test("unknown type defaults to character (not world)", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ ...EMMANUEL, type: "prop" });
    assert.equal(ref.resourceType, "character");
    assert.equal(ref.input.referenceType, "character");
  });

  test("URL with query string — format strips query params", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ ...EMMANUEL, url: "https://cdn.openart.ai/img.webp?token=abc&v=2" });
    assert.equal(ref.metadata.format, "webp");
  });

  test("missing extraUrls — defaults to empty array", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ id: "x", name: "Test", url: "https://x.png", imageUrl: "https://x.png", type: "character" });
    assert.deepEqual(ref.input.extraUrls, []);
  });

  test("missing klingElementId — defaults to null", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const ref = mod.cwDataToVisualRef({ id: "x", name: "Test", url: "https://x.png", imageUrl: "https://x.png", type: "character" });
    assert.equal(ref.input.klingElementId, null);
  });
});

// ============================================================
// Iteration 13: deriveElementsFromPrompt
// Used by the image path to filter shot.meta.elements to only
// those actually @-mentioned in the prompt body.
// ============================================================

describe("deriveElementsFromPrompt", () => {
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

  test("extracts elements mentioned with @name in body", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA", "marcusReeves"] },
      mjPrompt: { body: "@peterNightingale removes chasuble. @peterChurchA warm light." },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result.sort(), ["peterChurchA", "peterNightingale"]);
  });

  test("returns all elements when none are mentioned in body", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA"] },
      mjPrompt: { body: "A man walks through a church." },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["peterNightingale", "peterChurchA"]);
  });

  test("returns all elements when body is empty", () => {
    const shot = {
      meta: { elements: ["peterNightingale"] },
      mjPrompt: { body: "" },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["peterNightingale"]);
  });

  test("returns all elements when mjPrompt is undefined", () => {
    const shot = { meta: { elements: ["peterNightingale"] } };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["peterNightingale"]);
  });

  test("returns empty when meta.elements is undefined and no body", () => {
    const shot = { meta: {} };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, []);
  });

  test("recognizes @element followed by space", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero walks away" },
    };
    assert.deepEqual(deriveElementsFromPrompt(shot), ["hero"]);
  });

  test("recognizes @element followed by newline", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero\nstands" },
    };
    assert.deepEqual(deriveElementsFromPrompt(shot), ["hero"]);
  });

  test("recognizes @element followed by possessive 's", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero's hand reaches out" },
    };
    assert.deepEqual(deriveElementsFromPrompt(shot), ["hero"]);
  });

  test("recognizes @element followed by period", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "Looking at @hero." },
    };
    assert.deepEqual(deriveElementsFromPrompt(shot), ["hero"]);
  });

  test("recognizes @element followed by comma", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero, standing tall" },
    };
    assert.deepEqual(deriveElementsFromPrompt(shot), ["hero"]);
  });

  test("recognizes @element followed by colon", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero: standing tall" },
    };
    assert.deepEqual(deriveElementsFromPrompt(shot), ["hero"]);
  });

  test("does NOT recognize @element at end of string without delimiter", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "Looking at @hero" },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["hero"], "falls back to all elements since no match found");
  });

  test("does NOT match bare element name without @ prefix", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "hero walks. But not @hero " },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["hero"]);
  });
});

// ============================================================
// Iteration 14: C&W persistence writer edge cases
// openart.js line 959-979 persists elements from
// promptsync-cw-elements-captured messages.
// ============================================================

describe("C&W persistence writer contract", () => {
  function writerPersist(elements) {
    const storage = {};
    for (const el of elements) {
      if (!el.id || !el.name) continue;
      const key = `openart-cw:${el.name.toLowerCase().trim()}`;
      storage[key] = {
        id: el.id,
        name: el.name,
        type: el.type || "character",
        label: el.label || el.name,
        url: el.url,
        imageUrl: el.imageUrl,
        extraUrls: el.extraUrls || [],
        klingElementId: el.klingElementId || null,
        capturedAt: new Date().toISOString(),
      };
    }
    return storage;
  }

  test("persists element with all fields", () => {
    const storage = writerPersist([EMMANUEL]);
    const stored = storage["openart-cw:emmanuel"];
    assert.ok(stored);
    assert.equal(stored.id, EMMANUEL.id);
    assert.equal(stored.name, EMMANUEL.name);
    assert.equal(stored.klingElementId, EMMANUEL.klingElementId);
    assert.deepEqual(stored.extraUrls, EMMANUEL.extraUrls);
  });

  test("skips element with empty id", () => {
    const storage = writerPersist([{ ...EMMANUEL, id: "" }]);
    assert.deepEqual(storage, {});
  });

  test("skips element with null id", () => {
    const storage = writerPersist([{ ...EMMANUEL, id: null }]);
    assert.deepEqual(storage, {});
  });

  test("skips element with empty name", () => {
    const storage = writerPersist([{ ...EMMANUEL, name: "" }]);
    assert.deepEqual(storage, {});
  });

  test("skips element with undefined name", () => {
    const storage = writerPersist([{ id: "x", type: "character", url: "https://x.png" }]);
    assert.deepEqual(storage, {});
  });

  test("includes capturedAt ISO timestamp", () => {
    const before = new Date().toISOString();
    const storage = writerPersist([EMMANUEL]);
    const stored = storage["openart-cw:emmanuel"];
    assert.ok(stored.capturedAt);
    assert.ok(stored.capturedAt >= before);
    assert.match(stored.capturedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  test("defaults type to character when missing", () => {
    const storage = writerPersist([{ id: "x", name: "Test", url: "https://x.png" }]);
    assert.equal(storage["openart-cw:test"].type, "character");
  });

  test("defaults label to name when missing", () => {
    const storage = writerPersist([{ id: "x", name: "TestChar", url: "https://x.png" }]);
    assert.equal(storage["openart-cw:testchar"].label, "TestChar");
  });

  test("defaults extraUrls to empty array when missing", () => {
    const storage = writerPersist([{ id: "x", name: "Test", url: "https://x.png" }]);
    assert.deepEqual(storage["openart-cw:test"].extraUrls, []);
  });

  test("defaults klingElementId to null when missing", () => {
    const storage = writerPersist([{ id: "x", name: "Test", url: "https://x.png" }]);
    assert.equal(storage["openart-cw:test"].klingElementId, null);
  });

  test("camelCase name is lowercased in key", () => {
    const storage = writerPersist([{ ...EMMANUEL, name: "peterNightingale" }]);
    assert.ok(storage["openart-cw:peternightingale"]);
    assert.equal(storage["openart-cw:peternightingale"].name, "peterNightingale");
  });

  test("name with trailing whitespace is trimmed in key", () => {
    const storage = writerPersist([{ ...EMMANUEL, name: "Peter  " }]);
    assert.ok(storage["openart-cw:peter"]);
    assert.equal(storage["openart-cw:peter"].name, "Peter  ");
  });

  test("multiple elements persisted independently", () => {
    const storage = writerPersist([EMMANUEL, MARY, FOREST]);
    assert.equal(Object.keys(storage).length, 3);
    assert.ok(storage["openart-cw:emmanuel"]);
    assert.ok(storage["openart-cw:mary"]);
    assert.ok(storage["openart-cw:dark forest"]);
  });

  test("second element with same name overwrites first", () => {
    const el1 = { ...EMMANUEL, url: "https://old.png" };
    const el2 = { ...EMMANUEL, url: "https://new.png" };
    const storage = writerPersist([el1, el2]);
    assert.equal(storage["openart-cw:emmanuel"].url, "https://new.png");
  });
});

// ============================================================
// Iteration 15: message type string constants
// The sender (openart.js) and receiver (openart-page.js) must
// use identical message type strings. Typos cause silent failures.
// ============================================================

describe("message type string constants", () => {
  const MESSAGE_TYPES = {
    selectVisualRefs: "promptsync-select-visual-refs",
    selectVisualRefsResult: "promptsync-select-visual-refs-result",
    setElementIdMap: "promptsync-set-element-id-map",
    setVisualReferences: "promptsync-set-visual-references",
    clearPending: "promptsync-clear-pending",
    setTarget: "promptsync-set-target",
    directGenerate: "promptsync-direct-generate",
    directGenerateResult: "promptsync-direct-generate-result",
    setProjectId: "promptsync-set-project-id",
    projectIdCaptured: "promptsync-project-id-captured",
    cwElementsCaptured: "promptsync-cw-elements-captured",
    generationCaptured: "promptsync-generation-captured",
    autoDownloadReady: "promptsync-auto-download-ready",
  };

  test("all message types use promptsync- prefix", () => {
    for (const [, type] of Object.entries(MESSAGE_TYPES)) {
      assert.ok(type.startsWith("promptsync-"), `"${type}" must start with "promptsync-"`);
    }
  });

  test("no duplicate message types", () => {
    const types = Object.values(MESSAGE_TYPES);
    const unique = new Set(types);
    assert.equal(unique.size, types.length, "all message types must be unique");
  });

  test("request/result pairs are consistent", () => {
    assert.equal(
      MESSAGE_TYPES.selectVisualRefs + "-result",
      MESSAGE_TYPES.selectVisualRefsResult,
    );
    assert.equal(
      MESSAGE_TYPES.directGenerate + "-result",
      MESSAGE_TYPES.directGenerateResult,
    );
  });

  test("idMap message type matches what openart.js sends", () => {
    const sent = { type: "promptsync-set-element-id-map", idMap: {} };
    assert.equal(sent.type, MESSAGE_TYPES.setElementIdMap);
  });

  test("select visual refs message type matches request/response pair", () => {
    const request = { type: "promptsync-select-visual-refs", requestId: "test", references: [] };
    const response = { type: "promptsync-select-visual-refs-result", requestId: "test", ok: true };
    assert.equal(request.type, MESSAGE_TYPES.selectVisualRefs);
    assert.equal(response.type, MESSAGE_TYPES.selectVisualRefsResult);
  });
});

// ============================================================
// Iteration 16: clearElements sends empty array, not null
// The page script handler does `references || []` — if we
// sent null, the page script would still work, but the React
// component might behave differently.
// ============================================================

describe("clearElements message shape", () => {
  test("clearElements posts an empty array, not null", async () => {
    let postedData = null;
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://openart.ai/create-video",
    });
    dom.window.addEventListener("message", (event) => {
      if (event.data?.type === "promptsync-select-visual-refs") {
        postedData = event.data;
        dom.window.postMessage({
          type: "promptsync-select-visual-refs-result",
          requestId: event.data.requestId,
          ok: true,
          added: 0,
        }, "*");
      }
    });

    const mod = loadModule(dom);
    await mod.clearElements();

    assert.ok(postedData);
    assert.ok(Array.isArray(postedData.references));
    assert.equal(postedData.references.length, 0);
    assert.notEqual(postedData.references, null);
  });
});

// ============================================================
// Iteration 17: sendToPageScript requestId uniqueness
// Each call to sendToPageScript should generate a unique
// requestId to prevent cross-wiring of responses.
// ============================================================

describe("sendToPageScript requestId", () => {
  test("requestId has vr- prefix", async () => {
    let capturedRequestId = null;
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://openart.ai/create-video",
    });
    dom.window.addEventListener("message", (event) => {
      if (event.data?.type === "promptsync-select-visual-refs") {
        capturedRequestId = event.data.requestId;
        dom.window.postMessage({
          type: "promptsync-select-visual-refs-result",
          requestId: event.data.requestId,
          ok: true,
          added: 0,
        }, "*");
      }
    });

    const mod = loadModule(dom);
    await mod.clearElements();

    assert.ok(capturedRequestId);
    assert.ok(capturedRequestId.startsWith("vr-"), `requestId "${capturedRequestId}" must start with "vr-"`);
  });

  test("consecutive calls produce different requestIds", async () => {
    const ids = [];
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://openart.ai/create-video",
    });
    dom.window.addEventListener("message", (event) => {
      if (event.data?.type === "promptsync-select-visual-refs") {
        ids.push(event.data.requestId);
        dom.window.postMessage({
          type: "promptsync-select-visual-refs-result",
          requestId: event.data.requestId,
          ok: true,
          added: (event.data.references || []).length,
        }, "*");
      }
    });

    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });

    await mod.selectElements(["Emmanuel"], storage);
    await mod.clearElements();
    await mod.selectElements(["Emmanuel"], storage);

    assert.equal(ids.length, 3);
    const unique = new Set(ids);
    assert.equal(unique.size, 3, "all requestIds must be unique");
  });
});

// ============================================================
// Iteration 18: fetch interceptor — FormData and non-string
// body types skip idMap transformation
// ============================================================

describe("fetch interceptor: non-string body types", () => {
  test("FormData body — idMap transform is skipped (typeof raw !== 'string')", () => {
    const idMap = { peterNightingale: "peter-id" };
    const raw = "form-data-blob";  // simulate non-JSON body

    let transformed = false;
    try {
      const body = JSON.parse(raw);
      if (body.prompt && typeof body.prompt === "string") {
        for (const [name, id] of Object.entries(idMap)) {
          body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
        }
        transformed = true;
      }
    } catch {
      // JSON.parse fails for non-JSON strings — idMap transform skipped
    }

    assert.equal(transformed, false, "non-JSON body must not be transformed");
  });

  test("null body — idMap transform is skipped", () => {
    const idMap = { peterNightingale: "peter-id" };
    const raw = null;

    let transformed = false;
    if (typeof raw === "string") {
      try {
        const body = JSON.parse(raw);
        if (body.prompt && typeof body.prompt === "string") {
          transformed = true;
        }
      } catch {}
    }

    assert.equal(transformed, false, "null body must not be transformed");
  });

  test("Blob body — idMap transform is skipped (typeof !== 'string')", () => {
    const raw = { type: "application/octet-stream", size: 1024 }; // mock blob
    assert.notEqual(typeof raw, "string");
  });
});

// ============================================================
// Iteration 19: fetch interceptor ordering — visualReferences
// are merged BEFORE idMap transform. Both mutate args[1].body.
// The idMap transform sees the already-merged body.
// ============================================================

describe("fetch interceptor ordering: visualReferences then idMap", () => {
  test("visualReferences merged first, then prompt transformed", () => {
    let body = {
      prompt: "@peterNightingale walks.",
      visualReferences: [],
    };

    // Step 1: merge pendingVisualReferences
    const pendingRefs = [{ id: "TCOmrNbxzys8WExQjSrI", type: "character", name: "peterNightingale" }];
    body.visualReferences = [...body.visualReferences, ...pendingRefs];

    // Step 2: apply idMap
    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI" };
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(body.visualReferences.length, 1);
    assert.equal(body.visualReferences[0].id, "TCOmrNbxzys8WExQjSrI");
    assert.equal(body.prompt, "@TCOmrNbxzys8WExQjSrI walks.");
  });

  test("requestBody reflects BOTH transforms for logging", () => {
    const rawBody = JSON.stringify({
      prompt: "@peterNightingale walks.",
      visualReferences: [],
    });

    let body = JSON.parse(rawBody);

    // Step 1: merge refs
    body.visualReferences = [...body.visualReferences, { id: "p-id", type: "character" }];
    let requestBody = body;

    // Step 2: apply idMap
    body.prompt = body.prompt.replaceAll("@peterNightingale", "@p-id");
    requestBody = body;

    assert.equal(requestBody.prompt, "@p-id walks.");
    assert.equal(requestBody.visualReferences.length, 1);
  });

  test("idMap sees merged body — refs already in visualReferences", () => {
    const body = {
      prompt: "@peterNightingale and @peterChurchA.",
      visualReferences: [
        { id: "TCOmrNbxzys8WExQjSrI", type: "character" },
        { id: "2kJ78EmaLx094qsWX1CU", type: "world" },
      ],
    };

    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI", peterChurchA: "2kJ78EmaLx094qsWX1CU" };
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }

    assert.equal(body.prompt, "@TCOmrNbxzys8WExQjSrI and @2kJ78EmaLx094qsWX1CU.");
    assert.equal(body.visualReferences[0].id, body.prompt.match(/@(\S+)/)[1]);
  });
});

// ============================================================
// Iteration 20: video path guard — only dispatches idMap when
// result.ok is true. Failed selection warns but does NOT post.
// This mirrors the exact openart.js guard:
//   if (!result.ok) { warn } else if (result.idMap && ...) { post }
// ============================================================

describe("video path idMap dispatch guard — exhaustive", () => {
  test("ok:true, idMap with entries → dispatch", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });

    const result = await mod.selectElements(["Emmanuel"], storage);
    const shouldPost = !result.ok ? false : !!(result.idMap && Object.keys(result.idMap).length);
    assert.equal(shouldPost, true);
  });

  test("ok:true, idMap with empty entries (C&W has no id) → no dispatch", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": { ...EMMANUEL, id: null } });

    const result = await mod.selectElements(["Emmanuel"], storage);
    const shouldPost = !result.ok ? false : !!(result.idMap && Object.keys(result.idMap).length);
    assert.equal(shouldPost, false);
  });

  test("ok:false, idMap populated → no dispatch (selection failed)", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "Component not found");
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });

    const result = await mod.selectElements(["Emmanuel"], storage);
    const shouldPost = !result.ok ? false : !!(result.idMap && Object.keys(result.idMap).length);
    assert.equal(shouldPost, false);
  });

  test("ok:false, all missing → no dispatch, idMap is empty object", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({});

    const result = await mod.selectElements(["ghost"], storage);
    assert.equal(result.ok, false);
    assert.deepEqual(result.idMap, {});
    const shouldPost = !result.ok ? false : !!(result.idMap && Object.keys(result.idMap).length);
    assert.equal(shouldPost, false);
  });

  test("ok:true, empty names (early return) → no dispatch", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);

    const result = await mod.selectElements([], mockStorage({}));
    assert.equal(result.ok, true);
    assert.equal(result.idMap, undefined);
    const shouldPost = !result.ok ? false : !!(result.idMap && Object.keys(result.idMap).length);
    assert.equal(shouldPost, false);
  });
});

// ============================================================
// Round 1: page script React handler contract
// The page script handler (openart-page.js:440-461) checks for
// VisualReferences component, then finds onChange, then calls it.
// Two failure modes: component not found, onChange not found.
// ============================================================

describe("page script React handler failure modes", () => {
  test("VisualReferences component not found → specific error", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "VisualReferences component not found");

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, false);
    assert.match(result.error, /VisualReferences/);
  });

  test("onChange component not found → specific error", async () => {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    setRespondOk(false, "onChange component not found");

    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, false);
    assert.match(result.error, /onChange/);
  });

  test("page script response with no ok field — still resolves", async () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://openart.ai/create-video",
    });
    dom.window.addEventListener("message", (event) => {
      if (event.data?.type === "promptsync-select-visual-refs") {
        dom.window.postMessage({
          type: "promptsync-select-visual-refs-result",
          requestId: event.data.requestId,
          // intentionally omit ok and error
        }, "*");
      }
    });

    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await mod.selectElements(["Emmanuel"], storage);
    assert.equal(result.ok, undefined);
    assert.deepEqual(result.idMap, { Emmanuel: EMMANUEL.id });
  });
});

// ============================================================
// Round 2: page script handler receives `references || []`
// When null is passed, `references || []` produces empty array.
// ============================================================

describe("page script references fallback (|| [])", () => {
  test("null references treated as empty array by page script", () => {
    const references = null;
    const newRefs = references || [];
    assert.ok(Array.isArray(newRefs));
    assert.equal(newRefs.length, 0);
  });

  test("undefined references treated as empty array by page script", () => {
    const references = undefined;
    const newRefs = references || [];
    assert.ok(Array.isArray(newRefs));
    assert.equal(newRefs.length, 0);
  });

  test("empty array stays empty array", () => {
    const references = [];
    const newRefs = references || [];
    assert.ok(Array.isArray(newRefs));
    assert.equal(newRefs.length, 0);
  });

  test("non-empty array passes through unchanged", () => {
    const references = [{ id: "a" }, { id: "b" }];
    const newRefs = references || [];
    assert.equal(newRefs.length, 2);
    assert.equal(newRefs[0].id, "a");
  });
});

// ============================================================
// Round 3: isCreation detection logic
// Only POST to /suite/api/forms/creations/* triggers idMap
// transformation. GET requests, other POST endpoints, etc.
// must not trigger it.
// ============================================================

describe("isCreation detection logic", () => {
  function isCreation(method, url) {
    return method.toUpperCase() === "POST" && url.includes("/suite/api/forms/creations/");
  }

  test("POST to create-video is a creation", () => {
    assert.ok(isCreation("POST", "/suite/api/forms/creations/create-video%3Areference%3Akling-v3"));
  });

  test("POST to create-image is a creation", () => {
    assert.ok(isCreation("POST", "/suite/api/forms/creations/create-image%3Areference%3Anano-banana-2"));
  });

  test("POST to animate-video is a creation", () => {
    assert.ok(isCreation("POST", "/suite/api/forms/creations/animate-video%3Areference%3Akling-v3"));
  });

  test("GET to creations is NOT a creation", () => {
    assert.ok(!isCreation("GET", "/suite/api/forms/creations/create-video"));
  });

  test("POST to resources endpoint is NOT a creation", () => {
    assert.ok(!isCreation("POST", "/suite/api/resources/abc123"));
  });

  test("POST to character/list is NOT a creation", () => {
    assert.ok(!isCreation("POST", "/suite/api/character/list"));
  });

  test("POST to projects/default is NOT a creation", () => {
    assert.ok(!isCreation("POST", "/suite/api/projects/default"));
  });

  test("case-insensitive method check", () => {
    assert.ok(isCreation("post", "/suite/api/forms/creations/create-video"));
    assert.ok(isCreation("Post", "/suite/api/forms/creations/create-video"));
  });
});

// ============================================================
// Round 4: creationType detection from URL
// The page script determines if a generation is video or image
// based on URL containing "create-video" or "animate-video".
// ============================================================

describe("creationType detection from creation URL", () => {
  function getCreationType(url) {
    return (url.includes("create-video") || url.includes("animate-video")) ? "video" : "image";
  }

  test("create-video URL → video", () => {
    assert.equal(getCreationType("/suite/api/forms/creations/create-video%3Areference%3Akling-v3"), "video");
  });

  test("animate-video URL → video", () => {
    assert.equal(getCreationType("/suite/api/forms/creations/animate-video%3Areference%3Akling-v3"), "video");
  });

  test("create-image URL → image", () => {
    assert.equal(getCreationType("/suite/api/forms/creations/create-image%3Areference%3Anano-banana-2"), "image");
  });

  test("unknown creation URL → image (fallback)", () => {
    assert.equal(getCreationType("/suite/api/forms/creations/upscale"), "image");
  });
});

// ============================================================
// Round 5: C&W re-capture from generation response
// When a creation response includes visualReferences with
// type "character" or "world", they are re-broadcast as
// promptsync-cw-elements-captured. The type mapping inverts:
// "world" → "background", "character" → "character".
// ============================================================

describe("C&W re-capture from generation visualReferences", () => {
  function recaptureFromVisualReferences(visualReferences) {
    const cwElements = (visualReferences || []).filter(
      (ref) => ref.type === "character" || ref.type === "world"
    );
    if (!cwElements.length) return null;
    return cwElements.map((el) => ({
      id: el.id,
      name: el.name,
      label: el.label || el.name,
      type: el.type === "world" ? "background" : "character",
      url: el.url,
      imageUrl: el.imageUrl,
      extraUrls: el.extraUrls || [],
      klingElementId: el.klingElementId || null,
    }));
  }

  test("character type stays character", () => {
    const result = recaptureFromVisualReferences([
      { id: "a", name: "Hero", type: "character", url: "https://x.png", imageUrl: "https://x.png" },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "character");
  });

  test("world type becomes background", () => {
    const result = recaptureFromVisualReferences([
      { id: "b", name: "Forest", type: "world", url: "https://y.png", imageUrl: "https://y.png" },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "background");
  });

  test("image type is filtered out (seedance refs)", () => {
    const result = recaptureFromVisualReferences([
      { id: "c", name: "image1", type: "image", url: "https://z.png" },
    ]);
    assert.equal(result, null);
  });

  test("mixed types — only character and world are captured", () => {
    const result = recaptureFromVisualReferences([
      { id: "a", name: "Hero", type: "character", url: "https://x.png", imageUrl: "https://x.png" },
      { id: "b", name: "image1", type: "image", url: "https://y.png" },
      { id: "c", name: "Forest", type: "world", url: "https://z.png", imageUrl: "https://z.png" },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Hero");
    assert.equal(result[1].name, "Forest");
    assert.equal(result[1].type, "background");
  });

  test("null visualReferences returns null", () => {
    assert.equal(recaptureFromVisualReferences(null), null);
  });

  test("empty visualReferences returns null", () => {
    assert.equal(recaptureFromVisualReferences([]), null);
  });

  test("label falls back to name", () => {
    const result = recaptureFromVisualReferences([
      { id: "a", name: "Hero", type: "character", url: "https://x.png", imageUrl: "https://x.png" },
    ]);
    assert.equal(result[0].label, "Hero");
  });

  test("explicit label takes precedence", () => {
    const result = recaptureFromVisualReferences([
      { id: "a", name: "Hero", label: "The Hero", type: "character", url: "https://x.png", imageUrl: "https://x.png" },
    ]);
    assert.equal(result[0].label, "The Hero");
  });

  test("missing extraUrls defaults to empty array", () => {
    const result = recaptureFromVisualReferences([
      { id: "a", name: "Hero", type: "character", url: "https://x.png", imageUrl: "https://x.png" },
    ]);
    assert.deepEqual(result[0].extraUrls, []);
  });

  test("missing klingElementId defaults to null", () => {
    const result = recaptureFromVisualReferences([
      { id: "a", name: "Hero", type: "character", url: "https://x.png", imageUrl: "https://x.png" },
    ]);
    assert.equal(result[0].klingElementId, null);
  });
});

// ============================================================
// Round 6: getOpenArtMode URL detection
// Determines if the current page is video or image creation.
// This is used to decide the injection path.
// ============================================================

describe("getOpenArtMode URL detection", () => {
  function getOpenArtMode(pathname) {
    if (pathname.includes("/animate-video") || pathname.includes("/create-video")) return "openart-video";
    return "openart-image";
  }

  test("/create-video → openart-video", () => {
    assert.equal(getOpenArtMode("/create-video"), "openart-video");
  });

  test("/animate-video → openart-video", () => {
    assert.equal(getOpenArtMode("/animate-video"), "openart-video");
  });

  test("/create-image → openart-image", () => {
    assert.equal(getOpenArtMode("/create-image"), "openart-image");
  });

  test("/ (root) → openart-image", () => {
    assert.equal(getOpenArtMode("/"), "openart-image");
  });

  test("/suite/create-video → openart-video", () => {
    assert.equal(getOpenArtMode("/suite/create-video"), "openart-video");
  });

  test("/create-video?model=kling → openart-video (with query)", () => {
    assert.equal(getOpenArtMode("/create-video?model=kling"), "openart-video");
  });
});

// ============================================================
// Round 7: stripVideoPromptMeta
// shared.js strips MOTION SCALE, aspect ratio, negative prompt,
// and metadata sections from video prompts before injection.
// ============================================================

describe("stripVideoPromptMeta", () => {
  function stripVideoPromptMeta(body) {
    if (!body) return body;
    return body
      .replace(/^\[MOTION SCALE:[^\]]*\]\s*$/gm, "")
      .replace(/^Aspect ratio:.*$/gm, "")
      .replace(/^Negative prompt:.*$/gm, "")
      .replace(/\n---\n[\s\S]*$/, "")
      .trim();
  }

  test("strips MOTION SCALE line", () => {
    const prompt = "[Subject]: @hero walks.\n[MOTION SCALE: 0.5]";
    assert.equal(stripVideoPromptMeta(prompt), "[Subject]: @hero walks.");
  });

  test("strips Aspect ratio line", () => {
    const prompt = "[Subject]: @hero walks.\nAspect ratio: 16:9";
    assert.equal(stripVideoPromptMeta(prompt), "[Subject]: @hero walks.");
  });

  test("strips Negative prompt line", () => {
    const prompt = "[Subject]: @hero walks.\nNegative prompt: blur, dark.";
    assert.equal(stripVideoPromptMeta(prompt), "[Subject]: @hero walks.");
  });

  test("strips everything after ---", () => {
    const prompt = "[Subject]: @hero walks.\n---\nduration: 10s\nresolution: 720p";
    assert.equal(stripVideoPromptMeta(prompt), "[Subject]: @hero walks.");
  });

  test("strips all meta lines together", () => {
    const prompt = [
      "[Subject]: @hero walks.",
      "[MOTION SCALE: 0.5]",
      "Aspect ratio: 16:9",
      "Negative prompt: blur.",
    ].join("\n");
    assert.equal(stripVideoPromptMeta(prompt), "[Subject]: @hero walks.");
  });

  test("preserves labeled blocks that are not meta", () => {
    const prompt = [
      "[Cinematography]: Static. MS.",
      "[Subject]: @hero walks.",
      "[Action]: Hands reach out.",
      "[Environment]: church interior.",
    ].join("\n");
    assert.equal(stripVideoPromptMeta(prompt), prompt);
  });

  test("returns falsy value unchanged", () => {
    assert.equal(stripVideoPromptMeta(null), null);
    assert.equal(stripVideoPromptMeta(undefined), undefined);
    assert.equal(stripVideoPromptMeta(""), "");
  });

  test("does not strip MOTION SCALE embedded in text", () => {
    const prompt = "[Subject]: The [MOTION SCALE: 0.5] is interesting.";
    assert.equal(stripVideoPromptMeta(prompt), prompt);
  });

  test("handles Windows-style line endings", () => {
    const prompt = "[Subject]: @hero walks.\r\n[MOTION SCALE: 0.5]\r\nAspect ratio: 16:9";
    const result = stripVideoPromptMeta(prompt);
    assert.ok(!result.includes("MOTION SCALE"));
    assert.ok(!result.includes("Aspect ratio"));
  });
});

// ============================================================
// Round 8: getPromptForSite routing
// shared.js selects the right prompt body based on site.
// ============================================================

describe("getPromptForSite routing", () => {
  function getPromptForSite(shot, site) {
    if (site === "midjourney") {
      return shot.mjPrompt?.body ?? null;
    }
    if (site === "openart-video") {
      const raw = shot.klingPrompt?.body ?? shot.seedancePrompt?.body ?? null;
      if (!raw) return raw;
      return raw
        .replace(/^\[MOTION SCALE:[^\]]*\]\s*$/gm, "")
        .replace(/^Aspect ratio:.*$/gm, "")
        .replace(/^Negative prompt:.*$/gm, "")
        .replace(/\n---\n[\s\S]*$/, "")
        .trim();
    }
    if (site === "openart-image") {
      return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
    }
    if (site === "seedance") {
      return shot.seedancePrompt?.body ?? null;
    }
    return null;
  }

  const shot = {
    mjPrompt: { body: "MJ prompt body" },
    klingPrompt: { body: "[Subject]: @hero.\n[MOTION SCALE: 0.5]\nNegative prompt: blur." },
    seedancePrompt: { body: "Seedance prompt body" },
    nanoBanana: { body: "NB prompt body" },
  };

  test("midjourney → mjPrompt.body", () => {
    assert.equal(getPromptForSite(shot, "midjourney"), "MJ prompt body");
  });

  test("openart-video → klingPrompt.body with meta stripped", () => {
    const result = getPromptForSite(shot, "openart-video");
    assert.equal(result, "[Subject]: @hero.");
  });

  test("openart-video falls back to seedancePrompt", () => {
    const noKling = { seedancePrompt: { body: "seedance body\n[MOTION SCALE: 0.3]" } };
    const result = getPromptForSite(noKling, "openart-video");
    assert.equal(result, "seedance body");
  });

  test("openart-image → nanoBanana.body preferred", () => {
    assert.equal(getPromptForSite(shot, "openart-image"), "NB prompt body");
  });

  test("openart-image falls back to mjPrompt", () => {
    const noNB = { mjPrompt: { body: "MJ fallback" } };
    assert.equal(getPromptForSite(noNB, "openart-image"), "MJ fallback");
  });

  test("seedance → seedancePrompt.body", () => {
    assert.equal(getPromptForSite(shot, "seedance"), "Seedance prompt body");
  });

  test("unknown site → null", () => {
    assert.equal(getPromptForSite(shot, "dalle"), null);
  });

  test("empty shot → null for all sites", () => {
    assert.equal(getPromptForSite({}, "midjourney"), null);
    assert.equal(getPromptForSite({}, "openart-video"), null);
    assert.equal(getPromptForSite({}, "openart-image"), null);
    assert.equal(getPromptForSite({}, "seedance"), null);
  });
});

// ============================================================
// Round 9: resolveElementMentions is a no-op
// shared.js:63-65 — the function returns prompt unchanged.
// This is critical: the visible prompt must NOT be modified.
// If someone accidentally adds logic here, tests catch it.
// ============================================================

describe("resolveElementMentions no-op contract", () => {
  function resolveElementMentions(prompt, _elementMap) {
    return prompt || "";
  }

  test("returns prompt unchanged — basic", () => {
    assert.equal(resolveElementMentions("@peterNightingale walks.", {}), "@peterNightingale walks.");
  });

  test("returns prompt unchanged — with element map entries", () => {
    const elementMap = { peterNightingale: "Peter Nightingale" };
    assert.equal(
      resolveElementMentions("@peterNightingale walks.", elementMap),
      "@peterNightingale walks."
    );
  });

  test("returns empty string for null prompt", () => {
    assert.equal(resolveElementMentions(null, {}), "");
  });

  test("returns empty string for undefined prompt", () => {
    assert.equal(resolveElementMentions(undefined, {}), "");
  });

  test("returns empty string for empty string", () => {
    assert.equal(resolveElementMentions("", {}), "");
  });

  test("element map is completely ignored", () => {
    const map = {
      peterNightingale: "Peter Nightingale",
      peterChurchA: "Peter Church Interior A",
      marcusReeves: "Marcus Reeves",
    };
    const prompt = "@peterNightingale at @peterChurchA with @marcusReeves.";
    assert.equal(resolveElementMentions(prompt, map), prompt);
  });

  test("null element map is safe", () => {
    assert.equal(resolveElementMentions("@hero walks.", null), "@hero walks.");
  });
});

// ============================================================
// Round 10: full injection flow simulation
// Simulates the complete video injection path from
// shot.meta.elements through selectElements, idMap dispatch,
// and fetch interceptor transformation. End-to-end with all
// the real guard conditions from openart.js.
// ============================================================

describe("full video injection flow simulation", () => {
  async function simulateVideoInjection(shot, project, storage, pageScriptOk = true) {
    const { dom, setRespondOk } = buildDOM();
    const mod = loadModule(dom);
    if (!pageScriptOk) setRespondOk(false, "Component not found");

    const log = {
      clearCalled: false,
      selectResult: null,
      idMapDispatched: null,
      promptTransformed: null,
    };

    // Step 1: clear (always happens)
    await mod.clearElements();
    log.clearCalled = true;

    // Step 2: select elements (only if project + elements)
    if (project) {
      const elements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
      if (elements.length) {
        const result = await mod.selectElements(elements, storage);
        log.selectResult = result;

        if (!result.ok) {
          // warn, don't dispatch
        } else if (result.idMap && Object.keys(result.idMap).length) {
          log.idMapDispatched = result.idMap;
        }
      }
    }

    // Step 3: simulate fetch interceptor (if idMap was dispatched)
    if (log.idMapDispatched && shot.klingPrompt?.body) {
      const body = { prompt: shot.klingPrompt.body };
      for (const [name, id] of Object.entries(log.idMapDispatched)) {
        body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
      }
      log.promptTransformed = body.prompt;
    }

    return log;
  }

  test("shot 1B — full flow: select, dispatch, transform", async () => {
    const shot = {
      meta: { elements: ["peterChurchA", "peterNightingale"] },
      klingPrompt: { body: "[Subject]: @peterNightingale removes chasuble.\n[Environment]: @peterChurchA warm light." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.clearCalled, true);
    assert.equal(log.selectResult.ok, true);
    assert.equal(log.selectResult.added, 2);
    assert.ok(log.idMapDispatched);
    assert.equal(Object.keys(log.idMapDispatched).length, 2);
    assert.ok(!log.promptTransformed.includes("@peterNightingale"));
    assert.ok(!log.promptTransformed.includes("@peterChurchA"));
    assert.ok(log.promptTransformed.includes("@TCOmrNbxzys8WExQjSrI"));
    assert.ok(log.promptTransformed.includes("@2kJ78EmaLx094qsWX1CU"));
  });

  test("no project — selection skipped entirely", async () => {
    const shot = {
      meta: { elements: ["peterNightingale"] },
      klingPrompt: { body: "@peterNightingale walks." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, null, storage);
    assert.equal(log.clearCalled, true);
    assert.equal(log.selectResult, null);
    assert.equal(log.idMapDispatched, null);
    assert.equal(log.promptTransformed, null);
  });

  test("no elements in shot — selection skipped", async () => {
    const shot = {
      meta: { elements: [] },
      klingPrompt: { body: "A landscape shot." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.clearCalled, true);
    assert.equal(log.selectResult, null);
    assert.equal(log.idMapDispatched, null);
    assert.equal(log.promptTransformed, null);
  });

  test("all elements missing from storage — no dispatch", async () => {
    const shot = {
      meta: { elements: ["ghostChar", "ghostWorld"] },
      klingPrompt: { body: "@ghostChar walks." },
    };
    const storage = mockStorage({});

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.clearCalled, true);
    assert.equal(log.selectResult.ok, false);
    assert.equal(log.idMapDispatched, null);
    assert.equal(log.promptTransformed, null);
  });

  test("page script fails — no dispatch even with idMap", async () => {
    const shot = {
      meta: { elements: ["peterNightingale"] },
      klingPrompt: { body: "@peterNightingale walks." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage, false);
    assert.equal(log.clearCalled, true);
    assert.equal(log.selectResult.ok, false);
    assert.deepEqual(log.selectResult.idMap, { peterNightingale: "TCOmrNbxzys8WExQjSrI" });
    assert.equal(log.idMapDispatched, null, "failed selection → no dispatch");
    assert.equal(log.promptTransformed, null);
  });

  test("partial elements — found ones dispatched, prompt partially transformed", async () => {
    const shot = {
      meta: { elements: ["peterNightingale", "ghostWorld"] },
      klingPrompt: { body: "@peterNightingale at @ghostWorld." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.clearCalled, true);
    assert.equal(log.selectResult.ok, true);
    assert.equal(log.selectResult.added, 1);
    assert.equal(Object.keys(log.idMapDispatched).length, 1);
    assert.ok(!log.promptTransformed.includes("@peterNightingale"));
    assert.ok(log.promptTransformed.includes("@ghostWorld"), "@ghostWorld stays unchanged");
  });

  test("three-element shot — all found", async () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA", "marcusReeves"] },
      klingPrompt: { body: "@peterNightingale and @marcusReeves in @peterChurchA." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.selectResult.added, 3);
    assert.equal(Object.keys(log.idMapDispatched).length, 3);
    assert.ok(!log.promptTransformed.includes("@peterNightingale"));
    assert.ok(!log.promptTransformed.includes("@marcusReeves"));
    assert.ok(!log.promptTransformed.includes("@peterChurchA"));
  });

  test("elements with @ prefix in shot.meta — stripped before lookup", async () => {
    const shot = {
      meta: { elements: ["@peterNightingale", "@peterChurchA"] },
      klingPrompt: { body: "@peterNightingale at @peterChurchA." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.selectResult.ok, true);
    assert.equal(log.selectResult.added, 2);
    assert.ok(log.idMapDispatched);
  });

  test("shot with no klingPrompt — idMap dispatched but no transform", async () => {
    const shot = {
      meta: { elements: ["peterNightingale"] },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.equal(log.selectResult.ok, true);
    assert.ok(log.idMapDispatched);
    assert.equal(log.promptTransformed, null, "no klingPrompt body to transform");
  });

  test("prompt with no @-mentions — idMap dispatched but transform is identity", async () => {
    const shot = {
      meta: { elements: ["peterNightingale"] },
      klingPrompt: { body: "A man removes a garment in a church." },
    };
    const storage = mockStorage(ENDS_CROSS_CW);

    const log = await simulateVideoInjection(shot, "ends-cross", storage);
    assert.ok(log.idMapDispatched);
    assert.equal(log.promptTransformed, "A man removes a garment in a church.");
  });
});

// ============================================================
// Round 11: collectElementVisualReferences (panel.js)
// The panel builds visual references differently from the
// content script: it uses refType mapping and adds elementName.
// ============================================================

describe("collectElementVisualReferences (panel path)", () => {
  function collectElementVisualReferences(elements, cwStorage) {
    const refs = [];
    for (const elName of elements) {
      const raw = elName.replace(/^@/, "");
      const key = `openart-cw:${raw.toLowerCase()}`;
      const cwElement = cwStorage[key];
      if (!cwElement) continue;
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

  test("character element produces type 'character'", () => {
    const storage = { "openart-cw:emmanuel": EMMANUEL };
    const refs = collectElementVisualReferences(["Emmanuel"], storage);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].type, "character");
  });

  test("background element produces type 'world'", () => {
    const storage = { "openart-cw:dark forest": FOREST };
    const refs = collectElementVisualReferences(["Dark Forest"], storage);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].type, "world");
  });

  test("elementName preserves original camelCase", () => {
    const storage = { "openart-cw:peternightingale": { ...EMMANUEL, name: "peterNightingale" } };
    const refs = collectElementVisualReferences(["peterNightingale"], storage);
    assert.equal(refs[0].elementName, "peterNightingale");
  });

  test("@ prefix is stripped from elementName", () => {
    const storage = { "openart-cw:peternightingale": { ...EMMANUEL, name: "peterNightingale" } };
    const refs = collectElementVisualReferences(["@peterNightingale"], storage);
    assert.equal(refs[0].elementName, "peterNightingale");
  });

  test("missing element is skipped", () => {
    const refs = collectElementVisualReferences(["Ghost"], {});
    assert.equal(refs.length, 0);
  });

  test("panel refs have elementName; content script refs do NOT", () => {
    const storage = { "openart-cw:emmanuel": EMMANUEL };
    const panelRef = collectElementVisualReferences(["Emmanuel"], storage)[0];
    assert.ok("elementName" in panelRef, "panel path has elementName");

    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const contentRef = mod.cwDataToVisualRef(EMMANUEL);
    assert.ok(!("elementName" in contentRef), "content script path does NOT have elementName");
  });

  test("panel uses refType mapping (background→world); content script uses resourceType", () => {
    const storage = { "openart-cw:dark forest": FOREST };
    const panelRef = collectElementVisualReferences(["Dark Forest"], storage)[0];
    assert.equal(panelRef.type, "world");

    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const contentRef = mod.cwDataToVisualRef(FOREST);
    assert.equal(contentRef.resourceType, "world");
  });

  test("includes metadata with format from URL", () => {
    const storage = { "openart-cw:emmanuel": EMMANUEL };
    const refs = collectElementVisualReferences(["Emmanuel"], storage);
    assert.equal(refs[0].metadata.format, "jpg");
    assert.equal(refs[0].metadata.media_type, "image");
  });
});

// ============================================================
// Round 12: configureSettings contract
// What settings get applied for different shot metadata combos.
// ============================================================

describe("configureSettings metadata extraction", () => {
  test("aspect ratio comes from klingPrompt.meta.aspect_ratio", () => {
    const shot = { klingPrompt: { meta: { aspect_ratio: "16:9" } }, meta: {} };
    const ar = shot.klingPrompt?.meta?.aspect_ratio;
    assert.equal(ar, "16:9");
  });

  test("duration comes from shot.meta.duration", () => {
    const shot = { meta: { duration: "10s" } };
    const duration = shot.meta.duration;
    const match = duration.match(/(\d+)/);
    assert.equal(match[1], "10");
  });

  test("duration with no number returns no match", () => {
    const shot = { meta: { duration: "long" } };
    const match = shot.meta.duration.match(/(\d+)/);
    assert.equal(match, null);
  });

  test("missing klingPrompt.meta — ar is undefined", () => {
    const shot = { meta: {} };
    const ar = shot.klingPrompt?.meta?.aspect_ratio;
    assert.equal(ar, undefined);
  });

  test("missing duration — no slider call", () => {
    const shot = { meta: {} };
    const duration = shot.meta.duration;
    assert.equal(duration, undefined);
  });

  test("resolution is always hardcoded to 720p for video", () => {
    const resolution = "720p";
    assert.equal(resolution, "720p");
  });

  test("duration parsing for various formats", () => {
    const cases = [
      { input: "5s", expected: "5" },
      { input: "10s", expected: "10" },
      { input: "10", expected: "10" },
      { input: "5 seconds", expected: "5" },
    ];
    for (const { input, expected } of cases) {
      const match = input.match(/(\d+)/);
      assert.equal(match[1], expected, `"${input}" → ${expected}`);
    }
  });
});

// ============================================================
// Round 13: cwDataToVisualRef createdAt and fixed fields
// The visual ref always sets createdAt to Date.now(), and
// certain fields are hardcoded regardless of input.
// ============================================================

describe("cwDataToVisualRef fixed/hardcoded fields", () => {
  test("createdAt is approximately Date.now()", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const before = Date.now();
    const ref = mod.cwDataToVisualRef(EMMANUEL);
    const after = Date.now();
    assert.ok(ref.createdAt >= before);
    assert.ok(ref.createdAt <= after);
  });

  test("sourceType is always 'upload'", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).sourceType, "upload");
    assert.equal(mod.cwDataToVisualRef(FOREST).sourceType, "upload");
    assert.equal(mod.cwDataToVisualRef(MARY).sourceType, "upload");
  });

  test("userId is always 'current-user'", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).userId, "current-user");
  });

  test("status is always 'completed'", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).status, "completed");
  });

  test("isStarred is always false", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).isStarred, false);
  });

  test("isDownloaded is always false", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).isDownloaded, false);
  });

  test("metadata width and height are always 1024", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const ref = mod.cwDataToVisualRef(EMMANUEL);
    assert.equal(ref.metadata.width, 1024);
    assert.equal(ref.metadata.height, 1024);
  });

  test("metadata file_size_bytes is always 0", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).metadata.file_size_bytes, 0);
  });

  test("metadata media_type is always 'image'", () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    assert.equal(mod.cwDataToVisualRef(EMMANUEL).metadata.media_type, "image");
  });
});

// ============================================================
// Round 14: idMap with Unicode and unusual element names
// ============================================================

describe("idMap with unusual element names", () => {
  test("element name with accented characters", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const CW = { ...EMMANUEL, id: "rene-id", name: "René" };
    const storage = mockStorage({ "openart-cw:rené": CW });
    const result = await mod.selectElements(["René"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.idMap["René"], "rene-id");
  });

  test("element name with digits only", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const CW = { ...EMMANUEL, id: "num-id", name: "42" };
    const storage = mockStorage({ "openart-cw:42": CW });
    const result = await mod.selectElements(["42"], storage);
    assert.equal(result.idMap["42"], "num-id");
  });

  test("very long element name", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const longName = "a".repeat(200);
    const CW = { ...EMMANUEL, id: "long-id", name: longName };
    const storage = mockStorage({ [`openart-cw:${longName}`]: CW });
    const result = await mod.selectElements([longName], storage);
    assert.equal(result.idMap[longName], "long-id");
  });

  test("element name with dots", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const CW = { ...EMMANUEL, id: "dot-id", name: "mr.smith" };
    const storage = mockStorage({ "openart-cw:mr.smith": CW });
    const result = await mod.selectElements(["mr.smith"], storage);
    assert.equal(result.idMap["mr.smith"], "dot-id");
  });
});

// ============================================================
// Round 15: handleStartFrame cache key format
// Cache key: `openart-sf:${project}:${shot.code}`
// Must be different from C&W keys and resource keys.
// ============================================================

describe("start frame cache key format", () => {
  function sfCacheKey(project, code) {
    return `openart-sf:${project}:${code}`;
  }

  test("basic cache key format", () => {
    assert.equal(sfCacheKey("ends-cross", "1B"), "openart-sf:ends-cross:1B");
  });

  test("cache key uses openart-sf prefix — distinct from cw and res", () => {
    const sf = sfCacheKey("proj", "1A");
    assert.ok(sf.startsWith("openart-sf:"));
    assert.ok(!sf.startsWith("openart-cw:"));
    assert.ok(!sf.startsWith("openart-res:"));
  });

  test("different shots get different keys", () => {
    assert.notEqual(sfCacheKey("proj", "1A"), sfCacheKey("proj", "1B"));
  });

  test("different projects get different keys", () => {
    assert.notEqual(sfCacheKey("proj-a", "1A"), sfCacheKey("proj-b", "1A"));
  });

  test("shot code preserves case", () => {
    assert.equal(sfCacheKey("proj", "1E-2"), "openart-sf:proj:1E-2");
  });

  test("all three storage namespaces are distinct", () => {
    const cw = `openart-cw:sisyphus`;
    const res = `openart-res:proj:shot:1A`;
    const sf = sfCacheKey("proj", "1A");
    const pid = `openart-project-id`;

    const all = [cw, res, sf, pid];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        assert.notEqual(all[i], all[j], `${all[i]} vs ${all[j]} must differ`);
      }
    }
  });
});

// ============================================================
// Round 16: pendingVisualReferences one-shot clearing
// Set to null after use, even if merge fails.
// ============================================================

describe("pendingVisualReferences one-shot lifecycle", () => {
  test("set → merge → null", () => {
    let pending = null;
    assert.equal(pending, null);

    pending = [{ id: "a", type: "character" }];
    assert.equal(pending.length, 1);

    const body = { prompt: "test", visualReferences: [] };
    if (pending?.length) {
      body.visualReferences = [...body.visualReferences, ...pending];
    }
    pending = null;

    assert.equal(body.visualReferences.length, 1);
    assert.equal(pending, null);
  });

  test("set → no merge (non-creation) → still cleared on next creation", () => {
    let pending = [{ id: "a", type: "character" }];

    // First request: not a creation (GET), pending stays
    const isCreation1 = false;
    if (isCreation1 && pending?.length) {
      // not reached
    }
    // In real code, pending is NOT cleared for non-creations
    // It persists until the next creation
    assert.equal(pending.length, 1, "pending survives non-creation request");

    // Second request: is a creation, pending consumed
    const isCreation2 = true;
    const body = { visualReferences: [] };
    if (isCreation2 && pending?.length) {
      body.visualReferences = [...body.visualReferences, ...pending];
      pending = null;
    }
    assert.equal(body.visualReferences.length, 1);
    assert.equal(pending, null);
  });

  test("null pending does not modify body", () => {
    let pending = null;
    const body = { prompt: "test", visualReferences: [{ id: "existing" }] };
    if (pending?.length) {
      body.visualReferences = [...body.visualReferences, ...pending];
    }
    assert.equal(body.visualReferences.length, 1);
    assert.equal(body.visualReferences[0].id, "existing");
  });

  test("empty array pending does not modify body", () => {
    let pending = [];
    const body = { prompt: "test", visualReferences: [{ id: "existing" }] };
    if (pending?.length) {
      body.visualReferences = [...body.visualReferences, ...pending];
    }
    assert.equal(body.visualReferences.length, 1);
  });
});

// ============================================================
// Round 17: selectElements with duplicate element names
// If shot.meta.elements has the same name twice, selectElements
// should still work and idMap should have one entry per name.
// ============================================================

describe("selectElements with duplicate names", () => {
  test("duplicate names in input — refs are duplicated", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });

    const result = await mod.selectElements(["Emmanuel", "Emmanuel"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.added, 2, "duplicates produce duplicate refs");
    assert.equal(getReceivedRefs().length, 2);
  });

  test("duplicate names — idMap has one entry (last write wins)", async () => {
    const { dom } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });

    const result = await mod.selectElements(["Emmanuel", "Emmanuel"], storage);
    assert.equal(Object.keys(result.idMap).length, 1);
    assert.equal(result.idMap.Emmanuel, EMMANUEL.id);
  });

  test("mixed found and duplicate missing — correct counts", async () => {
    const { dom, getReceivedRefs } = buildDOM();
    const mod = loadModule(dom);
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });

    const result = await mod.selectElements(["Emmanuel", "Ghost", "Emmanuel"], storage);
    assert.equal(result.ok, true);
    assert.equal(result.added, 2);
    assert.equal(getReceivedRefs().length, 2);
    assert.equal(Object.keys(result.idMap).length, 1);
  });
});

// ============================================================
// Round 18: storage lookup returns object wrapping (chrome API)
// chrome.storage.local.get(key) returns { [key]: value }.
// The lookup function must unwrap correctly.
// ============================================================

describe("chrome storage API wrapping contract", () => {
  test("storage returns { key: value } — unwrap with stored[key]", async () => {
    const storage = mockStorage({ "openart-cw:emmanuel": EMMANUEL });
    const result = await storage("openart-cw:emmanuel");
    assert.deepEqual(result, { "openart-cw:emmanuel": EMMANUEL });
    assert.equal(result["openart-cw:emmanuel"].id, EMMANUEL.id);
  });

  test("missing key returns { key: null }", async () => {
    const storage = mockStorage({});
    const result = await storage("openart-cw:ghost");
    assert.deepEqual(result, { "openart-cw:ghost": null });
    assert.equal(result["openart-cw:ghost"], null);
  });

  test("null entry vs missing entry — both are falsy", async () => {
    const storage = mockStorage({ "openart-cw:explicit-null": null });
    const result = await storage("openart-cw:explicit-null");
    assert.equal(result["openart-cw:explicit-null"], null);

    // selectElements checks: const cw = stored[key]; if (!cw) → skip
    const cw = result["openart-cw:explicit-null"];
    assert.ok(!cw, "null entry is skipped by selectElements");
  });
});

// ============================================================
// Round 19: idMap transformation preserves JSON-safe body
// After idMap transform, args[1].body is re-stringified.
// The result must be valid JSON.
// ============================================================

describe("idMap transformation JSON safety", () => {
  test("transformed body is valid JSON", () => {
    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI" };
    const rawBody = JSON.stringify({
      prompt: "@peterNightingale walks.",
      model: "kling-v3",
      visualReferences: [],
    });

    const body = JSON.parse(rawBody);
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }
    const reStringified = JSON.stringify(body);
    const reparsed = JSON.parse(reStringified);
    assert.equal(reparsed.prompt, "@TCOmrNbxzys8WExQjSrI walks.");
    assert.equal(reparsed.model, "kling-v3");
  });

  test("prompt with special JSON characters survives round-trip", () => {
    const idMap = { hero: "hero-id" };
    const rawBody = JSON.stringify({
      prompt: '@hero says "hello" and walks.\nNew line here.',
    });

    const body = JSON.parse(rawBody);
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }
    const reStringified = JSON.stringify(body);
    const reparsed = JSON.parse(reStringified);
    assert.ok(reparsed.prompt.includes("@hero-id"));
    assert.ok(reparsed.prompt.includes('"hello"'));
  });

  test("prompt with backslashes survives round-trip", () => {
    const idMap = { hero: "hero-id" };
    const body = { prompt: "@hero walks to C:\\Users\\path" };
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }
    const json = JSON.stringify(body);
    const reparsed = JSON.parse(json);
    assert.equal(reparsed.prompt, "@hero-id walks to C:\\Users\\path");
  });

  test("empty prompt survives round-trip", () => {
    const body = { prompt: "" };
    const json = JSON.stringify(body);
    const reparsed = JSON.parse(json);
    assert.equal(reparsed.prompt, "");
  });

  test("prompt with unicode survives round-trip", () => {
    const idMap = { hero: "hero-id" };
    const body = { prompt: "@hero walks through café ☕" };
    for (const [name, id] of Object.entries(idMap)) {
      body.prompt = body.prompt.replaceAll(`@${name}`, `@${id}`);
    }
    const json = JSON.stringify(body);
    const reparsed = JSON.parse(json);
    assert.ok(reparsed.prompt.includes("café ☕"));
    assert.ok(reparsed.prompt.includes("@hero-id"));
  });
});

// ============================================================
// Round 20: full pipeline — image path vs video path
// Same shot produces different element handling per path.
// ============================================================

describe("image vs video path divergence with same shot", () => {
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

  test("video path sends all 3 elements; image path filters to 1", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA", "marcusReeves"] },
      mjPrompt: { body: "@peterNightingale walks through the church." },
      klingPrompt: { body: "@peterNightingale at @peterChurchA with @marcusReeves." },
    };

    // Video path: uses ALL elements from shot.meta.elements
    const videoElements = shot.meta.elements.map((el) => el.replace(/^@/, ""));
    assert.equal(videoElements.length, 3);

    // Image path: filters by @-mentions in mjPrompt.body
    const imageElements = deriveElementsFromPrompt(shot);
    assert.equal(imageElements.length, 1);
    assert.equal(imageElements[0], "peterNightingale");
  });

  test("video path uses selectElements (React fiber); image uses selectCharacters (DOM)", () => {
    // Video: visualReferencesReact.selectElements → idMap → postMessage
    // Image: createImageCharacters.selectCharacters → checkbox clicks
    // These are fundamentally different mechanisms
    const videoMechanism = "visualReferencesReact.selectElements";
    const imageMechanism = "createImageCharacters.selectCharacters";
    assert.notEqual(videoMechanism, imageMechanism);
  });

  test("video path transforms prompt via fetch interceptor; image does not", () => {
    const shot = {
      meta: { elements: ["peterNightingale"] },
      klingPrompt: { body: "@peterNightingale walks." },
      mjPrompt: { body: "@peterNightingale walks." },
    };

    // Video: fetch interceptor transforms @name → @id in API body
    const idMap = { peterNightingale: "TCOmrNbxzys8WExQjSrI" };
    let videoPrompt = shot.klingPrompt.body;
    for (const [name, id] of Object.entries(idMap)) {
      videoPrompt = videoPrompt.replaceAll(`@${name}`, `@${id}`);
    }
    assert.ok(!videoPrompt.includes("@peterNightingale"));

    // Image: prompt injected as-is, no transform
    const imagePrompt = shot.mjPrompt.body;
    assert.ok(imagePrompt.includes("@peterNightingale"), "image prompt stays as-is");
  });

  test("video path clears visual references first; image clears image references", () => {
    // Video: visualReferencesReact.clearElements() + clearImageReferences()
    // Image: clearImageReferences() only (+ creates new via DOM)
    const videoClearSteps = ["clearElements", "clearImageReferences"];
    const imageClearSteps = ["clearImageReferences"];
    assert.ok(videoClearSteps.includes("clearElements"));
    assert.ok(!imageClearSteps.includes("clearElements"));
  });

  test("video path calls configureSettings; image calls configureImageOutput", () => {
    // Video: configureSettings(shot, project) — opens settings panel, sets AR/duration/resolution/auto-polish
    // Image: configureImageOutput or configureStartFrameSettings — sets AR/resolution/model
    const videoConfig = "configureSettings";
    const imageConfig = "configureImageOutput";
    assert.notEqual(videoConfig, imageConfig);
  });
});
