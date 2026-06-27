const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface ProjectSummary {
  slug: string;
  name: string;
  status: string;
}

export interface EpisodeSummary {
  slug: string;
  name: string;
  status: string;
  seriesSlug: string;
}

export interface SeriesSummary {
  slug: string;
  name: string;
  status: string;
  episodes: EpisodeSummary[];
}

export interface WorkspaceTree {
  projects: ProjectSummary[];
  series: SeriesSummary[];
}

export interface StructureIssue {
  level: "error" | "warning" | "info";
  code: string;
  context: string;
  message: string;
  fixable: boolean;
}

export interface StructureReport {
  ok: boolean;
  counts: { error: number; warning: number; info: number };
  issues: StructureIssue[];
}

export interface ShotMeta {
  shot: string;
  setting: string;
  shot_type: string;
  camera: string;
  duration: string;
  color_mood: string;
  status: string;
  asset_type: string;
  reuses: string | null;
  palette_group: string | null;
  risk: string;
  multi_shot_group: string | null;
  elements: string[];
}

export interface ShotContent {
  subject_action: string;
  vo_lines: string;
  sfx_audio: string;
  notes: string;
}

export interface PromptBlock {
  meta: Record<string, unknown>;
  body: string;
  sections?: Record<string, string>;
}

export interface Shot {
  code: string;
  meta: ShotMeta;
  content: ShotContent;
  mjPrompt: PromptBlock | null;
  klingPrompt: PromptBlock | null;
  seedancePrompt: PromptBlock | null;
  nanoBanana: PromptBlock | null;
  imagePath: string | null;
  videoPath: string | null;
}

export interface CharacterView {
  index: number;
  name: string;
  slug: string;
  prompt: string;
  imagePath: string | null;
}

export interface Character {
  name: string;
  slug: string;
  meta: Record<string, unknown>;
  sections: Record<string, string>;
  views: CharacterView[];
}

export interface ProjectIndex {
  config: Record<string, unknown>;
  shots: Shot[];
  characters: Character[];
}

export interface DocumentEntry {
  name: string;
  slug: string;
  content: string;
}

export interface DocumentsResponse {
  docs: DocumentEntry[];
  sceneMap: Record<string, string>;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  shotCode: string;
  promptType: string;
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

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export type CaptionSpeaker = "otto" | "pip" | "narration";
export type CaptionKind = "speech" | "thought" | "card" | "emoji";
export interface CaptionBubble {
  text: string;
  speaker: CaptionSpeaker;
  kind?: CaptionKind;
  x?: number;
  y?: number;
  tail?: "down" | "up" | "left" | "right";
  start: number;
  end: number;
  shape?: "round" | "rectangle" | "sticker" | "burst" | "cloud";
  anim?: "grow" | "pop" | "shake" | "none";
  opacity?: number;
  w?: number;
  bg?: string;
  fg?: string;
  fontSize?: number;
  radius?: number;
  align?: "left" | "center" | "right";
  padX?: number;
  padY?: number;
}
export interface CaptionDoc {
  fps: number;
  clipFrames: number;
  width: number;
  height: number;
  speakerStyle: Record<CaptionSpeaker, { bg: string; fg: string }>;
  shots: { code: string; bubbles: CaptionBubble[] }[];
  /** server-computed: clip codes actually present on disk, in order (not persisted) */
  clips?: string[];
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface GlobalElements {
  slug: string;
  name: string;
  characters: Character[];
}

export interface BibleDoc {
  name: string;
  slug: string;
  group: string;
  content: string;
}

export interface BibleResponse {
  slug: string;
  name: string;
  docs: BibleDoc[];
}

export interface ResourceSample {
  t: string;
  uptimeSec: number;
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  openFds: number | null;
  cpuUserMs: number;
  cpuSystemMs: number;
  eventLoopLag: { meanMs: number; maxMs: number; p99Ms: number };
  ws: {
    clients: number;
    terminatedDead: number;
    droppedBackpressure: number;
    totalConnections: number;
  } | null;
}

export interface MonitorLatest {
  latest: ResourceSample | null;
  samples: number;
  file: string | null;
}

export interface ContinuityIssue {
  rule: "L01" | "L02" | "L03" | "L04" | "L05" | "L06" | "L07" | "L09" | "L11";
  severity: "error" | "warning";
  scene: number | null;
  shotCode: string;
  shotCodeB?: string;
  character?: string;
  object?: string;
  message: string;
}

export interface ContinuityReport {
  project: string;
  timestamp: string;
  scenes: number[];
  shotsChecked: number;
  totalErrors: number;
  totalWarnings: number;
  issues: ContinuityIssue[];
}

export interface EmitChange {
  path: string;
  kind: "nb-prompt" | "kling-prompt" | "board";
  shotCode?: string;
}
export interface EmitResult {
  changes: EmitChange[];
  skipped: number;
  wrote: boolean;
  lint: ContinuityReport;
}

export const api = {
  listProjects: () => get<ProjectSummary[]>("/projects"),
  getMonitor: () => get<MonitorLatest>("/monitor"),
  getWorkspace: () => get<WorkspaceTree>("/workspace"),
  validateStructure: () => get<StructureReport>("/workspace/validate"),
  getGlobalElements: (seriesSlug: string) =>
    get<GlobalElements>(`/workspace/series/${seriesSlug}/global`),
  getBible: (seriesSlug: string) =>
    get<BibleResponse>(`/workspace/series/${seriesSlug}/bible`),
  getActive: () => get<{ slug: string | null }>("/active"),
  setActive: (slug: string | null) => postJson<{ ok: boolean; slug: string | null }>("/active", { slug }),
  getProject: (slug: string) => get<ProjectIndex>(`/projects/${slug}`),
  getShots: (slug: string) => get<Shot[]>(`/projects/${slug}/shots`),
  getShot: (slug: string, code: string) => get<Shot>(`/projects/${slug}/shots/${code}`),
  getCharacters: (slug: string) => get<Character[]>(`/projects/${slug}/characters`),
  getDocuments: (slug: string) => get<DocumentsResponse>(`/projects/${slug}/documents`),
  validateElements: (slug: string) => get<ValidationReport>(`/projects/${slug}/validate-elements`),
  fixElements: (slug: string) => post<FixReport>(`/projects/${slug}/fix-elements`),
  validateContinuity: (slug: string) => get<ContinuityReport>(`/projects/${slug}/validate-continuity`),
  emit: (slug: string, dryRun = false) => postJson<EmitResult>(`/projects/${slug}/emit${dryRun ? "?dryRun=1" : ""}`, {}),
  getAutoEmit: () => get<{ enabled: boolean }>("/emit/autoemit"),
  setAutoEmit: (enabled: boolean) => postJson<{ enabled: boolean }>("/emit/autoemit", { enabled }),
  getCaptions: (slug: string) => get<CaptionDoc>(`/projects/${slug}/captions`),
  saveCaptions: (slug: string, doc: CaptionDoc) => put<{ ok: boolean }>(`/projects/${slug}/captions`, doc),
  renderCaptions: (slug: string) =>
    postJson<{ ok: boolean; output: string; exists: boolean }>(`/projects/${slug}/captions/render`, {}),
};