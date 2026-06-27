import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type {
  ProjectIndex,
  Shot,
  ValidationIssue,
  ShotValidationResult,
  ValidationReport,
  FixAction,
  FixReport,
} from "../types.js";

const MENTION_RE = /@([a-zA-Z][a-zA-Z0-9]*)/g;

export function extractMentions(body: string): string[] {
  const mentions: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (!mentions.includes(m[1])) mentions.push(m[1]);
  }
  return mentions;
}

type PromptType = "nb-prompt" | "kling-prompt" | "seedance-prompt";

interface PromptSource {
  type: PromptType;
  body: string;
}

function getValidatablePrompts(shot: Shot): PromptSource[] {
  const sources: PromptSource[] = [];

  if (shot.mjPrompt) {
    const platform = shot.mjPrompt.meta.platform;
    if (platform === "nanobanana") {
      sources.push({ type: "nb-prompt", body: shot.mjPrompt.body });
    }
  }

  if (shot.klingPrompt) {
    sources.push({ type: "kling-prompt", body: shot.klingPrompt.body });
  }

  if (shot.seedancePrompt) {
    sources.push({ type: "seedance-prompt", body: shot.seedancePrompt.body });
  }

  return sources;
}

function validateShot(
  shot: Shot,
  knownElements: Set<string>,
): ShotValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const elem of shot.meta.elements) {
    if (!knownElements.has(elem)) {
      errors.push({
        severity: "error",
        shotCode: shot.code,
        promptType: "nb-prompt",
        message: `Element "${elem}" in shot.md elements array does not match any known element_name`,
        elementName: elem,
      });
    }
  }

  const prompts = getValidatablePrompts(shot);
  if (prompts.length === 0) {
    return { shotCode: shot.code, errors, warnings };
  }

  const allMentionedInPrompts = new Set<string>();

  for (const src of prompts) {
    const mentions = extractMentions(src.body);

    for (const mention of mentions) {
      allMentionedInPrompts.add(mention);

      if (!knownElements.has(mention)) {
        errors.push({
          severity: "error",
          shotCode: shot.code,
          promptType: src.type,
          message: `@${mention} does not match any known element_name`,
          mention,
        });
      }
    }

    for (const mention of mentions) {
      if (knownElements.has(mention) && !shot.meta.elements.includes(mention)) {
        warnings.push({
          severity: "warning",
          shotCode: shot.code,
          promptType: src.type,
          message: `@${mention} is mentioned in ${src.type} but not listed in shot.md elements`,
          mention,
        });
      }
    }
  }

  for (const elem of shot.meta.elements) {
    if (knownElements.has(elem) && !allMentionedInPrompts.has(elem)) {
      warnings.push({
        severity: "warning",
        shotCode: shot.code,
        promptType: "nb-prompt",
        message: `Element "${elem}" is listed in shot.md elements but not @mentioned in any prompt`,
        elementName: elem,
      });
    }
  }

  return { shotCode: shot.code, errors, warnings };
}

export function validateElements(
  project: ProjectIndex,
  projectSlug: string,
): ValidationReport {
  const knownElements = new Set<string>();
  for (const char of project.characters) {
    knownElements.add(char.meta.element_name || char.name);
  }

  const results: ShotValidationResult[] = [];
  let shotsChecked = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const shot of project.shots) {
    const prompts = getValidatablePrompts(shot);
    if (prompts.length === 0 && shot.meta.elements.length === 0) continue;

    shotsChecked++;
    const result = validateShot(shot, knownElements);

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    if (result.errors.length > 0 || result.warnings.length > 0) {
      results.push(result);
    }
  }

  return {
    project: projectSlug,
    timestamp: new Date().toISOString(),
    totalShots: project.shots.length,
    shotsChecked,
    totalErrors,
    totalWarnings,
    knownElements: [...knownElements].sort(),
    results,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-]/g, "");
}

function fuzzyMatch(unknown: string, knownElements: Set<string>): string | null {
  const norm = normalize(unknown);
  for (const known of knownElements) {
    if (normalize(known) === norm) return known;
  }
  return null;
}

function writeShotElements(shotMdPath: string, elements: string[]): void {
  const raw = fs.readFileSync(shotMdPath, "utf-8");
  const { data, content } = matter(raw);
  data.elements = elements;
  const output = matter.stringify(content, data);
  fs.writeFileSync(shotMdPath, output, "utf-8");
}

export function fixElements(
  project: ProjectIndex,
  projectSlug: string,
  projectDir: string,
): FixReport {
  const knownElements = new Set<string>();
  for (const char of project.characters) {
    knownElements.add(char.meta.element_name || char.name);
  }

  const fixes: FixAction[] = [];
  const unfixable: ValidationIssue[] = [];

  const shotEdits = new Map<string, string[]>();

  for (const shot of project.shots) {
    const prompts = getValidatablePrompts(shot);
    if (prompts.length === 0 && shot.meta.elements.length === 0) continue;

    let elements = [...shot.meta.elements];
    let changed = false;

    // Fix errors: unknown elements in shot.md via fuzzy match
    for (const elem of shot.meta.elements) {
      if (knownElements.has(elem)) continue;

      const match = fuzzyMatch(elem, knownElements);
      if (match) {
        elements = elements.map((e) => (e === elem ? match : e));
        changed = true;
        fixes.push({
          shotCode: shot.code,
          action: "replaced",
          element: elem,
          replacement: match,
        });
      } else {
        unfixable.push({
          severity: "error",
          shotCode: shot.code,
          promptType: "nb-prompt",
          message: `Element "${elem}" has no fuzzy match among known elements`,
          elementName: elem,
        });
      }
    }

    // Collect all @mentions across all prompts for this shot
    const allMentioned = new Set<string>();
    for (const src of prompts) {
      for (const m of extractMentions(src.body)) {
        allMentioned.add(m);
      }
    }

    // Fix warning: @mention in prompt but not in elements → add
    for (const mention of allMentioned) {
      if (knownElements.has(mention) && !elements.includes(mention)) {
        elements.push(mention);
        changed = true;
        fixes.push({
          shotCode: shot.code,
          action: "added",
          element: mention,
        });
      }
    }

    // Fix warning: element in shot.md but not @mentioned → remove
    const toRemove: string[] = [];
    for (const elem of elements) {
      if (knownElements.has(elem) && !allMentioned.has(elem)) {
        toRemove.push(elem);
        fixes.push({
          shotCode: shot.code,
          action: "removed",
          element: elem,
        });
      }
    }
    if (toRemove.length > 0) {
      elements = elements.filter((e) => !toRemove.includes(e));
      changed = true;
    }

    if (changed) {
      shotEdits.set(shot.code, elements);
    }
  }

  // Write all changes to disk
  const shotsDir = path.join(projectDir, "storyboard", "shots");
  for (const [code, elements] of shotEdits) {
    const shotMdPath = path.join(shotsDir, code, "shot.md");
    if (fs.existsSync(shotMdPath)) {
      writeShotElements(shotMdPath, elements);
    }
  }

  return {
    project: projectSlug,
    timestamp: new Date().toISOString(),
    fixes,
    unfixable,
  };
}
