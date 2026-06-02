"use client";

// Live video surface: the wrapped YouTube player + watermark + a custom
// fullscreen control. Shared by the student live view and the teacher live
// control so both get one fullscreen + landscape-lock implementation.
//
// Fullscreen strategy:
//   - Custom button requests fullscreen on THIS container — works on desktop +
//     Android Chrome, where we can style/contain the 16:9 video ourselves.
//   - WrappedYtPlayer keeps the native YT fullscreen button (fs:1) so iOS
//     Safari (which can't fullscreen an arbitrary <div>) still has a path.
//   - On entering fullscreen we best-effort lock the screen to landscape; this
//     fires for BOTH our button and the native YT button (the fullscreenchange
//     listener is element-agnostic). Desktop/iOS reject the lock → ignored.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";
import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";
import { Watermark } from "@/components/player/Watermark";
import { cn } from "@/lib/utils";

// Vendor-prefixed fullscreen APIs + the still-experimental orientation lock
// aren't in the DOM lib types; narrow to just the members we touch instead of
// reaching for `any`.
type FullscreenEl = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

interface LiveVideoStageProps {
  videoId: string;
  watermarkText: string;
  /** Optional overlay slot rendered in the top-left (e.g. a teacher quick link). */
  topLeft?: ReactNode;
  className?: string;
}

export function LiveVideoStage({
  videoId,
  watermarkText,
  topLeft,
  className,
}: LiveVideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const [canFs, setCanFs] = useState(false);

  useEffect(() => {
    const el = stageRef.current as FullscreenEl | null;
    setCanFs(
      typeof document !== "undefined" &&
        (document.fullscreenEnabled || !!el?.webkitRequestFullscreen),
    );
  }, []);

  useEffect(() => {
    const doc = document as FullscreenDoc;
    const orientation = screen.orientation as LockableOrientation | undefined;
    const onChange = () => {
      const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFs(fsEl === stageRef.current);
      if (fsEl) {
        void orientation?.lock?.("landscape").catch(() => {});
      } else {
        try {
          orientation?.unlock?.();
        } catch {
          /* orientation lock unsupported — fine */
        }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggle = useCallback(async () => {
    const el = stageRef.current as FullscreenEl | null;
    const doc = document as FullscreenDoc;
    if (!el) return;
    const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    try {
      if (fsEl !== el) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } else if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      /* gesture/permission denied — leave state as-is */
    }
  }, []);

  return (
    <div
      ref={stageRef}
      data-testid="live-video-stage"
      className={cn(
        "relative w-full overflow-hidden bg-black",
        isFs
          ? "flex h-full items-center justify-center"
          : "rounded-2xl shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      <div className={cn("relative w-full", isFs && "max-w-[calc(100svh*16/9)]")}>
        <WrappedYtPlayer videoId={videoId} />
        <Watermark text={watermarkText} />
      </div>
      {topLeft ? <div className="absolute left-2 top-2 z-30">{topLeft}</div> : null}
      {canFs ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
          className="absolute right-2 top-2 z-30 flex size-9 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {isFs ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
      ) : null}
    </div>
  );
}
