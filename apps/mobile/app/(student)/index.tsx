import { useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Flame,
  QrCode,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react-native";
import { FyneStudyLogo } from "../../components/FyneStudyLogo";
import { Skeleton } from "../../components/ui/skeleton";
import { useSession } from "@/features/auth/useSession";
import {
  useTodaySessions,
  type TodaySession,
} from "@/features/attendance/useTodaySessions";
import { useAttendanceHistory } from "@/features/attendance/useAttendanceHistory";
import { useWeakTopics } from "@/features/quiz/useWeakTopics";

function greetingFor(date: Date): string {
  const hourIst = Number(
    date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }),
  );
  if (hourIst >= 5 && hourIst < 12) return "Good morning";
  if (hourIst >= 12 && hourIst < 17) return "Good afternoon";
  if (hourIst >= 17 && hourIst < 22) return "Good evening";
  return "Hi";
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.split(/\s+/)[0] ?? "there";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface BadgeStyle {
  label: string;
  bg: string;
  text: string;
  dot: string | null;
}

function sessionBadge(s: TodaySession): BadgeStyle {
  if (s.attendance_status === "present") {
    return { label: "Present", bg: "bg-emerald-50", text: "text-emerald-700", dot: null };
  }
  if (s.attendance_status === "late") {
    return { label: "Late", bg: "bg-amber-50", text: "text-amber-700", dot: null };
  }
  if (s.attendance_status === "absent") {
    return { label: "Absent", bg: "bg-red-50", text: "text-red-700", dot: null };
  }
  if (s.window === "open") {
    return { label: "Live Now", bg: "bg-red-100", text: "text-red-600", dot: "bg-red-500" };
  }
  if (s.window === "before") {
    return { label: "Upcoming", bg: "bg-slate-100", text: "text-slate-700", dot: null };
  }
  return { label: "Ended", bg: "bg-slate-100", text: "text-slate-500", dot: null };
}

