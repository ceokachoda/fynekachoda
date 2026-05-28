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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
        flagged
          ? "border-amber-400 bg-amber-100 text-amber-900"
          : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <Flag
        className="size-3.5"
        fill={flagged ? "#f59e0b" : "transparent"}
        strokeWidth={2}
      />
      {flagged ? "Flagged" : "Flag"}
    </button>
  );
}
