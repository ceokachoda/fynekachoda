import { memo } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { FileText, ShieldAlert, StickyNote } from "lucide-react-native";
import type { AtRiskStudent } from "@/features/dashboard/useTeacherBatchOverview";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Send-report / write-note land in Phase 11; they are disabled placeholders here.
function DisabledChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <TouchableOpacity
      onPress={() => Alert.alert(`${label}`, "This action arrives in Phase 11.")}
      activeOpacity={0.7}
      className="flex-row items-center bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 mr-2"
    >
      {icon}
      <Text className="text-[11px] font-semibold text-slate-400 ml-1">{label}</Text>
    </TouchableOpacity>
  );
}

export const AtRiskList = memo(function AtRiskList({ students }: { students: AtRiskStudent[] }) {
  if (students.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-6 border border-slate-100 items-center">
        <ShieldAlert size={28} color="#10b981" />
        <Text className="text-sm font-bold text-slate-900 mt-3 text-center">No students at risk</Text>
        <Text className="text-xs text-slate-500 mt-1 text-center leading-4">
          Everyone&apos;s composite score is at or above 0.40.
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text className="text-xs text-slate-500 mb-3">
        Composite score below 0.40 — blends quiz/exam (60%), activity (25%) and streak (15%).
      </Text>
      {students.map((s) => (
        <View key={s.student_id} className="bg-white rounded-2xl p-4 border border-slate-100 mb-2">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center mr-3">
              <Text className="text-xs font-bold text-red-600">{initials(s.full_name)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                {s.full_name}
              </Text>
              <Text className="text-[11px] text-slate-500 mt-0.5">
                Mastery {s.avg_mastery === null ? "—" : `${s.avg_mastery}%`} · Attendance{" "}
                {s.attendance_pct === null ? "—" : `${s.attendance_pct}%`}
              </Text>
            </View>
            <View className="bg-red-50 rounded-xl px-2.5 py-1.5 items-center ml-2">
              <Text className="text-sm font-extrabold text-red-600">{s.composite.toFixed(2)}</Text>
              <Text className="text-[9px] font-semibold text-red-400 uppercase tracking-wide">composite</Text>
            </View>
          </View>
          <View className="flex-row mt-3">
            <DisabledChip icon={<FileText size={13} color="#94a3b8" />} label="Send report" />
            <DisabledChip icon={<StickyNote size={13} color="#94a3b8" />} label="Note" />
          </View>
        </View>
      ))}
    </View>
  );
});
