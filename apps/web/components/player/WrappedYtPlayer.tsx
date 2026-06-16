"use client";

// Secure, self-contained YouTube surface for FyneStudy live + recordings +
// lessons. The institute pays for this content, so a student must NEVER be able
// to bounce out to youtube.com. Three layers enforce that:
//
//   1. Player vars strip every native route to YouTube:
//        controls:0       → no native control bar (YouTube logo + "Watch on
//                           YouTube" + share live there). modestbranding is
//                           deprecated since 2023-08-15, so it can't be relied
//                           on alone — controls:0 is what actually removes it.
//        fs:0             → no native fullscreen button; we own fullscreen.
//        rel:0            → no cross-channel "related" grid at the end.
//        iv_load_policy:3 → no annotation/cards.
//        disablekb:1      → no keyboard shortcuts.
//        playsinline:1    → iOS plays inline so our overlay can sit on top,
//                           instead of handing off to the native fullscreen
//                           player (which shows a YouTube button + an exit).
//   2. A transparent SHIELD over the iframe eats every pointer event, so any
//      residual hover/pause title chrome inside the iframe is unclickable and
//      the right-click "Copy video URL" menu never opens. touch-action:none on
//      the shield also blocks pinch / double-tap zoom on the video.
//   3. A SCRIM (our own play button) covers the video while paused, hiding the
//      YouTube pause overlay (title + channel + "Watch on YouTube") visually.
//
// On top of that we render our own controls (play/pause, seek, mute,
// fullscreen) + a moving watermark, and own fullscreen + landscape-lock for a
// Netflix-style phone experience (real Fullscreen API on Android/desktop, a CSS
// "pseudo-fullscreen" fallback on iOS Safari which can't fullscreen a <div>).

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  FastForward,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Rewind,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Watermark } from "@/components/player/Watermark";
import { cn } from "@/lib/utils";

const YouTube = dynamic(() => import("react-youtube"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-black text-slate-500">
      <Loader2 className="size-6 animate-spin" aria-hidden />
    </div>
  ),
});

const PLAYER_OPTS = {
  width: "100%",
  height: "100%",
  playerVars: {
    autoplay: 0,
    controls: 0,
    rel: 0,
    modestbranding: 1,
    iv_load_policy: 3,
    fs: 0,
    disablekb: 1,
    playsinline: 1,
  },
};

const SKIP_SECONDS = 10;
const CHROME_HIDE_MS = 3200;
const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

interface WrappedYtPlayerProps {
  videoId: string;
  /** Rendered as a moving anti-piracy watermark on top of the video. */
  watermarkText?: string;
  /** Top-left overlay slot (e.g. a teacher's "Open Live Control" link). */
  topLeft?: ReactNode;
  /** Live mode: no scrubber, a LIVE pill instead of a timeline. */
  live?: boolean;
  /** Show the seek timeline + skip buttons (recordings & lessons). */
  seekable?: boolean;
  startSeconds?: number;
  playbackRate?: number;
  /** Lesson-style progress tick (~2s while playing) for resume points. */
  onProgress?: (positionSec: number, durationSec: number) => void;
  /** High-frequency position tick (~0.5s) for chat-replay sync. */
  onPosition?: (positionSec: number, durationSec: number) => void;
  /** Override container classes (e.g. `rounded-none` for full-bleed). */
  className?: string;
}

