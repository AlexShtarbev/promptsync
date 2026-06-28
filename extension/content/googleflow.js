// Google Flow (labs.google/fx/tools/flow) prompt injection — chat composer.
//
// Mirrors the OpenArt automation: inject the prompt, force media=Image, and set
// the aspect ratio / count / model from the shot. Runs in the isolated
// content-script world but drives Flow's page DOM directly (events cross worlds).
//
// IMPORTANT: the composer is a Slate.js editor. NEVER use document.execCommand on
// it — execCommand mutates Slate's DOM out from under React, desyncing Slate's
// model and crashing Flow's React tree ("Failed to execute 'removeChild'"). All
// edits go through synthetic `beforeinput` events, which is the native input
// channel Slate itself listens on.
//
// We never block on fixed delays — every wait is condition-driven via
// flowWaitFor(), which resolves the moment the DOM reaches the expected state.

// Image model Flow should use for storyboard generation.
const FLOW_IMAGE_MODEL = "Nano Banana 2";

// Verbose [Flow …] diagnostics are gated behind a flag so they stay available
// for debugging without spamming the console. Enable with (then reload):
//   localStorage.setItem("promptsync-debug", "1")
// Disable with: localStorage.removeItem("promptsync-debug")
function flowDebugEnabled() {
  try {
    return !!window.localStorage.getItem("promptsync-debug");
  } catch (e) {
    return false;
  }
}
function flowLog(...args) {
  if (flowDebugEnabled()) console.log(...args);
}

// Target ({type:"shot", project, code}) for the next auto-download. Set by
// injectIntoPage and by shared.js's promptsync-set-target message.
let flowCurrentTarget = null;

// The prompt most recently injected for the current target. Armed alongside the
// target on each Create click so the MAIN-world correlator can bind a generation
// REQUEST to its target by matching this prompt in the request body — robust to
// FIFO desync (agent mode, concurrent runs) that would otherwise misplace images.
let flowCurrentPrompt = "";

// Resolve as soon as `predicate()` is truthy (re-checked on every DOM mutation),
// or with `false` once `timeout` ms elapse. No polling sleeps — the only timer is
// the safety-net timeout.
function flowWaitFor(predicate, timeout = 2000) {
  return new Promise((resolve) => {
    let done = false;
    let observer = null;
    let timer = null;
    const finish = (val) => {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      if (timer) clearTimeout(timer);
      resolve(val);
    };
    const check = () => {
      let r;
      try {
        r = predicate();
      } catch (e) {
        r = false;
      }
      if (r) {
        finish(r);
        return true;
      }
      return false;
    };
    if (check()) return;
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    timer = setTimeout(() => finish(false), timeout);
  });
}

function flowVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (!(r.width || r.height)) return false;
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
}

function flowNorm(s) {
  return (s || "").replace(/\s+/g, "");
}

// Flow's segmented "tab slider" controls ignore a bare .click() — they only
// respond to a real mouse sequence. Dispatch mousedown/mouseup/click at center.
function flowMouseClick(el) {
  const r = el.getBoundingClientRect();
  const base = {
    bubbles: true,
    cancelable: true,
    clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2,
    button: 0,
  };
  el.dispatchEvent(new MouseEvent("mousedown", Object.assign({ buttons: 1 }, base)));
  el.dispatchEvent(new MouseEvent("mouseup", Object.assign({ buttons: 0 }, base)));
  el.dispatchEvent(new MouseEvent("click", Object.assign({ buttons: 0 }, base)));
}

// Radix dropdown triggers and menu items open/select on pointer events, not
// mouse events — they ignore flowMouseClick. Used for the settings popover
// trigger and the model picker.
function flowPointerClick(el) {
  const r = el.getBoundingClientRect();
  const base = {
    bubbles: true,
    cancelable: true,
    clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  };
  el.dispatchEvent(new PointerEvent("pointerdown", Object.assign({ buttons: 1 }, base)));
  el.dispatchEvent(new PointerEvent("pointerup", Object.assign({ buttons: 0 }, base)));
  el.dispatchEvent(new MouseEvent("click", Object.assign({ buttons: 0 }, base)));
}

// --- Slate composer ---

function findFlowEditor() {
  return (
    document.querySelector('[data-slate-editor="true"]') ||
    document.querySelector('div[role="textbox"][contenteditable="true"]')
  );
}

// Flow's own "Characters" management view has its own prompt box. The first Slate
// editor on the page is then that box, not the image composer — so injecting or
// generating there entangles our prompt with the character definition. Detect the
// active "Characters" tab / current nav entry (icon ligatures get concatenated to
// labels, e.g. "groupCharacters", so match on the trailing word) and no-op there.
function flowOnCharactersTab() {
  const active = document.querySelectorAll(
    '[role="tab"][aria-selected="true"],[role="tab"][data-state="active"],' +
    '[aria-current="page"],[aria-current="true"],[aria-current="step"]'
  );
  for (const el of active) {
    if (!flowVisible(el)) continue;
    const norm = (el.textContent || "").toLowerCase().replace(/[^a-z]/g, "");
    if (norm.includes("character")) return true;
  }
  return false;
}

