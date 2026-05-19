// Fires `exam-tab-switch` (fire-and-forget) whenever AppState transitions
// from `active` to `background` or `inactive`. Edge fn bumps the counter.
// The client also keeps a local count for the warning banner so the
// network drop doesn't desync the UI.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { invokeEdgeFn } from "@/lib/edge-fn";

interface State {
  count: number;
  setInitial: (n: number) => void;
}

export function useExamTabSwitchLogger(attemptId: string | null): State {
  const [count, setCount] = useState(0);
  const lastStateRef = useRef<AppStateStatus>("active");
  const inFlightRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = lastStateRef.current;
      lastStateRef.current = next;
      if (!attemptIdRef.current) return;
      // Only count active→inactive/background transitions.
      if (prev === "active" && (next === "background" || next === "inactive")) {
        setCount((c) => c + 1);
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        void (async () => {
          try {
            await invokeEdgeFn<{ tab_switch_count: number }>(
              "exam-tab-switch",
              { attempt_id: attemptIdRef.current },
            );
          } catch {
            // Fire-and-forget — swallow.
          } finally {
            inFlightRef.current = false;
          }
        })();
      }
    });
    return () => sub.remove();
  }, []);

  return { count, setInitial: (n: number) => setCount(n) };
}
