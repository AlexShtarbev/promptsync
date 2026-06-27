import fs from "fs";
import path from "path";
import { glob } from "glob";
import yaml from "js-yaml";
import type {
  Shot,
  ShotMeta,
  ShotContent,
  MjPromptMeta,
  KlingPromptMeta,
  SeedancePromptMeta,
  NanoBananaMeta,
  PromptSections,
  Character,
  CharacterMeta,
  CharacterView,
  ProjectConfig,
  ProjectIndex,
  SeriesConfig,
  DiscoveredProject,
  DiscoveredSeries,
  Workspace,
  BibleDoc,
} from "../types.js";

function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = body.split(/^## /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newline = part.indexOf("\n");
    if (newline === -1) continue;
    const heading = part.slice(0, newline).trim().toLowerCase().replace(/[\s/]+/g, "_");
    sections[heading] = part.slice(newline + 1).trim();
  }
  return sections;
}

function parsePromptSections(body: string): PromptSections {
  const sections: PromptSections = {};
  const lines = body.split("\n");
  let currentKey: string | null = null;
  let currentContent: string[] = [];

  const flush = () => {
    if (currentKey && currentContent.length > 0) {
      sections[currentKey] = currentContent.join("\n").trim();
    }
    currentKey = null;
    currentContent = [];
  };

  for (const line of lines) {
    const labelMatch = line.match(/^\[([^\]]+)\]:\s*(.*)/);
    if (labelMatch) {
      flush();
      const raw = labelMatch[1].trim();
      currentKey = raw.toLowerCase().replace(/[\s/&]+/g, "_").replace(/_+/g, "_");
      if (labelMatch[2]) currentContent.push(labelMatch[2]);
      continue;
    }

    const taskMatch = line.match(/^TASK:\s*(.*)/);
    if (taskMatch) {
      flush();
      currentKey = "task";
      if (taskMatch[1]) currentContent.push(taskMatch[1]);
      continue;
    }

    const negMatch = line.match(/^Negative prompt:\s*(.*)/);
    if (negMatch) {
      flush();
      currentKey = "negative_prompt";
      if (negMatch[1]) currentContent.push(negMatch[1]);
      continue;
    }

    const qualMatch = line.match(/^Quality guards.*?:\s*(.*)/);
    if (qualMatch) {
      flush();
      currentKey = "quality_guards";
      if (qualMatch[1]) currentContent.push(qualMatch[1]);
      continue;
    }

    const endStateMatch = line.match(/^END STATE:\s*(.*)/);
    if (endStateMatch) {
      flush();
      currentKey = "end_state";
      if (endStateMatch[1]) currentContent.push(endStateMatch[1]);
      continue;
    }

    const fallbackMatch = line.match(/^Fallback:\s*(.*)/);
    if (fallbackMatch) {
      flush();
      currentKey = "fallback";
      if (fallbackMatch[1]) currentContent.push(fallbackMatch[1]);
      continue;
    }

    const watchMatch = line.match(/^Watch for:\s*(.*)/);
    if (watchMatch) {
      flush();
      currentKey = "watch_for";
      if (watchMatch[1]) currentContent.push(watchMatch[1]);
      continue;
    }

    const motionMatch = line.match(/^\[MOTION SCALE:\s*([^\]]+)\]/);
    if (motionMatch) {
      flush();
      sections["motion_scale_line"] = motionMatch[1].trim();
      continue;
    }

    const arMatch = line.match(/^Aspect ratio:\s*(.*)/);
    if (arMatch) {
      flush();
      sections["aspect_ratio_line"] = arMatch[1].trim();
      continue;
    }

    if (currentKey) {
      currentContent.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Split frontmatter from body without ever throwing. Done by hand rather than via
 * gray-matter for two reasons: (1) a malformed YAML block must not 500 a whole
 * endpoint, and (2) gray-matter *caches* — its first parse of a bad file throws, but
 * every later call returns the original (un-stripped) text as `content`, so a
 * try/catch around it is unreliable. We strip the leading `--- ... ---` block by
 * regex and parse the YAML best-effort (empty object on failure).
 */
export function safeMatter(raw: string): { data: Record<string, unknown>; content: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!m) return { data: {}, content: raw };
  let data: Record<string, unknown> = {};
  try {
    data = (yaml.load(m[1]) as Record<string, unknown>) ?? {};
  } catch {
    data = {};
  }
  return { data, content: raw.slice(m[0].length) };
}

