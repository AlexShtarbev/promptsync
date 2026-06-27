import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Extracted from shared.js — must match the source exactly
function stripVideoPromptMeta(body) {
  if (!body) return body;
  return body
    .replace(/^\[MOTION SCALE:[^\]]*\]\s*$/gm, "")
    .replace(/^Aspect ratio:.*$/gm, "")
    .replace(/^Negative prompt:.*$/gm, "")
    .replace(/\n---\n[\s\S]*$/, "")
    .trim();
}

function withSeedanceStartFrame(body) {
  if (!body) return body;
  if (/@image1\b/i.test(body)) return body;
  return `${body.trimEnd()}\n\nUse @image1 as start frame.`;
}

function getPromptForSite(shot, site) {
  if (site === "midjourney") {
    return shot.mjPrompt?.body ?? null;
  }
  if (site === "openart-video") {
    const isSeedance = shot.meta?.asset_type === "seedance";
    const raw = shot.klingPrompt?.body ?? shot.seedancePrompt?.body ?? null;
    const body = stripVideoPromptMeta(raw);
    return isSeedance ? withSeedanceStartFrame(body) : body;
  }
  if (site === "openart-image") {
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
  }
  if (site === "seedance") {
    return withSeedanceStartFrame(shot.seedancePrompt?.body ?? null);
  }
  if (site === "googleflow") {
    if (shot.mjPrompt?.meta?.platform === "googleflow") {
      return shot.mjPrompt.body;
    }
    return shot.nanoBanana?.body ?? shot.mjPrompt?.body ?? null;
  }
  return null;
}

const FULL_SHOT = {
  mjPrompt: { body: "MJ prompt body", meta: { platform: "mj" } },
  klingPrompt: { body: "Kling prompt body" },
  seedancePrompt: { body: "Seedance prompt body" },
  nanoBanana: { body: "NanoBanana prompt body" },
};

const GOOGLEFLOW_SHOT = {
  mjPrompt: { body: "GoogleFlow prompt body", meta: { platform: "googleflow" } },
  klingPrompt: null,
  seedancePrompt: null,
  nanoBanana: { body: "NB body" },
};

const EMPTY_SHOT = {
  mjPrompt: null,
  klingPrompt: null,
  seedancePrompt: null,
  nanoBanana: null,
};

