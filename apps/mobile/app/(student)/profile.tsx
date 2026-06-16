import { useState } from "react";
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldQuestion,
  Sparkles,
  User as UserIcon,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";
import { signOut } from "@/features/auth/auth";
import { useMyBatch } from "@/features/org/useMyBatch";
import { useMastery } from "@/features/dashboard/useMastery";
import { MasteryCard } from "@/components/dashboard/MasteryCard";
import { BadgeShowcase } from "@/components/gamification/BadgeShowcase";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentHeader } from "@/components/StudentHeader";

const ADMIN_CONTACT_EMAIL = "admin@fynestudy.example.com";

type Tab = "profile" | "mastery" | "badges";

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { appUser, user } = useSession();
  const myBatch = useMyBatch();
  const mastery = useMastery();
  const [tab, setTab] = useState<Tab>(
    params.tab === "mastery" ? "mastery" : params.tab === "badges" ? "badges" : "profile",
  );

  const fullName = appUser?.full_name ?? user?.email ?? "Student";
  const email = appUser?.email ?? user?.email ?? "";
  const phone = appUser?.phone ?? "—";
  const dob = appUser?.dob ?? "—";
  const batchLabel = myBatch.isLoading ? "Loading…" : myBatch.error ? "—" : myBatch.data?.batch_name ?? "—";
  const courseLabel = myBatch.isLoading
    ? "Loading…"
    : myBatch.error
      ? "—"
      : myBatch.data
        ? `${myBatch.data.course_code} · ${myBatch.data.course_name}`
        : "—";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function openAdminContact(subject: string) {
    const url = `mailto:${ADMIN_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Contact admin", `Reach the institute at ${ADMIN_CONTACT_EMAIL}`);
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <StudentHeader />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="bg-white rounded-[32px] mx-6 mt-4 mb-4 p-6 shadow-sm shadow-slate-200/50 border border-slate-100 items-center">
          <View className="w-24 h-24 rounded-full border-4 border-slate-50 mb-4 bg-slate-200 items-center justify-center">
            <UserIcon size={40} color="#94a3b8" />
          </View>
          <Text className="text-2xl font-extrabold text-slate-900 mb-2 text-center">{fullName}</Text>
          <Text className="text-slate-500 text-sm font-medium text-center leading-5">{email}</Text>
        </View>

        <View className="px-6 mb-6">
          <View className="bg-slate-200/70 p-1.5 rounded-2xl flex-row">
            {(["profile", "mastery", "badges"] as const).map((t) => {
              const active = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  className="flex-1 py-2.5 rounded-xl items-center justify-center"
                  style={active ? { backgroundColor: "#FFFFFF" } : undefined}
                >
                  <Text className="font-bold text-sm" style={{ color: active ? "#1D4ED8" : "#64748B" }}>
                    {t === "profile" ? "Profile" : t === "mastery" ? "Mastery" : "Badges"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {tab === "badges" ? (
          <View className="px-6 mb-8">
            <View className="flex-row items-center mb-3">
              <Award size={20} color="#1e3a8a" />
              <Text className="text-lg font-bold text-slate-900 ml-2">Badge collection</Text>
            </View>
            <Text className="text-xs text-slate-500 mb-4 leading-4">
              Milestones you&apos;ve unlocked. Locked badges show how to earn them — tap any badge.
            </Text>
            <BadgeShowcase />
          </View>
        ) : tab === "mastery" ? (
          <View className="px-6 mb-8">
            <View className="flex-row items-center mb-3">
              <BarChart3 size={20} color="#1e3a8a" />
              <Text className="text-lg font-bold text-slate-900 ml-2">Topic mastery</Text>
            </View>
            <Text className="text-xs text-slate-500 mb-4 leading-4">
              Rolling average of your last 5 attempts per topic (quizzes + exams), weakest first.
            </Text>
            {mastery.isLoading && mastery.rows.length === 0 ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} width="100%" height={72} borderRadius={16} style={{ marginBottom: 8 }} />
                ))}
              </>
            ) : mastery.error ? (
              <View className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <Text className="text-sm text-red-700">{mastery.error}</Text>
              </View>
            ) : mastery.rows.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 border border-slate-100 items-center">
                <Sparkles size={28} color="#94a3b8" />
                <Text className="text-sm font-bold text-slate-900 mt-3 text-center">No mastery data yet</Text>
                <Text className="text-xs text-slate-500 mt-1 text-center leading-4">
                  Finish a quiz or exam and your per-topic mastery shows up here.
                </Text>
              </View>
            ) : (
              mastery.rows.map((row) => <MasteryCard key={row.topic_id} row={row} />)
            )}
          </View>
        ) : (
          <>
            <View className="px-6 mb-8">
              <Text className="text-lg font-bold text-slate-900 mb-4 px-2">Account</Text>
              <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <ReadOnlyRow icon={<UserIcon size={20} color="#475569" />} tone="bg-slate-50" label="Full name" value={fullName} />
                <ReadOnlyRow icon={<Mail size={20} color="#3b82f6" />} tone="bg-blue-50" label="Email" value={email} />
                <ReadOnlyRow icon={<Phone size={20} color="#10b981" />} tone="bg-emerald-50" label="Phone" value={phone} />
                <ReadOnlyRow icon={<CalendarDays size={20} color="#a855f7" />} tone="bg-purple-50" label="Date of birth" value={dob} isLast />
              </View>
            </View>

            <View className="px-6 mb-8">
              <Text className="text-lg font-bold text-slate-900 mb-4 px-2">Academic</Text>
              <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <ReadOnlyRow icon={<GraduationCap size={20} color="#0ea5e9" />} tone="bg-sky-50" label="Batch" value={batchLabel} />
                <ReadOnlyRow icon={<BookOpen size={20} color="#f59e0b" />} tone="bg-amber-50" label="Course" value={courseLabel} isLast />
              </View>
              <View className="mt-3 px-3">
                <Text className="text-xs text-slate-500 leading-4">
                  Identity fields are read-only. To update your name, email, phone, date of birth, or batch,
                  contact your institute admin.
                </Text>
              </View>
            </View>

            <View className="px-6 mb-8">
              <Text className="text-lg font-bold text-slate-900 mb-4 px-2">Actions</Text>
              <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <ActionRow
                  icon={<Lock size={22} color="#475569" />}
                  tone="bg-slate-50"
                  title="Change password"
                  subtitle="Pick a new password right now"
                  onPress={() => router.push("/force-password-change")}
                />
                <ActionRow
                  icon={<ShieldQuestion size={22} color="#10b981" />}
                  tone="bg-emerald-50"
                  title="Contact admin"
                  subtitle="Profile updates, batch changes, support"
                  onPress={() => openAdminContact("FyneStudy help request")}
                />
              </View>
            </View>

            <View className="px-6 mb-8">
              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.85}
                className="bg-red-50 rounded-2xl py-4 flex-row items-center justify-center border border-red-100 shadow-sm shadow-red-100/50"
              >
                <LogOut size={20} color="#ef4444" style={{ marginRight: 8 }} />
                <Text className="text-red-600 font-bold text-base">Sign out</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadOnlyRow({
  icon,
  tone,
  label,
  value,
  isLast = false,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View className={`flex-row items-center p-4 ${isLast ? "" : "border-b border-slate-50"}`}>
      <View className={`w-12 h-12 ${tone} rounded-2xl items-center justify-center mr-4`}>{icon}</View>
      <View className="flex-1">
        <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{label}</Text>
        <Text className="font-bold text-slate-800 text-base mt-0.5" numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Lock size={14} color="#94a3b8" />
    </View>
  );
}

function ActionRow({
  icon,
  tone,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center p-4 border-b border-slate-50">
      <View className={`w-12 h-12 ${tone} rounded-2xl items-center justify-center mr-4`}>{icon}</View>
      <View className="flex-1">
        <Text className="font-bold text-slate-800 text-base mb-0.5">{title}</Text>
        <Text className="text-slate-500 text-xs font-medium">{subtitle}</Text>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );
}