// textContent without Slate's placeholder span (which is contenteditable=false
// and otherwise inflates the "is the box empty?" check).
function flowEditorText(ed) {
  const clone = ed.cloneNode(true);
  clone.querySelectorAll('[data-slate-placeholder="true"]').forEach((p) => p.remove());
  return clone.textContent.replace(/﻿/g, "");
}

function flowCaretEnd(ed) {
  ed.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(ed);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function flowSelectAll(ed) {
  ed.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(ed);
  sel.removeAllRanges();
  sel.addRange(range);
}

function flowFire(ed, inputType, data) {
  const init = { inputType, bubbles: true, cancelable: true };
  if (data != null) init.data = data;
  ed.dispatchEvent(new InputEvent("beforeinput", init));
}

// Replace the composer contents with `text`. Slate DOES honor a full-range DOM
// selection for a delete (verified): select the whole document, let Slate sync
// its internal selection, then one deleteContentBackward clears it instantly.
// A per-edit fallback finishes anything that survives.
async function flowSetPrompt(text) {
  const ed = findFlowEditor();
  if (!ed) {
    console.warn("[PromptSync] Google Flow editor not found");
    return false;
  }

  // 1. Clear: select-all + a single delete (instant — no letter-by-letter).
  flowSelectAll(ed);
  await new Promise((r) => setTimeout(r, 50)); // let Slate's selectionchange sync
  flowFire(ed, "deleteContentBackward", null);
  await flowWaitFor(() => !flowEditorText(ed).trim(), 400);

  // Fallback: if anything survived (selection didn't sync), finish it one edit at
  // a time so we never leave stray fragments.
  flowCaretEnd(ed);
  let guard = 0;
  while (flowEditorText(ed).trim().length > 0 && guard < 600) {
    const before = flowEditorText(ed).length;
    flowFire(ed, "deleteContentBackward", null);
    await flowWaitFor(() => flowEditorText(ed).length < before, 300);
    guard++;
  }

  // 2. Insert, retrying once if the first beforeinput no-ops (can happen right
  //    after focus before Slate's selection settles).
  flowCaretEnd(ed);
  flowFire(ed, "insertText", text);
  await flowWaitFor(() => flowEditorText(ed).trim().length > 0, 600);
  if (!flowEditorText(ed).trim()) {
    flowCaretEnd(ed);
    flowFire(ed, "insertText", text);
    await flowWaitFor(() => flowEditorText(ed).trim().length > 0, 600);
  }

  const got = flowEditorText(ed).trim();
  const ok = got.indexOf(text.trim().slice(0, 12)) > -1;
  if (!ok) console.warn("[PromptSync] Flow prompt may not have landed:", got.slice(0, 40));
  return ok;
}

// --- Settings popover (media type | aspect ratio | count | model) ---

function flowPopover() {
  return document.querySelector('[data-radix-menu-content][data-state="open"]');
}

function flowOpenMenuCount() {
  return document.querySelectorAll('[data-radix-menu-content][data-state="open"]').length;
}

// The composer settings button is the only button[aria-haspopup=menu] carrying a
// crop_* aspect-ratio icon (the nested model trigger uses arrow_drop_down).
function flowSettingsTrigger() {
  const btns = document.querySelectorAll('button[aria-haspopup="menu"]');
  for (const btn of btns) {
    if (!flowVisible(btn)) continue;
    const icons = btn.querySelectorAll("i");
    for (const ic of icons) {
      if (/^crop_/.test(ic.textContent.trim())) return btn;
    }
  }
  return null;
}

// Snapshot of the open popover for diagnostics.
function flowReadPopoverState() {
  const pop = flowPopover();
  if (!pop) return { open: false };
  const model = pop.querySelector('button[aria-haspopup="menu"]');
  return {
    open: true,
    activeTabs: Array.prototype.map.call(
      pop.querySelectorAll('[role="tab"][data-state="active"]'),
      (t) => t.textContent.trim()
    ),
    model: model ? model.textContent.trim() : null,
  };
}

// Configure Image + aspect ratio + 1x + Nano Banana 2. This is a 1:1 port of the
// console `psGenerate` flow we verified live: open the popover ONCE, capture that
// node (`pop`), and drive every control off it in the proven order
// (Image → aspect → 1x → model → close). Tab sliders take mouse events; the
// settings trigger and the model picker take pointer events.
// Core popover configuration, driven by an explicit aspect ratio. Shared by the
// shot path (configureFlowOutput) and the character-view path
// (configureCharImageOutput).
async function flowApplyOutputSettings(ar) {
  const L = (...a) => flowLog("[Flow cfg]", ...a);
  const model = FLOW_IMAGE_MODEL;
  L("start; ar=", ar, "model=", model);

  // Open the settings popover (Radix trigger — pointer events).
  let pop = flowPopover();
  if (!pop) {
    const trigger = flowSettingsTrigger();
    L("settings trigger:", trigger ? JSON.stringify(trigger.textContent.trim()) : "NOT FOUND");
    if (!trigger) return;
    flowPointerClick(trigger);
    await flowWaitFor(() => flowPopover(), 2500);
    pop = flowPopover();
  }
  L("popover open:", !!pop, pop ? "activeTabs=" + JSON.stringify(flowReadPopoverState().activeTabs) : "");
  if (!pop) return;

  const tabActive = (sel) => {
    const t = (flowPopover() || document).querySelector(sel);
    return t && t.getAttribute("data-state") === "active";
  };

  // 1. Media = Image
  const imgSel = '[role="tab"][id$="-trigger-IMAGE"]';
  const img = pop.querySelector(imgSel);
  L("media IMAGE tab:", img ? "state=" + img.getAttribute("data-state") : "NOT FOUND");
  if (img && img.getAttribute("data-state") !== "active") {
    flowMouseClick(img);
    const ok = await flowWaitFor(() => tabActive(imgSel), 600);
    L("media clicked -> active:", ok);
  }

  // 2. Aspect ratio — match the trailing ratio text (16:9 / 9:16 / 1:1 / 4:3 / 3:4)
  if (ar) {
    const want = flowNorm(ar);
    let found = false;
    const tabs = pop.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      const t = tab.textContent.trim();
      if (t.indexOf(":") > -1 && flowNorm(t).endsWith(want)) {
        found = true;
        L("aspect match:", JSON.stringify(t), "state=" + tab.getAttribute("data-state"));
        if (tab.getAttribute("data-state") !== "active") {
          const id = tab.id;
          flowMouseClick(tab);
          const ok = await flowWaitFor(() => {
            const tt = id ? document.getElementById(id) : tab;
            return tt && tt.getAttribute("data-state") === "active";
          }, 600);
          L("aspect clicked -> active:", ok);
        }
        break;
      }
    }
    if (!found) L("aspect NOT FOUND for", want, "| available:", Array.prototype.map.call(tabs, (t) => t.textContent.trim()));
  }

  // 3. Count = 1x
  const oneSel = '[role="tab"][id$="-trigger-1"]';
  const one = pop.querySelector(oneSel);
  L("count 1x tab:", one ? "state=" + one.getAttribute("data-state") : "NOT FOUND");
  if (one && one.getAttribute("data-state") !== "active") {
    flowMouseClick(one);
    const ok = await flowWaitFor(() => tabActive(oneSel), 600);
    L("count clicked -> active:", ok);
  }

  // 4. Model = Nano Banana 2 (nested Radix submenu — pointer events)
  const mt = pop.querySelector('button[aria-haspopup="menu"]');
  L("model trigger:", mt ? JSON.stringify(mt.textContent.trim()) : "NOT FOUND");
  if (mt && mt.textContent.trim().toLowerCase().indexOf(model.toLowerCase()) === -1) {
    flowPointerClick(mt);
    const opened = await flowWaitFor(() => flowOpenMenuCount() >= 2, 800);
    L("model submenu opened:", opened, "menuCount=", flowOpenMenuCount());
    if (flowOpenMenuCount() < 2) {
      flowPointerClick(mt);
      await flowWaitFor(() => flowOpenMenuCount() >= 2, 800);
      L("model retry, menuCount=", flowOpenMenuCount());
    }
    const menus = document.querySelectorAll('[data-radix-menu-content][data-state="open"]');
    const menu = menus[menus.length - 1];
    if (menu && menu !== pop) {
      const items = menu.querySelectorAll('[role="menuitem"]');
      L("model items:", Array.prototype.map.call(items, (i) => i.textContent.trim()));
      let clicked = false;
      for (const it of items) {
        if (flowVisible(it) && it.textContent.trim().toLowerCase().indexOf(model.toLowerCase()) > -1) {
          flowPointerClick(it);
          const ok = await flowWaitFor(() => flowOpenMenuCount() < 2, 600);
          L("model item clicked:", JSON.stringify(it.textContent.trim()), "-> closed:", ok);
          clicked = true;
          break;
        }
      }
      if (!clicked) L("model item NOT matched for", model);
    } else {
      L("model menu did not open (menu===pop or null); menuCount=", flowOpenMenuCount());
    }
  } else {
    L("model already set or trigger missing");
  }

  L("before close:", JSON.stringify(flowReadPopoverState()));

  // 5. Close
  const closeTrigger = flowSettingsTrigger();
  if (flowPopover() && closeTrigger) {
    flowPointerClick(closeTrigger);
    await flowWaitFor(() => !flowPopover(), 800);
  }
  L("done. closed:", !flowPopover());
}

