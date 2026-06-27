export type AssetType = "still" | "kling" | "kling-reuse" | "seedance" | "googleflow";
export type ShotStatus =
  | "draft"
  | "story-ready"
  | "mj-done"
  | "kling-ready"
  | "kling-done"
  | "seedance-ready"
  | "seedance-done"
  | "complete";
export type RiskLevel = "low" | "medium" | "high";
export type Platform = "mj" | "googleflow" | "nanobanana";

export interface ShotMeta {
  shot: string;
  setting: string;
  emotion: string;
  shot_type: string;
  camera: string;
  duration: string;
  color_mood: string;
  status: ShotStatus;
  asset_type: AssetType;
  reuses: string | null;
  palette_group: string | null;
  risk: RiskLevel;
  multi_shot_group: string | null;
  elements: string[];
}

export interface ShotContent {
  subject_action: string;
  vo_lines: string;
  sfx_audio: string;
  notes: string;
}

export interface MjPromptMeta {
  shot: string;
  model: string;
  style: string;
  ar: string;
  platform: Platform;
  reference_images: Record<string, string | null>;
}

export type PromptSections = Record<string, string>;

export interface KlingPromptMeta {
  shot: string;
  motion_scale: number;
  aspect_ratio: string;
  mode: string;
  multi_shot_group: string | null;
  resolution?: string;
  start_frame?: string;
}

export interface SeedancePromptMeta {
  shot: string;
  aspect_ratio: string;
  duration: number;
  mode: string;
  character_lock: string | null;
  environment_ref?: string | null;
  wardrobe_ref?: string | null;
  start_frame?: string | null;
  camerafixed?: boolean;
  seed?: number | null;
}

export interface NanoBananaMeta {
  shot: string;
  source: "mj-image" | "generate-new" | "skip";
}

/** Typed physics-engine specs an element may DECLARE in frontmatter (preferred over Identity-Block prose). */
export interface BuildFrontmatter {
  positive?: string[]; // positive, present-tense build clauses (anti-beautification anchor)
  forbidden?: string[]; // drift terms for the (weak) negative + lint
  unflattering?: boolean; // build clause mandatory on every body-visible shot
}
export interface ConcealmentFrontmatter {
  positive?: string; // "a shapeless shadow-mass, no anatomy"
  hide_only?: string[]; // what the negative MAY suppress — its reveal, never its presence
}

export interface CharacterMeta {
  name: string;
  element_name: string;
  element_type: string;
  appears_in: string[];
  status: string;
  element_status: string;
  parent_environment: string | null;
  scope: "global" | "local";
  canon: string | null;
  /** Optional typed physics specs; when absent the importer falls back to Identity-Block prose. */
  build?: BuildFrontmatter | null;
  concealment?: ConcealmentFrontmatter | null;
  identity_clause?: string | null;
}

export interface Shot {
  code: string;
  meta: ShotMeta;
  content: ShotContent;
  mjPrompt: { meta: MjPromptMeta; body: string; sections: PromptSections } | null;
  klingPrompt: { meta: KlingPromptMeta; body: string; sections: PromptSections } | null;
  seedancePrompt: { meta: SeedancePromptMeta; body: string; sections: PromptSections } | null;
  nanoBanana: { meta: NanoBananaMeta; body: string; sections: PromptSections } | null;
  elementMap: Record<string, string>;
  imagePath: string | null;
  startFramePath: string | null;
  videoPath: string | null;
  openartRef: string | null;
}

export interface CharacterView {
  index: number;
  name: string;
  slug: string;
  prompt: string;
  imagePath: string | null;
  openartRef: string | null;
  openartResourceId: string | null;
  aspect_ratio: string | null;
  resolution: string | null;
  primary: boolean;
}

export interface Character {
  name: string;
  slug: string;
  meta: CharacterMeta;
  sections: Record<string, string>;
  views: CharacterView[];
}

export interface ProjectConfig {
  name: string;
  slug: string;
  created: string;
  status: string;
  drive_folder_id: string | null;
  default_style: string;
  shot_prefix: string;
  aspect_ratio: string;
  default_resolution: string;
}

export interface ProjectIndex {
  config: ProjectConfig;
  shots: Shot[];
  characters: Character[];
}

export interface SeriesConfig {
  name: string;
  slug: string;
  type: "series";
  status: string;
  aspect_ratio: string;
  default_resolution: string;
  drive_folder_id: string | null;
  global_elements: string;
  bible: string;
}

/** A discovered project (standalone, or one episode of a series). */
export interface DiscoveredProject {
  slug: string;
  path: string;
  config: ProjectConfig;
  /** Slug of the series this project belongs to, or null when standalone. */
  seriesSlug: string | null;
  /** Absolute element dirs (characters/environments/props) of the owning series' global library. */
  globalElementDirs: string[];
  /** Defaults inherited from the owning series when this episode's project.yaml omits them. */
  seriesDefaults?: { aspect_ratio: string; default_resolution: string };
}

export interface DiscoveredSeries {
  slug: string;
  path: string;
  config: SeriesConfig;
  /** Absolute path to the series global element library root. */
  globalDir: string;
  globalElementDirs: string[];
  episodes: DiscoveredProject[];
}

/** The full navigable workspace: standalone projects plus series with their episodes. */
export interface Workspace {
  projects: DiscoveredProject[];
  series: DiscoveredSeries[];
}

/** A markdown document from a series bible (narrative canon). */
export interface BibleDoc {
  name: string;
  slug: string;
  group: string; // "canon" for top-level docs, else the subdir (e.g. "characters")
  content: string;
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  shotCode: string;
  promptType: "nb-prompt" | "kling-prompt" | "seedance-prompt";
  message: string;
  mention?: string;
  elementName?: string;
}

export interface ShotValidationResult {
  shotCode: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationReport {
  project: string;
  timestamp: string;
  totalShots: number;
  shotsChecked: number;
  totalErrors: number;
  totalWarnings: number;
  knownElements: string[];
  results: ShotValidationResult[];
}

export interface FixAction {
  shotCode: string;
  action: "added" | "removed" | "replaced";
  element: string;
  replacement?: string;
}

export interface FixReport {
  project: string;
  timestamp: string;
  fixes: FixAction[];
  unfixable: ValidationIssue[];
}
