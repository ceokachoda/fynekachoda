import { ActivityIndicator, Text, View } from "react-native";
import { FyneStudyLogo } from "./FyneStudyLogo";
import type { PingStatus } from "@/features/health/usePingBackend";

interface SplashOverlayProps {
  status: PingStatus;
}

export function SplashOverlay({ status }: SplashOverlayProps) {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
      className="bg-white items-center justify-center"
      pointerEvents="auto"
      testID="splash-overlay"
    >
      <View className="items-center">
        <FyneStudyLogo variant="large" />
        <View className="mt-6">
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      </View>

      <View className="absolute bottom-12 left-0 right-0 items-center">
        <View className="flex-row items-center">
          <View
            className={
              status === "ok"
                ? "w-2 h-2 rounded-full bg-emerald-500 mr-2"
                : status === "fail"
                  ? "w-2 h-2 rounded-full bg-red-500 mr-2"
                  : "w-2 h-2 rounded-full bg-slate-300 mr-2"
            }
          />
          <Text
            className={
              status === "ok"
                ? "text-emerald-600 text-xs font-semibold"
                : status === "fail"
                  ? "text-red-600 text-xs font-semibold"
                  : "text-slate-500 text-xs font-semibold"
            }
          >
            {status === "ok"
              ? "Backend: connected"
              : status === "fail"
                ? "Backend: unreachable"
                : "Backend: checking…"}
          </Text>
        </View>
      </View>
    </View>
  );
}
