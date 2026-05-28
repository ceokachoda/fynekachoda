"use client";

// Phase 4 Track 4B — flat list of teacher's batches (id + name + course code)
// for builders / offline-scores. Mirrors mobile useTeacherBatches.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSession } from "@/features/auth/SessionProvider";

export interface TeacherBatchOpt {
  batch_id: string;
  batch_name: string;
  course_id: string;
  course_code: string;
}

export function useTeacherBatches() {
  const { appUser } = useSession();
  const teacherId = appUser?.id;
  return useQuery({
    queryKey: ["teacher-batches", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<TeacherBatchOpt[]> => {
      const supabase = createSupabaseBrowserClient();
      const res = await supabase
        .from("batch_teachers")
        .select(
          "batch_id, batches!inner(id, name, course_id, courses!inner(code))",
        )
        .eq("teacher_id", teacherId);
      if (res.error) throw new Error(res.error.message);
      type Row = {
        batch_id: string;
        batches: {
          id: string;
          name: string;
          course_id: string;
          courses: { code: string };
        };
      };
      return ((res.data ?? []) as unknown as Row[]).map((r) => ({
        batch_id: r.batch_id,
        batch_name: r.batches.name,
        course_id: r.batches.course_id,
        course_code: r.batches.courses.code,
      }));
    },
    staleTime: 60_000 * 5,
  });
}
