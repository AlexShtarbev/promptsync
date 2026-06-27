import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE = readFileSync(resolve(__dirname, "../content/googleflow.js"), "utf-8");

const REF = "ref-hale-s0-front-three-quarter.jpg";
const IMAGE_URL = "http://localhost:3456/api/assets/p/characters/hale/s0/image";

// --- Load the REAL googleflow.js into an isolated scope -----------------------
//
// We wrap the source in a `new Function` and inject every global it touches as a
// parameter. This means: (1) regressions in the actual source fail these tests,
// and (2) we never pollute Node's globals (critically, `setTimeout` is a fast
// shim local to the source — node:test's own timers stay real). jsdom lacks
// PointerEvent, so we alias it to MouseEvent (flowPointerClick also fires a real
// `click`, which is what our fixtures listen for).
function loadFlow(dom, fetchMock) {
  const { window } = dom;
  const doc = window.document;
  const fastSetTimeout = (fn, ms, ...a) => setTimeout(fn, Math.min(ms || 0, 15), ...a);
  const quietConsole = { log() {}, warn() {}, error: (...a) => console.error(...a) };

  class FakeDataTransfer {
    constructor() {
      const files = [];
      this.items = { add: (f) => files.push(f) };
      Object.defineProperty(this, "files", { get: () => files });
    }
  }

  const factory = new Function(
    "window", "document", "console", "setTimeout", "clearTimeout", "getComputedStyle",
    "MutationObserver", "PointerEvent", "MouseEvent", "KeyboardEvent", "InputEvent",
    "Event", "Node", "fetch", "Blob", "File", "DataTransfer", "PROMPTSYNC_API", "showToast",
    "handleAutoDownload",
    MODULE_SOURCE +
      "\n;return { flowAttachReference, flowAttachPrimaryReference, flowAttachShotElements," +
      " flowFindPickerItemByName, flowNameKey, flowPickerOptionNames," +
      " flowAddOneElement, flowPickerOpen, flowClosePicker," +
      " flowFindAddReferenceButton," +
      " flowPickerImages, flowFindPickerItemByAlt, flowFindPickerItemByResourceId," +
      " flowResourceIdFromUrl, flowClickPickerFilter, flowFindPickerCommitButton," +
      " flowPickerContainer, flowPickerButtonLabels, flowVisible, flowPointerClick," +
      " flowOnCharactersTab, injectIntoPage };"
  );

  const toasts = [];
  const showToast = (msg) => toasts.push(msg);
  const autoDownloads = [];
  const handleAutoDownload = (d) => autoDownloads.push(d);
  const api = factory(
    window, doc, quietConsole, fastSetTimeout, clearTimeout, window.getComputedStyle,
    window.MutationObserver, window.MouseEvent, window.MouseEvent, window.KeyboardEvent,
    window.InputEvent || window.Event, window.Event, window.Node, fetchMock,
    window.Blob || Blob, window.File || File, window.DataTransfer || FakeDataTransfer,
    "http://localhost:3456/api", showToast, handleAutoDownload
  );
  api.toasts = toasts;
  api.autoDownloads = autoDownloads;
  return api;
}

// Set the module's flowCurrentTarget the way shared.js does — via a window message.
function setTarget(dom, target) {
  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", { data: { type: "promptsync-set-target", target } })
  );
}

function makeDom() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://labs.google/fx/tools/flow/project/x",
  });
  const { window } = dom;
  // flowVisible needs non-zero rects + a visible computed style.
  window.getComputedStyle = () => ({ display: "block", visibility: "visible", opacity: "1" });
  window.Element.prototype.getBoundingClientRect = function () {
    return { x: 10, y: 10, width: 50, height: 20, left: 10, top: 10, right: 60, bottom: 30 };
  };
  return dom;
}

// A fetch mock that records the URLs it's asked for and returns a tiny image blob.
function makeFetchMock(dom) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    return { ok: true, blob: async () => new (dom.window.Blob || Blob)(["x"], { type: "image/jpeg" }) };
  };
  fn.calls = calls;
  return fn;
}

// --- DOM fixtures mirroring Flow's composer + reference picker ----------------

function addComposerButton(doc) {
  const btn = doc.createElement("button");
  const icon = doc.createElement("i");
  icon.textContent = "add_2";
  btn.appendChild(icon);
  btn.appendChild(doc.createTextNode("Create"));
  doc.body.appendChild(btn);
  return btn;
}

