import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// Extracted logic from extension source files.
// Tests validate the CONTRACT these functions must satisfy —
// if source changes, update here and ensure tests still pass.
//
// IMPORTANT: there are TWO key functions — the writer (openart.js
// content script) trims, the reader (panel.js) does NOT.
// Both are reproduced here so we can test the seam between them.
// ============================================================

// From openart-page.js: fetchCwElements maps API response → element objects
function mapApiCharacters(apiCharacters, featureType) {
  const elements = [];
  for (const c of apiCharacters) {
    const name = (c.characterName || c.worldName || "").trim();
    if (!name) continue;
    const primaryUrl = c.imageUrls?.[0] || "";
    elements.push({
      id: c.id,
      name,
      label: name,
      type: c.featureType || featureType,
      url: primaryUrl,
      imageUrl: primaryUrl,
      extraUrls: c.imageUrls?.slice(1) || [],
      klingElementId: c.klingElementId || null,
    });
  }
  return elements;
}

// Canonical C&W storage key — lowercase + trimmed.
// Writers and readers all use this same normalization.
function cwKey(name) {
  return `openart-cw:${name.toLowerCase().trim()}`;
}

// From openart.js: persistence builds this storage object
function cwStorageValue(el) {
  return {
    id: el.id,
    name: el.name,
    type: el.type || "character",
    label: el.label || el.name,
    url: el.url,
    imageUrl: el.imageUrl,
    extraUrls: el.extraUrls || [],
    klingElementId: el.klingElementId || null,
  };
}

// From panel.js: collectElementVisualReferences
function buildVisualReferences(shotElements, cwStorage) {
  const elements = shotElements || [];
  const refs = [];
  for (const elName of elements) {
    const name = elName.replace(/^@/, "");
    const key = cwKey(name);
    const cwElement = cwStorage[key];
    if (!cwElement) continue;
    const ext = (cwElement.url || "").split(".").pop()?.split("?")[0] || "png";
    refs.push({
      type: "character",
      id: cwElement.id,
      name: cwElement.name,
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

// From shared.js: prompt transformation (@CharName → @elementId)
function transformPrompt(prompt, visualReferences) {
  let transformed = prompt;
  for (const ref of visualReferences || []) {
    if (ref.type === "character" && ref.name && ref.id) {
      transformed = transformed.replaceAll(`@${ref.name}`, `@${ref.id}`);
    }
  }
  return transformed;
}

// ============================================================
// Sample data from actual OpenArt API responses
// ============================================================

const SISYPHUS_API = {
  id: "sMZua1I5r8EDomX77de3",
  characterName: "Sisyphus",
  featureType: "character",
  imageUrls: [
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/sisyphus-1_1778870919909_6720bcd0.png",
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/sisyphus-2_1778870922923_1689d88f.png",
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/sisyphus-3_1778870922905_96ee2de4.png",
  ],
  klingElementId: "310842420880303",
};

const MARY_PRESENT_API = {
  id: "7DzxBTTyKurjjsAZ93yn",
  characterName: "Mary_Present ",
  featureType: "character",
  imageUrls: [
    "https://cdn.openart.ai/openart-uploads/production/2026-04/create-image/4MrwdWlQJ0yNAAVRsDKb/mary-1.png",
  ],
  klingElementId: "309527152442316",
};

const BOULDER_API = {
  id: "20UWaypX1qQqfkXgZL1g",
  worldName: "Boulder",
  featureType: "background",
  imageUrls: [
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/boulder-1_1778871007654_30571abf.png",
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/boulder-2_1778871010760_7f8144ba.png",
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/boulder-3_1778871010637_7c94a037.png",
  ],
  klingElementId: "310842502705312",
};

const MOUNTAIN_API = {
  id: "C0Z3g8mGouL6krBUVbep",
  worldName: "Mountain",
  featureType: "background",
  imageUrls: [
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/mountain-1_1778870984120_b8f3accf.png",
    "https://cdn.openart.ai/openart-uploads/production/2026-05/create-image/4MrwdWlQJ0yNAAVRsDKb/mountain-2_1778870987076_3237f2d6.png",
  ],
  klingElementId: "310842479643503",
};

// Build mock chrome.storage from API data (uses write key — matches openart.js)
function buildStorage(...apiEntries) {
  const storage = {};
  for (const { featureType, entries } of apiEntries) {
    const mapped = mapApiCharacters(entries, featureType);
    for (const el of mapped) {
      storage[cwKey(el.name)] = cwStorageValue(el);
    }
  }
  return storage;
}

const FULL_STORAGE = buildStorage(
  { featureType: "character", entries: [SISYPHUS_API, MARY_PRESENT_API] },
  { featureType: "background", entries: [BOULDER_API, MOUNTAIN_API] }
);

// ============================================================
// Tests
// ============================================================

// -----------------------------------------------------------
// Pre-mortem #1: API fixture shape validation
// If OpenArt changes their API response shape (renames fields,
// wraps in `data`, changes types), these tests catch it at the
// fixture level before anything downstream has a chance to
// silently produce empty results.
// -----------------------------------------------------------

describe("API fixture shape guards", () => {
  const ALL_FIXTURES = [
    { fixture: SISYPHUS_API, label: "Sisyphus (character)" },
    { fixture: MARY_PRESENT_API, label: "Mary_Present (character)" },
    { fixture: BOULDER_API, label: "Boulder (background)" },
    { fixture: MOUNTAIN_API, label: "Mountain (background)" },
  ];

  for (const { fixture, label } of ALL_FIXTURES) {
    test(`${label} has required fields`, () => {
      assert.equal(typeof fixture.id, "string", "id must be a string");
      assert.ok(fixture.id.length > 0, "id must be non-empty");
      assert.ok(
        typeof fixture.characterName === "string" || typeof fixture.worldName === "string",
        "must have characterName or worldName"
      );
      assert.equal(typeof fixture.featureType, "string", "featureType must be a string");
      assert.ok(Array.isArray(fixture.imageUrls), "imageUrls must be an array");
      assert.ok(fixture.imageUrls.length > 0, "imageUrls must have at least one URL");
      for (const url of fixture.imageUrls) {
        assert.ok(url.startsWith("https://"), `imageUrl must be HTTPS: ${url}`);
      }
    });
  }

  test("characters use characterName, not worldName", () => {
    assert.equal(typeof SISYPHUS_API.characterName, "string");
    assert.equal(SISYPHUS_API.worldName, undefined);
  });

  test("backgrounds use worldName, not characterName", () => {
    assert.equal(typeof BOULDER_API.worldName, "string");
    assert.equal(BOULDER_API.characterName, undefined);
  });
});

describe("C&W API response mapping", () => {
  test("maps character with characterName", () => {
    const [el] = mapApiCharacters([SISYPHUS_API], "character");
    assert.equal(el.id, "sMZua1I5r8EDomX77de3");
    assert.equal(el.name, "Sisyphus");
    assert.equal(el.type, "character");
    assert.equal(el.klingElementId, "310842420880303");
    assert.equal(el.url, SISYPHUS_API.imageUrls[0]);
    assert.equal(el.imageUrl, SISYPHUS_API.imageUrls[0]);
    assert.deepEqual(el.extraUrls, SISYPHUS_API.imageUrls.slice(1));
  });

  test("maps background with worldName", () => {
    const [el] = mapApiCharacters([BOULDER_API], "background");
    assert.equal(el.id, "20UWaypX1qQqfkXgZL1g");
    assert.equal(el.name, "Boulder");
    assert.equal(el.type, "background");
    assert.equal(el.klingElementId, "310842502705312");
  });

  test("trims trailing spaces from names", () => {
    const [el] = mapApiCharacters([MARY_PRESENT_API], "character");
    assert.equal(el.name, "Mary_Present");
    assert.equal(el.label, "Mary_Present");
  });

  test("skips entries with no name", () => {
    const result = mapApiCharacters([{ id: "x", featureType: "character", imageUrls: [] }], "character");
    assert.equal(result.length, 0);
  });

  test("skips entries with whitespace-only name", () => {
    const result = mapApiCharacters(
      [{ id: "x", characterName: "   ", featureType: "character", imageUrls: [] }],
      "character"
    );
    assert.equal(result.length, 0);
  });

  test("handles missing imageUrls gracefully", () => {
    const [el] = mapApiCharacters([{ ...SISYPHUS_API, imageUrls: undefined }], "character");
    assert.equal(el.url, "");
    assert.equal(el.imageUrl, "");
    assert.deepEqual(el.extraUrls, []);
  });

  test("handles empty imageUrls array", () => {
    const [el] = mapApiCharacters([{ ...SISYPHUS_API, imageUrls: [] }], "character");
    assert.equal(el.url, "");
    assert.equal(el.imageUrl, "");
    assert.deepEqual(el.extraUrls, []);
  });

  test("handles missing klingElementId", () => {
    const [el] = mapApiCharacters([{ ...SISYPHUS_API, klingElementId: undefined }], "character");
    assert.equal(el.klingElementId, null);
  });

  test("primary URL is first imageUrl, extras are the rest", () => {
    const [el] = mapApiCharacters([BOULDER_API], "background");
    assert.equal(el.url, BOULDER_API.imageUrls[0]);
    assert.equal(el.extraUrls.length, 2);
    assert.equal(el.extraUrls[0], BOULDER_API.imageUrls[1]);
    assert.equal(el.extraUrls[1], BOULDER_API.imageUrls[2]);
  });

  test("uses featureType from API, falls back to param", () => {
    const withType = mapApiCharacters([SISYPHUS_API], "background");
    assert.equal(withType[0].type, "character", "API featureType takes precedence");

    const withoutType = mapApiCharacters(
      [{ id: "x", characterName: "Test", imageUrls: ["https://img.png"] }],
      "background"
    );
    assert.equal(withoutType[0].type, "background", "falls back to param");
  });
});

// -----------------------------------------------------------
// Pre-mortem #2: Key normalization
// All writers and readers use the same normalization:
// lowercase + trim. Element names must be camelCase (no spaces).
// -----------------------------------------------------------

describe("Storage key normalization", () => {
  test("clean names produce consistent keys", () => {
    assert.equal(cwKey("Sisyphus"), "openart-cw:sisyphus");
    assert.equal(cwKey("Boulder"), "openart-cw:boulder");
  });

  test("trailing spaces are stripped", () => {
    assert.equal(cwKey("Mary "), "openart-cw:mary");
    assert.equal(cwKey("Mary_Present "), "openart-cw:mary_present");
  });

  test("camelCase element names produce correct keys", () => {
    assert.equal(cwKey("peterNightingale"), "openart-cw:peternightingale");
    assert.equal(cwKey("PeterNightingale"), "openart-cw:peternightingale");
  });

  test("mapApiCharacters trims names, key still matches", () => {
    const [el] = mapApiCharacters([MARY_PRESENT_API], "character");
    assert.equal(el.name, "Mary_Present", "name must be trimmed by mapper");
    assert.equal(cwKey(el.name), "openart-cw:mary_present");
  });

  test("key matches for all fixtures", () => {
    const allApi = [SISYPHUS_API, MARY_PRESENT_API, BOULDER_API, MOUNTAIN_API];
    for (const api of allApi) {
      const mapped = mapApiCharacters([api], api.featureType);
      for (const el of mapped) {
        const key = cwKey(el.name);
        assert.ok(key.startsWith("openart-cw:"), `key for "${el.name}" has correct prefix`);
      }
    }
  });

  test("shot elements match stored keys", () => {
    const shotElements = ["Sisyphus", "Mary_Present", "Boulder", "Mountain"];
    for (const name of shotElements) {
      assert.equal(
        cwKey(name),
        FULL_STORAGE[cwKey(name)] ? cwKey(name) : "MISSING",
        `shot element "${name}" must find its stored key`
      );
    }
  });
});

describe("C&W storage keys", () => {
  test("lowercases name", () => {
    assert.equal(cwKey("Sisyphus"), "openart-cw:sisyphus");
  });

  test("trims whitespace", () => {
    assert.equal(cwKey("Mary_Present "), "openart-cw:mary_present");
  });

  test("handles mixed case with underscores", () => {
    assert.equal(cwKey("Tomb_Exterior"), "openart-cw:tomb_exterior");
  });
});

// -----------------------------------------------------------
// Pre-mortem #3: URL format inference edge cases
// The format is inferred by splitting on "." and taking the
// last segment. This breaks on extensionless URLs, URLs with
// dots in path segments, and URLs with complex query strings.
// -----------------------------------------------------------

describe("Visual reference format", () => {
  test("all refs use type 'character' regardless of featureType", () => {
    const refs = buildVisualReferences(
      ["Sisyphus", "Boulder", "Mountain"],
      FULL_STORAGE
    );
    assert.equal(refs.length, 3);
    for (const ref of refs) {
      assert.equal(ref.type, "character", `${ref.name} should have type "character"`);
    }
  });

  test("includes required metadata object", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    assert.equal(refs.length, 1);
    const meta = refs[0].metadata;
    assert.ok(meta, "metadata must exist");
    assert.equal(meta.media_type, "image");
    assert.equal(typeof meta.format, "string");
    assert.equal(typeof meta.width, "number");
    assert.equal(typeof meta.height, "number");
    assert.equal(typeof meta.file_size_bytes, "number");
  });

  test("infers format from URL extension", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    assert.equal(refs[0].metadata.format, "png");
  });

  test("infers format from URL with query string", () => {
    const storage = {
      "openart-cw:test": {
        ...cwStorageValue({ id: "t", name: "Test", url: "https://cdn.openart.ai/img.jpg?token=abc&v=2", imageUrl: "https://cdn.openart.ai/img.jpg?token=abc&v=2", extraUrls: [] }),
      },
    };
    const refs = buildVisualReferences(["Test"], storage);
    assert.equal(refs[0].metadata.format, "jpg");
  });

  test("falls back to 'png' for empty URL", () => {
    const storage = {
      "openart-cw:test": {
        ...cwStorageValue({ id: "t", name: "Test", url: "", imageUrl: "", extraUrls: [] }),
      },
    };
    const refs = buildVisualReferences(["Test"], storage);
    assert.equal(refs[0].metadata.format, "png");
  });

  test("KNOWN BUG: extensionless URL produces garbage format, not 'png'", () => {
    // URL without a file extension — .split(".").pop() grabs the last
    // dot-segment of the hostname+path, e.g. "ai/images/abc123"
    const storage = {
      "openart-cw:test": {
        ...cwStorageValue({ id: "t", name: "Test", url: "https://cdn.openart.ai/images/abc123", imageUrl: "https://cdn.openart.ai/images/abc123", extraUrls: [] }),
      },
    };
    const refs = buildVisualReferences(["Test"], storage);
    assert.equal(refs[0].metadata.format, "ai/images/abc123",
      "KNOWN BUG: extensionless URL produces garbage — split('.').pop() grabs path after last dot in hostname"
    );
  });

  test("handles webp extension", () => {
    const storage = {
      "openart-cw:test": {
        ...cwStorageValue({ id: "t", name: "Test", url: "https://cdn.openart.ai/img.webp", imageUrl: "https://cdn.openart.ai/img.webp", extraUrls: [] }),
      },
    };
    const refs = buildVisualReferences(["Test"], storage);
    assert.equal(refs[0].metadata.format, "webp");
  });

  test("includes element ID, not resource ID", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    assert.equal(refs[0].id, "sMZua1I5r8EDomX77de3");
  });

  test("includes klingElementId", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    assert.equal(refs[0].klingElementId, "310842420880303");
  });

  test("includes extraUrls for multi-view characters", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    assert.equal(refs[0].extraUrls.length, 2);
  });

  test("includes extraUrls for backgrounds", () => {
    const refs = buildVisualReferences(["Boulder"], FULL_STORAGE);
    assert.equal(refs[0].extraUrls.length, 2);
  });

  test("url and imageUrl are the primary image", () => {
    const refs = buildVisualReferences(["Boulder"], FULL_STORAGE);
    assert.equal(refs[0].url, BOULDER_API.imageUrls[0]);
    assert.equal(refs[0].imageUrl, BOULDER_API.imageUrls[0]);
  });

  test("name and label are the character/world name", () => {
    const refs = buildVisualReferences(["Sisyphus", "Boulder"], FULL_STORAGE);
    assert.equal(refs[0].name, "Sisyphus");
    assert.equal(refs[0].label, "Sisyphus");
    assert.equal(refs[1].name, "Boulder");
    assert.equal(refs[1].label, "Boulder");
  });

  test("matches OpenArt's expected visual reference structure", () => {
    const refs = buildVisualReferences(["Sisyphus", "Boulder"], FULL_STORAGE);
    const required = ["type", "id", "name", "label", "url", "imageUrl", "extraUrls", "klingElementId", "metadata"];
    for (const ref of refs) {
      for (const key of required) {
        assert.ok(key in ref, `missing required field: ${key}`);
      }
      assert.ok(typeof ref.metadata === "object" && ref.metadata !== null, "metadata must be an object");
      const metaRequired = ["media_type", "format", "width", "height", "file_size_bytes"];
      for (const mk of metaRequired) {
        assert.ok(mk in ref.metadata, `missing metadata field: ${mk}`);
      }
    }
  });
});

