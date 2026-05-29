"use client";

import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useQrToken } from "@/features/attendance/useQrToken";

export function QrDisplay({
  sessionId,
  sessionLabel,
}: {
  sessionId: string | null;
  sessionLabel: string;
}) {
  const { state, refresh } = useQrToken(sessionId);
  return (
    <div className="flex flex-col items-center rounded-sheet border border-slate-200 bg-white p-6 shadow-md">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        QR for
      </p>
      <p className="mb-4 mt-1 text-base font-bold text-slate-900">{sessionLabel}</p>
      {state.kind === "token" ? (
        <>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <QRCodeSVG
              value={state.payload_b64}
              size={180}
              fgColor="#1e293b"
              bgColor="#ffffff"
              level="M"
              aria-label="Attendance QR code"
            />
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500" aria-live="polite">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Refreshes in {state.secondsLeft}s
          </p>
        </>
      ) : state.kind === "error" && state.code === "already_marked" ? (
        <div className="flex w-[200px] flex-col items-center justify-center py-6">
          <CheckCircle2 className="size-12 text-emerald-500" />
          <p className="mt-3 text-center text-base font-bold text-emerald-700">
            You&apos;re marked!
          </p>
        </div>
      ) : state.kind === "error" ? (
        <div className="flex w-[200px] flex-col items-center justify-center py-6">
          <AlertCircle className="size-10 text-red-500" />
          <p className="mt-3 text-center text-sm font-semibold text-red-600">
            {state.message}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="flex h-[180px] w-[180px] items-center justify-center">
          <RefreshCw className="size-6 animate-spin text-slate-400" />
        </div>
      )}
    </div>
  );
}
