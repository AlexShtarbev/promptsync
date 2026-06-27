import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import {
  discoverWorkspace, invalidateWorkspaceCache,
  safeMatter, hasReferencePrompts, countElementViews,
} from "./markdown-parser.js";

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function pascalCase(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

const ELEMENT_DIR: Record<string, string> = {
  character: "characters",
  creature: "characters",
  environment: "environments",
  prop: "props",
};

// ---------------------------------------------------------------------------
// Templates — the canonical shapes every generated file must follow
// ---------------------------------------------------------------------------

export function seriesYamlTemplate(slug: string, name: string, episodes: string[]): string {
  const eps = episodes.length
    ? episodes.map((e) => `  - episodes/${e}`).join("\n")
    : "  []";
  return `name: "${name}"
slug: ${slug}
type: series
status: in-progress

aspect_ratio: "9:16"
default_resolution: "1K"
drive_folder_id: null

global_elements: storyboard
bible: bible

episodes:
${eps}
`;
}

export function projectYamlTemplate(slug: string, name: string, created: string): string {
  return `name: "${name}"
slug: ${slug}
created: ${created}
status: in-progress

drive_folder_id: null
default_style: null
shot_prefix: ""
aspect_ratio: "9:16"
default_resolution: "1K"

consistency_check:
  status: pending
  checked_date: null
  characters: []

element_creation:
  status: pending
  checked_date: null
  characters: []
`;
}

export interface ElementSpec {
  type: "character" | "creature" | "environment" | "prop";
  name: string;
  scope: "global" | "local";
  element_name?: string;
  canon?: string | null;
}

export function elementTemplate(spec: ElementSpec): string {
  const elementName = spec.element_name || pascalCase(spec.name);
  const fm: string[] = [
    `name: "${spec.name}"`,
    `element_name: "${elementName}"`,
    `element_type: ${spec.type}`,
  ];
  if (spec.scope === "global") fm.push("scope: global");
  if (spec.canon) fm.push(`canon: ${spec.canon}`);
  else if (spec.scope === "global") fm.push(`canon: # TODO link to bible/characters/${slugify(spec.name)}.md`);
  fm.push("appears_in: []", "status: draft", "element_status: not-created");

  const head = `---\n${fm.join("\n")}\n---\n\n# ${spec.name}\n`;

  if (spec.type === "environment") {
    return head + `
## Spatial Map
{Exact layout. Anchor objects with fixed positions. Camera angles used; what is visible from each.}

## Forbidden Drift
{Objects/elements the AI must NOT hallucinate in this space.}

## NanoBanana Environment Plate Prompt (16:9, 1K)

\`\`\`
{character-free master plate — fill in. IMPORTANT: No humans, no people, no silhouettes.}
\`\`\`
`;
  }
  if (spec.type === "prop") {
    return head + `
## Identity Block
{What it is, materials, scale, distinctive features.}

## NanoBanana Prop Plate Prompt (1:1, 1K)

\`\`\`
{multi-angle product reference sheet on clean mid-grey seamless background — fill in.}
\`\`\`
`;
  }
  // character / creature
  return head + `
## Identity Block

\`\`\`
Face:
Hair:
Build:
Wardrobe:
Distinctive:
\`\`\`

## Visual identity
- **Signature traits:**
- **Palette:**

## NanoBanana 4 Reference Prompts

### Angle 1 — Front Three-Quarter (PRIMARY)

\`\`\`
{fill in}
\`\`\`

### Angle 2 — Side Profile

\`\`\`
{fill in}
\`\`\`

### Angle 3 — Back Three-Quarter

\`\`\`
{fill in}
\`\`\`

### Angle 4 — Extreme Close-Up Face

\`\`\`
{fill in}
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Scaffolding — create the correct skeleton; never overwrite existing files
// ---------------------------------------------------------------------------

export interface ScaffoldResult {
  created: string[];
  skipped: string[];
}

function ensureDir(dir: string, res: ScaffoldResult) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    res.created.push(dir + "/");
    invalidateWorkspaceCache();
  }
}

function writeIfAbsent(file: string, content: string, res: ScaffoldResult) {
  if (fs.existsSync(file)) {
    res.skipped.push(file);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  res.created.push(file);
  invalidateWorkspaceCache();
}

/** Storyboard subdirs every project/episode/series-library has. */
function scaffoldStoryboardDirs(storyboardDir: string, res: ScaffoldResult) {
  for (const d of ["characters", "environments", "props"]) {
    ensureDir(path.join(storyboardDir, d), res);
  }
}

export function scaffoldProject(projectDir: string, slug: string, name: string, created: string): ScaffoldResult {
  const res: ScaffoldResult = { created: [], skipped: [] };
  ensureDir(projectDir, res);
  writeIfAbsent(path.join(projectDir, "project.yaml"), projectYamlTemplate(slug, name, created), res);
  scaffoldStoryboardDirs(path.join(projectDir, "storyboard"), res);
  return res;
}

export function scaffoldEpisode(seriesDir: string, epSlug: string, name: string, created: string): ScaffoldResult {
  const epDir = path.join(seriesDir, "episodes", epSlug);
  const res = scaffoldProject(epDir, epSlug, name, created);
  // Register the episode in series.yaml if it isn't already listed.
  const seriesYaml = path.join(seriesDir, "series.yaml");
  if (fs.existsSync(seriesYaml)) {
    const raw = yaml.load(fs.readFileSync(seriesYaml, "utf-8")) as Record<string, unknown>;
    const eps = Array.isArray(raw.episodes) ? (raw.episodes as string[]) : [];
    const ref = `episodes/${epSlug}`;
    if (!eps.includes(ref)) {
      eps.push(ref);
      raw.episodes = eps;
      fs.writeFileSync(seriesYaml, yaml.dump(raw, { lineWidth: -1 }));
      invalidateWorkspaceCache();
      res.created.push(`${seriesYaml} (registered ${ref})`);
    }
  }
  return res;
}

export function scaffoldSeries(seriesDir: string, slug: string, name: string, episodes: string[], created: string): ScaffoldResult {
  const res: ScaffoldResult = { created: [], skipped: [] };
  ensureDir(seriesDir, res);
  writeIfAbsent(path.join(seriesDir, "series.yaml"), seriesYamlTemplate(slug, name, episodes), res);
  scaffoldStoryboardDirs(path.join(seriesDir, "storyboard"), res);          // global library
  ensureDir(path.join(seriesDir, "bible", "characters"), res);              // narrative canon
  for (const ep of episodes) {
    const epRes = scaffoldEpisode(seriesDir, ep, ep, created);
    res.created.push(...epRes.created);
    res.skipped.push(...epRes.skipped);
  }
  return res;
}

/** Create one element file with the correct frontmatter in the correct dir. */
export function scaffoldElement(baseDir: string, spec: ElementSpec): ScaffoldResult {
  const res: ScaffoldResult = { created: [], skipped: [] };
  const dir = path.join(baseDir, "storyboard", ELEMENT_DIR[spec.type] ?? "characters");
  writeIfAbsent(path.join(dir, `${slugify(spec.name)}.md`), elementTemplate(spec), res);
  return res;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IssueLevel = "error" | "warning" | "info";

export interface StructureIssue {
  level: IssueLevel;
  code: string;
  context: string; // series/project/episode slug or file path
  message: string;
  fixable: boolean;
}

interface ScannedElement {
  file: string;
  element_name: string | null;
  element_type: string;
  scope: "global" | "local";
  canon: string | null;
  hasScopeField: boolean;
  hasRefPrompts: boolean; // a reference section with a fenced prompt exists
  views: number;          // how many views the UI would actually render
}

function scanElements(dir: string, scope: "global" | "local"): ScannedElement[] {
  if (!fs.existsSync(dir)) return [];
  const out: ScannedElement[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const file = path.join(dir, f);
    const { data, content } = safeMatter(fs.readFileSync(file, "utf-8"));
    out.push({
      file,
      element_name: (data.element_name as string) ?? null,
      element_type: (data.element_type as string) ?? "character",
      scope,
      canon: (data.canon as string) ?? null,
      hasScopeField: data.scope !== undefined,
      hasRefPrompts: hasReferencePrompts(content),
      views: countElementViews(content, path.basename(f, ".md"), dir),
    });
  }
  return out;
}

/** Flag an element whose reference prompts exist but render zero views in the UI. */
function checkViews(e: ScannedElement, add: (level: IssueLevel, code: string, ctx: string, msg: string, fixable?: boolean) => void) {
  if (e.hasRefPrompts && e.views === 0) {
    add("warning", "ELEMENT_NO_VIEWS", e.file,
      "Reference prompts are present but parse into 0 views — check the section heading format", false);
  }
}

function declaredElementNames(projectYamlPath: string): string[] {
  try {
    const raw = yaml.load(fs.readFileSync(projectYamlPath, "utf-8")) as Record<string, unknown>;
    const el = raw.elements;
    if (!el) return [];
    if (Array.isArray(el)) return el.map(String);
    if (typeof el === "object") {
      return Object.values(el as Record<string, unknown>)
        .flatMap((v) => (Array.isArray(v) ? v : []))
        .map(String);
    }
  } catch { /* ignore */ }
  return [];
}

const LOCAL_SUBDIRS = ["characters", "environments", "props"];

function localElementDirs(projectDir: string): string[] {
  return LOCAL_SUBDIRS.map((d) => path.join(projectDir, "storyboard", d));
}

export function validateStructure(baseDirs: string | string[]): StructureIssue[] {
  const ws = discoverWorkspace(baseDirs);
  const issues: StructureIssue[] = [];
  const add = (level: IssueLevel, code: string, context: string, message: string, fixable = false) =>
    issues.push({ level, code, context, message, fixable });

  // --- Series ---
  for (const s of ws.series) {
    const ctx = s.slug;

    if (!fs.existsSync(s.globalDir)) {
      add("error", "GLOBAL_DIR_MISSING", ctx, `Global library missing: ${s.globalDir}`, true);
    } else {
      for (const sub of LOCAL_SUBDIRS) {
        if (!fs.existsSync(path.join(s.globalDir, sub))) {
          add("info", "GLOBAL_SUBDIR_MISSING", ctx, `Global ${sub}/ dir missing under ${s.globalDir}`, true);
        }
      }
    }

    const bibleDir = path.resolve(s.path, s.config.bible || "bible");
    if (!fs.existsSync(bibleDir)) {
      add("warning", "BIBLE_DIR_MISSING", ctx, `Bible dir missing: ${bibleDir}`, true);
    }

    // Global element files: scope tag + canon resolution.
    const globals = scanElements(path.join(s.globalDir, "characters"), "global")
      .concat(scanElements(path.join(s.globalDir, "environments"), "global"))
      .concat(scanElements(path.join(s.globalDir, "props"), "global"));

    for (const g of globals) {
      if (!g.element_name) {
        add("error", "ELEMENT_NO_NAME", g.file, `Element file has no element_name`, false);
      }
      if (!g.hasScopeField) {
        add("warning", "SCOPE_MISSING", g.file, `Global element missing 'scope: global'`, true);
      }
      if (!g.canon) {
        add("warning", "CANON_MISSING", g.file, `Global element missing 'canon:' link to bible`, false);
      } else if (!fs.existsSync(path.resolve(path.dirname(g.file), g.canon))) {
        add("error", "CANON_BROKEN", g.file, `canon path does not resolve: ${g.canon}`, false);
      }
      checkViews(g, add);
    }

    // Reverse linkage: a bible character with no global visual sheet pointing at it.
    // Advisory only — not every canon entry (e.g. a voice) is visually designed.
    const referencedCanon = new Set<string>(
      globals.filter((g) => g.canon).map((g) => path.resolve(path.dirname(g.file), g.canon!))
    );
    const bibleCharsDir = path.join(bibleDir, "characters");
    if (fs.existsSync(bibleCharsDir)) {
      for (const f of fs.readdirSync(bibleCharsDir).filter((f) => f.endsWith(".md"))) {
        const bibleFile = path.resolve(bibleCharsDir, f);
        if (!referencedCanon.has(bibleFile)) {
          add("info", "BIBLE_NO_SHEET", ctx, `Bible character "${f}" has no global visual sheet linking to it (canon:)`, false);
        }
      }
    }

    // Per-episode: dangling references, element_name collisions, placement.
    const localNameToEpisodes = new Map<string, string[]>();
    for (const ep of s.episodes) {
      const locals = localElementDirs(ep.path).flatMap((d) => scanElements(d, "local"));
      for (const l of locals) {
        if (l.element_name) {
          localNameToEpisodes.set(l.element_name, [...(localNameToEpisodes.get(l.element_name) ?? []), ep.slug]);
        }
        checkViews(l, add);
      }

      const effective = new Set<string>(
        [...globals, ...locals].map((e) => e.element_name).filter(Boolean) as string[]
      );
      for (const ref of declaredElementNames(path.join(ep.path, "project.yaml"))) {
        if (!effective.has(ref)) {
          add("error", "DANGLING_REF", ep.slug, `project.yaml references unknown element "${ref}" (not in global ∪ local)`, false);
        }
      }

      // Collisions: more than one source for an element_name that is not a clean global→local override.
      const byName = new Map<string, ScannedElement[]>();
      for (const e of [...globals, ...locals]) {
        if (!e.element_name) continue;
        byName.set(e.element_name, [...(byName.get(e.element_name) ?? []), e]);
      }
      for (const [name, entries] of byName) {
        if (entries.length < 2) continue;
        const globalsN = entries.filter((e) => e.scope === "global").length;
        const localsN = entries.filter((e) => e.scope === "local").length;
        if (!(globalsN === 1 && localsN === 1)) {
          add("error", "DUP_ELEMENT", ep.slug, `element_name "${name}" defined by ${entries.length} files (not a clean global→local override)`, false);
        }
      }
    }

    // An element kept local in multiple episodes probably belongs in the global library.
    for (const [name, eps] of localNameToEpisodes) {
      if (eps.length > 1) {
        add("warning", "SHOULD_BE_GLOBAL", ctx, `"${name}" is a local element in ${eps.length} episodes (${eps.join(", ")}) — promote to the global library`, false);
      }
    }
  }

  // --- Standalone projects ---
  for (const p of ws.projects) {
    const locals = localElementDirs(p.path).flatMap((d) => scanElements(d, "local"));
    const effective = new Set<string>(locals.map((e) => e.element_name).filter(Boolean) as string[]);
    for (const l of locals) {
      if (!l.element_name) add("error", "ELEMENT_NO_NAME", l.file, `Element file has no element_name`, false);
      checkViews(l, add);
    }
    for (const ref of declaredElementNames(path.join(p.path, "project.yaml"))) {
      if (!effective.has(ref)) {
        add("error", "DANGLING_REF", p.slug, `project.yaml references unknown element "${ref}"`, false);
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Auto-fix (conservative — only the fixable issues)
// ---------------------------------------------------------------------------

export interface FixResult {
  applied: string[];
  remaining: StructureIssue[];
}

function addScopeGlobal(file: string): boolean {
  const raw = fs.readFileSync(file, "utf-8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  if (/^scope:/m.test(m[1])) return true;
  // Insert after element_type, else at the end of the frontmatter block.
  let block = m[1];
  if (/^element_type:.*$/m.test(block)) {
    block = block.replace(/^(element_type:.*)$/m, `$1\nscope: global`);
  } else {
    block = `${block}\nscope: global`;
  }
  fs.writeFileSync(file, raw.replace(m[1], block));
  invalidateWorkspaceCache();
  return true;
}

export function fixStructure(baseDirs: string | string[]): FixResult {
  const applied: string[] = [];
  // Derive concrete fixes directly from the workspace for determinism.
  const ws = discoverWorkspace(baseDirs);
  for (const s of ws.series) {
    for (const sub of LOCAL_SUBDIRS) {
      const d = path.join(s.globalDir, sub);
      if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); applied.push(`created ${d}/`); }
    }
    const bibleDir = path.resolve(s.path, s.config.bible || "bible");
    if (!fs.existsSync(bibleDir)) { fs.mkdirSync(path.join(bibleDir, "characters"), { recursive: true }); applied.push(`created ${bibleDir}/`); }
    for (const sub of LOCAL_SUBDIRS) {
      for (const g of scanElements(path.join(s.globalDir, sub), "global")) {
        if (!g.hasScopeField && addScopeGlobal(g.file)) applied.push(`set scope: global in ${g.file}`);
      }
    }
  }
  return { applied, remaining: validateStructure(baseDirs) };
}
