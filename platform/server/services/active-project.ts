import type { Broadcaster } from "./ws-hub.js";

// The single project/episode the UI currently has open. The extension mirrors it.
let activeSlug: string | null = null;
let hub: Broadcaster | null = null;

export function initActiveProject(broadcaster: Broadcaster): void {
  hub = broadcaster;
}

export function getActiveProject(): string | null {
  return activeSlug;
}

export function setActiveProject(slug: string | null): void {
  activeSlug = slug;
  hub?.broadcast({ type: "active-changed", slug });
}
