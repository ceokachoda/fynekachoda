// Accessibility helper: is the OS "reduce motion" preference active?
//
// CSS animations/transitions are neutralised globally via a
// `@media (prefers-reduced-motion: reduce)` block in globals.css. This helper
// gates JS-driven motion that CSS can't reach (e.g. canvas-confetti). SSR-safe:
// returns false on the server / when matchMedia is unavailable.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
