import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE = readFileSync(
  resolve(__dirname, "../content/create-image-characters.js"),
  "utf-8"
);

// Minimal DOM setup matching OpenArt's C&W panel structure
function buildDOM({ characters = [], checkedNames = [], panelOpen = true }) {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://openart.ai/create-image",
  });
  const doc = dom.window.document;

  // Stub getComputedStyle
  dom.window.getComputedStyle = () => ({ display: "block", visibility: "visible" });

  // Stub requestAnimationFrame as synchronous for tests
  dom.window.requestAnimationFrame = (fn) => setTimeout(fn, 0);

  // --- Left panel: trigger button + counter ---
  const leftPanel = doc.createElement("div");
  leftPanel.style.cssText = "position:absolute;left:0;top:0;width:700px;";

  const triggerBtn = doc.createElement("button");
  triggerBtn.textContent = "Characters & Worlds";
  triggerBtn.style.cssText = "width:213px;height:58px;";
  triggerBtn.getBoundingClientRect = () => ({ x: 491, y: 353, width: 213, height: 58, left: 491, top: 353, right: 704, bottom: 411 });
  leftPanel.appendChild(triggerBtn);

  const counterEl = doc.createElement("p");
  const checkedCount = checkedNames.length;
  counterEl.textContent = `${checkedCount}/${characters.length}`;
  counterEl.getBoundingClientRect = () => ({ x: 672, y: 355, width: 23, height: 16, left: 672, top: 355, right: 695, bottom: 371 });
  leftPanel.appendChild(counterEl);

  // Prompt area grid: shows selected character refs as @Name badges
  const refGrid = doc.createElement("div");
  refGrid.className = "grid gap-1";
  refGrid.getBoundingClientRect = () => ({ x: 491, y: 420, width: 213, height: 80, left: 491, top: 420, right: 704, bottom: 500 });
  leftPanel.appendChild(refGrid);

  // Sync refGrid contents when counter changes
  function syncRefGrid() {
    refGrid.innerHTML = "";
    for (const char of characters) {
      const cardEl = [...rightPanel?.querySelectorAll?.('button[role="checkbox"]') || []];
      // Find checkbox for this character
      const allCards = doc.querySelectorAll("div.flex.items-center.justify-center p");
      for (const p of allCards) {
        if (p.textContent.trim() !== char) continue;
        const card = p.parentElement?.parentElement;
        if (!card) continue;
        const cb = card.querySelector('button[role="checkbox"]');
        if (cb && (cb.getAttribute("data-state") === "checked" || cb.getAttribute("aria-checked") === "true")) {
          const refCard = doc.createElement("div");
          const refP = doc.createElement("p");
          refP.textContent = `@${char} `;
          refCard.appendChild(refP);
          refGrid.appendChild(refCard);
        }
      }
    }
  }

  doc.body.appendChild(leftPanel);

  // --- Right panel: radio + tab + cards ---
  const rightPanel = doc.createElement("div");
  rightPanel.style.cssText = "position:absolute;left:740px;top:0;";

  // Radio: "Characters & Worlds"
  const cwRadio = doc.createElement("button");
  cwRadio.setAttribute("role", "radio");
  cwRadio.textContent = "Characters & Worlds";
  cwRadio.setAttribute("data-state", panelOpen ? "checked" : "unchecked");
  cwRadio.setAttribute("aria-checked", panelOpen ? "true" : "false");
  cwRadio.getBoundingClientRect = () => ({ x: 752, y: 126, width: 385, height: 74, left: 752, top: 126, right: 1137, bottom: 200 });
  cwRadio.addEventListener("click", () => {
    cwRadio.setAttribute("data-state", "checked");
    cwRadio.setAttribute("aria-checked", "true");
  });
  rightPanel.appendChild(cwRadio);

  // Radio: "Image"
  const imgRadio = doc.createElement("button");
  imgRadio.setAttribute("role", "radio");
  imgRadio.textContent = "Image";
  imgRadio.setAttribute("data-state", panelOpen ? "unchecked" : "checked");
  imgRadio.setAttribute("aria-checked", panelOpen ? "false" : "true");
  imgRadio.getBoundingClientRect = () => ({ x: 1139, y: 126, width: 385, height: 74, left: 1139, top: 126, right: 1524, bottom: 200 });
  rightPanel.appendChild(imgRadio);

  // Close button (top-right of panel)
  const closeBtn = doc.createElement("button");
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.getBoundingClientRect = () => ({ x: 1486, y: 77, width: 32, height: 32, left: 1486, top: 77, right: 1518, bottom: 109 });
  closeBtn.addEventListener("click", () => {
    cwRadio.setAttribute("data-state", "unchecked");
    cwRadio.setAttribute("aria-checked", "false");
  });
  rightPanel.appendChild(closeBtn);

  // Tab: "My Library"
  const myLibTab = doc.createElement("button");
  myLibTab.setAttribute("role", "tab");
  myLibTab.textContent = "My Library";
  myLibTab.setAttribute("data-state", "active");
  myLibTab.getBoundingClientRect = () => ({ x: 752, y: 234, width: 81, height: 32, left: 752, top: 234, right: 833, bottom: 266 });
  rightPanel.appendChild(myLibTab);

  // Character cards
  let xOffset = 750;
  for (const charName of characters) {
    const card = doc.createElement("div");
    card.className = "flex flex-col gap-[4px]";
    const cardX = xOffset;
    card.getBoundingClientRect = () => ({ x: cardX, y: 291, width: 126, height: 162, left: cardX, top: 291, right: cardX + 126, bottom: 453 });

    // Image
    const imgWrapper = doc.createElement("div");
    imgWrapper.className = "relative";
    const img = doc.createElement("img");
    img.alt = charName;
    img.src = `https://cdn.openart.ai/thumb/${charName.toLowerCase()}.webp`;
    imgWrapper.appendChild(img);

    // Checkbox
    const checkbox = doc.createElement("button");
    checkbox.setAttribute("role", "checkbox");
    const isInitiallyChecked = checkedNames.includes(charName);
    checkbox.setAttribute("data-state", isInitiallyChecked ? "checked" : "unchecked");
    checkbox.setAttribute("aria-checked", isInitiallyChecked ? "true" : "false");
    checkbox.addEventListener("click", () => {
      const wasChecked = checkbox.getAttribute("data-state") === "checked";
      checkbox.setAttribute("data-state", wasChecked ? "unchecked" : "checked");
      checkbox.setAttribute("aria-checked", wasChecked ? "false" : "true");
      // Update counter
      const current = parseInt(counterEl.textContent.split("/")[0]);
      const total = parseInt(counterEl.textContent.split("/")[1]);
      counterEl.textContent = `${wasChecked ? current - 1 : current + 1}/${total}`;
      syncRefGrid();
    });
    imgWrapper.appendChild(checkbox);
    card.appendChild(imgWrapper);

    // Name label
    const nameDiv = doc.createElement("div");
    nameDiv.className = "flex items-center justify-center";
    const nameP = doc.createElement("p");
    nameP.textContent = charName;
    nameDiv.appendChild(nameP);
    card.appendChild(nameDiv);

    rightPanel.appendChild(card);
    xOffset += 130;
  }

  doc.body.appendChild(rightPanel);

  // Wire trigger button to toggle panel (simulates OpenArt behavior)
  triggerBtn.addEventListener("click", () => {
    const isOpen = cwRadio.getAttribute("data-state") === "checked";
    cwRadio.setAttribute("data-state", isOpen ? "unchecked" : "checked");
    cwRadio.setAttribute("aria-checked", isOpen ? "false" : "true");
  });

  // Initialize refGrid for pre-checked characters
  syncRefGrid();

  return { dom, doc, counterEl, triggerBtn, cwRadio };
}

