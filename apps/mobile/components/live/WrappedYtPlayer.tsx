// Phase 9 / web-parity (2026-06) — fully wrapped YouTube player (D-040 / D-042).
//
// The institute pays for this content, so a student must NEVER be able to bounce
// out to youtube.com. We never let YouTube's own chrome (title, channel, Share,
// related-video cards, the YT logo, the "Watch on YouTube" link) be SEEN or
// TAPPED. `controls=0` only removes the bottom bar — YouTube still paints a
// clickable title bar + related/logo overlay whenever the embed is paused or
// tapped, which leaks the source video (violates D-042). So:
//   1) onShouldStartLoadWithRequest HARD-BLOCKS every navigation that isn't the
//      embed host. This is the real guarantee: even if a tap reaches a YouTube
//      link, the WebView refuses to navigate. It also neutralises the iframe
//      lib's OWN iOS behaviour, which otherwise calls Linking.openURL() and
//      kicks the student out into the YouTube app / Safari (a real redirect).
//   2) a full-cover touch overlay sits ABOVE the iframe and captures every tap
//      once playback has started, so no touch reaches YouTube's tap-to-show
//      chrome (the WebView itself stays a normal interactive child; wrapping it
//      in pointerEvents:"none" stops WKWebView autoplay on iOS, so we don't).
//   3) opaque scrims mask the load poster (until first play) and the paused
//      state (where YouTube would otherwise show its chrome);
//   4) our OWN chrome (LIVE pill, mute, fullscreen, play/pause + scrubber) is
//      rendered by US and auto-hides while playing for a clean, pro look.
// Autoplay-with-audio rides the WebView's `mediaPlaybackRequiresUserAction:
// false`; before first play we leave the centre clear so the user's tap can
// reach YouTube's own play button (the iOS audio-unlock gesture — D-173).
// `live` hides the scrubber (you don't scrub a live feed). Single WebView at a
// time per the low-end perf rule; `pause()` ref stops it on blur.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  type GestureResponderEvent,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import type { WebViewProps } from "react-native-webview";
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
  /** Fill the parent and letterbox-contain the 16:9 video (landscape /
   *  side-by-side / immersive). Otherwise the player is a full-width 16:9 box. */
  fill?: boolean;
  /** Hide the in-video control bar (the host screen draws its own controls
   *  OUTSIDE the WebView, where touches are guaranteed). The top chrome
   *  (LIVE pill / mute / fullscreen) + paused indicator stay. */
  hideControls?: boolean;
  /** Reflects the host screen's immersive state (drives the maximise/minimise
   *  icon). When `onToggleFullscreen` is set, a fullscreen button is shown. */
  isFullscreen?: boolean;
  /** Toggle immersive fullscreen (the host screen owns the orientation lock). */
  onToggleFullscreen?: () => void;
  onProgress?: (sec: number, durationSec: number) => void;
  onDuration?: (durationSec: number) => void;
  /** Frequent (~750ms) position updates for an external scrubber. */
  onPosition?: (sec: number, durationSec: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}

const PROGRESS_INTERVAL_MS = 15_000;
const POSITION_POLL_MS = 750;
const CHROME_HIDE_MS = 3200;

// The iframe player page is served from this host. Any document navigation that
// ISN'T this host (about:blank on first iOS load aside) is a bounce off our
// paid content — we refuse it so the student can never land on youtube.com.
const PLAYER_HOST = "https://lonelycpp.github.io/";

// react-native-youtube-iframe@2.4.1 drives play/pause/rate by posting messages
// to the remote player page, which does NOT reliably act on `pauseVideo` /
// `setPlaybackRate` / mute. We make our OWN injected handler the authoritative
// command bridge: it listens for the same messages and calls the YT player API
// directly. Idempotent, so double-handling (if the page also acts) is harmless.
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

type ShouldStartLoad = NonNullable<
  WebViewProps["onShouldStartLoadWithRequest"]
>;

