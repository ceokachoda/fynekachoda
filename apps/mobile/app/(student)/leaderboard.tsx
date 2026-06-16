import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Flame, Info, Trophy } from "lucide-react-native";
import { ScopeTabs } from "@/components/leaderboard/ScopeTabs";
import { RankRow } from "@/components/leaderboard/RankRow";
import { LeaderboardCalcModal } from "@/components/leaderboard/LeaderboardCalcModal";
import {
  fetchStudentCard,
  type LeaderboardScope,
  type LeaderRow,
  type PublicCard,
  useLeaderboard,
} from "@/features/leaderboard/useLeaderboard";
import { useMyBatch } from "@/features/org/useMyBatch";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentHeader } from "@/components/StudentHeader";

function flameColor(days: number): string {
  if (days <= 0) return "#94a3b8";
  if (days < 7) return "#f97316";
  if (days < 30) return "#ea580c";
  if (days < 90) return "#dc2626";
  return "#eab308";
}

function PublicCardModal({
  card,
  loading,
  onClose,
}: {
  card: PublicCard | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={loading || !!card} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 items-center justify-center px-8" onPress={onClose}>
        <Pressable className="bg-white rounded-3xl p-6 w-full max-w-sm" onPress={() => {}}>
          {loading || !card ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <>
              <View className="items-center mb-4">
                <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-3">
                  <Text className="text-xl font-extrabold text-blue-800">
                    {card.full_name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"}
                  </Text>
                </View>
                <Text className="text-lg font-extrabold text-slate-900 text-center">{card.full_name}</Text>
                <Text className="text-xs text-slate-500 mt-0.5">{card.batch_name}</Text>
              </View>

              <View className="flex-row items-center justify-center mb-4">
                <Flame size={20} color={flameColor(card.streak)} />
                <Text className="text-sm font-bold text-slate-900 ml-1.5">{card.streak}</Text>
                <Text className="text-xs text-slate-500 ml-1">day streak</Text>
              </View>

              <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2 text-center">
                Badges ({card.badges.length})
              </Text>
              {card.badges.length === 0 ? (
                <Text className="text-xs text-slate-400 text-center mb-2">No badges yet</Text>
              ) : (
                <View className="flex-row flex-wrap justify-center mb-1">
                  {card.badges.map((b) => (
                    <View key={b.code} className="bg-violet-50 border border-violet-100 rounded-full px-3 py-1 m-1">
                      <Text className="text-[11px] font-semibold text-violet-700">{b.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity onPress={onClose} className="mt-4 bg-slate-100 rounded-2xl py-3 items-center">
                <Text className="font-bold text-slate-700">Close</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<LeaderboardScope>("weekly");
  const { rows, me, total, isLoading, error, reload } = useLeaderboard(scope);
  const batch = useMyBatch();
  const [calcVisible, setCalcVisible] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [card, setCard] = useState<PublicCard | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onRowPress = useCallback(async (row: LeaderRow) => {
    setCard(null);
    setCardLoading(true);
    const c = await fetchStudentCard(row.student_id);
    setCard(c);
    setCardLoading(false);
  }, []);

  const closeCard = useCallback(() => {
    setCard(null);
    setCardLoading(false);
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: LeaderRow }) => (
      <RankRow row={item} onPress={(r) => void onRowPress(r)} />
    ),
    [onRowPress],
  );

  const batchName = batch.isLoading ? "…" : batch.data?.batch_name ?? "your batch";

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <StudentHeader />
      <View className="px-6 pt-1 pb-2">
        <View className="flex-row items-center">
          <Trophy size={22} color="#1e3a8a" />
          <Text className="text-xl font-extrabold text-blue-900 ml-2">Leaderboard</Text>
        </View>
        <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
          {batchName}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.student_id}
        renderItem={renderRow}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void reload(true)} tintColor="#2563EB" />
        }
        ListHeaderComponent={
          <View className="mb-4">
            <View className="mb-4">
              <ScopeTabs scope={scope} onChange={setScope} />
            </View>

            <View className="bg-blue-800 rounded-3xl px-5 py-5 mb-3">
              <Text className="text-xs font-semibold text-blue-200 uppercase tracking-wide">Your rank</Text>
              {isLoading && rows.length === 0 ? (
                <Skeleton width={120} height={32} borderRadius={8} style={{ marginTop: 6 }} />
              ) : (
                <View className="flex-row items-end justify-between mt-1">
                  <Text className="text-4xl font-extrabold text-white">
                    {me ? `#${me.rank}` : "—"}
                    <Text className="text-base font-semibold text-blue-200"> / {total}</Text>
                  </Text>
                  <Text className="text-base font-bold text-white">
                    {me ? me.composite.toFixed(2) : "—"}
                    <Text className="text-xs font-medium text-blue-200"> composite</Text>
                  </Text>
                </View>
              )}
            </View>

            {error && rows.length === 0 ? (
              <View className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-2">
                <Text className="text-sm text-red-700">{error}</Text>
                <TouchableOpacity onPress={() => void reload(true)} className="mt-2">
                  <Text className="text-sm font-semibold text-red-800">Tap to retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="bg-white rounded-2xl p-6 border border-slate-100 items-center">
              <Trophy size={28} color="#94a3b8" />
              <Text className="text-sm font-bold text-slate-900 mt-3 text-center">No rankings yet</Text>
              <Text className="text-xs text-slate-500 mt-1 text-center leading-4">
                Take a quiz, mark attendance, or keep your streak going to climb the board.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <TouchableOpacity
              onPress={() => setCalcVisible(true)}
              className="flex-row items-center justify-center mt-3 py-3"
              activeOpacity={0.7}
            >
              <Info size={16} color="#2563eb" />
              <Text className="text-sm font-semibold text-blue-600 ml-1.5">How is this calculated?</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <LeaderboardCalcModal visible={calcVisible} onClose={() => setCalcVisible(false)} />
      <PublicCardModal card={card} loading={cardLoading} onClose={closeCard} />
    </SafeAreaView>
  );
}
