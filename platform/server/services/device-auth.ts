/**
 * OAuth 2.0 Device Authorization flow for Google ("TVs and Limited Input devices").
 *
 * This is the portable auth the browser extension/PWA use: the user is shown a short code,
 * enters it at a Google URL on any device, and we poll for the token. No redirect URI, no
 * localhost, no per-install registration — load the extension anywhere and authorize by
 * code. Requires a client of type "TVs and Limited Input devices" (a web/installed client
 * is rejected by the device endpoint).
 *
 * Pure over an injected fetch, so the request/poll/refresh logic is unit-tested without
 * the network. The thin browser layer (show the code, persist tokens in chrome.storage)
 * sits on top of these functions.
 */
const DEVICE_ENDPOINT = "https://oauth2.googleapis.com/device/code";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

type FetchLike = typeof fetch;

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_url: string; // Google returns verification_url (not _uri) on this endpoint
  expires_in: number;
  interval: number;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

function form(body: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  };
}

/** Step 1: ask Google for a device + user code. */
export async function requestDeviceCode(
  clientId: string,
  scope: string,
  fetchImpl: FetchLike = fetch
): Promise<DeviceCode> {
  const res = await fetchImpl(DEVICE_ENDPOINT, form({ client_id: clientId, scope }));
  if (!res.ok) throw new Error(`device/code ${res.status}: ${await res.text()}`);
  return (await res.json()) as DeviceCode;
}

export type PollOutcome =
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "granted"; tokens: TokenSet }
  | { status: "denied"; error: string }
  | { status: "expired" };

/** Step 2 (one tick): exchange the device_code; caller loops on pending/slow_down. */
export async function pollOnce(
  clientId: string,
  clientSecret: string,
  deviceCode: string,
  fetchImpl: FetchLike = fetch
): Promise<PollOutcome> {
  const res = await fetchImpl(
    TOKEN_ENDPOINT,
    form({ client_id: clientId, client_secret: clientSecret, device_code: deviceCode, grant_type: DEVICE_GRANT })
  );
  const data = (await res.json()) as TokenSet & { error?: string; error_description?: string };
  if (res.ok) return { status: "granted", tokens: data };
  switch (data.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "expired_token":
      return { status: "expired" };
    default:
      return { status: "denied", error: data.error_description || data.error || `token ${res.status}` };
  }
}

/**
 * Step 2 (full loop): poll until granted, denied, or expired. `sleep` and `now` are
 * injected so tests run instantly and deterministically.
 */
export async function pollForToken(
  clientId: string,
  clientSecret: string,
  dc: DeviceCode,
  deps: { fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void>; now?: () => number } = {}
): Promise<TokenSet> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => Date.now());
  let intervalMs = (dc.interval || 5) * 1000;
  const deadline = now() + dc.expires_in * 1000;

  while (now() < deadline) {
    await sleep(intervalMs);
    const out = await pollOnce(clientId, clientSecret, dc.device_code, fetchImpl);
    if (out.status === "granted") return out.tokens;
    if (out.status === "denied") throw new Error(`Authorization denied: ${out.error}`);
    if (out.status === "expired") throw new Error("Device code expired — restart authorization.");
    if (out.status === "slow_down") intervalMs += 5000; // Google asks us to back off
  }
  throw new Error("Device code expired before authorization completed.");
}

/** Refresh an access token. Public device clients carry a (non-secret) client_secret. */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  fetchImpl: FetchLike = fetch
): Promise<TokenSet> {
  const res = await fetchImpl(
    TOKEN_ENDPOINT,
    form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
  );
  if (!res.ok) throw new Error(`refresh ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenSet;
}
