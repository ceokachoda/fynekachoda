import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
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

function TeacherGate({ children }: { children: React.ReactNode }) {
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
    if (!role.isTeacher) {
      router.replace("/");
    }
  }, [isLoading, session, appUser, role, router]);

  if (isLoading || !session || !appUser || !role.isTeacher) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
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