// Shot path (inject-prompt / auto-generate-shot): aspect ratio comes from the shot.
async function configureFlowOutput(shot) {
  const ar =
    shot?.meta?.aspect_ratio ||
    shot?.nanoBanana?.meta?.ar ||
    shot?.mjPrompt?.meta?.ar ||
    null;
  await flowApplyOutputSettings(ar);
}

// Character-view path: shared.js's inject-text handler calls this when defined
// (mirrors OpenArt's configureCharImageOutput). settings = { aspect_ratio, resolution }.
// After configuring output, attach the character's PRIMARY view as a reference.
async function configureCharImageOutput(settings) {
  flowLog("[Flow] configureCharImageOutput:", settings);
  await flowApplyOutputSettings(settings?.aspect_ratio || null);
  await flowAttachPrimaryReference();
}

// --- Character reference attach (full-auto) ---
//
// Flow only takes references from your collection, which is server-side and
// persistent. We open the reference picker (the composer's add_2 button) and
// REUSE the collection item whose alt == the ref filename; only if it's missing
// do we upload the PRIMARY image (from the platform) under that filename.

// The composer's add-reference control is the button carrying the `add_2` icon.
function flowFindAddReferenceButton() {
  const btns = document.querySelectorAll("button");
  for (const b of btns) {
    if (!flowVisible(b)) continue;
    for (const ic of b.querySelectorAll("i")) {
      if (ic.textContent.trim() === "add_2") return b;
    }
  }
  return null;
}

