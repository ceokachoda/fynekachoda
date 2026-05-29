"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { logError } from "@/lib/log";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Routed through the log shim — swap its body for Sentry later (§G3).
    logError(error, { digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-red-50/30 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
            <svg
              className="size-7 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            We hit an unexpected error. The team has been notified.
          </p>
          {error.digest ? (
            <p className="mt-4 inline-block rounded-md bg-slate-100 px-2 py-1 text-xs font-mono text-slate-500">
              Ref: {error.digest}
            </p>
          ) : null}
          {process.env.NODE_ENV !== "production" ? (
            <pre
              data-testid="dev-error-detail"
              className="mt-4 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-left text-xs font-mono leading-relaxed text-white"
            >
              {error.message}
              {error.stack ? `\n\n${error.stack}` : null}
            </pre>
          ) : null}
          <Button onClick={reset} size="lg" className="mt-6 h-12 w-full text-base font-bold shadow-sm transition-all hover:shadow-md">
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
