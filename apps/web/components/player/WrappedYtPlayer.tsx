"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

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
  onProgress?: (positionSec: number, durationSec: number) => void;
}

interface PlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
}

interface ReadyEvent {
  target: PlayerRef;
}

interface StateEvent {
  data: number;
}

export function WrappedYtPlayer({
  videoId,
  startSeconds,
  onProgress,
}: WrappedYtPlayerProps) {
  const playerRef = useRef<PlayerRef | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, []);

  const onReady = (e: ReadyEvent) => {
    playerRef.current = e.target;
    if (startSeconds && startSeconds > 0) {
      try {
        e.target.seekTo(startSeconds, true);
      } catch {
        // ignore
      }
    }
  };

  const onStateChange = (e: StateEvent) => {
    // 1 = playing. Start ticking progress.
    if (e.data === 1) {
      if (tickRef.current) return;
      tickRef.current = setInterval(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
          const pos = p.getCurrentTime();
          const dur = p.getDuration();
          onProgress?.(pos, dur);
        } catch {
          // ignore
        }
      }, 2_000);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
        // Final write on pause/buffer/end.
        const p = playerRef.current;
        if (p) {
          try {
            onProgress?.(p.getCurrentTime(), p.getDuration());
          } catch {
            // ignore
          }
        }
      }
    }
  };

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
}