// -----------------------------------------------------------
// Pre-mortem #4: Duplicate elements in a shot
// If shot.elements has the same name twice, we produce
// duplicate visual references. OpenArt may reject this.
// -----------------------------------------------------------

describe("Duplicate and edge-case element handling", () => {
  test("duplicate element names produce duplicate refs", () => {
    const refs = buildVisualReferences(["Sisyphus", "Sisyphus"], FULL_STORAGE);
    assert.equal(refs.length, 2, "current behavior: duplicates are NOT deduplicated");
    assert.equal(refs[0].id, refs[1].id);
  });

  test("null/undefined shotElements treated as empty", () => {
    assert.deepEqual(buildVisualReferences(null, FULL_STORAGE), []);
    assert.deepEqual(buildVisualReferences(undefined, FULL_STORAGE), []);
  });

  test("empty string element name produces no match", () => {
    const refs = buildVisualReferences([""], FULL_STORAGE);
    assert.equal(refs.length, 0);
  });
});

// -----------------------------------------------------------
// Pre-mortem #5: Background type preserved in storage but
// output must always be "character". If someone refactors
// buildVisualReferences to read cwElement.type instead of
// hardcoding, backgrounds break.
// -----------------------------------------------------------

describe("Background type override", () => {
  test("storage preserves original featureType", () => {
    const stored = FULL_STORAGE[cwKey("Boulder")];
    assert.equal(stored.type, "background", "storage retains 'background'");
  });

  test("visual ref output overrides background type to 'character'", () => {
    const refs = buildVisualReferences(["Boulder"], FULL_STORAGE);
    assert.equal(refs[0].type, "character", "output must be 'character' regardless of stored type");
  });

  test("all storage entries with type 'background' still produce type 'character' refs", () => {
    const bgNames = Object.entries(FULL_STORAGE)
      .filter(([, v]) => v.type === "background")
      .map(([, v]) => v.name);
    assert.ok(bgNames.length > 0, "test requires at least one background in storage");
    const refs = buildVisualReferences(bgNames, FULL_STORAGE);
    for (const ref of refs) {
      assert.equal(ref.type, "character", `${ref.name} (stored as background) must output as "character"`);
    }
  });
});

describe("Element name matching", () => {
  test("matches by exact name (case-insensitive)", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].name, "Sisyphus");
  });

  test("strips @ prefix from element names", () => {
    const refs = buildVisualReferences(["@Sisyphus"], FULL_STORAGE);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].name, "Sisyphus");
  });

  test("matches trimmed name (trailing space in API)", () => {
    const refs = buildVisualReferences(["Mary_Present"], FULL_STORAGE);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].name, "Mary_Present");
  });

  test("skips unknown elements gracefully", () => {
    const refs = buildVisualReferences(["Sisyphus", "UnknownChar", "Boulder"], FULL_STORAGE);
    assert.equal(refs.length, 2);
    assert.equal(refs[0].name, "Sisyphus");
    assert.equal(refs[1].name, "Boulder");
  });

  test("returns empty array when no elements match", () => {
    const refs = buildVisualReferences(["Nonexistent"], FULL_STORAGE);
    assert.deepEqual(refs, []);
  });

  test("returns empty array for empty elements list", () => {
    const refs = buildVisualReferences([], FULL_STORAGE);
    assert.deepEqual(refs, []);
  });

  test("preserves order of shot elements in output refs", () => {
    const refs = buildVisualReferences(["Mountain", "Sisyphus", "Boulder"], FULL_STORAGE);
    assert.equal(refs[0].name, "Mountain");
    assert.equal(refs[1].name, "Sisyphus");
    assert.equal(refs[2].name, "Boulder");
  });
});

// -----------------------------------------------------------
// Pre-mortem #1 (prompt): Substring collision
// @Rock / @Rocket — replaceAll("@Rock",...) corrupts "@Rocket"
// into "@<rock-id>et". This is a latent bug in the current
// implementation. These tests document the broken behavior so
// we catch it if/when it's fixed.
// -----------------------------------------------------------

describe("Prompt transformation", () => {
  test("replaces @CharName with @elementId", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus pushes the rock", refs);
    assert.equal(result, "@sMZua1I5r8EDomX77de3 pushes the rock");
  });

  test("replaces multiple occurrences of same character", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus pushes. @Sisyphus strains.", refs);
    assert.equal(result, "@sMZua1I5r8EDomX77de3 pushes. @sMZua1I5r8EDomX77de3 strains.");
  });

  test("replaces multiple different elements", () => {
    const refs = buildVisualReferences(["Sisyphus", "Boulder", "Mountain"], FULL_STORAGE);
    const result = transformPrompt(
      "@Sisyphus pushes @Boulder up @Mountain slope",
      refs
    );
    assert.equal(
      result,
      "@sMZua1I5r8EDomX77de3 pushes @20UWaypX1qQqfkXgZL1g up @C0Z3g8mGouL6krBUVbep slope"
    );
  });

  test("handles possessive form @Name's", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus's hands on the rock", refs);
    assert.equal(result, "@sMZua1I5r8EDomX77de3's hands on the rock");
  });

  test("does not transform when no visual references", () => {
    const result = transformPrompt("@Sisyphus pushes @Boulder", []);
    assert.equal(result, "@Sisyphus pushes @Boulder");
  });

  test("does not transform type 'image' refs (seedance shot refs)", () => {
    const imageRefs = [{
      type: "image",
      id: "someResourceId",
      name: "image1",
      url: "https://example.com/img.png",
    }];
    const result = transformPrompt("@Sisyphus pushes", imageRefs);
    assert.equal(result, "@Sisyphus pushes");
  });

  test("preserves prompt structure with labeled blocks", () => {
    const refs = buildVisualReferences(["Sisyphus", "Boulder"], FULL_STORAGE);
    const prompt = [
      "[Subject]: @Sisyphus pushing @Boulder",
      "[Environment]: @Boulder surface beneath",
      "Negative prompt: flat lighting",
    ].join("\n");
    const result = transformPrompt(prompt, refs);
    assert.ok(result.includes("@sMZua1I5r8EDomX77de3 pushing @20UWaypX1qQqfkXgZL1g"));
    assert.ok(result.includes("@20UWaypX1qQqfkXgZL1g surface beneath"));
    assert.ok(result.includes("Negative prompt: flat lighting"));
  });

  test("KNOWN BUG: substring name collision corrupts longer name", () => {
    // If element "Rock" exists and prompt has "@Rocket", replaceAll("@Rock",...)
    // will corrupt "@Rocket" into "@<rock-id>et".
    // This test documents the current (buggy) behavior.
    const storage = {
      "openart-cw:rock": cwStorageValue({ id: "rock-id", name: "Rock", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] }),
      "openart-cw:rocket": cwStorageValue({ id: "rocket-id", name: "Rocket", url: "https://y.png", imageUrl: "https://y.png", extraUrls: [] }),
    };
    const refs = buildVisualReferences(["Rock", "Rocket"], storage);

    // Current behavior: Rock is replaced first, corrupting @Rocket
    const result = transformPrompt("@Rock launches @Rocket into sky", refs);
    assert.equal(
      result,
      "@rock-id launches @rock-idet into sky",
      "KNOWN BUG: @Rocket corrupted because @Rock is a substring"
    );
  });

  test("no substring collision when names are not prefixes of each other", () => {
    const refs = buildVisualReferences(["Sisyphus", "Boulder"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus and @Boulder", refs);
    assert.ok(!result.includes("@Sisyphus"), "Sisyphus should be fully replaced");
    assert.ok(!result.includes("@Boulder"), "Boulder should be fully replaced");
  });

  test("handles empty prompt", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("", refs);
    assert.equal(result, "");
  });

  test("handles prompt with no @-mentions", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("A man pushes a boulder uphill", refs);
    assert.equal(result, "A man pushes a boulder uphill");
  });

  test("does not transform bare name without @ prefix", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("Sisyphus pushes the rock", refs);
    assert.equal(result, "Sisyphus pushes the rock");
  });
});