function loadModule(dom) {
  const { window } = dom;

  global.document = window.document;
  global.getComputedStyle = window.getComputedStyle;
  global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

  // eslint-disable-next-line no-eval
  const mod = eval(MODULE_SOURCE + "\ncreateImageCharacters;");
  return mod;
}

describe("getCWCards", () => {
  test("finds cards scoped to panel area", () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain"],
    });
    const mod = loadModule(dom);
    const cards = mod._internal.getCWCards();
    assert.equal(cards.length, 3);
    assert.deepEqual(
      cards.map((c) => c.name),
      ["Sisyphus", "Boulder", "Mountain"]
    );
  });

  test("ignores cards outside panel bounds", () => {
    const { dom, doc } = buildDOM({ characters: ["Sisyphus"] });

    // Add a card at x=200 (left of panel threshold)
    const fakeCard = doc.createElement("div");
    fakeCard.className = "flex flex-col gap-[4px]";
    fakeCard.getBoundingClientRect = () => ({ x: 200, y: 291, width: 126, height: 162, left: 200, top: 291, right: 326, bottom: 453 });
    const nameDiv = doc.createElement("div");
    nameDiv.className = "flex items-center justify-center";
    const nameP = doc.createElement("p");
    nameP.textContent = "FakeChar";
    nameDiv.appendChild(nameP);
    fakeCard.appendChild(nameDiv);
    const cb = doc.createElement("button");
    cb.setAttribute("role", "checkbox");
    cb.setAttribute("data-state", "unchecked");
    fakeCard.appendChild(cb);
    doc.body.appendChild(fakeCard);

    const mod = loadModule(dom);
    const cards = mod._internal.getCWCards();
    assert.equal(cards.length, 1);
    assert.equal(cards[0].name, "Sisyphus");
  });

  test("ignores names longer than 30 characters", () => {
    const { dom } = buildDOM({
      characters: ["A".repeat(31)],
    });
    const mod = loadModule(dom);
    const cards = mod._internal.getCWCards();
    assert.equal(cards.length, 0);
  });
});

