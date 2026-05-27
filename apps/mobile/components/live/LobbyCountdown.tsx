// Phase 9 — pre-live lobby. Counts down to the scheduled start, then shows a
// "waiting for the teacher to go live" state (the screen polls session.status).
//
// Styling is INLINE on purpose (not className): css-interop freezes a static-
// className subtree that re-renders every second, so the timer text would stick
// (D-162). The working exam TimerPill uses the same inline + state-driven shape.

import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Radio } from "lucide-react-native";

function remaining(targetIso: string): { started: boolean; label: string } {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return { started: true, label: "00:00" };
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return { started: false, label: h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}` };
}

export function LobbyCountdown({
  scheduledStart,
  subjectName,
}: {
  scheduledStart: string;
  subjectName?: string | null;
}) {
  const [state, setState] = useState(() => remaining(scheduledStart));

  useEffect(() => {
    setState(remaining(scheduledStart));
    const t = setInterval(() => setState(remaining(scheduledStart)), 1000);
    return () => clearInterval(t);
  }, [scheduledStart]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        paddingHorizontal: 32,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "rgba(255,255,255,0.1)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Radio size={28} color="#fff" />
      </View>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" }}>
        {subjectName ?? "Live class"}
      </Text>
      {state.started ? (
        <>
          <ActivityIndicator size="small" color="#fff" style={{ marginTop: 18 }} />
          <Text style={{ color: "#cbd5e1", fontSize: 14, marginTop: 12, textAlign: "center" }}>
            Waiting for the teacher to go live…
          </Text>
          <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" }}>
            This screen will start automatically.
          </Text>
        </>
      ) : (
        <>
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 12,
              marginTop: 24,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Starts in
          </Text>
          <Text
            style={{
              color: "#fff",
              fontSize: 36,
              fontWeight: "800",
              marginTop: 4,
              fontVariant: ["tabular-nums"],
            }}
          >
            {state.label}
          </Text>
        </>
      )}
    </View>
  );
}
