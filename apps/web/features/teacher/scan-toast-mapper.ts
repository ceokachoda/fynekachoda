// Phase 4 Track 4B — pure helper mapping `attendance-qr-verify` responses
// (HTTP status + optional error body) to the on-screen toast.
//
// Pulled out of the hook so it's testable without spinning up jsdom or
// mocking supabase. Mirrors the mobile toast wording (project_phase-4-status)
// so QA scripts can compare like-for-like.

export type ScanToastTone = "success" | "error";

export interface ScanToast {
  tone: ScanToastTone;
  title: string;
  subtitle: string;
}

export type ScanVerifyBody = {
  status?: "present" | "late";
  student_name?: string;
  attendance_id?: string;
  error?: string;
} | null;

export function mapScanResponseToToast(
  httpStatus: number,
  body: ScanVerifyBody,
): ScanToast {
  if (httpStatus === 200 && body?.status && body.attendance_id) {
    return {
      tone: "success",
      title: `✔ ${body.student_name ?? "Student"}`,
      subtitle:
        body.status === "late" ? "Marked late" : "Marked present",
    };
  }

  // Server gives the most useful sub-text via `body.error` — combine with
  // HTTP-status-derived headlines so the user sees an actionable message even
  // when the body is empty (e.g. network failure already returned status=0).
  const msg = body?.error ?? "";
  switch (httpStatus) {
    case 401:
      return { tone: "error", title: "Invalid QR", subtitle: "QR signature didn't verify." };
    case 400:
      if (msg.includes("expired")) {
        return { tone: "error", title: "QR expired", subtitle: "Ask the student to refresh their QR." };
      }
      if (msg.includes("different class")) {
        return { tone: "error", title: "Wrong class", subtitle: "QR belongs to a different class." };
      }
      if (msg.includes("window closed")) {
        return { tone: "error", title: "Window closed", subtitle: "Scan window is closed for new entries." };
      }
      return { tone: "error", title: "Couldn't verify", subtitle: msg || "QR was rejected." };
    case 403:
      return { tone: "error", title: "Not your class", subtitle: "You don't have access to this batch." };
    case 404:
      return { tone: "error", title: "Not found", subtitle: "Session or student not found." };
    case 409:
      return { tone: "error", title: "Already marked", subtitle: "Student is already in the roster." };
    case 410:
      return { tone: "error", title: "QR expired", subtitle: "Ask the student to refresh their QR." };
    case 429:
      return { tone: "error", title: "Slow down", subtitle: "Too many scans — wait a moment." };
    case 0:
      return { tone: "error", title: "No network", subtitle: "Check the connection and try again." };
    default:
      return {
        tone: "error",
        title: "Couldn't verify",
        subtitle: msg || `Server responded ${httpStatus}.`,
      };
  }
}
