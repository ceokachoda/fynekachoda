"use client";

// Phase 4 Track 4B — webcam QR scanner wrapper. Lazily loads
// @yudiel/react-qr-scanner via next/dynamic({ ssr: false }) so the package
// (which uses BarcodeDetector / OffscreenCanvas / getUserMedia) doesn't ship
// in the initial /scan bundle. Browser-only; never rendered on the server.
//
// LOCKED DECISIONS:
// - getUserMedia is started ONLY when the parent flips `active=true` after a
//   gesture (mounting the lazy component triggers the request prompt). This
//   keeps the iOS Safari "permission prompt requires user gesture" path safe.
// - Decode is fired up to ~the camera's frame rate; the parent's
//   useScanVerify debounces + dedupes before hitting the edge fn.
// - Re-mounting the component (incrementing `resetKey`) is how we force a
//   camera restart when iOS Safari freezes the stream after backgrounding.

import dynamic from "next/dynamic";

interface WebcamScannerProps {
  active: boolean;
  resetKey?: number;
  onDecode: (text: string) => void;
  onError?: (err: Error) => void;
}

// `as const` keeps the BarcodeFormat literal narrow so dynamic<Props> stays
// inferred from the lib's own ForwardRefExoticComponent — no `formats: string[]`
// widening.
const SCAN_FORMATS = ["qr_code"] as const;

// Let TypeScript infer Scanner's props from the package; do NOT pass a
// hand-written type param to dynamic() (caused TS2345 when the package's
// BarcodeFormat union wouldn't accept `string[]`).
const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((m) => ({ default: m.Scanner })),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-900 text-slate-400">
        Loading camera…
      </div>
    ),
  },
);

export function WebcamScanner({
  active,
  resetKey = 0,
  onDecode,
  onError,
}: WebcamScannerProps) {
  if (!active) return null;
  return (
    <Scanner
      key={`scanner-${resetKey}`}
      onScan={(results) => {
        for (const r of results) {
          if (r.rawValue) onDecode(r.rawValue);
        }
      }}
      onError={(e: unknown) => {
        if (onError) {
          onError(e instanceof Error ? e : new Error(String(e)));
        }
      }}
      constraints={{ facingMode: "environment" }}
      scanDelay={250}
      formats={[...SCAN_FORMATS]}
      components={{
        onOff: false,
        finder: false,
        torch: false,
        zoom: false,
      }}
      styles={{
        container: { width: "100%", height: "100%" },
        video: { width: "100%", height: "100%", objectFit: "cover" },
      }}
    />
  );
}