function addOption(doc, grid, alt, isSelected, clickLog, name) {
  const opt = doc.createElement("div");
  opt.setAttribute("role", "option");
  opt.setAttribute("aria-selected", isSelected ? "true" : "false");
  const img = doc.createElement("img");
  img.setAttribute("alt", alt);
  // The thumbnail src carries ?name=<resourceId>; default it to the alt.
  img.src = "/fx/api/trpc/media.getMediaUrlRedirect?name=" + encodeURIComponent(name || alt);
  opt.appendChild(img);
  // Clicking an option TOGGLES its selected state (Flow's real behavior) and is
  // recorded so tests can assert what we did / didn't click.
  opt.addEventListener("click", () => {
    clickLog.push(alt);
    opt.setAttribute("aria-selected", opt.getAttribute("aria-selected") === "true" ? "false" : "true");
  });
  grid.appendChild(opt);
  return opt;
}

function buildPicker(doc, alts, opts = {}) {
  const { selected = [], withUploadsFilter = true, withCommit = true, clickLog = [] } = opts;
  const dialog = doc.createElement("div");
  dialog.setAttribute("role", "dialog");

  const filters = ["All", "Images"];
  if (withUploadsFilter) filters.push("Uploads");
  for (const f of filters) {
    const b = doc.createElement("button");
    const ic = doc.createElement("i");
    ic.textContent = f === "Uploads" ? "drive_folder_upload" : "dashboard";
    b.appendChild(ic);
    b.appendChild(doc.createTextNode(f));
    b.dataset.filter = f;
    dialog.appendChild(b);
  }

  const grid = doc.createElement("div");
  grid.className = "ps-grid";
  dialog.appendChild(grid);
  for (const alt of alts) addOption(doc, grid, alt, selected.includes(alt), clickLog);

  if (withCommit) {
    const commit = doc.createElement("button");
    commit.textContent = "Add to Prompt";
    commit.addEventListener("click", () => dialog.remove()); // commit closes the picker
    dialog.appendChild(commit);
  }
  return dialog;
}

// Wire the add_2 button so clicking it opens a picker (idempotently).
function wirePickerOpen(doc, addBtn, alts, opts = {}) {
  addBtn.addEventListener("click", () => {
    if (!doc.querySelector('[role="dialog"]')) {
      doc.body.appendChild(buildPicker(doc, alts, opts));
    }
  });
}

describe("flowAttachReference — reuse vs. upload", () => {
  test("reuses an existing collection item without uploading", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const addBtn = addComposerButton(doc);
    wirePickerOpen(doc, addBtn, [REF, "other.jpg"]);

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, true);
    assert.equal(fetchMock.calls.length, 0, "must NOT upload when the ref already exists in the collection");
    assert.equal(doc.querySelector('input[type="file"]'), null, "no file input should even be needed");
    assert.equal(doc.querySelector('[role="dialog"]'), null, "picker should be committed and closed");
  });

  test("uploads only when the ref is missing, then selects it", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const addBtn = addComposerButton(doc);
    // Collection lacks REF; no Uploads filter so the reuse-fallback is skipped fast.
    wirePickerOpen(doc, addBtn, ["other.jpg"], { withUploadsFilter: false });

    // The file input: on change, simulate Flow finishing the upload by adding the
    // new (pre-selected) item to the open picker grid.
    const input = doc.createElement("input");
    input.type = "file";
    Object.defineProperty(input, "files", { writable: true, value: null });
    doc.body.appendChild(input);
    input.addEventListener("change", () => {
      const grid = doc.querySelector('[role="dialog"] .ps-grid');
      if (grid && !grid.querySelector(`img[alt="${REF}"]`)) addOption(doc, grid, REF, true, []);
    });

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, true);
    assert.equal(fetchMock.calls.length, 1, "should fetch the image exactly once to upload it");
    assert.equal(fetchMock.calls[0], IMAGE_URL);
    assert.equal(doc.querySelector('[role="dialog"]'), null, "picker should be committed and closed");
  });

  test("reuses an image already GENERATED in Flow (by resourceId) without uploading", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const RES_ID = "a2c1a4c5-df8f-4630-967e-879c8e69950d";
    const clickLog = [];
    const addBtn = addComposerButton(doc);
    // The collection has NO item named like our upload (alt !== REF); instead it
    // holds the generated image whose thumbnail src is ?name=<RES_ID>.
    addBtn.addEventListener("click", () => {
      if (!doc.querySelector('[role="dialog"]')) {
        const picker = buildPicker(doc, [], { clickLog });
        const grid = picker.querySelector(".ps-grid");
        addOption(doc, grid, "Generated image", false, clickLog, RES_ID);
        doc.body.appendChild(picker);
      }
    });

    const ok = await flow.flowAttachReference(IMAGE_URL, REF, RES_ID);

    assert.equal(ok, true);
    assert.equal(fetchMock.calls.length, 0, "must reference the existing Flow generation, not upload a duplicate");
    assert.equal(doc.querySelector('[role="dialog"]'), null);
  });

  test("checks the Uploads filter before deciding to upload", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const addBtn = addComposerButton(doc);
    // REF is NOT on the default view; it appears only after the Uploads filter is clicked.
    wirePickerOpen(doc, addBtn, ["other.jpg"], { withUploadsFilter: true });
    addBtn.addEventListener("click", () => {
      const uploadsBtn = doc.querySelector('[role="dialog"] [data-filter="Uploads"]');
      uploadsBtn?.addEventListener("click", () => {
        const grid = doc.querySelector('[role="dialog"] .ps-grid');
        if (grid && !grid.querySelector(`img[alt="${REF}"]`)) addOption(doc, grid, REF, false, []);
      });
    });

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, true);
    assert.equal(fetchMock.calls.length, 0, "Uploads filter surfaced the ref — no upload needed");
    assert.equal(doc.querySelector('[role="dialog"]'), null);
  });
});

