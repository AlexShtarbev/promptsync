import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { compileBoardTsv, boardDrift, parseBoardTsv } from "./board-compiler.js";
import type { ProjectIndex, Shot } from "../types.js";

function shot(code: string, fields: Partial<Shot["meta"]> & Partial<Shot["content"]>): Shot {
  return {
    code,
    meta: {
      shot: code,
      setting: fields.setting ?? "",
      emotion: fields.emotion ?? "",
      shot_type: fields.shot_type ?? "MS",
      camera: fields.camera ?? "Static",
      duration: fields.duration ?? "3s",
      color_mood: fields.color_mood ?? "",
      status: "draft",
      asset_type: "still",
      reuses: null,
      palette_group: null,
      risk: "low",
      multi_shot_group: null,
      elements: [],
    },
    content: {
      subject_action: fields.subject_action ?? "",
      vo_lines: fields.vo_lines ?? "",
      sfx_audio: fields.sfx_audio ?? "",
      notes: fields.notes ?? "",
    },
    mjPrompt: null, klingPrompt: null, seedancePrompt: null, nanoBanana: null,
    elementMap: {}, imagePath: null, startFramePath: null, videoPath: null, openartRef: null,
  } as Shot;
}

function project(shots: Shot[]): ProjectIndex {
  return { config: { slug: "t" } as ProjectIndex["config"], shots, characters: [] };
}

const HEADER = "Shot\tPlace / Setting\tShot Type\tSubject & Action\tShot image\tNotes";

describe("compileBoardTsv", () => {
  test("projects shot.md fields and preserves board-only columns + column order", () => {
    const existing = `${HEADER}\n1A\told setting\told type\told action\thttps://img/1A.png\told notes`;
    const p = project([shot("1A", { setting: "INT. Church", shot_type: "WS", subject_action: "Peter at the altar", notes: "kling" })]);
    const out = compileBoardTsv(p, existing);
    const parsed = parseBoardTsv(out);

    assert.deepEqual(parsed.headers, ["Shot", "Place / Setting", "Shot Type", "Subject & Action", "Shot image", "Notes"]);
    const row = parsed.rows.get("1A")!;
    assert.equal(row[1], "INT. Church");        // setting from shot.md
    assert.equal(row[2], "WS");                  // shot_type from shot.md
    assert.equal(row[3], "Peter at the altar");  // subject_action from shot.md
    assert.equal(row[4], "https://img/1A.png");  // board-only "Shot image" PRESERVED
    assert.equal(row[5], "kling");               // notes from shot.md
  });

  test("appends shots not yet on the board, in shot order", () => {
    const existing = `${HEADER}\n1A\tx\tx\tx\t\tx`;
    const p = project([shot("1A", {}), shot("1B", { setting: "new" })]);
    const parsed = parseBoardTsv(compileBoardTsv(p, existing));
    assert.deepEqual(parsed.order, ["1A", "1B"]);
  });

  test("escapes tabs/newlines so a cell can't break the row", () => {
    const p = project([shot("1A", { subject_action: "a\tb\nc" })]);
    const out = compileBoardTsv(p);
    assert.equal(out.split("\n")[1].split("\t").length, out.split("\n")[0].split("\t").length);
  });
});

describe("boardDrift (L05)", () => {
  test("flags an authoritative column that disagrees with shot.md", () => {
    const existing = `${HEADER}\n3C\tx\tstanding swing\tHe swings the rock standing\t\tx`;
    const p = project([shot("3C", { setting: "x", shot_type: "Low MCU", subject_action: "Pinned on his back, swinging up", notes: "x" })]);
    const drift = boardDrift(p, existing);
    const cols = drift.map((d) => d.column).sort();
    assert.deepEqual(cols, ["Shot Type", "Subject & Action"]);
  });

  test("does not flag board-only columns or a matching board", () => {
    const existing = `${HEADER}\n1A\tINT. Church\tWS\tPeter at the altar\thttps://img.png\tkling`;
    const p = project([shot("1A", { setting: "INT. Church", shot_type: "WS", subject_action: "Peter at the altar", notes: "kling" })]);
    assert.deepEqual(boardDrift(p, existing), []);
  });
});
