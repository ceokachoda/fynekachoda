"use client";

import { Flame } from "lucide-react";

interface Tier {
  color: string;
  size: number;
}

function tierFor(days: number): Tier {
  if (days <= 0) return { color: "#94a3b8", size: 18 };
  if (days < 7) return { color: "#f97316", size: 20 };
  if (days < 30) return { color: "#ea580c", size: 22 };
  if (days < 90) return { color: "#dc2626", size: 24 };
  return { color: "#eab308", size: 26 };
}

interface StreakFlameProps {
  currentDays: number;
  onClick?: () => void;
  ariaLabel?: string;
  size?: "sm" | "md";
}

export function StreakFlame({
  currentDays,
  onClick,
  ariaLabel = "Open streak details",
  size = "md",
}: StreakFlameProps) {
  const t = tierFor(currentDays);
  const compact = size === "sm";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-1.5 transition hover:border-slate-200"
    >
      <Flame
        style={{ width: t.size, height: t.size, color: t.color }}
        aria-hidden="true"
      />
      <span className={`font-bold text-slate-900 ${compact ? "text-xs" : "text-sm"}`}>
        {currentDays}
      </span>
      <span className={`text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>
        day{currentDays === 1 ? "" : "s"}
      </span>
    </button>
  );
}