// The open reference picker is the radix menu / dialog that contains images
// (the settings popover has none).
function flowPickerImages() {
  const menus = document.querySelectorAll('[data-radix-menu-content][data-state="open"], [role="dialog"]');
  for (const m of menus) {
    const imgs = m.querySelectorAll("img");
    if (imgs.length) return imgs;
  }
  return null;
}

// Return the selectable picker item for `alt`. The selectable element is the
// [role="option"] ancestor (carries aria-selected) — NOT the img or its raw
// parent (clicking the parent can land on a generate control).
function flowFindPickerItemByAlt(alt) {
  const imgs = flowPickerImages();
  if (!imgs) return null;
  for (const im of imgs) {
    if ((im.alt || "") === alt) {
      return im.closest('[role="option"]') || im.closest('button, [role="button"], [role="menuitem"]') || im;
    }
  }
  return null;
}

// Return the picker item that IS the image already generated in Flow with this
// resource id (matched off the ?name= in the thumbnail src). Lets us reference an
// existing Flow generation instead of re-uploading a duplicate of it.
function flowFindPickerItemByResourceId(resourceId) {
  if (!resourceId) return null;
  const imgs = flowPickerImages();
  if (!imgs) return null;
  for (const im of imgs) {
    if (flowResourceIdFromUrl(im.src) === resourceId) {
      return im.closest('[role="option"]') || im.closest('button, [role="button"], [role="menuitem"]') || im;
    }
  }
  return null;
}

// The open reference picker container (the radix menu / dialog holding the
// collection thumbnails). Shared by the commit-button + label helpers below.
function flowPickerContainer() {
  const menus = document.querySelectorAll('[data-radix-menu-content][data-state="open"], [role="dialog"]');
  for (const m of menus) {
    if (m.querySelectorAll("img").length) return m;
  }
  return null;
}

// Selected refs are committed by the picker's "Add to Prompt" button — NOT by
// closing the picker (Escape CANCELS the selection). Match it by label.
function flowFindPickerCommitButton() {
  const picker = flowPickerContainer();
  if (!picker) return null;
  for (const b of picker.querySelectorAll("button")) {
    if (flowVisible(b) && /add to prompt/i.test(b.textContent.trim())) return b;
  }
  return null;
}

function flowPickerButtonLabels() {
  const picker = flowPickerContainer();
  if (!picker) return [];
  return Array.prototype.map.call(picker.querySelectorAll("button"), (b) => b.textContent.trim());
}

// Click a filter/source tab inside the open picker (e.g. "Uploads") so we can
// locate a previously-uploaded ref that isn't on the default view.
function flowClickPickerFilter(re) {
  const picker = flowPickerContainer();
  if (!picker) return false;
  for (const b of picker.querySelectorAll("button")) {
    if (flowVisible(b) && re.test(b.textContent.trim())) {
      flowPointerClick(b);
      return true;
    }
  }
  return false;
}

// Look up the character's PRIMARY view and attach its image as a reference.
async function flowAttachPrimaryReference() {
  const target = flowCurrentTarget;
  if (!target || target.type !== "char") return;
  try {
    let char;
    try {
      char = await fetchCharacter(target.project, target.charSlug);
    } catch (e) {
      console.warn("[Flow] character fetch failed:", e.message);
      return;
    }
    const primary = (char.views || []).find((v) => v.primary && v.has_image);
    if (!primary) {
      console.warn("[Flow] no PRIMARY view with an image for", target.charSlug, "- skipping reference");
      return;
    }
    if (primary.slug === target.viewSlug) {
      flowLog("[Flow] injecting the PRIMARY view itself — no self-reference");
      return;
    }
    const imageUrl = await psSW({ type: "get-asset", project: target.project, kind: "char-image", charSlug: target.charSlug, viewSlug: primary.slug })
      .then((r) => (r?.ok ? r.dataUrl : null)).catch(() => null);
    if (!imageUrl) { console.warn("[Flow] primary reference image not in Drive yet"); return; }
    const fileName = `ref-${target.charSlug}-${primary.slug}.jpg`;
    // If the primary view was generated in Flow, its saved ref carries the Flow
    // resource id (?name=…) — so we can reference that existing generation rather
    // than uploading a duplicate.
    const resourceId = flowResourceIdFromUrl(primary.openart_ref);
    await flowAttachReference(imageUrl, fileName, resourceId);
  } catch (err) {
    console.warn("[Flow] primary reference attach error:", err.message);
  }
}

