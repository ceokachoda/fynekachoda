"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Will wire Sentry here once it's enabled (Phase 1 carry-over).
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            We hit an unexpected error. The team has been notified.
          </p>
          {error.digest ? (
            <p className="mt-4 text-[11px] font-mono text-slate-400">
              Reference: {error.digest}
            </p>
          ) : null}
          {process.env.NODE_ENV !== "production" ? (
            <pre
              data-testid="dev-error-detail"
              className="mt-4 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-left text-[11px] font-mono text-white"
            >
              {error.message}
              {error.stack ? `\n\n${error.stack}` : null}
            </pre>
          ) : null}
          <Button onClick={reset} size="lg" className="mt-6 h-11 w-full">
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
