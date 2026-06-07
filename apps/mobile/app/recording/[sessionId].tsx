// Phase 9 CP9 — student recording screen (top-level Stack route per D-169).
// Wrapped player + watermark + chat replay synced to the player's current time
// (offset = posted_at - started_at). The replay follows the player's real
// position, so a faster speed reveals messages faster.
//
// Orientation (web-parity, 2026-06):
//   • Portrait  → video on top, transport controls (play/scrub/speed) BELOW the
//     WebView (outside it, where taps always register), chat replay underneath.
//   • Landscape → video + chat replay SIDE BY SIDE, in-video controls.
//   • Fullscreen (button) → immersive video only.
// The media stays at a STABLE tree position — rotating never reloads it.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, Pause, Play } from "lucide-react-native";
import {
  WrappedYtPlayer,
  type WrappedYtPlayerHandle,
} from "@/components/live/WrappedYtPlayer";
import { ChatReplay } from "@/components/live/ChatReplay";
import { useLiveSession } from "@/features/live/useLiveSession";
import { usePlaybackSign } from "@/features/live/usePlaybackSign";
import { sessionDisplayName } from "@/lib/session-name";
import { useChatChannel } from "@/features/chat/useChatChannel";
import { useVideoOrientation } from "@/features/live/useVideoOrientation";
import { LoadingScreen } from "@/components/LoadingScreen";

const SPEEDS = [1, 1.5, 2] as const;

