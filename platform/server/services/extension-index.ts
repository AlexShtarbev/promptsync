/**
 * extension-index — the compact projection the browser extension consumes (a slim view of
 * a ProjectIndex: just what the side panel + content scripts need to list shots, pick
 * prompts, and resolve element mentions). Ported out of server/routes/extension.ts so the
 * SAME shaping runs server-side (the legacy /api/extension route) AND in the browser
 * service worker (which builds it from a DriveStore snapshot). Pure — no IO.
 */
import type { ProjectIndex, Shot, Character } from "../types.js";

export interface ExtensionShot {
  code: string;
  status: string;
  asset_type: string;
  setting: string;
  elements: string[];
  has_mj: boolean;
  has_kling: boolean;
  has_seedance: boolean;
  has_image: boolean;
  has_start_frame: boolean;
  openart_ref: string | null;
  vo_lines: string;
  subject_action: string;
  character_lock: string | null;
}

export interface ExtensionView {
  index: number;
  name: string;
  slug: string;
  prompt: string;
  has_image: boolean;
  openart_ref: string | null;
  openart_resource_id: string | null;
  aspect_ratio: string | null;
  resolution: string | null;
  primary: boolean;
}

export interface ExtensionCharacter {
  name: string;
  element_name: string;
  slug: string;
  element_type: string;
  element_status: string;
  appears_in: string[];
  kling_description: string;
  views: ExtensionView[];
}

export interface ExtensionIndex {
  project: string;
  aspect_ratio: string;
  default_resolution: string;
  shots: ExtensionShot[];
  characters: ExtensionCharacter[];
  elementMap: Record<string, string>;
}

export function buildExtensionShot(s: Shot): ExtensionShot {
  return {
    code: s.code,
    status: s.meta.status,
    asset_type: s.meta.asset_type,
    setting: s.meta.setting,
    elements: s.meta.elements || [],
    has_mj: !!s.mjPrompt,
    has_kling: !!s.klingPrompt,
    has_seedance: !!s.seedancePrompt,
    has_image: !!s.imagePath,
    has_start_frame: !!s.startFramePath,
    openart_ref: s.openartRef || null,
    vo_lines: s.content.vo_lines || "",
    subject_action: s.content.subject_action || "",
    character_lock: s.seedancePrompt?.meta?.character_lock || null,
  };
}

export function buildExtensionCharacter(c: Character): ExtensionCharacter {
  return {
    name: c.name,
    element_name: c.meta.element_name || c.name,
    slug: c.slug,
    element_type: c.meta.element_type,
    element_status: c.meta.element_status,
    appears_in: c.meta.appears_in,
    kling_description: c.sections.kling_element_description || "",
    views: c.views.map((v) => ({
      index: v.index,
      name: v.name,
      slug: v.slug,
      prompt: v.prompt,
      has_image: !!v.imagePath,
      openart_ref: v.openartRef || null,
      openart_resource_id: v.openartResourceId || null,
      aspect_ratio: v.aspect_ratio || null,
      resolution: v.resolution || null,
      primary: !!v.primary,
    })),
  };
}

/** element_name → display name, for resolving @mentions in prompts. */
export function buildElementMap(characters: Character[]): Record<string, string> {
  const elementMap: Record<string, string> = {};
  for (const c of characters) {
    const eName = c.meta.element_name || c.name;
    if (eName !== c.name) elementMap[eName] = c.name;
  }
  return elementMap;
}

/** The full compact index for a project, identical to the legacy /api/extension/index payload. */
export function buildExtensionIndex(index: ProjectIndex, slug: string): ExtensionIndex {
  return {
    project: slug,
    aspect_ratio: index.config.aspect_ratio,
    default_resolution: index.config.default_resolution,
    shots: index.shots.map(buildExtensionShot),
    characters: index.characters.map(buildExtensionCharacter),
    elementMap: buildElementMap(index.characters),
  };
}
