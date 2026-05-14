import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Home, Video, BookOpen, QrCode, User, Menu as MenuIcon } from "lucide-react-native";
import { useSession } from "@/features/auth/useSession";
import { useRole } from "@/features/auth/useRole";

function StudentGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, session, appUser } = useSession();
  const role = useRole();

  useEffect(() => {
    if (isLoading) return;
    if (!session || !appUser) {
      router.replace("/login");
      return;
    }
    if (!appUser.is_active) {
      router.replace("/suspended");
      return;
    }
    if (appUser.must_change_password) {
      router.replace("/force-password-change");
      return;
    }
    if (role.isAdmin && !role.isStudent && !role.isTeacher) {
      router.replace("/admin-redirect");
      return;
    }
    if (!role.isStudent) {
      router.replace("/");
    }
  }, [isLoading, session, appUser, role, router]);

  if (isLoading || !session || !appUser || !role.isStudent) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function StudentTabsLayout() {
  return (
    <StudentGate>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#2563EB",
          tabBarInactiveTintColor: "#6B7280",
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="classes"
          options={{
            title: "Classes",
            tabBarIcon: ({ color }) => <Video size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color }) => <BookOpen size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: "Attendance",
            tabBarIcon: ({ color }) => <QrCode size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <User size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            tabBarIcon: ({ color }) => <MenuIcon size={24} color={color} />,
          }}
        />
      </Tabs>
    </StudentGate>
  );
}