// Attach the ref named `fileName` from Flow's collection. Flow's collection is
// SERVER-SIDE and persists across sessions, so we open the picker and REUSE an
// existing item first — matching either an image already GENERATED in Flow (by
// `resourceId`) or one we uploaded before (by `fileName`). We only upload
// (`imageUrl`) as a last resort. Reusing avoids duplicate collection entries AND
// avoids the composer's file input, which can put Flow into an image→generate
// state.
async function flowAttachReference(imageUrl, fileName, resourceId) {
  const L = (...a) => flowLog("[Flow ref]", ...a);
  const genBaseline = new Set();
  flowGeneratedImages().forEach((im) => { if (im.src) genBaseline.add(im.src); });
  const genStarted = () => flowGeneratedImages().some((im) => im.src && !genBaseline.has(im.src));

  // Match an already-generated Flow image (resourceId) OR a prior upload (alt).
  const findItem = () =>
    flowFindPickerItemByResourceId(resourceId) || flowFindPickerItemByAlt(fileName);

  // 1. Open the picker.
  const addBtn = flowFindAddReferenceButton();
  if (!addBtn) {
    console.warn("[Flow ref] add_2 button not found");
    return false;
  }
  L("1 opening picker:", JSON.stringify(addBtn.textContent.trim()), "| resourceId=", resourceId || "(none)");
  flowPointerClick(addBtn);
  await flowWaitFor(() => flowPickerImages(), 2500);
  L("1b picker open?", !!flowPickerImages(), "| genStarted?", genStarted());

  // 2. Reuse an existing item if present (already-generated or previously
  //    uploaded). Check the default view, then the "Uploads" filter, before
  //    deciding to upload.
  let item = await flowWaitFor(findItem, 1500);
  if (!item && flowClickPickerFilter(/uploads/i)) {
    L("2 not on default view — switching to Uploads filter");
    item = await flowWaitFor(findItem, 2500);
  }

  // 2b. Not in the collection yet → upload it once, then wait for it to appear.
  if (!item) {
    L("2b not in collection — uploading", fileName);
    let blob;
    try {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new Error("image " + r.status);
      blob = await r.blob();
    } catch (e) {
      console.warn("[Flow ref] image fetch failed:", e.message);
      return false;
    }
    const input = document.querySelector('input[type="file"]');
    if (!input) {
      console.warn("[Flow ref] file input not found");
      return false;
    }
    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    item = await flowWaitFor(() => flowFindPickerItemByAlt(fileName), 12000);
    L("2c uploaded; item in picker?", !!item, "| genStarted?", genStarted());
  } else {
    L("2 reusing existing item (no upload)");
  }

  if (!item) {
    console.warn("[Flow ref] item not in picker:", fileName);
    return false;
  }

  // 3. Make sure our option is selected. The picker is a multi-select listbox:
  //    each [role="option"] carries aria-selected, and Flow PRE-SELECTS a
  //    freshly-uploaded item. Clicking an already-selected option toggles it OFF
  //    — so click ONLY when it isn't selected yet.
  const selected = () => item.getAttribute("aria-selected") === "true";
  L("3 item found; aria-selected=", item.getAttribute("aria-selected"));
  if (!selected()) {
    flowPointerClick(item);
    // Selecting can either flip aria-selected (picker stays open) or commit and
    // close immediately — accept either as success.
    await flowWaitFor(() => selected() || !flowPickerImages(), 800);
    L("3a clicked to select -> aria-selected=", item.getAttribute("aria-selected"));
  }

  // 4. Commit the selection via "Add to Prompt". NEVER Escape — it cancels the
  //    whole picker, leaving nothing attached (the original bug).
  if (flowPickerImages()) {
    const commit = flowFindPickerCommitButton();
    if (commit) {
      L("4 committing via:", JSON.stringify(commit.textContent.trim()));
      flowPointerClick(commit);
    } else {
      L("4 commit button NOT found — picker buttons:", JSON.stringify(flowPickerButtonLabels()));
    }
  }
  const closed = await flowWaitFor(() => !flowPickerImages(), 1500);
  L("4b done — picker closed?", closed, "| genStarted?", genStarted());
  return true;
}

// --- Shot elements (named characters) ---
//
// OpenArt's addShotElements selects a shot's `meta.elements` from OpenArt's
// library BY NAME. We do the same on Flow: open the reference picker (add_2),
// switch to the "Characters" category, and select each element by its name.
// These are named characters the user already created in Flow — we do NOT upload
// or fetch any image here (that's flowAttachReference, the character-view path).

