"use client";

import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface PdfProgressRow {
  student_id: string;
  content_id: string;
  last_page: number;
  total_pages: number | null;
  updated_at: string;
}

const THROTTLE_MS = 5_000;

export function usePdfProgress(contentId: string | undefined) {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const lastSent = useRef<number>(0);
  const lastPage = useRef<number>(0);

  const initial = useQuery<PdfProgressRow | null>({
    queryKey: ["pdf-progress", contentId, studentId],
    enabled: !!contentId && !!studentId,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("pdf_progress")
        .select("student_id, content_id, last_page, total_pages, updated_at")
        .eq("content_id", contentId!)
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PdfProgressRow | null) ?? null;
    },
  });

  const setPage = useCallback(
    async (page: number, totalPages?: number) => {
      if (!contentId || !studentId) return;
      if (page < 1) return;
      const now = Date.now();
      if (page === lastPage.current && now - lastSent.current < THROTTLE_MS) return;
      lastPage.current = page;
      lastSent.current = now;
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.from("pdf_progress").upsert(
          {
            student_id: studentId,
            content_id: contentId,
            last_page: page,
            total_pages: totalPages ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,content_id" },
        );
      } catch {
        // non-critical
      }
    },
    [contentId, studentId],
  );

  return {
    initial: initial.data ?? null,
    isLoading: initial.isLoading,
    setPage,
  };
}
