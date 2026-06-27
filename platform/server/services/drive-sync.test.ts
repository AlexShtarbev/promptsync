import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { isDriveEnabled } from "./drive-sync.js";

// isDriveEnabled() decides whether the UI shows Drive as available, and it must
// answer purely from files on disk — never importing googleapis — so opening the
// app doesn't pull ~100MB into memory. These tests pin that contract.

let dir: string;
const orig = process.env.GOOGLE_CREDENTIALS_PATH;

function writeCreds(obj: unknown): string {
  const p = path.join(dir, "creds.json");
  fs.writeFileSync(p, typeof obj === "string" ? obj : JSON.stringify(obj));
  return p;
}

describe("isDriveEnabled", () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "drive-test-"));
  });
  afterEach(() => {
    if (orig === undefined) delete process.env.GOOGLE_CREDENTIALS_PATH;
    else process.env.GOOGLE_CREDENTIALS_PATH = orig;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("false when no credentials path is configured", () => {
    delete process.env.GOOGLE_CREDENTIALS_PATH;
    assert.equal(isDriveEnabled(), false);
  });

  test("false when the path is set but the file is missing", () => {
    process.env.GOOGLE_CREDENTIALS_PATH = path.join(dir, "nope.json");
    assert.equal(isDriveEnabled(), false);
  });

  test("true for a service account (no token needed)", () => {
    process.env.GOOGLE_CREDENTIALS_PATH = writeCreds({ type: "service_account", client_email: "x@y" });
    assert.equal(isDriveEnabled(), true);
  });

  test("false for OAuth credentials without a saved token", () => {
    process.env.GOOGLE_CREDENTIALS_PATH = writeCreds({ installed: { client_id: "id", client_secret: "s" } });
    assert.equal(isDriveEnabled(), false);
  });

  test("true for OAuth credentials once a token file exists", () => {
    const p = writeCreds({ installed: { client_id: "id", client_secret: "s" } });
    fs.writeFileSync(p.replace(/\.json$/, "-token.json"), JSON.stringify({ access_token: "t" }));
    process.env.GOOGLE_CREDENTIALS_PATH = p;
    assert.equal(isDriveEnabled(), true);
  });

  test("false for malformed credentials JSON", () => {
    process.env.GOOGLE_CREDENTIALS_PATH = writeCreds("{ not valid json");
    assert.equal(isDriveEnabled(), false);
  });
});
