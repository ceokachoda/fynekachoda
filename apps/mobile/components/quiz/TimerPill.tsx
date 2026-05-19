import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Clock } from "lucide-react-native";

interface Props {
  deadlineAt: string; // ISO
  serverNow: string;  // ISO at the moment the attempt began
  onExpire?: () => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Server-anchored countdown: we sync once on mount using `(deadlineAt -
// serverNow)` as the absolute remaining millis, then count down using local
// monotonic time. This survives device-clock-skew.
export function TimerPill({ deadlineAt, serverNow, onExpire }: Props) {
  const remainingInitial = Math.max(
    0,
    new Date(deadlineAt).getTime() - new Date(serverNow).getTime(),
  );
  const [remainingMs, setRemainingMs] = useState(remainingInitial);

  useEffect(() => {
    const mountedAt = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - mountedAt;
      const next = Math.max(0, remainingInitial - elapsed);
      setRemainingMs(next);
      if (next === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineAt, serverNow]);

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
