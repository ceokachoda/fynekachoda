"use client";

// Web equivalent of mobile's AppState listener. Subscribe to the Page
// Visibility API + window.blur — when the student switches tabs or
// minimises the window during an in-flight attempt, POST exam-tab-switch
// fire-and-forget (D-182). The server bumps the counter and returns the
// new total; the local count is incremented optimistically so the banner
// stays in sync even if the network round-trip is slow.

import { useCallback, useEffect, useRef, useState } from "react";
import { invokeEdgeFn } from "@/lib/edge-fn";

interface State {
  count: number;
  setInitial: (n: number) => void;
}

export function useExamTabSwitchLogger(attemptId: string | null): State {
  const [count, setCount] = useState(0);
  const attemptIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  const log = useCallback(() => {
    if (!attemptIdRef.current) return;
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
