"use client";

// CSS-tiled diagonal watermark for the PDF viewer. 3x4 grid, -30°, opacity
// 0.35, white text with shadow. The overlay is `position: fixed inset:0` so
// it stays visible across all scroll positions.

const ROWS = 4;
const COLS = 3;

export function PdfWatermark({ text }: { text: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 grid select-none"
      style={{
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
      }}
    >
      {Array.from({ length: ROWS * COLS }).map((_, i) => (
        <span
          key={i}
          className="flex items-center justify-center overflow-hidden text-sm font-bold"
          style={{
            transform: "rotate(-30deg)",
            color: "rgba(255,255,255,0.65)",
            opacity: 0.35,
            textShadow: "1px 1px 1.5px rgba(0,0,0,0.7)",
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
