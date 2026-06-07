// Phase 9 CP8 — teacher live-control (top-level Stack route per D-169).
//
// Setup phase: creates/fetches the YouTube broadcast (yt-broadcast-create),
// shows the RTMP URL + stream key for OBS, and a "Go Live" button
// (yt-broadcast-golive) that flips the session live so students can join.
// Live phase: a player preview, viewer count (Realtime presence), the chat with
// moderation (long-press → delete / ban), the raise-hand queue, a pin-
// announcement composer, and "End Class" (yt-broadcast-stop).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Ban,
  Check,
  CheckCheck,
  ChevronLeft,
  Copy,
  Hand,
  Pin,
  Radio,
  Trash2,
  Users,
  Volume2,
} from "lucide-react-native";
import {
  WrappedYtPlayer,
  type WrappedYtPlayerHandle,
} from "@/components/live/WrappedYtPlayer";
import { ChatPane } from "@/components/live/ChatPane";
import { ChatComposer } from "@/components/live/ChatComposer";
import { useSession } from "@/features/auth/useSession";
import { useLiveSession } from "@/features/live/useLiveSession";
import { usePlaybackSign } from "@/features/live/usePlaybackSign";
import { useChatChannel, type ChatMessage } from "@/features/chat/useChatChannel";
import { sessionDisplayName } from "@/lib/session-name";
import { useRaiseHand } from "@/features/live/useRaiseHand";
import { useSessionBans } from "@/features/live/useSessionBans";
import { invokeEdgeFn } from "@/lib/edge-fn";

interface BroadcastInfo {
  loading: boolean;
  notConfigured: boolean;
  rtmpUrl: string | null;
  streamKey: string | null;
  error: string | null;
}

