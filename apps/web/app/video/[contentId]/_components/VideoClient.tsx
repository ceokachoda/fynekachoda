"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";
import { Watermark } from "@/components/player/Watermark";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useContentItem } from "@/features/library/useContentItem";
import { useYtPlayback } from "@/features/library/usePlaybackSign";
import { useVideoProgress } from "@/features/library/useVideoProgress";
import { useSession } from "@/features/auth/SessionProvider";
import { formatWatermark } from "@/lib/watermark";

interface Props {
  contentId: string;
  fullName: string;
}

// "pending"  = waiting for user choice (modal showing) OR for data to load
// "resume"   = mount the player and seek to last position
// "restart"  = mount the player from 0
type ResumeChoice = "pending" | "resume" | "restart";

export function VideoClient({ contentId, fullName }: Props) {
  const { appUser } = useSession();
  const item = useContentItem(contentId);
  const playback = useYtPlayback(contentId);
  const progress = useVideoProgress(contentId);
  const [resumeChoice, setResumeChoice] = useState<ResumeChoice>("pending");

  const watermarkText =
    playback.data?.watermark ??
    formatWatermark(fullName, appUser?.phone ?? null);

  // When data is loaded, decide:
  //   - position <= 10s → auto-restart, no modal
  //   - position >  10s → keep "pending" so the modal shows; user picks
  useEffect(() => {
    if (resumeChoice !== "pending") return;
    if (progress.isLoading || playback.isLoading) return;
    if ((progress.initial?.position_sec ?? 0) <= 10) {
      setResumeChoice("restart");
    }
  }, [progress.isLoading, playback.isLoading, progress.initial, resumeChoice]);

  const showResumeModal =
    resumeChoice === "pending" &&
    !progress.isLoading &&
    !playback.isLoading &&
    (progress.initial?.position_sec ?? 0) > 10;

  const startSeconds =
    resumeChoice === "resume" && progress.initial?.position_sec
      ? Math.max(0, Math.floor(progress.initial.position_sec))
      : undefined;

  const playerReady = resumeChoice !== "pending" && !!playback.data;

  return (
    <div className="flex h-[100dvh] flex-col bg-black text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          href="/library"
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="Back to library"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {item.data?.title ?? "Loading…"}
        </p>
      </div>
      <div className="relative flex-1">
        {item.isLoading || playback.isLoading ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : playback.error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="size-10 text-red-400" />
            <p className="font-semibold">Could not load video</p>
            <p className="max-w-sm text-sm text-white/70">
              {playback.error instanceof Error
                ? playback.error.message
                : "Please try again."}
            </p>
            <Button asChild variant="outline" className="bg-white/10 text-white">
              <Link href="/library">Back to library</Link>
            </Button>
          </div>
        ) : playerReady && playback.data ? (
          <>
            <WrappedYtPlayer
              videoId={playback.data.video_id}
              startSeconds={startSeconds}
              onProgress={(pos, dur) => {
                void progress.update(pos, dur);
              }}
            />
            <Watermark text={watermarkText} />
          </>
        ) : null}
      </div>
      {item.data?.description ? (
        <div className="bg-slate-950 px-4 py-4 text-sm text-slate-300">
          <p className="font-semibold text-white">About this video</p>
          <p className="mt-1 text-xs text-slate-400">{item.data.description}</p>
        </div>
      ) : null}
      {showResumeModal ? (
        <div className="absolute inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-3xl bg-white p-6 text-slate-900 sm:max-w-sm sm:rounded-3xl">
            <p className="text-base font-bold">
              Resume from{" "}
              {Math.floor((progress.initial?.position_sec ?? 0) / 60)}:
              {String(
                Math.floor((progress.initial?.position_sec ?? 0) % 60),
              ).padStart(2, "0")}
              ?
            </p>
            <p className="mt-1 text-sm text-slate-500">
              You watched part of this video before.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setResumeChoice("restart")}
                className="flex-1"
                data-testid="resume-restart"
              >
                Start over
              </Button>
              <Button
                onClick={() => setResumeChoice("resume")}
                className="flex-1"
                data-testid="resume-resume"
              >
                Resume
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
