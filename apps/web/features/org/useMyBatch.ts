"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface MyBatch {
  batch_id: string;
  batch_name: string;
  course_code: string;
  course_name: string;
}

interface StudentRow {
  batch_id: string;
  batches: {
    id: string;
    name: string;
    courses: { code: string; name: string } | null;
  } | null;
}

export function useMyBatch() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<MyBatch | null>({
    queryKey: ["my-batch", studentId],
    enabled: !!studentId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("students")
        .select("batch_id, batches(id, name, courses(code, name))")
        .eq("user_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as StudentRow | null;
      if (!row?.batches) return null;
      return {
        batch_id: row.batches.id,
        batch_name: row.batches.name,
        course_code: row.batches.courses?.code ?? "",
        course_name: row.batches.courses?.name ?? "",
      };
    },
  });
}
