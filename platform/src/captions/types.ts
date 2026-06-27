// Shared caption types for the in-dashboard editor + Remotion preview.
// Mirrors the canonical episodes/<ep>/storyboard/captions.json schema.
export type Speaker = "otto" | "pip" | "narration";
export type BubbleKind = "speech" | "thought" | "card" | "emoji";
export type BubbleShape = "round" | "rectangle" | "sticker" | "burst" | "cloud";
export type BubbleAnim = "grow" | "pop" | "shake" | "none";

export interface Bubble {
  text: string;
  speaker: Speaker;
  kind?: BubbleKind;
  x?: number;
  y?: number;
  tail?: "down" | "up" | "left" | "right";
  start: number;
  end: number;
  shape?: BubbleShape; // "round" (default) or "burst" (jagged comic starburst)
  anim?: BubbleAnim; // entrance: "grow" (default, expands from tiny), "pop", "none"
  opacity?: number; // 0..1 overall transparency (default 1)
  // Optional style overrides (mainly for cards, but valid on any bubble).
  w?: number; // box width as % of frame (cards / wrapped text)
  bg?: string; // background override (else speakerStyle)
  fg?: string; // text color override
  fontSize?: number; // px in composition space
  radius?: number; // corner radius px
  align?: "left" | "center" | "right";
  padX?: number;
  padY?: number;
}

export interface CaptionShot {
  code: string;
  bubbles: Bubble[];
}

export interface SpeakerStyle {
  bg: string;
  fg: string;
}

export interface CaptionDoc {
  fps: number;
  clipFrames: number;
  width: number;
  height: number;
  speakerStyle: Record<Speaker, SpeakerStyle>;
  shots: CaptionShot[];
}

// Props handed to the Remotion <Episode> via the Player's inputProps.
export interface EpisodeProps {
  shots: CaptionShot[];
  speakerStyle: Record<Speaker, SpeakerStyle>;
  clipFrames: number;
  /** resolves a shot code -> playable video URL (the platform asset endpoint) */
  videoBase: string;
}
