// Phase 5 / 9 — fully wrapped YouTube player (D-040 / D-042).
//
// We never let YouTube's own chrome (title, channel, Share, related-video
// cards, the YT logo, the "Watch on YouTube" link) be SEEN or TAPPED.
// `controls=0` only removes the bottom bar — YouTube still paints a clickable
// title bar + related/logo overlay whenever the embed is paused or tapped,
// which leaks the source video (violates D-042) and looks unbranded. So:
//   1) a full-cover touch overlay sits ABOVE the iframe and captures every tap,
//      so no touch ever reaches it — it can't navigate to YouTube and the user
//      can't summon YouTube's tap-to-show chrome. (The WebView itself stays a
//      normal interactive child; wrapping it in `pointerEvents:"none"` stops
//      WKWebView from autoplaying on iOS, so we must NOT do that.)
//   2) we drive play / pause / seek / rate purely through the IFrame JS API +
//      props;
//   3) opaque scrims mask the load poster (until first play) and the paused
//      state (where YouTube would otherwise show its chrome);
//   4) a custom control bar (play/pause + scrubber + time) is rendered by US.
// Autoplay-with-audio rides the WebView's `mediaPlaybackRequiresUserAction:
// false`, so blocking iframe touches does NOT break playback — no DOM gesture
// is needed (this refines the Phase-5 D-173 stance, which kept controls=1 only
// because the native play button was assumed to be the required gesture proxy).
// `live` hides the control bar/scrubber (you don't scrub a live feed). Single
// WebView at a time per the low-end perf rule; `pause` ref stops it on blur.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pause, Play } from "lucide-react-native";
import YoutubePlayer, {
  type YoutubeIframeRef,
} from "react-native-youtube-iframe";
import { Watermark } from "./Watermark";

export interface WrappedYtPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  getCurrentTime: () => Promise<number>;
}

