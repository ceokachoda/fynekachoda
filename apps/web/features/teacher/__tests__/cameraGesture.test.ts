// Phase 4 Track 4B — source-scan check: the WebcamScanner MUST NOT trigger
// getUserMedia before the parent flips `active` (i.e. before a user gesture
// presses "Start camera"). iOS Safari rejects camera requests that fire on
// mount. A regression here would silently break the scan page on iPhone.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("WebcamScanner — camera gating", () => {
  const path = resolve(__dirname, "../../../components/teacher/WebcamScanner.tsx");
  const src = readFileSync(path, "utf8");

  it("returns null when active=false (guard against on-mount getUserMedia)", () => {
    // The Scanner component is only RENDERED under `active`. Look for the
    // exact early-return in source so that future refactors that drop the
    // gate fail this test loudly.
    expect(src).toMatch(/if\s*\(\s*!\s*active\s*\)\s*return\s+null\s*;/);
  });

  it("loads @yudiel/react-qr-scanner via next/dynamic with ssr:false", () => {
    expect(src).toMatch(/import\s+dynamic\s+from\s+["']next\/dynamic["']/);
    expect(src).toMatch(/ssr\s*:\s*false/);
    expect(src).toMatch(/@yudiel\/react-qr-scanner/);
  });

  it("requests rear (environment) camera so the QR is reachable on phones", () => {
    expect(src).toMatch(/facingMode\s*:\s*["']environment["']/);
  });

  it("restricts decode to qr_code (no other barcode noise)", () => {
    expect(src).toMatch(/qr_code/);
  });

  it("does NOT call navigator.mediaDevices.getUserMedia directly", () => {
    // The package owns getUserMedia; we should never call it ourselves.
    expect(src).not.toMatch(/navigator\.mediaDevices\.getUserMedia/);
  });
});
