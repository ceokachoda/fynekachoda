import { Text, View } from "react-native";
import { LoadingDots } from "./LoadingDots";

interface LoadingScreenProps {
  label?: string;
  /** Tailwind background class — override for dark screens (e.g. "bg-black"). */
  background?: string;
  dotColor?: string;
}

// Full-screen branded loader used wherever a screen is fetching its first data.
// Shares the LoadingDots animation with the boot splash so loads feel cohesive.
export function LoadingScreen({
  label,
  background = "bg-white",
  dotColor,
}: LoadingScreenProps) {
  return (
    <View className={`flex-1 items-center justify-center ${background}`}>
      <LoadingDots color={dotColor} />
      {label ? (
        <Text className="mt-4 text-sm font-medium text-slate-400">{label}</Text>
      ) : null}
    </View>
  );
}
