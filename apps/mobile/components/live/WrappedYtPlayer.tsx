// Phase 5 — wrapped YouTube iframe (D-040 / D-042).
//
// Single WebView at a time per low-end perf rule. The player is mounted only
// while this component is on screen; we expose a `pause` ref so parents can
// stop playback on screen blur. `controls`, `modestbranding`, `rel`,
// `iv_load_policy`, `preventFullScreen` are tuned to suppress as much YT
// chrome as the iframe API allows — but YT's iframe player on mobile
// requires a user tap to physically reach the iframe (it uses that tap as
// the audio-autoplay gesture grant), so wrapping it in an opaque tap-overlay
// is NOT a viable distraction guard: it both breaks autoplay AND eats the
// pause/play tap UX. A small "YouTube" logo + the modestbranding-reduced
// chrome are accepted per Phase 5 spec §D6.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Dimensions, View } from "react-native";
import YoutubePlayer, {
  type YoutubeIframeRef,
} from "react-native-youtube-iframe";
import { Watermark } from "./Watermark";

export interface WrappedYtPlayerHandle {
  pause: () => void;
  seekTo: (sec: number) => void;
  getCurrentTime: () => Promise<number>;
}

export interface WrappedYtPlayerProps {
  videoId: string;
  watermark: string;
  startSec?: number;
  onProgress?: (sec: number, durationSec: number) => void;
  onDuration?: (durationSec: number) => void;
  onEnded?: () => void;
}

const PROGRESS_INTERVAL_MS = 15_000;

export const WrappedYtPlayer = forwardRef<
  WrappedYtPlayerHandle,
  WrappedYtPlayerProps
>(function WrappedYtPlayer(
  { videoId, watermark, startSec, onProgress, onDuration, onEnded },
  ref,
) {
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const [playing, setPlaying] = useState(true);
  const [durationSec, setDurationSec] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const seededRef = useRef(false);

  useImperativeHandle(ref, () => ({
    pause: () => setPlaying(false),
    seekTo: (sec: number) => playerRef.current?.seekTo(sec, true),
    getCurrentTime: async () => {
      const t = await playerRef.current?.getCurrentTime();
      return typeof t === "number" ? t : 0;
    },
  }), []);

  useEffect(() => {
    return () => {
      setPlaying(false);
    };
  }, []);

  const onReady = useCallback(async () => {
    const d = await playerRef.current?.getDuration();
    if (typeof d === "number" && d > 0) {
      setDurationSec(d);
      onDuration?.(d);
    }
    if (!seededRef.current && startSec && startSec > 5) {
      seededRef.current = true;
      playerRef.current?.seekTo(startSec, true);
    }
  }, [onDuration, startSec]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (typeof t === "number" && durationSec > 0) {
        onProgress?.(t, durationSec);
      }
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, durationSec, onProgress]);

  const onChangeState = useCallback(
    (state: string) => {
      if (state === "ended") {
        setPlaying(false);
        onEnded?.();
      }
    },
    [onEnded],
  );

  const height = Math.round((width * 9) / 16);

  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{
        width: "100%",
        height,
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      <YoutubePlayer
        ref={playerRef}
        height={height}
        width={width}
        play={playing}
        videoId={videoId}
        onReady={onReady}
        onChangeState={onChangeState}
        initialPlayerParams={{
          controls: true,
          modestbranding: true,
          rel: false,
          preventFullScreen: true,
          iv_load_policy: 3,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
      <Watermark text={watermark} />
    </View>
  );
});