describe("isChecked", () => {
  test("detects data-state=checked", () => {
    const { dom } = buildDOM({ characters: ["Sisyphus"], checkedNames: ["Sisyphus"] });
    const mod = loadModule(dom);
    const cards = mod._internal.getCWCards();
    assert.equal(mod._internal.isChecked(cards[0].checkbox), true);
  });

  test("detects unchecked state", () => {
    const { dom } = buildDOM({ characters: ["Sisyphus"], checkedNames: [] });
    const mod = loadModule(dom);
    const cards = mod._internal.getCWCards();
    assert.equal(mod._internal.isChecked(cards[0].checkbox), false);
  });
});

describe("getCounter", () => {
  test("reads counter from DOM", () => {
    const { dom } = buildDOM({ characters: ["A", "B", "C"], checkedNames: ["A"] });
    const mod = loadModule(dom);
    assert.equal(mod._internal.getCounter(), "1/3");
    assert.equal(mod._internal.getCounterValue(), 1);
  });

  test("returns 0 when nothing checked", () => {
    const { dom } = buildDOM({ characters: ["A", "B"], checkedNames: [] });
    const mod = loadModule(dom);
    assert.equal(mod._internal.getCounterValue(), 0);
  });
});

describe("isPanelOpen", () => {
  test("true when C&W radio is checked", () => {
    const { dom } = buildDOM({ characters: [], panelOpen: true });
    const mod = loadModule(dom);
    assert.equal(mod._internal.isPanelOpen(), true);
  });

  test("false when C&W radio is unchecked", () => {
    const { dom } = buildDOM({ characters: [], panelOpen: false });
    const mod = loadModule(dom);
    assert.equal(mod._internal.isPanelOpen(), false);
  });
});

describe("findTriggerButton", () => {
  test("finds trigger button in left panel area", () => {
    const { dom } = buildDOM({ characters: [] });
    const mod = loadModule(dom);
    const btn = mod._internal.findTriggerButton();
    assert.ok(btn);
    assert.equal(btn.textContent.trim(), "Characters & Worlds");
  });
});