function readMdFile(filePath: string): { data: Record<string, unknown>; body: string; sections: Record<string, string> } | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = safeMatter(raw);
  return { data, body: content.trim(), sections: parseSections(content) };
}

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov"];

function findImage(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const ext of IMAGE_EXTS) {
    const p = path.join(dir, `image${ext}`);
    if (fs.existsSync(p)) return p;
  }
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (IMAGE_EXTS.some((ext) => f.toLowerCase().endsWith(ext))) {
      return path.join(dir, f);
    }
  }
  return null;
}

function findStartFrame(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const ext of IMAGE_EXTS) {
    const p = path.join(dir, `start-frame${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findOpenartRef(dir: string, prefix?: string): string | null {
  const filename = prefix ? `${prefix}-openart-ref.json` : "openart-ref.json";
  const p = path.join(dir, filename);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data.url || null;
  } catch {
    return null;
  }
}

function findOpenartResourceId(dir: string, prefix?: string): string | null {
  const filename = prefix ? `${prefix}-openart-ref.json` : "openart-ref.json";
  const p = path.join(dir, filename);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data.resourceId || null;
  } catch {
    return null;
  }
}

function parseShot(shotDir: string, defaultAr = "9:16"): Shot | null {
  const code = path.basename(shotDir);
  const shotFile = readMdFile(path.join(shotDir, "shot.md"));
  if (!shotFile) return null;

  const meta: ShotMeta = {
    shot: (shotFile.data.shot as string) ?? code,
    setting: (shotFile.data.setting as string) ?? "",
    emotion: (shotFile.data.emotion as string) ?? "",
    shot_type: (shotFile.data.shot_type as string) ?? "",
    camera: (shotFile.data.camera as string) ?? "Static",
    duration: (shotFile.data.duration as string) ?? "",
    color_mood: (shotFile.data.color_mood as string) ?? "",
    status: (shotFile.data.status as ShotMeta["status"]) ?? "draft",
    asset_type: (shotFile.data.asset_type as ShotMeta["asset_type"]) ?? "still",
    reuses: (shotFile.data.reuses as string) ?? null,
    palette_group: (shotFile.data.palette_group as string) ?? null,
    risk: (shotFile.data.risk as ShotMeta["risk"]) ?? "low",
    multi_shot_group: (shotFile.data.multi_shot_group as string) ?? null,
    elements: [...((shotFile.data.elements as string[]) ?? [])],
  };

  const content: ShotContent = {
    subject_action: shotFile.sections["subject_&_action"] ?? shotFile.sections["subject_action"] ?? "",
    vo_lines: shotFile.sections["vo___lines"] ?? shotFile.sections["vo_lines"] ?? "",
    sfx_audio: shotFile.sections["sfx___audio"] ?? shotFile.sections["sfx_audio"] ?? "",
    notes: shotFile.sections["notes"] ?? "",
  };

  const mjFileRaw = readMdFile(path.join(shotDir, "mj-prompt.md"));
  const nbFileRaw = mjFileRaw ? null : readMdFile(path.join(shotDir, "nb-prompt.md"));
  const mjFileSource = mjFileRaw ?? nbFileRaw;
  const mjPrompt = mjFileSource
    ? {
        meta: {
          shot: (mjFileSource.data.shot as string) ?? code,
          model: (mjFileSource.data.model as string) ?? "v7",
          style: (mjFileSource.data.style as string) ?? "raw",
          ar: (mjFileSource.data.ar as string) ?? (mjFileSource.data.aspect_ratio as string) ?? defaultAr,
          platform: (mjFileSource.data.platform as MjPromptMeta["platform"]) ?? (nbFileRaw ? "nanobanana" : "mj"),
          reference_images: (mjFileSource.data.reference_images as Record<string, string | null>) ?? {},
        },
        body: mjFileSource.body,
        sections: parsePromptSections(mjFileSource.body),
      }
    : null;

  const imagePath = findImage(shotDir);

  if (imagePath && meta.status === "draft" && meta.asset_type === "still") {
    meta.status = "mj-done";
  }

  const startFramePath = findStartFrame(shotDir);
  const openartRef = findOpenartRef(shotDir);

  return { code, meta, content, mjPrompt, klingPrompt: null, seedancePrompt: null, nanoBanana: null, elementMap: {}, imagePath, startFramePath, videoPath: null, openartRef };
}

function findVideo(videosDir: string, code: string): string | null {
  if (!fs.existsSync(videosDir)) return null;
  for (const ext of VIDEO_EXTS) {
    const p = path.join(videosDir, `${code}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function attachVideoPrompts(shot: Shot, videoPromptsDir: string, defaultAr = "9:16"): void {
  const klingDir = path.join(videoPromptsDir, shot.code);
  if (!fs.existsSync(klingDir)) return;

  const klingFile = readMdFile(path.join(klingDir, "kling-prompt.md"));
  if (klingFile) {
    shot.klingPrompt = {
      meta: {
        shot: (klingFile.data.shot as string) ?? shot.code,
        motion_scale: (klingFile.data.motion_scale as number) ?? 5,
        aspect_ratio: (klingFile.data.aspect_ratio as string) ?? defaultAr,
        mode: (klingFile.data.mode as string) ?? "standard",
        multi_shot_group: (klingFile.data.multi_shot_group as string) ?? null,
        resolution: (klingFile.data.resolution as string) ?? undefined,
        start_frame: (klingFile.data.start_frame as string) ?? undefined,
      },
      body: klingFile.body,
      sections: parsePromptSections(klingFile.body),
    };
  }

  const seedanceFile = readMdFile(path.join(klingDir, "seedance-prompt.md"));
  if (seedanceFile) {
    shot.seedancePrompt = {
      meta: {
        shot: (seedanceFile.data.shot as string) ?? shot.code,
        aspect_ratio: (seedanceFile.data.aspect_ratio as string) ?? defaultAr,
        duration: (seedanceFile.data.duration as number) ?? 5,
        mode: (seedanceFile.data.mode as string) ?? "i2v",
        character_lock: (seedanceFile.data.character_lock as string) ?? null,
        environment_ref: (seedanceFile.data.environment_ref as string) ?? null,
        wardrobe_ref: (seedanceFile.data.wardrobe_ref as string) ?? null,
        start_frame: (seedanceFile.data.start_frame as string) ?? null,
        camerafixed: (seedanceFile.data.camerafixed as boolean) ?? undefined,
        seed: (seedanceFile.data.seed as number) ?? null,
      },
      body: seedanceFile.body,
      sections: parsePromptSections(seedanceFile.body),
    };
  }

  const nbFile = readMdFile(path.join(klingDir, "nanobanana.md"));
  if (nbFile) {
    shot.nanoBanana = {
      meta: {
        shot: (nbFile.data.shot as string) ?? shot.code,
        source: (nbFile.data.source as NanoBananaMeta["source"]) ?? "generate-new",
      },
      body: nbFile.body,
      sections: parsePromptSections(nbFile.body),
    };
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// A section holds reference-image prompts when its heading NAMES a reference artifact
// (reference / sheet / plate / prompt / angle) and isn't one of the prose blocks that
// merely happen to contain a fenced snippet (identity block, element description, …).
// Recognising sections by intent rather than an exact-string enumeration is what keeps
// new heading wording ("Creature Reference Sheet", "Master Plates", …) from silently
// breaking the UI. Keep the negative list to specific prose-block phrases so a real
// reference section is never excluded by accident.
const REF_SECTION_POSITIVE = /\b(reference|sheet|plate|prompt|angle)s?\b/i;
const REF_SECTION_NEGATIVE = /\b(identity block|element description|character lock|canonical|consistency note|visual anchor|transformation note)\b/i;

export function isReferenceSectionHeading(heading: string): boolean {
  return REF_SECTION_POSITIVE.test(heading) && !REF_SECTION_NEGATIVE.test(heading);
}

function parseCharacterViews(body: string, charSlug: string, charsDir: string): CharacterView[] {
  const views: CharacterView[] = [];
  let autoIndex = 1;

  const h2Matches = [...body.matchAll(/^## (.+?)\s*$/gm)];
  for (let h = 0; h < h2Matches.length; h++) {
    const sectionHeading = h2Matches[h][1].trim();
    if (!isReferenceSectionHeading(sectionHeading)) continue;
    const startIdx = h2Matches[h].index! + h2Matches[h][0].length;
    const endIdx = h + 1 < h2Matches.length ? h2Matches[h + 1].index! : body.length;
    const refBlock = body.slice(startIdx, endIdx);
    const subParts = refBlock.split(/^### /m);

    for (const part of subParts) {
      if (!part.trim()) continue;
      const nl = part.indexOf("\n");
      if (nl === -1) continue;
      let heading = part.slice(0, nl).trim();
      const rawPrompt = heading ? part.slice(nl + 1).trim() : part.trim();
      if (!heading) heading = sectionHeading;
      const fenceMatch = rawPrompt.match(/```\n?([\s\S]*?)```/);
      const prompt = fenceMatch
        ? fenceMatch[1].trim()
        : rawPrompt.split("\n").filter((line: string) => !line.startsWith(">")).join("\n").trim();

      // Skip non-prompt content (e.g. the `>` blockquote intro that sits between the
      // section H2 and the first `### Prompt N`), which would otherwise become a
      // phantom view named after the section heading with an empty prompt.
      if (!prompt) continue;

      let index: number;
      let name: string;
      let aspect_ratio: string | null = null;
      let resolution: string | null = null;

      const isPrimary = /\(PRIMARY\)/i.test(heading);
      const angleMatch = heading.match(/(?:Angle|View)\s+(\d+)\s*[—–-]\s*(.+)/);
      const promptNumMatch = angleMatch ? null : heading.match(/Prompt\s+(\d+)\s*[—–-]\s*(.+)/);
      // "### Prompt — Multi-angle Creature Sheet (…)" — a single unnumbered prompt.
      const promptDashMatch = angleMatch || promptNumMatch ? null : heading.match(/^Prompt\s*[—–-]\s*(.+)/);
      if (angleMatch) {
        index = parseInt(angleMatch[1], 10);
        name = angleMatch[2].replace(/\s*\(PRIMARY\)\s*/gi, "").trim();
      } else if (promptNumMatch) {
        index = parseInt(promptNumMatch[1], 10);
        name = promptNumMatch[2].replace(/\s*\(PRIMARY\)\s*/gi, "").trim();
      } else if (promptDashMatch) {
        index = autoIndex;
        name = promptDashMatch[1].replace(/\s*\(PRIMARY\)\s*/gi, "").trim();
      } else {
        index = autoIndex;
        name = heading.replace(/\s*\(PRIMARY\)\s*/gi, "").trim();
      }
      autoIndex = index + 1;

      const outputMatch = name.match(/\((\d+:\d+)(?:,\s*(\w+))?\)\s*$/);
      if (outputMatch) {
        aspect_ratio = outputMatch[1];
        resolution = outputMatch[2] || null;
        name = name.slice(0, outputMatch.index!).trim();
      }

      const viewSlug = slugify(name);

      let imagePath: string | null = null;
      const imgBase = `${charSlug}-${viewSlug}`;
      for (const ext of IMAGE_EXTS) {
        const p = path.join(charsDir, `${imgBase}${ext}`);
        if (fs.existsSync(p)) { imagePath = p; break; }
      }

      const openartRef = findOpenartRef(charsDir, imgBase);
      const openartResourceId = findOpenartResourceId(charsDir, imgBase);
      views.push({ index, name, slug: viewSlug, prompt, imagePath, openartRef, openartResourceId, aspect_ratio, resolution, primary: isPrimary });
    }
  }

  return views.sort((a, b) => a.index - b.index);
}

/** Number of reference views the UI would render for an element body. */
export function countElementViews(body: string, charSlug = "_", charsDir = "/__none__"): number {
  return parseCharacterViews(body, charSlug, charsDir).length;
}

/** Does the body contain a fenced prompt inside a recognised reference section? */
export function hasReferencePrompts(body: string): boolean {
  const h2 = [...body.matchAll(/^## (.+?)\s*$/gm)];
  for (let i = 0; i < h2.length; i++) {
    if (!isReferenceSectionHeading(h2[i][1].trim())) continue;
    const start = h2[i].index! + h2[i][0].length;
    const end = i + 1 < h2.length ? h2[i + 1].index! : body.length;
    if (/```[\s\S]*?```/.test(body.slice(start, end))) return true;
  }
  return false;
}

function parseCharacter(filePath: string, scope: "global" | "local" = "local"): Character | null {
  const file = readMdFile(filePath);
  if (!file) return null;

  const meta: CharacterMeta = {
    name: (file.data.name as string) ?? path.basename(filePath, ".md"),
    element_name: (file.data.element_name as string) ?? "",
    element_type: (file.data.element_type as string) ?? "character",
    appears_in: [...((file.data.appears_in as string[]) ?? [])],
    status: (file.data.status as string) ?? "draft",
    element_status: (file.data.element_status as string) ?? "needs-reference",
    parent_environment: (file.data.parent_environment as string) ?? null,
    // Location is authoritative for scope; canon links the visual sheet to its bible entry.
    scope,
    canon: (file.data.canon as string) ?? null,
    // Optional typed physics specs (physics-engine); importer falls back to Identity-Block prose.
    build: (file.data.build as CharacterMeta["build"]) ?? null,
    concealment: (file.data.concealment as CharacterMeta["concealment"]) ?? null,
    identity_clause: (file.data.identity_clause as string) ?? null,
  };

  const charSlug = path.basename(filePath, ".md");
  const charsDir = path.dirname(filePath);
  const views = parseCharacterViews(file.body, charSlug, charsDir);

  return { name: meta.name, slug: charSlug, meta, sections: file.sections, views };
}

/**
 * Load element files from a set of (dir, scope) sources. Globals should be listed
 * before locals: on an `element_name` (or name) collision the local file overrides
 * the global, letting an episode re-skin a series-wide element.
 */
function collectElements(
  sources: { dir: string; scope: "global" | "local" }[]
): { elements: Character[]; fileBaseNames: Map<Character, string> } {
  const order: Character[] = [];
  const byKey = new Map<string, Character>();
  const fileBaseNames = new Map<Character, string>();

  for (const { dir, scope } of sources) {
    if (!fs.existsSync(dir)) continue;
    const mdFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const f of mdFiles) {
      const char = parseCharacter(path.join(dir, f), scope);
      if (!char) continue;
      const key = char.meta.element_name || char.name;
      const existing = byKey.get(key);
      if (existing) {
        // Local overrides a previously-seen global; otherwise first occurrence wins.
        if (existing.meta.scope === "global" && scope === "local") {
          order.splice(order.indexOf(existing), 1, char);
          fileBaseNames.delete(existing);
        } else {
          continue;
        }
      } else {
        order.push(char);
      }
      byKey.set(key, char);
      fileBaseNames.set(char, path.basename(f, ".md"));
    }
  }
  return { elements: order, fileBaseNames };
}

/** Build the (dir, scope) source list for an episode/project: globals first, then locals. */
function elementSources(
  projectDir: string,
  globalElementDirs: string[]
): { dir: string; scope: "global" | "local" }[] {
  return [
    ...globalElementDirs.map((dir) => ({ dir, scope: "global" as const })),
    ...["characters", "environments", "props"].map((d) => ({
      dir: path.join(projectDir, "storyboard", d),
      scope: "local" as const,
    })),
  ];
}

/** Load just the series-global elements (characters/environments/props), tagged scope: global. */
export function loadGlobalElements(globalElementDirs: string[]): Character[] {
  return collectElements(globalElementDirs.map((dir) => ({ dir, scope: "global" as const }))).elements;
}

/** Load the series bible markdown docs (narrative canon), grouped by subdir. */
export function loadBibleDocs(bibleDir: string): BibleDoc[] {
  if (!fs.existsSync(bibleDir)) return [];
  const docs: BibleDoc[] = [];

  const walk = (dir: string, group: string, depth: number) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < 2 && !e.name.startsWith(".")) walk(full, e.name, depth + 1);
      } else if (e.name.endsWith(".md")) {
        const base = path.basename(e.name, ".md");
        const { content } = safeMatter(fs.readFileSync(full, "utf-8")); // strip frontmatter
        docs.push({
          name: base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          slug: group === "canon" ? base : `${group}/${base}`,
          group,
          content: content.trim(),
        });
      }
    }
  };

  walk(bibleDir, "canon", 0);
  // Group order: canon docs first, then subdirs alphabetically; stable name sort within.
  return docs.sort((a, b) =>
    a.group === b.group ? a.name.localeCompare(b.name) : a.group === "canon" ? -1 : b.group === "canon" ? 1 : a.group.localeCompare(b.group)
  );
}

export function loadProject(
  projectDir: string,
  globalElementDirs: string[] = [],
  seriesDefaults?: { aspect_ratio: string; default_resolution: string }
): ProjectIndex | null {
  const yamlPath = path.join(projectDir, "project.yaml");
  if (!fs.existsSync(yamlPath)) return null;

  const rawConfig = yaml.load(fs.readFileSync(yamlPath, "utf-8")) as Record<string, unknown>;
  const config: ProjectConfig = {
    name: (rawConfig.name as string) ?? "",
    slug: (rawConfig.slug as string) ?? "",
    created: (rawConfig.created as string) ?? "",
    status: (rawConfig.status as string) ?? "",
    drive_folder_id: (rawConfig.drive_folder_id as string) ?? null,
    default_style: (rawConfig.default_style as string) ?? "",
    shot_prefix: (rawConfig.shot_prefix as string) ?? "",
    aspect_ratio: (rawConfig.aspect_ratio as string) ?? seriesDefaults?.aspect_ratio ?? "9:16",
    default_resolution: (rawConfig.default_resolution as string) ?? seriesDefaults?.default_resolution ?? "1K",
  };

  const shotsDir = path.join(projectDir, "storyboard", "shots");
  const videoPromptsDir = path.join(projectDir, "storyboard", "video-prompts");
  const videosDir = path.join(projectDir, "storyboard", "videos");

  const shots: Shot[] = [];
  if (fs.existsSync(shotsDir)) {
    const shotDirs = fs.readdirSync(shotsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(shotsDir, d.name))
      .sort();

    for (const dir of shotDirs) {
      const shot = parseShot(dir, config.aspect_ratio);
      if (shot) {
        attachVideoPrompts(shot, videoPromptsDir, config.aspect_ratio);
        shot.videoPath = findVideo(videosDir, shot.code);
        shots.push(shot);
      }
    }
  }

  const { elements: allElements, fileBaseNames } = collectElements(
    elementSources(projectDir, globalElementDirs)
  );

  const parentEnvSlugs = new Set(
    allElements.map((c) => c.meta.parent_environment).filter(Boolean) as string[]
  );
  const characters = allElements.filter(
    (c) => !parentEnvSlugs.has(fileBaseNames.get(c)!)
  );

  for (const shot of shots) {
    if (!shot.meta.elements.length) {
      for (const char of characters) {
        if (char.meta.appears_in.includes(shot.code)) {
          shot.meta.elements.push(char.meta.element_name || char.name);
        }
      }
    }
    for (const char of characters) {
      const eName = char.meta.element_name || char.name;
      if (eName !== char.name) {
        shot.elementMap[eName] = char.name;
      }
    }
  }

  return { config, shots, characters };
}

function resolveElements(shot: Shot, projectDir: string, globalElementDirs: string[] = []): void {
  const { elements: allChars } = collectElements(elementSources(projectDir, globalElementDirs));

  if (!shot.meta.elements.length) {
    for (const char of allChars) {
      if (char.meta.appears_in.includes(shot.code)) {
        shot.meta.elements.push(char.meta.element_name || char.name);
      }
    }
  }

  for (const char of allChars) {
    const eName = char.meta.element_name || char.name;
    if (eName !== char.name) {
      shot.elementMap[eName] = char.name;
    }
  }
}

export function loadSingleShot(
  projectDir: string,
  code: string,
  globalElementDirs: string[] = [],
  seriesDefaults?: { aspect_ratio: string; default_resolution: string }
): Shot | null {
  const ar = readProjectAspectRatio(projectDir, seriesDefaults);
  const shotDir = path.join(projectDir, "storyboard", "shots", code);
  const shot = parseShot(shotDir, ar);
  if (!shot) return null;
  attachVideoPrompts(shot, path.join(projectDir, "storyboard", "video-prompts"), ar);
  shot.videoPath = findVideo(path.join(projectDir, "storyboard", "videos"), shot.code);
  resolveElements(shot, projectDir, globalElementDirs);
  return shot;
}

function readProjectAspectRatio(
  projectDir: string,
  seriesDefaults?: { aspect_ratio: string; default_resolution: string }
): string {
  const fallback = seriesDefaults?.aspect_ratio ?? "9:16";
  const yamlPath = path.join(projectDir, "project.yaml");
  if (!fs.existsSync(yamlPath)) return fallback;
  try {
    const raw = yaml.load(fs.readFileSync(yamlPath, "utf-8")) as Record<string, unknown>;
    return (raw.aspect_ratio as string) ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadSingleCharacter(
  projectDir: string,
  charSlug: string,
  globalElementDirs: string[] = []
): Character | null {
  // Search episode-local dirs first so a local override wins over a global of the same slug.
  const localDirs = ["characters", "environments", "props"].map(
    (d) => path.join(projectDir, "storyboard", d)
  );
  for (const [dir, scope] of [
    ...localDirs.map((d) => [d, "local"] as const),
    ...globalElementDirs.map((d) => [d, "global"] as const),
  ]) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      const char = parseCharacter(path.join(dir, f), scope);
      if (char && char.slug === charSlug) return char;
    }
  }
  return null;
}

// Directories we never descend into while hunting for projects.
const DISCOVERY_SKIP_DIRS = new Set([
  "node_modules", "dist", "build", ".next", ".cache", "storyboard", "video-prompts",
]);

function readProjectConfig(yamlPath: string): ProjectConfig | null {
  try {
    const raw = yaml.load(fs.readFileSync(yamlPath, "utf-8")) as Record<string, unknown>;
    return {
      name: (raw.name as string) ?? "",
      slug: (raw.slug as string) ?? "",
      created: (raw.created as string) ?? "",
      status: (raw.status as string) ?? "",
      drive_folder_id: (raw.drive_folder_id as string) ?? null,
      default_style: (raw.default_style as string) ?? "",
      shot_prefix: (raw.shot_prefix as string) ?? "",
      aspect_ratio: (raw.aspect_ratio as string) ?? "9:16",
      default_resolution: (raw.default_resolution as string) ?? "1K",
    };
  } catch {
    return null; // skip malformed project.yaml
  }
}

function globalElementDirsFor(globalDir: string): string[] {
  return ["characters", "environments", "props"].map((d) => path.join(globalDir, d));
}

/** Read a series.yaml and resolve its global library + episodes. */
function loadSeries(
  seriesDir: string,
  seen: { paths: Set<string>; slugs: Set<string> }
): DiscoveredSeries | null {
  let raw: Record<string, unknown>;
  try {
    raw = yaml.load(fs.readFileSync(path.join(seriesDir, "series.yaml"), "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  const config: SeriesConfig = {
    name: (raw.name as string) ?? path.basename(seriesDir),
    slug: (raw.slug as string) ?? path.basename(seriesDir),
    type: "series",
    status: (raw.status as string) ?? "",
    aspect_ratio: (raw.aspect_ratio as string) ?? "9:16",
    default_resolution: (raw.default_resolution as string) ?? "1K",
    drive_folder_id: (raw.drive_folder_id as string) ?? null,
    global_elements: (raw.global_elements as string) ?? "storyboard",
    bible: (raw.bible as string) ?? "bible",
  };

  const globalDir = path.resolve(seriesDir, config.global_elements);
  const globalElementDirs = globalElementDirsFor(globalDir);

  // Episodes: explicit ordered list, else auto-discover dirs under episodes/.
  let episodeDirs: string[];
  if (Array.isArray(raw.episodes) && raw.episodes.length) {
    episodeDirs = (raw.episodes as string[]).map((e) => path.resolve(seriesDir, e));
  } else {
    const episodesRoot = path.join(seriesDir, "episodes");
    episodeDirs = fs.existsSync(episodesRoot)
      ? fs.readdirSync(episodesRoot, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => path.join(episodesRoot, d.name))
          .sort()
      : [];
  }

  const episodes: DiscoveredProject[] = [];
  for (const epDir of episodeDirs) {
    const epYaml = path.join(epDir, "project.yaml");
    if (!fs.existsSync(epYaml)) continue; // episode not yet at storyboard stage
    const resolved = path.resolve(epDir);
    if (seen.paths.has(resolved)) continue;
    const epConfig = readProjectConfig(epYaml);
    if (!epConfig) continue;
    const slug = epConfig.slug || path.basename(epDir);
    if (seen.slugs.has(slug)) continue;
    seen.paths.add(resolved);
    seen.slugs.add(slug);
    episodes.push({
      slug, path: epDir, config: epConfig, seriesSlug: config.slug, globalElementDirs,
      seriesDefaults: { aspect_ratio: config.aspect_ratio, default_resolution: config.default_resolution },
    });
  }

  return { slug: config.slug, path: seriesDir, config, globalDir, globalElementDirs, episodes };
}

/**
 * Discover the full workspace under one or more base directories: standalone projects
 * plus series (each with its global library and episodes).
 *
 * A directory with a `series.yaml` is a series root — it owns its whole subtree and is
 * not descended into for standalone projects. A directory with a `project.yaml` is a
 * project leaf. Other directories are walked up to `maxDepth` levels deep.
 */
// Short-TTL cache so a burst of requests (e.g. many image fetches) doesn't re-walk
// the filesystem each time. Invalidated on any watched file change; TTL bounds staleness.
let wsCache: { key: string; time: number; value: Workspace } | null = null;
const WS_TTL_MS = 1500;

export function invalidateWorkspaceCache(): void {
  wsCache = null;
}

export function discoverWorkspace(baseDirs: string | string[], maxDepth = 4): Workspace {
  const roots = (Array.isArray(baseDirs) ? baseDirs : [baseDirs]).filter(Boolean);

  const key = `${roots.join("|")}#${maxDepth}`;
  const now = Date.now();
  if (wsCache && wsCache.key === key && now - wsCache.time < WS_TTL_MS) return wsCache.value;
  const projects: DiscoveredProject[] = [];
  const series: DiscoveredSeries[] = [];
  const seen = { paths: new Set<string>(), slugs: new Set<string>() };
  const seenSeries = new Set<string>();

  const visit = (dir: string, depth: number) => {
    if (fs.existsSync(path.join(dir, "series.yaml"))) {
      const resolved = path.resolve(dir);
      if (seenSeries.has(resolved)) return;
      seenSeries.add(resolved);
      const s = loadSeries(dir, seen);
      if (s) series.push(s);
      return; // series owns its subtree — episodes captured by loadSeries
    }

    const projYaml = path.join(dir, "project.yaml");
    if (fs.existsSync(projYaml)) {
      const resolved = path.resolve(dir);
      if (seen.paths.has(resolved)) return;
      const config = readProjectConfig(projYaml);
      if (config) {
        const slug = config.slug || path.basename(dir);
        if (!seen.slugs.has(slug)) {
          seen.paths.add(resolved);
          seen.slugs.add(slug);
          projects.push({ slug, path: dir, config, seriesSlug: null, globalElementDirs: [] });
        }
      }
      return; // project leaf — never descend into a project's own subfolders
    }

    if (depth >= maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || DISCOVERY_SKIP_DIRS.has(entry.name)) continue;
      visit(path.join(dir, entry.name), depth + 1);
    }
  };

  for (const root of roots) {
    if (fs.existsSync(root)) visit(root, 0);
  }
  const value: Workspace = { projects, series };
  wsCache = { key, time: now, value };
  return value;
}

/**
 * Flat list of every project (standalone + series episodes), each enriched with its
 * owning series' global element dirs. Back-compatible entry point for routes that
 * resolve a single project by slug.
 */
export function discoverProjects(baseDirs: string | string[], maxDepth = 4): DiscoveredProject[] {
  const ws = discoverWorkspace(baseDirs, maxDepth);
  return [...ws.projects, ...ws.series.flatMap((s) => s.episodes)];
}
