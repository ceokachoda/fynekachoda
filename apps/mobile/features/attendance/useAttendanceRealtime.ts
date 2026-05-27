import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";

// Subscribe to Postgres CDC on `public.attendance` for the current student.
// When a row is inserted or updated (typically by the teacher's QR scan or a
// correction), invoke `onChange` so the calling screen can re-query its
// state. Unsubscribes automatically on unmount or when `appUser.id` changes.
export function useAttendanceRealtime(onChange: () => void): void {
  const { appUser } = useSession();
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!appUser?.id) return;
    // Unique suffix per subscription. This hook runs on BOTH the student Home
    // and the Attendance tab, which are mounted at the same time under the tab
    // navigator. `supabase.channel(name)` returns the EXISTING channel when the
    // name matches, so a shared name made the second screen call `.on()` on an
    // already-subscribed channel → "cannot add postgres_changes callbacks ...
    // after subscribe()". A fresh suffix per effect run gives each screen its
    // own independent channel and also dodges the async-removeChannel re-mount
    // race (the old channel may still be tearing down when the next subscribes).
    const channel = supabase
      .channel(`student-attendance-${appUser.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `student_id=eq.${appUser.id}`,
        },
        () => {
          cbRef.current();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [appUser?.id]);
}
