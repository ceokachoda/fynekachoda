import { cn } from "@/lib/utils";

interface FyneLogoProps {
  variant?: "large" | "header";
  className?: string;
}

// Ports apps/mobile/components/FyneStudyLogo.tsx — blue→dark gradient round-rect
// with three white rounded rects inside, followed by the lowercase wordmark.
export function FyneLogo({ variant = "large", className }: FyneLogoProps) {
  const isLarge = variant === "large";
  const size = isLarge ? 46 : 28;

  return (
    <div className={cn("flex flex-row items-center justify-center", className)}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="fyne-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
        <path
          d="M 50 5 C 85 5 95 15 95 50 C 95 85 85 95 50 95 C 15 95 5 85 5 50 C 5 15 15 5 50 5 Z"
          fill="url(#fyne-logo-grad)"
        />
        <rect x="50" y="34" width="24" height="12" rx="2.5" fill="white" />
        <rect x="28" y="50" width="26" height="12" rx="2.5" fill="white" />
        <rect x="28" y="66" width="12" height="12" rx="2.5" fill="white" />
      </svg>
      <span
        className={cn(
          "font-bold tracking-tighter text-slate-900",
          isLarge ? "ml-3 text-[32px]" : "ml-2 text-xl",
        )}
      >
        fynestudy
      </span>
    </div>
  );
}
