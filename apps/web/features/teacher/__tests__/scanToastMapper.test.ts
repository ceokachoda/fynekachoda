// Phase 4 Track 4B — pure mapping of attendance-qr-verify responses to the
// on-screen toast. Validates each HTTP status code path independently so we
// don't have to spin up jsdom or mock supabase.

import { describe, expect, it } from "vitest";
import { mapScanResponseToToast } from "../scan-toast-mapper";

describe("mapScanResponseToToast", () => {
  it("200 + student name + status=present → success toast 'Marked present'", () => {
    const t = mapScanResponseToToast(200, {
      status: "present",
      student_name: "Aarav",
      attendance_id: "att-1",
    });
    expect(t.tone).toBe("success");
    expect(t.title).toContain("Aarav");
    expect(t.subtitle).toBe("Marked present");
  });

  it("200 + status=late → success toast 'Marked late'", () => {
    const t = mapScanResponseToToast(200, {
      status: "late",
      student_name: "Diya",
      attendance_id: "att-2",
    });
    expect(t.tone).toBe("success");
    expect(t.subtitle).toBe("Marked late");
  });

  it("200 without attendance_id → falls back to a 'Couldn't verify' message via the default branch", () => {
    const t = mapScanResponseToToast(200, {
      status: "present",
      student_name: "Aarav",
    } as never);
    // No attendance_id → drops out of the 200 branch, default branch fires.
    expect(t.tone).toBe("error");
  });

  it("401 → Invalid QR", () => {
    const t = mapScanResponseToToast(401, null);
    expect(t.title).toContain("Invalid");
  });

  it("400 with 'expired' message → QR expired", () => {
    const t = mapScanResponseToToast(400, { error: "QR expired 5s ago" });
    expect(t.title).toContain("expired");
  });

  it("400 with 'different class' → Wrong class", () => {
    const t = mapScanResponseToToast(400, {
      error: "QR belongs to a different class",
    });
    expect(t.title).toContain("Wrong class");
  });

  it("400 with 'window closed' → Window closed", () => {
    const t = mapScanResponseToToast(400, { error: "window closed" });
    expect(t.title).toContain("Window closed");
  });

  it("400 with unrelated error → generic 'Couldn't verify'", () => {
    const t = mapScanResponseToToast(400, { error: "weird" });
    expect(t.title).toBe("Couldn't verify");
    expect(t.subtitle).toContain("weird");
  });

  it("403 → Not your class", () => {
    expect(mapScanResponseToToast(403, null).title).toContain("Not your class");
  });

  it("404 → Not found", () => {
    expect(mapScanResponseToToast(404, null).title).toContain("Not found");
  });

  it("409 → Already marked", () => {
    expect(mapScanResponseToToast(409, null).title).toContain("Already marked");
  });

  it("410 → QR expired", () => {
    expect(mapScanResponseToToast(410, null).title).toContain("expired");
  });

  it("429 → Slow down", () => {
    expect(mapScanResponseToToast(429, null).title).toContain("Slow down");
  });

  it("0 (network) → No network", () => {
    expect(mapScanResponseToToast(0, null).title).toContain("No network");
  });

  it("unmapped status (500) → generic with status in subtitle", () => {
    const t = mapScanResponseToToast(500, null);
    expect(t.tone).toBe("error");
    expect(t.subtitle).toContain("500");
  });
});
