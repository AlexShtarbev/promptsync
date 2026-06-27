// Midjourney prompt injection (midjourney.com)

function findMjInput() {
  // Priority 1: MJ's chat input (specific selectors first)
  const specific = [
    'textarea[placeholder*="Imagine"]',
    'textarea[placeholder*="imagine"]',
    'textarea[placeholder*="prompt"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Describe"]',
    '[contenteditable="true"][data-placeholder]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-label*="prompt" i]',
    'input[placeholder*="prompt" i]',
    'input[placeholder*="Imagine"]',
  ];

  for (const sel of specific) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) {
      console.log("[PromptSync] Found input:", sel);
      return el;
    }
  }

  // Priority 2: any visible contenteditable
  const editables = [...document.querySelectorAll('[contenteditable="true"]')].filter(isVisible);
  if (editables.length === 1) {
    console.log("[PromptSync] Single visible contenteditable");
    return editables[0];
  }

  // Priority 3: largest visible contenteditable (likely the main input)
  if (editables.length > 1) {
    const largest = editables.reduce((a, b) =>
      b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a
    );
    console.log("[PromptSync] Largest contenteditable of", editables.length);
    return largest;
  }

  // Priority 4: any visible textarea
  const textareas = [...document.querySelectorAll("textarea")].filter(isVisible);
  if (textareas.length) {
    console.log("[PromptSync] Fallback textarea");
    return textareas[0];
  }

  console.warn("[PromptSync] No input found");
  return null;
}

function isVisible(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function injectIntoPage(prompt) {
  const input = findMjInput();
  if (!input) return false;

  const tag = input.tagName.toLowerCase();
  input.focus();

  if (tag === "textarea" || tag === "input") {
    return injectNativeInput(input, prompt, tag);
  }
  return injectContentEditable(input, prompt);
}

function injectNativeInput(input, prompt, tag) {
  const proto = tag === "textarea"
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const nativeSet = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSet) {
    nativeSet.call(input, prompt);
  } else {
    input.value = prompt;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function injectContentEditable(input, prompt) {
  // Strategy 1: execCommand (best React/framework compat)
  selectAllContent(input);
  const ok = document.execCommand("insertText", false, prompt);
  if (ok && contentMatches(input, prompt)) {
    console.log("[PromptSync] execCommand worked");
    return true;
  }

  // Strategy 2: InputEvent with insertText type
  input.innerHTML = "";
  input.textContent = prompt;
  input.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true, cancelable: true,
    inputType: "insertText", data: prompt,
  }));
  input.dispatchEvent(new InputEvent("input", {
    bubbles: true, inputType: "insertText", data: prompt,
  }));
  if (contentMatches(input, prompt)) {
    console.log("[PromptSync] InputEvent worked");
    return true;
  }

  // Strategy 3: synthetic paste via DataTransfer
  selectAllContent(input);
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", prompt);
    input.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true, cancelable: true, clipboardData: dt,
    }));
    if (contentMatches(input, prompt)) {
      console.log("[PromptSync] Paste event worked");
      return true;
    }
  } catch (e) {
    console.log("[PromptSync] Paste strategy failed:", e);
  }

  // Strategy 4: brute force — set content directly
  input.innerHTML = "";
  input.textContent = prompt;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  console.log("[PromptSync] Brute force textContent set");
  return true;
}

function selectAllContent(el) {
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

function contentMatches(el, prompt) {
  const text = el.textContent || el.innerText || "";
  return text.includes(prompt.slice(0, 30));
}