describe("flowAttachReference — selection safety (picker regressions)", () => {
  test("does NOT click (toggle off) an already-selected item", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const clickLog = [];
    const addBtn = addComposerButton(doc);
    wirePickerOpen(doc, addBtn, [REF, "other.jpg"], { selected: [REF], clickLog });

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, true);
    assert.ok(!clickLog.includes(REF), "a pre-selected item must not be clicked (that would deselect it)");
    assert.equal(doc.querySelector('[role="dialog"]'), null);
  });

  test("selects an unselected item exactly once, then commits", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const clickLog = [];
    const addBtn = addComposerButton(doc);
    wirePickerOpen(doc, addBtn, [REF, "other.jpg"], { selected: [], clickLog });

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, true);
    assert.deepEqual(clickLog, [REF], "should click our item once to select it (and nothing else)");
    assert.equal(doc.querySelector('[role="dialog"]'), null);
  });

  test("never sends Escape and never clicks the generate (arrow_forward) button", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    let escapes = 0;
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape") escapes++;
    });

    let generateClicks = 0;
    const gen = doc.createElement("button");
    const gi = doc.createElement("i");
    gi.textContent = "arrow_forward";
    gen.appendChild(gi);
    gen.addEventListener("click", () => generateClicks++);
    doc.body.appendChild(gen);

    const addBtn = addComposerButton(doc);
    wirePickerOpen(doc, addBtn, [REF, "other.jpg"]);

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, true);
    assert.equal(escapes, 0, "must not dismiss the picker with Escape (that cancels the selection)");
    assert.equal(generateClicks, 0, "must never click the generate button while attaching a reference");
  });

  test("returns false when the ref never appears (no infinite hang, no upload loop)", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const addBtn = addComposerButton(doc);
    wirePickerOpen(doc, addBtn, ["other.jpg"], { withUploadsFilter: false });
    // A file input exists but the upload never makes REF appear.
    const input = doc.createElement("input");
    input.type = "file";
    Object.defineProperty(input, "files", { writable: true, value: null });
    doc.body.appendChild(input);

    const ok = await flow.flowAttachReference(IMAGE_URL, REF);

    assert.equal(ok, false, "gives up cleanly when the item can't be found after upload");
    assert.equal(fetchMock.calls.length, 1, "attempts the upload exactly once");
  });
});

