import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { imageSize, parseRatio, checkImages } from "./image-checker.js";
import type { ProjectIndex, Shot } from "../types.js";
import fs from "fs";
import path from "path";
import os from "os";

// Minimal valid headers (enough bytes for the parser).
function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w: number, h: number): Buffer {
  // SOI, then a SOF0 segment carrying height/width.
  const b = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, (h >> 8) & 0xff, h & 0xff, (w >> 8) & 0xff, w & 0xff, 0x03]);
  return b;
}

describe("imageSize", () => {
  test("reads PNG dimensions", () => {
    assert.deepEqual(imageSize(png(1080, 1920)), { width: 1080, height: 1920 });
  });
  test("reads JPEG dimensions from SOF0", () => {
    assert.deepEqual(imageSize(jpeg(1920, 1080)), { width: 1920, height: 1080 });
  });
  test("returns null for non-image bytes", () => {
    assert.equal(imageSize(Buffer.from("not an image")), null);
  });
});

describe("parseRatio", () => {
  test("parses ratios", () => {
    assert.equal(parseRatio("9:16"), 9 / 16);
    assert.equal(parseRatio("16:9"), 16 / 9);
    assert.equal(parseRatio("1:1"), 1);
    assert.equal(parseRatio(null), null);
  });
});

describe("checkImages", () => {
  let tmp: string;
  function shot(code: string, ar: string, imageRel: string | null): Shot {
    return {
      code,
      meta: { shot: code, setting: "", emotion: "", shot_type: "MS", camera: "", duration: "", color_mood: "", status: "draft", asset_type: "still", reuses: null, palette_group: null, risk: "low", multi_shot_group: null, elements: [] },
      content: { subject_action: "", vo_lines: "", sfx_audio: "", notes: "" },
      mjPrompt: { meta: { shot: code, model: "", style: "", ar, platform: "nanobanana", reference_images: {} }, body: "", sections: {} },
      klingPrompt: null, seedancePrompt: null, nanoBanana: null, elementMap: {},
      imagePath: imageRel ? path.join(tmp, imageRel) : null,
      startFramePath: null, videoPath: null, openartRef: null,
    } as Shot;
  }
  function project(shots: Shot[]): ProjectIndex {
    return { config: { slug: "t", aspect_ratio: "9:16" } as ProjectIndex["config"], shots, characters: [] };
  }

  test("flags an image whose aspect ratio doesn't match the shot", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "img-test-"));
    try {
      fs.writeFileSync(path.join(tmp, "ok.png"), png(1080, 1920)); // 9:16 ✓
      fs.writeFileSync(path.join(tmp, "wrong.png"), png(1920, 1080)); // 16:9 ✗ for a 9:16 shot
      fs.writeFileSync(path.join(tmp, "bad.png"), Buffer.from("garbage")); // unreadable
      const p = project([
        shot("1A", "9:16", "ok.png"),
        shot("1B", "9:16", "wrong.png"),
        shot("1C", "9:16", "bad.png"),
        shot("1D", "9:16", null), // no image — skipped
      ]);
      const f = await checkImages(p);
      const byShot = Object.fromEntries(f.map((x) => [x.shotCode, x.kind]));
      assert.equal(byShot["1A"], undefined); // correct AR → no finding
      assert.equal(byShot["1B"], "aspect"); // wrong AR flagged
      assert.equal(byShot["1C"], "unreadable"); // corrupt flagged
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("runs a pluggable verifier and includes its findings", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "img-test2-"));
    try {
      fs.writeFileSync(path.join(tmp, "a.png"), png(1080, 1920));
      const p = project([shot("1A", "9:16", "a.png")]);
      const f = await checkImages(p, {
        verifier: (s) => [{ shotCode: s.code, severity: "warning", kind: "vision", message: "stub: posture check" }],
      });
      assert.ok(f.some((x) => x.kind === "vision"));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
