/**
 * Image checker — the cheap, no-model, no-Claude half of the text→pixels gap (taxonomy B5).
 *
 * Tier 0 (this file): pure deterministic checks with ZERO dependencies and zero cost — it reads
 * each generated image's dimensions straight from the file header (PNG/JPEG/WEBP/GIF) and verifies
 * the ASPECT RATIO matches the shot's intent, plus corruption/blank sanity. Wrong-AR renders are a
 * common, generation-wasting error this catches for free.
 *
 * Higher tiers (palette match, posture/build verification) plug into the same `ImageVerifier` seam
 * — see checkImages(opts.verifier). Those need a pixel decoder (jimp/sharp) or a local model
 * (CLIP / pose), but remain local and inexpensive; none require Claude.
 */
import fs from "fs";
import path from "path";
import type { ProjectIndex, Shot } from "../types.js";

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Read image dimensions from the file header — no decoding, no dependency. */
export function imageSize(buf: Buffer): ImageDimensions | null {
  // PNG: 8-byte signature, then IHDR (len+type) then width/height as BE uint32.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: width/height as LE uint16 at offset 6/8.
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WEBP (RIFF....WEBP)
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (fmt === "VP8X") {
      return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    }
  }
  // JPEG: walk segment markers to a Start-Of-Frame (SOFn) which carries height/width.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) {
        o++;
        continue;
      }
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5) };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2; // standalone markers, no length
        continue;
      }
      const len = buf.readUInt16BE(o + 2);
      if (len < 2) break;
      o += 2 + len;
    }
  }
  return null;
}

/** "9:16" → 0.5625; "16:9" → 1.777…; accepts "WxH" too. */
export function parseRatio(ar: string | null | undefined): number | null {
  if (!ar) return null;
  const m = ar.match(/(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

export type ImageFindingKind = "aspect" | "unreadable" | "tiny" | "vision" | "colortemp";

export interface ImageFinding {
  shotCode: string;
  severity: "error" | "warning";
  kind: ImageFindingKind;
  message: string;
}

/** A pluggable pixel/model verifier (palette, posture, build, …). Local + cheap; never Claude. */
export type ImageVerifier = (shot: Shot, imagePath: string, buf: Buffer) => ImageFinding[] | Promise<ImageFinding[]>;

export interface CheckImagesOptions {
  /** Aspect-ratio tolerance (fraction). Default 4%. */
  tolerance?: number;
  /** Optional higher-tier verifier (jimp palette, CLIP/pose, …) run per image. */
  verifier?: ImageVerifier;
}

export async function checkImages(project: ProjectIndex, opts: CheckImagesOptions = {}): Promise<ImageFinding[]> {
  const tol = opts.tolerance ?? 0.04;
  const findings: ImageFinding[] = [];

  for (const shot of project.shots) {
    if (!shot.imagePath) continue;
    let buf: Buffer;
    try {
      buf = fs.readFileSync(shot.imagePath);
    } catch {
      continue;
    }
    const name = path.basename(shot.imagePath);
    const dim = imageSize(buf);

    if (!dim || !dim.width || !dim.height) {
      findings.push({ shotCode: shot.code, severity: "warning", kind: "unreadable", message: `${name}: not a readable PNG/JPG/WEBP (corrupt or empty generation?)` });
      continue;
    }
    if (dim.width < 256 || dim.height < 256) {
      findings.push({ shotCode: shot.code, severity: "warning", kind: "tiny", message: `${name}: only ${dim.width}×${dim.height} — suspiciously small for a render` });
    }

    const intended = shot.mjPrompt?.meta.ar ?? project.config.aspect_ratio;
    const want = parseRatio(intended);
    const got = dim.width / dim.height;
    if (want && Math.abs(got - want) / want > tol) {
      const fmt = (r: number) => (r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`);
      findings.push({
        shotCode: shot.code,
        severity: "warning",
        kind: "aspect",
        message: `${name}: ${dim.width}×${dim.height} (${fmt(got)}) but shot is ${intended} (${fmt(want)}) — wrong aspect ratio`,
      });
    }

    if (opts.verifier) {
      findings.push(...(await opts.verifier(shot, shot.imagePath, buf)));
    }
  }

  return findings;
}
