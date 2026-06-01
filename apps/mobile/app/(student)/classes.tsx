import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, CalendarDays, ChevronRight, ClipboardCheck, Play, Radio, Video } from "lucide-react-native";
import { FyneStudyLogo } from "../../components/FyneStudyLogo";
import { Skeleton } from "../../components/ui/skeleton";
import { useStudentSchedule, type ScheduleSession } from "@/features/dashboard/useStudentSchedule";
import { useStudentExams } from "@/features/exam/useStudentExams";
import { sessionDisplayName } from "@/lib/session-name";

type Seg = "live" | "upcoming" | "recorded";

const SEG_LABELS: Record<Seg, string> = { live: "Live", upcoming: "Upcoming", recorded: "Recorded" };

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const thatIst = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (thatIst === todayIst) return `Today · ${time}`;
  const day = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
  return `${day} · ${time}`;
}

function attBadge(s: ScheduleSession): { label: string; bg: string; text: string } | null {
  if (s.attendance_status === "present") return { label: "Present", bg: "bg-emerald-50", text: "text-emerald-700" };
  if (s.attendance_status === "late") return { label: "Late", bg: "bg-amber-50", text: "text-amber-700" };
  if (s.attendance_status === "absent") return { label: "Absent", bg: "bg-red-50", text: "text-red-700" };
  return null;
}