describe("uncheckAll", () => {
  test("unchecks all checked cards", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain"],
      checkedNames: ["Sisyphus", "Mountain"],
    });
    const mod = loadModule(dom);

    assert.equal(mod._internal.getCounterValue(), 2);
    await mod.uncheckAll();
    assert.equal(mod._internal.getCounterValue(), 0);

    const cards = mod._internal.getCWCards();
    for (const c of cards) {
      assert.equal(mod._internal.isChecked(c.checkbox), false);
    }
  });

  test("does nothing when none checked", async () => {
    const { dom } = buildDOM({ characters: ["A", "B"], checkedNames: [] });
    const mod = loadModule(dom);
    await mod.uncheckAll();
    assert.equal(mod._internal.getCounterValue(), 0);
  });
});

describe("selectByNames", () => {
  test("selects specified characters", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain"],
      checkedNames: [],
    });
    const mod = loadModule(dom);

    await mod.selectByNames(["Sisyphus", "Mountain"]);

    assert.equal(mod._internal.getCounterValue(), 2);
    const cards = mod._internal.getCWCards();
    const sisyphus = cards.find((c) => c.name === "Sisyphus");
    const mountain = cards.find((c) => c.name === "Mountain");
    const boulder = cards.find((c) => c.name === "Boulder");
    assert.equal(mod._internal.isChecked(sisyphus.checkbox), true);
    assert.equal(mod._internal.isChecked(mountain.checkbox), true);
    assert.equal(mod._internal.isChecked(boulder.checkbox), false);
  });

  test("handles @ prefix in names", async () => {
    const { dom } = buildDOM({ characters: ["Sisyphus"], checkedNames: [] });
    const mod = loadModule(dom);
    await mod.selectByNames(["@Sisyphus"]);
    assert.equal(mod._internal.getCounterValue(), 1);
  });

  test("skips names not found in library", async () => {
    const { dom } = buildDOM({ characters: ["Sisyphus"], checkedNames: [] });
    const mod = loadModule(dom);
    await mod.selectByNames(["NonExistent", "Sisyphus"]);
    assert.equal(mod._internal.getCounterValue(), 1);
  });

  test("skips already checked characters", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder"],
      checkedNames: ["Sisyphus"],
    });
    const mod = loadModule(dom);
    await mod.selectByNames(["Sisyphus", "Boulder"]);
    assert.equal(mod._internal.getCounterValue(), 2);
  });
});

describe("selectCharacters (end-to-end)", () => {
  test("opens panel, clears, selects targets, closes panel", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain", "Golgotha"],
      checkedNames: ["Boulder", "Golgotha"],
      panelOpen: true,
    });
    const mod = loadModule(dom);

    const result = await mod.selectCharacters(["Sisyphus", "Mountain"]);
    assert.equal(result, true);
    assert.equal(mod._internal.getCounterValue(), 2);
    assert.equal(mod._internal.isPanelOpen(), false);
  });

  test("clears all when no targets provided", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder"],
      checkedNames: ["Sisyphus", "Boulder"],
      panelOpen: true,
    });
    const mod = loadModule(dom);

    await mod.selectCharacters([]);
    assert.equal(mod._internal.getCounterValue(), 0);
  });

  test("opens panel when closed, closes after selection", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus"],
      checkedNames: [],
      panelOpen: false,
    });
    const mod = loadModule(dom);

    assert.equal(mod._internal.isPanelOpen(), false);
    const result = await mod.selectCharacters(["Sisyphus"]);
    assert.equal(result, true);
    assert.equal(mod._internal.getCounterValue(), 1);
    // Panel should be closed after selectCharacters completes
    assert.equal(mod._internal.isPanelOpen(), false);
  });

  test("returns false when no trigger button exists", async () => {
    const { dom, doc } = buildDOM({
      characters: ["Sisyphus"],
      checkedNames: [],
      panelOpen: false,
    });
    // Remove the trigger button
    const trigger = doc.querySelector("button");
    trigger.remove();

    const mod = loadModule(dom);
    const result = await mod.selectCharacters(["Sisyphus"]);
    assert.equal(result, false);
  });
});