describe("picker helpers", () => {
  test("flowPickerContainer ignores the settings popover (no images) and finds the picker", () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));

    // Settings popover: an open radix menu with NO images.
    const popover = doc.createElement("div");
    popover.setAttribute("data-radix-menu-content", "");
    popover.setAttribute("data-state", "open");
    doc.body.appendChild(popover);

    const picker = buildPicker(doc, ["a.jpg"]);
    doc.body.appendChild(picker);

    assert.equal(flow.flowPickerContainer(), picker);
  });

  test("flowFindPickerItemByAlt returns the [role=option] ancestor, or null", () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    doc.body.appendChild(buildPicker(doc, ["a.jpg", "b.jpg"]));

    const item = flow.flowFindPickerItemByAlt("b.jpg");
    assert.equal(item.getAttribute("role"), "option");
    assert.equal(item.querySelector("img").getAttribute("alt"), "b.jpg");
    assert.equal(flow.flowFindPickerItemByAlt("missing.jpg"), null);
  });

  test("flowFindPickerItemByResourceId matches the ?name= in the thumbnail src", () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));

    const RES_ID = "a2c1a4c5-df8f-4630-967e-879c8e69950d";
    const picker = buildPicker(doc, []);
    const grid = picker.querySelector(".ps-grid");
    addOption(doc, grid, "Generated image", false, [], RES_ID);
    doc.body.appendChild(picker);

    const item = flow.flowFindPickerItemByResourceId(RES_ID);
    assert.equal(item.getAttribute("role"), "option");
    assert.equal(flow.flowFindPickerItemByResourceId("nope"), null);
    assert.equal(flow.flowFindPickerItemByResourceId(null), null, "null id never matches");
    assert.equal(flow.flowFindPickerItemByResourceId(undefined), null);
  });

  test("flowFindPickerCommitButton finds 'Add to Prompt' (and null when absent)", () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));

    const withCommit = buildPicker(doc, ["a.jpg"]);
    doc.body.appendChild(withCommit);
    assert.equal(flow.flowFindPickerCommitButton().textContent.trim(), "Add to Prompt");

    withCommit.remove();
    doc.body.appendChild(buildPicker(doc, ["a.jpg"], { withCommit: false }));
    assert.equal(flow.flowFindPickerCommitButton(), null);
  });

  test("flowClickPickerFilter clicks the matching filter and returns true/false", () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));

    const picker = buildPicker(doc, ["a.jpg"]);
    let clicked = null;
    picker.querySelector('[data-filter="Uploads"]').addEventListener("click", () => {
      clicked = "Uploads";
    });
    doc.body.appendChild(picker);

    assert.equal(flow.flowClickPickerFilter(/uploads/i), true);
    assert.equal(clicked, "Uploads");
    assert.equal(flow.flowClickPickerFilter(/no-such-filter/i), false);
  });

  test("flowPickerButtonLabels lists the picker's buttons", () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    doc.body.appendChild(buildPicker(doc, ["a.jpg"]));

    const labels = flow.flowPickerButtonLabels();
    assert.ok(labels.some((l) => /Uploads/.test(l)), "includes the Uploads filter");
    assert.ok(labels.includes("Add to Prompt"), "includes the commit button");
  });
});

describe("flowResourceIdFromUrl", () => {
  test("extracts the ?name= resource id from a Flow media url", () => {
    const dom = makeDom();
    const flow = loadFlow(dom, makeFetchMock(dom));
    assert.equal(
      flow.flowResourceIdFromUrl("/fx/api/trpc/media.getMediaUrlRedirect?name=abc-123"),
      "abc-123"
    );
    assert.equal(
      flow.flowResourceIdFromUrl("https://labs.google/x?foo=1&name=xyz&bar=2"),
      "xyz"
    );
  });

  test("url-decodes the resource id", () => {
    const dom = makeDom();
    const flow = loadFlow(dom, makeFetchMock(dom));
    assert.equal(flow.flowResourceIdFromUrl("/x?name=a%2Fb"), "a/b");
  });

  test("returns null when there is no ?name= (e.g. an OpenArt url) or no url", () => {
    const dom = makeDom();
    const flow = loadFlow(dom, makeFetchMock(dom));
    assert.equal(flow.flowResourceIdFromUrl("https://openart.ai/some/image.png"), null);
    assert.equal(flow.flowResourceIdFromUrl(""), null);
    assert.equal(flow.flowResourceIdFromUrl(null), null);
  });
});