function fmt(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** A round chrome button. Uses the gesture-responder system (claims on
 *  touch-START) instead of Pressable — WKWebView cancels Pressable's onPress
 *  mid-gesture, so a Pressable over the WebView blocks tap-through but never
 *  fires. */
function ChromeButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderRelease={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        marginLeft: 10,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
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
    isFullscreen,
    onToggleFullscreen,
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
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubFrac, setScrubFrac] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const [containerH, setContainerH] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
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

  // ── auto-hiding chrome ────────────────────────────────────────────────────
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current) setChromeVisible(false);
    }, CHROME_HIDE_MS);
  }, []);
  useEffect(() => {
    if (!started) return;
    if (playing) {
      scheduleHide();
    } else {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setChromeVisible(true);
    }
  }, [playing, started, scheduleHide]);
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

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

  // Tapping the surface toggles our chrome (the big, reliable target). Pre-start
  // it re-issues play instead (so the user's tap doubles as the audio gesture).
  // Either way, dismiss the chat keyboard first — a tap on the video means "I'm
  // done typing, let me watch", so the keyboard must get out of the way.
  const handleSurfaceTap = useCallback(() => {
    Keyboard.dismiss();
    if (!started) {
      retriggerPlay();
      return;
    }
    setChromeVisible((v) => {
      const next = !v;
      if (next) scheduleHide();
      return next;
    });
  }, [started, retriggerPlay, scheduleHide]);

  // HARD redirect lock: refuse every document navigation that isn't the embed
  // host. Blocks "Watch on YouTube" / share / channel links AND the iframe
  // lib's own iOS Linking.openURL bounce. The embed sub-frame reports the host
  // as mainDocumentURL, so real playback is unaffected.
  const onShouldStartLoadWithRequest = useCallback<ShouldStartLoad>((req) => {
    const url = req.mainDocumentURL || req.url || "";
    if (!url || url === "about:blank") return true;
    return url.startsWith(PLAYER_HOST);
  }, []);

  const webViewProps = useMemo<WebViewProps>(
    () => ({
      allowsInlineMediaPlayback: true,
      mediaPlaybackRequiresUserAction: false,
      injectedJavaScript: COMMAND_BRIDGE_JS,
      onShouldStartLoadWithRequest,
    }),
    [onShouldStartLoadWithRequest],
  );

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

  // Video box. Normal: full-width 16:9. Fill (landscape/immersive): the largest
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
  const showBar = !live && started && !hideControls && chromeVisible;
  const showTopChrome = started && chromeVisible;

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
        mute={muted}
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
        webViewProps={webViewProps}
      />

      {/* touch layer — ONLY after playback has started. Before start we leave
          the surface open so the user's tap can reach YouTube's own play button
          (the audio-start gesture; D-173). Once playing, this captures every tap
          (toggles our chrome) so nothing reaches the iframe. */}
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
          onResponderRelease={() => {
            Keyboard.dismiss();
            setPlaying(true);
          }}
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

      {/* top chrome — LIVE pill (left) + mute + fullscreen (right). box-none so
          taps on empty space fall through to the surface overlay (toggle). */}
      {showTopChrome ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingTop: 10,
          }}
        >
          {live ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#dc2626",
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "#fff",
                  marginRight: 6,
                }}
              />
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
                LIVE
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <ChromeButton onPress={() => setMuted((m) => !m)}>
            {muted ? (
              <VolumeX size={18} color="#fff" />
            ) : (
              <Volume2 size={18} color="#fff" />
            )}
          </ChromeButton>
          {onToggleFullscreen ? (
            <ChromeButton onPress={onToggleFullscreen}>
              {isFullscreen ? (
                <Minimize size={18} color="#fff" />
              ) : (
                <Maximize size={18} color="#fff" />
              )}
            </ChromeButton>
          ) : null}
        </View>
      ) : null}

      {/* our bottom control bar (recordings + library; never for live) */}
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
