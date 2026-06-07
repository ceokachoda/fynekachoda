// Phase 9 / web-parity (2026-06) — orientation + fullscreen for the video watch
// screens.
//
// The app is locked to portrait at the root (app/_layout.tsx). A screen that
// calls this hook ALLOWS free rotation while it's focused and snaps back to
// portrait when you leave it, so only the video screens can go landscape — every
// other screen stays portrait and never stretches.
//
// Two ways to go wide, matching the web:
//   • Rotate the device  → `isLandscape` true → the screen lays out video + chat
//     SIDE BY SIDE (you can still read the chat).
//   • Tap the fullscreen button → `immersive` true → we LOCK landscape and the
//     screen shows video ONLY (chat hidden). Tap again to drop the lock and
//     return to free rotation.
// `isLandscape` comes from useWindowDimensions, so it tracks the live window
// size and is correct on every device + split-screen.

import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

export function useVideoOrientation(): {
  isLandscape: boolean;
  immersive: boolean;
  toggleFullscreen: () => void;
} {
  const { width, height } = useWindowDimensions();
  const [immersive, setImmersive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.unlockAsync();
      return () => {
        setImmersive(false);
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
      };
    }, []),
  );

  const toggleFullscreen = useCallback(() => {
    setImmersive((v) => {
      const next = !v;
      void (next
        ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        : ScreenOrientation.unlockAsync());
      return next;
    });
  }, []);

  return { isLandscape: width > height, immersive, toggleFullscreen };
}
