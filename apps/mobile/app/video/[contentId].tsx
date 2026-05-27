import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import {
  WrappedYtPlayer,
  type WrappedYtPlayerHandle,
} from "@/components/live/WrappedYtPlayer";
import { useContentItem } from "@/features/library/useContentItem";
import { useVideoProgress } from "@/features/library/useVideoProgress";
import { useVideoOrientation } from "@/features/live/useVideoOrientation";
import { fetchPlaybackSign } from "@/lib/yt-player";

function fmt(s: number): string {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export default function VideoScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { contentId } = useLocalSearchParams<{ contentId: string }>();
  const { data: item, isLoading: itemLoading, error: itemErr } = useContentItem(
    contentId,
  );
  const {
    initial: progress,
    isLoading: progressLoading,
    update: updateProgress,
  } = useVideoProgress(contentId);

  const [signed, setSigned] = useState<{
    video_id: string;
    watermark: string;
  } | null>(null);
  const [signErr, setSignErr] = useState<string | null>(null);
  const [signing, setSigning] = useState(true);
  const [showResume, setShowResume] = useState(false);
  const [resumeApplied, setResumeApplied] = useState(false);
  const { isLandscape } = useVideoOrientation();
  const playerRef = useRef<WrappedYtPlayerHandle | null>(null);

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    setSigning(true);
    setSignErr(null);
    fetchPlaybackSign(contentId)
      .then((r) => {
        if (cancelled) return;
        setSigned({ video_id: r.video_id, watermark: r.watermark });
      })
      .catch((e) => {
        if (cancelled) return;
        setSignErr((e as Error).message ?? "Couldn't authorize playback.");
      })
      .finally(() => {
        if (!cancelled) setSigning(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  useEffect(() => {
    if (!progressLoading && progress && progress.position_sec > 10) {
      setShowResume(true);
    }
  }, [progressLoading, progress]);

  useEffect(() => {
    const unsub = navigation.addListener("blur", () => {
      playerRef.current?.pause();
    });
    return unsub;
  }, [navigation]);

  if (itemLoading || signing) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }
  if (itemErr || !item) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 p-6">
        <Text className="text-red-600">
          {itemErr ?? "This content is no longer available."}
        </Text>
      </SafeAreaView>
    );
  }
  if (signErr || !signed) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 p-6">
        <Text className="text-red-600 mb-3">
          {signErr ?? "Couldn't authorize playback."}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="self-start bg-slate-200 px-4 py-2 rounded-xl"
        >
          <Text className="text-slate-800">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={isLandscape ? [] : ["top"]}>
      <StatusBar hidden={isLandscape} />
      {!isLandscape ? (
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200 mr-3"
          >
            <ChevronLeft size={20} color="#1e293b" />
          </Pressable>
          <Text className="text-base font-bold text-blue-900 flex-1" numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      ) : null}

      {/* Media at a STABLE tree position — rotating only toggles its wrapper
          style, never remounts the player. */}
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
            : { backgroundColor: "#000" }
        }
      >
        <WrappedYtPlayer
          ref={playerRef}
          videoId={signed.video_id}
          watermark={signed.watermark}
          startSec={resumeApplied ? progress?.position_sec : 0}
          fill={isLandscape}
          onProgress={(pos, dur) => {
            void updateProgress(pos, dur);
          }}
        />
      </View>

      {!isLandscape ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {item.description ? (
            <Text className="text-sm text-slate-700 leading-5">
              {item.description}
            </Text>
          ) : null}
          {progress ? (
            <Text className="text-xs text-slate-500 mt-3">
              Last position: {fmt(progress.position_sec)} (
              {Math.round(progress.watched_pct)}% watched)
            </Text>
          ) : null}
        </ScrollView>
      ) : null}

      <Modal
        visible={showResume}
        animationType="slide"
        transparent
        onRequestClose={() => setShowResume(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-lg font-bold text-blue-900">
              Resume from {fmt(progress?.position_sec ?? 0)}?
            </Text>
            <Text className="text-sm text-slate-500 mt-1">
              You watched up to here last time.
            </Text>
            <View className="flex-row gap-3 mt-5">
              <Pressable
                onPress={() => {
                  setShowResume(false);
                  setResumeApplied(false);
                  playerRef.current?.seekTo(0);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
              >
                <Text className="text-slate-700 font-semibold">Start over</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowResume(false);
                  setResumeApplied(true);
                  playerRef.current?.seekTo(progress?.position_sec ?? 0);
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
              >
                <Text className="text-white font-semibold">Resume</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