describe("flowAttachReference — match precedence", () => {
  test("prefers the already-generated image (resourceId) over a same-name upload (alt)", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = makeFetchMock(dom);
    const flow = loadFlow(dom, fetchMock);

    const RES_ID = "gen-res-id";
    const clickLog = [];
    const addBtn = addComposerButton(doc);
    // Picker contains BOTH: a prior upload (alt === REF) and the generated image
    // (?name=RES_ID, different alt). resourceId should win.
    addBtn.addEventListener("click", () => {
      if (!doc.querySelector('[role="dialog"]')) {
        const picker = buildPicker(doc, [REF], { clickLog }); // the upload, alt === REF
        const grid = picker.querySelector(".ps-grid");
        addOption(doc, grid, "Generated image", false, clickLog, RES_ID); // the generation
        doc.body.appendChild(picker);
      }
    });

    const ok = await flow.flowAttachReference(IMAGE_URL, REF, RES_ID);

    assert.equal(ok, true);
    assert.equal(fetchMock.calls.length, 0);
    assert.deepEqual(clickLog, ["Generated image"], "selected the generated image, not the upload");
  });
});

describe("flowAttachPrimaryReference — orchestration", () => {
  // A character whose PRIMARY view was generated in Flow (openart_ref carries ?name=).
  function charWith(views) {
    return async (url) => {
      if (url.includes("/extension/character")) {
        return { ok: true, json: async () => ({ views }) };
      }
      return { ok: true, blob: async () => new (Blob)(["x"], { type: "image/jpeg" }) };
    };
  }

  test("does nothing when the current target isn't a character", async () => {
    const dom = makeDom();
    const calls = [];
    const fetchMock = async (u) => { calls.push(u); return { ok: true, json: async () => ({}) }; };
    const flow = loadFlow(dom, fetchMock);
    setTarget(dom, { type: "shot", project: "p", code: "1A" });

    await flow.flowAttachPrimaryReference();
    assert.equal(calls.length, 0, "no character fetch for a non-char target");
  });

  test("skips self-reference when injecting the PRIMARY view itself", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const calls = [];
    const fetchMock = async (u) => {
      calls.push(u);
      return { ok: true, json: async () => ({ views: [{ slug: "front", primary: true, has_image: true, openart_ref: "/x?name=RID" }] }) };
    };
    const flow = loadFlow(dom, fetchMock);
    setTarget(dom, { type: "char", project: "p", charSlug: "hale", viewSlug: "front" });

    await flow.flowAttachPrimaryReference();

    assert.ok(calls.some((u) => u.includes("/extension/character")), "fetched the character");
    assert.equal(doc.querySelector('[role="dialog"]'), null, "never opened the picker (no self-reference)");
  });

  test("skips when no primary view has an image", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const fetchMock = charWith([
      { slug: "front", primary: true, has_image: false },
      { slug: "side", primary: false, has_image: true },
    ]);
    const flow = loadFlow(dom, fetchMock);
    setTarget(dom, { type: "char", project: "p", charSlug: "hale", viewSlug: "side" });

    await flow.flowAttachPrimaryReference();
    assert.equal(doc.querySelector('[role="dialog"]'), null, "no reference attached");
  });

  test("reuses the primary's existing Flow generation (resourceId from openart_ref) — no upload", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const RES_ID = "primary-gen-id";
    const calls = [];
    const fetchMock = async (u) => {
      calls.push(u);
      if (u.includes("/extension/character")) {
        return { ok: true, json: async () => ({
          views: [
            { slug: "front", primary: true, has_image: true, openart_ref: `https://labs.google/x?name=${RES_ID}` },
            { slug: "side", primary: false, has_image: false },
          ],
        }) };
      }
      return { ok: true, blob: async () => new (dom.window.Blob || Blob)(["x"], { type: "image/jpeg" }) };
    };
    const flow = loadFlow(dom, fetchMock);

    // Picker holds the primary's generated image (by resourceId), not a named upload.
    const addBtn = addComposerButton(doc);
    addBtn.addEventListener("click", () => {
      if (!doc.querySelector('[role="dialog"]')) {
        const picker = buildPicker(doc, []);
        addOption(doc, picker.querySelector(".ps-grid"), "Generated image", false, [], RES_ID);
        doc.body.appendChild(picker);
      }
    });

    setTarget(dom, { type: "char", project: "p", charSlug: "hale", viewSlug: "side" });
    await flow.flowAttachPrimaryReference();

    const imageFetches = calls.filter((u) => u.includes("/image"));
    assert.equal(imageFetches.length, 0, "must not download the image to upload — it's already in Flow");
    assert.equal(doc.querySelector('[role="dialog"]'), null, "picker committed and closed");
  });
});



// --- flowAttachShotElements: per-element commit on a single-select picker ------

