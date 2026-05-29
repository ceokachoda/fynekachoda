"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { useLiveSession } from "@/features/live/useLiveSession";
import { useLivePlaybackSign } from "@/features/live/useLivePlaybackSign";
import { useSessionState } from "@/features/live/useSessionState";
import { useRaiseHand } from "@/features/live/useRaiseHand";
import { useChatChannel } from "@/features/chat/useChatChannel";
import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";
import { Watermark } from "@/components/player/Watermark";
import { LobbyCountdown } from "@/components/live/LobbyCountdown";
import { ChatPane } from "@/components/live/ChatPane";
import { ChatComposer } from "@/components/live/ChatComposer";
import { RaiseHandButton } from "@/components/live/RaiseHandButton";
import { PinnedBanner } from "@/components/live/PinnedBanner";
import type { ActiveRole } from "@/lib/auth";
import { formatWatermark } from "@/lib/watermark";

interface LiveClientProps {
  sessionId: string;
  fullName: string;
  activeRole: ActiveRole;
}

export function LiveClient(props: LiveClientProps) {
  // Top-level route is outside (protected), so wrap our own providers — mirror
  // of QuizClient / ExamClient (W-DEC-3.6).
  return (
    <QueryProvider>
      <SessionProvider>
        <LiveInner {...props} />
      </SessionProvider>
    </QueryProvider>
  );
}

function LiveInner({ sessionId, fullName, activeRole }: LiveClientProps) {
  const { appUser } = useSession();

  const { session, isLoading, error, reload } = useLiveSession(sessionId, {
    pollWhileNotLive: true,
  });
  const isLive = session?.status === "live";
  const {
    signed: signedPlayback,
    isLoading: signLoading,
    refetch: refetchSign,
  } = useLivePlaybackSign(sessionId, "live", !!isLive);
  const chat = useChatChannel(sessionId);
  const hand = useRaiseHand(sessionId);
  const { isBanned } = useSessionState(sessionId);

  const pinned = useMemo(() => {
    const ann = chat.messages.filter(
      (m) => m.kind === "announcement" && !m.is_deleted,
    );
    return ann.length > 0 ? ann[ann.length - 1]! : null;
  }, [chat.messages]);

  const endedSignal = useMemo(
    () => chat.messages.some((m) => m.kind === "system"),
    [chat.messages],
  );
  const ended = session?.status === "ended" || endedSignal;

  useEffect(() => {
    if (endedSignal) void reload();
  }, [endedSignal, reload]);

  // Brief race: teacher flipped to live but yt-playback-sign hasn't caught up
  // yet. Retry every 5s until we get a video_id.
  useEffect(() => {
    if (isLive && !ended && !signedPlayback && !signLoading) {
      const t = setTimeout(() => void refetchSign(), 5000);
      return () => clearTimeout(t);
    }
  }, [isLive, ended, signedPlayback, signLoading, refetchSign]);

  const watermarkText =
    signedPlayback?.watermark ??
    formatWatermark(fullName, appUser?.phone ?? null);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Can&apos;t open this class</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Link
            href="/classes"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Back to Classes
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading && !session) {
    return (
      <div className="min-h-svh bg-slate-900">
        <LobbyCountdown
          scheduledStart={new Date().toISOString()}
          subjectName="Loading…"
        />
      </div>
    );
  }

  if (ended) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-50">
        <Header
          subject={session?.subject_name ?? "Live class"}
          isLive={false}
        />
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-slate-900">
              This class has ended
            </h2>
            {session?.yt_video_id ? (
              <>
                <p className="mt-2 text-sm text-slate-500">
                  The recording is ready to watch.
                </p>
                <Link
                  href={`/recording/${sessionId}`}
                  replace
                  className="mt-6 inline-flex rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Watch recording
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                The recording will appear in your Classes tab once it&apos;s
                processed.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const playerReady = isLive && signedPlayback;

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <Header
        subject={session?.subject_name ?? "Live class"}
        isLive={!!isLive}
      />

      {/* Player area — 16:9 hero on mobile, side-by-side layout on lg+. */}
      <div className="lg:flex lg:flex-1 lg:overflow-hidden">
        <div className="relative bg-black lg:w-[min(70vw,1100px)]">
          {playerReady ? (
            <div className="relative">
              <WrappedYtPlayer videoId={signedPlayback!.video_id} />
              <Watermark text={watermarkText} />
              {activeRole === "teacher" ? (
                <div className="absolute right-2 top-2 z-20">
                  <Link
                    href={`/live-control/${sessionId}`}
                    className="rounded-md bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-white"
                  >
                    Open Live Control →
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="h-[56vw] max-h-[80vh] lg:h-full">
              <LobbyCountdown
                scheduledStart={
                  session?.scheduled_start ?? new Date().toISOString()
                }
                subjectName={session?.subject_name}
              />
            </div>
          )}
        </div>

        {/* Chat column */}
        <div className="flex min-h-0 flex-1 flex-col bg-white lg:border-l lg:border-slate-200">
          {pinned ? (
            <PinnedBanner text={pinned.body} byName={pinned.author_name} />
          ) : null}

          <div className="flex min-h-[40vh] flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatPane
                messages={chat.messages}
                currentUserId={appUser?.id}
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2">
              <RaiseHandButton
                raised={hand.myHandRaised}
                busy={hand.isBusy}
                disabled={!playerReady || isBanned}
                onRaise={hand.raise}
                onLower={hand.lower}
              />
              {hand.myHandRaised ? (
                <span
                  className="text-xs font-semibold text-amber-600"
                  data-testid="hand-raised-pill"
                >
                  Hand raised ✋
                </span>
              ) : null}
            </div>

            <ChatComposer
              onSend={(t) => chat.post(t)}
              disabled={isBanned || !playerReady}
              disabledReason={
                isBanned
                  ? "You've been muted by the teacher. You can read but can't send."
                  : "Chat opens when the class goes live."
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ subject, isLive }: { subject: string; isLive: boolean }) {
  return (
    <header className="flex items-center border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <Link
        href="/classes"
        aria-label="Back to classes"
        className="mr-3 flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 sm:text-base">
        {subject}
      </h1>
      {isLive ? (
        <span
          data-testid="live-pill"
          className="ml-2 inline-flex items-center rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-600"
        >
          <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-red-500" />
          Live
        </span>
      ) : null}
    </header>
  );
}
