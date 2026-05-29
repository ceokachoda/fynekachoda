"use client";

// Server-anchored countdown. `remaining = deadlineAt - (now_device + offset)`
// recomputed every tick. Using a wall-clock estimate (not a frozen mount
// snapshot) means the timer survives both tab-background AND device-clock
// tampering — the latter is corrected at the next 60-s server-time resync.
//
// `offsetMs` (live, exam) is preferred; if absent (quiz, no resync) we fall
// back to a one-time mount-time offset derived from `serverNow`.

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { computeRemainingMs, formatRemainingMmSs } from "@/features/exams/useServerTimeOffset";

interface Props {
  deadlineAt: string; // ISO
  serverNow: string; // ISO at start moment
  offsetMs?: number;
  onExpire?: () => void;
}

export function TimerPill({ deadlineAt, serverNow, offsetMs, onExpire }: Props) {
  const deadlineMs = new Date(deadlineAt).getTime();

  // Mount offset is the fallback when a live resync stream isn't available
  // (i.e., the quiz screen). Captured once + held in a ref so a parent
  // re-render doesn't reset it.
  const mountOffsetRef = useRef<number | null>(null);
  if (mountOffsetRef.current === null) {
    mountOffsetRef.current = new Date(serverNow).getTime() - Date.now();
  }
  const effectiveOffset = offsetMs ?? mountOffsetRef.current ?? 0;

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedRef = useRef(false);

  const [remainingMs, setRemainingMs] = useState(() =>
    computeRemainingMs(deadlineMs, Date.now(), effectiveOffset),
  );

  useEffect(() => {
    const tick = () => {
      const next = computeRemainingMs(deadlineMs, Date.now(), effectiveOffset);
      setRemainingMs(next);
      if (next === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };
    tick(); // immediate recompute when offset re-syncs
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, effectiveOffset]);

  const isWarn = remainingMs <= 60_000;
  const label = formatRemainingMmSs(remainingMs);

  return (
    <span
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining ${label}`}
      data-warning={isWarn ? "true" : "false"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold tabular-nums transition-colors ${
        isWarn
          ? "border-red-300 bg-red-100 text-red-700 animate-pulse"
          : "border-blue-200 bg-blue-50 text-blue-700"
      }`}
    >
      <Clock className="size-4" />
      <span>{label}</span>
    </span>
  );
}