describe("End-to-end: API response → storage → visual refs → prompt", () => {
  test("full pipeline produces valid OpenArt request data", () => {
    const charElements = mapApiCharacters([SISYPHUS_API], "character");
    const bgElements = mapApiCharacters([BOULDER_API, MOUNTAIN_API], "background");
    const allElements = [...charElements, ...bgElements];

    const storage = {};
    for (const el of allElements) {
      storage[cwKey(el.name)] = cwStorageValue(el);
    }

    const shotElements = ["Sisyphus", "Boulder", "Mountain"];
    const refs = buildVisualReferences(shotElements, storage);
    const prompt = "@Sisyphus pushes @Boulder up @Mountain";
    const transformed = transformPrompt(prompt, refs);

    assert.equal(refs.length, 3);
    assert.equal(transformed, "@sMZua1I5r8EDomX77de3 pushes @20UWaypX1qQqfkXgZL1g up @C0Z3g8mGouL6krBUVbep");

    for (const ref of refs) {
      assert.equal(ref.type, "character");
      assert.ok(ref.metadata);
      assert.ok(ref.id);
      assert.ok(ref.klingElementId);
      assert.ok(ref.url);
      assert.ok(ref.imageUrl);
      assert.ok(Array.isArray(ref.extraUrls));
    }
  });

  test("mixed characters and backgrounds in same shot", () => {
    const refs = buildVisualReferences(
      ["Sisyphus", "Boulder"],
      FULL_STORAGE
    );
    assert.equal(refs.length, 2);
    assert.equal(refs[0].type, "character");
    assert.equal(refs[1].type, "character");
    assert.equal(refs[0].klingElementId, "310842420880303");
    assert.equal(refs[1].klingElementId, "310842502705312");
  });

  test("shot with no matching elements produces empty refs and unchanged prompt", () => {
    const refs = buildVisualReferences(["Unknown"], FULL_STORAGE);
    const transformed = transformPrompt("@Unknown does things", refs);
    assert.equal(refs.length, 0);
    assert.equal(transformed, "@Unknown does things");
  });

  test("storage round-trip preserves all fields", () => {
    const [original] = mapApiCharacters([SISYPHUS_API], "character");
    const stored = cwStorageValue(original);
    const key = cwKey(original.name);
    const retrieved = { [key]: stored }[cwKey(original.name)];

    assert.ok(retrieved, "round-trip lookup must succeed");
    assert.equal(retrieved.id, original.id);
    assert.equal(retrieved.name, original.name);
    assert.equal(retrieved.url, original.url);
    assert.equal(retrieved.imageUrl, original.imageUrl);
    assert.deepEqual(retrieved.extraUrls, original.extraUrls);
    assert.equal(retrieved.klingElementId, original.klingElementId);
  });

  test("end-to-end with @ prefixed elements in shot", () => {
    const refs = buildVisualReferences(["@Sisyphus", "@Boulder"], FULL_STORAGE);
    const transformed = transformPrompt("@Sisyphus lifts @Boulder", refs);
    assert.equal(refs.length, 2);
    assert.ok(!transformed.includes("@Sisyphus"), "Sisyphus must be replaced");
    assert.ok(!transformed.includes("@Boulder"), "Boulder must be replaced");
    assert.ok(transformed.includes("@sMZua1I5r8EDomX77de3"));
    assert.ok(transformed.includes("@20UWaypX1qQqfkXgZL1g"));
  });
});

// -----------------------------------------------------------
// Pre-mortem #6: Seedance visual references use a completely
// different format — type:"image", format:null, no extraUrls,
// no klingElementId. If someone normalizes both paths or
// accidentally sends C&W-style refs for seedance, OpenArt
// rejects or uses wrong reference images.
// -----------------------------------------------------------

// From panel.js: collectShotVisualReferences → seedance ref builder
function buildSeedanceVisualReferences(shotRefs) {
  return shotRefs.map((ref, i) => ({
    type: "image",
    id: ref.resourceId,
    url: ref.url,
    label: `image${i + 1}`,
    name: `image${i + 1}`,
    imageUrl: ref.url,
    metadata: { media_type: "image", width: 1024, height: 1024, format: null, file_size_bytes: 0 },
  }));
}

// From panel.js: collectShotVisualReferences (storage read)
function collectShotRefs(shots, storageMap) {
  const refs = [];
  const shotsWithImages = shots.filter((s) => s.has_image && s.asset_type !== "seedance");
  for (const shot of shotsWithImages) {
    const key = `openart-res:project1:shot:${shot.code}`;
    const refInfo = storageMap[key];
    if (refInfo?.resourceId && refInfo?.url) {
      refs.push({ resourceId: refInfo.resourceId, url: refInfo.url, code: shot.code });
    }
  }
  return refs;
}

describe("Seedance visual reference format", () => {
  const SAMPLE_SHOT_REFS = [
    { resourceId: "res-001", url: "https://cdn.openart.ai/img/shot1.png", code: "1A" },
    { resourceId: "res-002", url: "https://cdn.openart.ai/img/shot2.png", code: "1B" },
    { resourceId: "res-003", url: "https://cdn.openart.ai/img/shot3.jpg", code: "2A" },
  ];

  test("uses type 'image', never 'character'", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    for (const ref of refs) {
      assert.equal(ref.type, "image");
    }
  });

  test("id is the resourceId (not element ID)", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    assert.equal(refs[0].id, "res-001");
    assert.equal(refs[1].id, "res-002");
  });

  test("name/label are sequential 'image1', 'image2', etc.", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    assert.equal(refs[0].name, "image1");
    assert.equal(refs[0].label, "image1");
    assert.equal(refs[1].name, "image2");
    assert.equal(refs[2].name, "image3");
  });

  test("url and imageUrl are the same (the shot image URL)", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    assert.equal(refs[0].url, refs[0].imageUrl);
    assert.equal(refs[0].url, "https://cdn.openart.ai/img/shot1.png");
  });

  test("metadata.format is null (not inferred from URL)", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    for (const ref of refs) {
      assert.equal(ref.metadata.format, null);
    }
  });

  test("does NOT have extraUrls or klingElementId", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    for (const ref of refs) {
      assert.equal(ref.extraUrls, undefined);
      assert.equal(ref.klingElementId, undefined);
    }
  });

  test("prompt transform skips seedance refs (type 'image')", () => {
    const refs = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS);
    const prompt = "@image1 running through @image2 scene";
    const result = transformPrompt(prompt, refs);
    assert.equal(result, prompt, "seedance refs must not trigger prompt transformation");
  });

  test("structural difference from C&W refs", () => {
    const cwRef = buildVisualReferences(["Sisyphus"], FULL_STORAGE)[0];
    const seedRef = buildSeedanceVisualReferences(SAMPLE_SHOT_REFS)[0];

    assert.equal(cwRef.type, "character");
    assert.equal(seedRef.type, "image");
    assert.equal(typeof cwRef.metadata.format, "string");
    assert.equal(seedRef.metadata.format, null);
    assert.ok("extraUrls" in cwRef);
    assert.ok(!("extraUrls" in seedRef));
    assert.ok("klingElementId" in cwRef);
    assert.ok(!("klingElementId" in seedRef));
  });
});

// -----------------------------------------------------------
// Pre-mortem #7: Two storage namespaces can be confused
// openart-cw:* — C&W element data (keyed by name)
// openart-res:* — generated image resourceIds (keyed by project:type:code)
// Mixing them up causes silent failures.
// -----------------------------------------------------------

describe("Storage namespace separation", () => {
  test("C&W element keys start with 'openart-cw:'", () => {
    const key = cwKey("Sisyphus");
    assert.ok(key.startsWith("openart-cw:"), `expected openart-cw: prefix, got: ${key}`);
  });

  test("shot resource keys start with 'openart-res:'", () => {
    const key = "openart-res:project1:shot:1A";
    assert.ok(key.startsWith("openart-res:"), "shot resource key must use openart-res: prefix");
  });

  test("namespaces never overlap", () => {
    const cwk = cwKey("shot");
    const resKey = "openart-res:project:shot:1A";
    assert.notEqual(cwk, resKey);
    assert.ok(!cwk.startsWith("openart-res:"));
    assert.ok(!resKey.startsWith("openart-cw:"));
  });

  test("collectShotRefs only uses openart-res: keys", () => {
    const shots = [
      { code: "1A", has_image: true, asset_type: "still" },
      { code: "1B", has_image: true, asset_type: "still" },
      { code: "2A", has_image: false, asset_type: "still" },
    ];
    const storageMap = {
      "openart-res:project1:shot:1A": { resourceId: "r1", url: "https://img1.png" },
      "openart-res:project1:shot:1B": { resourceId: "r2", url: "https://img2.png" },
      "openart-cw:sisyphus": cwStorageValue({ id: "el-id", name: "Sisyphus", url: "https://cw.png", imageUrl: "https://cw.png", extraUrls: [] }),
    };
    const refs = collectShotRefs(shots, storageMap);
    assert.equal(refs.length, 2);
    assert.equal(refs[0].resourceId, "r1");
    assert.equal(refs[1].resourceId, "r2");
  });

  test("collectShotRefs excludes seedance shots", () => {
    const shots = [
      { code: "1A", has_image: true, asset_type: "still" },
      { code: "2A", has_image: true, asset_type: "seedance" },
    ];
    const storageMap = {
      "openart-res:project1:shot:1A": { resourceId: "r1", url: "https://img1.png" },
      "openart-res:project1:shot:2A": { resourceId: "r2", url: "https://img2.png" },
    };
    const refs = collectShotRefs(shots, storageMap);
    assert.equal(refs.length, 1, "seedance shots must be excluded from seedance visual refs");
    assert.equal(refs[0].code, "1A");
  });

  test("collectShotRefs skips shots without storage entry", () => {
    const shots = [
      { code: "1A", has_image: true, asset_type: "still" },
      { code: "1B", has_image: true, asset_type: "still" },
    ];
    const storageMap = {
      "openart-res:project1:shot:1A": { resourceId: "r1", url: "https://img1.png" },
    };
    const refs = collectShotRefs(shots, storageMap);
    assert.equal(refs.length, 1);
  });

  test("collectShotRefs skips entries missing resourceId or url", () => {
    const shots = [
      { code: "1A", has_image: true, asset_type: "still" },
      { code: "1B", has_image: true, asset_type: "still" },
      { code: "1C", has_image: true, asset_type: "still" },
    ];
    const storageMap = {
      "openart-res:project1:shot:1A": { resourceId: "r1", url: "" },
      "openart-res:project1:shot:1B": { resourceId: "", url: "https://img2.png" },
      "openart-res:project1:shot:1C": { resourceId: "r3", url: "https://img3.png" },
    };
    const refs = collectShotRefs(shots, storageMap);
    assert.equal(refs.length, 1, "only shot with both resourceId AND url should be included");
    assert.equal(refs[0].code, "1C");
  });
});

// -----------------------------------------------------------
// Pre-mortem #8: Corrupted or partial storage entries
// If storage has an entry with empty id, missing url, or null
// values, buildVisualReferences still produces a ref with those
// broken values — OpenArt will reject with "Invalid input".
// -----------------------------------------------------------

describe("Corrupted storage entry handling", () => {
  test("ref with empty id is still produced (no validation)", () => {
    const storage = {
      "openart-cw:broken": cwStorageValue({ id: "", name: "Broken", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] }),
    };
    const refs = buildVisualReferences(["Broken"], storage);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].id, "", "current behavior: empty id passes through");
  });

  test("ref with empty url produces metadata format 'png' (fallback)", () => {
    const storage = {
      "openart-cw:nourl": cwStorageValue({ id: "x", name: "NoUrl", url: "", imageUrl: "", extraUrls: [] }),
    };
    const refs = buildVisualReferences(["NoUrl"], storage);
    assert.equal(refs[0].url, "");
    assert.equal(refs[0].metadata.format, "png");
  });

  test("ref with null klingElementId is still valid (optional field)", () => {
    const storage = {
      "openart-cw:nokling": cwStorageValue({ id: "x", name: "NoKling", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [], klingElementId: null }),
    };
    const refs = buildVisualReferences(["NoKling"], storage);
    assert.equal(refs[0].klingElementId, null);
  });

  test("prompt transform skips ref with empty id (guard: ref.id is falsy)", () => {
    const refs = [{ type: "character", id: "", name: "Ghost", url: "" }];
    const result = transformPrompt("@Ghost appears", refs);
    assert.equal(result, "@Ghost appears", "empty id is falsy → ref skipped by transform guard");
  });
});

// -----------------------------------------------------------
// Pre-mortem #9: Transformation order determines corruption
// The substring bug only fires when a short name precedes a
// longer name that starts with it. If refs were sorted by
// name length descending, the bug would disappear.
// -----------------------------------------------------------

