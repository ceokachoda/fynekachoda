"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { useLiveSession } from "@/features/live/useLiveSession";
import { useLivePlaybackSign } from "@/features/live/useLivePlaybackSign";
import { useChatChannel } from "@/features/chat/useChatChannel";
import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";
import { Watermark } from "@/components/player/Watermark";
import { ChatReplay } from "@/components/live/ChatReplay";
import { cn } from "@/lib/utils";
import { formatWatermark } from "@/lib/watermark";

const SPEEDS = [1, 1.5, 2] as const;

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

  const [rate, setRate] = useState<number>(1);
  const [posSec, setPosSec] = useState(0);

  const startedAt = session?.started_at ?? session?.scheduled_start ?? null;
  const watermarkText =
    sign.signed?.watermark ??
    formatWatermark(fullName, appUser?.phone ?? null);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-50 p-6">
        <p className="mb-3 text-sm text-red-600">{error}</p>
        <Link
          href="/classes"
          className="self-start rounded-xl bg-slate-200 px-4 py-2 text-sm text-slate-800"
        >
          Go back
        </Link>
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
        <Header subject={session?.subject_name ?? "Recording"} />
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
    <div className="flex min-h-svh flex-col bg-slate-50">
      <Header subject={session?.subject_name ?? "Recording"} />

      <div className="lg:flex lg:flex-1 lg:overflow-hidden">
        {/* Player + speed controls */}
        <div className="bg-black lg:w-[min(70vw,1100px)]">
          <div className="relative">
            <WrappedYtPlayer
              videoId={sign.signed.video_id}
              playbackRate={rate}
              onPosition={(sec) => setPosSec(sec)}
            />
            <Watermark text={watermarkText} />
          </div>

          <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 bg-white px-3 py-2.5">
            <span className="mr-2 text-[11px] text-slate-400">Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`speed-${s}x`}
                onClick={() => setRate(s)}
                aria-pressed={rate === s}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-bold transition",
                  rate === s
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Chat replay column */}
        <div className="flex min-h-[40vh] flex-1 flex-col bg-white lg:border-l lg:border-slate-200">
          <div className="border-b border-slate-100 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
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

function Header({ subject }: { subject: string }) {
  return (
    <header className="flex items-center bg-white px-4 py-3 lg:px-6">
      <Link
        href="/classes"
        aria-label="Back to classes"
        className="mr-3 flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-800 hover:bg-slate-200"
      >
        <ChevronLeft className="size-4" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-blue-900 sm:text-base">
        {subject}
      </h1>
      <span className="ml-2 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
        RECORDING
      </span>
    </header>
  );
}
