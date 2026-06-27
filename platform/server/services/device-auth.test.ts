import { test } from "node:test";
import assert from "node:assert/strict";
import { requestDeviceCode, pollOnce, pollForToken, refreshAccessToken } from "./device-auth.js";

/** Scripted fetch: each call shifts the next scripted response off the queue. */
function scriptedFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: { url: string; body: string }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? "") });
    const { status = 200, body } = responses.shift() ?? { status: 500, body: { error: "no_more" } };
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

test("requestDeviceCode posts client_id+scope and returns the device code", async () => {
  const { impl, calls } = scriptedFetch([
    { body: { device_code: "DC", user_code: "WXYZ-1234", verification_url: "https://google.com/device", expires_in: 1800, interval: 5 } },
  ]);
  const dc = await requestDeviceCode("CID", "https://www.googleapis.com/auth/drive.file", impl);
  assert.equal(dc.user_code, "WXYZ-1234");
  assert.match(calls[0].url, /oauth2\.googleapis\.com\/device\/code/);
  assert.match(calls[0].body, /client_id=CID/);
  assert.match(decodeURIComponent(calls[0].body), /drive\.file/);
});

test("pollOnce maps Google's pending/slow_down/granted responses", async () => {
  const pending = scriptedFetch([{ status: 400, body: { error: "authorization_pending" } }]);
  assert.deepEqual(await pollOnce("c", "s", "DC", pending.impl), { status: "pending" });

  const slow = scriptedFetch([{ status: 403, body: { error: "slow_down" } }]);
  assert.deepEqual(await pollOnce("c", "s", "DC", slow.impl), { status: "slow_down" });

  const granted = scriptedFetch([{ body: { access_token: "AT", refresh_token: "RT", expires_in: 3600, token_type: "Bearer" } }]);
  const out = await pollOnce("c", "s", "DC", granted.impl);
  assert.equal(out.status, "granted");
  if (out.status === "granted") assert.equal(out.tokens.access_token, "AT");
});

test("pollForToken loops past pending/slow_down then resolves on grant", async () => {
  const { impl } = scriptedFetch([
    { status: 400, body: { error: "authorization_pending" } },
    { status: 403, body: { error: "slow_down" } },
    { body: { access_token: "AT2", refresh_token: "RT2", expires_in: 3600, token_type: "Bearer" } },
  ]);
  let slept = 0;
  const tokens = await pollForToken(
    "c",
    "s",
    { device_code: "DC", user_code: "U", verification_url: "v", expires_in: 1800, interval: 5 },
    { fetchImpl: impl, sleep: async () => { slept++; }, now: () => 0 }
  );
  assert.equal(tokens.access_token, "AT2");
  assert.equal(slept, 3); // one sleep before each of the three polls
});

test("pollForToken throws when the user denies", async () => {
  const { impl } = scriptedFetch([{ status: 400, body: { error: "access_denied", error_description: "user said no" } }]);
  await assert.rejects(
    () => pollForToken("c", "s", { device_code: "DC", user_code: "U", verification_url: "v", expires_in: 1800, interval: 5 },
      { fetchImpl: impl, sleep: async () => {}, now: () => 0 }),
    /denied/i
  );
});

test("refreshAccessToken posts a refresh grant and returns a new token", async () => {
  const { impl, calls } = scriptedFetch([{ body: { access_token: "NEW", expires_in: 3600, token_type: "Bearer" } }]);
  const t = await refreshAccessToken("c", "s", "RT", impl);
  assert.equal(t.access_token, "NEW");
  assert.match(calls[0].body, /grant_type=refresh_token/);
});