describe("Prompt transformation order sensitivity", () => {
  const prefixStorage = {
    "openart-cw:rock": cwStorageValue({ id: "rock-id", name: "Rock", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] }),
    "openart-cw:rocket": cwStorageValue({ id: "rocket-id", name: "Rocket", url: "https://y.png", imageUrl: "https://y.png", extraUrls: [] }),
  };

  test("short-first order corrupts longer name", () => {
    const refs = buildVisualReferences(["Rock", "Rocket"], prefixStorage);
    const result = transformPrompt("@Rock and @Rocket", refs);
    assert.equal(result, "@rock-id and @rock-idet", "short name replaced first → corruption");
  });

  test("long-first order IS safe (documents potential fix)", () => {
    const refs = buildVisualReferences(["Rocket", "Rock"], prefixStorage);
    // Rocket is replaced first: "@Rock and @rocket-id"
    // Then Rock is replaced: "@rock-id and @rocket-id"
    // Safe because @rocket-id no longer contains "@Rock" (case-sensitive)
    const result = transformPrompt("@Rock and @Rocket", refs);
    assert.equal(result, "@rock-id and @rocket-id",
      "replacing longer names first avoids corruption — potential fix for the substring bug"
    );
  });

  test("names that share no prefix are safe regardless of order", () => {
    const refs = buildVisualReferences(["Sisyphus", "Mountain", "Boulder"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus @Mountain @Boulder", refs);
    assert.ok(!result.includes("@Sisyphus"));
    assert.ok(!result.includes("@Mountain"));
    assert.ok(!result.includes("@Boulder"));
  });

  test("underscore names are safe from accidental prefix collision", () => {
    const storage = {
      "openart-cw:mary_present": cwStorageValue({ id: "mp-id", name: "Mary_Present", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] }),
      "openart-cw:mary": cwStorageValue({ id: "m-id", name: "Mary", url: "https://y.png", imageUrl: "https://y.png", extraUrls: [] }),
    };
    const refs = buildVisualReferences(["Mary", "Mary_Present"], storage);
    const result = transformPrompt("@Mary walks with @Mary_Present", refs);
    // @Mary replaces both occurrences: "@m-id walks with @m-id_Present"
    assert.equal(result, "@m-id walks with @m-id_Present",
      "KNOWN BUG: @Mary is prefix of @Mary_Present, corrupts it"
    );
  });
});

// -----------------------------------------------------------
// Pre-mortem #10: Both handleApiDryRun and
// handleAutoGenerateShotDirect must use identical transform logic.
// If one is patched and the other isn't, results diverge.
// This test documents the contract: both use transformPrompt
// with the same filter (type === "character" && name && id).
// -----------------------------------------------------------

describe("Transform logic parity between code paths", () => {
  // Both handleApiDryRun and handleAutoGenerateShotDirect do:
  //   for (const ref of refs) {
  //     if (ref.type === "character" && ref.name && ref.id) {
  //       transformedPrompt = transformedPrompt.replaceAll(`@${ref.name}`, `@${ref.id}`);
  //     }
  //   }
  // transformPrompt reproduces this exactly.

  test("C&W refs trigger replacement", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus test", refs);
    assert.notEqual(result, "@Sisyphus test");
  });

  test("seedance refs do NOT trigger replacement", () => {
    const seedRefs = buildSeedanceVisualReferences([
      { resourceId: "r1", url: "https://img.png", code: "1A" },
    ]);
    const result = transformPrompt("@image1 test", seedRefs);
    assert.equal(result, "@image1 test");
  });

  test("mixed C&W and seedance refs only transform C&W names", () => {
    const cwRefs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const seedRefs = buildSeedanceVisualReferences([
      { resourceId: "r1", url: "https://img.png", code: "1A" },
    ]);
    const allRefs = [...cwRefs, ...seedRefs];
    const result = transformPrompt("@Sisyphus near @image1", allRefs);
    assert.ok(result.includes("@sMZua1I5r8EDomX77de3"), "C&W ref should be replaced");
    assert.ok(result.includes("@image1"), "seedance ref should NOT be replaced");
  });

  test("ref with missing name is skipped", () => {
    const refs = [{ type: "character", id: "abc", name: "", url: "" }];
    const result = transformPrompt("@Sisyphus test", refs);
    assert.equal(result, "@Sisyphus test", "empty name ref must not trigger replacement");
  });

  test("ref with missing id is skipped", () => {
    const refs = [{ type: "character", id: "", name: "Sisyphus", url: "" }];
    const result = transformPrompt("@Sisyphus test", refs);
    assert.equal(result, "@Sisyphus test", "empty id ref must not trigger replacement");
  });

  test("null/undefined refs array is safe", () => {
    assert.equal(transformPrompt("@Sisyphus test", null), "@Sisyphus test");
    assert.equal(transformPrompt("@Sisyphus test", undefined), "@Sisyphus test");
  });
});

// -----------------------------------------------------------
// Pre-mortem #11: Case sensitivity in prompt matching
// The transform does exact case-sensitive replaceAll.
// If prompt has @sisyphus but ref.name is "Sisyphus", no match.
// -----------------------------------------------------------

describe("Case sensitivity in prompt transformation", () => {
  test("transform is case-sensitive — lowercase prompt mention is NOT replaced", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@sisyphus pushes the rock", refs);
    assert.equal(result, "@sisyphus pushes the rock",
      "KNOWN LIMITATION: prompt must use exact case from C&W element name"
    );
  });

  test("transform is case-sensitive — uppercase prompt mention is NOT replaced", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@SISYPHUS pushes the rock", refs);
    assert.equal(result, "@SISYPHUS pushes the rock");
  });

  test("exact case match works", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus pushes the rock", refs);
    assert.ok(result.includes("@sMZua1I5r8EDomX77de3"));
  });

  test("storage lookup is case-insensitive but transform is case-sensitive", () => {
    // Storage lookup: "SISYPHUS" → key "openart-cw:sisyphus" → finds the element
    // BUT: the ref.name stored is "Sisyphus" (original case from API)
    // So transform replaces "@Sisyphus" in prompt, not "@SISYPHUS"
    const refs = buildVisualReferences(["SISYPHUS"], FULL_STORAGE);
    assert.equal(refs.length, 1, "lookup is case-insensitive");
    assert.equal(refs[0].name, "Sisyphus", "ref.name preserves original API case");

    const result = transformPrompt("@SISYPHUS pushes", refs);
    assert.equal(result, "@SISYPHUS pushes",
      "transform fails because ref.name is 'Sisyphus' but prompt has '@SISYPHUS'"
    );
  });
});

// -----------------------------------------------------------
// Pre-mortem #12: Writer validation gate
// openart.js:954 skips elements with !el.id || !el.name
// If mapApiCharacters produces elements with missing id (e.g.
// API returns null id), the writer won't persist them.
// -----------------------------------------------------------

describe("Writer validation gate", () => {
  // Simulates the openart.js content script validation:
  // if (!el.id || !el.name) continue;
  function writerFilter(elements) {
    return elements.filter((el) => el.id && el.name);
  }

  test("elements with valid id and name pass", () => {
    const elements = mapApiCharacters([SISYPHUS_API], "character");
    const filtered = writerFilter(elements);
    assert.equal(filtered.length, 1);
  });

  test("elements with empty id are rejected by writer", () => {
    const elements = mapApiCharacters(
      [{ ...SISYPHUS_API, id: "" }],
      "character"
    );
    const filtered = writerFilter(elements);
    assert.equal(filtered.length, 0);
  });

  test("elements with null id are rejected by writer", () => {
    const elements = mapApiCharacters(
      [{ ...SISYPHUS_API, id: null }],
      "character"
    );
    const filtered = writerFilter(elements);
    assert.equal(filtered.length, 0);
  });

  test("elements with undefined id are rejected by writer", () => {
    const elements = mapApiCharacters(
      [{ characterName: "Ghost", featureType: "character", imageUrls: ["https://x.png"] }],
      "character"
    );
    const filtered = writerFilter(elements);
    assert.equal(filtered.length, 0, "API entry with no id should not be persisted");
  });

  test("mapApiCharacters already skips nameless entries, writer gate is belt-and-suspenders", () => {
    const elements = mapApiCharacters(
      [{ id: "abc", featureType: "character", imageUrls: [] }],
      "character"
    );
    assert.equal(elements.length, 0, "mapApiCharacters skips entries with no name");
    const filtered = writerFilter(elements);
    assert.equal(filtered.length, 0);
  });
});

// -----------------------------------------------------------
// Pre-mortem #13: Storage overwrite / last-write-wins
// If the same element is captured multiple times (e.g. from
// API fetch and then from a generation request), the last
// write wins. Tests verify this doesn't corrupt data.
// -----------------------------------------------------------

describe("Storage overwrite behavior", () => {
  test("second write with updated URLs replaces first", () => {
    const storage = {};
    const el1 = { id: "abc", name: "Hero", type: "character", label: "Hero", url: "https://old.png", imageUrl: "https://old.png", extraUrls: [], klingElementId: null };
    storage[cwKey("Hero")] = cwStorageValue(el1);

    const el2 = { ...el1, url: "https://new.png", imageUrl: "https://new.png", extraUrls: ["https://extra.png"] };
    storage[cwKey("Hero")] = cwStorageValue(el2);

    const refs = buildVisualReferences(["Hero"], storage);
    assert.equal(refs[0].url, "https://new.png", "latest write wins");
    assert.deepEqual(refs[0].extraUrls, ["https://extra.png"]);
  });

  test("second write with new klingElementId replaces old", () => {
    const storage = {};
    storage[cwKey("Hero")] = cwStorageValue({ id: "abc", name: "Hero", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [], klingElementId: null });
    storage[cwKey("Hero")] = cwStorageValue({ id: "abc", name: "Hero", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [], klingElementId: "999" });

    const refs = buildVisualReferences(["Hero"], storage);
    assert.equal(refs[0].klingElementId, "999");
  });

  test("write with same key but different id replaces (element re-created in OpenArt)", () => {
    const storage = {};
    storage[cwKey("Hero")] = cwStorageValue({ id: "old-id", name: "Hero", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] });
    storage[cwKey("Hero")] = cwStorageValue({ id: "new-id", name: "Hero", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] });

    const refs = buildVisualReferences(["Hero"], storage);
    assert.equal(refs[0].id, "new-id");
  });
});

// -----------------------------------------------------------
// Pre-mortem #14: capturedAt field in storage
// The writer stores capturedAt but the reader ignores it.
// If someone adds stale-cache logic that depends on this
// field, tests should ensure it exists and is valid ISO.
// -----------------------------------------------------------

describe("Storage capturedAt field", () => {
  test("cwStorageValue does NOT include capturedAt (added by writer separately)", () => {
    const val = cwStorageValue({ id: "x", name: "Test", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] });
    assert.equal(val.capturedAt, undefined, "cwStorageValue doesn't set capturedAt — the real writer does");
  });

  test("buildVisualReferences ignores capturedAt in stored data", () => {
    const storage = {
      "openart-cw:test": {
        ...cwStorageValue({ id: "x", name: "Test", url: "https://x.png", imageUrl: "https://x.png", extraUrls: [] }),
        capturedAt: "2026-05-01T00:00:00.000Z",
      },
    };
    const refs = buildVisualReferences(["Test"], storage);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].capturedAt, undefined, "capturedAt must not leak into visual references");
  });
});

// -----------------------------------------------------------
// Pre-mortem #15: Pending visual references merge (inject path)
// openart-page.js merges pendingVisualReferences into the request
// body via spread: [...existing, ...pending]. If the user already
// selected characters in the C&W panel AND PromptSync sends refs,
// duplicates are produced.
// -----------------------------------------------------------

// From openart-page.js: the merge logic in the fetch interceptor
function mergeVisualReferences(existingBody, pendingRefs) {
  if (!pendingRefs?.length) return existingBody;
  return {
    ...existingBody,
    visualReferences: [...(existingBody.visualReferences || []), ...pendingRefs],
  };
}

describe("Pending visual references merge (inject path)", () => {
  test("appends pending refs to existing body refs", () => {
    const body = {
      prompt: "@Sisyphus pushes",
      visualReferences: [{ type: "character", id: "existing-1", name: "Existing" }],
    };
    const pending = [{ type: "character", id: "pending-1", name: "Pending" }];
    const merged = mergeVisualReferences(body, pending);
    assert.equal(merged.visualReferences.length, 2);
    assert.equal(merged.visualReferences[0].id, "existing-1");
    assert.equal(merged.visualReferences[1].id, "pending-1");
  });

  test("creates visualReferences array when body has none", () => {
    const body = { prompt: "test" };
    const pending = [{ type: "character", id: "p1", name: "P" }];
    const merged = mergeVisualReferences(body, pending);
    assert.equal(merged.visualReferences.length, 1);
  });

  test("does not modify body when pending is empty", () => {
    const body = { prompt: "test", visualReferences: [{ id: "e1" }] };
    const merged = mergeVisualReferences(body, []);
    assert.deepEqual(merged, body);
  });

  test("does not modify body when pending is null", () => {
    const body = { prompt: "test" };
    const merged = mergeVisualReferences(body, null);
    assert.deepEqual(merged, body);
  });

  test("KNOWN ISSUE: duplicate refs when same element in both existing and pending", () => {
    const ref = { type: "character", id: "sMZua1I5r8EDomX77de3", name: "Sisyphus" };
    const body = { prompt: "test", visualReferences: [ref] };
    const pending = [ref];
    const merged = mergeVisualReferences(body, pending);
    assert.equal(merged.visualReferences.length, 2, "duplicates are NOT deduplicated");
    assert.equal(merged.visualReferences[0].id, merged.visualReferences[1].id);
  });
});

