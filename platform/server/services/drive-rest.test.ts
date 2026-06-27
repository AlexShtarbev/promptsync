import { test } from "node:test";
import assert from "node:assert/strict";
import { driveRestApi } from "./drive-rest.js";

/** A fetch stub that records calls and returns scripted JSON/text responses. */
function stubFetch(handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }) {
  const calls: { url: string; auth?: string }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ url: u, auth });
    const { status = 200, body } = handler(u, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

test("listFolder sends an authed parent query and unwraps files", async () => {
  const { impl, calls } = stubFetch((url) => {
    assert.match(url, /\/drive\/v3\/files\?/);
    // URLSearchParams encodes spaces as '+'; decode form-encoding before matching.
    assert.match(decodeURIComponent(url.replace(/\+/g, " ")), /'FOLDER1' in parents and trashed=false/);
    return { body: { files: [{ id: "a", name: "project.yaml", mimeType: "text/yaml" }] } };
  });
  const api = driveRestApi(async () => "TOKEN123", { fetchImpl: impl });

  const files = await api.listFolder("FOLDER1");
  assert.deepEqual(files, [{ id: "a", name: "project.yaml", mimeType: "text/yaml" }]);
  assert.equal(calls[0].auth, "Bearer TOKEN123");
});

test("listFolder follows nextPageToken until exhausted", async () => {
  let page = 0;
  const { impl, calls } = stubFetch((url) => {
    const hasToken = /pageToken=tok1/.test(url);
    page++;
    if (!hasToken) return { body: { files: [{ id: "1", name: "a", mimeType: "m" }], nextPageToken: "tok1" } };
    return { body: { files: [{ id: "2", name: "b", mimeType: "m" }] } };
  });
  const api = driveRestApi(async () => "T", { fetchImpl: impl });

  const files = await api.listFolder("F");
  assert.equal(page, 2, "made two paginated calls");
  assert.deepEqual(files.map((f) => f.id), ["1", "2"]);
  assert.match(calls[1].url, /pageToken=tok1/);
});

test("downloadText requests alt=media and returns raw text", async () => {
  const { impl } = stubFetch((url) => {
    assert.match(url, /\/files\/FILE9\?alt=media/);
    return { body: "raw file contents" };
  });
  const api = driveRestApi(async () => "T", { fetchImpl: impl });
  assert.equal(await api.downloadText("FILE9"), "raw file contents");
});

test("a non-ok response throws", async () => {
  const { impl } = stubFetch(() => ({ status: 403, body: "denied" }));
  const api = driveRestApi(async () => "T", { fetchImpl: impl });
  await assert.rejects(() => api.listFolder("F"), /Drive REST 403/);
});
