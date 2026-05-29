"use client";

import { Flag } from "lucide-react";

interface Props {
  flagged: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function FlagButton({ flagged, onToggle, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={flagged}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
        flagged
          ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 focus-visible:ring-amber-400"
          : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:ring-primary/40"
      }`}
    >
      <Flag
        className="size-3.5 transition-colors"
        fill={flagged ? "#f59e0b" : "transparent"}
        strokeWidth={2}
      />
      {flagged ? "Flagged" : "Flag"}
    </button>
  );
}