function fmt(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export default function RecordingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { width } = useWindowDimensions();

  const { session, isLoading, error } = useLiveSession(sessionId);
  const sign = usePlaybackSign(sessionId, "recording", true);
  const chat = useChatChannel(sessionId);
  const playerRef = useRef<WrappedYtPlayerHandle | null>(null);

  const [rate, setRate] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [posSec, setPosSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragFrac, setDragFrac] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const { isLandscape, immersive, toggleFullscreen } = useVideoOrientation();

  const wide = isLandscape && !immersive;
  const chrome = !(isLandscape || immersive);
  const chatW = Math.min(Math.max(Math.round(width * 0.36), 300), 400);

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => playerRef.current?.pause());
    return unsub;
  }, [navigation]);

  const fracFromEvent = useCallback(
    (e: GestureResponderEvent) =>
      trackW > 0 ? clamp01(e.nativeEvent.locationX / trackW) : 0,
    [trackW],
  );
  const onSeekGrant = useCallback(
    (e: GestureResponderEvent) => {
      setDragging(true);
      setDragFrac(fracFromEvent(e));
    },
    [fracFromEvent],
  );
  const onSeekMove = useCallback(
    (e: GestureResponderEvent) => setDragFrac(fracFromEvent(e)),
    [fracFromEvent],
  );
  const onSeekRelease = useCallback(
    (e: GestureResponderEvent) => {
      const f = fracFromEvent(e);
      if (durationSec > 0) {
        playerRef.current?.seekTo(f * durationSec);
        setPosSec(f * durationSec);
      }
      setDragging(false);
    },
    [fracFromEvent, durationSec],
  );

  const togglePlay = useCallback(() => {
    if (isPlaying) playerRef.current?.pause();
    else playerRef.current?.play();
  }, [isPlaying]);

  const startedAt = session?.started_at ?? session?.scheduled_start ?? null;
  const displaySec = dragging ? dragFrac * durationSec : posSec;
  const fillPct =
    (dragging ? dragFrac : durationSec > 0 ? clamp01(posSec / durationSec) : 0) * 100;

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

  if (isLoading || sign.isLoading) {
    return <LoadingScreen background="bg-slate-50" />;
  }

  if (!sign.signed) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
        <View className="flex-row items-center px-4 py-3 bg-white">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-slate-100 mr-3"
          >
            <ChevronLeft size={20} color="#1e293b" />
          </Pressable>
          <Text className="text-base font-bold text-blue-900 flex-1" numberOfLines={1}>
            {session ? sessionDisplayName(session.title, session.subject_name) : "Recording"}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base font-semibold text-slate-700 text-center">
            {sign.status === 409
              ? "This recording is still being processed by YouTube. Check back shortly."
              : sign.error ?? "Recording isn't available."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ChatReplayPane = startedAt ? (
    <ChatReplay
      messages={chat.messages}
      startedAt={startedAt}
      currentSec={Math.floor(posSec)}
    />
  ) : (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-slate-400 text-sm text-center">
        Chat replay isn&apos;t available for this recording.
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={chrome ? ["top"] : []}>
      <StatusBar hidden={!chrome} />
      {chrome ? (
        <View className="flex-row items-center px-4 py-3 bg-white">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-slate-100 mr-3"
          >
            <ChevronLeft size={20} color="#1e293b" />
          </Pressable>
          <Text className="text-base font-bold text-blue-900 flex-1" numberOfLines={1}>
            {session ? sessionDisplayName(session.title, session.subject_name) : "Recording"}
          </Text>
          <View className="bg-slate-100 px-2 py-1 rounded-md">
            <Text className="text-slate-600 text-[11px] font-bold">RECORDING</Text>
          </View>
        </View>
      ) : null}

      {/* Media — STABLE node; rotating only toggles its wrapper style. In
          portrait the transport bar below owns playback (hideControls); in
          landscape/immersive the in-video controls take over. */}
      <View
        style={
          immersive
            ? { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 50 }
            : wide
              ? { position: "absolute", top: 0, left: 0, bottom: 0, right: chatW, backgroundColor: "#000", zIndex: 10 }
              : { backgroundColor: "#000" }
        }
      >
        <WrappedYtPlayer
          ref={playerRef}
          videoId={sign.signed.video_id}
          watermark={sign.signed.watermark}
          playbackRate={rate}
          fill={isLandscape || immersive}
          hideControls={chrome}
          isFullscreen={immersive}
          onToggleFullscreen={toggleFullscreen}
          onPlayingChange={setIsPlaying}
          onDuration={(d) => setDurationSec(d)}
          onPosition={(sec, dur) => {
            if (!dragging) setPosSec(sec);
            if (dur > 0) setDurationSec(dur);
          }}
        />
      </View>

      {chrome ? (
        <>
          {/* transport controls — outside the WebView, so taps always register */}
          <View className="bg-white border-b border-slate-100 px-3 pt-2.5 pb-2.5">
            <View className="flex-row items-center">
              <Pressable
                onPress={togglePlay}
                hitSlop={10}
                className="w-11 h-11 rounded-full bg-blue-600 items-center justify-center mr-3"
              >
                {isPlaying ? (
                  <Pause size={20} color="#fff" fill="#fff" />
                ) : (
                  <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                )}
              </Pressable>

              <Text
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  marginRight: 8,
                  width: 36,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {fmt(displaySec)}
              </Text>

              <View
                onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={onSeekGrant}
                onResponderMove={onSeekMove}
                onResponderRelease={onSeekRelease}
                onResponderTerminate={() => setDragging(false)}
                style={{ flex: 1, height: 28, justifyContent: "center", marginRight: 8 }}
              >
                <View style={{ height: 4, borderRadius: 2, backgroundColor: "#e2e8f0" }}>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: "#2563eb",
                      width: `${fillPct}%`,
                    }}
                  />
                </View>
                <View
                  style={{
                    position: "absolute",
                    left: `${fillPct}%`,
                    marginLeft: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: "#2563eb",
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />
              </View>

              <Text
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  width: 36,
                  textAlign: "right",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {fmt(durationSec)}
              </Text>
            </View>

            <View className="flex-row items-center justify-end mt-2.5">
              <Text className="text-[11px] text-slate-400 mr-2">Speed</Text>
              {SPEEDS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setRate(s)}
                  hitSlop={6}
                  className={`px-3 py-1 rounded-full ml-1.5 ${
                    rate === s ? "bg-blue-600" : "bg-slate-100"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      rate === s ? "text-white" : "text-slate-600"
                    }`}
                  >
                    {s}×
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-1 bg-white">{ChatReplayPane}</View>
        </>
      ) : !immersive ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: chatW,
            backgroundColor: "#fff",
            zIndex: 20,
            borderLeftWidth: 1,
            borderLeftColor: "#e2e8f0",
          }}
        >
          {ChatReplayPane}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
