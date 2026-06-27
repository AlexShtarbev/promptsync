#!/usr/bin/env tsx
/**
 * drive-auth — one-time OAuth re-consent for the Node-side Drive tooling (push-drive).
 *
 *   GOOGLE_CREDENTIALS_PATH=…/google_creds/outh.json npm run drive-auth
 *
 * Prints the Google consent URL, then runs a one-shot listener on the registered redirect
 * (http://localhost:3456/api/drive/callback) to catch the code and write <creds>-token.json.
 * This is ONLY for the CLI git→Drive push; the browser extension/PWA authenticate separately
 * via chrome.identity / GIS and never use this client_secret.
 */
import http from "http";
import { getAuthUrl, exchangeCodeForTokens } from "../server/services/drive-sync.js";

const PORT = 3456;
const CALLBACK_PATH = "/api/drive/callback";

(async () => {
  let url: string;
  try {
    url = await getAuthUrl();
  } catch (e) {
    console.error("Could not build auth URL:", (e as Error).message);
    console.error("Set GOOGLE_CREDENTIALS_PATH to your OAuth client JSON (e.g. google_creds/outh.json).");
    process.exit(1);
  }

  console.log("\n── PromptSync Drive re-auth ─────────────────────────────────────────");
  console.log("1) Open this URL in a browser signed into the right Google account, approve:\n");
  console.log(url + "\n");
  console.log(`2) Waiting for the callback on http://localhost:${PORT}${CALLBACK_PATH} …`);
  console.log("   (leave this running; it exits automatically once authorized)\n");

  const server = http.createServer(async (req, res) => {
    if (!req.url) return;
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname !== CALLBACK_PATH) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const err = u.searchParams.get("error");
    const code = u.searchParams.get("code");
    if (err) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(`OAuth error: ${err}`);
      console.error("OAuth error:", err);
      server.close(() => process.exit(1));
      return;
    }
    if (!code) {
      res.writeHead(400);
      res.end("missing code");
      return;
    }
    try {
      await exchangeCodeForTokens(code);
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<h2>✓ PromptSync Drive authorized.</h2><p>Token saved — you can close this tab.</p>");
      console.log("✓ Token exchanged and saved. Re-run the push now.");
      server.close(() => process.exit(0));
    } catch (e) {
      res.writeHead(500);
      res.end(`exchange failed: ${(e as Error).message}`);
      console.error("Token exchange failed:", (e as Error).message);
      server.close(() => process.exit(1));
    }
  });
  server.on("error", (e) => {
    console.error(`Listener failed on :${PORT} — ${(e as Error).message}. Is the platform server already using it?`);
    process.exit(1);
  });
  server.listen(PORT);
})();