interface PlayerApi {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setPlaybackRate: (rate: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
}
interface ReadyEvent {
  target: PlayerApi;
}
interface StateEvent {
  data: number;
  target: PlayerApi;
}

// Vendor-prefixed fullscreen + the still-experimental orientation lock aren't
// in lib.dom — narrow to just the members we touch instead of using `any`.
type FsEl = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

function fmt(sec: number): string {
  const t = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const s = t % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export function WrappedYtPlayer({
  videoId,
  watermarkText,
  topLeft,
  live = false,
  seekable = !live,
  startSeconds,
  playbackRate,
  onProgress,
  onPosition,
  className,
}: WrappedYtPlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerApi | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  // First playback happened — before that the iframe shows YouTube's title
  // poster, which the veil below must keep fully covered.
  const [startedOnce, setStartedOnce] = useState(false);

  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const seekingRef = useRef(false);

  const [isFs, setIsFs] = useState(false); // real Fullscreen API active
  const [pseudoFs, setPseudoFs] = useState(false); // iOS CSS fallback active
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rate, setRate] = useState<number>(playbackRate ?? 1);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  // Mirror `playing` into a ref so the auto-hide timer reads the latest value
  // without re-creating the timer each render.
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // Latest callbacks in refs so the playback intervals never re-subscribe.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  // ── playback ticker — drives our scrubber + chat-replay sync ──────────────
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const c = p.getCurrentTime();
        const d = p.getDuration();
        if (!seekingRef.current) setPos(c);
        if (d > 0) setDur(d);
        onPositionRef.current?.(c, d);
      } catch {
        /* player torn down mid-tick */
      }
    }, 500);
    return () => clearInterval(id);
  }, [playing]);

  // ── lesson progress tick (slower; only when a consumer wants it) ──────────
  useEffect(() => {
    if (!playing || !onProgress) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        onProgressRef.current?.(p.getCurrentTime(), p.getDuration());
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [playing, onProgress]);

  const flush = useCallback((p: PlayerApi) => {
    try {
      const c = p.getCurrentTime();
      const d = p.getDuration();
      if (!seekingRef.current) setPos(c);
      onProgressRef.current?.(c, d);
      onPositionRef.current?.(c, d);
    } catch {
      /* ignore */
    }
  }, []);

  const onReady = useCallback(
    (e: ReadyEvent) => {
      playerRef.current = e.target;
      setReady(true);
      try {
        if (startSeconds && startSeconds > 0) e.target.seekTo(startSeconds, true);
      } catch {
        /* ignore */
      }
      try {
        if (rateRef.current !== 1) e.target.setPlaybackRate(rateRef.current);
      } catch {
        /* ignore */
      }
      try {
        const d = e.target.getDuration();
        if (d > 0) setDur(d);
      } catch {
        /* ignore */
      }
      try {
        setMuted(e.target.isMuted());
      } catch {
        /* ignore */
      }
    },
    [startSeconds],
  );

  const onStateChange = useCallback(
    (e: StateEvent) => {
      // -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued
      const d = e.data;
      setBuffering(d === 3);
      if (d === 1) {
        setPlaying(true);
        setEnded(false);
        setStartedOnce(true);
      } else if (d === 0) {
        setPlaying(false);
        setEnded(true);
        flush(e.target);
      } else if (d === 2) {
        setPlaying(false);
        flush(e.target);
      }
    },
    [flush],
  );

  // Apply speed whenever it changes (also re-applied on ready).
  useEffect(() => {
    if (!ready) return;
    try {
      playerRef.current?.setPlaybackRate(rate);
    } catch {
      /* ignore */
    }
  }, [rate, ready]);

  // Consumers that still drive speed from outside stay in control.
  useEffect(() => {
    if (playbackRate) setRate(playbackRate);
  }, [playbackRate]);

  // ── transport ─────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (playing) {
        p.pauseVideo();
      } else {
        if (ended && seekable) p.seekTo(0, true);
        p.playVideo();
      }
    } catch {
      /* ignore */
    }
  }, [playing, ended, seekable]);

  const seek = useCallback((sec: number) => {
    const target = Math.max(0, sec);
    try {
      playerRef.current?.seekTo(target, true);
    } catch {
      /* ignore */
    }
    setPos(target);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const p = playerRef.current;
      const base = p ? safeTime(p) : pos;
      seek(base + delta);
    },
    [pos, seek],
  );

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.isMuted()) {
        p.unMute();
        setMuted(false);
      } else {
        p.mute();
        setMuted(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── fullscreen + landscape lock ───────────────────────────────────────────
  const realFsElement = useCallback(() => {
    const d = document as FsDoc;
    return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
  }, []);

  const enterFs = useCallback(async () => {
    const el = rootRef.current as FsEl | null;
    if (!el) return;
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall through to pseudo-fullscreen */
      }
    } else if (el.webkitRequestFullscreen) {
      try {
        await el.webkitRequestFullscreen();
        return;
      } catch {
        /* fall through */
      }
    }
    setPseudoFs(true); // iOS Safari / API rejected → CSS fallback
  }, []);

  const exitFs = useCallback(async () => {
    const d = document as FsDoc;
    if (realFsElement()) {
      try {
        if (d.exitFullscreen) await d.exitFullscreen();
        else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
      } catch {
        /* ignore */
      }
    }
    setPseudoFs(false);
  }, [realFsElement]);

  const fullscreenActive = isFs || pseudoFs;

  const toggleFs = useCallback(() => {
    if (fullscreenActive) void exitFs();
    else void enterFs();
  }, [fullscreenActive, enterFs, exitFs]);

  // Real Fullscreen API: track state + lock orientation to landscape on phones.
  useEffect(() => {
    const onChange = () => {
      const active = realFsElement() === rootRef.current;
      setIsFs(active);
      const orientation = (
        typeof screen !== "undefined" ? screen.orientation : undefined
      ) as LockableOrientation | undefined;
      if (active) {
        void orientation?.lock?.("landscape").catch(() => {});
      } else {
        try {
          orientation?.unlock?.();
        } catch {
          /* unsupported — fine */
        }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [realFsElement]);

  // iOS pseudo-fullscreen: lock body scroll + best-effort landscape lock.
  useEffect(() => {
    if (!pseudoFs || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const orientation = (
      typeof screen !== "undefined" ? screen.orientation : undefined
    ) as LockableOrientation | undefined;
    void orientation?.lock?.("landscape").catch(() => {});
    return () => {
      document.body.style.overflow = prev;
      try {
        orientation?.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, [pseudoFs]);

  // ── auto-hiding chrome ────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current) setChromeVisible(false);
    }, CHROME_HIDE_MS);
  }, []);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const onSurfaceTap = useCallback(() => {
    setChromeVisible((v) => !v);
    scheduleHide();
  }, [scheduleHide]);

  // Paused → controls always visible; playing → start the hide countdown.
  useEffect(() => {
    if (!playing) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setChromeVisible(true);
    } else {
      scheduleHide();
    }
  }, [playing, scheduleHide]);

  // The speed menu lives inside the chrome — never leave it orphaned.
  useEffect(() => {
    if (!chromeVisible) setRateMenuOpen(false);
  }, [chromeVisible]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const showCenter = !ready || buffering || !playing || chromeVisible;
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div
      ref={rootRef}
      data-testid="video-player"
      // Hover-reveal is a mouse affordance only. On touch, taps synthesize a
      // trailing mousemove AFTER the click that toggles the chrome — letting it
      // call revealChrome would make the chrome impossible to dismiss by tap.
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") revealChrome();
      }}
      className={cn(
        "relative w-full select-none overflow-hidden bg-black",
        fullscreenActive
          ? "fixed inset-0 z-[9999] flex items-center justify-center"
          : "aspect-video rounded-2xl shadow-sm ring-1 ring-black/5",
        !chromeVisible && playing && "cursor-none",
        className,
      )}
    >
      {/* The video box. In fullscreen it's letterboxed to 16:9 inside the
          black backdrop; otherwise it fills the aspect-ratio container. */}
      <div
        className={cn(
          "relative",
          fullscreenActive
            ? "aspect-video w-full max-h-full max-w-[calc(100vh*16/9)]"
            : "absolute inset-0",
        )}
      >
        <YouTube
          videoId={videoId}
          opts={PLAYER_OPTS}
          onReady={onReady}
          onStateChange={onStateChange}
          className="absolute inset-0 size-full"
          iframeClassName="size-full"
        />

        {/* VEIL — hides YouTube's own chrome whenever the iframe would paint
            it: fully opaque before first play and after the video ends (title
            poster / related-videos grid), dimmed + blurred while paused (title
            bar + "Watch on YouTube"). Sits under the shield so taps still work. */}
        {!startedOnce || ended ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] bg-black"
          />
        ) : ready && !playing ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] bg-black/60 backdrop-blur-md"
          />
        ) : null}

        {/* SHIELD — blocks every pointer event from reaching the iframe (no
            click-through to YouTube, no context menu) and kills pinch/double-tap
            zoom on the video. Tapping it toggles the controls overlay. */}
        <button
          type="button"
          aria-label="Toggle player controls"
          tabIndex={-1}
          onClick={onSurfaceTap}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 z-10 size-full cursor-pointer outline-none"
          style={{ touchAction: "none" }}
        />

        {watermarkText ? <Watermark text={watermarkText} /> : null}

        {/* Center play / buffering affordance (covers the YouTube pause UI). */}
        {showCenter ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            {!ready || buffering ? (
              <Loader2 className="size-12 animate-spin text-white/90" aria-hidden />
            ) : (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : ended ? "Replay" : "Play"}
                className="pointer-events-auto flex size-16 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                {playing ? (
                  <Pause className="size-7" />
                ) : ended ? (
                  <RotateCcw className="size-7" />
                ) : (
                  <Play className="size-7 translate-x-0.5" />
                )}
              </button>
            )}
          </div>
        ) : null}

        {topLeft ? (
          <div
            className={cn(
              "absolute left-2 top-2 z-30 transition-opacity duration-200",
              chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {topLeft}
          </div>
        ) : null}

        {/* Bottom control bar. In fullscreen the player root is `fixed inset-0`
            at the real device edges, so we add the safe-area insets there to
            keep every control above the iOS home indicator / Android gesture bar
            and clear of a landscape notch (env() is device-global, so we must
            NOT add it to an inline card that sits mid-page). */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-200",
            chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={
            fullscreenActive
              ? {
                  paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
                  paddingRight: "max(0.75rem, env(safe-area-inset-right))",
                  paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))",
                }
              : undefined
          }
        >
          {seekable ? (
            <input
              type="range"
              min={0}
              max={Math.max(dur, 1)}
              step={0.1}
              value={Math.min(pos, dur || pos)}
              aria-label="Seek"
              aria-valuetext={`${fmt(pos)} of ${fmt(dur)}`}
              onPointerDown={() => {
                seekingRef.current = true;
              }}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPos(v);
                if (!seekingRef.current) seek(v); // keyboard / track click
              }}
              onPointerUp={(e) => {
                seekingRef.current = false;
                seek(Number((e.target as HTMLInputElement).value));
                revealChrome();
              }}
              className="h-1.5 w-full cursor-pointer accent-white"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.95) ${pct}%, rgba(255,255,255,0.28) ${pct}%)`,
                borderRadius: 9999,
              }}
            />
          ) : null}

          <div className="flex items-center gap-1.5 text-white">
            <ControlButton
              onClick={togglePlay}
              label={playing ? "Pause" : ended ? "Replay" : "Play"}
            >
              {playing ? (
                <Pause className="size-5" />
              ) : ended ? (
                <RotateCcw className="size-5" />
              ) : (
                <Play className="size-5" />
              )}
            </ControlButton>

            {seekable ? (
              <>
                <ControlButton
                  onClick={() => skip(-SKIP_SECONDS)}
                  label="Rewind 10 seconds"
                >
                  <Rewind className="size-5" />
                </ControlButton>
                <ControlButton
                  onClick={() => skip(SKIP_SECONDS)}
                  label="Forward 10 seconds"
                >
                  <FastForward className="size-5" />
                </ControlButton>
              </>
            ) : null}

            {seekable ? (
              <span className="ml-1 select-none text-xs font-medium tabular-nums text-white/90">
                {fmt(pos)} / {fmt(dur)}
              </span>
            ) : (
              <span className="ml-1 inline-flex select-none items-center rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
            )}

            <div className="flex-1" />

            {seekable ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setRateMenuOpen((o) => !o);
                    revealChrome();
                  }}
                  aria-label="Playback speed"
                  aria-haspopup="menu"
                  aria-expanded={rateMenuOpen}
                  className="flex h-9 items-center gap-1 rounded-lg px-2 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <Gauge className="size-5" />
                  <span className="text-xs font-bold tabular-nums">
                    {rate}×
                  </span>
                </button>
                {rateMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Playback speed"
                    className="absolute bottom-11 right-0 z-40 min-w-[104px] overflow-hidden rounded-xl bg-black/90 p-1 ring-1 ring-white/15 backdrop-blur-sm"
                  >
                    {RATES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="menuitemradio"
                        aria-checked={rate === r}
                        onClick={() => {
                          setRate(r);
                          setRateMenuOpen(false);
                          revealChrome();
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white transition-colors hover:bg-white/15",
                          rate === r && "bg-white/10",
                        )}
                      >
                        <span className="tabular-nums">{r}×</span>
                        {rate === r ? <Check className="size-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <ControlButton
              onClick={toggleMute}
              label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </ControlButton>
            <ControlButton
              onClick={toggleFs}
              label={fullscreenActive ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreenActive ? (
                <Minimize className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  // 44px on touch devices (phones/tablets — reachable in any orientation),
  // 36px for a fine pointer (mouse) so the desktop bar stays compact.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 pointer-coarse:size-11"
    >
      {children}
    </button>
  );
}

function safeTime(p: PlayerApi): number {
  try {
    return p.getCurrentTime();
  } catch {
    return 0;
  }
}