describe("selectCharacters waits for cards to render", () => {
  test("waits for cards to appear after panel opens", async () => {
    const { dom, doc } = buildDOM({
      characters: [],
      checkedNames: [],
      panelOpen: true,
    });

    // Cards appear after a delay (simulating React render lag)
    const rightPanel = doc.body.children[1];
    setTimeout(() => {
      const chars = ["Sisyphus", "Boulder"];
      let xOffset = 750;
      const counterEl = doc.querySelector("p");
      counterEl.textContent = `0/${chars.length}`;

      for (const charName of chars) {
        const card = doc.createElement("div");
        card.className = "flex flex-col gap-[4px]";
        const cardX = xOffset;
        card.getBoundingClientRect = () => ({ x: cardX, y: 291, width: 126, height: 162, left: cardX, top: 291, right: cardX + 126, bottom: 453 });

        const imgWrapper = doc.createElement("div");
        imgWrapper.className = "relative";
        const checkbox = doc.createElement("button");
        checkbox.setAttribute("role", "checkbox");
        checkbox.setAttribute("data-state", "unchecked");
        checkbox.setAttribute("aria-checked", "false");
        checkbox.addEventListener("click", () => {
          const wasChecked = checkbox.getAttribute("data-state") === "checked";
          checkbox.setAttribute("data-state", wasChecked ? "unchecked" : "checked");
          checkbox.setAttribute("aria-checked", wasChecked ? "false" : "true");
          const current = parseInt(counterEl.textContent.split("/")[0]);
          const total = parseInt(counterEl.textContent.split("/")[1]);
          counterEl.textContent = `${wasChecked ? current - 1 : current + 1}/${total}`;
        });
        imgWrapper.appendChild(checkbox);
        card.appendChild(imgWrapper);

        const nameDiv = doc.createElement("div");
        nameDiv.className = "flex items-center justify-center";
        const nameP = doc.createElement("p");
        nameP.textContent = charName;
        nameDiv.appendChild(nameP);
        card.appendChild(nameDiv);

        rightPanel.appendChild(card);
        xOffset += 130;
      }
    }, 50);

    const mod = loadModule(dom);
    const result = await mod.selectCharacters(["Sisyphus"]);
    assert.equal(result, true);
    assert.equal(mod._internal.getCounterValue(), 1);
  });

  test("returns false if cards never appear", async () => {
    const { dom } = buildDOM({
      characters: [],
      checkedNames: [],
      panelOpen: true,
    });
    const mod = loadModule(dom);

    // Override waitFor timeout to be short for this test
    const result = await mod.selectCharacters(["Sisyphus"]);
    assert.equal(result, false);
  });
});

describe("selectCharacters replaces previous selection", () => {
  test("clears old selection before applying new one", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain", "Golgotha"],
      checkedNames: ["Sisyphus", "Boulder"],
      panelOpen: true,
    });
    const mod = loadModule(dom);

    assert.equal(mod._internal.getCounterValue(), 2);
    await mod.selectCharacters(["Golgotha"]);
    assert.equal(mod._internal.getCounterValue(), 1);

    const cards = mod._internal.getCWCards();
    const golgotha = cards.find((c) => c.name === "Golgotha");
    const sisyphus = cards.find((c) => c.name === "Sisyphus");
    const boulder = cards.find((c) => c.name === "Boulder");
    assert.equal(mod._internal.isChecked(golgotha.checkbox), true);
    assert.equal(mod._internal.isChecked(sisyphus.checkbox), false);
    assert.equal(mod._internal.isChecked(boulder.checkbox), false);
  });

  test("case-insensitive matching", async () => {
    const { dom } = buildDOM({
      characters: ["Mary_Present", "Tomb_Exterior"],
      checkedNames: [],
      panelOpen: true,
    });
    const mod = loadModule(dom);

    await mod.selectCharacters(["mary_present", "TOMB_EXTERIOR"]);
    assert.equal(mod._internal.getCounterValue(), 2);
  });
});

