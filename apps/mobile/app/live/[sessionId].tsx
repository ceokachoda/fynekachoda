// Phase 9 CP9 — student live-class screen (top-level Stack route per D-169).
// Lobby countdown -> wrapped player + watermark + chat + raise-hand + pinned
// banner. The end-of-class signal arrives as a kind='system' chat message; we
// then offer the recording.

import { useEffect, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import { useVideoOrientation } from "@/features/live/useVideoOrientation";
import {
  WrappedYtPlayer,
  type WrappedYtPlayerHandle,
} from "@/components/live/WrappedYtPlayer";
import { ChatPane } from "@/components/live/ChatPane";
import { ChatComposer } from "@/components/live/ChatComposer";
import { RaiseHandButton } from "@/components/live/RaiseHandButton";
import { PinnedBanner } from "@/components/live/PinnedBanner";
import { LobbyCountdown } from "@/components/live/LobbyCountdown";
import { useSession } from "@/features/auth/useSession";
import { useLiveSession } from "@/features/live/useLiveSession";
import { usePlaybackSign } from "@/features/live/usePlaybackSign";
import { sessionDisplayName } from "@/lib/session-name";
import { useSessionState } from "@/features/live/useSessionState";
import { useRaiseHand } from "@/features/live/useRaiseHand";
import { useChatChannel } from "@/features/chat/useChatChannel";

export default function LiveScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { appUser } = useSession();

  const { session, isLoading, error, reload } = useLiveSession(sessionId, {
    pollWhileNotLive: true,
  });
  const isLive = session?.status === "live";
  const sign = usePlaybackSign(sessionId, "live", !!isLive);
  // Track presence so the teacher's live-control sees an accurate viewer count
  // (track-only: this screen never re-renders on join/leave — low-end perf).
  const chat = useChatChannel(sessionId, { trackPresence: true });
  const hand = useRaiseHand(sessionId);
  const { isBanned } = useSessionState(sessionId);
  const { isLandscape } = useVideoOrientation();
  const playerRef = useRef<WrappedYtPlayerHandle | null>(null);

  const pinned = useMemo(() => {
    const ann = chat.messages.filter((m) => m.kind === "announcement" && !m.is_deleted);
    return ann.length > 0 ? ann[ann.length - 1]! : null;
  }, [chat.messages]);

  const endedSignal = useMemo(
    () => chat.messages.some((m) => m.kind === "system"),
    [chat.messages],
  );
  const ended = session?.status === "ended" || endedSignal;

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => playerRef.current?.pause());
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (endedSignal) void reload();
  }, [endedSignal, reload]);

  // While the class is live but the playback token isn't ready yet (brief race
  // right after the teacher goes live), retry the sign every 5s.
  useEffect(() => {
    if (isLive && !ended && !sign.signed && !sign.isLoading) {
      const t = setTimeout(() => void sign.refetch(), 5000);
      return () => clearTimeout(t);
    }
  }, [isLive, ended, sign.signed, sign.isLoading, sign.refetch]);

  function Header({ title }: { title: string }) {
    return (
      <View className="flex-row items-center px-4 py-3 bg-white">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-slate-100 mr-3"
        >
          <ChevronLeft size={20} color="#1e293b" />
        </Pressable>
        <Text className="text-base font-bold text-blue-900 flex-1" numberOfLines={1}>
          {title}
        </Text>
        {isLive ? (
          <View className="bg-red-100 px-2 py-1 rounded-md flex-row items-center">
            <View className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" />
            <Text className="text-red-600 text-[11px] font-bold">LIVE</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 p-6" edges={["top"]}>
        <Text className="text-red-600 mb-3">{error}</Text>
        <Pressable
          onPress={() => router.back()}
          className="self-start bg-slate-200 px-4 py-2 rounded-xl"
        >
          <Text className="text-slate-800">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading && !session) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900" edges={["top"]}>
        <LobbyCountdown scheduledStart={new Date().toISOString()} subjectName="Loading…" />
      </SafeAreaView>
    );
  }

  if (ended) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <Header title={session ? sessionDisplayName(session.title, session.subject_name) : "Live class"} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-xl font-bold text-slate-900 text-center">
            This class has ended
          </Text>
          {session?.yt_video_id ? (
            <>
              <Text className="text-sm text-slate-500 mt-2 text-center">
                The recording is ready to watch.
              </Text>
              <Pressable
                onPress={() => router.replace(`/recording/${sessionId}` as never)}
                className="mt-6 bg-blue-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-bold">Watch recording</Text>
              </Pressable>
            </>
          ) : (
            <Text className="text-sm text-slate-500 mt-2 text-center">
              The recording will appear in your Classes tab once it&apos;s processed.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const live = isLive && sign.signed;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={isLandscape ? [] : ["top"]}>
      <StatusBar hidden={isLandscape} />
      {!isLandscape ? <Header title={session ? sessionDisplayName(session.title, session.subject_name) : "Live class"} /> : null}

      {/* Media stays at a STABLE tree position so rotating never reloads the
          player — only its wrapper style toggles inline ↔ fullscreen. */}
      <View
        style={
          isLandscape
            ? {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#000",
                zIndex: 50,
              }
            : live
              ? { backgroundColor: "#000" }
              : { height: 220 }
        }
      >
        {live ? (
          <WrappedYtPlayer
            ref={playerRef}
            videoId={sign.signed!.video_id}
            watermark={sign.signed!.watermark}
            live
            fill={isLandscape}
          />
        ) : (
          <LobbyCountdown
            scheduledStart={session?.scheduled_start ?? new Date().toISOString()}
            subjectName={session ? sessionDisplayName(session.title, session.subject_name) : undefined}
          />
        )}
      </View>

      {!isLandscape ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {pinned ? <PinnedBanner text={pinned.body} byName={pinned.author_name} /> : null}

          <View className="flex-1 bg-white">
            <ChatPane messages={chat.messages} currentUserId={appUser?.id} />
          </View>

          <View className="flex-row items-center px-4 py-2 bg-white border-t border-slate-100">
            <RaiseHandButton
              raised={hand.myHandRaised}
              busy={hand.isBusy}
              disabled={!live}
              onRaise={hand.raise}
              onLower={hand.lower}
            />
            <View className="flex-1" />
            {hand.myHandRaised ? (
              <Text className="text-amber-600 text-xs font-semibold">Hand raised ✋</Text>
            ) : null}
          </View>

          <ChatComposer
            onSend={(t) => chat.post(t)}
            disabled={isBanned || !live}
            disabledReason={
              isBanned
                ? "You've been muted by the teacher. You can read but can't send."
                : "Chat opens when the class goes live."
            }
          />
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}
