"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Subscribe to Postgres CDC on `public.attendance` for the current student.
// When a row is inserted/updated (typically by the teacher's QR scan or a
// correction), invoke `onChange` so the caller can re-query its state.
// Unsubscribes on unmount or when appUser.id changes.
//
// Channel name uses a random suffix so multiple subscribers (e.g., Home + the
// attendance screen) get independent channels — supabase.channel(name) returns
// the existing channel when names collide, which would cause "cannot add
// postgres_changes callbacks ... after subscribe()".
export function useAttendanceRealtime(onChange: () => void): void {
  const { appUser } = useSession();
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!appUser?.id) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(
        `student-attendance-${appUser.id}-${Math.random()
          .toString(36)
          .slice(2)}`,
      )
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
