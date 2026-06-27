import fs from "fs";
import path from "path";
// Type-only import — erased at build time, so it carries ZERO runtime cost and
// does not pull the googleapis umbrella into memory.
import type { drive_v3 } from "googleapis";

// The googleapis umbrella package is ~100MB resident once imported, because it
// bundles typed clients for every Google API. We only use Drive, so:
//   (a) load lazily — nothing is imported until a Drive operation actually runs, and
//   (b) load just the Drive submodule + google-auth-library instead of the umbrella.
// That keeps the server baseline ~70MB (vs ~168MB) and, even once Drive is used,
// the loaded footprint is ~63MB instead of ~150MB.

interface DriveMods {
  drive: typeof import("googleapis/build/src/apis/drive/index.js")["drive"];
  GoogleAuth: typeof import("google-auth-library")["GoogleAuth"];
  OAuth2Client: typeof import("google-auth-library")["OAuth2Client"];
}

let driveClient: drive_v3.Drive | null = null;
let modsPromise: Promise<DriveMods> | null = null;

const REDIRECT_URI = "http://localhost:3456/api/drive/callback";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/** Dynamically import the Drive-only modules once, then reuse the result. */
function loadDriveMods(): Promise<DriveMods> {
  if (!modsPromise) {
    modsPromise = (async () => {
      const driveMod = await import("googleapis/build/src/apis/drive/index.js");
      const auth = await import("google-auth-library");
      return { drive: driveMod.drive, GoogleAuth: auth.GoogleAuth, OAuth2Client: auth.OAuth2Client };
    })();
  }
  return modsPromise;
}

function credPath(): string | null {
  const p = process.env.GOOGLE_CREDENTIALS_PATH;
  return p && fs.existsSync(p) ? p : null;
}

function tokenPathFor(p: string): string {
  return p.replace(/\.json$/, "-token.json");
}

/**
 * Cheap synchronous check used by the /status endpoint. Determines whether Drive
 * is usable WITHOUT importing googleapis, so loading the app (which calls /status
 * on mount) never triggers the heavy load.
 */
export function isDriveEnabled(): boolean {
  const p = credPath();
  if (!p) return false;
  try {
    const creds = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (creds.type === "service_account") return true;
    if (creds.installed || creds.web) return fs.existsSync(tokenPathFor(p));
  } catch {
    /* malformed creds → not enabled */
  }
  return false;
}

/** Light startup hook: logs Drive status without importing googleapis. */
export function initDrive(): void {
  console.log(
    isDriveEnabled()
      ? "Google Drive sync enabled (library loaded on first use)"
      : "Google Drive sync disabled — no credentials/token"
  );
}

/** Lazily build and cache the Drive client. Returns null when not configured. */
export async function getDrive(): Promise<drive_v3.Drive | null> {
  if (driveClient) return driveClient;
  const p = credPath();
  if (!p) return null;

  try {
    const creds = JSON.parse(fs.readFileSync(p, "utf-8"));
    const { drive, GoogleAuth, OAuth2Client } = await loadDriveMods();

    if (creds.type === "service_account") {
      const auth = new GoogleAuth({ credentials: creds, scopes: SCOPES });
      driveClient = drive({ version: "v3", auth });
    } else if (creds.installed || creds.web) {
      const tokenPath = tokenPathFor(p);
      if (fs.existsSync(tokenPath)) {
        const oauth2 = new OAuth2Client(
          creds.installed?.client_id ?? creds.web?.client_id,
          creds.installed?.client_secret ?? creds.web?.client_secret,
          REDIRECT_URI
        );
        oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf-8")));
        driveClient = drive({ version: "v3", auth: oauth2 });
      }
    }

    if (driveClient) console.log("Google Drive client ready");
    return driveClient;
  } catch (err) {
    console.error("Failed to init Google Drive:", err);
    return null;
  }
}

/** Drop the cached client so the next getDrive() rebuilds it (e.g. new tokens). */
export function resetDrive(): void {
  driveClient = null;
}

/** Build the OAuth consent URL. Loads the auth library lazily. */
export async function getAuthUrl(): Promise<string> {
  const p = credPath();
  if (!p) throw new Error("No credentials file configured");
  const creds = JSON.parse(fs.readFileSync(p, "utf-8"));
  const clientId = creds.installed?.client_id ?? creds.web?.client_id;
  const clientSecret = creds.installed?.client_secret ?? creds.web?.client_secret;
  if (!clientId) throw new Error("Invalid credentials file");

  const { OAuth2Client } = await loadDriveMods();
  const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  return oauth2.generateAuthUrl({ access_type: "offline", scope: SCOPES });
}

/** Exchange an OAuth code for tokens, persist them, and refresh the client. */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const p = credPath();
  if (!p) throw new Error("No credentials configured");
  const creds = JSON.parse(fs.readFileSync(p, "utf-8"));
  const clientId = creds.installed?.client_id ?? creds.web?.client_id;
  const clientSecret = creds.installed?.client_secret ?? creds.web?.client_secret;

  const { OAuth2Client } = await loadDriveMods();
  const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const { tokens } = await oauth2.getToken(code);
  fs.writeFileSync(tokenPathFor(p), JSON.stringify(tokens, null, 2));
  resetDrive(); // next getDrive() rebuilds with the new token
}

export async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const q = [
    `name='${name}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ];
  if (parentId) q.push(`'${parentId}' in parents`);

  const res = await drive.files.list({
    q: q.join(" and "),
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files?.length) {
    return res.data.files[0].id!;
  }

  const create = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  return create.data.id!;
}

/** Map a file extension to the MIME type Drive should store it as. */
function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".webp": return "image/webp";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".mp4":
    case ".m4v": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mov": return "video/quicktime";
    default: return "application/octet-stream";
  }
}

export async function uploadFile(
  drive: drive_v3.Drive,
  filePath: string,
  folderId: string,
  fileName?: string
): Promise<{ id: string; webViewLink: string }> {
  const name = fileName ?? path.basename(filePath);
  const mimeType = mimeFor(filePath);

  const existingRes = await drive.files.list({
    q: `name='${name}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (existingRes.data.files?.length) {
    const fileId = existingRes.data.files[0].id!;
    await drive.files.update({
      fileId,
      media: { mimeType, body: fs.createReadStream(filePath) },
    });
    const meta = await drive.files.get({ fileId, fields: "webViewLink" });
    return { id: fileId, webViewLink: meta.data.webViewLink ?? "" };
  }

  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: "id,webViewLink",
  });

  return { id: res.data.id!, webViewLink: res.data.webViewLink ?? "" };
}
