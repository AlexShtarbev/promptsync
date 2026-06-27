// Character & World selection for OpenArt create-image page.
// Handles opening the C&W panel, clearing existing selections,
// and selecting characters/worlds by name via checkbox click.

// eslint-disable-next-line no-unused-vars
var createImageCharacters = (function () {
  function waitFor(conditionFn, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const result = conditionFn();
        if (result) return resolve(result);
        if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timeout"));
        requestAnimationFrame(check);
      };
      check();
    });
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function isChecked(checkbox) {
    return (
      checkbox.getAttribute("data-state") === "checked" ||
      checkbox.getAttribute("aria-checked") === "true"
    );
  }

  function getCounter() {
    const els = document.querySelectorAll("p, span");
    for (const el of els) {
      const t = el.textContent.trim();
      if (/^\d+\/\d+$/.test(t) && el.getBoundingClientRect().x < 720) return t;
    }
    return null;
  }

  function getCounterValue() {
    const c = getCounter();
    return c ? parseInt(c.split("/")[0]) : 0;
  }

  function getCWCards() {
    const cards = [];
    const nameDivs = document.querySelectorAll(
      "div.flex.items-center.justify-center p"
    );
    for (const p of nameDivs) {
      const name = p.textContent.trim();
      if (!name || name.length > 30) continue;
      const nameContainer = p.parentElement;
      const card = nameContainer?.parentElement;
      if (!card) continue;
      const r = card.getBoundingClientRect();
      if (r.x < 740 || r.y < 270 || r.width < 80 || r.width > 200) continue;
      const checkbox = card.querySelector('button[role="checkbox"]');
      if (!checkbox) continue;
      cards.push({ name, card, checkbox });
    }
    return cards;
  }

  function getSelectedRefsInPromptArea() {
    const grid = document.querySelector("div.grid.gap-1");
    if (!grid) return [];
    const r = grid.getBoundingClientRect();
    if (r.x > 720) return [];
    const names = [];
    const ps = grid.querySelectorAll("p");
    for (const p of ps) {
      const t = p.textContent.trim();
      if (t.startsWith("@")) names.push(t.slice(1).trim());
    }
    return names;
  }

  function isPanelOpen() {
    const radios = document.querySelectorAll('button[role="radio"]');
    for (const radio of radios) {
      if (
        radio.textContent.trim() === "Characters & Worlds" &&
        radio.getAttribute("data-state") === "checked"
      )
        return true;
    }
    return false;
  }

  function findTriggerButton() {
    const btns = document.querySelectorAll("button");
    for (const btn of btns) {
      if (btn.textContent.trim() !== "Characters & Worlds") continue;
      if (!isVisible(btn)) continue;
      const r = btn.getBoundingClientRect();
      if (r.width < 50 || r.x > 720) continue;
      return btn;
    }
    return null;
  }

  async function openPanel() {
    if (isPanelOpen()) return true;
    const trigger = findTriggerButton();
    if (!trigger) { console.warn("[PromptSync:CW] trigger button not found"); return false; }
    trigger.click();
    try {
      await waitFor(() => isPanelOpen(), 5000);
      return true;
    } catch {
      console.warn("[PromptSync:CW] panel did not open after click");
      return false;
    }
  }

  function findPanelCloseButton() {
    const btns = document.querySelectorAll('button[aria-label="Close"]');
    for (const btn of btns) {
      const r = btn.getBoundingClientRect();
      if (r.x > 720 && r.y < 150 && r.width > 0) return btn;
    }
    return null;
  }

  async function closePanel() {
    if (!isPanelOpen()) return;
    const closeBtn = findPanelCloseButton();
    if (closeBtn) {
      closeBtn.click();
      try {
        await waitFor(() => !isPanelOpen(), 3000);
      } catch {
        // panel didn't close, not critical
      }
      return;
    }
    // Fallback: try trigger button
    const trigger = findTriggerButton();
    if (trigger) trigger.click();
  }

  function ensureMyLibraryTab() {
    const tabs = document.querySelectorAll('button[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent.trim() !== "My Library") continue;
      if (tab.getAttribute("data-state") === "active") return true;
      tab.click();
      return true;
    }
    return false;
  }

  async function uncheckAll() {
    while (true) {
      const before = getCounterValue();
      if (before === 0) break;
      const cards = getCWCards();
      const checked = cards.find((c) => isChecked(c.checkbox));
      if (!checked) break;
      checked.checkbox.click();
      try {
        await waitFor(() => getCounterValue() < before, 2000);
      } catch {
        break;
      }
    }
  }

  async function selectByNames(names) {
    for (const target of names) {
      const lower = target.toLowerCase().replace(/^@/, "");
      const cards = getCWCards();
      const match = cards.find((c) => c.name.toLowerCase() === lower);
      if (!match) { console.warn("[PromptSync:CW] card not found:", target); continue; }
      if (isChecked(match.checkbox)) continue;
      const before = getCounterValue();
      match.checkbox.click();
      try {
        await waitFor(() => getCounterValue() > before, 2000);
      } catch {
        console.warn("[PromptSync:CW] select timeout:", target);
      }
    }
  }

  function verifySelection(targetNames) {
    const refs = getSelectedRefsInPromptArea();
    const refsLower = refs.map((r) => r.toLowerCase());
    for (const name of targetNames) {
      const lower = name.toLowerCase().replace(/^@/, "");
      if (!refsLower.includes(lower)) return false;
    }
    return true;
  }

  async function selectCharacters(targetNames) {
    const opened = await openPanel();
    if (!opened) return false;
    ensureMyLibraryTab();
    try {
      await waitFor(() => getCWCards().length > 0, 3000);
    } catch {
      console.warn("[PromptSync:CW] cards never appeared after panel open");
      await closePanel();
      return false;
    }
    await uncheckAll();
    if (targetNames && targetNames.length) {
      await selectByNames(targetNames);
      try {
        await waitFor(() => verifySelection(targetNames), 3000);
      } catch {
        console.warn("[PromptSync:CW] verification timed out");
      }
    }
    await closePanel();
    return true;
  }

  return {
    selectCharacters,
    openPanel,
    closePanel,
    uncheckAll,
    selectByNames,
    // Exposed for testing
    _internal: {
      isChecked,
      isVisible,
      getCWCards,
      getCounter,
      getCounterValue,
      getSelectedRefsInPromptArea,
      isPanelOpen,
      findTriggerButton,
      ensureMyLibraryTab,
      verifySelection,
      waitFor,
    },
  };
})();
