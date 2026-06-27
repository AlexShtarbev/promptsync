import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Episode } from "../captions/Episode";
import { api, type CaptionDoc, type CaptionBubble, type CaptionSpeaker, type CaptionKind } from "../api/client";

const SPEAKERS: CaptionSpeaker[] = ["pip", "otto", "narration"];
const KINDS: CaptionKind[] = ["emoji", "speech", "thought", "card"];
const TAILS = ["down", "up", "left", "right"] as const;
const ALIGNS = ["center", "left", "right"] as const;
const SHAPES = ["round", "rectangle", "sticker", "burst", "cloud"] as const;
const ANIMS = ["grow", "pop", "shake", "none"] as const;

const STAGE_W = 360;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const blankBubble = (): CaptionBubble => ({
  text: "❤️",
  speaker: "pip",
  kind: "emoji",
  x: 50,
  y: 40,
  tail: "down",
  start: 12,
  end: 68,
});

type DragState = { bi: number; mode: "move" | "resize" } | null;

export function CaptionEditor({ slug }: { slug: string }) {
  const [doc, setDoc] = useState<CaptionDoc | null>(null);
  const [clips, setClips] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selShot, setSelShot] = useState(0);
  const [selBubble, setSelBubble] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "render">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const playerRef = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>(null);

  useEffect(() => {
    setDoc(null);
    setErr(null);
    setSelShot(0);
    setSelBubble(null);
    api
      .getCaptions(slug)
      .then((res) => {
        const { clips: c = [], ...rest } = res;
        setClips(c);
        setDoc(rest);
      })
      .catch((e) => setErr(String(e.message ?? e)));
  }, [slug]);

  const videoBase = `/api/assets/${slug}/shots`;

  // Bubbles are stored by clip code; the timeline order = clips on disk. New
  // clips (e.g. 1K once rendered) appear automatically with no bubbles yet.
  const bubbleByCode = useMemo(() => {
    const m = new Map<string, CaptionBubble[]>();
    doc?.shots.forEach((s) => m.set(s.code, s.bubbles));
    return m;
  }, [doc]);

  const workShots = useMemo(
    () => clips.map((code) => ({ code, bubbles: bubbleByCode.get(code) ?? [] })),
    [clips, bubbleByCode]
  );

  const shotIdx = Math.min(selShot, Math.max(0, workShots.length - 1));
  const shot = workShots[shotIdx];
  const scale = doc ? STAGE_W / doc.width : 0.5;

  const inputProps = useMemo(
    () => (doc ? { shots: workShots, speakerStyle: doc.speakerStyle, clipFrames: doc.clipFrames, videoBase } : null),
    [doc, workShots, videoBase]
  );

  // Edit a clip's bubble list by code, creating the store entry if needed.
  const editCode = useCallback((code: string, fn: (bs: CaptionBubble[]) => CaptionBubble[]) => {
    setDoc((d) => {
      if (!d) return d;
      const shots = [...d.shots];
      const i = shots.findIndex((s) => s.code === code);
      const cur = i >= 0 ? shots[i].bubbles : [];
      const next = fn(cur);
      if (i >= 0) shots[i] = { ...shots[i], bubbles: next };
      else shots.push({ code, bubbles: next });
      return { ...d, shots };
    });
  }, []);

  const patch = (bi: number, p: Partial<CaptionBubble>) =>
    shot && editCode(shot.code, (bs) => bs.map((b, j) => (j === bi ? { ...b, ...p } : b)));
  const addPreset = (p: Partial<CaptionBubble>) =>
    shot && editCode(shot.code, (bs) => [...bs, { ...blankBubble(), ...p }]);
  const addCard = () =>
    shot &&
    editCode(shot.code, (bs) => [
      ...bs,
      { text: "your text here", speaker: "narration", kind: "card", x: 50, y: 88, w: 70, start: 8, end: 68 } as CaptionBubble,
    ]);
  const removeBubble = (bi: number) => shot && editCode(shot.code, (bs) => bs.filter((_, j) => j !== bi));

  // In edit mode, pause + seek to a frame where the selected bubble is visible.
  useEffect(() => {
    if (!doc || !editMode || !shot) return;
    const b = selBubble != null ? shot.bubbles[selBubble] : shot.bubbles[0];
    const local = b ? Math.floor((b.start + Math.min(b.end, doc.clipFrames)) / 2) : Math.floor(doc.clipFrames / 2);
    playerRef.current?.pause();
    playerRef.current?.seekTo(shotIdx * doc.clipFrames + local);
  }, [doc, shotIdx, selBubble, editMode, shot]);

  const down = (e: React.PointerEvent, bi: number, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelBubble(bi);
    drag.current = { bi, mode };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent, bi: number) => {
    if (!drag.current || drag.current.bi !== bi || !stageRef.current || !shot) return;
    const r = stageRef.current.getBoundingClientRect();
    if (drag.current.mode === "move") {
      patch(bi, {
        x: Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)),
        y: Math.round(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)),
      });
    } else {
      const cx = r.left + ((shot.bubbles[bi].x ?? 50) / 100) * r.width;
      patch(bi, { w: Math.round(clamp((Math.abs(e.clientX - cx) * 2) / r.width * 100, 5, 100)) });
    }
  };
  const up = (e: React.PointerEvent, bi: number) => {
    if (drag.current?.bi === bi) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      drag.current = null;
    }
  };

  const save = async () => {
    if (!doc) return;
    setBusy("save");
    setMsg(null);
    try {
      await api.saveCaptions(slug, doc);
      setMsg("Saved captions.json");
    } catch (e: any) {
      setMsg(`Save failed: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const render = async () => {
    if (!doc) return;
    setBusy("render");
    setMsg("Rendering… (runs the Remotion CLI; may take a couple of minutes)");
    try {
      await api.saveCaptions(slug, doc);
      const r = await api.renderCaptions(slug);
      setMsg(r.exists ? `Rendered → ${r.output}` : `Render ok but file missing: ${r.output}`);
    } catch (e: any) {
      setMsg(`Render failed: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>No caption data: {err}</div>;
  if (!doc || !inputProps) return <div style={{ padding: 24 }}>Loading captions…</div>;
  if (workShots.length === 0)
    return <div style={{ padding: 24, color: "#888" }}>No video clips found on disk for this project yet.</div>;

  const totalFrames = workShots.length * doc.clipFrames;
  const stageH = (STAGE_W * doc.height) / doc.width;

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, height: "100%", boxSizing: "border-box" }}>
      {/* preview + drag stage */}
      <div style={{ flex: "0 0 auto" }}>
        <div ref={stageRef} style={{ position: "relative", width: STAGE_W, height: stageH }}>
          <Player
            ref={playerRef}
            component={Episode as any}
            inputProps={inputProps}
            durationInFrames={totalFrames}
            fps={doc.fps}
            compositionWidth={doc.width}
            compositionHeight={doc.height}
            style={{ width: "100%", height: "100%", borderRadius: 8, overflow: "hidden" }}
            controls={!editMode}
            loop
          />
          {editMode && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {shot.bubbles.map((b, bi) => {
                const sel = selBubble === bi;
                if (b.kind === "card") {
                  const wPx = ((b.w ?? 70) / 100) * STAGE_W;
                  const hPx = ((b.fontSize ?? 28) + 2 * (b.padY ?? 12)) * scale + 8;
                  return (
                    <div
                      key={bi}
                      onPointerDown={(e) => down(e, bi, "move")}
                      onPointerMove={(e) => move(e, bi)}
                      onPointerUp={(e) => up(e, bi)}
                      title="Drag to move"
                      style={{
                        position: "absolute",
                        left: `${b.x ?? 50}%`,
                        top: `${b.y ?? 88}%`,
                        transform: "translate(-50%, -50%)",
                        width: wPx,
                        height: hPx,
                        border: `2px dashed ${sel ? "#2c7" : "rgba(255,255,255,0.85)"}`,
                        background: sel ? "rgba(44,204,119,0.15)" : "rgba(0,0,0,0.10)",
                        borderRadius: b.radius ?? 10,
                        pointerEvents: "auto",
                        cursor: "grab",
                        touchAction: "none",
                      }}
                    >
                      {/* width resize grip */}
                      <div
                        onPointerDown={(e) => down(e, bi, "resize")}
                        onPointerMove={(e) => move(e, bi)}
                        onPointerUp={(e) => up(e, bi)}
                        title="Drag to stretch width"
                        style={{
                          position: "absolute",
                          right: -7,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 12,
                          height: 22,
                          background: "#2c7",
                          borderRadius: 3,
                          pointerEvents: "auto",
                          cursor: "ew-resize",
                          touchAction: "none",
                        }}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={bi}
                    onPointerDown={(e) => down(e, bi, "move")}
                    onPointerMove={(e) => move(e, bi)}
                    onPointerUp={(e) => up(e, bi)}
                    title="Drag to position"
                    style={{
                      position: "absolute",
                      left: `${b.x ?? 50}%`,
                      top: `${b.y ?? 50}%`,
                      transform: "translate(-50%, -50%)",
                      width: 46,
                      height: 46,
                      borderRadius: "50%",
                      border: `2px dashed ${sel ? "#2c7" : "rgba(255,255,255,0.85)"}`,
                      background: sel ? "rgba(44,204,119,0.18)" : "rgba(0,0,0,0.12)",
                      pointerEvents: "auto",
                      cursor: "grab",
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                      touchAction: "none",
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            Edit layout
          </label>
          <span style={{ fontSize: 12, color: "#888" }}>
            {editMode ? "drag rings/cards · green grip stretches · paused" : "press play to preview"}
          </span>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={save} disabled={!!busy}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button onClick={render} disabled={!!busy}>
            {busy === "render" ? "Rendering…" : "Render MP4"}
          </button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: "#555", maxWidth: 360 }}>{msg}</div>}
      </div>

      {/* inspector */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {workShots.map((s, i) => (
            <button
              key={s.code}
              onClick={() => {
                setSelShot(i);
                setSelBubble(null);
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: i === shotIdx ? "2px solid #2c7" : "1px solid #ccc",
                background: i === shotIdx ? "#eafff1" : "#fff",
                fontWeight: 600,
              }}
            >
              {s.code}
              {s.bubbles.length > 0 && <span style={{ opacity: 0.6 }}> · {s.bubbles.length}</span>}
            </button>
          ))}
        </div>

        <h3 style={{ margin: "8px 0" }}>
          Shot {shot.code} <span style={{ fontSize: 12, color: "#999", fontWeight: 400 }}>({clips.length} clips stitched)</span>
        </h3>
        {shot.bubbles.length === 0 && <p style={{ color: "#888" }}>No bubbles. (Quiet beat.)</p>}

        {shot.bubbles.map((b, bi) => {
          const isCard = b.kind === "card";
          return (
            <div
              key={bi}
              onPointerDown={() => setSelBubble(bi)}
              style={{ border: `1px solid ${selBubble === bi ? "#2c7" : "#e2e2e2"}`, borderRadius: 8, padding: 10, marginBottom: 10 }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input
                  value={b.text}
                  onChange={(e) => patch(bi, { text: e.target.value })}
                  style={{ fontSize: isCard ? 14 : 22, width: isCard ? 200 : 90, textAlign: isCard ? "left" : "center" }}
                />
                <Sel value={b.speaker} options={SPEAKERS} onChange={(v) => patch(bi, { speaker: v as CaptionSpeaker })} />
                <Sel value={b.kind ?? "speech"} options={KINDS} onChange={(v) => patch(bi, { kind: v as CaptionKind })} />
                {!isCard && <Sel value={b.tail ?? "down"} options={[...TAILS]} onChange={(v) => patch(bi, { tail: v as any })} />}
                {!isCard && <Sel value={b.shape ?? "round"} options={[...SHAPES]} onChange={(v) => patch(bi, { shape: v as any })} />}
                {!isCard && <Sel value={b.anim ?? "grow"} options={[...ANIMS]} onChange={(v) => patch(bi, { anim: v as any })} />}
                <button onClick={() => removeBubble(bi)} style={{ marginLeft: "auto", color: "#c0392b" }}>
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Num label="x %" value={b.x ?? 50} onChange={(v) => patch(bi, { x: v })} />
                <Num label="y %" value={b.y ?? (isCard ? 88 : 50)} onChange={(v) => patch(bi, { y: v })} />
                <Num label="start f" value={b.start} onChange={(v) => patch(bi, { start: v })} />
                <Num label={`end f (≤${doc.clipFrames})`} value={b.end} onChange={(v) => patch(bi, { end: v })} />
              </div>
              {/* style row */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px dashed #eee" }}>
                <Txt label="bg" value={b.bg ?? ""} placeholder="(speaker)" onChange={(v) => patch(bi, { bg: v || undefined })} />
                <Txt label="text color" value={b.fg ?? ""} placeholder="(speaker)" onChange={(v) => patch(bi, { fg: v || undefined })} />
                <Num label="font px" value={b.fontSize ?? (isCard ? 28 : 68)} onChange={(v) => patch(bi, { fontSize: v })} />
                <Range label={`opacity ${(b.opacity ?? 1).toFixed(2)}`} value={b.opacity ?? 1} onChange={(v) => patch(bi, { opacity: v })} />
                {isCard && <Num label="width %" value={b.w ?? 70} onChange={(v) => patch(bi, { w: v })} />}
                {isCard && <Num label="radius" value={b.radius ?? 10} onChange={(v) => patch(bi, { radius: v })} />}
                {isCard && <Sel value={b.align ?? "center"} options={[...ALIGNS]} onChange={(v) => patch(bi, { align: v as any })} />}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => addPreset({ text: "❤️", kind: "emoji", shape: "round" })}>+ Emoji</button>
          <button onClick={() => addPreset({ text: "❗", kind: "emoji", shape: "burst", anim: "shake" })}>+ Burst</button>
          <button onClick={() => addPreset({ text: "…", kind: "speech", shape: "round", tail: "down" })}>+ Speech</button>
          <button onClick={() => addPreset({ text: "…", kind: "speech", shape: "rectangle", tail: "down" })}>+ Caption</button>
          <button onClick={() => addPreset({ text: "…", kind: "thought", shape: "cloud", tail: "up" })}>+ Cloud</button>
          <button onClick={() => addPreset({ text: "✨", kind: "emoji", shape: "sticker" })}>+ Sticker</button>
          <button onClick={addCard}>+ Text card</button>
        </div>
      </div>
    </div>
  );
}

function Sel({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ fontSize: 12, color: "#666", display: "flex", flexDirection: "column", gap: 2 }}>
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 70 }} />
    </label>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ fontSize: 12, color: "#666", display: "flex", flexDirection: "column", gap: 2 }}>
      {label}
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 90 }} />
    </label>
  );
}

function Txt({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ fontSize: 12, color: "#666", display: "flex", flexDirection: "column", gap: 2 }}>
      {label}
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: 96 }} />
    </label>
  );
}
