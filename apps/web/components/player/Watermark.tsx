"use client";

// Visible CSS-animated watermark overlay. 5 corner/center positions cycled
// every 60s via @keyframes — no React re-renders. Sits absolute on top of
// the video player.

export function Watermark({ text }: { text: string }) {
  return (
    <>
      <style>{`
@keyframes wmCycle {
  0%   { top: 12px; left: 12px; right: auto; bottom: auto; }
  20%  { top: 12px; left: auto; right: 12px; bottom: auto; }
  40%  { top: auto; left: 12px; right: auto; bottom: 12px; }
  60%  { top: auto; left: auto; right: 12px; bottom: 12px; }
  80%  { top: auto; left: 40%; right: auto; bottom: 12px; }
  100% { top: 12px; left: 12px; right: auto; bottom: auto; }
}
`}</style>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute z-30 select-none rounded px-1.5 py-0.5 text-xs font-semibold"
        style={{
          color: "rgba(255,255,255,0.85)",
          textShadow: "1px 1px 2px rgba(0,0,0,0.85)",
          opacity: 0.7,
          animation: "wmCycle 60s steps(5, end) infinite",
        }}
      >
        {text}
      </span>
    </>
  );
}
