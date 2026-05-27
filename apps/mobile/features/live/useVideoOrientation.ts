// Phase 9 — rotate-to-fullscreen for the video watch screens.
//
// The app is locked to portrait at the root (app/_layout.tsx). A screen that
// calls this hook ALLOWS free rotation while it's focused and snaps back to
// portrait when you leave it, so only the video screens can go landscape — every
// other screen stays portrait and never stretches. `isLandscape` drives the
// fullscreen layout; it comes from useWindowDimensions, so it tracks the live
// window size and is correct on every device + split-screen.

import { useCallback } from "react";
import { useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

export function useVideoOrientation(): { isLandscape: boolean } {
  const { width, height } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.unlockAsync();
      return () => {
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
      };
    }, []),
  );

  return { isLandscape: width > height };
}