// Normalize a name for tolerant matching: lowercase, alphanumerics only. This
// makes the storyboard element token (e.g. "@TowerWorld") match however Flow
// titles the same character ("Tower World", "tower-world", …).
function flowNameKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Every place a picker option might carry its visible name.
function flowOptionLabels(opt) {
  const labels = [];
  const al = opt.getAttribute("aria-label");
  if (al) labels.push(al);
  const tl = opt.getAttribute("title");
  if (tl) labels.push(tl);
  for (const im of opt.querySelectorAll("img")) {
    if (im.alt) labels.push(im.alt);
    if (im.getAttribute("title")) labels.push(im.getAttribute("title"));
  }
  const txt = opt.textContent.trim();
  if (txt) labels.push(txt);
  return labels;
}

// The open picker, found leniently for DIAGNOSTICS only — any visible open
// dialog/menu/listbox that contains options, even without <img> thumbnails (which
// flowPickerContainer requires). Picks the one with the most options.
function flowOpenPickerLoose() {
  const menus = document.querySelectorAll(
    '[data-radix-menu-content][data-state="open"], [role="dialog"], [role="listbox"]'
  );
  let best = null;
  for (const m of menus) {
    if (!flowVisible(m)) continue;
    const n = m.querySelectorAll('[role="option"]').length;
    if (n && (!best || n > best.n)) best = { el: m, n };
  }
  return best ? best.el : null;
}

// Diagnostics: the names of every option currently in the picker.
function flowPickerOptionNames() {
  const picker = flowOpenPickerLoose() || flowPickerContainer();
  if (!picker) return [];
  return Array.prototype.map.call(
    picker.querySelectorAll('[role="option"]'),
    (o) => flowOptionLabels(o)[0] || "(unlabeled)"
  );
}

// Structural dump of the open reference picker, gated behind the debug flag. When
// a character can't be matched even though its name is correct, this reveals how
// Flow actually shapes the picker — which control switches category, and what
// role/markup the item rows use — so the selectors can be fixed precisely.
// Enable: localStorage.setItem("promptsync-debug","1") (then reload).
function flowDumpPickerDiag(tag) {
  if (!flowDebugEnabled()) return;
  const picker =
    flowOpenPickerLoose() ||
    document.querySelector('[role="dialog"], [data-radix-menu-content][data-state="open"]');
  if (!picker) {
    console.log(`[Flow dump:${tag}] no open picker found`);
    return;
  }
  const S = (o) => JSON.stringify(o);
  console.log(`[Flow dump:${tag}] picker <${picker.tagName.toLowerCase()} role=${picker.getAttribute("role")}>`);
  console.log(`[Flow dump:${tag}] category controls:`, S(
    Array.prototype.map.call(
      picker.querySelectorAll('button, [role="tab"], [role="menuitem"]'),
      (c) => (c.textContent || "").trim() || c.getAttribute("aria-label") || "(icon-only)"
    )
  ));
  for (const [k, sel] of [
    ["role=option", '[role="option"]'],
    ["role=menuitemcheckbox", '[role="menuitemcheckbox"]'],
    ["role=checkbox", '[role="checkbox"]'],
    ["role=listitem", '[role="listitem"]'],
    ["img", "img"],
  ]) {
    console.log(`[Flow dump:${tag}] ${k}: ${picker.querySelectorAll(sel).length}`);
  }
  // The items have no ARIA role, so walk up from each <img> to the nearest
  // plausibly-clickable/selectable row and describe it — this is the real tile.
  const rows = Array.prototype.map.call(picker.querySelectorAll("img"), (img) => {
    let el = img, row = null;
    for (let i = 0; i < 7 && el; i++, el = el.parentElement) {
      const role = el.getAttribute && el.getAttribute("role");
      const selectable =
        el.tagName === "BUTTON" || role === "option" || role === "button" ||
        el.getAttribute("aria-selected") != null || el.getAttribute("data-selected") != null ||
        el.getAttribute("aria-checked") != null || el.getAttribute("tabindex") != null;
      if (selectable) { row = el; break; }
    }
    row = row || img.parentElement;
    return {
      imgAlt: img.alt || null,
      rowTag: row.tagName.toLowerCase(),
      rowRole: row.getAttribute("role"),
      ariaSelected: row.getAttribute("aria-selected"),
      ariaChecked: row.getAttribute("aria-checked"),
      dataSelected: row.getAttribute("data-selected"),
      tabindex: row.getAttribute("tabindex"),
      cls: (row.getAttribute("class") || "").slice(0, 60),
      text: (row.textContent || "").trim().slice(0, 50),
    };
  });
  console.log(`[Flow dump:${tag}] image rows:`, S(rows));
}

