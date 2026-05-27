// Phase 9 — pinned announcement banner (latest kind='announcement' message).

import { Text, View } from "react-native";
import { Pin } from "lucide-react-native";

export function PinnedBanner({ text, byName }: { text: string; byName?: string }) {
  return (
    <View className="bg-blue-50 border-b border-blue-100 px-4 py-3">
      <View className="flex-row items-center mb-1">
        <Pin size={12} color="#1d4ed8" style={{ marginRight: 6 }} />
        <Text className="text-blue-800 text-[10px] font-bold tracking-widest uppercase">
          {byName ? `Pinned by ${byName}` : "Pinned"}
        </Text>
      </View>
      <Text className="text-blue-900 text-sm leading-5">{text}</Text>
    </View>
  );
}
