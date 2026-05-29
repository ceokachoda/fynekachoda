import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Bell, CalendarDays, History } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FyneStudyLogo } from "@/components/FyneStudyLogo";
import { QrDisplay } from "@/components/attendance/QrDisplay";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { AttendanceRing } from "@/components/attendance/AttendanceRing";
import {
  useTodaySessions,
  type TodaySession,
} from "@/features/attendance/useTodaySessions";
import { useAttendanceHistory } from "@/features/attendance/useAttendanceHistory";
import { useAttendanceRealtime } from "@/features/attendance/useAttendanceRealtime";
import { useSession } from "@/features/auth/useSession";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialsOf(name: string | null | undefined): string {
  return (
    (name ?? "?")
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function statusBadge(s: TodaySession): {
  label: string;
  classes: string;
} {
  if (s.attendance_status === "present") {
    return { label: "Present", classes: "bg-emerald-50 text-emerald-700" };
  }
  if (s.attendance_status === "late") {
    return { label: "Late", classes: "bg-amber-50 text-amber-700" };
  }
  if (s.attendance_status === "absent") {
    return { label: "Absent", classes: "bg-red-50 text-red-700" };
  }
  if (s.window === "open") {
    return { label: "Scan now", classes: "bg-blue-50 text-blue-700" };
  }
  if (s.window === "before") {
    return { label: "Upcoming", classes: "bg-slate-100 text-slate-600" };
  }
  return { label: "Closed", classes: "bg-slate-100 text-slate-500" };
}

export default function AttendanceScreen(): React.ReactElement {
  const { appUser } = useSession();
  const {
    sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    refresh: refreshSessions,
  } = useTodaySessions();
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
  } = useAttendanceHistory();

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSessions(), refreshHistory()]);
  }, [refreshSessions, refreshHistory]);

  useAttendanceRealtime(() => {
    void refreshAll();
  });

  const eligibleSessions = useMemo(
    () =>
      sessions.filter(
        (s) => s.window === "open" && s.attendance_status === null,
      ),
    [sessions],
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSessionId =
    selectedSessionId ?? eligibleSessions[0]?.id ?? null;
  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) ?? null
    : null;

  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
          <Text className="text-xs font-bold text-blue-800">
            {initialsOf(appUser?.full_name)}
          </Text>
        </View>
        <FyneStudyLogo variant="header" />
        <TouchableOpacity className="w-10 h-10 items-end justify-center">
          <Bell size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />
        }
      >
        <View className="mt-4 mb-6 px-6 items-center">
          <Text className="text-3xl font-extrabold text-blue-700 tracking-tight">
            Attendance
          </Text>
          <Text className="text-base text-slate-500 mt-1">
            Show your QR to the teacher
          </Text>
        </View>

        {activeSession ? (
          <View className="px-6 mb-6">
            <QrDisplay
              sessionId={activeSession.id}
              sessionLabel={
                (activeSession.subject_name ?? "Class") +
                " · " +
                formatTime(activeSession.scheduled_start)
              }
            />
            {eligibleSessions.length > 1 ? (
              <View className="flex-row flex-wrap mt-3">
                {eligibleSessions.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    className={`px-3 py-1.5 rounded-full mr-2 mb-2 border ${
                      s.id === activeSessionId
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-slate-200"
                    }`}
                    onPress={() => setSelectedSessionId(s.id)}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        s.id === activeSessionId ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {(s.subject_name ?? "Class") +
                        " · " +
                        formatTime(s.scheduled_start)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="mb-6">
          <View className="flex-row items-center px-6 mb-3">
            <CalendarDays size={20} color="#2563eb" style={{ marginRight: 8 }} />
            <Text className="text-lg font-bold text-slate-900">
              Today&apos;s classes
            </Text>
          </View>
          <View className="mx-6 bg-white rounded-[24px] border border-slate-100 shadow-sm shadow-slate-200/40">
            {sessionsLoading ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#2563eb" />
              </View>
            ) : sessionsError ? (
              <Text className="text-red-600 text-sm p-5">{sessionsError}</Text>
            ) : sessions.length === 0 ? (
              <Text className="text-slate-500 text-sm p-5 text-center">
                No classes scheduled today.
              </Text>
            ) : (
              sessions.map((s, idx) => {
                const badge = statusBadge(s);
                const isActive = s.id === activeSessionId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelectedSessionId(s.id)}
                    className={`flex-row items-center px-5 py-4 ${
                      idx < sessions.length - 1 ? "border-b border-slate-100" : ""
                    } ${isActive ? "bg-blue-50/40" : ""}`}
                  >
                    <View className="flex-1">
                      <Text className="font-bold text-slate-900 text-sm">
                        {s.subject_name ?? "Class"}
                        {s.is_ad_hoc ? (
                          <Text className="text-[10px] font-semibold text-amber-600">
                            {" "}
                            · ad-hoc
                          </Text>
                        ) : null}
                      </Text>
                      <Text className="text-xs text-slate-500 mt-0.5">
                        {formatTime(s.scheduled_start)} –{" "}
                        {formatTime(s.scheduled_end)}
                      </Text>
                    </View>
                    <View className={`px-2.5 py-1 rounded-md ${badge.classes.split(" ")[0]}`}>
                      <Text className={`text-[11px] font-bold ${badge.classes.split(" ")[1]}`}>
                        {badge.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        <View className="px-6 mb-6">
          <View className="flex-row items-center mb-3">
            <History size={20} color="#475569" style={{ marginRight: 8 }} />
            <Text className="text-lg font-bold text-slate-900">My history</Text>
          </View>
          <View className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm shadow-slate-200/40">
            {historyLoading ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#2563eb" />
              </View>
            ) : historyError ? (
              <Text className="text-red-600 text-sm">{historyError}</Text>
            ) : history ? (
              <>
                <View className="flex-row mb-4">
                  <AttendanceRing
                    label="This week"
                    present={history.weekPresent}
                    total={history.weekTotal}
                  />
                  <AttendanceRing
                    label="Last 30 days"
                    present={history.monthPresent}
                    total={history.monthTotal}
                  />
                </View>
                <View className="border-t border-slate-100 pt-2">
                  <AttendanceHistory rows={history.recent} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
