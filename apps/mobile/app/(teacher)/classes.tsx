import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  Camera,
  ListChecks,
  Plus,
  Radio,
  Sparkles,
  Video,
} from "lucide-react-native";
import {
  useTeacherSessionsByBucket,
  type SessionBucket,
  type TeacherSession,
} from "@/features/attendance/useTeacherSessions";
import { useAssignedBatches } from "@/features/org/useAssignedBatches";
import { AdhocSheet } from "@/components/teacher/AdhocSheet";
import { ScheduleLiveSheet } from "@/components/teacher/ScheduleLiveSheet";
import { sessionDisplayName } from "@/lib/session-name";

const BUCKET_LABELS: Record<SessionBucket, string> = {
  today: "Today",
  upcoming: "Upcoming",
  past: "Past",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function statusPill(s: TeacherSession): { label: string; classes: string } {
  if (s.status === "live") return { label: "Live", classes: "bg-red-50 text-red-700" };
  if (s.status === "ended") return { label: "Ended", classes: "bg-slate-100 text-slate-600" };
  if (s.status === "cancelled") return { label: "Cancelled", classes: "bg-slate-100 text-slate-400" };
  return { label: "Scheduled", classes: "bg-blue-50 text-blue-700" };
}

export default function TeacherClassesScreen(): React.ReactElement {
  const router = useRouter();
  const [bucket, setBucket] = useState<SessionBucket>("today");
  const [showAdhoc, setShowAdhoc] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const { buckets, isLoading, error, refresh } = useTeacherSessionsByBucket();
  const { data: assignedBatches } = useAssignedBatches();

  const list = useMemo(() => buckets[bucket], [buckets, bucket]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        removeClippedSubviews
        windowSize={9}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor="#2563EB"
          />
        }
        ListHeaderComponent={
          <View>
            <View className="px-6 pt-2 pb-3">
              <Text className="text-sm font-medium text-slate-500">Classes</Text>
              <Text className="text-2xl font-extrabold text-slate-900 mt-0.5">
                Your schedule
              </Text>
            </View>

            <View className="px-6 mb-2 flex-row bg-white rounded-2xl border border-slate-100 p-1 mx-6">
              {(Object.keys(BUCKET_LABELS) as SessionBucket[]).map((b) => (
                <TouchableOpacity
                  key={b}
                  onPress={() => setBucket(b)}
                  className={`flex-1 rounded-xl py-2 items-center ${
                    bucket === b ? "bg-blue-600" : ""
                  }`}
                  activeOpacity={0.85}
                >
                  <Text
                    className={`text-xs font-bold ${
                      bucket === b ? "text-white" : "text-slate-600"
                    }`}
                  >
                    {BUCKET_LABELS[b]}
                    <Text
                      className={`${
                        bucket === b ? "text-white/80" : "text-slate-400"
                      } font-medium`}
                    >
                      {"  "}
                      {buckets[b].length}
                    </Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? (
              <View className="mx-6 mt-3 rounded-2xl bg-red-50 border border-red-100 p-4">
                <Text className="text-sm font-medium text-red-700">{error}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: s }) => (
          <ClassRow
            session={s}
            onScan={() =>
              router.push({
                pathname: "/(teacher)/scan",
                params: { sessionId: s.id },
              })
            }
            onRoster={() =>
              router.push({
                pathname: "/roster/[sessionId]",
                params: { sessionId: s.id },
              })
            }
            onLiveControl={() => router.push(`/live-control/${s.id}` as never)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View className="px-6 py-10 items-center">
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : (
            <View
              style={{
                marginHorizontal: 24,
                marginTop: 16,
                backgroundColor: "#ffffff",
                borderRadius: 24,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#f1f5f9",
              }}
            >
              <Sparkles size={28} color="#94a3b8" />
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#0f172a",
                  textAlign: "center",
                }}
              >
                {bucket === "today"
                  ? "No classes scheduled today"
                  : bucket === "upcoming"
                    ? "Nothing on the calendar yet"
                    : "No recent classes"}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#64748b",
                  textAlign: "center",
                  lineHeight: 16,
                }}
              >
                {bucket === "past"
                  ? "Past classes from the last 30 days will appear here."
                  : "Tap + to create an ad-hoc class."}
              </Text>
            </View>
          )
        }
      />

      <TouchableOpacity
        onPress={() => setShowSchedule(true)}
        className="absolute right-5 bottom-24 bg-red-600 rounded-full w-14 h-14 items-center justify-center shadow-lg shadow-red-600/40"
        activeOpacity={0.85}
        accessibilityLabel="Schedule live class"
      >
        <Radio size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowAdhoc(true)}
        className="absolute right-5 bottom-6 bg-blue-600 rounded-full w-14 h-14 items-center justify-center shadow-lg shadow-blue-600/40"
        activeOpacity={0.85}
        accessibilityLabel="New ad-hoc class"
      >
        <Plus size={26} color="#fff" />
      </TouchableOpacity>

      <AdhocSheet
        visible={showAdhoc}
        onClose={() => setShowAdhoc(false)}
        batches={assignedBatches ?? []}
        onCreated={(sessionId) => {
          void refresh();
          router.push({
            pathname: "/roster/[sessionId]",
            params: { sessionId },
          });
        }}
      />

      <ScheduleLiveSheet
        visible={showSchedule}
        onClose={() => setShowSchedule(false)}
        batches={assignedBatches ?? []}
        onCreated={(sessionId) => {
          void refresh();
          router.push(`/live-control/${sessionId}` as never);
        }}
      />
    </SafeAreaView>
  );
}

