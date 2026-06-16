import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { StudentHeader } from "../../components/StudentHeader";
import { Skeleton } from "../../components/ui/skeleton";
import { NextCard } from "@/components/dashboard/NextCard";
import { StatsStrip } from "@/components/dashboard/StatsStrip";
import { StreakFlame } from "@/components/dashboard/StreakFlame";
import { TodayScheduleStrip } from "@/components/dashboard/TodayScheduleStrip";
import { WeakTopicsList } from "@/components/dashboard/WeakTopicsList";
import { ContinueStrip } from "@/components/dashboard/ContinueStrip";
import { RecentBadgesStrip } from "@/components/dashboard/RecentBadgesStrip";
import { BadgeEarnedModal } from "@/components/gamification/BadgeEarnedModal";
import { useSession } from "@/features/auth/useSession";
import { useStudentDashboard } from "@/features/dashboard/useStudentDashboard";
import { useUnseenBadges } from "@/features/gamification/useUnseenBadges";
import { useAttendanceRealtime } from "@/features/attendance/useAttendanceRealtime";

function BadgeCelebrationHost() {
  const { current, iconUrls, refresh, dismiss } = useUnseenBadges();
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  if (!current) return null;
  return (
    <BadgeEarnedModal
      // Remount per badge so the confetti burst + entrance animation re-fire for
      // each badge in a multi-badge session (the modal element is reused otherwise).
      key={current.badge_id}
      badge={current}
      iconUrl={iconUrls[current.code] ?? null}
      onDismiss={() => void dismiss()}
    />
  );
}

function greetingFor(date: Date): string {
  const hourIst = Number(
    date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }),
  );
  if (hourIst >= 5 && hourIst < 12) return "Good morning";
  if (hourIst >= 12 && hourIst < 17) return "Good afternoon";
  if (hourIst >= 17 && hourIst < 22) return "Good evening";
  return "Hi";
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.split(/\s+/)[0] ?? "there";
}

function SectionHeader({ title }: { title: string }) {
  return <Text className="text-xl font-bold text-blue-900 mb-3">{title}</Text>;
}

export default function StudentHomeScreen() {
  const { appUser } = useSession();
  const { data, isLoading, error, reload } = useStudentDashboard();
  const [refreshing, setRefreshing] = useState(false);

  // Manual pull-to-refresh owns its own spinner so background reloads (realtime
  // attendance pings, on-focus refetch) don't flip the pull spinner mid-scroll.
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  useAttendanceRealtime(reload);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const name = firstName(appUser?.full_name);
  const greeting = greetingFor(new Date());

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor="#2563EB" />
        }
      >
        <StudentHeader />

        <View className="px-6 mt-4 mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-3xl font-extrabold text-blue-800 tracking-tight" numberOfLines={1}>
              {greeting}, {name}.
            </Text>
          </View>
          <StreakFlame
            currentDays={data?.streak.current_days ?? 0}
            bestDays={data?.streak.best_days ?? 0}
          />
        </View>

        {error && !data ? (
          <View className="px-6 mb-6">
            <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <Text className="text-sm font-medium text-red-700">{error}</Text>
              <TouchableOpacity onPress={() => void reload()} className="mt-2">
                <Text className="text-sm font-semibold text-red-800">Tap to retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isLoading && !data ? (
          <View className="px-6">
            <Skeleton width="100%" height={150} borderRadius={28} />
            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <Skeleton width="32%" height={84} borderRadius={16} />
              <Skeleton width="32%" height={84} borderRadius={16} />
              <Skeleton width="32%" height={84} borderRadius={16} />
            </View>
            <View className="mt-6">
              <Skeleton width="100%" height={64} borderRadius={16} />
            </View>
          </View>
        ) : data ? (
          <>
            <View className="px-6 mb-6">
              <NextCard card={data.next_card} />
            </View>

            <View className="px-6 mb-6">
              <StatsStrip stats={data.stats} />
            </View>

            <View className="px-6 mb-6">
              <SectionHeader title="Today's schedule" />
              <TodayScheduleStrip items={data.today} />
            </View>

            <View className="px-6 mb-6">
              <SectionHeader title="Weak topics" />
              <WeakTopicsList items={data.weak_topics} />
            </View>

            {data.continue.length > 0 ? (
              <View className="mb-6">
                <View className="px-6">
                  <SectionHeader title="Continue watching" />
                </View>
                <ContinueStrip items={data.continue} />
              </View>
            ) : null}

            <View className="px-6 mb-8">
              <SectionHeader title="Recent badges" />
              <RecentBadgesStrip badges={data.recent_badges} />
            </View>
          </>
        ) : null}

        {appUser?.is_active === false ? (
          <View className="px-6 mb-8">
            <View className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <Text className="text-sm font-bold text-red-700">Account suspended</Text>
              <Text className="text-xs text-red-600 mt-1">Please contact your admin.</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <BadgeCelebrationHost />
    </SafeAreaView>
  );
}
