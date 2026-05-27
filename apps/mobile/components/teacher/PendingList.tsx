import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, Hand, Megaphone } from "lucide-react-native";
import type { TeacherPending } from "@/features/dashboard/useTeacherDashboard";

export const PendingList = memo(function PendingList({
  pending,
}: {
  pending: TeacherPending;
}) {
  const router = useRouter();
  const exams = pending.exams_awaiting_release;
  const nothing = exams.length === 0 && pending.raised_hands === 0;

  if (nothing) {
    return (
      <View className="bg-white rounded-2xl p-4 border border-slate-100 flex-row items-center">
        <CheckCircle2 size={20} color="#10b981" />
        <Text className="text-sm text-slate-500 ml-3 flex-1">
          You&apos;re all caught up — nothing pending.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {exams.map((e) => (
        <TouchableOpacity
          key={e.exam_id}
          onPress={() => router.push(`/exam-results/${e.exam_id}` as never)}
          activeOpacity={0.85}
          className="bg-white rounded-2xl p-4 border border-slate-100 mb-2 flex-row items-center"
        >
          <View className="w-10 h-10 rounded-2xl bg-amber-50 items-center justify-center mr-3">
            <Megaphone size={18} color="#d97706" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
              Release results: {e.title}
            </Text>
            <Text className="text-[11px] text-slate-500 mt-0.5">
              {e.batch} · {e.submitted_count} submitted
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      {pending.raised_hands > 0 ? (
        <View className="bg-white rounded-2xl p-4 border border-slate-100 flex-row items-center">
          <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center mr-3">
            <Hand size={18} color="#2563EB" />
          </View>
          <Text className="text-sm font-bold text-slate-900 flex-1">
            Review {pending.raised_hands} raised hand{pending.raised_hands === 1 ? "" : "s"}
          </Text>
        </View>
      ) : null}
    </View>
  );
});