describe("deriveElementsFromPrompt", () => {
  function deriveElementsFromPrompt(shot) {
    const body = shot.mjPrompt?.body || "";
    if (!body) return shot.meta?.elements || [];
    const allElements = shot.meta?.elements || [];
    const mentioned = new Set();
    for (const el of allElements) {
      if (
        body.includes(`@${el} `) ||
        body.includes(`@${el}\n`) ||
        body.includes(`@${el}'s`) ||
        body.includes(`@${el}.`) ||
        body.includes(`@${el},`) ||
        body.includes(`@${el}:`)
      ) {
        mentioned.add(el);
      }
    }
    if (!mentioned.size) return allElements;
    return [...mentioned];
  }

  test("returns all elements when none are mentioned in prompt", () => {
    const shot = {
      mjPrompt: { body: "A wide landscape shot." },
      meta: { elements: ["Sisyphus", "Boulder"] },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["Sisyphus", "Boulder"]);
  });

  test("returns only mentioned elements", () => {
    const shot = {
      mjPrompt: { body: "@Sisyphus pushes the rock up @Mountain terrain." },
      meta: { elements: ["Sisyphus", "Boulder", "Mountain"] },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result.sort(), ["Mountain", "Sisyphus"]);
  });

  test("handles possessive form", () => {
    const shot = {
      mjPrompt: { body: "@Sisyphus's face shows determination." },
      meta: { elements: ["Sisyphus", "Boulder"] },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["Sisyphus"]);
  });

  test("returns all elements when no prompt body", () => {
    const shot = { mjPrompt: null, meta: { elements: ["A", "B"] } };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["A", "B"]);
  });
});

describe("getSelectedRefsInPromptArea", () => {
  test("reads @-prefixed names from the grid", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain"],
      checkedNames: ["Sisyphus", "Mountain"],
      panelOpen: true,
    });
    const mod = loadModule(dom);
    const refs = mod._internal.getSelectedRefsInPromptArea();
    assert.deepEqual(refs.sort(), ["Mountain", "Sisyphus"]);
  });

  test("returns empty when nothing selected", () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder"],
      checkedNames: [],
      panelOpen: true,
    });
    const mod = loadModule(dom);
    const refs = mod._internal.getSelectedRefsInPromptArea();
    assert.deepEqual(refs, []);
  });
});

describe("verifySelection", () => {
  test("returns true when all targets are in prompt area", () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain"],
      checkedNames: ["Sisyphus", "Mountain"],
      panelOpen: true,
    });
    const mod = loadModule(dom);
    assert.equal(mod._internal.verifySelection(["Sisyphus", "Mountain"]), true);
  });

  test("returns false when a target is missing", () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus", "Boulder", "Mountain"],
      checkedNames: ["Sisyphus"],
      panelOpen: true,
    });
    const mod = loadModule(dom);
    assert.equal(mod._internal.verifySelection(["Sisyphus", "Mountain"]), false);
  });

  test("is case-insensitive", () => {
    const { dom } = buildDOM({
      characters: ["Mary_Present"],
      checkedNames: ["Mary_Present"],
      panelOpen: true,
    });
    const mod = loadModule(dom);
    assert.equal(mod._internal.verifySelection(["mary_present"]), true);
  });
});

describe("closePanel", () => {
  test("closes an open panel", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus"],
      checkedNames: [],
      panelOpen: true,
    });
    const mod = loadModule(dom);
    assert.equal(mod._internal.isPanelOpen(), true);
    await mod.closePanel();
    assert.equal(mod._internal.isPanelOpen(), false);
  });

  test("does nothing when panel already closed", async () => {
    const { dom } = buildDOM({
      characters: ["Sisyphus"],
      checkedNames: [],
      panelOpen: false,
    });
    const mod = loadModule(dom);
    assert.equal(mod._internal.isPanelOpen(), false);
    await mod.closePanel();
    assert.equal(mod._internal.isPanelOpen(), false);
  });
});
