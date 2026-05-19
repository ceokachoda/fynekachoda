import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { withTimeout } from "@/features/auth/network-errors";

export interface PdfProgressRow {
  student_id: string;
  content_id: string;
  last_page: number;
  total_pages: number | null;
  updated_at: string;
}

interface State {
  initial: PdfProgressRow | null;
  isLoading: boolean;
  setPage: (page: number, totalPages?: number) => Promise<void>;
}

export function usePdfProgress(contentId: string | undefined): State {
  const { appUser } = useSession();
  const [initial, setInitial] = useState<PdfProgressRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSent = useRef<number>(0);
  const lastPage = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!contentId || !appUser?.id) {
        setInitial(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await withTimeout(
          supabase
            .from("pdf_progress")
            .select("student_id, content_id, last_page, total_pages, updated_at")
            .eq("content_id", contentId)
            .eq("student_id", appUser.id)
            .maybeSingle(),
        );
        if (!cancelled) {
          setInitial((res.data as unknown as PdfProgressRow) ?? null);
        }
      } catch {
        if (!cancelled) setInitial(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [contentId, appUser?.id]);

  const setPage = useCallback(
    async (page: number, totalPages?: number) => {
      if (!contentId || !appUser?.id) return;
      if (page < 1) return;
      const now = Date.now();
      if (page === lastPage.current && now - lastSent.current < 5_000) return;
      lastPage.current = page;
      lastSent.current = now;
      try {
        await withTimeout(
          supabase
            .from("pdf_progress")
            .upsert(
              {
                student_id: appUser.id,
                content_id: contentId,
                last_page: page,
                total_pages: totalPages ?? null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "student_id,content_id" },
            ),
        );
      } catch {
        // non-critical
      }
    },
    [contentId, appUser?.id],
  );

  return { initial, isLoading, setPage };
}
