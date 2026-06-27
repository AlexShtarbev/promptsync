import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Extracted from shared.js — must match the source exactly
function resolveElementMentions(prompt, elementMap) {
  if (!prompt || !elementMap) return prompt;
  const entries = Object.entries(elementMap)
    .sort((a, b) => b[0].length - a[0].length);
  let resolved = prompt;
  for (const [elementName, displayName] of entries) {
    resolved = resolved.replaceAll(`@${elementName}`, `@${displayName}`);
  }
  return resolved;
}

// ============================================================
// Element maps from real project data
// ============================================================

const EMMANUEL_MAP = {
  TheFather: "The Father",
  TheSon: "The Son",
  CafeWindow: "Cafe Window Wall",
  AncientStreet: "Ancient Street",
};

const EMPTY_MAP = {};

// ============================================================
// Tests
// ============================================================

describe("resolveElementMentions", () => {
  describe("basic resolution", () => {
    test("resolves @TheFather to @The Father", () => {
      const result = resolveElementMentions(
        "@TheFather reaches for his cup",
        EMMANUEL_MAP
      );
      assert.equal(result, "@The Father reaches for his cup");
    });

    test("resolves multiple different elements in one prompt", () => {
      const result = resolveElementMentions(
        "@Emmanuel watches @TheFather across the @CafeWindow",
        EMMANUEL_MAP
      );
      assert.equal(
        result,
        "@Emmanuel watches @The Father across the @Cafe Window Wall"
      );
    });

    test("resolves multiple occurrences of same element", () => {
      const result = resolveElementMentions(
        "@TheFather lifts his cup. @TheFather's hands tremble.",
        EMMANUEL_MAP
      );
      assert.equal(
        result,
        "@The Father lifts his cup. @The Father's hands tremble."
      );
    });

    test("leaves unmapped names unchanged", () => {
      const result = resolveElementMentions(
        "@Emmanuel watches @TheFather",
        EMMANUEL_MAP
      );
      assert.equal(result, "@Emmanuel watches @The Father");
    });

    test("leaves prompt unchanged when no @-mentions match", () => {
      const result = resolveElementMentions(
        "A man sits in a cafe, watching.",
        EMMANUEL_MAP
      );
      assert.equal(result, "A man sits in a cafe, watching.");
    });
  });

  describe("null/empty handling", () => {
    test("returns null prompt as-is", () => {
      assert.equal(resolveElementMentions(null, EMMANUEL_MAP), null);
    });

    test("returns undefined prompt as-is", () => {
      assert.equal(resolveElementMentions(undefined, EMMANUEL_MAP), undefined);
    });

    test("returns empty string as-is", () => {
      assert.equal(resolveElementMentions("", EMMANUEL_MAP), "");
    });

    test("returns prompt unchanged with null elementMap", () => {
      assert.equal(
        resolveElementMentions("@TheFather test", null),
        "@TheFather test"
      );
    });

    test("returns prompt unchanged with undefined elementMap", () => {
      assert.equal(
        resolveElementMentions("@TheFather test", undefined),
        "@TheFather test"
      );
    });

    test("returns prompt unchanged with empty elementMap", () => {
      assert.equal(
        resolveElementMentions("@TheFather test", EMPTY_MAP),
        "@TheFather test"
      );
    });
  });

  describe("substring collision prevention", () => {
    test("longer keys are replaced before shorter prefixes", () => {
      const map = {
        TheSon: "The Son",
        TheSonOfGod: "The Son Of God",
      };
      const result = resolveElementMentions(
        "@TheSonOfGod walks with @TheSon",
        map
      );
      assert.equal(result, "@The Son Of God walks with @The Son");
    });

    test("real project data: no collision between CafeWindow and other keys", () => {
      const result = resolveElementMentions(
        "@CafeWindow glows. @TheFather sits.",
        EMMANUEL_MAP
      );
      assert.equal(result, "@Cafe Window Wall glows. @The Father sits.");
    });

    test("KNOWN LIMITATION: display name containing @+shorter_key causes secondary collision", () => {
      const map = {
        Cafe: "The Cafe",
        CafeWindow: "Cafe Window Wall",
      };
      const result = resolveElementMentions(
        "@CafeWindow glows. @Cafe is warm.",
        map
      );
      assert.equal(
        result,
        "@The Cafe Window Wall glows. @The Cafe is warm.",
        "KNOWN LIMITATION: @CafeWindow → @Cafe Window Wall, then @Cafe in output is replaced again"
      );
    });
  });

  describe("real kling prompt format", () => {
    test("resolves elements in labeled-block prompt", () => {
      const prompt = [
        "[Subject]: @Emmanuel screen-left at his table.",
        "[Action]: @TheFather screen-right, reaching for his cup.",
        "[Environment]: @CafeWindow behind both, morning light flooding through glass.",
      ].join("\n");
      const result = resolveElementMentions(prompt, EMMANUEL_MAP);
      assert.ok(result.includes("@Emmanuel"));
      assert.ok(result.includes("@The Father"));
      assert.ok(result.includes("@Cafe Window Wall"));
      assert.ok(!result.includes("@TheFather"));
      assert.ok(!result.includes("@CafeWindow"));
    });

    test("resolves elements in full kling prompt with metadata", () => {
      const prompt = `[Cinematography]: Static MLS.
[Subject]: @Emmanuel and @TheFather at separate tables.
[Action]: @TheFather's hand trembles reaching for cup.
[MOTION SCALE: 0.3]
Aspect ratio: 16:9
Negative prompt: morphing features`;
      const result = resolveElementMentions(prompt, EMMANUEL_MAP);
      assert.ok(result.includes("@The Father at separate tables"));
      assert.ok(result.includes("@The Father's hand trembles"));
      assert.ok(result.includes("@Emmanuel"));
      assert.ok(result.includes("[MOTION SCALE: 0.3]"));
    });
  });

  describe("possessive and punctuation", () => {
    test("resolves @Name's (possessive)", () => {
      const result = resolveElementMentions(
        "@TheFather's cup rattles",
        EMMANUEL_MAP
      );
      assert.equal(result, "@The Father's cup rattles");
    });

    test("resolves @Name followed by comma", () => {
      const result = resolveElementMentions(
        "@TheFather, alone at his table",
        EMMANUEL_MAP
      );
      assert.equal(result, "@The Father, alone at his table");
    });

    test("resolves @Name followed by period", () => {
      const result = resolveElementMentions(
        "Watching @TheFather.",
        EMMANUEL_MAP
      );
      assert.equal(result, "Watching @The Father.");
    });

    test("resolves @Name at end of string", () => {
      const result = resolveElementMentions(
        "Looking at @TheFather",
        EMMANUEL_MAP
      );
      assert.equal(result, "Looking at @The Father");
    });

    test("resolves @Name as entire string", () => {
      const result = resolveElementMentions("@TheFather", EMMANUEL_MAP);
      assert.equal(result, "@The Father");
    });
  });

  describe("case sensitivity", () => {
    test("exact case match works", () => {
      const result = resolveElementMentions("@TheFather", EMMANUEL_MAP);
      assert.equal(result, "@The Father");
    });

    test("wrong case does NOT match (case-sensitive)", () => {
      const result = resolveElementMentions("@thefather", EMMANUEL_MAP);
      assert.equal(result, "@thefather");
    });

    test("all-caps does NOT match", () => {
      const result = resolveElementMentions("@THEFATHER", EMMANUEL_MAP);
      assert.equal(result, "@THEFATHER");
    });
  });

  describe("no bare-name replacement", () => {
    test("does not replace name without @ prefix", () => {
      const result = resolveElementMentions(
        "TheFather sits alone",
        EMMANUEL_MAP
      );
      assert.equal(result, "TheFather sits alone");
    });

    test("only replaces @-prefixed mentions", () => {
      const result = resolveElementMentions(
        "TheFather and @TheFather are different",
        EMMANUEL_MAP
      );
      assert.equal(result, "TheFather and @The Father are different");
    });
  });

  describe("identity mappings (element_name === display name)", () => {
    test("single-word names that match are not in the map — left unchanged", () => {
      const result = resolveElementMentions("@Emmanuel walks", EMMANUEL_MAP);
      assert.equal(result, "@Emmanuel walks");
    });
  });
});