describe("flowAttachShotElements — per-element commit (single-select picker)", () => {
  // A SINGLE-SELECT Characters picker (Flow's real behavior, verified live):
  // clicking an option selects it and de-selects all others. "Add to Prompt"
  // records the committed name(s) and closes; Escape closes without recording.
  function openCharacterPicker(doc, names, logs) {
    const { clickLog = [], filterLog = [], commitLog = [] } = logs;
    if (doc.querySelector('[role="dialog"]')) return;
    const dialog = doc.createElement("div");
    dialog.setAttribute("role", "dialog");

    for (const f of ["All", "Images", "Characters", "Uploads"]) {
      const b = doc.createElement("button");
      b.appendChild(doc.createTextNode(f));
      b.addEventListener("click", () => filterLog.push(f));
      dialog.appendChild(b);
    }

    const grid = doc.createElement("div");
    dialog.appendChild(grid);
    const opts = [];
    for (const name of names) {
      const opt = doc.createElement("div");
      opt.setAttribute("role", "option");
      opt.setAttribute("aria-selected", "false");
      const img = doc.createElement("img");
      img.src = "/thumb.png";
      img.setAttribute("alt", name);
      opt.appendChild(img);
      const cap = doc.createElement("span");
      cap.textContent = name;
      opt.appendChild(cap);
      opt.addEventListener("click", () => {
        clickLog.push(name);
        for (const o of opts) o.setAttribute("aria-selected", o === opt ? "true" : "false");
      });
      grid.appendChild(opt);
      opts.push(opt);
    }

    const commit = doc.createElement("button");
    commit.textContent = "Add to Prompt";
    commit.addEventListener("click", () => {
      commitLog.push(opts.filter((o) => o.getAttribute("aria-selected") === "true")
        .map((o) => o.querySelector("span").textContent));
      dialog.remove();
    });
    dialog.appendChild(commit);
    doc.body.appendChild(dialog);
  }

  // Wire add_2 to (re)open the picker each cycle, and Escape to close it.
  function wire(doc, names, logs) {
    const addBtn = addComposerButton(doc);
    addBtn.addEventListener("click", () => openCharacterPicker(doc, names, logs));
    doc.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const d = doc.querySelector('[role="dialog"]');
      if (d) d.remove();
    });
    return addBtn;
  }

  test("adds each element in its own commit cycle (works despite single-select)", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], filterLog = [], commitLog = [];
    wire(doc, ["HaleS0", "Floor1Chamber", "MemoryTower"], { clickLog, filterLog, commitLog });

    await flow.flowAttachShotElements({ code: "1B", meta: { elements: ["HaleS0", "Floor1Chamber"] } });

    assert.deepEqual(clickLog, ["HaleS0", "Floor1Chamber"], "selected each target once");
    assert.deepEqual(commitLog, [["HaleS0"], ["Floor1Chamber"]],
      "committed each in its OWN cycle — single-select never clobbers a prior pick");
    assert.deepEqual(filterLog, ["Characters", "Characters"], "switched to Characters each cycle");
    assert.equal(doc.querySelector('[role="dialog"]'), null, "picker closed at the end");
  });

  test("matches the element token to a differently-spaced picker name", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], commitLog = [];
    wire(doc, ["Tower World"], { clickLog, commitLog });

    await flow.flowAttachShotElements({ meta: { elements: ["@TowerWorld"] } });

    assert.deepEqual(clickLog, ["Tower World"]);
    assert.deepEqual(commitLog, [["Tower World"]]);
  });

  test("skips a missing element (Escape-closes its picker) and still adds the rest", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], commitLog = [];
    wire(doc, ["HaleS0", "Floor1Chamber"], { clickLog, commitLog });

    await flow.flowAttachShotElements({ meta: { elements: ["Ghost", "HaleS0"] } });

    assert.deepEqual(clickLog, ["HaleS0"], "only the present element was selected");
    assert.deepEqual(commitLog, [["HaleS0"]], "the missing one didn't commit anything");
    assert.equal(doc.querySelector('[role="dialog"]'), null, "missing element's picker was closed, not left open");
    assert.ok(flow.toasts.some((t) => /couldn't find character "Ghost"/.test(t)), "warned about the missing element");
  });

  test("no elements -> never opens the picker", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const commitLog = [];
    wire(doc, ["HaleS0"], { commitLog });

    await flow.flowAttachShotElements({ meta: { elements: [] } });

    assert.equal(doc.querySelector('[role="dialog"]'), null, "no picker opened");
    assert.deepEqual(commitLog, []);
  });

  test("flowFindPickerItemByName matches by normalized name", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    openCharacterPicker(doc, ["HaleS0", "Tower World"], {});

    const opt = flow.flowFindPickerItemByName("@hale-s0");
    assert.ok(opt, "found HaleS0 via normalized match");
    assert.equal(opt.getAttribute("role"), "option");
    assert.equal(flow.flowFindPickerItemByName("Nobody"), null, "no match -> null");
  });
});


