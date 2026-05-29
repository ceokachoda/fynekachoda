import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Users, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";
import {
  useRoster,
  type AttendanceStatus,
  type RosterStudent,
} from "@/features/attendance/useRoster";
import { RosterRow } from "@/components/teacher/RosterRow";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useSession } from "@/features/auth/useSession";
import { useRole } from "@/features/auth/useRole";

const REASON_PRESETS = [
  "Late entry confirmed",
  "QR scan failed",
  "Teacher error",
  "Other",
];

interface CorrectionTarget {
  student: RosterStudent;
  preselectStatus: AttendanceStatus | null;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

export default function RosterScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? null;
  const { isLoading: sessionLoading, session, appUser } = useSession();
  const role = useRole();

  // Roster sits outside the (teacher) tab group so it can be pushed without
  // the Tabs<->Stack hidden-route loop. Re-apply the same gate inline.
  useEffect(() => {
    if (sessionLoading) return;
    if (!session || !appUser) {
      router.replace("/login");
      return;
    }
    if (!role.isTeacher) {
      router.replace("/");
    }
  }, [sessionLoading, session, appUser, role, router]);

  const { meta, students, isLoading, error, refresh } = useRoster(sessionId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] =
    useState<CorrectionTarget | null>(null);

  const gated = sessionLoading || !session || !appUser || !role.isTeacher;

  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let unmarked = 0;
    for (const s of students) {
      if (s.status === "present") present++;
      else if (s.status === "late") late++;
      else if (s.status === "absent") absent++;
      else unmarked++;
    }
    return { present, late, absent, unmarked, total: students.length };
  }, [students]);

  const performUnmark = useCallback(
    async (student: RosterStudent) => {
      if (!sessionId) return;
      setPendingId(student.user_id);
      try {
        const { data, error: invokeErr } = await withTimeout(
          supabase.functions.invoke<{ error?: string }>(
            "attendance-unmark",
            {
              body: {
                session_id: sessionId,
                student_id: student.user_id,
              },
            },
          ),
        );
        if (invokeErr) {
          Alert.alert(
            "Couldn't un-mark",
            data?.error ?? "Server rejected the request.",
          );
          return;
        }
        await refresh();
      } catch (err) {
        Alert.alert(
          "Couldn't un-mark",
          isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Try again.",
        );
      } finally {
        setPendingId(null);
      }
    },
    [sessionId, refresh],
  );

  const onPillTap = useCallback(
    async (student: RosterStudent, status: AttendanceStatus) => {
      if (!sessionId) return;
      if (student.status === status) {
        Alert.alert(
          "Un-mark this student?",
          `Remove the ${status} mark for ${student.full_name}? The audit log keeps a record of the change.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Un-mark",
              style: "destructive",
              onPress: () => {
                void performUnmark(student);
              },
            },
          ],
        );
        return;
      }
      if (student.status === null) {
        setPendingId(student.user_id);
        try {
          const { data, error: invokeErr } = await withTimeout(
            supabase.functions.invoke<{ error?: string }>(
              "attendance-manual-mark",
              {
                body: {
                  session_id: sessionId,
                  student_id: student.user_id,
                  status,
                },
              },
            ),
          );
          if (invokeErr) {
            Alert.alert(
              "Couldn't mark",
              data?.error ?? "Server rejected the request.",
            );
            return;
          }
          await refresh();
        } catch (err) {
          Alert.alert(
            "Couldn't mark",
            isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Try again.",
          );
        } finally {
          setPendingId(null);
        }
      } else {
        setCorrectionTarget({ student, preselectStatus: status });
      }
    },
    [sessionId, performUnmark, refresh],
  );

  const onLongPress = useCallback((student: RosterStudent) => {
    if (!student.attendance_id) {
      Alert.alert(
        "Not marked yet",
        "Tap a pill (P / L / A) to set this student's initial status.",
      );
      return;
    }
    setCorrectionTarget({ student, preselectStatus: null });
  }, []);

  const onBulk = useCallback(
    async (which: "present" | "absent") => {
      if (!sessionId) return;
      Alert.alert(
        which === "present" ? "Mark all remaining present?" : "Mark all remaining absent?",
        `Will mark ${counts.unmarked} unmarked student${counts.unmarked === 1 ? "" : "s"} as ${which}. Existing marks are not changed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              try {
                const { error: invokeErr } = await withTimeout(
                  supabase.functions.invoke("attendance-bulk-mark", {
                    body: { session_id: sessionId, mark_remaining: which },
                  }),
                );
                if (invokeErr) {
                  Alert.alert("Couldn't bulk mark", "Try again.");
                  return;
                }
                await refresh();
              } catch (err) {
                Alert.alert(
                  "Couldn't bulk mark",
                  isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Try again.",
                );
              }
            },
          },
        ],
      );
    },
    [sessionId, counts.unmarked, refresh],
  );

  if (gated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView className="flex-1 bg-slate-50">
          <LoadingScreen />
        </SafeAreaView>
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 pt-2 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="w-10 h-10 items-center justify-center rounded-full"
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text className="ml-2 text-base font-bold text-slate-900">Roster</Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={(s) => s.user_id}
        renderItem={({ item }) => (
          <RosterRow
            student={item}
            onPillTap={(status) => {
              void onPillTap(item, status);
            }}
            onLongPress={() => onLongPress(item)}
            busy={pendingId === item.user_id}
          />
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
        extraData={pendingId}
        removeClippedSubviews
        windowSize={9}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor="#2563EB"
          />
        }
        ListHeaderComponent={
          <View>
            <View className="bg-white mx-6 mt-2 mb-4 p-5 rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/50">
              {isLoading && !meta ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#2563EB" />
                </View>
              ) : error ? (
                <Text className="text-sm font-medium text-red-700">
                  {error}
                </Text>
              ) : meta ? (
                <>
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    {meta.batch_name}
                    {meta.is_ad_hoc ? (
                      <Text className="text-amber-600"> · ad-hoc</Text>
                    ) : null}
                  </Text>
                  <Text className="mt-1 text-xl font-extrabold text-slate-900">
                    {meta.subject_name ?? "Class"}
                  </Text>
                  <Text className="text-sm font-medium text-slate-500 mt-0.5">
                    {formatTimeRange(meta.scheduled_start, meta.scheduled_end)}
                  </Text>

                  <View className="mt-4 flex-row">
                    <CountChip label="Present" value={counts.present} tone="bg-emerald-50 text-emerald-700" />
                    <CountChip label="Late" value={counts.late} tone="bg-amber-50 text-amber-700" />
                    <CountChip label="Absent" value={counts.absent} tone="bg-red-50 text-red-700" />
                    <CountChip label="Pending" value={counts.unmarked} tone="bg-slate-100 text-slate-600" />
                  </View>

                  <View className="mt-4 flex-row">
                    <TouchableOpacity
                      onPress={() => onBulk("present")}
                      disabled={counts.unmarked === 0}
                      className={`flex-1 mr-2 rounded-2xl py-2.5 items-center ${
                        counts.unmarked === 0 ? "bg-slate-200" : "bg-emerald-600"
                      }`}
                      activeOpacity={0.85}
                    >
                      <Text className="text-white font-bold text-xs">
                        All Present
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onBulk("absent")}
                      disabled={counts.unmarked === 0}
                      className={`flex-1 ml-2 rounded-2xl py-2.5 items-center ${
                        counts.unmarked === 0 ? "bg-slate-200" : "bg-red-600"
                      }`}
                      activeOpacity={0.85}
                    >
                      <Text className="text-white font-bold text-xs">
                        All Absent
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>

            <View className="px-6 pb-2 flex-row items-end justify-between">
              <Text className="text-lg font-bold text-slate-900">Students</Text>
              <Text className="text-xs font-medium text-slate-500">
                Long-press a row to change
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <View className="mx-6 mt-2 bg-white rounded-3xl border border-slate-100 p-6 items-center">
              <Users size={32} color="#94a3b8" />
              <Text className="mt-3 text-sm font-bold text-slate-900 text-center">
                No students in this batch yet
              </Text>
            </View>
          ) : null
        }
      />

      <CorrectionSheet
        target={correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        onSubmitted={refresh}
      />
    </SafeAreaView>
  );
}

function CountChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const [bg, text] = tone.split(" ");
  return (
    <View className={`flex-1 mx-1 rounded-xl ${bg} py-2 items-center`}>
      <Text className={`text-base font-extrabold ${text}`}>{value}</Text>
      <Text className={`text-[10px] font-semibold uppercase ${text}`}>
        {label}
      </Text>
    </View>
  );
}

function CorrectionSheet({
  target,
  onClose,
  onSubmitted,
}: {
  target: CorrectionTarget | null;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
}): React.ReactElement {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = target !== null;
  const studentName = target?.student.full_name ?? "";
  const currentStatus = target?.student.status ?? null;
  const attendanceId = target?.student.attendance_id ?? null;

  const reset = useCallback(() => {
    setStatus(target?.preselectStatus ?? null);
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [target]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = useCallback(async () => {
    if (!attendanceId || !status) {
      setError("Pick a new status.");
      return;
    }
    if (status === currentStatus) {
      setError("New status must differ from the current one.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Add a short reason (3+ characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await withTimeout(
        supabase.functions.invoke<{ error?: string }>("attendance-correct", {
          body: {
            attendance_id: attendanceId,
            new_status: status,
            reason: reason.trim(),
          },
        }),
      );
      if (invokeErr) {
        setError(data?.error ?? "Server rejected the correction.");
        setSubmitting(false);
        return;
      }
      await onSubmitted();
      onClose();
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Try again.");
      setSubmitting(false);
    }
  }, [attendanceId, status, currentStatus, reason, onSubmitted, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={reset}
    >
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-[28px] px-6 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-lg font-extrabold text-slate-900 flex-1 mr-3"
              numberOfLines={1}
            >
              Change status — {studentName}
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityLabel="Close">
              <X size={22} color="#475569" />
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-slate-500 mb-4">
            Current: {currentStatus ?? "unmarked"}
          </Text>

          <Text className="text-[11px] font-bold uppercase text-slate-500 mb-2">
            New status
          </Text>
          <View className="flex-row mb-4">
            {(["present", "late", "absent"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s)}
                className={`flex-1 mx-1 rounded-2xl py-3 items-center border ${
                  status === s
                    ? s === "present"
                      ? "bg-emerald-600 border-emerald-600"
                      : s === "late"
                        ? "bg-amber-500 border-amber-500"
                        : "bg-red-600 border-red-600"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    status === s ? "text-white" : "text-slate-700"
                  }`}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-[11px] font-bold uppercase text-slate-500 mb-2">
            Reason
          </Text>
          <View className="flex-row flex-wrap mb-3">
            {REASON_PRESETS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(r)}
                className={`px-3 py-1.5 rounded-full mr-2 mb-2 border ${
                  reason === r
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    reason === r ? "text-white" : "text-slate-700"
                  }`}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Type a reason"
            className="border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white"
            maxLength={500}
          />

          {error ? (
            <Text className="text-red-600 text-xs mt-3">{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`mt-5 rounded-2xl py-3.5 items-center justify-center ${
              submitting ? "bg-slate-300" : "bg-blue-600"
            }`}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-sm">Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
