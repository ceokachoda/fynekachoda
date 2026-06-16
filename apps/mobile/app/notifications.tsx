// Notifications hub. Push is dispatch-only on the backend (no stored feed), so
// this screen surfaces the device permission state and lets the student turn
// notifications on, plus explains what they'll be alerted about. The bell on
// every student tab routes here.

import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import {
  BellRing,
  CalendarClock,
  Check,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  ListChecks,
  Radio,
  type LucideIcon,
} from "lucide-react-native";
import { registerForPush } from "@/lib/push";

type Perm = { granted: boolean; canAskAgain: boolean } | null;

interface Category {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  desc: string;
}

const CATEGORIES: readonly Category[] = [
  {
    icon: Radio,
    color: "#dc2626",
    bg: "bg-red-50",
    title: "Live classes",
    desc: "The moment one of your classes goes live.",
  },
  {
    icon: CalendarClock,
    color: "#2563eb",
    bg: "bg-blue-50",
    title: "Scheduled classes",
    desc: "When a class is scheduled, plus a reminder ~10 min before it starts.",
  },
  {
    icon: FileText,
    color: "#7c3aed",
    bg: "bg-violet-50",
    title: "Study material",
    desc: "When new videos or notes land in your library.",
  },
  {
    icon: ListChecks,
    color: "#0891b2",
    bg: "bg-cyan-50",
    title: "Quizzes",
    desc: "When a new practice quiz is published for your batch.",
  },
  {
    icon: ClipboardCheck,
    color: "#ea580c",
    bg: "bg-orange-50",
    title: "Exams & results",
    desc: "New graded exams, and the moment your results are released.",
  },
] as const;

export default function NotificationsScreen() {
  const router = useRouter();
  const [perm, setPerm] = useState<Perm>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const p = await Notifications.getPermissionsAsync();
      setPerm({ granted: p.granted, canAskAgain: p.canAskAgain });
    } catch {
      setPerm({ granted: false, canAskAgain: true });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onEnable = useCallback(async () => {
    if (perm?.granted) return;
    // Denied and the OS won't show the prompt again → send the user to settings.
    if (perm && !perm.canAskAgain) {
      void Linking.openSettings();
      return;
    }
    setBusy(true);
    try {
      await registerForPush();
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [perm, refresh]);

  const granted = perm?.granted === true;
  const settingsOnly = perm !== null && !perm.granted && !perm.canAskAgain;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-3 pb-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200"
        >
          <ChevronLeft size={20} color="#0f172a" />
        </Pressable>
        <Text className="text-lg font-bold text-blue-900 ml-3 flex-1">Notifications</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Status card */}
        <View className="mx-5 mt-4 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm shadow-slate-200/50">
          <View
            className={`w-12 h-12 rounded-2xl items-center justify-center ${
              granted ? "bg-emerald-50" : "bg-blue-50"
            }`}
          >
            {granted ? (
              <Check size={24} color="#059669" />
            ) : (
              <BellRing size={24} color="#2563eb" />
            )}
          </View>
          <Text className="text-lg font-extrabold text-slate-900 mt-3">
            {granted ? "Notifications are on" : "Turn on notifications"}
          </Text>
          <Text className="text-sm text-slate-500 mt-1 leading-5">
            {granted
              ? "You're all set — we'll alert you about everything below."
              : "Stay in the loop on live classes, new material, quizzes and your results."}
          </Text>

          {!granted ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void onEnable()}
              disabled={busy}
              className={`mt-4 rounded-2xl py-3.5 items-center ${
                busy ? "bg-blue-300" : "bg-blue-600"
              }`}
            >
              <Text className="text-white font-bold text-base">
                {busy
                  ? "Enabling…"
                  : settingsOnly
                    ? "Open settings"
                    : "Enable notifications"}
              </Text>
            </Pressable>
          ) : null}

          {!Device.isDevice ? (
            <Text className="text-xs text-amber-600 mt-3 leading-4">
              Push notifications only work on a physical device, not a simulator.
            </Text>
          ) : settingsOnly ? (
            <Text className="text-xs text-slate-400 mt-3 leading-4">
              Notifications are blocked for FyneStudy. Turn them on from your
              device settings.
            </Text>
          ) : null}
        </View>

        {/* What you'll get */}
        <Text className="text-xs font-bold uppercase tracking-wide text-slate-400 mx-6 mt-7 mb-2">
          {"What you'll get"}
        </Text>
        <View className="mx-5 bg-white rounded-3xl border border-slate-100 overflow-hidden">
          {CATEGORIES.map((c, i) => {
            const Icon = c.icon;
            return (
              <View
                key={c.title}
                className={`flex-row items-center p-4 ${
                  i < CATEGORIES.length - 1 ? "border-b border-slate-50" : ""
                }`}
              >
                <View
                  className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${c.bg}`}
                >
                  <Icon size={20} color={c.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">{c.title}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5 leading-4">{c.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text className="text-xs text-slate-400 mx-6 mt-4 leading-4">
          {"Tap a notification to jump straight to the class, material or result it's about."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
