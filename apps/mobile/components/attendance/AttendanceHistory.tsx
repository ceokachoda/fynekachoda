import { View, Text } from "react-native";
import { CheckCircle2, Clock, XCircle } from "lucide-react-native";
import type { AttendanceRow } from "@/features/attendance/useAttendanceHistory";
import { sessionDisplayName } from "@/lib/session-name";

interface Props {
  rows: AttendanceRow[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(iso: string | null, fallback: string): string {
  const ref = iso ?? fallback;
  const d = new Date(ref);
  const todayIst = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  const refIst = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (refIst === todayIst) return "Today";
  const yesterdayIst = new Date(
    new Date(`${todayIst}T00:00:00+05:30`).getTime() - 24 * 60 * 60 * 1000,
  ).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (refIst === yesterdayIst) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function statusIcon(status: AttendanceRow["status"]): React.ReactElement {
  switch (status) {
    case "present":
      return <CheckCircle2 size={22} color="#10b981" />;
    case "late":
      return <Clock size={22} color="#f59e0b" />;
    case "absent":
      return <XCircle size={22} color="#ef4444" />;
  }
}

function statusLabel(status: AttendanceRow["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AttendanceHistory({ rows }: Props): React.ReactElement {
  if (rows.length === 0) {
    return (
      <View className="py-6 items-center">
        <Text className="text-slate-500 text-sm">
          No attendance records yet.
        </Text>
      </View>
    );
  }
  const visible = rows.slice(0, 5);
  return (
    <View>
      {visible.map((r, idx) => (
        <View
          key={r.id}
          className={`flex-row items-center py-3 ${
            idx < visible.length - 1 ? "border-b border-slate-100" : ""
          }`}
        >
          <View className="mr-3">{statusIcon(r.status)}</View>
          <View className="flex-1">
            <Text className="font-semibold text-slate-900 text-sm">
              {sessionDisplayName(r.title, r.subject_name)}
            </Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              {formatDayLabel(r.scheduled_start, r.marked_at)} ·{" "}
              {formatTime(r.scheduled_start ?? r.marked_at)}
            </Text>
          </View>
          <View className="items-end">
            <Text
              className={`text-xs font-bold ${
                r.status === "present"
                  ? "text-emerald-600"
                  : r.status === "late"
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {statusLabel(r.status)}
            </Text>
            <Text className="text-[10px] text-slate-400 mt-0.5 uppercase">
              {r.method}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
