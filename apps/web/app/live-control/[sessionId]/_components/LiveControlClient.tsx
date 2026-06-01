"use client";

// Phase 4 Track 4B — teacher live control (FocusLayout). Two phases:
//
// SETUP (broadcast not yet ready / pre-live):
//   - Create broadcast via yt-broadcast-create (keep RTMP + key in
//     `useState` — NEVER cache/persist).
//   - Inline error card + Retry that keeps the title/description state
//     (locked decision #4).
//   - Copy buttons for server / key / both via navigator.clipboard.writeText.
//   - "Go Live" via yt-broadcast-golive (flips sessions.status='live').
//
// LIVE (status === 'live'):
//   - Tabbed view: Stream tab renders the WrappedYtPlayer preview; Moderate
//     tab renders chat + raise-hand queue + pin composer (locked decision #3
//     keeps only one YT iframe mounted per view).
//   - Moderate: kebab on each chat message → DropdownMenu → Delete / Ban /
//     Unban via chat-delete / chat-ban.
//   - End class: confirmation Dialog → yt-broadcast-stop.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  Copy,
  Hand,
  Loader2,
  Pin,
  Radio,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill } from "@/components/fyne/Pill";
import { FocusLayout } from "@/components/fyne/FocusLayout";
import { QueryProvider } from "@/lib/query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { useLiveSession } from "@/features/live/useLiveSession";
import { useLivePlaybackSign } from "@/features/live/useLivePlaybackSign";
import { sessionDisplayName } from "@/lib/session-name";
import {
  useChatChannel,
  type ChatMessage,
} from "@/features/chat/useChatChannel";
import { useRaiseHand } from "@/features/live/useRaiseHand";
import { useSessionBans } from "@/features/teacher/useSessionBans";
import {
  useChatBan,
  useChatDelete,
  useYtBroadcastCreate,
  useYtBroadcastGoLive,
  useYtBroadcastStop,
} from "@/features/teacher/mutations";
import { WrappedYtPlayer } from "@/components/player/WrappedYtPlayer";
import { Watermark } from "@/components/player/Watermark";
import { ChatComposer } from "@/components/live/ChatComposer";
import { ChatModerationMenu } from "@/components/teacher/ChatModerationMenu";
import { ConfirmDialog } from "@/components/teacher/ConfirmDialog";
import { formatWatermark } from "@/lib/watermark";

interface Props {
  sessionId: string;
  fullName: string;
}

interface BroadcastInfo {
  rtmpUrl: string | null;
  streamKey: string | null;
}

export function LiveControlClient(props: Props) {
  return (
    <FocusLayout className="bg-slate-50">
      <QueryProvider>
        <SessionProvider>
          <LiveControlInner {...props} />
        </SessionProvider>
      </QueryProvider>
    </FocusLayout>
  );
}

