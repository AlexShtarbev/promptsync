import { AbsoluteFill, OffthreadVideo, Series } from "remotion";
import type { EpisodeProps } from "./types";
import { SpeechBubble } from "./SpeechBubble";
import { Caption } from "./Caption";

// The Remotion composition rendered inside <Player>. Stitches each clip and
// overlays its bubbles; bubble start/end frames are LOCAL to each clip.
export function Episode({ shots, speakerStyle, clipFrames, videoBase }: EpisodeProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Series>
        {shots.map((shot) => (
          <Series.Sequence key={shot.code} durationInFrames={clipFrames}>
            <AbsoluteFill>
              <OffthreadVideo
                src={`${videoBase}/${shot.code}/video`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {shot.bubbles.map((b, i) =>
                b.kind === "card" ? (
                  <Caption key={i} bubble={b} style={speakerStyle[b.speaker]} />
                ) : (
                  <SpeechBubble key={i} bubble={b} style={speakerStyle[b.speaker]} />
                )
              )}
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
