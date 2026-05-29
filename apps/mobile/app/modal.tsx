import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Flame, X } from "lucide-react-native";
import { useStreak } from "@/features/dashboard/useStreak";
import { useBadgesCollection } from "@/features/gamification/useBadgesCollection";
import { BadgeGlyph } from "@/components/gamification/BadgeGlyph";
import { Skeleton } from "@/components/ui/skeleton";

// Last n IST calendar dates as YYYY-MM-DD, oldest first, ending today.
function lastNDates(n: number): string[] {
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = todayIst.split("-").map(Number) as [number, number, number];
  const baseUtc = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(baseUtc - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

function flameColor(days: number): string {
  if (days <= 0) return "#94a3b8";
  if (days < 7) return "#f97316";
  if (days < 30) return "#ea580c";
  if (days < 90) return "#dc2626";
  return "#eab308";
}

function StreakModal() {
  const router = useRouter();
  const { data, isLoading } = useStreak();
  const dates = lastNDates(30);
  const today = dates[dates.length - 1];
  const active = new Set(data?.activeDays ?? []);
  const current = data?.currentDays ?? 0;
  const best = data?.bestDays ?? 0;
  const { items: badgeItems } = useBadgesCollection();
  const cutoffMs = Date.now() - Math.max(current, 1) * 86_400_000;
  const streakBadges = badgeItems.filter(
    (b) => b.earned && b.earned_at && new Date(b.earned_at).getTime() >= cutoffMs,
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Text className="text-xl font-extrabold text-blue-900">Your streak</Text>
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-end justify-center">
          <X size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="items-center px-6 mt-4 mb-6">
          <Flame size={56} color={flameColor(current)} />
          {isLoading && !data ? (
            <View className="mt-3">
              <Skeleton width={120} height={28} borderRadius={8} />
            </View>
          ) : (
            <>
              <Text className="text-4xl font-extrabold text-slate-900 mt-2">{current}</Text>
              <Text className="text-sm text-slate-500">day streak</Text>
            </>
          )}
          <Text className="text-xs text-slate-400 mt-2">Best streak: {best} day{best === 1 ? "" : "s"}</Text>
        </View>

        <View className="px-6 mb-6">
          <Text className="text-sm font-bold text-slate-900 mb-3">Last 30 days</Text>
          <View className="flex-row flex-wrap justify-center">
            {dates.map((dt) => {
              const isActive = active.has(dt);
              const isToday = dt === today;
              return (
                <View
                  key={dt}
                  className={`w-9 h-9 rounded-md m-0.5 items-center justify-center ${isActive ? "bg-emerald-500" : "bg-slate-200"} ${isToday ? "border-2 border-blue-500" : ""}`}
                >
                  <Text className={`text-[10px] font-semibold ${isActive ? "text-white" : "text-slate-400"}`}>
                    {Number(dt.slice(8, 10))}
                  </Text>
                </View>
              );
            })}
          </View>
          <View className="flex-row items-center justify-center mt-3" style={{ gap: 16 }}>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded bg-emerald-500 mr-1.5" />
              <Text className="text-[11px] text-slate-500">Active</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded bg-slate-200 mr-1.5" />
              <Text className="text-[11px] text-slate-500">No activity</Text>
            </View>
          </View>
        </View>

        {streakBadges.length > 0 ? (
          <View className="px-6 mb-6">
            <Text className="text-sm font-bold text-slate-900 mb-3">Badges earned during this streak</Text>
            <View className="flex-row flex-wrap">
              {streakBadges.map((b) => (
                <View key={b.code} className="items-center mr-4 mb-2" style={{ width: 64 }}>
                  <BadgeGlyph code={b.code} size={48} />
                  <Text numberOfLines={2} className="text-[10px] font-semibold text-slate-700 text-center mt-1">
                    {b.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="px-6">
          <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <Text className="text-sm font-bold text-slate-900 mb-1">How streaks work</Text>
            <Text className="text-xs text-slate-500 leading-5">
              Do at least one thing each day — mark attendance, finish a quiz or exam, or watch a
              video to the halfway point — to keep your streak alive. Miss a day and it resets to
              zero. All days are counted in IST.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GenericModal() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center px-8" edges={["top"]}>
      <Text className="text-lg font-bold text-slate-900 text-center">Nothing to show here.</Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-4">
        <Text className="text-blue-600 font-semibold">Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function ModalScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  if (type === "streak") return <StreakModal />;
  return <GenericModal />;
}
