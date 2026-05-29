import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Home, Video, BookOpen, QrCode, Trophy, User } from "lucide-react-native";
import { useSession } from "@/features/auth/useSession";
import { useRole } from "@/features/auth/useRole";
import { LoadingScreen } from "@/components/LoadingScreen";

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
    if (!role.isStudent) {
      // Wrong group (admin-only or teacher landed here): bounce to the central
      // router, which signs admins out and routes teachers correctly.
      router.replace("/");
    }
  }, [isLoading, session, appUser, role, router]);

  if (isLoading || !session || !appUser || !role.isStudent) {
    return <LoadingScreen />;
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
          // Freeze off-screen tabs so background timers, polls and realtime
          // re-renders (e.g. the attendance QR tick) stop draining the JS thread
          // while the user is on another tab — a real win on 2GB devices.
          freezeOnBlur: true,
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
          name="leaderboard"
          options={{
            title: "Ranks",
            tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <User size={24} color={color} />,
          }}
        />
      </Tabs>
    </StudentGate>
  );
}