export default function StudentHomeScreen() {
  const router = useRouter();
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
    refresh: refreshHistory,
  } = useAttendanceHistory();
  const weakTopics = useWeakTopics();

  const isLoading = sessionsLoading || historyLoading;
  const greeting = greetingFor(new Date());
  const name = firstName(appUser?.full_name);

  const sessionsCountLine = useMemo(() => {
    if (sessionsLoading) return "Checking today's schedule…";
    if (sessions.length === 0) return "You have no classes scheduled today.";
    if (sessions.length === 1) return "You have 1 class scheduled today.";
    return `You have ${sessions.length} classes scheduled today.`;
  }, [sessions.length, sessionsLoading]);

  const weekPct = useMemo(() => {
    if (!history || history.weekTotal === 0) return null;
    return Math.round((history.weekPresent / history.weekTotal) * 100);
  }, [history]);

  const monthPct = useMemo(() => {
    if (!history || history.monthTotal === 0) return null;
    return Math.round((history.monthPresent / history.monthTotal) * 100);
  }, [history]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              void refreshSessions();
              void refreshHistory();
              void weakTopics.reload();
            }}
            tintColor="#2563EB"
          />
        }
      >
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
            <Text className="text-xs font-bold text-blue-800">
              {(appUser?.full_name ?? "?")
                .split(/\s+/)
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "?"}
            </Text>
          </View>
          <FyneStudyLogo variant="header" />
          <TouchableOpacity className="w-10 h-10 items-end justify-center">
            <Bell size={24} color="#1e3a8a" />
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-4 mb-6">
          <Text className="text-3xl font-extrabold text-blue-800 tracking-tight">
            {greeting}, {name}.
          </Text>
          <Text className="text-base text-slate-500 mt-2">
            {sessionsCountLine}
          </Text>
        </View>

        <View className="px-6 mb-6">
          <View className="bg-white rounded-2xl p-4 border border-slate-100 flex-row items-center shadow-sm shadow-slate-200/40">
            <View className="w-10 h-10 rounded-2xl bg-amber-50 items-center justify-center mr-3">
              <Flame size={20} color="#d97706" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">0-day streak</Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                Daily login streak — full tracking lands in Phase 8.
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <View className="flex-row justify-between items-center px-6 mb-3">
            <Text className="text-xl font-bold text-blue-900">
              Today&apos;s Schedule
            </Text>
            <TouchableOpacity onPress={() => router.push("/attendance")}>
              <Text className="text-yellow-500 font-semibold">See all</Text>
            </TouchableOpacity>
          </View>

          {sessionsLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
              className="overflow-visible"
            >
              {[1, 2].map((i) => (
                <View
                  key={i}
                  className="bg-white rounded-[28px] p-5 mr-4 w-72 shadow-sm shadow-slate-200/50 border border-slate-100"
                >
                  <View className="flex-row justify-between items-start mb-4">
                    <Skeleton width={80} height={24} borderRadius={6} />
                    <Skeleton width={100} height={20} borderRadius={4} />
                  </View>
                  <Skeleton width="80%" height={24} borderRadius={6} />
                  <View className="mt-3">
                    <Skeleton width={140} height={16} borderRadius={4} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : sessionsError ? (
            <View className="mx-6 bg-red-50 border border-red-100 rounded-2xl p-4">
              <Text className="text-sm font-medium text-red-700">
                {sessionsError}
              </Text>
            </View>
          ) : sessions.length === 0 ? (
            <View className="mx-6 bg-white rounded-[28px] p-6 items-center border border-slate-100 shadow-sm shadow-slate-200/40">
              <Sparkles size={28} color="#94a3b8" />
              <Text className="mt-3 text-base font-bold text-slate-900 text-center">
                Nothing scheduled today
              </Text>
              <Text className="mt-1 text-xs text-slate-500 text-center leading-4">
                When your batch has a session today, it shows up here.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
              className="overflow-visible"
            >
              {sessions.map((s) => {
                const badge = sessionBadge(s);
                const canScanNow = s.window === "open" && s.attendance_status === null;
                return (
                  <View
                    key={s.id}
                    className="bg-white rounded-[28px] p-5 mr-4 w-72 shadow-sm shadow-slate-200/50 border border-slate-100"
                  >
                    <View className="flex-row justify-between items-start mb-4">
                      <View
                        className={`${badge.bg} px-2 py-1 rounded-md flex-row items-center`}
                      >
                        {badge.dot ? (
                          <View
                            className={`w-1.5 h-1.5 ${badge.dot} rounded-full mr-1.5`}
                          />
                        ) : null}
                        <Text className={`${badge.text} text-xs font-bold`}>
                          {badge.label}
                        </Text>
                      </View>
                      <Text className="text-slate-500 text-sm font-medium">
                        {formatTime(s.scheduled_start)} – {formatTime(s.scheduled_end)}
                      </Text>
                    </View>
                    <Text
                      className="text-lg font-bold text-slate-900 mb-1"
                      numberOfLines={1}
                    >
                      {s.subject_name ?? "Class"}
                      {s.is_ad_hoc ? (
                        <Text className="text-amber-600 text-xs"> · ad-hoc</Text>
                      ) : null}
                    </Text>
                    <View className="flex-row items-center mb-4">
                      <CalendarDays size={14} color="#64748b" style={{ marginRight: 4 }} />
                      <Text className="text-slate-500 text-sm font-medium">
                        {s.window === "open"
                          ? "Scan window open"
                          : s.window === "before"
                            ? "Opens 15 min before"
                            : "Window closed"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push("/attendance")}
                      className={`rounded-xl py-3 items-center flex-row justify-center ${
                        canScanNow ? "bg-blue-600" : "bg-slate-50"
                      }`}
                      activeOpacity={0.85}
                    >
                      <QrCode
                        size={16}
                        color={canScanNow ? "#fff" : "#1e3a8a"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        className={`font-semibold text-sm ${
                          canScanNow ? "text-white" : "text-blue-900"
                        }`}
                      >
                        {canScanNow ? "Show QR now" : "Open Attendance"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View className="px-6 mb-6">
          {historyLoading ? (
            <View className="bg-white rounded-[28px] p-6 shadow-sm shadow-slate-200/50 border border-slate-100">
              <Skeleton width={120} height={24} borderRadius={6} />
              <View className="mt-2">
                <Skeleton width={100} height={16} borderRadius={4} />
              </View>
              <View className="mt-6 flex-row items-baseline">
                <Skeleton width={90} height={48} borderRadius={8} />
                <View className="ml-4">
                  <Skeleton width={100} height={16} borderRadius={4} />
                </View>
              </View>
              <View className="mt-4">
                <Skeleton width="100%" height={8} borderRadius={4} />
              </View>
            </View>
          ) : (
            <View className="bg-white rounded-[28px] p-6 shadow-sm shadow-slate-200/50 border border-slate-100">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-lg font-bold text-blue-900">
                    Attendance
                  </Text>
                  <Text className="text-slate-500 text-sm mt-0.5">
                    Last 7 days
                  </Text>
                </View>
                <View className="w-10 h-10 bg-blue-50 rounded-2xl items-center justify-center">
                  <TrendingUp size={20} color="#1e3a8a" />
                </View>
              </View>

              {history && history.weekTotal > 0 ? (
                <>
                  <View className="flex-row items-baseline mb-3">
                    <Text className="text-5xl font-extrabold text-blue-800 tracking-tight">
                      {weekPct}%
                    </Text>
                    <Text className="text-sm text-slate-500 ml-3">
                      {history.weekPresent}/{history.weekTotal} marked
                    </Text>
                  </View>
                  <View className="h-2 bg-slate-100 rounded-full mb-5 flex-row overflow-hidden">
                    <View
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${weekPct ?? 0}%` }}
                    />
                  </View>
                </>
              ) : (
                <View className="mb-5">
                  <Text className="text-2xl font-extrabold text-slate-400 tracking-tight">
                    No data yet
                  </Text>
                  <Text className="text-sm text-slate-500 mt-1">
                    Attendance % shows up once you&apos;ve been marked for at least one session.
                  </Text>
                </View>
              )}

              {monthPct !== null && history ? (
                <Text className="text-xs text-slate-500 mb-4">
                  Last 30 days: {monthPct}% ({history.monthPresent}/{history.monthTotal})
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={() => router.push("/attendance")}
                className="bg-slate-50 rounded-xl py-3.5 flex-row items-center justify-center"
                activeOpacity={0.85}
              >
                <QrCode size={18} color="#1e3a8a" style={{ marginRight: 8 }} />
                <Text className="text-blue-900 font-semibold text-base">
                  Open Attendance
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {weakTopics.rows.length > 0 ? (
          <View className="px-6 mb-6">
            <View className="flex-row items-center mb-3">
              <Target size={20} color="#1e3a8a" />
              <Text className="text-xl font-bold text-blue-900 ml-2 flex-1">
                Weak topics
              </Text>
            </View>
            <Text className="text-xs text-slate-500 mb-3 leading-4">
              Topics you've scored under 70% on. Take a practice quiz to bring it up.
            </Text>
            {weakTopics.rows.map((w) => (
              <TouchableOpacity
                key={w.topic_id}
                onPress={() => router.push(`/quiz/${w.suggested_quiz_id}` as never)}
                className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
                activeOpacity={0.85}
              >
                <View className="w-12 h-12 rounded-2xl bg-amber-50 items-center justify-center mr-3">
                  <Text className="text-amber-700 font-extrabold text-sm">
                    {w.avg_pct}%
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                    {w.topic_name}
                  </Text>
                  <Text className="text-[11px] text-slate-500 mt-1" numberOfLines={1}>
                    Suggested: {w.suggested_quiz_title} · {w.attempts} attempt{w.attempts === 1 ? "" : "s"}
                  </Text>
                </View>
                <ChevronRight size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View className="px-6 mb-8">
          <View className="bg-white rounded-2xl p-5 border border-slate-100">
            <Text className="text-base font-bold text-blue-900">
              More coming soon
            </Text>
            <Text className="text-xs text-slate-500 mt-1 leading-4">
              Mastery, course progress, leaderboard, and announcements arrive in
              Phase 7–8. You can already attempt practice quizzes, manage attendance,
              and update your profile.
            </Text>
          </View>
        </View>

        {appUser?.is_active === false ? (
          <View className="px-6 mb-8">
            <View className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <Text className="text-sm font-bold text-red-700">
                Account suspended
              </Text>
              <Text className="text-xs text-red-600 mt-1">
                Please contact your admin.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