// -----------------------------------------------------------
// Pre-mortem #16: Direct generate passes refs through unchanged
// The panel builds refs and sends them to shared.js which sends
// them to openart-page.js. The refs must not be transformed,
// filtered, or reordered along the way (only the prompt is
// transformed). This tests the contract.
// -----------------------------------------------------------

describe("Direct generate ref pass-through contract", () => {
  test("refs built by panel are the exact refs sent to API", () => {
    const refs = buildVisualReferences(["Sisyphus", "Boulder"], FULL_STORAGE);

    // Simulate what shared.js does: transform prompt, pass refs through
    const prompt = "@Sisyphus pushes @Boulder";
    const transformed = transformPrompt(prompt, refs);

    // The API call should get: { prompt: transformed, visualReferences: refs }
    // refs must NOT be modified
    assert.equal(refs[0].type, "character");
    assert.equal(refs[0].name, "Sisyphus", "ref.name preserved (used for transform, not removed)");
    assert.equal(refs[0].id, "sMZua1I5r8EDomX77de3");
    assert.ok(refs[0].metadata, "metadata must survive pass-through");
    assert.ok(refs[0].extraUrls, "extraUrls must survive pass-through");

    // But the prompt IS transformed
    assert.ok(!transformed.includes("@Sisyphus"));
    assert.ok(transformed.includes("@sMZua1I5r8EDomX77de3"));
  });

  test("seedance refs pass through without transform", () => {
    const refs = buildSeedanceVisualReferences([
      { resourceId: "r1", url: "https://img1.png", code: "1A" },
      { resourceId: "r2", url: "https://img2.png", code: "2A" },
    ]);

    const prompt = "A video of mythological scene";
    const transformed = transformPrompt(prompt, refs);

    assert.equal(transformed, prompt, "seedance prompts have no @-mentions to transform");
    assert.equal(refs.length, 2);
    assert.equal(refs[0].type, "image");
    assert.equal(refs[0].id, "r1");
    assert.equal(refs[1].id, "r2");
  });
});

// -----------------------------------------------------------
// Pre-mortem #17: Duplicate API entries with same name
// If the API returns two elements with the same characterName,
// mapApiCharacters returns both — but buildStorage uses the
// name as key, so the last one wins silently.
// -----------------------------------------------------------

describe("Duplicate element names in API response", () => {
  test("mapApiCharacters returns both entries", () => {
    const dup1 = { ...SISYPHUS_API, id: "id-1" };
    const dup2 = { ...SISYPHUS_API, id: "id-2" };
    const result = mapApiCharacters([dup1, dup2], "character");
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "id-1");
    assert.equal(result[1].id, "id-2");
  });

  test("buildStorage last-write-wins for same name", () => {
    const dup1 = { ...SISYPHUS_API, id: "id-1", imageUrls: ["https://old.png"] };
    const dup2 = { ...SISYPHUS_API, id: "id-2", imageUrls: ["https://new.png"] };
    const storage = buildStorage({ featureType: "character", entries: [dup1, dup2] });
    const stored = storage[cwKey("Sisyphus")];
    assert.equal(stored.id, "id-2", "second entry overwrites first");
    assert.equal(stored.url, "https://new.png");
  });
});

// -----------------------------------------------------------
// Pre-mortem #18: cwKey case-sensitivity verification
// Storage keys are lowercased, so lookup is case-insensitive.
// But the caller must know this — passing "SISYPHUS" to
// cwKey should still find the entry stored by cwKey("Sisyphus").
// -----------------------------------------------------------

describe("Storage lookup case invariance", () => {
  test("cwKey lowercases input", () => {
    assert.equal(cwKey("SISYPHUS"), "openart-cw:sisyphus");
    assert.equal(cwKey("Sisyphus"), "openart-cw:sisyphus");
    assert.equal(cwKey("sisyphus"), "openart-cw:sisyphus");
  });

  test("any case of element name finds the stored entry", () => {
    const cases = ["Sisyphus", "SISYPHUS", "sisyphus", "SiSyPhUs"];
    for (const name of cases) {
      const stored = FULL_STORAGE[cwKey(name)];
      assert.ok(stored, `cwKey("${name}") should find stored entry`);
      assert.equal(stored.id, "sMZua1I5r8EDomX77de3");
    }
  });
});

// -----------------------------------------------------------
// Pre-mortem #19: Empty visual references array vs null/undefined
// Both mergeVisualReferences and transformPrompt should handle
// these consistently — ensure no TypeError on iteration.
// -----------------------------------------------------------

describe("Empty vs null visual references consistency", () => {
  test("buildVisualReferences with empty storage", () => {
    const refs = buildVisualReferences(["Sisyphus"], {});
    assert.deepEqual(refs, []);
  });

  test("buildSeedanceVisualReferences with empty array", () => {
    const refs = buildSeedanceVisualReferences([]);
    assert.deepEqual(refs, []);
  });

  test("mergeVisualReferences with undefined pending", () => {
    const body = { prompt: "test" };
    const merged = mergeVisualReferences(body, undefined);
    assert.deepEqual(merged, body);
  });

  test("transformPrompt with empty array is identity", () => {
    assert.equal(transformPrompt("@Sisyphus test", []), "@Sisyphus test");
  });
});

// -----------------------------------------------------------
// Pre-mortem #20: Special characters in element names
// Underscores, hyphens, and numbers in names — these are common
// in this project (Mary_Present, Tomb_Exterior). Verify storage
// round-trip and prompt transform handle them.
// -----------------------------------------------------------

describe("Special characters in element names", () => {
  test("underscore names round-trip through storage", () => {
    const api = { ...MARY_PRESENT_API, characterName: "Tomb_Exterior" };
    const [el] = mapApiCharacters([api], "character");
    assert.equal(el.name, "Tomb_Exterior");
    const key = cwKey(el.name);
    assert.equal(key, "openart-cw:tomb_exterior");
    assert.equal(cwKey("Tomb_Exterior"), key);
  });

  test("hyphenated names work in storage", () => {
    const api = { ...SISYPHUS_API, characterName: "Half-God" };
    const [el] = mapApiCharacters([api], "character");
    assert.equal(cwKey(el.name), "openart-cw:half-god");
    assert.equal(cwKey("Half-God"), "openart-cw:half-god");
  });

  test("numeric suffix names work in storage", () => {
    const api = { ...SISYPHUS_API, characterName: "Guard2" };
    const [el] = mapApiCharacters([api], "character");
    assert.equal(cwKey(el.name), "openart-cw:guard2");
  });

  test("prompt transform with underscore name", () => {
    const storage = {
      "openart-cw:tomb_exterior": cwStorageValue({
        id: "tomb-id", name: "Tomb_Exterior", url: "https://x.png",
        imageUrl: "https://x.png", extraUrls: [],
      }),
    };
    const refs = buildVisualReferences(["Tomb_Exterior"], storage);
    const result = transformPrompt("@Tomb_Exterior in the distance", refs);
    assert.equal(result, "@tomb-id in the distance");
  });
});

describe("mapApiCharacters with both characterName and worldName", () => {
  test("characterName takes priority over worldName via || operator", () => {
    const api = {
      id: "dual-id",
      characterName: "Hero",
      worldName: "Landscape",
      featureType: "character",
      imageUrls: ["https://x.png"],
    };
    const [el] = mapApiCharacters([api], "character");
    assert.equal(el.name, "Hero", "characterName wins via || short-circuit");
  });

  test("worldName used when characterName is empty string", () => {
    const api = {
      id: "dual-id",
      characterName: "",
      worldName: "Landscape",
      featureType: "background",
      imageUrls: ["https://x.png"],
    };
    const [el] = mapApiCharacters([api], "background");
    assert.equal(el.name, "Landscape");
  });

  test("worldName used when characterName is undefined", () => {
    const api = {
      id: "dual-id",
      worldName: "Valley",
      featureType: "background",
      imageUrls: ["https://x.png"],
    };
    const [el] = mapApiCharacters([api], "background");
    assert.equal(el.name, "Valley");
  });
});

describe("Prompt transform @Name at end of string", () => {
  test("@Name at end of string (no trailing character) is replaced", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("Looking at @Sisyphus", refs);
    assert.equal(result, "Looking at @sMZua1I5r8EDomX77de3");
  });

  test("@Name as entire string is replaced", () => {
    const refs = buildVisualReferences(["Sisyphus"], FULL_STORAGE);
    const result = transformPrompt("@Sisyphus", refs);
    assert.equal(result, "@sMZua1I5r8EDomX77de3");
  });
});

describe("buildVisualReferences with incomplete storage entries", () => {
  test("storage entry missing name field still produces ref (name from entry)", () => {
    const storage = {
      "openart-cw:ghost": {
        id: "ghost-id",
        type: "character",
        url: "https://x.png",
        imageUrl: "https://x.png",
        extraUrls: [],
        klingElementId: null,
      },
    };
    const refs = buildVisualReferences(["Ghost"], storage);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].id, "ghost-id");
    assert.equal(refs[0].name, undefined, "name comes from cwElement.name which is missing");
  });

  test("storage entry with null url produces ref with null url", () => {
    const storage = {
      "openart-cw:test": {
        id: "t-id",
        name: "Test",
        type: "character",
        url: null,
        imageUrl: null,
        extraUrls: [],
        klingElementId: null,
      },
    };
    const refs = buildVisualReferences(["Test"], storage);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].url, null);
  });
});

// -----------------------------------------------------------
// Pre-mortem #21: stripVideoPromptMeta edge cases
// The stripping is line-based with regexes. Edge cases include
// multi-line negative prompts, metadata at unusual positions,
// and interaction with @-mentions in negative prompt lines.
// -----------------------------------------------------------

function stripVideoPromptMeta(body) {
  if (!body) return body;
  return body
    .replace(/^\[MOTION SCALE:[^\]]*\]\s*$/gm, "")
    .replace(/^Aspect ratio:.*$/gm, "")
    .replace(/^Negative prompt:.*$/gm, "")
    .replace(/\n---\n[\s\S]*$/, "")
    .trim();
}

describe("stripVideoPromptMeta edge cases", () => {
  test("MOTION SCALE with different values", () => {
    assert.equal(stripVideoPromptMeta("[MOTION SCALE: 0.3]"), "");
    assert.equal(stripVideoPromptMeta("[MOTION SCALE: 1.0]"), "");
    assert.equal(stripVideoPromptMeta("[MOTION SCALE: 0]"), "");
  });

  test("MOTION SCALE mid-text is NOT stripped", () => {
    const prompt = "A [MOTION SCALE: 0.5] embedded in text.";
    assert.equal(stripVideoPromptMeta(prompt), prompt);
  });

  test("Aspect ratio with various formats", () => {
    assert.equal(stripVideoPromptMeta("Aspect ratio: 16:9"), "");
    assert.equal(stripVideoPromptMeta("Aspect ratio: 9:16"), "");
    assert.equal(stripVideoPromptMeta("Aspect ratio: 1:1"), "");
  });

  test("Negative prompt with @-mention is stripped entirely", () => {
    const prompt = "[Subject]: @hero.\nNegative prompt: @hero blur dark.";
    const result = stripVideoPromptMeta(prompt);
    assert.equal(result, "[Subject]: @hero.");
  });

  test("--- separator strips everything after", () => {
    const prompt = "[Subject]: @hero.\n---\nmodel: kling-v3\nduration: 10s";
    assert.equal(stripVideoPromptMeta(prompt), "[Subject]: @hero.");
  });

  test("--- at start of body strips everything", () => {
    const prompt = "Some text\n---\nAll of this gone";
    assert.equal(stripVideoPromptMeta(prompt), "Some text");
  });

  test("multiple meta lines leave only content", () => {
    const prompt = [
      "[Cinematography]: Static. CU.",
      "[Subject]: @peterNightingale removes chasuble.",
      "[Action]: Hands lift fabric.",
      "[MOTION SCALE: 0.5]",
      "Aspect ratio: 16:9",
      "Negative prompt: blur, grain, jitter.",
      "---",
      "model: kling-v3",
    ].join("\n");
    const result = stripVideoPromptMeta(prompt);
    assert.ok(result.includes("[Cinematography]:"));
    assert.ok(result.includes("[Subject]:"));
    assert.ok(result.includes("[Action]:"));
    assert.ok(!result.includes("MOTION SCALE"));
    assert.ok(!result.includes("Aspect ratio"));
    assert.ok(!result.includes("Negative prompt"));
    assert.ok(!result.includes("model:"));
  });

  test("preserves blank lines between content blocks", () => {
    const prompt = "[Subject]: @hero.\n\n[Action]: walks.";
    assert.equal(stripVideoPromptMeta(prompt), prompt);
  });

  test("empty string returns empty", () => {
    assert.equal(stripVideoPromptMeta(""), "");
  });
});

