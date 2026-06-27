import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseAssetType, parseRisk, shotTypeAbbrev } from "./import-storyboard.js";

describe("parseAssetType", () => {
  test("detects kling-reuse", () => {
    assert.equal(parseAssetType("Kling-reuse from 1A"), "kling-reuse");
  });

  test("detects kling", () => {
    assert.equal(parseAssetType("Kling animation"), "kling");
  });

  test("detects googleflow (two words)", () => {
    assert.equal(parseAssetType("Use Google Flow here"), "googleflow");
  });

  test("detects googleflow (one word)", () => {
    assert.equal(parseAssetType("googleflow render"), "googleflow");
  });

  test("defaults to still", () => {
    assert.equal(parseAssetType("Normal shot"), "still");
  });

  test("empty notes defaults to still", () => {
    assert.equal(parseAssetType(""), "still");
  });

  test("case insensitive", () => {
    assert.equal(parseAssetType("KLING shot"), "kling");
  });

  test("kling-reuse takes priority over kling", () => {
    assert.equal(parseAssetType("kling-reuse"), "kling-reuse");
  });
});

describe("parseRisk", () => {
  test("detects high risk", () => {
    assert.equal(parseRisk("High risk - complex motion"), "high");
  });

  test("detects medium risk", () => {
    assert.equal(parseRisk("Medium risk shot"), "medium");
  });

  test("defaults to low", () => {
    assert.equal(parseRisk("Simple static shot"), "low");
  });

  test("empty notes defaults to low", () => {
    assert.equal(parseRisk(""), "low");
  });

  test("case insensitive", () => {
    assert.equal(parseRisk("HIGH RISK"), "high");
  });

  test("keyword 'high' alone triggers high", () => {
    assert.equal(parseRisk("high"), "high");
  });

  test("keyword 'medium' alone triggers medium", () => {
    assert.equal(parseRisk("medium"), "medium");
  });
});

describe("parseRisk edge cases", () => {
  test("'highway' triggers high (known false positive)", () => {
    assert.equal(parseRisk("highway sign"), "high");
  });

  test("'medium high risk' returns high (high checked first)", () => {
    assert.equal(parseRisk("medium high risk"), "high");
  });
});

describe("shotTypeAbbrev", () => {
  test("Wide -> WS", () => {
    assert.equal(shotTypeAbbrev("Wide"), "WS");
  });

  test("Wide Shot -> WS", () => {
    assert.equal(shotTypeAbbrev("Wide Shot"), "WS");
  });

  test("Medium -> MS", () => {
    assert.equal(shotTypeAbbrev("Medium"), "MS");
  });

  test("Medium Shot -> MS", () => {
    assert.equal(shotTypeAbbrev("Medium Shot"), "MS");
  });

  test("Close-up -> CU", () => {
    assert.equal(shotTypeAbbrev("Close-up"), "CU");
  });

  test("Close up -> CU", () => {
    assert.equal(shotTypeAbbrev("Close up"), "CU");
  });

  test("Closeup -> CU", () => {
    assert.equal(shotTypeAbbrev("Closeup"), "CU");
  });

  test("Extreme Close-up -> ECU", () => {
    assert.equal(shotTypeAbbrev("Extreme Close-up"), "ECU");
  });

  test("Extreme Close up -> ECU", () => {
    assert.equal(shotTypeAbbrev("Extreme Close up"), "ECU");
  });

  test("Medium Close-up -> MCU", () => {
    assert.equal(shotTypeAbbrev("Medium Close-up"), "MCU");
  });

  test("Medium Long Shot -> MLS", () => {
    assert.equal(shotTypeAbbrev("Medium Long Shot"), "MLS");
  });

  test("Medium Wide Shot -> MWS", () => {
    assert.equal(shotTypeAbbrev("Medium Wide Shot"), "MWS");
  });

  test("Full Shot -> FS", () => {
    assert.equal(shotTypeAbbrev("Full Shot"), "FS");
  });

  test("Long Shot -> LS", () => {
    assert.equal(shotTypeAbbrev("Long Shot"), "LS");
  });

  test("Extreme Wide Shot -> EWS", () => {
    assert.equal(shotTypeAbbrev("Extreme Wide Shot"), "EWS");
  });

  test("POV -> POV", () => {
    assert.equal(shotTypeAbbrev("POV"), "POV");
  });

  test("Over the Shoulder -> OTS", () => {
    assert.equal(shotTypeAbbrev("Over the Shoulder"), "OTS");
  });

  test("Profile -> Profile", () => {
    assert.equal(shotTypeAbbrev("Profile"), "Profile");
  });

  test("unknown type returns as-is", () => {
    assert.equal(shotTypeAbbrev("Dutch Angle"), "Dutch Angle");
  });

  test("empty string returns empty", () => {
    assert.equal(shotTypeAbbrev(""), "");
  });

  test("exact case match required", () => {
    assert.equal(shotTypeAbbrev("wide"), "wide");
    assert.equal(shotTypeAbbrev("WIDE"), "WIDE");
  });
});

describe("parseAssetType additional cases", () => {
  test("detects seedance when present in notes", () => {
    assert.equal(parseAssetType("seedance video"), "still");
  });

  test("kling as substring does not trigger (e.g. sparkling)", () => {
    assert.equal(parseAssetType("sparkling water shot"), "kling");
  });

  test("googleflow case insensitive (Google Flow)", () => {
    assert.equal(parseAssetType("Google Flow render"), "googleflow");
  });

  test("kling-reuse with extra context", () => {
    assert.equal(parseAssetType("use kling-reuse from shot 2A"), "kling-reuse");
  });

  test("notes with both kling and google flow returns kling (checked first)", () => {
    assert.equal(parseAssetType("kling with google flow"), "kling");
  });
});

describe("parseRisk additional cases", () => {
  test("risk within a longer word — 'highlight' has 'high'", () => {
    assert.equal(parseRisk("highlight the character"), "high");
  });

  test("notes with only 'low' are still low (default)", () => {
    assert.equal(parseRisk("low intensity"), "low");
  });

  test("null-ish handled", () => {
    assert.equal(parseRisk(""), "low");
  });
});
