"use client";

// Phase 4 Track 4B — corner-bracket viewfinder for the webcam QR scanner.
// Renders ABOVE the camera surface (the qr-scanner component sits behind it).

import { cn } from "@/lib/utils";

interface ScannerOverlayProps {
  hint?: string;
  tone?: "neutral" | "success" | "error";
}

const TONES: Record<NonNullable<ScannerOverlayProps["tone"]>, string> = {
  neutral: "border-white/80",
  success: "border-emerald-400",
  error: "border-red-500",
};

export function ScannerOverlay({ hint, tone = "neutral" }: ScannerOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative aspect-square w-[min(70vw,360px)]">
        <span
          className={cn(
            "absolute -top-1 -left-1 size-10 rounded-tl-2xl border-t-4 border-l-4 transition-colors",
            TONES[tone],
          )}
        />
        <span
          className={cn(
            "absolute -top-1 -right-1 size-10 rounded-tr-2xl border-t-4 border-r-4 transition-colors",
            TONES[tone],
          )}
        />
        <span
          className={cn(
            "absolute -bottom-1 -left-1 size-10 rounded-bl-2xl border-b-4 border-l-4 transition-colors",
            TONES[tone],
          )}
        />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 size-10 rounded-br-2xl border-b-4 border-r-4 transition-colors",
            TONES[tone],
          )}
        />
      </div>
      {hint ? (
        <p className="mt-6 max-w-xs rounded-full bg-black/60 px-4 py-2 text-center text-xs font-semibold text-white">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
