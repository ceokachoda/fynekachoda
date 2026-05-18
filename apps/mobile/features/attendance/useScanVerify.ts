import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export type VerifyResult =
  | {
      kind: "success";
      status: "present" | "late";
      student_name: string;
      attendance_id: string;
    }
  | {
      kind: "error";
      code:
        | "bad_signature"
        | "expired"
        | "wrong_session"
        | "window_closed"
        | "forbidden"
        | "not_found"
        | "already_marked"
        | "rate_limited"
        | "network"
        | "unknown";
      message: string;
    };

interface VerifyResponse {
  status?: "present" | "late";
  student_name?: string;
  attendance_id?: string;
  error?: string;
  detail?: unknown;
}

// Server enforces 2 verifies/sec/teacher (D-115). The client debounce mirrors
// this so successive QR scans within the same window are dropped before they
// reach the wire. Keeps the success haptic + toast cycle clean.
const CLIENT_DEBOUNCE_MS = 500;

export function useScanVerify() {
  const [busy, setBusy] = useState(false);
  const lastCallAt = useRef<number>(0);
  const lastPayload = useRef<string | null>(null);

  const verify = useCallback(
    async (qrPayload: string, sessionId: string): Promise<VerifyResult | null> => {
      const now = Date.now();
      if (now - lastCallAt.current < CLIENT_DEBOUNCE_MS) {
        return null;
      }
      if (qrPayload === lastPayload.current && now - lastCallAt.current < 1500) {
        return null;
      }
      lastCallAt.current = now;
      lastPayload.current = qrPayload;
      setBusy(true);

      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke<VerifyResponse>("attendance-qr-verify", {
            body: { qr_payload: qrPayload, session_id: sessionId },
          }),
        );

        if (error) {
          const status = (error as { context?: { status?: number } }).context?.status;
          const detail = data as VerifyResponse | null;
          const message = detail?.error;

          if (status === 401) {
            return {
              kind: "error",
              code: "bad_signature",
              message: "QR signature invalid",
            };
          }
          if (status === 400) {
            if (message?.includes("expired")) {
              return {
                kind: "error",
                code: "expired",
                message: "QR expired — ask student to refresh",
              };
            }
            if (message?.includes("different class")) {
              return {
                kind: "error",
                code: "wrong_session",
                message: "QR belongs to a different class",
              };
            }
            if (message?.includes("window closed")) {
              return {
                kind: "error",
                code: "window_closed",
                message: "Scan window closed for new entries",
              };
            }
            return {
              kind: "error",
              code: "unknown",
              message: message ?? "Couldn't verify QR",
            };
          }
          if (status === 403) {
            return {
              kind: "error",
              code: "forbidden",
              message: "Not authorized for this batch",
            };
          }
          if (status === 404) {
            return {
              kind: "error",
              code: "not_found",
              message: "Session or student not found",
            };
          }
          if (status === 409) {
            return {
              kind: "error",
              code: "already_marked",
              message: "Already marked",
            };
          }
          if (status === 429) {
            return {
              kind: "error",
              code: "rate_limited",
              message: "Slow down — too many scans",
            };
          }
          if (isNetworkError(error)) {
            return {
              kind: "error",
              code: "network",
              message: NETWORK_ERROR_MESSAGE,
            };
          }
          return {
            kind: "error",
            code: "unknown",
            message: message ?? "Couldn't verify QR",
          };
        }

        if (!data?.status || !data.attendance_id) {
          return {
            kind: "error",
            code: "unknown",
            message: "Server returned an unexpected response",
          };
        }
        return {
          kind: "success",
          status: data.status,
          student_name: data.student_name ?? "Student",
          attendance_id: data.attendance_id,
        };
      } catch (err) {
        if (isNetworkError(err)) {
          return {
            kind: "error",
            code: "network",
            message: NETWORK_ERROR_MESSAGE,
          };
        }
        return {
          kind: "error",
          code: "unknown",
          message: "Couldn't verify QR",
        };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { verify, busy };
}
