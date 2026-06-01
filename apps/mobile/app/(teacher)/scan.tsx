import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  ChevronDown,
  Settings,
  XCircle,
  ListChecks,
  Camera as CameraIcon,
} from "lucide-react-native";
import { ScannerOverlay } from "@/components/teacher/ScannerOverlay";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useCameraPermission } from "@/features/attendance/useCameraPermission";
import { useScanVerify, type VerifyResult } from "@/features/attendance/useScanVerify";
import {
  useTeacherSessions,
  pickNearestSession,
  type TeacherSession,
} from "@/features/attendance/useTeacherSessions";
import { sessionDisplayName } from "@/lib/session-name";

const TOAST_VISIBLE_MS = 1800;

interface Toast {
  tone: "success" | "error";
  title: string;
  subtitle: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionLabel(s: TeacherSession): string {
  const subj = sessionDisplayName(s.title, s.subject_name);
  return `${subj} · ${formatTime(s.scheduled_start)} · ${s.batch_name}`;
}

export default function TeacherScanScreen(): React.ReactElement {
  const router = useRouter();
  const camera = useCameraPermission();
  const { sessions, isLoading: sessionsLoading } = useTeacherSessions();
  const { verify, busy } = useScanVerify();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayTone, setOverlayTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );

  const scannableSessions = useMemo(
    () => sessions.filter((s) => s.bucket !== "past"),
    [sessions],
  );

  const activeSessionId = useMemo(() => {
    if (selectedSessionId) return selectedSessionId;
    const nearest = pickNearestSession(scannableSessions);
    return nearest?.id ?? null;
  }, [selectedSessionId, scannableSessions]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const showToast = useCallback(
    (t: Toast) => {
      setToast(t);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, TOAST_VISIBLE_MS);
    },
    [toastOpacity],
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const applyResult = useCallback(
    (result: VerifyResult) => {
      if (result.kind === "success") {
        setOverlayTone("success");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({
          tone: "success",
          title: `✔ ${result.student_name}`,
          subtitle: result.status === "late" ? "Marked late" : "Marked present",
        });
      } else {
        setOverlayTone("error");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast({
          tone: "error",
          title:
            result.code === "already_marked"
              ? "Already marked"
              : result.code === "rate_limited"
                ? "Slow down"
                : result.code === "expired"
                  ? "QR expired"
                  : result.code === "wrong_session"
                    ? "Wrong class"
                    : result.code === "bad_signature"
                      ? "Invalid QR"
                      : "Couldn't verify",
          subtitle: result.message,
        });
      }
      setTimeout(() => setOverlayTone("neutral"), 600);
    },
    [showToast],
  );

  const handleBarcode = useCallback(
    async (payload: string) => {
      if (busy) return;
      if (!activeSessionId) {
        showToast({
          tone: "error",
          title: "Pick a session",
          subtitle: "Select which class you're marking before scanning.",
        });
        return;
      }
      const result = await verify(payload, activeSessionId);
      if (result) applyResult(result);
    },
    [busy, activeSessionId, verify, applyResult, showToast],
  );

  if (camera.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900">
        <LoadingScreen background="bg-slate-900" dotColor="#FFFFFF" />
      </SafeAreaView>
    );
  }

