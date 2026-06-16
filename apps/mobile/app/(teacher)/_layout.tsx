import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  BookOpen,
  ClipboardCheck,
  Home,
  ListChecks,
  QrCode,
  User,
  Users,
  Video,
} from "lucide-react-native";
import { useSession } from "@/features/auth/useSession";
import { useRole } from "@/features/auth/useRole";
import { LoadingScreen } from "@/components/LoadingScreen";

function TeacherGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, session, appUser } = useSession();
  const role = useRole();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      // Genuinely signed out (explicit sign-out or a truly dead session).
      router.replace("/login");
      return;
    }
    if (!appUser) {
      // Session is valid but the profile isn't loaded yet — e.g. a transient
      // fetch hiccup right after a token refresh. Do NOT treat this as a logout;
      // that would throw a signed-in teacher to /login mid-session. Hand off to
      // the central router, which waits for the profile and only shows the
      // neutral retry screen if it truly never resolves.
      router.replace("/");
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
    if (!role.isTeacher) {
      // Wrong group (admin-only or student landed here): bounce to the central
      // router, which signs admins out and routes students correctly.
      router.replace("/");
    }
  }, [isLoading, session, appUser, role, router]);

  if (isLoading || !session || !appUser || !role.isTeacher) {
    return <LoadingScreen />;
  }
  return <>{children}</>;
}

export default function TeacherTabsLayout() {
  return (
    <TeacherGate>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#2563EB",
          tabBarInactiveTintColor: "#6B7280",
          headerShown: false,
          // Freeze off-screen tabs so background timers / realtime re-renders
          // stop draining the JS thread while on another tab (low-end win).
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
          name="scan"
          options={{
            title: "Scan",
            tabBarIcon: ({ color }) => <QrCode size={24} color={color} />,
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
          name="content"
          options={{
            title: "Library",
            tabBarIcon: ({ color }) => <BookOpen size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quizzes"
          options={{
            title: "Quizzes",
            tabBarIcon: ({ color }) => <ListChecks size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="exams"
          options={{
            title: "Exams",
            tabBarIcon: ({ color }) => <ClipboardCheck size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="batch"
          options={{
            title: "Batch",
            tabBarIcon: ({ color }) => <Users size={24} color={color} />,
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
    </TeacherGate>
  );
}
