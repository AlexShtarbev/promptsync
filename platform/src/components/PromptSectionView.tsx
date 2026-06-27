import { useCallback } from "react";
import type { PromptBlock } from "../api/client";

interface Props {
  prompt: PromptBlock;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCopyFull: (...args: any[]) => void;
}

const SECTION_ORDER = [
  "task",
  "scene_mood", "scene_&_mood",
  "frame_map",
  "subject", "subject_lock",
  "action",
  "world_plate",
  "context", "environment",
  "movement", "camera", "cinematography",
  "last_frame",
  "sound_bed", "audio",
  "camera_capture",
  "optical_realism",
  "skin_surface", "skin_&_surface",
  "visual_style", "style_ambiance", "style_&_ambiance",
  "lighting", "lighting_style",
  "technical",
  "quality_guards",
  "motion_scale_line", "aspect_ratio_line",
  "negative_prompt",
  "end_state",
  "fallback",
  "watch_for",
];

function sectionIndex(key: string): number {
  const idx = SECTION_ORDER.indexOf(key);
  return idx === -1 ? SECTION_ORDER.length : idx;
}

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMood\b/, "Mood")
    .replace(/\bMap\b/, "Map");
}

export function PromptSectionView({ prompt, label, onCopyFull }: Props) {
  const sections = prompt.sections;
  const keys = sections ? Object.keys(sections).filter((k) => sections[k]?.trim()) : [];

  const copySection = useCallback((key: string) => {
    if (!sections?.[key]) return;
    navigator.clipboard.writeText(sections[key]).then(
      () => console.log(`Copied ${key}`),
      (err) => console.error(`Failed to copy ${key}:`, err)
    );
  }, [sections]);

  if (!keys.length || keys.length < 2) {
    return (
      <div className="prompt-block">
        <div className="prompt-label">
          {label}
          <button onClick={onCopyFull}>Copy</button>
        </div>
        <pre>{prompt.body}</pre>
      </div>
    );
  }

  const sorted = [...keys].sort((a, b) => sectionIndex(a) - sectionIndex(b));

  return (
    <div className="prompt-block">
      <div className="prompt-label">
        {label}
        <button onClick={onCopyFull}>Copy All</button>
      </div>
      <div className="prompt-sections">
        {sorted.map((key) => (
          <div key={key} className="prompt-section">
            <div className="prompt-section-label">
              <span>{humanize(key)}</span>
              <button onClick={() => copySection(key)}>Copy</button>
            </div>
            <pre className="prompt-section-body">{sections![key]}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
