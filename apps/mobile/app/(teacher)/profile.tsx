import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { LogOut, Mail, ShieldQuestion, User as UserIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";
import { signOut } from "@/features/auth/auth";

const ADMIN_CONTACT_EMAIL = "admin@fynestudy.example.com";

export default function TeacherProfileScreen() {
  const router = useRouter();
  const { appUser, user } = useSession();
  const fullName = appUser?.full_name ?? user?.email ?? "Teacher";
  const email = appUser?.email ?? user?.email ?? "";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="flex-row items-center justify-center px-6 pt-4 pb-2">
        <Text className="text-xl font-bold italic text-blue-900">
          My Profile
        </Text>
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
          <View className="bg-blue-50 px-3 py-1.5 rounded-full mb-4">
            <Text className="text-blue-700 text-xs font-bold tracking-wide">
              TEACHER
            </Text>
          </View>
          <Text className="text-slate-500 text-sm font-medium text-center">
            {email}
          </Text>
        </View>

        <View className="px-6 mb-3">
          <Text className="text-xs text-slate-500 leading-4 px-3">
            Identity fields are read-only. Contact admin for name, email, or
            subject changes.
          </Text>
        </View>

        <View className="px-6 mb-8">
          <View className="bg-white rounded-[28px] shadow-sm shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(`mailto:${ADMIN_CONTACT_EMAIL}`).catch(() => {})
              }
              activeOpacity={0.7}
              className="flex-row items-center p-4 border-b border-slate-50"
            >
              <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center mr-4">
                <ShieldQuestion size={22} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base mb-0.5">
                  Contact admin
                </Text>
                <Text className="text-slate-500 text-xs font-medium">
                  Profile updates, batch changes, support
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/force-password-change")}
              activeOpacity={0.7}
              className="flex-row items-center p-4"
            >
              <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center mr-4">
                <Mail size={22} color="#475569" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base mb-0.5">
                  Change password
                </Text>
                <Text className="text-slate-500 text-xs font-medium">
                  Pick a new password right now
                </Text>
              </View>
            </TouchableOpacity>
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