// The picker option whose name matches `name`: first an exact normalized match
// on any label, then a label that CONTAINS the name (handles "Hale (character)").
function flowFindPickerItemByName(name) {
  const picker = flowPickerContainer();
  if (!picker) return null;
  const want = flowNameKey(name);
  if (!want) return null;
  const opts = picker.querySelectorAll('[role="option"]');
  for (const opt of opts) {
    if (flowOptionLabels(opt).some((l) => flowNameKey(l) === want)) return opt;
  }
  for (const opt of opts) {
    if (flowOptionLabels(opt).some((l) => flowNameKey(l).includes(want))) return opt;
  }
  return null;
}

// The open picker, leniently (any picker-like surface). Used as the open-gate so
// the diagnostic dump runs even when flowPickerContainer's <img> requirement
// isn't met yet.
function flowPickerOpen() {
  return (
    flowPickerContainer() ||
    flowOpenPickerLoose() ||
    document.querySelector('[role="dialog"], [data-radix-menu-content][data-state="open"]')
  );
}

// Close the picker WITHOUT committing (Escape). Safe only when nothing is
// selected — Escape cancels a pending selection.
function flowClosePicker() {
  if (!flowPickerOpen()) return;
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true })
  );
}

// Add ONE named element as a Flow reference. Flow's character picker is
// SINGLE-SELECT per session — selecting a second tile de-selects the first
// (verified live: HaleS0 dropped when Floor1Chamber was clicked) — so each
// element gets its own open -> Characters -> select -> "Add to Prompt" cycle.
// Successive commits APPEND references to the prompt. Returns true if committed.
async function flowAddOneElement(name) {
  const L = (...a) => flowLog("[Flow elems]", ...a);
  const addBtn = flowFindAddReferenceButton();
  if (!addBtn) {
    console.warn("[Flow elems] add_2 button not found");
    return false;
  }
  flowPointerClick(addBtn);
  await flowWaitFor(flowPickerOpen, 2500);
  if (!flowPickerOpen()) {
    console.warn(`[Flow elems] picker did not open for "${name}"`);
    return false;
  }

  // Switch to the Characters category. Require the plural "Characters" so we never
  // match the singular "Character preview" control that also lives in the picker.
  if (flowClickPickerFilter(/characters/i)) {
    await flowWaitFor(() => flowPickerContainer(), 1000);
  } else {
    L(`no Characters category control for "${name}" | buttons:`, JSON.stringify(flowPickerButtonLabels()));
  }
  flowDumpPickerDiag(`add:${name}`);

  // Option tiles render lazily — wait for THIS one to appear.
  const opt = await flowWaitFor(() => flowFindPickerItemByName(name), 2500);
  if (!opt) {
    console.warn(`[Flow elems] "${name}" not found in Characters category — skipping`);
    showToast(`Flow: couldn't find character "${name}" — has: ${flowPickerOptionNames().join(", ") || "(none)"}`, true);
    flowClosePicker();
    await flowWaitFor(() => !flowPickerOpen(), 1000);
    return false;
  }

  if (opt.getAttribute("aria-selected") !== "true") {
    flowPointerClick(opt);
    await flowWaitFor(() => opt.getAttribute("aria-selected") === "true" || !flowPickerContainer(), 800);
  }
  L("selected", JSON.stringify(name), "-> aria-selected=", opt.getAttribute("aria-selected"));

  // Commit THIS selection before reopening for the next element.
  if (flowPickerContainer()) {
    const commit = flowFindPickerCommitButton();
    if (commit) {
      L("committing", JSON.stringify(name), "via:", JSON.stringify(commit.textContent.trim()));
      flowPointerClick(commit);
    } else {
      L(`commit button NOT found for "${name}" | buttons:`, JSON.stringify(flowPickerButtonLabels()));
    }
  }
  const closed = await flowWaitFor(() => !flowPickerContainer(), 1500);
  L("added", JSON.stringify(name), "-> picker closed:", closed);
  return true;
}

// Attach the shot's named elements as Flow references — the equivalent of
// OpenArt's addShotElements. Flow's picker is single-select, so each element is
// added in its own commit cycle (see flowAddOneElement).
async function flowAttachShotElements(shot) {
  const L = (...a) => flowLog("[Flow elems]", ...a);
  const names = (shot?.meta?.elements || [])
    .map((e) => String(e).replace(/^@/, "").trim())
    .filter(Boolean);
  if (!names.length) {
    L("no elements on shot");
    return;
  }
  L("attaching shot elements (one commit each):", names);
  for (const name of names) {
    await flowAddOneElement(name);
  }
  L("done attaching", names.length, "element(s).");
}

// --- Main injection (called by shared.js handleInject) ---