function ClassRow({
  session,
  onScan,
  onRoster,
  onLiveControl,
}: {
  session: TeacherSession;
  onScan: () => void;
  onRoster: () => void;
  onLiveControl: () => void;
}): React.ReactElement {
  const pill = statusPill(session);
  const [bg, text] = pill.classes.split(" ");
  return (
    <View className="mx-6 mt-3 bg-white rounded-3xl border border-slate-100 p-4">
      <View className="flex-row items-start">
        <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center mr-3">
          {session.is_live_class ? (
            <Video size={18} color="#2563eb" />
          ) : (
            <CalendarDays size={18} color="#2563eb" />
          )}
        </View>
        <View className="flex-1">
          <Text
            className="text-sm font-extrabold text-slate-900"
            numberOfLines={1}
          >
            {sessionDisplayName(session.title, session.subject_name)}
            {session.is_ad_hoc ? (
              <Text className="text-amber-600 text-xs"> · ad-hoc</Text>
            ) : null}
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {session.batch_name} · {session.course_code}
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {formatDay(session.scheduled_start)} ·{" "}
            {formatTime(session.scheduled_start)} –{" "}
            {formatTime(session.scheduled_end)}
          </Text>
        </View>
        <View className={`px-2.5 py-1 rounded-md ${bg}`}>
          <Text className={`text-[10px] font-bold ${text}`}>{pill.label}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center">
        <Text className="text-xs text-slate-500 flex-1">
          {session.attendance_count} / {session.batch_student_count} marked
        </Text>
        {session.is_live_class ? (
          <TouchableOpacity
            onPress={onLiveControl}
            className="mr-2 flex-row items-center bg-red-50 rounded-xl px-3 py-1.5"
            activeOpacity={0.85}
          >
            <Radio size={14} color="#dc2626" />
            <Text className="ml-1 text-red-700 font-bold text-xs">
              {session.status === "live" ? "Live control" : "Go live"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onScan}
            className="mr-2 flex-row items-center bg-blue-50 rounded-xl px-3 py-1.5"
            activeOpacity={0.85}
          >
            <Camera size={14} color="#2563eb" />
            <Text className="ml-1 text-blue-700 font-bold text-xs">Scan</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onRoster}
          className="flex-row items-center bg-slate-100 rounded-xl px-3 py-1.5"
          activeOpacity={0.85}
        >
          <ListChecks size={14} color="#0f172a" />
          <Text className="ml-1 text-slate-900 font-bold text-xs">Roster</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