// -----------------------------------------------------------
// Pre-mortem #22: getPromptForSite with missing prompt objects
// Each site checks different prompt fields. If none exist,
// null is returned and the injection should show a fallback.
// -----------------------------------------------------------

function getPromptForSite(shot, site) {
  if (site === "midjourney") {
    return shot.mjPrompt?.body ?? null;
  }
  if (site === "openart-video") {
    const raw = shot.klingPrompt?.body ?? shot.seedancePrompt?.body ?? null;
    return stripVideoPromptMeta(raw);
  }
  if (site === "openart-image") {
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
  }
  if (site === "seedance") {
    return shot.seedancePrompt?.body ?? null;
  }
  if (site === "googleflow") {
    if (shot.mjPrompt?.meta?.platform === "googleflow") {
      return shot.mjPrompt.body;
    }
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
  }
  return null;
}

describe("getPromptForSite", () => {
  test("midjourney returns mjPrompt.body", () => {
    assert.equal(getPromptForSite({ mjPrompt: { body: "mj body" } }, "midjourney"), "mj body");
  });

  test("midjourney returns null when no mjPrompt", () => {
    assert.equal(getPromptForSite({}, "midjourney"), null);
  });

  test("openart-video prefers klingPrompt over seedancePrompt", () => {
    const shot = {
      klingPrompt: { body: "kling body" },
      seedancePrompt: { body: "seedance body" },
    };
    assert.equal(getPromptForSite(shot, "openart-video"), "kling body");
  });

  test("openart-video falls back to seedancePrompt", () => {
    assert.equal(
      getPromptForSite({ seedancePrompt: { body: "seedance body" } }, "openart-video"),
      "seedance body"
    );
  });

  test("openart-video strips meta from prompt", () => {
    const shot = { klingPrompt: { body: "content.\n[MOTION SCALE: 0.5]" } };
    assert.equal(getPromptForSite(shot, "openart-video"), "content.");
  });

  test("openart-video returns null when no prompts", () => {
    assert.equal(getPromptForSite({}, "openart-video"), null);
  });

  test("openart-image prefers nanoBanana over mjPrompt", () => {
    const shot = { nanoBanana: { body: "nb body" }, mjPrompt: { body: "mj body" } };
    assert.equal(getPromptForSite(shot, "openart-image"), "nb body");
  });

  test("openart-image falls back to mjPrompt", () => {
    assert.equal(getPromptForSite({ mjPrompt: { body: "mj body" } }, "openart-image"), "mj body");
  });

  test("seedance returns seedancePrompt.body", () => {
    assert.equal(getPromptForSite({ seedancePrompt: { body: "sd body" } }, "seedance"), "sd body");
  });

  test("seedance returns null when no seedancePrompt", () => {
    assert.equal(getPromptForSite({}, "seedance"), null);
  });

  test("googleflow prefers mjPrompt when platform is googleflow", () => {
    const shot = {
      mjPrompt: { body: "gf mj body", meta: { platform: "googleflow" } },
      nanoBanana: { body: "nb body" },
    };
    assert.equal(getPromptForSite(shot, "googleflow"), "gf mj body");
  });

  test("googleflow falls back to nanoBanana when platform is not googleflow", () => {
    const shot = {
      mjPrompt: { body: "mj body", meta: { platform: "midjourney" } },
      nanoBanana: { body: "nb body" },
    };
    assert.equal(getPromptForSite(shot, "googleflow"), "nb body");
  });

  test("googleflow falls back to mjPrompt when no nanoBanana", () => {
    const shot = { mjPrompt: { body: "mj body" } };
    assert.equal(getPromptForSite(shot, "googleflow"), "mj body");
  });

  test("unknown site returns null", () => {
    assert.equal(getPromptForSite({ mjPrompt: { body: "x" } }, "dalle"), null);
  });
});

// -----------------------------------------------------------
// Pre-mortem #23: C&W re-capture type inversion
// The page script inverts "world" → "background" when
// re-broadcasting C&W elements from a generation response.
// This is critical: if someone removes the inversion, the
// writer persists "world" type, which doesn't match the
// reader's expectation of "background" for environments.
// -----------------------------------------------------------

describe("C&W re-capture type inversion", () => {
  function invertType(type) {
    return type === "world" ? "background" : "character";
  }

  test("world → background", () => {
    assert.equal(invertType("world"), "background");
  });

  test("character → character", () => {
    assert.equal(invertType("character"), "character");
  });

  test("image → character (unexpected type defaults)", () => {
    assert.equal(invertType("image"), "character");
  });

  test("undefined → character", () => {
    assert.equal(invertType(undefined), "character");
  });

  test("inversion round-trips with cwDataToVisualRef", () => {
    // cwDataToVisualRef maps background → world resourceType
    // Re-capture maps world → background type
    // So: background → world → background (round-trip)
    const stored = { type: "background" };
    const refResourceType = stored.type === "background" ? "world" : "character";
    const recapturedType = invertType(refResourceType);
    assert.equal(recapturedType, "background", "round-trip preserves original type");
  });

  test("character round-trip", () => {
    const stored = { type: "character" };
    const refResourceType = stored.type === "background" ? "world" : "character";
    const recapturedType = invertType(refResourceType);
    assert.equal(recapturedType, "character");
  });
});

// -----------------------------------------------------------
// Pre-mortem #24: idMap and prompt transform interaction
// with real multi-line kling prompt from ends-cross project.
// Tests the complete chain with labeled blocks.
// -----------------------------------------------------------