export interface WrappedYtPlayerProps {
  videoId: string;
  watermark: string;
  startSec?: number;
  playbackRate?: number;
  /** Live class: hide our scrubber/seek (you can't scrub a live feed). The
   *  YouTube chrome is blocked regardless of this flag. Default false →
   *  full controls (play/pause + scrubber + time) for recordings + library. */
  live?: boolean;
  /** Fullscreen mode: fill the parent and letterbox-contain the 16:9 video
   *  (used in landscape). Otherwise the player is a full-width 16:9 box. */
  fill?: boolean;
  /** Hide the in-video control bar (the host screen draws its own controls
   *  OUTSIDE the WebView, where touches are guaranteed). Tap-to-toggle + the
   *  paused indicator stay. */
  hideControls?: boolean;
  onProgress?: (sec: number, durationSec: number) => void;
  onDuration?: (durationSec: number) => void;
  /** Frequent (~750ms) position updates for an external scrubber. */
  onPosition?: (sec: number, durationSec: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}

const PROGRESS_INTERVAL_MS = 15_000;
const POSITION_POLL_MS = 750;

// react-native-youtube-iframe@2.4.1 drives play/pause/rate by posting messages
// to the player page (the REMOTE lonelycpp.github.io/iframe_v2.html, since we
// don't use useLocalHTML). That page autoplays and does NOT reliably act on the
// posted `pauseVideo` / `setPlaybackRate` commands — so the video plays but
// won't pause, and the rate prop is ignored. We make our OWN injected handler
// the authoritative command bridge: it listens for the same messages and calls
// the YT player API directly. Runs once on load; `window.player` exists by the
// time any command arrives (the lib gates messages on player-ready). Double-
// handling (if the page also acts) is harmless — the calls are idempotent.
const COMMAND_BRIDGE_JS = `
(function () {
  if (window.__ytCmdBridge) return;
  window.__ytCmdBridge = true;
  window.addEventListener('message', function (e) {
    try {
      var d = JSON.parse(e.data);
      var p = window.player;
      if (!d || !d.eventName || !p) return;
      switch (d.eventName) {
        case 'playVideo': if (p.playVideo) p.playVideo(); break;
        case 'pauseVideo': if (p.pauseVideo) p.pauseVideo(); break;
        case 'setPlaybackRate':
          if (p.setPlaybackRate && d.meta) p.setPlaybackRate(d.meta.playbackRate);
          break;
        case 'muteVideo': if (p.mute) p.mute(); break;
        case 'unMuteVideo': if (p.unMute) p.unMute(); break;
        case 'setVolume': if (p.setVolume && d.meta) p.setVolume(d.meta.volume); break;
      }
    } catch (err) {}
  });
})();
true;
`;

function fmt(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export const WrappedYtPlayer = forwardRef<
  WrappedYtPlayerHandle,
  WrappedYtPlayerProps
>(function WrappedYtPlayer(
  {
    videoId,
    watermark,
    startSec,
    playbackRate,
    live,
    fill,
    hideControls,
    onProgress,
    onDuration,
    onPosition,
    onPlayingChange,
    onEnded,
  },
  ref,
) {
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const [playing, setPlaying] = useState(true);
  const [started, setStarted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubFrac, setScrubFrac] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const [containerH, setContainerH] = useState(0);
  const seededRef = useRef(false);

  useImperativeHandle(ref, () => ({
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    seekTo: (sec: number) => {
      playerRef.current?.seekTo(sec, true);
      setCurrentSec(sec);
    },
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

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

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

  const onChangeState = useCallback(
    (state: string) => {
      if (state === "playing") {
        setPlaying(true);
        setStarted(true);
      } else if (state === "paused") {
        setPlaying(false);
      } else if (state === "ended") {
        setPlaying(false);
        onEnded?.();
      }
    },
    [onEnded],
  );

  // Slow poll: feeds onProgress (library save) while playing.
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

  // Fast poll: drives the scrubber fill + time label, and reports position to an
  // external control bar via onPosition. Refs keep the interval from restarting
  // when the parent passes a fresh callback or the duration updates.
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;
  const durationRef = useRef(durationSec);
  durationRef.current = durationSec;
  useEffect(() => {
    if (live || !started || scrubbing) return;
    const timer = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (typeof t === "number" && !Number.isNaN(t)) {
        setCurrentSec(t);
        onPositionRef.current?.(t, durationRef.current);
      }
    }, POSITION_POLL_MS);
    return () => clearInterval(timer);
  }, [live, started, scrubbing]);

  // Re-issue play (recovers if a platform blocked the initial autoplay).
  const retriggerPlay = useCallback(() => {
    setPlaying(false);
    setTimeout(() => setPlaying(true), 50);
  }, []);

  // Recordings/library: tapping anywhere on the video toggles play/pause (a big,
  // reliable target — the small control-bar button is a backup). The control bar
  // itself stays visible, so the user never has to hunt for it. Live has no
  // play/pause (you don't pause a broadcast), so taps are swallowed.
  const handleSurfaceTap = useCallback(() => {
    if (!started) {
      retriggerPlay();
      return;
    }
    if (live) return;
    setPlaying((p) => !p);
  }, [started, live, retriggerPlay]);

  const fracFromEvent = useCallback(
    (e: GestureResponderEvent) => {
      if (trackW <= 0) return 0;
      return clamp01(e.nativeEvent.locationX / trackW);
    },
    [trackW],
  );

  const onSeekGrant = useCallback(
    (e: GestureResponderEvent) => {
      setScrubbing(true);
      setScrubFrac(fracFromEvent(e));
    },
    [fracFromEvent],
  );
  const onSeekMove = useCallback(
    (e: GestureResponderEvent) => setScrubFrac(fracFromEvent(e)),
    [fracFromEvent],
  );
  const onSeekRelease = useCallback(
    (e: GestureResponderEvent) => {
      const f = fracFromEvent(e);
      const sec = f * durationSec;
      if (durationSec > 0) {
        playerRef.current?.seekTo(sec, true);
        setCurrentSec(sec);
      }
      setScrubbing(false);
    },
    [fracFromEvent, durationSec],
  );

  // Video box. Normal: full-width 16:9. Fill (fullscreen/landscape): the largest
  // 16:9 box that fits the parent (letterbox), centered.
  let videoW = width;
  let videoH = Math.round((width * 9) / 16);
  if (fill && containerH > 0) {
    if (width / containerH > 16 / 9) {
      videoH = containerH;
      videoW = Math.round((containerH * 16) / 9);
    } else {
      videoW = width;
      videoH = Math.round((width * 9) / 16);
    }
  }
  const fillPct =
    (scrubbing ? scrubFrac : durationSec > 0 ? clamp01(currentSec / durationSec) : 0) *
    100;
  const displaySec = scrubbing ? scrubFrac * durationSec : currentSec;
  const showBar = !live && started && !hideControls;

  return (
    <View
      onLayout={(e) => {
        setWidth(Math.round(e.nativeEvent.layout.width));
        setContainerH(Math.round(e.nativeEvent.layout.height));
      }}
      style={
        fill
          ? {
              flex: 1,
              backgroundColor: "#000",
              position: "relative",
              alignItems: "center",
              justifyContent: "center",
            }
          : {
              width: "100%",
              height: videoH,
              backgroundColor: "#000",
              position: "relative",
            }
      }
    >
      {/* iframe — a normal interactive child (so autoplay works); the overlay
          below blocks every tap from reaching it */}
      <YoutubePlayer
        ref={playerRef}
        height={videoH}
        width={videoW}
        play={playing}
        playbackRate={playbackRate ?? 1}
        videoId={videoId}
        onReady={onReady}
        onChangeState={onChangeState}
        initialPlayerParams={{
          controls: false,
          modestbranding: true,
          rel: false,
          preventFullScreen: true,
          iv_load_policy: 3,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          injectedJavaScript: COMMAND_BRIDGE_JS,
        }}
      />

      {/* touch layer — ONLY after playback has started. Before start we leave
          the surface open so the user's tap can reach YouTube's own play button
          (the audio-start gesture; a programmatic play won't unlock audio on
          mobile — D-173). Once playing, this captures every tap so nothing
          reaches the iframe (no chrome, no tap-through to YouTube).
          Uses the gesture-responder system (claims on touch-START) instead of
          Pressable: WKWebView cancels Pressable's onPress mid-gesture, so a
          Pressable here blocks tap-through but never fires — which is why
          tap-to-pause silently did nothing. */}
      {started ? (
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleSurfaceTap}
        />
      ) : null}

      {/* pre-start: mask the title (top) + logo/share/card (bottom); leave the
          centre clear so YouTube's play button is visible + tappable */}
      {!started ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: Math.round(videoH * 0.34),
              backgroundColor: "#000",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" }}>
              Tap the play button to start
            </Text>
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: Math.round(videoH * 0.34),
              backgroundColor: "#000",
            }}
          />
        </>
      ) : null}

      {/* paused mask — hides YouTube's paused chrome; tapping anywhere resumes
          (responder on the mask itself, so it works over the WebView) */}
      {started && !playing ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setPlaying(true)}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: "rgba(255,255,255,0.95)",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Play size={28} color="#0f172a" fill="#0f172a" style={{ marginLeft: 3 }} />
          </View>
        </View>
      ) : null}

      {/* our control bar (recordings + library; never for live) — always on
          while started so play/pause + scrubber are never hidden behind a tap */}
      {showBar ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <View
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => setPlaying((p) => !p)}
            style={{ marginRight: 10, paddingVertical: 4, paddingRight: 6 }}
          >
            {playing ? (
              <Pause size={20} color="#fff" fill="#fff" />
            ) : (
              <Play size={20} color="#fff" fill="#fff" />
            )}
          </View>

          <View
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={onSeekGrant}
            onResponderMove={onSeekMove}
            onResponderRelease={onSeekRelease}
            onResponderTerminate={() => setScrubbing(false)}
            style={{ flex: 1, height: 24, justifyContent: "center", marginRight: 10 }}
          >
            <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" }}>
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: "#3b82f6",
                  width: `${fillPct}%`,
                }}
              />
            </View>
            <View
              style={{
                position: "absolute",
                left: `${fillPct}%`,
                width: 12,
                height: 12,
                borderRadius: 6,
                marginLeft: -6,
                backgroundColor: "#fff",
              }}
            />
          </View>

          <Text style={{ color: "#fff", fontSize: 11 }}>
            {fmt(displaySec)} / {fmt(durationSec)}
          </Text>
        </View>
      ) : null}

      <Watermark text={watermark} />
    </View>
  );
});
