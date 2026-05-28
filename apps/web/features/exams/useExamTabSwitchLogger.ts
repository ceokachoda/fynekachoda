"use client";

// Web equivalent of mobile's AppState listener. Subscribe to the Page
// Visibility API + window.blur — when the student switches tabs or
// minimises the window during an in-flight attempt, POST exam-tab-switch
// fire-and-forget (D-182). The server bumps the counter and returns the
// new total; the local count is incremented optimistically so the banner
// stays in sync even if the network round-trip is slow.
//
// Dedup: a single Alt-Tab gesture fires BOTH `visibilitychange→hidden`
// AND `window.blur` on Chrome (Windows/macOS) — without the 500ms
// dedup the local count flickers to +2 before the server response snaps
// it back to +1. The dedup window is conservative; two genuine
// tab-switches in <500ms are rare enough that under-counting them is
// the safer trade-off.

import { useCallback, useEffect, useRef, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";

const DEDUP_WINDOW_MS = 500;

interface State {
  count: number;
  setInitial: (n: number) => void;
}

export function useExamTabSwitchLogger(attemptId: string | null): State {
  const [count, setCount] = useState(0);
  const attemptIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const lastLogAtRef = useRef<number>(0);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  const log = useCallback(() => {
    if (!attemptIdRef.current) return;
    const now = Date.now();
    if (now - lastLogAtRef.current < DEDUP_WINDOW_MS) return;
    lastLogAtRef.current = now;
    setCount((c) => c + 1);
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    void (async () => {
      try {
        const res = await invokeEdgeFn<{ tab_switch_count: number }>(
          "exam-tab-switch",
          { attempt_id: attemptIdRef.current },
        );
        if (res.status === 200 && res.body && typeof res.body.tab_switch_count === "number") {
          setCount(res.body.tab_switch_count);
        }
        // Silent on any non-200 (D-182: fire-and-forget; silent on submitted).
      } catch {
        // Network error: swallow per D-182.
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    if (!attemptId) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") log();
    };
    const onBlur = () => {
      // `blur` fires both for window blur and for some focus changes within
      // the page; we only count when the document is also hidden OR when
      // the active element is no longer in our document. Using
      // visibilitychange alone misses an Alt-Tab on some browsers, so blur
      // is the second signal — and a Set guards against double-counting in
      // the same tick.
      if (document.visibilityState === "hidden" || !document.hasFocus()) {
        log();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [attemptId, log]);

  const setInitial = useCallback((n: number) => setCount(n), []);

  return { count, setInitial };
}
