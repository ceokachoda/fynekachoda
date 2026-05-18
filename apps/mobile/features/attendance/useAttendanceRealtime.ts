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
    const channel = supabase
      .channel(`student-attendance-${appUser.id}`)
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