// ============================================================
// Integration: resolveElementMentions + transformPrompt pipeline
// ============================================================

function transformPrompt(prompt, visualReferences) {
  let transformed = prompt;
  for (const ref of visualReferences || []) {
    if (ref.type === "character" && ref.name && ref.id) {
      transformed = transformed.replaceAll(`@${ref.name}`, `@${ref.id}`);
    }
  }
  return transformed;
}

describe("resolveElementMentions → transformPrompt pipeline", () => {
  const VISUAL_REFS = [
    { type: "character", id: "father-openart-id", name: "The Father" },
    { type: "character", id: "emmanuel-openart-id", name: "Emmanuel" },
    { type: "character", id: "cw-openart-id", name: "Cafe Window Wall" },
  ];

  test("full pipeline: @TheFather → @The Father → @father-openart-id", () => {
    const raw = "@TheFather reaches for his cup";
    const resolved = resolveElementMentions(raw, EMMANUEL_MAP);
    assert.equal(resolved, "@The Father reaches for his cup");
    const transformed = transformPrompt(resolved, VISUAL_REFS);
    assert.equal(transformed, "@father-openart-id reaches for his cup");
  });

  test("pipeline with multiple elements", () => {
    const raw = "@Emmanuel watches @TheFather across @CafeWindow";
    const resolved = resolveElementMentions(raw, EMMANUEL_MAP);
    const transformed = transformPrompt(resolved, VISUAL_REFS);
    assert.equal(
      transformed,
      "@emmanuel-openart-id watches @father-openart-id across @cw-openart-id"
    );
  });

  test("pipeline with unmapped element that matches a visual ref directly", () => {
    const raw = "@Emmanuel walks down @AncientStreet";
    const resolved = resolveElementMentions(raw, EMMANUEL_MAP);
    assert.equal(resolved, "@Emmanuel walks down @Ancient Street");
    const refsWithStreet = [
      ...VISUAL_REFS,
      { type: "character", id: "street-id", name: "Ancient Street" },
    ];
    const transformed = transformPrompt(resolved, refsWithStreet);
    assert.equal(transformed, "@emmanuel-openart-id walks down @street-id");
  });

  test("pipeline with no elementMap (shot has no multi-word elements)", () => {
    const raw = "@Emmanuel walks alone";
    const resolved = resolveElementMentions(raw, null);
    assert.equal(resolved, "@Emmanuel walks alone");
    const transformed = transformPrompt(resolved, VISUAL_REFS);
    assert.equal(transformed, "@emmanuel-openart-id walks alone");
  });

  test("pipeline preserves non-@ text", () => {
    const raw = "[Subject]: @TheFather sits.\n[Environment]: Morning cafe.\nNegative prompt: blur";
    const resolved = resolveElementMentions(raw, EMMANUEL_MAP);
    const transformed = transformPrompt(resolved, VISUAL_REFS);
    assert.ok(transformed.includes("@father-openart-id sits."));
    assert.ok(transformed.includes("[Environment]: Morning cafe."));
    assert.ok(transformed.includes("Negative prompt: blur"));
  });
});
