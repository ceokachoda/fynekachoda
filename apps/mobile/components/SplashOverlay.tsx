import { View } from "react-native";
import { FyneStudyLogo } from "./FyneStudyLogo";
import { LoadingDots } from "./LoadingDots";

// Clean, branded boot screen. No backend-status line — students should never see
// "Backend: unreachable"; connectivity problems surface as friendly errors on the
// login/data screens instead.
//
// The logo is rendered STATICALLY (no fade-in) so it continues seamlessly from
// the native expo-splash-screen (same logo on white) with no flicker at the
// hand-off. Motion comes from the dots; the whole view is faded out by BootGate.
export function SplashOverlay() {
  return (
    <View
      className="flex-1 bg-white items-center justify-center"
      testID="splash-overlay"
    >
      <FyneStudyLogo variant="large" />
      <View className="absolute bottom-24 items-center">
        <LoadingDots />
      </View>
    </View>
  );
}
