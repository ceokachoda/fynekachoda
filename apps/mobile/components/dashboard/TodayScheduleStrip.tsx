import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import type { TodayItem, TodayStatus } from "@/features/dashboard/types";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function badgeFor(status: TodayStatus): {
  label: string;
  bg: string;
  text: string;
  dot: boolean;
} {
  switch (status) {
    case "present":
      return { label: "Present", bg: "bg-emerald-50", text: "text-emerald-700", dot: false };
    case "late":
      return { label: "Late", bg: "bg-amber-50", text: "text-amber-700", dot: false };
    case "absent":
      return { label: "Absent", bg: "bg-red-50", text: "text-red-700", dot: false };
    case "live":
      return { label: "Live", bg: "bg-red-100", text: "text-red-600", dot: true };
    case "missed":
      return { label: "Missed", bg: "bg-slate-100", text: "text-slate-500", dot: false };
    case "cancelled":
      return { label: "Cancelled", bg: "bg-slate-100", text: "text-slate-400", dot: false };
    default:
      return { label: "Upcoming", bg: "bg-slate-100", text: "text-slate-700", dot: false };
  }
}

export const TodayScheduleStrip = memo(function TodayScheduleStrip({
  items,
}: {
  items: TodayItem[];
}) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-5 border border-slate-100 flex-row items-center">
        <CalendarDays size={20} color="#94a3b8" />
        <Text className="text-sm text-slate-500 ml-3 flex-1">
          Nothing scheduled today.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {items.map((s) => {
        const b = badgeFor(s.status);
        return (
          <TouchableOpacity
            key={s.session_id}
            onPress={() => router.push("/attendance")}
            activeOpacity={0.85}
            className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
          >
            <View className="w-14">
              <Text className="text-sm font-bold text-slate-900">
                {fmtTime(s.start)}
              </Text>
              <Text className="text-[11px] text-slate-400">{fmtTime(s.end)}</Text>
            </View>
            <Text
              className="flex-1 text-sm font-semibold text-slate-800 ml-2"
              numberOfLines={1}
            >
              {s.subject}
            </Text>
            <View className={`${b.bg} px-2 py-1 rounded-md flex-row items-center`}>
              {b.dot ? <View className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" /> : null}
              <Text className={`${b.text} text-[11px] font-bold`}>{b.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
