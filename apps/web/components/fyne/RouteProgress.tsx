"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top-of-viewport buffering bar shown while a navigation is in flight.
 *
 * START is detected purely passively: a capture-phase click listener watches
 * for left-clicks on in-app anchors (sidebar, bottom tabs, every <Link>). It
 * never calls preventDefault/stopPropagation, so it cannot change navigation
 * behaviour — it only triggers the visual bar. Back/forward (popstate) also
 * starts it.
 *
 * FINISH is driven by Next's router: when the destination route commits, the
 * pathname / search params change and we run the bar to 100% and fade it out.
 * The bar is held for a minimum visible duration so fast (prefetched)
 * navigations still read clearly, and a safety timeout guarantees it can never
 * hang on an edge case.
 */
const MIN_VISIBLE_MS = 550;
const FADE_MS = 320;
const TRICKLE_MS = 200;
const SAFETY_MS = 12000;

function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const phaseRef = useRef<"idle" | "running">("idle");
  const startedAtRef = useRef(0);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRunningTimers = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (finishRef.current) {
      clearTimeout(finishRef.current);
      finishRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (phaseRef.current !== "running") return;
    phaseRef.current = "idle";
    clearRunningTimers();
    setProgress(100);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, FADE_MS);
  }, [clearRunningTimers]);

  const requestFinish = useCallback(() => {
    if (phaseRef.current !== "running" || finishRef.current) return;
    const elapsed =
      typeof performance !== "undefined"
        ? performance.now() - startedAtRef.current
        : MIN_VISIBLE_MS;
    const remaining = MIN_VISIBLE_MS - elapsed;
    if (remaining > 0) {
      finishRef.current = setTimeout(() => {
        finishRef.current = null;
        finish();
      }, remaining);
    } else {
      finish();
    }
  }, [finish]);

  const start = useCallback(() => {
    if (phaseRef.current === "running") return;
    phaseRef.current = "running";
    startedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    clearRunningTimers();
    setVisible(true);
    setProgress(12);
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const inc = p < 25 ? 10 : p < 55 ? 5 : p < 80 ? 2 : 0.5;
        return Math.min(92, p + inc);
      });
    }, TRICKLE_MS);
    safetyRef.current = setTimeout(finish, SAFETY_MS);
  }, [clearRunningTimers, finish]);

  // Navigation committed → finish (held for the minimum visible duration).
  useEffect(() => {
    requestFinish();
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
      clearRunningTimers();
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [start, clearRunningTimers]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        insetInline: 0,
        top: 0,
        zIndex: 2147483646,
        height: 3,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          width: `${progress}%`,
          background:
            "linear-gradient(90deg, #1d4ed8 0%, #2563eb 45%, #06b6d4 100%)",
          borderRadius: "0 9999px 9999px 0",
          boxShadow: "0 0 10px rgba(37, 99, 235, 0.7)",
          opacity: progress >= 100 ? 0 : 1,
          transition: `width ${TRICKLE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${FADE_MS}ms ease`,
          willChange: "width, opacity",
        }}
      >
        <span
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            width: 110,
            transform: "rotate(2.5deg) translateY(-3px)",
            borderRadius: "9999px",
            boxShadow:
              "0 0 14px 2px rgba(37, 99, 235, 0.9), 0 0 8px 1px rgba(6, 182, 212, 0.8)",
            opacity: 0.85,
          }}
        />
      </div>
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
