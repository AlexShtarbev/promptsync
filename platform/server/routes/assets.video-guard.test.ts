import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import os from "os";

import { assetRoutes } from "./assets.js";

// Regression: a shot's video generation used to be POSTed to the IMAGE endpoint,
// which deletes the existing still before writing — so the storyboard shot lost its
// image and "disappeared". The image endpoints must refuse video bytes WITHOUT
// touching the still, and the video endpoint must accept them.

// ISO BMFF header ("....ftypmp42") — what an mp4/mov starts with.
const MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  0x00, 0x00, 0x00, 0x00, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
]);
// PNG signature + start of IHDR.
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

let server: Server;
let base: string;
let tmp: string;
let shotDir: string;
let videosDir: string;

function w(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function post(p: string, body: Buffer, contentType: string) {
  const res = await fetch(base + p, { method: "POST", headers: { "Content-Type": contentType }, body });
  return { status: res.status, body: (await res.json().catch(() => null)) as { error?: string; filename?: string } | null };
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "assets-guard-"));
  const proj = path.join(tmp, "proj");
  w(path.join(proj, "project.yaml"), `name: "Proj"\nslug: proj\nstatus: in-progress\n`);
  shotDir = path.join(proj, "storyboard", "shots", "1A");
  w(path.join(shotDir, "shot.md"), `---\nshot: "1A"\nstatus: draft\nasset_type: still\n---\n\nbody\n`);
  fs.writeFileSync(path.join(shotDir, "image.jpg"), Buffer.from("REAL-STILL-JPEG-BYTES"));
  videosDir = path.join(proj, "storyboard", "videos");

  const app = express();
  app.use("/api/assets", assetRoutes(tmp));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("POST /assets/:slug/shots/:code/image/upload — video guard", () => {
  test("rejects video bytes (octet-stream) with 415 and keeps the still intact", async () => {
    const original = fs.readFileSync(path.join(shotDir, "image.jpg"));
    const { status, body } = await post("/api/assets/proj/shots/1A/image/upload", MP4, "application/octet-stream");
    assert.equal(status, 415);
    assert.match(body!.error!, /video/i);
    assert.ok(fs.existsSync(path.join(shotDir, "image.jpg")), "still must survive a rejected video upload");
    assert.deepEqual(fs.readFileSync(path.join(shotDir, "image.jpg")), original);
    assert.ok(!fs.existsSync(path.join(shotDir, "image.png")), "no stray image written");
  });

  test("rejects video bytes even when mislabeled with an image content-type", async () => {
    const { status } = await post("/api/assets/proj/shots/1A/image/upload", MP4, "image/jpeg");
    assert.equal(status, 415);
    assert.ok(fs.existsSync(path.join(shotDir, "image.jpg")));
  });

  test("a genuine image still uploads (200) and replaces the sibling still", async () => {
    const { status, body } = await post("/api/assets/proj/shots/1A/image/upload", PNG, "image/png");
    assert.equal(status, 200);
    assert.equal(body!.filename, "image.png");
    assert.ok(fs.existsSync(path.join(shotDir, "image.png")));
    assert.ok(!fs.existsSync(path.join(shotDir, "image.jpg")), "old .jpg replaced by new .png");
  });
});

describe("POST /assets/:slug/shots/:code/video/upload — accepts video", () => {
  test("saves a shot video under storyboard/videos/{code}.mp4", async () => {
    const { status, body } = await post("/api/assets/proj/shots/2A/video/upload", MP4, "video/mp4");
    assert.equal(status, 200);
    assert.equal(body!.filename, "2A.mp4");
    assert.deepEqual(fs.readFileSync(path.join(videosDir, "2A.mp4")), MP4);
  });
});
