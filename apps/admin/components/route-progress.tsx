"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top-of-viewport buffering bar shown while a navigation is in flight.
 *
 * START is detected purely passively: a capture-phase click listener watches
 * for left-clicks on in-app anchors (the sidebar nav + every <Link>). It never
 * calls preventDefault/stopPropagation, so it cannot change navigation
 * behaviour — it only triggers the visual bar. Back/forward (popstate) also
 * starts it.
 *
 * FINISH is driven by Next's router: when the destination route commits, the
 * pathname / search params change and we run the bar to 100% and fade it out.
 * A safety timeout guarantees the bar can never hang on an edge case.
 */
function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const activeRef = useRef(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTrickle = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const done = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTrickle();
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
  }, [clearTrickle]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    setVisible(true);
    setProgress(10);
    clearTrickle();
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const inc = p < 25 ? 9 : p < 55 ? 5 : p < 80 ? 2 : 0.6;
        return Math.min(90, p + inc);
      });
    }, 240);
    // Never let the bar hang if a navigation is cancelled or never commits.
    safetyRef.current = setTimeout(done, 12000);
  }, [clearTrickle, done]);

  // Navigation committed → finish.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchKey]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.hasAttribute("download")) return;

      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;

      let dest: URL;
      try {
        dest = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;

      // Same URL (or hash-only change) → no route load, so no bar.
      const current = window.location.pathname + window.location.search;
      const next = dest.pathname + dest.search;
      if (next === current) return;

      start();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      clearTrickle();
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [start, clearTrickle]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        insetInline: 0,
        top: 0,
        zIndex: 100,
        height: 3,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background:
            "linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #06b6d4 100%)",
          borderRadius: "0 9999px 9999px 0",
          boxShadow:
            "0 0 8px rgba(37, 99, 235, 0.55), 0 0 4px rgba(6, 182, 212, 0.45)",
          opacity: progress >= 100 ? 0 : 1,
          transition:
            "width 240ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease",
        }}
      />
    </div>
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  );
}
