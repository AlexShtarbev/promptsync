// Paste into the PromptSync PANEL devtools console.
// Dumps the full state of the reference-sheet visual-references pipeline.

(async () => {
  const project = currentProject;
  if (!project) { console.error("No project loaded"); return; }

  console.group(`%c[DEBUG] Reference Sheet Pipeline — project: ${project}`, "font-weight:bold;font-size:14px");

  // 1. Characters & views from panel state
  console.group("1. Characters in memory");
  for (const char of characters) {
    console.group(`${char.name} (${char.slug}) — ${char.views.length} views`);
    for (const v of char.views) {
      const isRef = v.name.toLowerCase().includes("reference sheet");
      console.log(
        `  ${isRef ? "⭐" : "  "} ${v.name} (${v.slug})`,
        `\n    has_image=${v.has_image}`,
        `\n    openart_ref=${v.openart_ref || "NULL"}`,
        `\n    openart_resource_id=${v.openart_resource_id || "NULL"}`
      );
    }
    console.groupEnd();
  }
  console.groupEnd();

  // 2. Chrome storage for every view
  console.group("2. chrome.storage.local openart-res entries");
  for (const char of characters) {
    for (const v of char.views) {
      if (!v.has_image) continue;
      const key = `openart-res:${project}:${char.slug}:${v.slug}`;
      const stored = await new Promise(r => chrome.storage.local.get(key, r));
      const info = stored[key];
      const status = info
        ? `resourceId=${info.resourceId || "MISSING"}, url=${(info.url || "").slice(0, 60)}...`
        : "NOT FOUND";
      console.log(`${char.slug}/${v.slug}: ${status}`);
    }
  }
  console.groupEnd();

  // 3. Simulate collectCharViewVisualReferences for each ref-sheet view
  console.group("3. collectCharViewVisualReferences() dry run");
  for (const char of characters) {
    for (const v of char.views) {
      if (!v.name.toLowerCase().includes("reference sheet")) continue;
      console.group(`${char.name} — ${v.name} (exclude slug: ${v.slug})`);
      const refs = await collectCharViewVisualReferences(char, v.slug);
      if (refs.length === 0) {
        console.warn("⚠️  EMPTY — no visual references will be injected");
      } else {
        console.log(`✅ ${refs.length} references collected:`);
        refs.forEach((r, i) => console.log(`  [${i}] id=${r.id}, url=${r.url.slice(0, 60)}...`));
      }
      console.groupEnd();
    }
  }
  console.groupEnd();

  // 4. Server /extension/character endpoint check
  console.group("4. Server character data (/extension/character)");
  for (const char of characters) {
    try {
      const res = await fetch(`${API}/extension/character?project=${project}&char=${char.slug}`);
      const data = await res.json();
      for (const v of data.views) {
        if (!v.has_image) continue;
        console.log(
          `${char.slug}/${v.slug}:`,
          `openart_ref=${v.openart_ref ? "yes" : "NULL"}`,
          `openart_resource_id=${v.openart_resource_id || "NULL"}`
        );
      }
    } catch (e) {
      console.error(`Failed to fetch ${char.slug}:`, e.message);
    }
  }
  console.groupEnd();

  console.groupEnd();
  console.log("%c[DEBUG] Done. Now click Inject on a reference sheet view and check the OpenArt tab console for:", "font-weight:bold");
  console.log('  - "[PromptSync] Set N visual references for next creation"  (content script)');
  console.log('  - "[PromptSync] Stored N visual references for next creation"  (page script)');
  console.log('  - "[PromptSync] Injected N visual references into creation request"  (page script, on Generate click)');
})();
