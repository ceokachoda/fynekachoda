// Phase 5 §8 watermark for the PDF reader.
//
// 3 × 4 grid of rotated text covering the entire viewport. Any crop still
// shows ≥1 occurrence. pointerEvents="none" so the PDF scroll stays
// responsive. The text is server-issued where possible (`yt-playback-sign`
// doesn't apply here so we fall back to the local formatter).

import { View, Text } from "react-native";

const COLS = 3;
const ROWS = 4;

export function PdfWatermark({ text }: { text: string }) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push({ key: `${r}-${c}`, r, c });
    }
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", inset: 0 as never, zIndex: 30 }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "column",
        }}
      >
        {Array.from({ length: ROWS }).map((_, r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row" }}>
            {Array.from({ length: COLS }).map((__, c) => (
              <View
                key={`${r}-${c}`}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <Text
                  style={{
                    transform: [{ rotate: "-30deg" }],
                    color: "rgba(255,255,255,0.65)",
                    opacity: 0.35,
                    fontSize: 14,
                    fontWeight: "700",
                    textShadowColor: "rgba(0,0,0,0.7)",
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 1.5,
                  }}
                >
                  {text}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
