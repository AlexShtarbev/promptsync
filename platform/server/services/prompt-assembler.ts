/**
 * Prompt assembler (physics-engine Tier-1, doc 02 §3 — "the three files become projections
 * of one model").
 *
 * Takes the compiled mandatory state clauses and weaves them into a complete nb-prompt: the
 * compiler OWNS the [Subject] block (identity + build + posture + held object + concealment +
 * target) and the Negative line (per-platform policy); every other block ([World Plate],
 * [Cinematography], [Optical Realism], …) and the frontmatter are the author's and pass
 * through byte-for-byte. Because [Subject] is regenerated FROM state, the continuity invariants
 * hold by construction — the validator on the assembled file goes green.
 */
import matter from "gray-matter";
import type { CompiledClauses, ClauseKind } from "./state-compiler.js";

interface PromptBlock {
  type: "label" | "negative" | "loose";
  label?: string; // original label text, e.g. "Subject", "World Plate", "Skin & Surface"
  content: string;
}

/** Split a prompt body into ordered blocks, preserving original labels (and stray prose). */
export function parsePromptBlocks(body: string): PromptBlock[] {
  const lines = body.split("\n");
  const blocks: PromptBlock[] = [];
  let cur: { type: PromptBlock["type"]; label?: string; lines: string[] } | null = null;
  const flush = () => {
    if (cur) blocks.push({ type: cur.type, label: cur.label, content: cur.lines.join("\n").trim() });
    cur = null;
  };
  for (const line of lines) {
    const labelM = line.match(/^\[([^\]]+)\]:\s*(.*)$/);
    const negM = line.match(/^Negative prompt:\s*(.*)$/i);
    if (labelM) {
      flush();
      cur = { type: "label", label: labelM[1].trim(), lines: labelM[2] ? [labelM[2]] : [] };
    } else if (negM) {
      flush();
      cur = { type: "negative", lines: negM[1] ? [negM[1]] : [] };
    } else if (cur) {
      cur.lines.push(line);
    } else if (line.trim()) {
      cur = { type: "loose", lines: [line] };
    }
  }
  flush();
  return blocks;
}

function emitBlocks(blocks: PromptBlock[]): string {
  return blocks
    .map((b) =>
      b.type === "label" ? `[${b.label}]: ${b.content}` : b.type === "negative" ? `Negative prompt: ${b.content}` : b.content,
    )
    .join("\n\n")
    .trim();
}

/** Join the compiled subject clauses into clean sentence-ish prose for the [Subject] block. */
export function subjectText(compiled: CompiledClauses): string {
  return compiled.subjectClauses
    .map((c) => c.trim().replace(/\.\s*$/, ""))
    .filter(Boolean)
    .join(". ") + ".";
}

/**
 * Rewrite the [Subject] block and Negative line of a raw nb-prompt.md from compiled state,
 * preserving frontmatter and all other blocks. Returns the new file contents.
 */
export function assembleNbPrompt(rawFileContent: string, compiled: CompiledClauses): string {
  const { data, content } = matter(rawFileContent);
  const blocks = parsePromptBlocks(content);

  const subject = subjectText(compiled);
  const subjectIdx = blocks.findIndex((b) => b.type === "label" && /^subject$/i.test(b.label ?? ""));
  if (subjectIdx >= 0) blocks[subjectIdx].content = subject;
  else blocks.unshift({ type: "label", label: "Subject", content: subject });

  const negIdx = blocks.findIndex((b) => b.type === "negative");
  if (compiled.negative) {
    if (negIdx >= 0) blocks[negIdx].content = compiled.negative;
    else blocks.push({ type: "negative", content: compiled.negative });
  }

  return matter.stringify(emitBlocks(blocks), data);
}

/**
 * Non-destructive variant: APPEND only the mandatory clauses that are missing (per `missingKinds`)
 * to the authored [Subject], leaving the author's prose intact. Idempotent — once a clause is
 * injected it's detected as present next run, so nothing is appended again (safe under --watch).
 * Returns the input unchanged when there's nothing to add (avoids frontmatter churn).
 */
export function injectMissingClauses(rawFileContent: string, compiled: CompiledClauses, missingKinds: Set<ClauseKind>): string {
  const additions = compiled.taggedClauses.filter((t) => missingKinds.has(t.kind)).map((t) => t.text);
  const { data, content } = matter(rawFileContent);
  const blocks = parsePromptBlocks(content);
  const needNeg = !blocks.some((b) => b.type === "negative") && !!compiled.negative;
  if (additions.length === 0 && !needNeg) return rawFileContent; // nothing to do — verbatim

  if (additions.length) {
    const subjectIdx = blocks.findIndex((b) => b.type === "label" && /^subject$/i.test(b.label ?? ""));
    const clean = (s: string) => s.trim().replace(/\.\s*$/, "");
    if (subjectIdx >= 0) {
      blocks[subjectIdx].content = [clean(blocks[subjectIdx].content), ...additions.map(clean)].filter(Boolean).join(". ") + ".";
    } else {
      blocks.unshift({ type: "label", label: "Subject", content: additions.map(clean).join(". ") + "." });
    }
  }
  if (needNeg) blocks.push({ type: "negative", content: compiled.negative });
  return matter.stringify(emitBlocks(blocks), data);
}
