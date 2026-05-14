import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ChevronRight, Lock, LogOut, Mail, Phone, ShieldQuestion, User as UserIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";
import { signOut } from "@/features/auth/auth";

const ADMIN_CONTACT_EMAIL = "admin@fynestudy.example.com";

export default function ProfileScreen() {
  const router = useRouter();
  const { appUser, user } = useSession();

  const fullName = appUser?.full_name ?? user?.email ?? "Student";
  const email = appUser?.email ?? user?.email ?? "";

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
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <View className="w-10 h-10" />
        <Text className="text-xl font-bold italic text-blue-900">My Profile</Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="bg-white rounded-[32px] mx-6 mt-4 mb-6 p-6 shadow-sm shadow-slate-200/50 border border-slate-100 items-center">
          <View className="w-24 h-24 rounded-full border-4 border-slate-50 mb-4 bg-slate-200 items-center justify-center">
            <UserIcon size={40} color="#94a3b8" />
          </View>

          <Text className="text-2xl font-extrabold text-slate-900 mb-2 text-center">
            {fullName}
          </Text>

          <Text className="text-slate-500 text-sm font-medium text-center leading-5">
            {email}
          </Text>
        </View>

        <View className="px-6 mb-8">
          <Text className="text-lg font-bold text-slate-900 mb-4 px-2">
            Account
          </Text>

          <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <ReadOnlyRow
              icon={<UserIcon size={20} color="#475569" />}
              tone="bg-slate-50"
              label="Full name"
              value={fullName}
            />
            <ReadOnlyRow
              icon={<Mail size={20} color="#3b82f6" />}
              tone="bg-blue-50"
              label="Email"
              value={email}
            />
            <ReadOnlyRow
              icon={<Phone size={20} color="#10b981" />}
              tone="bg-emerald-50"
              label="Phone"
              value="—"
            />
          </View>

          <View className="mt-3 px-3">
            <Text className="text-xs text-slate-500 leading-4">
              Identity fields are read-only. To update your name, email, phone,
              or batch, contact your institute admin.
            </Text>
          </View>
        </View>

        <View className="px-6 mb-8">
          <Text className="text-lg font-bold text-slate-900 mb-4 px-2">
            Actions
          </Text>

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
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadOnlyRow({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center p-4 border-b border-slate-50">
      <View
        className={`w-12 h-12 ${tone} rounded-2xl items-center justify-center mr-4`}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
          {label}
        </Text>
        <Text className="font-bold text-slate-800 text-base mt-0.5">{value}</Text>
      </View>
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center p-4 border-b border-slate-50"
    >
      <View
        className={`w-12 h-12 ${tone} rounded-2xl items-center justify-center mr-4`}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-slate-800 text-base mb-0.5">{title}</Text>
        <Text className="text-slate-500 text-xs font-medium">{subtitle}</Text>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );
}
