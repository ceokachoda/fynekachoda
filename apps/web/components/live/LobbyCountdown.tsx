"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";

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

interface LobbyCountdownProps {
  scheduledStart: string;
  subjectName?: string | null;
}

export function LobbyCountdown({
  scheduledStart,
  subjectName,
}: LobbyCountdownProps) {
  const [state, setState] = useState(() => remaining(scheduledStart));

  useEffect(() => {
    setState(remaining(scheduledStart));
    const t = setInterval(() => setState(remaining(scheduledStart)), 1000);
    return () => clearInterval(t);
  }, [scheduledStart]);

  return (
    <div
      data-testid="lobby-countdown"
      className="flex h-full w-full flex-col items-center justify-center bg-slate-900 px-8 py-12 text-center"
    >
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-white/10">
        <Radio className="size-7 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white">
        {subjectName ?? "Live class"}
      </h2>
      {state.started ? (
        <>
          <Loader2
            className="mt-5 size-5 animate-spin text-white"
            aria-hidden
          />
          <p className="mt-3 text-sm text-slate-300">
            Waiting for the teacher to go live…
          </p>
          <p className="mt-1 text-xs text-slate-500">
            This screen will start automatically.
          </p>
        </>
      ) : (
        <>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-slate-400">
            Starts in
          </p>
          <p
            className="mt-1 text-4xl font-extrabold text-white tabular-nums"
            aria-live="polite"
          >
            {state.label}
          </p>
        </>
      )}
    </div>
  );
}