// --- flowAttachShotElements: coverage mirroring Flow's real picker ------------

describe("flowAttachShotElements — coverage (lazy render, dedup, idempotent)", () => {
  // A single-select Characters picker that mirrors Flow's live DOM:
  //  - a persistent preview <img> so flowPickerContainer finds the dialog even
  //    before option tiles exist,
  //  - option tiles that can render LAZILY (Flow mounted them after open),
  //  - optional pre-selected tiles and extra category controls.
  function openPicker2(doc, names, logs, opts = {}) {
    const { clickLog = [], filterLog = [], commitLog = [] } = logs;
    const { preSelected = [], lazy = false, extraControls = [], singleSelect = true } = opts;
    if (doc.querySelector('[role="dialog"]')) return;
    const dialog = doc.createElement("div");
    dialog.setAttribute("role", "dialog");

    const preview = doc.createElement("img");
    preview.src = "/preview.png";
    preview.setAttribute("alt", "Character preview image");
    dialog.appendChild(preview);

    for (const label of [...extraControls, "All", "Images", "Characters", "Uploads"]) {
      const b = doc.createElement("button");
      b.appendChild(doc.createTextNode(label));
      b.addEventListener("click", () => filterLog.push(label));
      dialog.appendChild(b);
    }

    const grid = doc.createElement("div");
    dialog.appendChild(grid);
    const tiles = [];
    const addOptions = () => {
      for (const name of names) {
        const opt = doc.createElement("div");
        opt.setAttribute("role", "option");
        opt.setAttribute("aria-selected", preSelected.includes(name) ? "true" : "false");
        const img = doc.createElement("img");
        img.src = "/t.png";
        img.setAttribute("alt", name);
        opt.appendChild(img);
        const cap = doc.createElement("span");
        cap.textContent = name;
        opt.appendChild(cap);
        opt.addEventListener("click", () => {
          clickLog.push(name);
          if (singleSelect) {
            for (const o of tiles) o.setAttribute("aria-selected", o === opt ? "true" : "false");
          } else {
            opt.setAttribute("aria-selected", opt.getAttribute("aria-selected") === "true" ? "false" : "true");
          }
        });
        grid.appendChild(opt);
        tiles.push(opt);
      }
    };

    const commit = doc.createElement("button");
    commit.textContent = "Add to Prompt";
    commit.addEventListener("click", () => {
      commitLog.push(tiles.filter((o) => o.getAttribute("aria-selected") === "true")
        .map((o) => o.querySelector("span").textContent));
      dialog.remove();
    });
    dialog.appendChild(commit);
    doc.body.appendChild(dialog);

    if (lazy) setTimeout(addOptions, 0);
    else addOptions();
  }

  function wire2(doc, names, logs, opts) {
    const addBtn = addComposerButton(doc);
    addBtn.addEventListener("click", () => openPicker2(doc, names, logs, opts));
    doc.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const d = doc.querySelector('[role="dialog"]');
      if (d) d.remove();
    });
    return addBtn;
  }

  test("waits for lazily-rendered option tiles (Flow mounts them after open)", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], commitLog = [];
    wire2(doc, ["HaleS0", "Floor1Chamber"], { clickLog, commitLog }, { lazy: true });

    await flow.flowAttachShotElements({ meta: { elements: ["HaleS0", "Floor1Chamber"] } });

    assert.deepEqual(clickLog, ["HaleS0", "Floor1Chamber"], "found both once their tiles rendered");
    assert.deepEqual(commitLog, [["HaleS0"], ["Floor1Chamber"]]);
  });

  test("selects only the shot's elements when the picker has many", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], commitLog = [];
    // Mirrors the live Characters list for crawler-ep01.
    wire2(doc, ["MemoryTower", "MemoryBedroom", "Floor1Chamber", "Floor1Creature", "HaleS0"],
      { clickLog, commitLog }, {});

    await flow.flowAttachShotElements({ meta: { elements: ["HaleS0", "Floor1Chamber"] } });

    assert.deepEqual(clickLog, ["HaleS0", "Floor1Chamber"], "ignored MemoryTower/MemoryBedroom/Floor1Creature");
    assert.deepEqual(commitLog, [["HaleS0"], ["Floor1Chamber"]]);
  });

  test("does not re-click an already-selected option (a re-click would toggle it off)", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], commitLog = [];
    wire2(doc, ["HaleS0"], { clickLog, commitLog }, { preSelected: ["HaleS0"] });

    await flow.flowAttachShotElements({ meta: { elements: ["HaleS0"] } });

    assert.deepEqual(clickLog, [], "left the pre-selected tile untouched");
    assert.deepEqual(commitLog, [["HaleS0"]], "still committed it");
  });

  test('switches via the plural "Characters" tab, never the singular "Character preview"', async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], filterLog = [], commitLog = [];
    // "Character preview image" precedes the real tab — the matcher must skip it.
    wire2(doc, ["HaleS0"], { clickLog, filterLog, commitLog }, { extraControls: ["Character preview image"] });

    await flow.flowAttachShotElements({ meta: { elements: ["HaleS0"] } });

    assert.deepEqual(filterLog, ["Characters"], "only the plural Characters tab was clicked");
    assert.deepEqual(commitLog, [["HaleS0"]]);
  });

  test("attaches three elements in three separate cycles", async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const flow = loadFlow(dom, makeFetchMock(dom));
    const clickLog = [], filterLog = [], commitLog = [];
    wire2(doc, ["A", "B", "C", "D"], { clickLog, filterLog, commitLog }, {});

    await flow.flowAttachShotElements({ meta: { elements: ["A", "B", "C"] } });

    assert.deepEqual(clickLog, ["A", "B", "C"]);
    assert.deepEqual(commitLog, [["A"], ["B"], ["C"]], "one commit per element");
    assert.deepEqual(filterLog, ["Characters", "Characters", "Characters"], "Characters tab each cycle");
  });
});


