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
    <div className="flex flex-col items-center rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
        QR for
      </p>
      <p className="mb-4 mt-1 text-base font-bold text-slate-900">{sessionLabel}</p>
      {state.kind === "token" ? (
        <>
          <div className="bg-white p-3">
            <QRCodeSVG
              value={state.payload_b64}
              size={180}
              fgColor="#1e293b"
              bgColor="#ffffff"
              level="M"
              aria-label="Attendance QR code"
            />
          </div>
          <p className="mt-4 text-xs text-slate-500">
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
            className="mt-4 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
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
