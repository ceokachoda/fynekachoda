import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { X } from "lucide-react-native";

// Explains the composite (D-071, LOCKED). The percentages mirror LEADERBOARD_WEIGHTS
// in packages/shared/src/constants/leaderboard.ts (the runtime source of truth is the
// SQL view; this is display copy — keep in sync if the weights are ever retuned).
function Weight({ pct, title, body, color }: { pct: string; title: string; body: string; color: string }) {
  return (
    <View className="flex-row items-start mb-4">
      <View className="w-14 h-14 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: `${color}1a` }}>
        <Text className="text-base font-extrabold" style={{ color }}>{pct}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-slate-900">{title}</Text>
        <Text className="text-xs text-slate-500 mt-0.5 leading-4">{body}</Text>
      </View>
    </View>
  );
}

export function LeaderboardCalcModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable className="bg-white rounded-t-[28px] px-6 pt-5 pb-10" onPress={() => {}}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-extrabold text-blue-900">How rank is calculated</Text>
            <TouchableOpacity onPress={onClose} className="w-9 h-9 items-center justify-center">
              <X size={22} color="#1e3a8a" />
            </TouchableOpacity>
          </View>

          <Text className="text-xs text-slate-500 mb-5 leading-5">
            Your composite score blends three things, each scored from 0 to 1 and then weighted:
          </Text>

          <Weight pct="60%" color="#2563eb" title="Quiz & exam scores" body="Your average score across quizzes and exams in the period." />
          <Weight pct="25%" color="#10b981" title="Activity" body="How many days you were active out of the days you could be." />
          <Weight pct="15%" color="#f97316" title="Streak" body="Your current daily streak — full credit at a 30-day streak." />

          <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mt-1">
            <Text className="text-xs text-slate-500 leading-5">
              Ties are broken by quiz/exam score, then number of quizzes taken, then name. Everyone
              in your batch is ranked the same way — only you can see your own scores.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
