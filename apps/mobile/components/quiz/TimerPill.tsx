import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Clock } from "lucide-react-native";

interface Props {
  deadlineAt: string; // ISO
  serverNow: string;  // ISO at the moment the attempt began
  // Live (server - device) clock offset in ms. When supplied (exam screen,
  // re-synced every 60s) the countdown is computed against the corrected
  // server clock, so a mid-attempt device-clock change is undone at the next
  // sync and the timer auto-submits at the REAL deadline. When omitted (quiz
  // screen) we fall back to a one-time offset derived from `serverNow` at
  // mount — identical to the previous behaviour.
  offsetMs?: number;
  onExpire?: () => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Server-anchored countdown. `remaining = deadlineAt - (now_device + offset)`,
// recomputed every tick (and immediately whenever `offsetMs` re-syncs). Using
// a wall-clock estimate rather than a frozen mount snapshot means the timer
// survives both app-background (device clock keeps real time) AND device-clock
// tampering (the server offset corrects it within one resync window).
export function TimerPill({ deadlineAt, serverNow, offsetMs, onExpire }: Props) {
  const deadlineMs = new Date(deadlineAt).getTime();

  // Fallback offset (quiz path / before the first exam resync): derived ONCE
  // from the entry server_now so a skewed device clock doesn't poison entry.
  const mountOffsetRef = useRef<number | null>(null);
  if (mountOffsetRef.current === null) {
    mountOffsetRef.current = new Date(serverNow).getTime() - Date.now();
  }
  const effectiveOffset = offsetMs ?? mountOffsetRef.current ?? 0;

  // Keep onExpire current without re-arming the interval each parent render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedRef = useRef(false);

  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, deadlineMs - (Date.now() + effectiveOffset)),
  );

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, deadlineMs - (Date.now() + effectiveOffset));
      setRemainingMs(next);
      if (next === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };
    tick(); // recompute immediately when the offset re-syncs
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, effectiveOffset]);

  const totalSec = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const isWarn = remainingMs <= 60_000;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isWarn ? "#fee2e2" : "#eff6ff",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: isWarn ? "#fca5a5" : "#bfdbfe",
      }}
    >
      <Clock size={14} color={isWarn ? "#b91c1c" : "#1d4ed8"} />
      <Text
        style={{
          marginLeft: 6,
          color: isWarn ? "#b91c1c" : "#1d4ed8",
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {pad2(m)}:{pad2(s)}
      </Text>
    </View>
  );
}
