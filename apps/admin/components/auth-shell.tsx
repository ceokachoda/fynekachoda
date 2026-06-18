import type { ReactNode } from "react";
import { FyneLogo } from "@/components/fyne-logo";
import { cn } from "@/lib/utils";

const BACKDROP =
  "radial-gradient(48rem 28rem at 50% -8%, rgba(59,91,219,0.12), transparent 70%), radial-gradient(38rem 24rem at 85% 110%, rgba(79,70,229,0.10), transparent 70%)";

// Shared chrome for the full-screen auth flows (force-password-change, 2FA
// enroll/verify, access-denied). Brand-forward header + soft gradient backdrop
// + elevated card, matching the sign-in page.
export function AuthShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 dark:bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: BACKDROP }}
      />
      <div className={cn("relative w-full max-w-md space-y-6", className)}>
        <header className="flex flex-col items-center space-y-3 text-center">
          <FyneLogo variant="header" />
          {title || description ? (
            <div className="space-y-1">
              {title ? (
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
              ) : null}
            </div>
          ) : null}
        </header>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-card p-7 shadow-xl shadow-slate-900/[0.05] dark:shadow-none">
          {children}
        </div>
        {footer}
      </div>
    </main>
  );
}