describe("idMap transform with full kling prompt structure", () => {
  test("real 1B prompt — all blocks preserved, elements replaced", () => {
    const idMap = {
      peterNightingale: "TCOmrNbxzys8WExQjSrI",
      peterChurchA: "2kJ78EmaLx094qsWX1CU",
    };
    const prompt = [
      "[Cinematography]: Static. MS from the nave looking toward the altar. No camera movement.",
      "[Subject]: @peterNightingale — removes the chasuble, folds it with practiced care, places it into the vestment cabinet to his left.",
      "[Action]: Hands lift the chasuble over his head in a smooth, practiced motion. He folds the fabric precisely, each fold deliberate.",
      "[Environment]: @peterChurchA — warm morning light through stained glass.",
      "[Lighting/Style]: Kodak Portra 400. Golden morning stained glass creates subtle color shifts on vestment fabric.",
      "[Technical]: No camera movement. Static composition.",
    ].join("\n");

    let transformed = prompt;
    for (const [name, id] of Object.entries(idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(!transformed.includes("@peterNightingale"));
    assert.ok(!transformed.includes("@peterChurchA"));
    assert.ok(transformed.includes("@TCOmrNbxzys8WExQjSrI"));
    assert.ok(transformed.includes("@2kJ78EmaLx094qsWX1CU"));
    assert.ok(transformed.includes("[Cinematography]:"));
    assert.ok(transformed.includes("[Subject]:"));
    assert.ok(transformed.includes("[Action]:"));
    assert.ok(transformed.includes("[Environment]:"));
    assert.ok(transformed.includes("[Lighting/Style]:"));
    assert.ok(transformed.includes("[Technical]:"));
    assert.ok(transformed.includes("Kodak Portra 400"));
  });

  test("prompt after stripVideoPromptMeta still has @-mentions", () => {
    const rawPrompt = [
      "[Subject]: @peterNightingale walks.",
      "[MOTION SCALE: 0.5]",
      "Aspect ratio: 16:9",
      "Negative prompt: blur.",
    ].join("\n");

    const stripped = stripVideoPromptMeta(rawPrompt);
    assert.equal(stripped, "[Subject]: @peterNightingale walks.");
    assert.ok(stripped.includes("@peterNightingale"), "@-mentions survive stripping");
  });

  test("stripping then idMap transform — correct ordering", () => {
    const rawPrompt = [
      "[Subject]: @peterNightingale walks.",
      "[Environment]: @peterChurchA interior.",
      "[MOTION SCALE: 0.5]",
      "Negative prompt: blur.",
    ].join("\n");

    const stripped = stripVideoPromptMeta(rawPrompt);
    const idMap = { peterNightingale: "p-id", peterChurchA: "c-id" };
    let transformed = stripped;
    for (const [name, id] of Object.entries(idMap)) {
      transformed = transformed.replaceAll(`@${name}`, `@${id}`);
    }

    assert.ok(!transformed.includes("@peterNightingale"));
    assert.ok(!transformed.includes("@peterChurchA"));
    assert.ok(!transformed.includes("MOTION SCALE"));
    assert.ok(!transformed.includes("Negative prompt"));
    assert.ok(transformed.includes("@p-id"));
    assert.ok(transformed.includes("@c-id"));
  });
});

// -----------------------------------------------------------
// Pre-mortem #25: direct generate API body shape
// The direct generate path (openart-page.js:44-109) builds
// a specific JSON body. Tests validate the shape.
// -----------------------------------------------------------

describe("direct generate API body shape", () => {
  function buildDirectGenerateBody(prompt, options = {}) {
    const modelSlug = options.model || "nano-banana-2";
    return {
      prompt,
      imageCount: 1,
      aspectRatio: options.aspectRatio || "9:16",
      resolution: options.resolution || "1K",
      autoEnhancePrompt: options.autoEnhancePrompt ?? true,
      visualReferences: options.visualReferences || [],
      enableUnlimited: true,
      model: modelSlug,
      projectId: options.projectId,
      folderId: null,
    };
  }

  test("default body shape", () => {
    const body = buildDirectGenerateBody("A hero walks.", { projectId: "proj-123" });
    assert.equal(body.prompt, "A hero walks.");
    assert.equal(body.imageCount, 1);
    assert.equal(body.aspectRatio, "9:16");
    assert.equal(body.resolution, "1K");
    assert.equal(body.autoEnhancePrompt, true);
    assert.deepEqual(body.visualReferences, []);
    assert.equal(body.enableUnlimited, true);
    assert.equal(body.model, "nano-banana-2");
    assert.equal(body.projectId, "proj-123");
    assert.equal(body.folderId, null);
  });

  test("custom model overrides default", () => {
    const body = buildDirectGenerateBody("test", { model: "kling-v3", projectId: "p" });
    assert.equal(body.model, "kling-v3");
  });

  test("custom aspect ratio", () => {
    const body = buildDirectGenerateBody("test", { aspectRatio: "16:9", projectId: "p" });
    assert.equal(body.aspectRatio, "16:9");
  });

  test("custom resolution", () => {
    const body = buildDirectGenerateBody("test", { resolution: "720p", projectId: "p" });
    assert.equal(body.resolution, "720p");
  });

  test("autoEnhancePrompt can be disabled", () => {
    const body = buildDirectGenerateBody("test", { autoEnhancePrompt: false, projectId: "p" });
    assert.equal(body.autoEnhancePrompt, false);
  });

  test("visual references passed through", () => {
    const refs = [{ id: "a", type: "character" }];
    const body = buildDirectGenerateBody("test", { visualReferences: refs, projectId: "p" });
    assert.equal(body.visualReferences.length, 1);
    assert.equal(body.visualReferences[0].id, "a");
  });

  test("API URL uses model slug", () => {
    const modelSlug = "nano-banana-2";
    const apiUrl = `/suite/api/forms/creations/create-image%3Areference%3A${modelSlug}`;
    assert.ok(apiUrl.includes(modelSlug));
    assert.ok(apiUrl.includes("/suite/api/forms/creations/"));
  });
});

// -----------------------------------------------------------
// Pre-mortem #26: projectId capture and persistence
// The page script captures projectId from /projects/default
// and stores it. The content script persists it to
// chrome.storage.local. Multiple sources can set it.
// -----------------------------------------------------------

describe("projectId capture sources", () => {
  test("capturedProjectId from /projects/default response", () => {
    const state = { capturedProjectId: null };
    const data = { projectId: "proj-from-default" };
    if (!state.capturedProjectId && data?.projectId) {
      state.capturedProjectId = data.projectId;
    }
    assert.equal(state.capturedProjectId, "proj-from-default");
  });

  test("capturedProjectId not overwritten if already set", () => {
    const state = { capturedProjectId: "existing-id" };
    const data = { projectId: "new-id" };
    if (!state.capturedProjectId && data?.projectId) {
      state.capturedProjectId = data.projectId;
    }
    assert.equal(state.capturedProjectId, "existing-id");
  });

  test("capturedProjectId from creation requestBody", () => {
    const state = { capturedProjectId: null };
    const requestBody = { projectId: "proj-from-creation", prompt: "test" };
    if (requestBody?.projectId) state.capturedProjectId = requestBody.projectId;
    assert.equal(state.capturedProjectId, "proj-from-creation");
  });

  test("creation requestBody projectId overwrites previous", () => {
    const state = { capturedProjectId: "old-id" };
    const requestBody = { projectId: "new-id", prompt: "test" };
    if (requestBody?.projectId) state.capturedProjectId = requestBody.projectId;
    assert.equal(state.capturedProjectId, "new-id");
  });

  test("set-project-id message sets capturedProjectId", () => {
    const state = { capturedProjectId: null };
    const event = { data: { type: "promptsync-set-project-id", projectId: "msg-id" } };
    if (event.data?.type === "promptsync-set-project-id") {
      state.capturedProjectId = event.data.projectId;
    }
    assert.equal(state.capturedProjectId, "msg-id");
  });

  test("null projectId in response does not set state", () => {
    const state = { capturedProjectId: null };
    const data = { projectId: null };
    if (!state.capturedProjectId && data?.projectId) {
      state.capturedProjectId = data.projectId;
    }
    assert.equal(state.capturedProjectId, null);
  });
});

// -----------------------------------------------------------
// Pre-mortem #27: state.currentTarget snapshot and clearing
// The page script snapshots currentTarget before a creation
// and clears it. If two creations fire rapidly, the second
// gets null target.
// -----------------------------------------------------------

describe("currentTarget snapshot and clearing", () => {
  test("snapshot captures target before clearing", () => {
    const state = { currentTarget: "shot:1B" };
    const snapshotTarget = state.currentTarget;
    state.currentTarget = null;
    assert.equal(snapshotTarget, "shot:1B");
    assert.equal(state.currentTarget, null);
  });

  test("null target stays null after snapshot", () => {
    const state = { currentTarget: null };
    const snapshotTarget = state.currentTarget;
    state.currentTarget = null;
    assert.equal(snapshotTarget, null);
  });

  test("rapid creations — second gets null", () => {
    const state = { currentTarget: "shot:1B" };

    const snap1 = state.currentTarget;
    state.currentTarget = null;
    assert.equal(snap1, "shot:1B");

    const snap2 = state.currentTarget;
    state.currentTarget = null;
    assert.equal(snap2, null, "second creation gets no target");
  });

  test("clear-pending resets target", () => {
    const state = { currentTarget: "shot:1B" };
    // Simulates promptsync-clear-pending handler
    state.currentTarget = null;
    assert.equal(state.currentTarget, null);
  });
});

// -----------------------------------------------------------
// Pre-mortem #28: pendingVisualReferences merge with idMap
// Both transforms happen in sequence on the same request.
// The merge modifies args[1].body, then idMap reads from
// args[1].body again. Verify they compose correctly.
// -----------------------------------------------------------

describe("pendingVisualReferences + idMap composition", () => {
  function simulateFetchInterceptor(rawBodyStr, pendingVisualRefs, pendingIdMap) {
    let body = JSON.parse(rawBodyStr);
    let args1Body = rawBodyStr;

    // Step 1: merge visual references
    if (pendingVisualRefs?.length) {
      body.visualReferences = [...(body.visualReferences || []), ...pendingVisualRefs];
      args1Body = JSON.stringify(body);
    }

    // Step 2: apply idMap (re-parses from args1Body like the real code)
    if (pendingIdMap) {
      const reparsed = JSON.parse(args1Body);
      if (reparsed.prompt && typeof reparsed.prompt === "string") {
        for (const [name, id] of Object.entries(pendingIdMap)) {
          reparsed.prompt = reparsed.prompt.replaceAll(`@${name}`, `@${id}`);
        }
      }
      body = reparsed;
    }

    return body;
  }

  test("both transforms applied — refs merged + prompt transformed", () => {
    const raw = JSON.stringify({
      prompt: "@peterNightingale walks.",
      visualReferences: [],
    });
    const refs = [{ id: "p-id", type: "character", name: "peterNightingale" }];
    const idMap = { peterNightingale: "p-id" };

    const result = simulateFetchInterceptor(raw, refs, idMap);
    assert.equal(result.visualReferences.length, 1);
    assert.equal(result.prompt, "@p-id walks.");
  });

  test("only refs — no idMap", () => {
    const raw = JSON.stringify({ prompt: "@hero walks.", visualReferences: [] });
    const refs = [{ id: "r1", type: "character" }];

    const result = simulateFetchInterceptor(raw, refs, null);
    assert.equal(result.visualReferences.length, 1);
    assert.equal(result.prompt, "@hero walks.", "prompt unchanged without idMap");
  });

  test("only idMap — no refs", () => {
    const raw = JSON.stringify({ prompt: "@hero walks.", visualReferences: [] });
    const idMap = { hero: "hero-id" };

    const result = simulateFetchInterceptor(raw, null, idMap);
    assert.equal(result.visualReferences.length, 0);
    assert.equal(result.prompt, "@hero-id walks.");
  });

  test("neither — body unchanged", () => {
    const raw = JSON.stringify({ prompt: "@hero walks.", visualReferences: [] });

    const result = simulateFetchInterceptor(raw, null, null);
    assert.equal(result.prompt, "@hero walks.");
    assert.equal(result.visualReferences.length, 0);
  });

  test("idMap re-parses body after refs merge — sees merged state", () => {
    const raw = JSON.stringify({
      prompt: "@peterNightingale and @peterChurchA.",
      visualReferences: [{ id: "existing", type: "character" }],
    });
    const refs = [
      { id: "TCOmrNbxzys8WExQjSrI", type: "character" },
      { id: "2kJ78EmaLx094qsWX1CU", type: "world" },
    ];
    const idMap = {
      peterNightingale: "TCOmrNbxzys8WExQjSrI",
      peterChurchA: "2kJ78EmaLx094qsWX1CU",
    };

    const result = simulateFetchInterceptor(raw, refs, idMap);
    assert.equal(result.visualReferences.length, 3);
    assert.ok(!result.prompt.includes("@peterNightingale"));
    assert.ok(!result.prompt.includes("@peterChurchA"));
  });
});

// -----------------------------------------------------------
// Pre-mortem #29: fetchCwElements API response parsing
// openart-page.js:121-161 fetches C&W elements for both
// character and background featureTypes and broadcasts them.
// -----------------------------------------------------------

describe("fetchCwElements response parsing", () => {
  test("maps character API response correctly", () => {
    const apiChars = [
      {
        id: "char-1",
        characterName: "Hero",
        featureType: "character",
        imageUrls: ["https://img1.png", "https://img2.png"],
        klingElementId: "111",
      },
    ];
    const elements = mapApiCharacters(apiChars, "character");
    assert.equal(elements.length, 1);
    assert.equal(elements[0].id, "char-1");
    assert.equal(elements[0].name, "Hero");
    assert.equal(elements[0].type, "character");
    assert.equal(elements[0].url, "https://img1.png");
    assert.deepEqual(elements[0].extraUrls, ["https://img2.png"]);
    assert.equal(elements[0].klingElementId, "111");
  });

  test("maps background API response correctly", () => {
    const apiBgs = [
      {
        id: "bg-1",
        worldName: "Castle",
        featureType: "background",
        imageUrls: ["https://bg1.png"],
        klingElementId: "222",
      },
    ];
    const elements = mapApiCharacters(apiBgs, "background");
    assert.equal(elements.length, 1);
    assert.equal(elements[0].name, "Castle");
    assert.equal(elements[0].type, "background");
  });

  test("combined character + background fetch", () => {
    const chars = mapApiCharacters(
      [{ id: "c1", characterName: "Hero", featureType: "character", imageUrls: ["https://c.png"], klingElementId: "1" }],
      "character"
    );
    const bgs = mapApiCharacters(
      [{ id: "b1", worldName: "Forest", featureType: "background", imageUrls: ["https://b.png"], klingElementId: "2" }],
      "background"
    );
    const all = [...chars, ...bgs];
    assert.equal(all.length, 2);
    assert.equal(all[0].type, "character");
    assert.equal(all[1].type, "background");
  });

  test("empty API response produces no elements", () => {
    assert.deepEqual(mapApiCharacters([], "character"), []);
    assert.deepEqual(mapApiCharacters([], "background"), []);
  });

  test("API response with limit=50 pagination", () => {
    const chars = Array.from({ length: 50 }, (_, i) => ({
      id: `char-${i}`,
      characterName: `Char${i}`,
      featureType: "character",
      imageUrls: [`https://img${i}.png`],
    }));
    const elements = mapApiCharacters(chars, "character");
    assert.equal(elements.length, 50);
    assert.equal(elements[0].name, "Char0");
    assert.equal(elements[49].name, "Char49");
  });
});

// -----------------------------------------------------------
// Pre-mortem #30: image path vs video path — element handling
// Video path: selectElements → idMap → fetch interceptor
// Image path: deriveElementsFromPrompt → addShotElements →
//   createImageCharacters.selectCharacters (DOM-based)
// These are completely different code paths. Tests verify
// the image path does NOT use idMap.
// -----------------------------------------------------------

describe("image path element handling (no idMap)", () => {
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

  test("image path uses deriveElementsFromPrompt, not selectElements", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA", "marcusReeves"] },
      mjPrompt: { body: "@peterNightingale walks. @marcusReeves stands." },
    };
    const derived = deriveElementsFromPrompt(shot);
    assert.deepEqual(derived.sort(), ["marcusReeves", "peterNightingale"]);
    assert.ok(!derived.includes("peterChurchA"), "unmentioned element filtered out");
  });

  test("image path — all elements returned when none @-mentioned", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA"] },
      mjPrompt: { body: "A man walks through a church." },
    };
    const derived = deriveElementsFromPrompt(shot);
    assert.deepEqual(derived, ["peterNightingale", "peterChurchA"]);
  });

  test("image path — elements are passed to createImageCharacters, not visual-references-react", () => {
    // The image path does:
    // const imageElements = deriveElementsFromPrompt(shot).map(el => el.replace(/^@/, ""));
    // await addShotElements({ ...shot, meta: { ...shot.meta, elements: imageElements } }, project);
    // addShotElements calls: createImageCharacters.selectCharacters(names)
    // NOT: visualReferencesReact.selectElements(names)

    const shot = {
      meta: { elements: ["@peterNightingale"] },
      mjPrompt: { body: "@peterNightingale walks." },
    };
    const derived = deriveElementsFromPrompt(shot);
    const stripped = derived.map((el) => el.replace(/^@/, ""));
    assert.deepEqual(stripped, ["peterNightingale"]);
    // These are passed to createImageCharacters.selectCharacters, which is DOM-based
  });

  test("video path uses selectElements — comparison", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA"] },
    };
    // Video path: (shot.meta?.elements || []).map(el => el.replace(/^@/, ""))
    const videoElements = (shot.meta?.elements || []).map((el) => el.replace(/^@/, ""));
    assert.deepEqual(videoElements, ["peterNightingale", "peterChurchA"]);
    // Video path does NOT filter by prompt mentions — it uses ALL elements
  });

  test("video path passes ALL elements; image path may filter", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA", "marcusReeves"] },
      mjPrompt: { body: "@peterNightingale walks." },
    };

    // Video path: all elements
    const videoElements = shot.meta.elements.map((el) => el.replace(/^@/, ""));
    assert.equal(videoElements.length, 3);

    // Image path: only mentioned elements
    const imageElements = deriveElementsFromPrompt(shot);
    assert.equal(imageElements.length, 1);
    assert.equal(imageElements[0], "peterNightingale");
  });
});

// -----------------------------------------------------------
// Pre-mortem #31: deriveElementsFromPrompt edge cases
// The delimiter-based detection has blind spots: element at
// end of string without trailing punctuation is missed,
// and substring elements can cause false matches.
// -----------------------------------------------------------

