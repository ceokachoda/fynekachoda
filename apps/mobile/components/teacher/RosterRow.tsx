import { View, Text, TouchableOpacity, Pressable } from "react-native";
import type {
  AttendanceStatus,
  RosterStudent,
} from "@/features/attendance/useRoster";

interface Props {
  student: RosterStudent;
  onPillTap: (status: AttendanceStatus) => void;
  onLongPress: () => void;
  busy?: boolean;
}

function initialsOf(name: string): string {
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

export function RosterRow({
  student,
  onPillTap,
  onLongPress,
  busy = false,
}: Props): React.ReactElement {
  const initials = initialsOf(student.full_name);
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={500}
      className="mx-6 mt-2 bg-white rounded-2xl border border-slate-100 p-4 flex-row items-center shadow-sm shadow-slate-200/50"
    >
      <View className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center mr-3">
        <Text className="text-xs font-bold text-slate-700">{initials}</Text>
      </View>
      <View className="flex-1 mr-3">
        <Text
          className="text-sm font-semibold text-slate-900"
          numberOfLines={1}
        >
          {student.full_name}
        </Text>
        {student.method ? (
          <Text className="text-[10px] uppercase text-slate-400 mt-0.5">
            {student.method}
          </Text>
        ) : (
          <Text className="text-[10px] uppercase text-slate-300 mt-0.5">
            Unmarked
          </Text>
        )}
      </View>
      <View className="flex-row">
        <Pill
          label="P"
          active={student.status === "present"}
          tone="present"
          onPress={() => onPillTap("present")}
          disabled={busy}
        />
        <Pill
          label="L"
          active={student.status === "late"}
          tone="late"
          onPress={() => onPillTap("late")}
          disabled={busy}
        />
        <Pill
          label="A"
          active={student.status === "absent"}
          tone="absent"
          onPress={() => onPillTap("absent")}
          disabled={busy}
        />
      </View>
    </Pressable>
  );
}

function Pill({
  label,
  active,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  tone: "present" | "late" | "absent";
  onPress: () => void;
  disabled?: boolean;
}) {
  const activeClasses =
    tone === "present"
      ? "bg-emerald-600 border-emerald-600"
      : tone === "late"
        ? "bg-amber-500 border-amber-500"
        : "bg-red-600 border-red-600";
  const inactiveClasses = "bg-white border-slate-200";
  const textActive = "text-white";
  const inactiveText =
    tone === "present"
      ? "text-emerald-700"
      : tone === "late"
        ? "text-amber-700"
        : "text-red-700";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={6}
      className={`w-12 h-12 ml-2 rounded-full border items-center justify-center ${
        active ? activeClasses : inactiveClasses
      } ${disabled ? "opacity-50" : ""}`}
    >
      <Text
        className={`text-base font-bold ${active ? textActive : inactiveText}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
