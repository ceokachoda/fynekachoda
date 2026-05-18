import { View, Text } from "react-native";

interface Props {
  label: string;
  present: number;
  total: number;
}

export function AttendanceRing({ label, present, total }: Props): React.ReactElement {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <View className="flex-1 items-center">
      <View className="w-20 h-20 rounded-full bg-blue-50 items-center justify-center mb-2">
        <Text className="text-2xl font-extrabold text-blue-700">{pct}</Text>
        <Text className="text-[10px] font-semibold text-blue-700 -mt-1">%</Text>
      </View>
      <Text className="text-xs text-slate-500 font-medium">{label}</Text>
      <Text className="text-xs text-slate-400 mt-0.5">
        {present} / {total} {total === 1 ? "class" : "classes"}
      </Text>
    </View>
  );
}