function LiveControlInner({ sessionId, fullName }: Props) {
  const router = useRouter();
  const { appUser } = useSession();
  const { session, reload } = useLiveSession(sessionId, {
    pollWhileNotLive: true,
  });
  const isLive = session?.status === "live";
  const ended = session?.status === "ended";

  const sign = useLivePlaybackSign(sessionId, "live", !!isLive);
  const chat = useChatChannel(sessionId, { presence: true });
  const hand = useRaiseHand(sessionId);
  const bans = useSessionBans(sessionId);

  // Stream key + RTMP live ONLY in useState — never React Query cache.
  const [broadcast, setBroadcast] = useState<BroadcastInfo>({
    rtmpUrl: null,
    streamKey: null,
  });
  // Inline error card + Retry KEEPS the form state (locked decision #4).
  const [createError, setCreateError] = useState<string | null>(null);

  const broadcastCreate = useYtBroadcastCreate();
  const goLive = useYtBroadcastGoLive();
  const stop = useYtBroadcastStop();
  const chatDelete = useChatDelete();
  const chatBan = useChatBan();

  const [copied, setCopied] = useState<"server" | "key" | "both" | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tab, setTab] = useState<"stream" | "moderate">("stream");
  const [pinComposerOpen, setPinComposerOpen] = useState(false);
  const [pinText, setPinText] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Idempotent re-fetch via broadcast.create on first mount; keeps the key
  // out of any persistent store.
  useEffect(() => {
    if (!sessionId || ended) return;
    let active = true;
    setCreateError(null);
    void (async () => {
      try {
        const out = await broadcastCreate.mutateAsync(sessionId);
        if (!active) return;
        setBroadcast({
          rtmpUrl: out.rtmp_url ?? null,
          streamKey: out.stream_key ?? null,
        });
      } catch (e) {
        if (!active) return;
        setCreateError(
          e instanceof Error ? e.message : "Couldn't prepare the broadcast.",
        );
      }
    })();
    return () => {
      active = false;
    };
    // intentionally only on sessionId — re-creating on re-renders would burn API quota
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, ended]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copy = useCallback(async (field: "server" | "key" | "both", value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore — Firefox sometimes blocks clipboard on insecure contexts
    }
    setCopied(field);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  }, []);

  const handleGoLive = async () => {
    try {
      await goLive.mutateAsync(sessionId);
      await reload();
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Couldn't go live.",
      );
    }
  };

  const handleStop = async () => {
    try {
      await stop.mutateAsync(sessionId);
      setConfirmEnd(false);
      router.back();
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(
          e instanceof Error ? e.message : "Couldn't end the class.",
        );
      }
    }
  };

  const handleRetryCreate = async () => {
    setCreateError(null);
    try {
      const out = await broadcastCreate.mutateAsync(sessionId);
      setBroadcast({
        rtmpUrl: out.rtmp_url ?? null,
        streamKey: out.stream_key ?? null,
      });
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Couldn't prepare the broadcast.",
      );
    }
  };

  const submitPin = async () => {
    const trimmed = pinText.trim();
    if (!trimmed) return;
    const res = await chat.post(trimmed, "announcement");
    if (res.ok) {
      setPinText("");
      setPinComposerOpen(false);
    } else {
      if (typeof window !== "undefined") {
        window.alert(res.error ?? "Couldn't pin.");
      }
    }
  };

  const watermarkText =
    sign.signed?.watermark ??
    formatWatermark(fullName, appUser?.phone ?? null);

  const presenceCount = chat.presenceCount;

  const lastPinned = useMemo(() => {
    const ann = chat.messages.filter(
      (m) => m.kind === "announcement" && !m.is_deleted,
    );
    return ann.length > 0 ? ann[ann.length - 1]! : null;
  }, [chat.messages]);

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">
            {session ? sessionDisplayName(session.title, session.subject_name) : "Live class"}
          </p>
          <p className="flex items-center text-xs text-slate-500">
            {isLive ? (
              <>
                <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-semibold text-red-600">Live now</span>
              </>
            ) : ended ? (
              "Ended"
            ) : (
              "Setup"
            )}
          </p>
        </div>
        {isLive ? (
          <>
            <Pill tone="neutral" className="mr-1">
              <Users className="mr-1 size-3" />
              {presenceCount}
            </Pill>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmEnd(true)}
              disabled={stop.isPending}
            >
              {stop.isPending ? "Ending…" : "End class"}
            </Button>
          </>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-4">
        {ended ? (
          <section className="flex flex-col items-center rounded-3xl border border-slate-100 bg-white p-8 text-center">
            <p className="text-lg font-bold text-slate-900">This class has ended</p>
            <Button onClick={() => router.back()} variant="outline" className="mt-5">
              Back to classes
            </Button>
          </section>
        ) : !isLive ? (
          <section className="space-y-6">
            <header>
              <h1 className="text-xl font-extrabold text-slate-900">
                Stream setup
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Open OBS Studio, paste the server + stream key below, start
                streaming, then tap Go Live so students can join.
              </p>
            </header>

            {broadcastCreate.isPending && !broadcast.rtmpUrl ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-6">
                <Loader2 className="size-4 animate-spin text-primary" />
                <p className="text-sm text-slate-500">Preparing broadcast…</p>
              </div>
            ) : createError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">
                  {createError}
                </p>
                <Button
                  onClick={handleRetryCreate}
                  variant="outline"
                  className="mt-3"
                  data-testid="broadcast-retry"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-[11px] font-bold uppercase text-slate-500">
                  Server (RTMP URL)
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-sm text-slate-900">
                    {broadcast.rtmpUrl ?? "—"}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!broadcast.rtmpUrl}
                    onClick={() => copy("server", broadcast.rtmpUrl ?? "")}
                    data-testid="copy-server"
                  >
                    {copied === "server" ? (
                      <Check className="text-emerald-600" />
                    ) : (
                      <Copy />
                    )}
                    {copied === "server" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase text-slate-500">
                  Stream key
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-sm text-slate-900">
                    {broadcast.streamKey ?? "—"}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!broadcast.streamKey}
                    onClick={() => copy("key", broadcast.streamKey ?? "")}
                    data-testid="copy-key"
                  >
                    {copied === "key" ? (
                      <Check className="text-emerald-600" />
                    ) : (
                      <Copy />
                    )}
                    {copied === "key" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={!broadcast.rtmpUrl || !broadcast.streamKey}
                  onClick={() =>
                    copy(
                      "both",
                      `FyneStudy live class — OBS stream settings\nServer: ${broadcast.rtmpUrl ?? ""}\nStream key: ${broadcast.streamKey ?? ""}`,
                    )
                  }
                >
                  {copied === "both" ? (
                    <Check className="text-emerald-600" />
                  ) : (
                    <Copy />
                  )}
                  {copied === "both" ? "Copied Server + Key" : "Copy Server + Key"}
                </Button>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  <strong className="font-semibold text-slate-700">Tip:</strong>{" "}
                  tap Copy Server + Key, then paste it into a message to yourself
                  (WhatsApp / Telegram / email) and open it on your streaming
                  computer. Keep your stream key private.
                </p>
              </div>
            )}

            <Button
              variant="destructive"
              size="lg"
              disabled={goLive.isPending || createError !== null}
              onClick={handleGoLive}
              className="w-full"
              data-testid="go-live"
            >
              {goLive.isPending ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Radio className="mr-1 size-4" />
              )}
              Go Live
            </Button>
          </section>
        ) : (
          // ─── LIVE ─────────────────────────────────────────────────────────
          <section className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "stream" | "moderate")}>
              <TabsList>
                <TabsTrigger value="stream">Stream</TabsTrigger>
                <TabsTrigger value="moderate">
                  Moderate ({hand.queue.length} hand
                  {hand.queue.length === 1 ? "" : "s"})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stream" className="space-y-3">
                {sign.signed ? (
                  <div className="relative overflow-hidden rounded-3xl bg-black">
                    <WrappedYtPlayer videoId={sign.signed.video_id} />
                    <Watermark text={watermarkText} />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-900 text-slate-300">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Connecting preview…
                  </div>
                )}
                {lastPinned ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                      <Pin className="mr-1 inline size-3" />
                      Pinned by {lastPinned.author_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-900">{lastPinned.body}</p>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="moderate" className="space-y-3">
                <ModerateChatPane
                  messages={chat.messages}
                  currentUserId={appUser?.id}
                  isBanned={bans.isBanned}
                  onDelete={async (m) => {
                    await chatDelete.mutateAsync({ message_id: m.id });
                  }}
                  onBan={async (m) => {
                    await chatBan.mutateAsync({
                      session_id: sessionId,
                      user_id: m.author_id,
                      action: "ban",
                    });
                  }}
                  onUnban={async (m) => {
                    await chatBan.mutateAsync({
                      session_id: sessionId,
                      user_id: m.author_id,
                      action: "unban",
                    });
                  }}
                />
                <div className="rounded-2xl border border-slate-100 bg-white p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                    Raise-hand queue
                  </p>
                  {hand.queue.length === 0 ? (
                    <p className="flex items-center text-sm text-slate-500">
                      <Hand className="mr-2 size-4" />
                      No raised hands right now.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {hand.queue.map((h, i) => (
                        <li
                          key={h.id}
                          className="flex items-center rounded-xl bg-slate-50 p-3"
                        >
                          <div className="mr-3 flex size-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                            {i + 1}
                          </div>
                          <p className="flex-1 text-sm font-semibold text-slate-800">
                            {h.student_name}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void hand.resolve(h.id)}
                            data-testid={`hand-resolve-${h.id}`}
                          >
                            Resolve
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-3">
                  {pinComposerOpen ? (
                    <>
                      <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                        Pin an announcement
                      </p>
                      <textarea
                        value={pinText}
                        onChange={(e) => setPinText(e.target.value)}
                        rows={2}
                        placeholder="e.g. We'll review Chapter 4 at the end."
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setPinText("");
                            setPinComposerOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={submitPin}
                          disabled={!pinText.trim()}
                        >
                          Pin
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setPinComposerOpen(true)}
                    >
                      <Pin />
                      Pin an announcement
                    </Button>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white">
                  <ChatComposer
                    placeholder="Message your class…"
                    onSend={(t) => chat.post(t, "chat")}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="End class for everyone?"
        description="Students will be moved to the recording. Stopping is irreversible — YouTube finalises the recording afterwards."
        confirmLabel={stop.isPending ? "Ending…" : "End class"}
        pending={stop.isPending}
        destructive
        onConfirm={handleStop}
      />
    </div>
  );
}

function ModerateChatPane({
  messages,
  currentUserId,
  isBanned,
  onDelete,
  onBan,
  onUnban,
}: {
  messages: ChatMessage[];
  currentUserId: string | undefined;
  isBanned: (userId: string | undefined | null) => boolean;
  onDelete: (m: ChatMessage) => Promise<void>;
  onBan: (m: ChatMessage) => Promise<void>;
  onUnban: (m: ChatMessage) => Promise<void>;
}) {
  // Render a moderation-friendly chat pane that exposes a kebab per message.
  // We rebuild the rows rather than reusing <ChatPane> so we can drop the
  // moderation menu inline next to each message bubble.
  const chatMsgs = messages.filter((m) => m.kind === "chat");
  if (chatMsgs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500">
        No messages yet.
      </div>
    );
  }
  return (
    <ul className="max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-3">
      {chatMsgs.map((m) => (
        <li
          key={m.id}
          className="group/msg flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/30"
          data-testid={`mod-msg-${m.id}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-700">
              {m.author_name}
              {isBanned(m.author_id) ? (
                <span className="ml-1 text-amber-700">· muted</span>
              ) : null}
            </p>
            <p
              className={`text-sm ${
                m.is_deleted ? "italic text-slate-400 line-through" : "text-slate-900"
              }`}
            >
              {m.is_deleted ? "(message deleted)" : m.body}
            </p>
          </div>
          {!m.is_deleted && m.author_id !== currentUserId ? (
            <ChatModerationMenu
              authorName={m.author_name}
              isBanned={isBanned(m.author_id)}
              onDelete={() => void onDelete(m)}
              onBan={() => void onBan(m)}
              onUnban={() => void onUnban(m)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
