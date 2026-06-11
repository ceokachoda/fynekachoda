"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { useLiveSession } from "@/features/live/useLiveSession";
import { useLivePlaybackSign } from "@/features/live/useLivePlaybackSign";
import { useChatChannel } from "@/features/chat/useChatChannel";
import { sessionDisplayName } from "@/lib/session-name";
import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";
import { ChatReplay } from "@/components/live/ChatReplay";
import { cn } from "@/lib/utils";
import { formatWatermark } from "@/lib/watermark";

interface RecordingClientProps {
  sessionId: string;
  fullName: string;
}

export function RecordingClient(props: RecordingClientProps) {
  return (
    <QueryProvider>
      <SessionProvider>
        <RecordingInner {...props} />
      </SessionProvider>
    </QueryProvider>
  );
}

function RecordingInner({ sessionId, fullName }: RecordingClientProps) {
  const { appUser } = useSession();
  const { session, isLoading, error } = useLiveSession(sessionId);
  const sign = useLivePlaybackSign(sessionId, "recording", true);
  const chat = useChatChannel(sessionId);

  const [posSec, setPosSec] = useState(0);

  const startedAt = session?.started_at ?? session?.scheduled_start ?? null;
  const watermarkText =
    sign.signed?.watermark ??
    formatWatermark(fullName, appUser?.phone ?? null);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Recording unavailable</h2>
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

  if (isLoading || sign.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50">
        <Loader2 className="size-7 animate-spin text-blue-600" aria-hidden />
      </div>
    );
  }

  if (!sign.signed) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-50">
        <Header subject={session ? sessionDisplayName(session.title, session.subject_name) : "Recording"} />
        <div className="flex flex-1 items-center justify-center px-8">
          <p className="max-w-md text-center text-sm font-semibold text-slate-700">
            {sign.status === 409
              ? "This recording is still being processed by YouTube. Check back shortly."
              : (sign.error ?? "Recording isn't available.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-slate-50">
      {/* Phone-landscape = OTT theater: header gone, video letterboxed left,
          chat replay docked right (rotate back to portrait to navigate away). */}
      <Header
        subject={session?.subject_name ?? "Recording"}
        className="phone-landscape:hidden"
      />

      {/* Stage + chat replay. Same app-shell as the live screen: video sits as
          a contained 16:9 card on a light surface (never a black void), chat
          replay scrolls beside it on lg+ and below it on mobile. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto phone-landscape:flex-row phone-landscape:overflow-hidden lg:flex-row lg:overflow-hidden">
        {/* Video stage */}
        <div className="flex shrink-0 items-start justify-center bg-slate-100 p-3 sm:p-4 phone-landscape:min-h-0 phone-landscape:flex-1 phone-landscape:items-center phone-landscape:bg-black phone-landscape:p-0 lg:min-h-0 lg:flex-1 lg:items-center lg:p-6">
          <div className="w-full max-w-[1200px] phone-landscape:max-w-[calc(100svh*16/9)] lg:max-w-[min(1200px,calc((100svh-160px)*16/9))]">
            <WrappedYtPlayer
              videoId={sign.signed.video_id}
              watermarkText={watermarkText}
              onPosition={(sec) => setPosSec(sec)}
            />
          </div>
        </div>

        {/* Chat replay column */}
        <div className="flex min-h-[40vh] flex-col border-t border-slate-200 bg-white phone-landscape:min-h-0 phone-landscape:w-[320px] phone-landscape:flex-none phone-landscape:border-l phone-landscape:border-t-0 lg:min-h-0 lg:w-[384px] lg:flex-none lg:border-l lg:border-t-0">
          <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Chat replay
            </p>
          </div>
          <div className="min-h-0 flex-1">
            {startedAt ? (
              <ChatReplay
                messages={chat.messages}
                startedAt={startedAt}
                currentSec={Math.floor(posSec)}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6">
                <p className="text-center text-sm text-slate-400">
                  Chat replay isn&apos;t available for this recording.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({
  subject,
  className,
}: {
  subject: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center border-b border-slate-200 bg-white px-4 py-3 lg:px-6",
        className,
      )}
    >
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
      <span className="ml-2 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
        Recording
      </span>
    </header>
  );
}