  if (!camera.granted) {
    return <CameraDeniedView camera={camera} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={["top"]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          busy
            ? undefined
            : ({ data }) => {
                void handleBarcode(data);
              }
        }
      />
      <View className="flex-1">
          <View className="px-5 pt-3 pb-2">
            <TouchableOpacity
              onPress={() => setShowPicker((v) => !v)}
              className="bg-black/55 rounded-2xl px-4 py-3 flex-row items-center"
              activeOpacity={0.85}
            >
              <View className="flex-1">
                <Text className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                  Scanning for
                </Text>
                <Text
                  className="text-white text-sm font-bold mt-0.5"
                  numberOfLines={1}
                >
                  {sessionsLoading
                    ? "Loading classes…"
                    : activeSession
                      ? sessionLabel(activeSession)
                      : "No live or upcoming class — pick one"}
                </Text>
              </View>
              <ChevronDown size={20} color="#fde68a" />
            </TouchableOpacity>

            {showPicker ? (
              <View className="mt-2 bg-black/80 rounded-2xl overflow-hidden max-h-[260px]">
                {scannableSessions.length === 0 ? (
                  <Text className="text-white/70 text-xs p-4 text-center">
                    No upcoming or live classes in your batches.
                  </Text>
                ) : (
                  scannableSessions.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        setSelectedSessionId(s.id);
                        setShowPicker(false);
                      }}
                      className="px-4 py-3 border-b border-white/10"
                    >
                      <Text
                        className="text-white text-sm font-semibold"
                        numberOfLines={1}
                      >
                        {sessionDisplayName(s.title, s.subject_name)} ·{" "}
                        {formatTime(s.scheduled_start)}
                      </Text>
                      <Text className="text-white/60 text-[11px] mt-0.5">
                        {s.batch_name} · {s.bucket === "today" ? "Today" : "Upcoming"}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}
          </View>

          <View className="flex-1 items-center justify-center">
            <ScannerOverlay
              hint={
                busy
                  ? "Verifying…"
                  : activeSessionId
                    ? "Point at student's QR"
                    : "Pick a class first"
              }
              tone={overlayTone}
            />
          </View>

          <View className="px-5 pb-6">
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => {
                  if (activeSessionId) {
                    router.push({
                      pathname: "/roster/[sessionId]",
                      params: { sessionId: activeSessionId },
                    });
                  }
                }}
                disabled={!activeSessionId}
                activeOpacity={0.85}
                className={`flex-1 mr-2 rounded-2xl py-3 flex-row items-center justify-center ${
                  activeSessionId ? "bg-white" : "bg-white/30"
                }`}
              >
                <ListChecks size={18} color="#0f172a" />
                <Text className="ml-2 text-slate-900 font-bold text-sm">
                  Open roster
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {toast ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: 160,
                opacity: toastOpacity,
              }}
            >
              <View
                className={`rounded-2xl px-4 py-3 flex-row items-center ${
                  toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
                }`}
              >
                {toast.tone === "success" ? (
                  <CheckCircle2 size={22} color="#fff" />
                ) : (
                  <XCircle size={22} color="#fff" />
                )}
                <View className="ml-3 flex-1">
                  <Text
                    className="text-white font-bold text-sm"
                    numberOfLines={1}
                  >
                    {toast.title}
                  </Text>
                  <Text
                    className="text-white/90 text-xs mt-0.5"
                    numberOfLines={2}
                  >
                    {toast.subtitle}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ) : null}
      </View>
    </SafeAreaView>
  );
}

function CameraDeniedView({
  camera,
}: {
  camera: ReturnType<typeof useCameraPermission>;
}): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4">
          <CameraIcon size={32} color="#d97706" />
        </View>
        <Text className="text-xl font-extrabold text-slate-900 text-center">
          Camera access needed
        </Text>
        <Text className="mt-2 text-sm text-slate-600 text-center leading-5">
          FyneStudy uses the camera to scan students&apos; attendance QR codes.
          {camera.canAskAgain ? "" : " Enable it from Settings to continue."}
        </Text>
        {camera.canAskAgain ? (
          <TouchableOpacity
            onPress={() => {
              void camera.request();
            }}
            className="mt-6 bg-blue-600 rounded-2xl py-3 px-6"
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-sm">Allow camera</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              void camera.openSettings();
            }}
            className="mt-6 bg-slate-900 rounded-2xl py-3 px-6 flex-row items-center"
            activeOpacity={0.85}
          >
            <Settings size={16} color="#fff" />
            <Text className="ml-2 text-white font-bold text-sm">
              Open Settings
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
