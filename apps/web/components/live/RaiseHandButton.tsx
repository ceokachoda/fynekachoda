"use client";

import { Hand, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RaiseHandButtonProps {
  raised: boolean;
  busy?: boolean;
  disabled?: boolean;
  onRaise: () => void;
  onLower: () => void;
}

export function RaiseHandButton({
  raised,
  busy,
  disabled,
  onRaise,
  onLower,
}: RaiseHandButtonProps) {
  return (
    <button
      type="button"
      data-testid="raise-hand-button"
      onClick={raised ? onLower : onRaise}
      disabled={disabled || busy}
      aria-label={raised ? "Lower hand" : "Raise hand"}
      aria-pressed={raised}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        raised
          ? "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400"
          : "bg-blue-800 hover:bg-blue-900 focus-visible:ring-blue-500",
        (disabled || busy) && "cursor-not-allowed opacity-50",
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Hand className="size-4" />
      )}
      <span>{raised ? "Lower hand" : "Raise hand"}</span>
    </button>
  );
}