describe("getPromptForSite", () => {
  describe("midjourney", () => {
    test("returns mjPrompt body", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "midjourney"), "MJ prompt body");
    });

    test("returns null when no mjPrompt", () => {
      assert.equal(getPromptForSite(EMPTY_SHOT, "midjourney"), null);
    });
  });

  describe("openart-video", () => {
    test("prefers klingPrompt", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "openart-video"), "Kling prompt body");
    });

    test("falls back to seedancePrompt", () => {
      const shot = { ...FULL_SHOT, klingPrompt: null };
      assert.equal(getPromptForSite(shot, "openart-video"), "Seedance prompt body");
    });

    test("returns null when neither exists", () => {
      assert.equal(getPromptForSite(EMPTY_SHOT, "openart-video"), null);
    });
  });

  describe("openart-image", () => {
    test("prefers nanoBanana", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "openart-image"), "NanoBanana prompt body");
    });

    test("falls back to mjPrompt", () => {
      const shot = { ...FULL_SHOT, nanoBanana: null };
      assert.equal(getPromptForSite(shot, "openart-image"), "MJ prompt body");
    });

    test("returns null when neither exists", () => {
      assert.equal(getPromptForSite(EMPTY_SHOT, "openart-image"), null);
    });
  });

  describe("seedance", () => {
    test("returns seedancePrompt body with the @image1 start-frame line appended", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "seedance"), "Seedance prompt body\n\nUse @image1 as start frame.");
    });

    test("does not duplicate the start-frame line when the body already has @image1", () => {
      const shot = { seedancePrompt: { body: "Body. Use @image1 as start frame." } };
      assert.equal(getPromptForSite(shot, "seedance"), "Body. Use @image1 as start frame.");
    });

    test("returns null when no seedancePrompt", () => {
      assert.equal(getPromptForSite(EMPTY_SHOT, "seedance"), null);
    });
  });

  describe("openart-video — seedance asset_type", () => {
    test("appends the @image1 start-frame line for seedance shots", () => {
      const shot = { klingPrompt: null, seedancePrompt: { body: "[Subject]: @Pip — reclining." }, meta: { asset_type: "seedance" } };
      assert.equal(getPromptForSite(shot, "openart-video"), "[Subject]: @Pip — reclining.\n\nUse @image1 as start frame.");
    });

    test("does NOT append for non-seedance (kling) shots", () => {
      const shot = { klingPrompt: { body: "[Subject]: @Pip — reclining." }, meta: { asset_type: "kling" } };
      assert.equal(getPromptForSite(shot, "openart-video"), "[Subject]: @Pip — reclining.");
    });
  });

  describe("googleflow", () => {
    test("returns mjPrompt when platform is googleflow", () => {
      assert.equal(getPromptForSite(GOOGLEFLOW_SHOT, "googleflow"), "GoogleFlow prompt body");
    });

    test("falls back to nanoBanana when platform is not googleflow", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "googleflow"), "NanoBanana prompt body");
    });

    test("falls back to mjPrompt when no nanoBanana and not googleflow platform", () => {
      const shot = { ...FULL_SHOT, nanoBanana: null };
      assert.equal(getPromptForSite(shot, "googleflow"), "MJ prompt body");
    });

    test("returns null when nothing available", () => {
      assert.equal(getPromptForSite(EMPTY_SHOT, "googleflow"), null);
    });
  });

  describe("unknown site", () => {
    test("returns null", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "unknown-site"), null);
    });

    test("returns null for empty string", () => {
      assert.equal(getPromptForSite(FULL_SHOT, ""), null);
    });
  });

  describe("openart-video stripping", () => {
    test("strips Negative prompt line", () => {
      const shot = { klingPrompt: { body: "[Subject]: A man.\nNegative prompt: morphing features, extra fingers" } };
      assert.equal(getPromptForSite(shot, "openart-video"), "[Subject]: A man.");
    });

    test("strips MOTION SCALE line", () => {
      const shot = { klingPrompt: { body: "[Subject]: A man.\n[MOTION SCALE: 0.3]" } };
      assert.equal(getPromptForSite(shot, "openart-video"), "[Subject]: A man.");
    });

    test("strips Aspect ratio line", () => {
      const shot = { klingPrompt: { body: "[Subject]: A man.\nAspect ratio: 9:16" } };
      assert.equal(getPromptForSite(shot, "openart-video"), "[Subject]: A man.");
    });

    test("strips END STATE and RISK after separator", () => {
      const body = "[Subject]: A man.\n\n---\n\n[MEDIUM RISK]\n\nEND STATE:\n- Camera: static";
      const shot = { klingPrompt: { body } };
      assert.equal(getPromptForSite(shot, "openart-video"), "[Subject]: A man.");
    });

    test("strips all metadata from a full prompt", () => {
      const body = `[Cinematography]: Static camera.
[Subject]: @Painter — standing before a canvas.
[Action]: Brush drags slowly across canvas surface.
[MOTION SCALE: 0.3]
Aspect ratio: 9:16
Negative prompt: morphing features, extra fingers

---

[LOW RISK]

END STATE:
- @Painter: standing before canvas
- Camera: static`;
      const shot = { klingPrompt: { body } };
      const expected = `[Cinematography]: Static camera.
[Subject]: @Painter — standing before a canvas.
[Action]: Brush drags slowly across canvas surface.`;
      assert.equal(getPromptForSite(shot, "openart-video"), expected);
    });

    test("returns null when body is null", () => {
      const shot = { klingPrompt: { body: null }, seedancePrompt: null };
      assert.equal(getPromptForSite(shot, "openart-video"), null);
    });
  });

  describe("edge cases", () => {
    test("empty string body returns empty string, not null", () => {
      const shot = { mjPrompt: { body: "", meta: { platform: "mj" } } };
      assert.equal(getPromptForSite(shot, "midjourney"), "");
    });

    test("prompt object with no body key returns null", () => {
      const shot = { mjPrompt: { meta: { platform: "mj" } } };
      assert.equal(getPromptForSite(shot, "midjourney"), null);
    });

    test("undefined body falls through to null", () => {
      const shot = { mjPrompt: { body: undefined, meta: { platform: "mj" } } };
      assert.equal(getPromptForSite(shot, "midjourney"), null);
    });

    test("openart-image with empty nanoBanana body returns empty string", () => {
      const shot = { nanoBanana: { body: "" }, mjPrompt: { body: "MJ fallback" } };
      assert.equal(getPromptForSite(shot, "openart-image"), "");
    });

    test("googleflow with non-googleflow platform and no nanoBanana falls to mjPrompt", () => {
      const shot = { mjPrompt: { body: "MJ body", meta: { platform: "nanobanana" } }, nanoBanana: null };
      assert.equal(getPromptForSite(shot, "googleflow"), "MJ body");
    });

    test("shot with only nanoBanana — other prompts null", () => {
      const shot = { mjPrompt: null, klingPrompt: null, seedancePrompt: null, nanoBanana: { body: "NB only" } };
      assert.equal(getPromptForSite(shot, "openart-image"), "NB only");
      assert.equal(getPromptForSite(shot, "googleflow"), "NB only");
      assert.equal(getPromptForSite(shot, "midjourney"), null);
      assert.equal(getPromptForSite(shot, "openart-video"), null);
      assert.equal(getPromptForSite(shot, "seedance"), null);
    });

    test("mjPrompt with no meta property — googleflow falls through", () => {
      const shot = { mjPrompt: { body: "MJ body" }, nanoBanana: { body: "NB body" } };
      assert.equal(getPromptForSite(shot, "googleflow"), "NB body");
    });

    test("googleflow with mjPrompt.meta but no platform field", () => {
      const shot = { mjPrompt: { body: "MJ body", meta: {} }, nanoBanana: null };
      assert.equal(getPromptForSite(shot, "googleflow"), "MJ body");
    });

    test("googleflow with null mjPrompt.meta falls to nanoBanana", () => {
      const shot = { mjPrompt: { body: "MJ body", meta: null }, nanoBanana: { body: "NB body" } };
      assert.equal(getPromptForSite(shot, "googleflow"), "NB body");
    });

    test("openart-video prefers kling even when seedance also present", () => {
      assert.equal(getPromptForSite(FULL_SHOT, "openart-video"), "Kling prompt body");
    });
  });
});