describe("googleflow — Characters-tab guard (no entanglement)", () => {
  // A Slate editor that records inserted text the way flowSetPrompt drives it.
  function addEditor(doc) {
    const ed = doc.createElement("div");
    ed.setAttribute("data-slate-editor", "true");
    ed.setAttribute("role", "textbox");
    ed.setAttribute("contenteditable", "true");
    doc.body.appendChild(ed);
    return ed;
  }
  function addActiveTab(doc, label, { selected = true } = {}) {
    const tab = doc.createElement("button");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.setAttribute("data-state", selected ? "active" : "inactive");
    tab.textContent = label;
    doc.body.appendChild(tab);
    return tab;
  }

  test("flowOnCharactersTab detects the active Characters tab (incl. icon-ligature labels)", () => {
    const dom = makeDom();
    const flow = loadFlow(dom, makeFetchMock(dom));
    assert.equal(flow.flowOnCharactersTab(), false, "no tabs → not on characters");

    addActiveTab(dom.window.document, "Scenebuilder");
    assert.equal(flow.flowOnCharactersTab(), false, "unrelated active tab");

    addActiveTab(dom.window.document, "groupCharacters"); // icon ligature + label
    assert.equal(flow.flowOnCharactersTab(), true);
  });

  test("an inactive Characters tab does not count", () => {
    const dom = makeDom();
    const flow = loadFlow(dom, makeFetchMock(dom));
    addActiveTab(dom.window.document, "Characters", { selected: false });
    assert.equal(flow.flowOnCharactersTab(), false);
  });

  test("injectIntoPage no-ops on the Characters tab (leaves the editor untouched, warns)", () => {
    const dom = makeDom();
    const flow = loadFlow(dom, makeFetchMock(dom));
    const ed = addEditor(dom.window.document);
    ed.textContent = "existing character definition";
    addActiveTab(dom.window.document, "Characters");

    const ok = flow.injectIntoPage("a brand new image prompt", null, "proj");
    assert.equal(ok, false, "injection refused on the Characters tab");
    assert.equal(ed.textContent, "existing character definition", "editor left untouched");
    assert.ok(flow.toasts.some((t) => /Characters tab/i.test(t)), "user told why");
  });
});
