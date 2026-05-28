"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

// react-youtube ships a `window`-only IFrame API wrapper. Dynamic-import with
// ssr:false so Next 15 doesn't try to render it on the server.
const YouTube = dynamic(() => import("react-youtube"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-900 text-slate-500">
      Loading player…
    </div>
  ),
});

// D-173: NEVER set controls=0. The visible play button is the autoplay gesture
// proxy. We DO disable related videos, branding, fullscreen-button, and the
// channel link to keep the surface tight.
const PLAYER_OPTS = {
  width: "100%",
  height: "100%",
  playerVars: {
    autoplay: 0,
    rel: 0,
    modestbranding: 1,
    iv_load_policy: 3,
    fs: 1,
  },
};

interface WrappedYtPlayerProps {
  videoId: string;
  startSeconds?: number;
  /** Lesson-style progress tick (every 2s while playing). */
  onProgress?: (positionSec: number, durationSec: number) => void;
  /** Recording-only: 1 / 1.5 / 2 — applied via setPlaybackRate. */
  playbackRate?: number;
  /** Recording-only: live play/pause state for the parent to toggle a custom button. */
  onPlayingChange?: (playing: boolean) => void;
  /** Recording-only: total duration once known. */
  onDuration?: (durationSec: number) => void;
  /** Recording-only: high-frequency position tick (every ~1s) for chat-replay sync. */
  onPosition?: (positionSec: number, durationSec: number) => void;
}

export interface WrappedYtPlayerHandle {
  play(): void;
  pause(): void;
  seekTo(sec: number): void;
}

interface PlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setPlaybackRate: (rate: number) => void;
}

interface ReadyEvent {
  target: PlayerRef;
}

interface StateEvent {
  data: number;
}

export const WrappedYtPlayer = forwardRef<
  WrappedYtPlayerHandle,
  WrappedYtPlayerProps
>(function WrappedYtPlayer(
  {
    videoId,
    startSeconds,
    onProgress,
    playbackRate,
    onPlayingChange,
    onDuration,
    onPosition,
  },
  ref,
) {
  const playerRef = useRef<PlayerRef | null>(null);
  // Lesson-style progress tick (2s).
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Recording-style high-frequency position tick (1s) for chat replay sync.
  const posTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      if (posTickRef.current) clearInterval(posTickRef.current);
      posTickRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        try {
          playerRef.current?.playVideo();
        } catch {
          // ignore
        }
      },
      pause: () => {
        try {
          playerRef.current?.pauseVideo();
        } catch {
          // ignore
        }
      },
      seekTo: (sec: number) => {
        try {
          playerRef.current?.seekTo(sec, true);
        } catch {
          // ignore
        }
      },
    }),
    [],
  );

  // Apply playbackRate whenever it changes (also after onReady re-mounts).
  useEffect(() => {
    if (!playbackRate) return;
    try {
      playerRef.current?.setPlaybackRate(playbackRate);
    } catch {
      // ignore
    }
  }, [playbackRate]);

  const onReady = useCallback(
    (e: ReadyEvent) => {
      playerRef.current = e.target;
      if (startSeconds && startSeconds > 0) {
        try {
          e.target.seekTo(startSeconds, true);
        } catch {
          // ignore
        }
      }
      if (playbackRate) {
        try {
          e.target.setPlaybackRate(playbackRate);
        } catch {
          // ignore
        }
      }
      if (onDuration) {
        try {
          const d = e.target.getDuration();
          if (d > 0) onDuration(d);
        } catch {
          // ignore
        }
      }
    },
    [startSeconds, playbackRate, onDuration],
  );

  const onStateChange = useCallback(
    (e: StateEvent) => {
      // 1 = playing, 2 = paused, 0 = ended, 3 = buffering, 5 = cued.
      const playing = e.data === 1;
      onPlayingChange?.(playing);

      if (playing) {
        if (!tickRef.current && onProgress) {
          tickRef.current = setInterval(() => {
            const p = playerRef.current;
            if (!p) return;
            try {
              onProgress(p.getCurrentTime(), p.getDuration());
            } catch {
              // ignore
            }
          }, 2_000);
        }
        if (!posTickRef.current && onPosition) {
          posTickRef.current = setInterval(() => {
            const p = playerRef.current;
            if (!p) return;
            try {
              onPosition(p.getCurrentTime(), p.getDuration());
            } catch {
              // ignore
            }
          }, 1_000);
        }
      } else {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
          const p = playerRef.current;
          if (p && onProgress) {
            try {
              onProgress(p.getCurrentTime(), p.getDuration());
            } catch {
              // ignore
            }
          }
        }
        if (posTickRef.current) {
          clearInterval(posTickRef.current);
          posTickRef.current = null;
          const p = playerRef.current;
          if (p && onPosition) {
            try {
              onPosition(p.getCurrentTime(), p.getDuration());
            } catch {
              // ignore
            }
          }
        }
      }
    },
    [onPlayingChange, onProgress, onPosition],
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <YouTube
        videoId={videoId}
        opts={PLAYER_OPTS}
        onReady={onReady}
        onStateChange={onStateChange}
        className="absolute inset-0 size-full"
        iframeClassName="size-full"
      />
    </div>
  );
});
