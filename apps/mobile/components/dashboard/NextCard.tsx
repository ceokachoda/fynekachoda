import { memo, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import {
  BookOpen,
  ClipboardCheck,
  PlayCircle,
  QrCode,
  Radio,
  Target,
  Timer,
} from "lucide-react-native";
import type { NextCard as NextCardData } from "@/features/dashboard/types";

function minutesPhrase(sec?: number): string {
  if (sec == null) return "soon";
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 1) return "in under a minute";
  if (m === 1) return "in 1 minute";
  if (m < 60) return `in ${m} minutes`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
}

interface CardSpec {
  icon: ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
}

function specFor(c: NextCardData): CardSpec {
  switch (c.type) {
    case "live_class":
      return {
        icon: <Radio size={22} color="#fff" />,
        title: c.subject ?? "Live class",
        subtitle: "Your class is live right now.",
        cta: "Join Live Now",
        href: "/classes",
      };
    case "exam":
      return {
        icon: <ClipboardCheck size={22} color="#fff" />,
        title: c.title ?? "Exam",
        subtitle: `Window closes ${minutesPhrase(c.ends_in_sec)}.`,
        cta: "Start Exam",
        href: `/exam/${c.exam_id}`,
      };
    case "upcoming_session":
      return {
        icon: <Timer size={22} color="#fff" />,
        title: c.subject ?? "Class",
        subtitle: `Starts ${minutesPhrase(c.starts_in_sec)}.`,
        cta: "View Schedule",
        href: "/classes",
      };
    case "attendance":
      return {
        icon: <QrCode size={22} color="#fff" />,
        title: c.subject ?? "Class in session",
        subtitle: "Mark your attendance now.",
        cta: "Mark Attendance",
        href: "/attendance",
      };
    case "recording":
      return {
        icon: <PlayCircle size={22} color="#fff" />,
        title: c.title ?? "New recording",
        subtitle: "Catch up on what you missed.",
        cta: "Watch Replay",
        href: `/video/${c.content_id}`,
      };
    case "weak_topic":
      return {
        icon: <Target size={22} color="#fff" />,
        title: c.topic_name ?? "Weak topic",
        subtitle: "A few practice questions will lift this.",
        cta: `Practice ${c.topic_name ?? "this topic"}`,
        href: c.quiz_id ? `/quiz/${c.quiz_id}` : "/library",
      };
    default:
      return {
        icon: <BookOpen size={22} color="#fff" />,
        title: "Keep learning",
        subtitle: "Browse videos, notes and quizzes in your library.",
        cta: "Browse Library",
        href: "/library",
      };
  }
}

export const NextCard = memo(function NextCard({ card }: { card: NextCardData }) {
  const router = useRouter();
  const spec = specFor(card);
  return (
    <View className="bg-blue-600 rounded-[28px] p-5 shadow-sm shadow-blue-300/40">
      <View className="flex-row items-center mb-3">
        <View className="w-11 h-11 rounded-2xl bg-white/20 items-center justify-center mr-3">
          {spec.icon}
        </View>
        <View className="flex-1">
          <Text className="text-white/70 text-[11px] font-bold uppercase tracking-wider">
            Up next
          </Text>
          <Text className="text-white text-lg font-extrabold" numberOfLines={1}>
            {spec.title}
          </Text>
        </View>
      </View>
      <Text className="text-white/80 text-sm mb-4 leading-5">{spec.subtitle}</Text>
      <TouchableOpacity
        onPress={() => router.push(spec.href as never)}
        className="bg-white rounded-xl py-3 items-center"
        activeOpacity={0.9}
      >
        <Text className="text-blue-700 font-bold text-base">{spec.cta}</Text>
      </TouchableOpacity>
    </View>
  );
});
