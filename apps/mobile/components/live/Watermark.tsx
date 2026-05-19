// Phase 5 — `Watermark` for the YT player.
//
// D-045: text rotates across 4 corners + center every 60 s so a crop attack
// can't reliably reveal a clean frame. Alpha 0.25 white with 1px dark shadow.
// Renders behind nothing — `pointerEvents="none"` so the player still gets
// taps. We schedule via setInterval (not Reanimated) because we only update
// every minute and the worker thread isn't worth the cost.

import { useEffect, useState } from "react";
import { Text, View } from "react-native";

const POSITIONS = [
  { top: 16, left: 16 },
  { top: 16, right: 16 },
  { bottom: 16, left: 16 },
  { bottom: 16, right: 16 },
  { bottom: 16, left: "40%" as unknown as number }, // center-bottom
] as const;

export function Watermark({ text }: { text: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % POSITIONS.length),
      60_000,
    );
    return () => clearInterval(t);
  }, []);
  const pos = POSITIONS[idx]!;
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          zIndex: 50,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        pos,
      ]}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: 12,
          fontWeight: "600",
          opacity: 0.6,
          textShadowColor: "rgba(0,0,0,0.85)",
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