export default function LiveControlScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { appUser } = useSession();
  const insets = useSafeAreaInsets();

  const { session, reload } = useLiveSession(sessionId, { pollWhileNotLive: true });
  const isLive = session?.status === "live";
  const ended = session?.status === "ended";
  const sign = usePlaybackSign(sessionId, "live", !!isLive);
  const chat = useChatChannel(sessionId, { presence: true });
  const hand = useRaiseHand(sessionId);
  const bans = useSessionBans(sessionId);
  const playerRef = useRef<WrappedYtPlayerHandle | null>(null);

  const [broadcast, setBroadcast] = useState<BroadcastInfo>({
    loading: true,
    notConfigured: false,
    rtmpUrl: null,
    streamKey: null,
    error: null,
  });
  const [goingLive, setGoingLive] = useState(false);
  const [ending, setEnding] = useState(false);
  const [modTarget, setModTarget] = useState<ChatMessage | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinText, setPinText] = useState("");
  const [copied, setCopied] = useState<"server" | "key" | "both" | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (field: "server" | "key" | "both", value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(field);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => playerRef.current?.pause());
    return unsub;
  }, [navigation]);

  // Create (or re-fetch) the broadcast on mount.
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void (async () => {
      const res = await invokeEdgeFn<{
        rtmp_url?: string;
        stream_key?: string;
        error?: string;
      }>("yt-broadcast-create", { session_id: sessionId });
      if (!active) return;
      if (res.status === 200) {
        setBroadcast({
          loading: false,
          notConfigured: false,
          rtmpUrl: res.body?.rtmp_url ?? null,
          streamKey: res.body?.stream_key ?? null,
          error: null,
        });
      } else if (res.status === 503) {
        setBroadcast({
          loading: false,
          notConfigured: true,
          rtmpUrl: null,
          streamKey: null,
          error: null,
        });
      } else {
        setBroadcast({
          loading: false,
          notConfigured: false,
          rtmpUrl: null,
          streamKey: null,
          error: res.body?.error ?? res.error ?? "Couldn't prepare the broadcast.",
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const goLive = useCallback(async () => {
    setGoingLive(true);
    const res = await invokeEdgeFn("yt-broadcast-golive", { session_id: sessionId });
    setGoingLive(false);
    if (res.status === 200) {
      await reload();
    } else {
      Alert.alert("Couldn't go live", "Please try again in a moment.");
    }
  }, [sessionId, reload]);

  const endClass = useCallback(() => {
    Alert.alert("End this class?", "Students will be moved to the recording.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End class",
        style: "destructive",
        onPress: async () => {
          setEnding(true);
          const res = await invokeEdgeFn("yt-broadcast-stop", { session_id: sessionId });
          setEnding(false);
          if (res.status === 200) router.back();
          else Alert.alert("Couldn't end the class", "Please try again.");
        },
      },
    ]);
  }, [sessionId, router]);

  const doDelete = useCallback(async () => {
    if (!modTarget) return;
    const target = modTarget;
    setModTarget(null);
    await invokeEdgeFn("chat-delete", { message_id: target.id });
  }, [modTarget]);

  const doBan = useCallback(async () => {
    if (!modTarget) return;
    const target = modTarget;
    setModTarget(null);
    const res = await invokeEdgeFn<{ error?: string }>("chat-ban", {
      session_id: sessionId,
      user_id: target.author_id,
      action: "ban",
    });
    if (res.status !== 200) {
      Alert.alert("Couldn't mute", res.body?.error ?? "Please try again.");
    }
  }, [modTarget, sessionId]);

  const doUnban = useCallback(async () => {
    if (!modTarget) return;
    const target = modTarget;
    setModTarget(null);
    const res = await invokeEdgeFn<{ error?: string }>("chat-ban", {
      session_id: sessionId,
      user_id: target.author_id,
      action: "unban",
    });
    if (res.status !== 200) {
      Alert.alert("Couldn't unmute", res.body?.error ?? "Please try again.");
    }
  }, [modTarget, sessionId]);

  const submitPin = useCallback(async () => {
    const text = pinText.trim();
    if (!text) return;
    const res = await chat.post(text, "announcement");
    if (res.ok) {
      setPinText("");
      setPinOpen(false);
    } else {
      Alert.alert("Couldn't pin", res.error ?? "Please try again.");
    }
  }, [pinText, chat]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-slate-100 mr-3"
        >
          <ChevronLeft size={20} color="#1e293b" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
            {session ? sessionDisplayName(session.title, session.subject_name) : "Live class"}
          </Text>
          <Text className="text-[11px] text-slate-500">
            {isLive ? "● Live now" : ended ? "Ended" : "Setup"}
          </Text>
        </View>
        {isLive ? (
          <View className="flex-row items-center mr-3">
            <Users size={14} color="#475569" />
            <Text className="text-slate-600 text-xs font-bold ml-1">
              {chat.presenceCount}
            </Text>
          </View>
        ) : null}
        {isLive ? (
          <Pressable
            onPress={endClass}
            disabled={ending}
            className="bg-red-600 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-white text-xs font-bold">
              {ending ? "Ending…" : "End class"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {ended ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-lg font-bold text-slate-900">This class has ended</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-5 bg-slate-200 px-5 py-2.5 rounded-xl"
          >
            <Text className="text-slate-800 font-semibold">Back to classes</Text>
          </Pressable>
        </View>
      ) : !isLive ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
          <Text className="text-lg font-extrabold text-slate-900 mb-1">
            Stream setup
          </Text>
          <Text className="text-sm text-slate-500 mb-4">
            Open OBS Studio, paste the server + stream key below, then start
            streaming. When you&apos;re live, tap Go Live so students can join.
          </Text>

          {broadcast.loading ? (
            <View className="bg-white rounded-2xl border border-slate-100 p-6 items-center">
              <ActivityIndicator color="#2563EB" />
              <Text className="text-slate-500 text-sm mt-3">Preparing broadcast…</Text>
            </View>
          ) : broadcast.notConfigured ? (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <Text className="text-amber-800 text-sm font-bold mb-1">
                YouTube isn&apos;t configured yet
              </Text>
              <Text className="text-amber-700 text-xs leading-5">
                Add the YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN secrets
                to enable real streaming. You can still tap Go Live to test the
                in-app chat, raise-hand and moderation tools.
              </Text>
            </View>
          ) : broadcast.error ? (
            <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <Text className="text-red-700 text-sm">{broadcast.error}</Text>
            </View>
          ) : (
            <View className="bg-white rounded-2xl border border-slate-100 p-4">
              <Text className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                Server (RTMP URL)
              </Text>
              <View className="flex-row items-center mb-3">
                <Text selectable className="flex-1 text-sm text-slate-900 font-mono pr-2">
                  {broadcast.rtmpUrl}
                </Text>
                <Pressable
                  onPress={() => copy("server", broadcast.rtmpUrl ?? "")}
                  className="flex-row items-center bg-slate-100 rounded-lg px-2.5 py-1.5"
                >
                  {copied === "server" ? (
                    <Check size={13} color="#059669" />
                  ) : (
                    <Copy size={13} color="#475569" />
                  )}
                  <Text
                    className={`ml-1 text-xs font-bold ${
                      copied === "server" ? "text-emerald-600" : "text-slate-600"
                    }`}
                  >
                    {copied === "server" ? "Copied" : "Copy"}
                  </Text>
                </Pressable>
              </View>

              <Text className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                Stream key
              </Text>
              <View className="flex-row items-center">
                <Text selectable className="flex-1 text-sm text-slate-900 font-mono pr-2">
                  {broadcast.streamKey}
                </Text>
                <Pressable
                  onPress={() => copy("key", broadcast.streamKey ?? "")}
                  className="flex-row items-center bg-slate-100 rounded-lg px-2.5 py-1.5"
                >
                  {copied === "key" ? (
                    <Check size={13} color="#059669" />
                  ) : (
                    <Copy size={13} color="#475569" />
                  )}
                  <Text
                    className={`ml-1 text-xs font-bold ${
                      copied === "key" ? "text-emerald-600" : "text-slate-600"
                    }`}
                  >
                    {copied === "key" ? "Copied" : "Copy"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() =>
                  copy(
                    "both",
                    `FyneStudy live class — OBS stream settings\nServer: ${broadcast.rtmpUrl ?? ""}\nStream key: ${broadcast.streamKey ?? ""}`,
                  )
                }
                className="mt-4 flex-row items-center justify-center bg-blue-50 border border-blue-100 rounded-xl py-2.5"
              >
                {copied === "both" ? (
                  <Check size={15} color="#059669" />
                ) : (
                  <Copy size={15} color="#1d4ed8" />
                )}
                <Text
                  className={`ml-2 text-xs font-bold ${
                    copied === "both" ? "text-emerald-600" : "text-blue-700"
                  }`}
                >
                  {copied === "both" ? "Copied Server + Key" : "Copy Server + Key"}
                </Text>
              </Pressable>

              <Text className="text-[11px] text-slate-400 mt-3 leading-4">
                Tip: tap Copy Server + Key, then paste it into a message to yourself
                (WhatsApp / Telegram / email) and open it on your streaming computer
                to paste into OBS. Keep your stream key private.
              </Text>
            </View>
          )}

          <Pressable
            onPress={goLive}
            disabled={goingLive}
            className={`mt-6 rounded-2xl py-3.5 items-center flex-row justify-center ${
              goingLive ? "bg-slate-300" : "bg-red-600"
            }`}
          >
            {goingLive ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Radio size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold">Go Live</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {sign.signed ? (
            <View className="bg-black">
              <WrappedYtPlayer
                ref={playerRef}
                videoId={sign.signed.video_id}
                watermark={sign.signed.watermark}
                live
              />
            </View>
          ) : (
            <View className="bg-slate-900 items-center justify-center" style={{ height: 160 }}>
              <ActivityIndicator color="#fff" />
              <Text className="text-slate-300 text-xs mt-2">
                Connecting preview… (this needs an active YouTube stream)
              </Text>
            </View>
          )}

          {/* Raised hands — always visible above the chat (no more tabs), so a
              teacher never misses a hand while reading messages. */}
          {hand.queue.length > 0 ? (
            <View className="bg-amber-50 border-b border-amber-100">
              <View className="flex-row items-center px-4 pt-2.5 pb-1">
                <Hand size={14} color="#b45309" />
                <Text className="ml-1.5 text-amber-700 text-xs font-bold">
                  Raised hands ({hand.queue.length})
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 132 }}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
              >
                {hand.queue.map((h, i) => (
                  <View
                    key={h.id}
                    className="flex-row items-center bg-white rounded-xl px-3 py-2 mb-1.5 border border-amber-100"
                  >
                    <View className="w-6 h-6 rounded-full bg-amber-100 items-center justify-center mr-2.5">
                      <Text className="text-amber-700 text-[11px] font-bold">{i + 1}</Text>
                    </View>
                    <Text
                      className="flex-1 text-sm font-semibold text-slate-800"
                      numberOfLines={1}
                    >
                      {h.student_name}
                    </Text>
                    <Pressable
                      onPress={() => hand.resolve(h.id)}
                      className="flex-row items-center bg-emerald-50 rounded-lg px-2.5 py-1"
                    >
                      <CheckCheck size={13} color="#059669" />
                      <Text className="ml-1 text-emerald-700 font-bold text-[11px]">
                        Resolve
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View className="flex-1 bg-white">
            <ChatPane
              messages={chat.messages}
              currentUserId={appUser?.id}
              canModerate
              onModerate={(m) => setModTarget(m)}
              emptyHint="No messages yet. Long-press a message to moderate it."
            />
          </View>
          <Pressable
            onPress={() => setPinOpen(true)}
            className="flex-row items-center justify-center py-2 bg-blue-50 border-t border-blue-100"
          >
            <Pin size={14} color="#1d4ed8" style={{ marginRight: 6 }} />
            <Text className="text-blue-700 text-xs font-bold">
              Pin an announcement
            </Text>
          </Pressable>
          <ChatComposer onSend={(t) => chat.post(t)} placeholder="Message your class…" />
        </KeyboardAvoidingView>
      )}

      {/* moderation action sheet */}
      <Modal
        visible={!!modTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setModTarget(null)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setModTarget(null)}
        >
          <View
            className="bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <Text className="text-sm text-slate-500 mb-3" numberOfLines={2}>
              {modTarget?.author_name}
              {bans.isBanned(modTarget?.author_id) ? " (muted)" : ""}: {modTarget?.body}
            </Text>
            <Pressable
              onPress={doDelete}
              className="flex-row items-center py-3 border-b border-slate-100"
            >
              <Trash2 size={18} color="#dc2626" />
              <Text className="ml-3 text-red-600 font-semibold">Delete message</Text>
            </Pressable>
            {bans.isBanned(modTarget?.author_id) ? (
              <Pressable onPress={doUnban} className="flex-row items-center py-3">
                <Volume2 size={18} color="#059669" />
                <Text className="ml-3 text-emerald-700 font-semibold">
                  Unmute {modTarget?.author_name} for this class
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={doBan} className="flex-row items-center py-3">
                <Ban size={18} color="#b45309" />
                <Text className="ml-3 text-amber-700 font-semibold">
                  Mute {modTarget?.author_name} for this class
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* pin announcement composer */}
      <Modal
        visible={pinOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPinOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setPinOpen(false)} />
          <View
            className="bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <Text className="text-lg font-extrabold text-slate-900 mb-1">
              Pin an announcement
            </Text>
            <Text className="text-xs text-slate-500 mb-3">Tap outside to dismiss.</Text>
            <TextInput
              value={pinText}
              onChangeText={setPinText}
              placeholder="e.g. We'll review Chapter 4 at the end."
              placeholderTextColor="#94a3b8"
              maxLength={500}
              multiline
              autoFocus
              className="border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 min-h-20"
            />
            <View className="flex-row mt-4">
              <Pressable
                onPress={() => setPinOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center mr-2"
              >
                <Text className="text-slate-700 font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitPin}
                className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
              >
                <Text className="text-white font-semibold">Pin</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