function injectIntoPage(prompt, shot, project) {
  if (flowOnCharactersTab()) {
    console.warn("[PromptSync] On Flow's Characters tab — skipping injection so the prompt doesn't entangle with the character definition.");
    if (typeof showToast === "function") showToast("On Flow's Characters tab — switch to image generation first", true);
    return false;
  }
  if (!findFlowEditor()) {
    console.warn("[PromptSync] Google Flow editor not found");
    return false;
  }

  if (shot && shot.code) {
    flowCurrentTarget = { type: "shot", project, code: shot.code };
  }
  // Remember the prompt for this target so the Create-click arm can carry it for
  // content-based correlation in the MAIN world.
  flowCurrentPrompt = prompt || "";

  flowLog("[Flow] injectIntoPage: hasShot=", !!shot, "code=", shot?.code,
    "ar=", shot?.meta?.aspect_ratio, "promptLen=", (prompt || "").length);

  // Serialize on the shared queue so rapid injections don't interleave.
  _ps.queue = _ps.queue.then(async () => {
    try {
      flowLog("[Flow] queue: setting prompt…");
      await flowSetPrompt(prompt);
      flowLog("[Flow] queue: prompt done, configuring output…");
      if (shot) await configureFlowOutput(shot);
      flowLog("[Flow] queue: output done, selecting shot elements…");
      if (shot) await flowAttachShotElements(shot);
      flowLog("[Flow] queue: complete");
    } catch (err) {
      console.error("[Flow] injection error:", err);
    }
  });

  return true;
}

// --- Generation trigger + auto-download ---

// Keep flowCurrentTarget in sync with the authoritative shot code shared.js sends.
window.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || typeof d !== "object") return;
  if (d.type === "promptsync-set-target") {
    flowCurrentTarget = d.target;
  } else if (d.type === "promptsync-generation-start" && d.target) {
    // Relay from the MAIN-world correlator to the side panel, which shows the
    // orbiting "generating" indicator on the matching thumbnail.
    try {
      chrome.runtime.sendMessage({ type: "generation-start", target: d.target, isVideo: !!d.isVideo });
    } catch (e) {}
  }
});

// Finished images in the chat view are <img alt="Generated image">. Exclude the
// reference picker / menus / dialogs, whose collection thumbnails carry the same
// alt and would otherwise be mistaken for fresh results.
function flowGeneratedImages() {
  return Array.prototype.filter.call(
    document.querySelectorAll('img[alt="Generated image"]'),
    (im) => !im.closest('[data-radix-menu-content], [role="dialog"], [role="menu"]')
  );
}

function flowFindCreateButton() {
  const btns = document.querySelectorAll("button");
  for (const btn of btns) {
    if (!flowVisible(btn)) continue;
    const icons = btn.querySelectorAll("i");
    for (const ic of icons) {
      if (ic.textContent.trim() === "arrow_forward") return btn;
    }
  }
  return null;
}

// The result <img> src is a same-origin redirect whose ?name= param is the media
// id — reused as the dedupe key / provenance ref.
function flowResourceIdFromUrl(url) {
  const m = /[?&]name=([^&]+)/.exec(url || "");
  return m ? decodeURIComponent(m[1]) : null;
}

// Auto-download correlation now lives in the MAIN world (googleflow-page.js),
// which sees Flow's generation network calls. The old isolated-world approach —
// watch the DOM for new "Generated image" tiles and assign them to a FIFO of
// pending targets — mixed up CONCURRENT runs, because it paired by COMPLETION
// order and generations finish out of order. Mirroring OpenArt's resourceId→target
// map, we instead bind each shot to its generation REQUEST (armed below at the
// Create click) and download from that request's RESPONSE (media[].name == the
// result image's ?name=), so completion order no longer matters.

// On Create (arrow_forward), arm the MAIN-world correlator with the current target.
// FIFO by request order: each click arms one target, consumed by the next
// generation request. shared.js handles the resulting promptsync-auto-download-ready.
let flowCreateListenerInstalled = false;
function flowInstallCreateListener() {
  if (flowCreateListenerInstalled) return;
  flowCreateListenerInstalled = true;
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target?.closest?.("button");
      if (!btn) return;
      // On Flow's Characters tab a stray arrow_forward would arm a bogus target;
      // don't correlate anything there.
      if (flowOnCharactersTab()) return;
      for (const ic of btn.querySelectorAll("i")) {
        if (ic.textContent.trim() === "arrow_forward") {
          flowLog(
            "[Flow create] Create clicked; arming target", flowCurrentTarget && flowCurrentTarget.code,
            "| isTrusted=", e.isTrusted
          );
          window.postMessage({ type: "promptsync-flow-arm", target: flowCurrentTarget, prompt: flowCurrentPrompt }, "*");
          return;
        }
      }
    },
    true
  );
}
flowInstallCreateListener();

// Click Create. Named to match the OpenArt content script so shared.js's
// handleAutoGenerateShot works on Flow unchanged. The download is handled in the
// MAIN world by correlating the generation request to its response, so this just
// clicks (the arm above runs from the resulting click event).
async function clickGenerateButton() {
  if (flowOnCharactersTab()) {
    console.warn("[PromptSync] On Flow's Characters tab — skipping generation.");
    if (typeof showToast === "function") showToast("On Flow's Characters tab — switch to image generation first", true);
    return false;
  }
  const btn = flowFindCreateButton();
  if (!btn) {
    console.warn("[PromptSync] Flow Create button not found");
    return false;
  }
  flowPointerClick(btn);
  flowLog("[PromptSync] Flow Create clicked");
  return true;
}
