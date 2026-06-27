import type { Character } from "../api/client";

/**
 * Split an episode's merged element set into series-global vs episode-local — the
 * basis for the separate "Global" and "Characters" tabs. Anything not explicitly
 * `scope: "global"` counts as local.
 */
export function splitByScope(chars: Character[]): { global: Character[]; local: Character[] } {
  return {
    global: chars.filter((c) => (c.meta.scope as string) === "global"),
    local: chars.filter((c) => (c.meta.scope as string) !== "global"),
  };
}
