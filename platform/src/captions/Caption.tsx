import { interpolate, useCurrentFrame } from "remotion";
import type { Bubble, SpeakerStyle } from "./types";

const SERIF = `"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,"Times New Roman",serif`;
const GLOSS = "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 60%)";
const SOFT_SHADOW = "0 1px 2px rgba(0,0,0,0.20), 0 8px 22px rgba(0,0,0,0.26)";

// Intertitle / text card. Defaults to a centered lower-third look; position,
// width, colors, font size, radius, alignment and transparency are overridable.
export function Caption({ bubble, style }: { bubble: Bubble; style: SpeakerStyle }) {
  const frame = useCurrentFrame();
  const { text, start, end } = bubble;

  const x = bubble.x ?? 50;
  const y = bubble.y ?? 88;
  const w = bubble.w ?? 70;
  const bg = bubble.bg ?? style.bg;
  const fg = bubble.fg ?? style.fg;
  const fontSize = bubble.fontSize ?? 28;
  const radius = bubble.radius ?? 12;
  const align = bubble.align ?? "center";
  const padX = bubble.padX ?? 26;
  const padY = bubble.padY ?? 13;

  // Entrance fade on the wrapper; user `opacity` dims only the card body.
  const opacity = interpolate(frame, [start, start + 12, end - 10, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgOpacity = bubble.opacity ?? 1;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        width: `${w}%`,
        display: "flex",
        justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end",
        opacity,
      }}
    >
      <div style={{ position: "relative", padding: `${padY}px ${padX}px`, maxWidth: "100%" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `${GLOSS}, ${bg}`,
            borderRadius: radius,
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: `${SOFT_SHADOW}, inset 0 1px 0 rgba(255,255,255,0.22)`,
            opacity: bgOpacity,
          }}
        />
        <span style={{ position: "relative", color: fg, fontFamily: SERIF, fontSize, letterSpacing: 0.4, textAlign: align, whiteSpace: "pre-wrap", display: "block" }}>
          {text}
        </span>
      </div>
    </div>
  );
}
