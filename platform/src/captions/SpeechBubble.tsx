import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Bubble, SpeakerStyle } from "./types";

// ── shared "classy" styling ─────────────────────────────────────────────
const SERIF = `"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,"Times New Roman",serif`;
const GLOSS = "linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.03) 58%)";
const SOFT_SHADOW = "0 1px 2px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.20), 0 18px 40px rgba(0,0,0,0.20)";
const RIM = "1px solid rgba(255,255,255,0.30)";
const DROP = "drop-shadow(0 2px 4px rgba(0,0,0,0.22)) drop-shadow(0 12px 26px rgba(0,0,0,0.20))";

function starPoints(spikes: number, outer: number, inner: number): string {
  const cx = 50, cy = 50, step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(rot) * r).toFixed(2)},${(cy + Math.sin(rot) * r).toFixed(2)}`);
    rot += step;
  }
  return pts.join(" ");
}
const BURST = starPoints(14, 50, 36);
const CLOUD = [
  { cx: 34, cy: 46, rx: 26, ry: 22 },
  { cx: 58, cy: 30, rx: 30, ry: 26 },
  { cx: 86, cy: 44, rx: 26, ry: 22 },
  { cx: 64, cy: 56, rx: 28, ry: 22 },
  { cx: 44, cy: 58, rx: 22, ry: 18 },
];

export function SpeechBubble({ bubble, style }: { bubble: Bubble; style: SpeakerStyle }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { text, kind = "speech", x = 50, y = 50, tail = "down", start, end, shape = "round", anim = "grow" } = bubble;

  const isThought = kind === "thought";
  const isEmoji = kind === "emoji";

  const appear = spring({ frame: frame - start, fps, config: { damping: shape === "burst" ? 7 : 9, mass: 0.7 } });
  const fadeIn = interpolate(frame, [start, start + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [end - 6, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Entrance fade applies to the whole bubble; the user `opacity` dims only the
  // bubble body (the background layer), leaving the text/emoji fully opaque.
  const opacity = fadeIn * fadeOut;
  const bgOpacity = bubble.opacity ?? 1;
  const scale =
    anim === "none" ? 1 : anim === "grow" ? interpolate(appear, [0, 1], [0.06, 1]) : interpolate(appear, [0, 1], [0.8, 1]);
  const sf = frame - start;
  const rot = anim === "shake" ? Math.sin(sf * 0.9) * Math.max(0, 1 - sf / 16) * 9 : 0;

  const bg = bubble.bg ?? style.bg;
  const fg = bubble.fg ?? style.fg;
  const fontSize = bubble.fontSize ?? (isEmoji ? 68 : 30);
  const fontFamily = isEmoji ? "'Noto Color Emoji', sans-serif" : SERIF;
  const gid = `g_${start}_${Math.round(x)}_${Math.round(y)}`;

  let body;
  if (shape === "burst") {
    body = (
      <div style={{ position: "relative", padding: isEmoji ? "26px 30px" : "30px 34px" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: "-14%", width: "128%", height: "128%", filter: DROP, opacity: bgOpacity }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.32} />
              <stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={BURST} fill={bg} stroke="rgba(255,255,255,0.5)" strokeWidth={1.2} />
          <polygon points={BURST} fill={`url(#${gid})`} />
        </svg>
        <span style={{ position: "relative", color: fg, fontFamily, fontSize, fontWeight: 700, lineHeight: 1, whiteSpace: "pre-wrap" }}>{text}</span>
      </div>
    );
  } else if (shape === "cloud") {
    body = (
      <div style={{ position: "relative", padding: isEmoji ? "30px 40px" : "32px 44px" }}>
        <svg viewBox="0 0 120 80" preserveAspectRatio="none" style={{ position: "absolute", inset: "-26% -12%", width: "124%", height: "152%", filter: DROP, opacity: bgOpacity }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.30} />
              <stop offset="0.6" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <g fill={bg}>{CLOUD.map((c, i) => <ellipse key={i} {...c} />)}</g>
          <g fill={`url(#${gid})`}>{CLOUD.map((c, i) => <ellipse key={i} {...c} />)}</g>
        </svg>
        <span style={{ position: "relative", color: fg, fontFamily, fontSize, lineHeight: 1.1, textAlign: "center", letterSpacing: 0.2, whiteSpace: "pre-wrap" }}>{text}</span>
        <div style={{ opacity: bgOpacity }}><ThoughtDots dir={tail} color={bg} /></div>
      </div>
    );
  } else {
    const radius = shape === "rectangle" ? 10 : isEmoji ? 999 : isThought ? 28 : 24;
    const ring = shape === "sticker" ? "0 0 0 5px #fff, 0 0 0 8px rgba(0,0,0,0.18), " : "";
    const boxShadow = `${ring}${SOFT_SHADOW}, inset 0 1px 0 rgba(255,255,255,0.45)`;
    const showTail = !isThought && shape !== "sticker";
    body = (
      <div style={{ position: "relative", padding: isEmoji ? "10px 18px" : "13px 22px" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `${GLOSS}, ${bg}`,
            borderRadius: radius,
            border: shape === "rectangle" ? `1.5px solid ${fg}` : RIM,
            boxShadow,
            opacity: bgOpacity,
          }}
        >
          {showTail && <Tail dir={tail} size={14} color={bg} />}
        </div>
        <span
          style={{
            position: "relative",
            display: "block",
            color: fg,
            fontFamily,
            fontSize,
            lineHeight: isEmoji ? 1 : 1.25,
            fontWeight: 500,
            letterSpacing: isEmoji ? 0 : 0.2,
            textAlign: "center",
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </span>
        {isThought && <div style={{ opacity: bgOpacity }}><ThoughtDots dir={tail} color={bg} /></div>}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`,
        opacity,
        maxWidth: "62%",
      }}
    >
      {body}
    </div>
  );
}

function Tail({ dir, size, color }: { dir: NonNullable<Bubble["tail"]>; size: number; color: string }) {
  const base: React.CSSProperties = { position: "absolute", width: 0, height: 0, filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.12))" };
  const map: Record<string, React.CSSProperties> = {
    down: { bottom: -size, left: "50%", marginLeft: -size, borderLeft: `${size}px solid transparent`, borderRight: `${size}px solid transparent`, borderTop: `${size}px solid ${color}` },
    up: { top: -size, left: "50%", marginLeft: -size, borderLeft: `${size}px solid transparent`, borderRight: `${size}px solid transparent`, borderBottom: `${size}px solid ${color}` },
    left: { left: -size, top: "50%", marginTop: -size, borderTop: `${size}px solid transparent`, borderBottom: `${size}px solid transparent`, borderRight: `${size}px solid ${color}` },
    right: { right: -size, top: "50%", marginTop: -size, borderTop: `${size}px solid transparent`, borderBottom: `${size}px solid transparent`, borderLeft: `${size}px solid ${color}` },
  };
  return <span style={{ ...base, ...map[dir] }} />;
}

function ThoughtDots({ dir, color }: { dir: NonNullable<Bubble["tail"]>; color: string }) {
  const vertical = dir === "down" || dir === "up";
  const sign = dir === "down" || dir === "right" ? 1 : -1;
  return (
    <>
      {[0, 1].map((i) => {
        const off = 10 + i * 16;
        const d = 12 - i * 4;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              width: d,
              height: d,
              borderRadius: "50%",
              background: color,
              boxShadow: SOFT_SHADOW,
              ...(vertical
                ? { left: "50%", marginLeft: -d / 2, [sign > 0 ? "bottom" : "top"]: -off }
                : { top: "50%", marginTop: -d / 2, [sign > 0 ? "right" : "left"]: -off }),
            }}
          />
        );
      })}
    </>
  );
}
