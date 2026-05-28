"use client";

// Phase 4 Track 4B — webcam QR verify with debounce + same-token dedup.
// Mirrors mobile features/attendance/useScanVerify.ts; uses invokeEdgeFn so we
// keep the real HTTP status (the toast mapper consumes it).

import { useCallback, useRef, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";
import {
  mapScanResponseToToast,
  type ScanToast,
  type ScanVerifyBody,
} from "./scan-toast-mapper";

const CLIENT_DEBOUNCE_MS = 500;
const SAME_TOKEN_SUPPRESS_MS = 1500;

export function useScanVerify() {
  const [busy, setBusy] = useState(false);
  const lastCallAt = useRef<number>(0);
  const lastPayload = useRef<string | null>(null);

  const verify = useCallback(
    async (
      qrPayload: string,
      sessionId: string,
    ): Promise<ScanToast | null> => {
      const now = Date.now();
      if (now - lastCallAt.current < CLIENT_DEBOUNCE_MS) return null;
      if (
        qrPayload === lastPayload.current &&
        now - lastCallAt.current < SAME_TOKEN_SUPPRESS_MS
      ) {
        return null;
      }
      lastCallAt.current = now;
      lastPayload.current = qrPayload;
      setBusy(true);
      try {
        const { status, body } = await invokeEdgeFn<ScanVerifyBody>(
          "attendance-qr-verify",
          { qr_payload: qrPayload, session_id: sessionId },
        );
        return mapScanResponseToToast(status, body);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { verify, busy };
}