describe("deriveElementsFromPrompt edge cases", () => {
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

  test("@element at end of string — NOT detected (known limitation)", () => {
    const shot = {
      meta: { elements: ["hero", "villain"] },
      mjPrompt: { body: "Looking at @hero" },
    };
    const result = deriveElementsFromPrompt(shot);
    // "hero" is NOT matched because "@hero" at end has no trailing delimiter
    assert.deepEqual(result, ["hero", "villain"], "falls back to all elements");
  });

  test("@element followed by semicolon — NOT detected", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero; standing." },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["hero"], "falls back to all elements since ; is not a delimiter");
  });

  test("@element followed by exclamation — NOT detected", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "Look at @hero! Amazing." },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["hero"], "falls back to all elements");
  });

  test("multiple delimiters on same element — detected once", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero walks. @hero, sitting. @hero's hat." },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["hero"]);
  });

  test("element mentioned in both Subject and Action blocks", () => {
    const shot = {
      meta: { elements: ["peterNightingale", "peterChurchA"] },
      mjPrompt: { body: "[Subject]: @peterNightingale walks.\n[Action]: @peterNightingale turns." },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["peterNightingale"]);
    assert.ok(!result.includes("peterChurchA"), "unmentioned element excluded");
  });

  test("substring element name — shorter name can match inside longer", () => {
    const shot = {
      meta: { elements: ["peter", "peterNightingale"] },
      mjPrompt: { body: "@peterNightingale walks." },
    };
    const result = deriveElementsFromPrompt(shot);
    // "@peter" is a substring of "@peterNightingale walks."
    // but "@peter " (with trailing space) does not appear unless there's a space after "peter"
    // "@peterNightingale." includes "@peter" followed by "N" — not a match for any delimiter
    // So only peterNightingale matches (with ".")
    assert.ok(result.includes("peterNightingale"));
  });

  test("tab-separated — NOT detected", () => {
    const shot = {
      meta: { elements: ["hero"] },
      mjPrompt: { body: "@hero\twalks" },
    };
    const result = deriveElementsFromPrompt(shot);
    assert.deepEqual(result, ["hero"], "tab not a delimiter, falls back to all");
  });
});

// -----------------------------------------------------------
// Pre-mortem #32: collectElementVisualReferences vs
// cwDataToVisualRef output shape differences
// The panel and content script build visual refs differently.
// These tests document the divergence.
// -----------------------------------------------------------

describe("panel vs content script visual ref shape divergence", () => {
  function panelRef(cwElement, elementName) {
    const ext = (cwElement.url || "").split(".").pop()?.split("?")[0] || "png";
    const refType = cwElement.type === "background" ? "world" : "character";
    return {
      type: refType,
      id: cwElement.id,
      name: cwElement.name,
      elementName,
      label: cwElement.label || cwElement.name,
      url: cwElement.url,
      imageUrl: cwElement.imageUrl,
      extraUrls: cwElement.extraUrls || [],
      klingElementId: cwElement.klingElementId || null,
      metadata: { media_type: "image", format: ext, width: 1024, height: 1024, file_size_bytes: 0 },
    };
  }

  function contentRef(cw) {
    const urlPath = (cw.url || "").split("/").pop() || "";
    const ext = urlPath.includes(".") ? urlPath.split(".").pop().split("?")[0] : "png";
    return {
      id: cw.id,
      sourceType: "upload",
      userId: "current-user",
      url: cw.imageUrl || cw.url,
      resourceType: cw.type === "background" ? "world" : "character",
      status: "completed",
      isStarred: false,
      isDownloaded: false,
      createdAt: Date.now(),
      input: {
        referenceType: cw.type === "background" ? "world" : "character",
        label: cw.label || cw.name,
        name: cw.name,
        imageUrl: cw.imageUrl || cw.url,
        extraUrls: cw.extraUrls || [],
        klingElementId: cw.klingElementId || null,
      },
      metadata: { media_type: "image", format: ext, width: 1024, height: 1024, file_size_bytes: 0 },
    };
  }

  const CW_CHAR = {
    id: "abc", name: "Hero", type: "character", label: "Hero",
    url: "https://cdn.openart.ai/hero.jpg", imageUrl: "https://cdn.openart.ai/hero.jpg",
    extraUrls: [], klingElementId: "111",
  };

  const CW_BG = {
    id: "def", name: "Forest", type: "background", label: "Forest",
    url: "https://cdn.openart.ai/forest.png", imageUrl: "https://cdn.openart.ai/forest.png",
    extraUrls: [], klingElementId: null,
  };

  test("both produce same id for same element", () => {
    assert.equal(panelRef(CW_CHAR, "hero").id, contentRef(CW_CHAR).id);
  });

  test("panel uses 'type' field; content script uses 'resourceType'", () => {
    const pr = panelRef(CW_CHAR, "hero");
    const cr = contentRef(CW_CHAR);
    assert.equal(pr.type, "character");
    assert.equal(cr.resourceType, "character");
    assert.equal(pr.type, cr.resourceType);
    assert.equal(cr.type, undefined, "content ref has no top-level 'type'");
  });

  test("panel has elementName; content script does not", () => {
    const pr = panelRef(CW_CHAR, "hero");
    const cr = contentRef(CW_CHAR);
    assert.equal(pr.elementName, "hero");
    assert.equal(cr.elementName, undefined);
  });

  test("content script wraps name/imageUrl/extraUrls in input object", () => {
    const cr = contentRef(CW_CHAR);
    assert.equal(cr.input.name, "Hero");
    assert.equal(cr.input.imageUrl, CW_CHAR.imageUrl);
    assert.deepEqual(cr.input.extraUrls, []);
  });

  test("panel has name at top level; content script has it in input", () => {
    const pr = panelRef(CW_CHAR, "hero");
    const cr = contentRef(CW_CHAR);
    assert.equal(pr.name, "Hero");
    assert.equal(cr.input.name, "Hero");
  });

  test("both map background to world", () => {
    assert.equal(panelRef(CW_BG, "forest").type, "world");
    assert.equal(contentRef(CW_BG).resourceType, "world");
  });

  test("content script has sourceType, userId, status; panel does not", () => {
    const cr = contentRef(CW_CHAR);
    assert.equal(cr.sourceType, "upload");
    assert.equal(cr.userId, "current-user");
    assert.equal(cr.status, "completed");

    const pr = panelRef(CW_CHAR, "hero");
    assert.equal(pr.sourceType, undefined);
    assert.equal(pr.userId, undefined);
    assert.equal(pr.status, undefined);
  });
});

// -----------------------------------------------------------
// Pre-mortem #33: generation captured re-persistence
// When a generation's visualReferences include C&W elements,
// the page script re-broadcasts them. The content script then
// re-persists them. This round-trip must preserve data.
// -----------------------------------------------------------

describe("generation re-capture → re-persistence round-trip", () => {
  function recaptureElement(el) {
    return {
      id: el.id,
      name: el.name,
      label: el.label || el.name,
      type: el.type === "world" ? "background" : "character",
      url: el.url,
      imageUrl: el.imageUrl,
      extraUrls: el.extraUrls || [],
      klingElementId: el.klingElementId || null,
    };
  }

  function persistElement(el) {
    if (!el.id || !el.name) return null;
    return {
      key: `openart-cw:${el.name.toLowerCase().trim()}`,
      value: {
        id: el.id,
        name: el.name,
        type: el.type || "character",
        label: el.label || el.name,
        url: el.url,
        imageUrl: el.imageUrl,
        extraUrls: el.extraUrls || [],
        klingElementId: el.klingElementId || null,
      },
    };
  }

  test("character round-trip preserves all fields", () => {
    const original = {
      id: "abc", name: "Hero", type: "character", label: "Hero",
      url: "https://x.jpg", imageUrl: "https://x.jpg",
      extraUrls: ["https://x2.jpg"], klingElementId: "111",
    };

    const recaptured = recaptureElement(original);
    assert.equal(recaptured.type, "character");

    const persisted = persistElement(recaptured);
    assert.equal(persisted.key, "openart-cw:hero");
    assert.equal(persisted.value.id, "abc");
    assert.equal(persisted.value.name, "Hero");
    assert.equal(persisted.value.klingElementId, "111");
    assert.deepEqual(persisted.value.extraUrls, ["https://x2.jpg"]);
  });

  test("world → background → re-persisted as background", () => {
    const original = { id: "def", name: "Forest", type: "world", url: "https://y.png", imageUrl: "https://y.png" };

    const recaptured = recaptureElement(original);
    assert.equal(recaptured.type, "background", "world inverted to background");

    const persisted = persistElement(recaptured);
    assert.equal(persisted.value.type, "background", "persisted as background");
  });

  test("element with no id is not persisted", () => {
    const recaptured = recaptureElement({ id: "", name: "Ghost", type: "character", url: "x" });
    const persisted = persistElement(recaptured);
    assert.equal(persisted, null);
  });

  test("element with no name is not persisted", () => {
    const recaptured = recaptureElement({ id: "abc", name: "", type: "character", url: "x" });
    const persisted = persistElement(recaptured);
    assert.equal(persisted, null);
  });
});

// -----------------------------------------------------------
// Pre-mortem #34: charName in upload-char-images
// panel.js:1330 sends charName: char.element_name || char.name.
// element_name is camelCase. If both exist, element_name wins.
// -----------------------------------------------------------

describe("charName in upload-char-images message", () => {
  function getCharName(char) {
    return char.element_name || char.name;
  }

  test("element_name takes precedence over name", () => {
    const char = { element_name: "peterNightingale", name: "Peter Nightingale" };
    assert.equal(getCharName(char), "peterNightingale");
  });

  test("falls back to name when no element_name", () => {
    const char = { name: "Peter Nightingale" };
    assert.equal(getCharName(char), "Peter Nightingale");
  });

  test("element_name is empty string — falls back to name", () => {
    const char = { element_name: "", name: "Peter Nightingale" };
    assert.equal(getCharName(char), "Peter Nightingale");
  });

  test("both undefined — returns undefined", () => {
    const char = {};
    assert.equal(getCharName(char), undefined);
  });

  test("element_name is always camelCase", () => {
    const examples = ["peterNightingale", "marcusReeves", "peterChurchA", "marcusBedroomE"];
    for (const name of examples) {
      assert.ok(/^[a-z]/.test(name), `${name} must start with lowercase`);
      assert.ok(!name.includes(" "), `${name} must not contain spaces`);
    }
  });
});

// -----------------------------------------------------------
// Pre-mortem #35: selectByNames case-insensitive matching
// create-image-characters.js:173-188 lowercases both the
// target and the card name for comparison. Also strips @.
// -----------------------------------------------------------

describe("selectByNames case-insensitive matching (create-image-characters)", () => {
  function matchesCard(target, cardName) {
    const lower = target.toLowerCase().replace(/^@/, "");
    return cardName.toLowerCase() === lower;
  }

  test("exact match", () => {
    assert.ok(matchesCard("peterNightingale", "peterNightingale"));
  });

  test("case-insensitive match", () => {
    assert.ok(matchesCard("PETERNIGHTINGALE", "peterNightingale"));
    assert.ok(matchesCard("peterNightingale", "PETERNIGHTINGALE"));
  });

  test("@ prefix stripped before matching", () => {
    assert.ok(matchesCard("@peterNightingale", "peterNightingale"));
  });

  test("no match for different names", () => {
    assert.ok(!matchesCard("peterNightingale", "marcusReeves"));
  });

  test("spaces matter — 'peter Nightingale' ≠ 'peterNightingale'", () => {
    assert.ok(!matchesCard("peter Nightingale", "peterNightingale"));
  });

  test("card name with spaces matches target with spaces", () => {
    assert.ok(matchesCard("Peter Nightingale", "Peter Nightingale"));
  });
});

// -----------------------------------------------------------
// Pre-mortem #36: verifySelection in create-image-characters
// After selecting characters, verifySelection checks the
// prompt area for @-prefixed names. This is case-insensitive.
// -----------------------------------------------------------

describe("verifySelection (create-image-characters)", () => {
  function verifySelection(targetNames, promptAreaRefs) {
    const refsLower = promptAreaRefs.map((r) => r.toLowerCase());
    for (const name of targetNames) {
      const lower = name.toLowerCase().replace(/^@/, "");
      if (!refsLower.includes(lower)) return false;
    }
    return true;
  }

  test("all targets found → true", () => {
    assert.ok(verifySelection(
      ["peterNightingale", "marcusReeves"],
      ["peterNightingale", "marcusReeves"]
    ));
  });

  test("case-insensitive verification", () => {
    assert.ok(verifySelection(
      ["peterNightingale"],
      ["PETERNIGHTINGALE"]
    ));
  });

  test("one target missing → false", () => {
    assert.ok(!verifySelection(
      ["peterNightingale", "marcusReeves"],
      ["peterNightingale"]
    ));
  });

  test("empty targets → true (vacuous)", () => {
    assert.ok(verifySelection([], ["peterNightingale"]));
  });

  test("extra refs in prompt area don't cause failure", () => {
    assert.ok(verifySelection(
      ["peterNightingale"],
      ["peterNightingale", "marcusReeves", "peterChurchA"]
    ));
  });

  test("@ prefix stripped from target names", () => {
    assert.ok(verifySelection(
      ["@peterNightingale"],
      ["peterNightingale"]
    ));
  });
});
