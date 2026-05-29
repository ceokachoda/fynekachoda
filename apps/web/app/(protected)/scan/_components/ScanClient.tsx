"use client";

// Phase 4 Track 4B — teacher webcam QR scan. Mirrors mobile (teacher)/scan.tsx
// but with browser primitives:
// - getUserMedia ONLY after the Start camera button (iOS Safari needs a
//   gesture). The WebcamScanner is gated on `active`.
// - Re-mount the scanner (resetKey++) on "Reset camera" to recover from iOS
//   Safari camera freezes after backgrounding.
// - On decode → useScanVerify (500ms debounce + same-token dedup).
// - Permission-denied → CTA to the roster of the active session.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CameraOff,
  ChevronDown,
  Loader2,
  RotateCcw,
  ListChecks,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/fyne/Pill";
import { ScannerOverlay } from "@/components/teacher/ScannerOverlay";
import { WebcamScanner } from "@/components/teacher/WebcamScanner";
import { useScanVerify } from "@/features/teacher/useScanVerify";
import {
  pickNearestSession,
  useTeacherSessions,
  type TeacherSession,
} from "@/features/teacher/useTeacherSessions";
import type { ScanToast } from "@/features/teacher/scan-toast-mapper";

const TOAST_VISIBLE_MS = 2200;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionLabel(s: TeacherSession): string {
  return `${s.subject_name ?? "Class"} · ${fmtTime(s.scheduled_start)} · ${s.batch_name}`;
}

export function ScanClient() {
  const sessions = useTeacherSessions();
  const verify = useScanVerify();
  const [cameraOn, setCameraOn] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [overlayTone, setOverlayTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  const [toast, setToast] = useState<ScanToast | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedSessionId, setPickedSessionId] = useState<string | null>(null);

  const scannable = useMemo(
    () => (sessions.data ?? []).filter((s) => s.bucket !== "past"),
    [sessions.data],
  );

  const activeSessionId = useMemo(() => {
    if (pickedSessionId) return pickedSessionId;
    return pickNearestSession(scannable)?.id ?? null;
  }, [pickedSessionId, scannable]);

  const activeSession = useMemo(
    () => (sessions.data ?? []).find((s) => s.id === activeSessionId) ?? null,
    [sessions.data, activeSessionId],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((t: ScanToast) => {
    setToast(t);
    setOverlayTone(t.tone === "success" ? "success" : "error");
    setTimeout(() => setOverlayTone("neutral"), 700);
  }, []);

  const handleDecode = useCallback(
    async (payload: string) => {
      if (verify.busy) return;
      if (!activeSessionId) {
        showToast({
          tone: "error",
          title: "Pick a class",
          subtitle: "Select which class you're marking before scanning.",
        });
        return;
      }
      const result = await verify.verify(payload, activeSessionId);
      if (result) showToast(result);
    },
    [verify, activeSessionId, showToast],
  );

  const startCamera = useCallback(() => {
    setPermissionDenied(false);
    setCameraOn(true);
  }, []);

  const stopCamera = useCallback(() => {
    setCameraOn(false);
    setOverlayTone("neutral");
  }, []);

  const onError = useCallback(
    (err: Error) => {
      const msg = err.message?.toLowerCase() ?? "";
      if (
        msg.includes("not allowed") ||
        msg.includes("permission") ||
        msg.includes("notallowed") ||
        msg.includes("notreadable")
      ) {
        setPermissionDenied(true);
        setCameraOn(false);
        showToast({
          tone: "error",
          title: "Camera blocked",
          subtitle:
            "Allow camera in the browser, or open the roster to mark attendance manually.",
        });
      }
    },
    [showToast],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Scan</h1>
          <p className="text-sm text-slate-500">
            Point the camera at a student&apos;s rotating QR.
          </p>
        </div>
        {cameraOn ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetKey((k) => k + 1)}
              aria-label="Reset camera"
            >
              <RotateCcw />
              Reset camera
            </Button>
            <Button variant="outline" size="sm" onClick={stopCamera}>
              <CameraOff />
              Stop
            </Button>
          </div>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          data-testid="scan-session-picker"
        >
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
              Scanning for
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
              {sessions.isLoading
                ? "Loading classes…"
                : activeSession
                  ? sessionLabel(activeSession)
                  : "No live or upcoming class — pick one"}
            </p>
          </div>
          <ChevronDown
            className={`size-4 text-slate-500 transition-transform ${pickerOpen ? "rotate-180" : ""}`}
          />
        </button>
        {pickerOpen ? (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            {scannable.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">
                No upcoming or live classes in your batches.
              </p>
            ) : (
              scannable.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPickedSessionId(s.id);
                    setPickerOpen(false);
                  }}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/70 focus-visible:outline-none"
                >
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {s.subject_name ?? "Class"} · {fmtTime(s.scheduled_start)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.batch_name} · {s.bucket === "today" ? "Today" : "Upcoming"}
                  </p>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 sm:mx-auto">
        {cameraOn ? (
          <WebcamScanner
            active
            resetKey={resetKey}
            onDecode={handleDecode}
            onError={onError}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white/10">
              <Camera className="size-7" />
            </div>
            <p className="text-base font-bold">Camera is off</p>
            <p className="mt-1 max-w-xs text-xs text-white/60">
              Tap Start camera. We&apos;ll ask permission, then verify each
              scanned QR against the active class.
            </p>
            <Button onClick={startCamera} className="mt-5">
              Start camera
            </Button>
          </div>
        )}
        {cameraOn ? (
          <ScannerOverlay
            hint={
              verify.busy
                ? "Verifying…"
                : activeSessionId
                  ? "Point at the student's QR"
                  : "Pick a class first"
            }
            tone={overlayTone}
          />
        ) : null}
        {toast ? (
          <div className="pointer-events-none absolute inset-x-3 top-3">
            <div
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-white shadow-lg ${
                toast.tone === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
              role="status"
              data-testid="scan-toast"
            >
              {toast.tone === "success" ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <XCircle className="size-5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{toast.title}</p>
                <p className="text-xs text-white/85">{toast.subtitle}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {permissionDenied ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Camera permission was blocked.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Allow camera access in your browser, or open the roster to mark
            attendance by hand — the audit log captures both methods.
          </p>
          {activeSessionId ? (
            <Link
              href={`/roster/${activeSessionId}`}
              className="mt-3 inline-flex items-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
            >
              <ListChecks className="mr-1 size-3.5" />
              Open roster instead
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        {activeSessionId ? (
          <Link
            href={`/roster/${activeSessionId}`}
            className="flex items-center text-sm font-semibold text-primary hover:underline"
          >
            <ListChecks className="mr-1 size-4" />
            Open roster for this class
          </Link>
        ) : null}
        {verify.busy ? (
          <Pill tone="primary">
            <Loader2 className="mr-1 size-3 animate-spin" />
            Verifying…
          </Pill>
        ) : null}
      </div>

      {sessions.isLoading ? <Skeleton className="h-10 w-full" /> : null}
    </div>
  );
}
