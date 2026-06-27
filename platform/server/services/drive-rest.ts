/**
 * Browser-side Drive v3 REST client implementing the DriveApi the snapshot loader needs.
 * No googleapis Node lib — just fetch + a bearer token. Token acquisition/refresh is
 * injected (chrome.identity in the extension, GIS token client in the PWA) so this module
 * stays auth-mechanism-agnostic and unit-testable with a stubbed fetch.
 */
import type { DriveApi, DriveFile } from "./drive-store.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export type TokenProvider = () => Promise<string>;
type FetchLike = typeof fetch;

export interface DriveRestOptions {
  /** Override fetch (tests). Defaults to global fetch. */
  fetchImpl?: FetchLike;
}

/** Build a DriveApi backed by Drive v3 REST. `getToken` returns a fresh OAuth access token. */
export function driveRestApi(getToken: TokenProvider, opts: DriveRestOptions = {}): DriveApi {
  const doFetch = opts.fetchImpl ?? fetch;

  async function authedFetch(url: string): Promise<Response> {
    const token = await getToken();
    const res = await doFetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`Drive REST ${res.status} ${res.statusText} for ${url}`);
    }
    return res;
  }

  return {
    async listFolder(folderId: string): Promise<DriveFile[]> {
      const files: DriveFile[] = [];
      let pageToken: string | undefined;
      // Drive caps page size at 1000; paginate to be correct for large folders.
      do {
        const params = new URLSearchParams({
          q: `'${folderId}' in parents and trashed=false`,
          fields: "nextPageToken,files(id,name,mimeType)",
          pageSize: "1000",
          // Folders before files keeps snapshot walks depth-first-ish; not required, but tidy.
          orderBy: "folder,name",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const res = await authedFetch(`${DRIVE_API}/files?${params}`);
        const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
        if (data.files) files.push(...data.files);
        pageToken = data.nextPageToken;
      } while (pageToken);
      return files;
    },

    async downloadText(fileId: string): Promise<string> {
      const res = await authedFetch(`${DRIVE_API}/files/${fileId}?alt=media`);
      return res.text();
    },
  };
}

/** A Drive download URL for an asset's bytes (served to <img>/<video> out-of-band). */
export function driveMediaUrl(fileId: string): string {
  return `${DRIVE_API}/files/${fileId}?alt=media`;
}