function SessionRow({ s, onPress }: { s: ScheduleSession; onPress: () => void }) {
  const isLive = s.status === "live";
  const isRecording = s.status === "ended" && s.is_live_class && !!s.yt_video_id;
  const badge = attBadge(s);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
    >
      <View
        className={`w-12 h-12 rounded-2xl items-center justify-center mr-3 ${
          isLive ? "bg-red-50" : isRecording ? "bg-violet-50" : "bg-blue-50"
        }`}
      >
        {isLive ? (
          <Radio size={20} color="#dc2626" />
        ) : isRecording ? (
          <Video size={20} color="#7c3aed" />
        ) : (
          <CalendarDays size={20} color="#2563EB" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
          {sessionDisplayName(s.title, s.subject_name)}
        </Text>
        <Text className="text-[11px] text-slate-500 mt-1">{fmtWhen(s.scheduled_start)}</Text>
      </View>
      {isLive ? (
        <View className="bg-red-100 px-2 py-1 rounded-md flex-row items-center">
          <View className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" />
          <Text className="text-red-600 text-[11px] font-bold">Live</Text>
        </View>
      ) : isRecording ? (
        <View className="bg-violet-100 px-2 py-1 rounded-md flex-row items-center">
          <Play size={11} color="#7c3aed" />
          <Text className="text-violet-700 text-[11px] font-bold ml-1">Watch</Text>
        </View>
      ) : badge ? (
        <View className={`${badge.bg} px-2 py-1 rounded-md`}>
          <Text className={`${badge.text} text-[11px] font-bold`}>{badge.label}</Text>
        </View>
      ) : (
        <ChevronRight size={18} color="#94a3b8" />
      )}
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="text-lg font-bold text-blue-900 mb-3">{children}</Text>;
}

export default function ClassesScreen() {
  const router = useRouter();
  const schedule = useStudentSchedule();
  const exams = useStudentExams();
  const [seg, setSeg] = useState<Seg>("live");

  // Depend on the STABLE reload fns (each is useCallback-memoized inside its
  // hook), never on the whole `schedule`/`exams` objects — those are fresh
  // literals every render, so using them as deps changes `onRefresh`'s identity
  // each render, which makes useFocusEffect re-run after every render →
  // reload → setState → re-render → loop (the up/down flicker on this screen).
  const reloadSchedule = schedule.reload;
  const reloadExams = exams.reload;
  const onRefresh = useCallback(() => {
    void reloadSchedule();
    void reloadExams();
  }, [reloadSchedule, reloadExams]);

  useFocusEffect(useCallback(() => { onRefresh(); }, [onRefresh]));

  const live = useMemo(
    () => schedule.sessions.filter((s) => s.status === "live"),
    [schedule.sessions],
  );
  const upcoming = useMemo(
    () => schedule.sessions.filter((s) => s.bucket === "upcoming"),
    [schedule.sessions],
  );
  const recorded = useMemo(
    () =>
      schedule.sessions
        .filter((s) => s.status === "ended" && s.is_live_class && !!s.yt_video_id)
        .reverse(),
    [schedule.sessions],
  );

  const counts: Record<Seg, number> = {
    live: live.length,
    upcoming: upcoming.length,
    recorded: recorded.length,
  };
  const list = seg === "live" ? live : seg === "upcoming" ? upcoming : recorded;
  const loading = schedule.isLoading && schedule.sessions.length === 0;

  const press = useCallback(
    (s: ScheduleSession) => {
      if (s.status === "live") router.push(`/live/${s.id}` as never);
      else if (s.status === "ended" && s.is_live_class && s.yt_video_id) {
        router.push(`/recording/${s.id}` as never);
      } else if (s.is_live_class) router.push(`/live/${s.id}` as never);
      else router.push("/attendance");
    },
    [router],
  );

  const emptyHint =
    seg === "live"
      ? "No classes are live right now."
      : seg === "upcoming"
        ? "No upcoming classes in the next two weeks."
        : "No recordings available yet.";

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
          <Video size={18} color="#1e3a8a" />
        </View>
        <FyneStudyLogo variant="header" />
        <TouchableOpacity className="w-10 h-10 items-end justify-center">
          <Bell size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={schedule.isLoading || exams.isLoading} onRefresh={onRefresh} tintColor="#2563EB" />
        }
      >
        <View className="px-6 mt-4 mb-5">
          <Text className="text-3xl font-extrabold text-blue-800 tracking-tight mb-1">My Classes</Text>
          <Text className="text-sm text-slate-500 leading-5">Live sessions, recordings and graded exams.</Text>
        </View>

        <View className="px-6 mb-4">
          <View className="flex-row bg-white rounded-2xl border border-slate-100 p-1">
            {(Object.keys(SEG_LABELS) as Seg[]).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setSeg(g)}
                className={`flex-1 rounded-xl py-2 items-center ${seg === g ? "bg-blue-600" : ""}`}
                activeOpacity={0.85}
              >
                <Text className={`text-xs font-bold ${seg === g ? "text-white" : "text-slate-600"}`}>
                  {SEG_LABELS[g]}
                  <Text className={`${seg === g ? "text-white/80" : "text-slate-400"} font-medium`}>
                    {"  "}
                    {counts[g]}
                  </Text>
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View className="px-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={72} borderRadius={16} style={{ marginBottom: 8 }} />
            ))}
          </View>
        ) : (
          <View className="px-6">
            {schedule.error ? (
              <View className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4">
                <Text className="text-sm font-medium text-red-700">{schedule.error}</Text>
              </View>
            ) : null}

            <View className="mb-6">
              {list.length === 0 ? (
                <View className="bg-white rounded-2xl p-5 border border-slate-100">
                  <Text className="text-sm text-slate-500">{emptyHint}</Text>
                </View>
              ) : (
                list.map((s) => <SessionRow key={s.id} s={s} onPress={() => press(s)} />)
              )}
            </View>

            <View className="mb-6">
              <SectionTitle>Exams</SectionTitle>
              {exams.rows.length === 0 ? (
                <View className="bg-white rounded-2xl p-5 border border-slate-100">
                  <Text className="text-sm text-slate-500">No exams published for your batch yet.</Text>
                </View>
              ) : (
                exams.rows.slice(0, 10).map((e) => {
                  const now = Date.now();
                  const start = new Date(e.starts_at).getTime();
                  const end = start + e.duration_min * 60_000;
                  const liveNow = now >= start && now < end;
                  const ended = now >= end;
                  const released = !!e.results_released_at;
                  const status = e.attempt?.submitted_at
                    ? released || e.result_release === "instant"
                      ? `Score ${e.attempt.score !== null ? Math.round(e.attempt.score) : "—"}/${e.attempt.max_score !== null ? Math.round(e.attempt.max_score) : "—"}`
                      : "Submitted · awaiting release"
                    : liveNow
                      ? "Live now"
                      : ended
                        ? "Ended"
                        : "Scheduled";
                  const color = liveNow ? "#dc2626" : released ? "#059669" : "#475569";
                  return (
                    <TouchableOpacity
                      key={e.id}
                      onPress={() => router.push(`/exam/${e.id}` as never)}
                      activeOpacity={0.85}
                      className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
                    >
                      <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center mr-3">
                        <ClipboardCheck size={20} color="#2563EB" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                          {e.title}
                        </Text>
                        <Text className="text-[11px] text-slate-500 mt-1">
                          {fmtWhen(e.starts_at)} · {e.duration_min} min
                        </Text>
                        <Text className="text-[11px] font-semibold mt-0.5" style={{ color }}>
                          {status}
                        </Text>
                      </View>
                      <ChevronRight size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
