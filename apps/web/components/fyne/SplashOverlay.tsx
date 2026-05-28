import { Loader2 } from "lucide-react";
import { FyneLogo } from "./FyneLogo";
import { cn } from "@/lib/utils";

export type SplashStatus = "loading" | "ok" | "fail";

interface SplashOverlayProps {
  status?: SplashStatus;
  message?: string;
  /** Render full-screen overlay (default), or inline at the component's parent size. */
  inline?: boolean;
  className?: string;
}

// Ports apps/mobile/components/SplashOverlay.tsx — centered logo + spinner.
// Renders as a positioned full-screen overlay by default; pass `inline` to use
// inside a constrained container (e.g. a router loading.tsx).
export function SplashOverlay({
  status = "loading",
  message,
  inline = false,
  className,
}: SplashOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="splash-overlay"
      className={cn(
        inline
          ? "flex h-full w-full flex-col items-center justify-center bg-background"
          : "fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background",
        className,
      )}
    >
      <div className="flex flex-col items-center">
        <FyneLogo variant="large" />
        <Loader2 className="mt-6 size-5 animate-spin text-primary" />
        {message ? (
          <p className="mt-3 text-xs font-medium text-slate-500">{message}</p>
        ) : null}
      </div>

      {status !== "loading" ? (
        <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center">
          <div className="flex items-center">
            <div
              className={cn(
                "mr-2 size-2 rounded-full",
                status === "ok" ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            <span
              className={cn(
                "text-xs font-semibold",
                status === "ok" ? "text-emerald-600" : "text-red-600",
              )}
            >
              {status === "ok" ? "Backend: connected" : "Backend: unreachable"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
