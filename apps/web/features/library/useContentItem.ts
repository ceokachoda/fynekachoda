"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ContentItem } from "./types";

export function useContentItem(contentId: string | undefined) {
  return useQuery<ContentItem | null>({
    queryKey: ["content-item", contentId],
    enabled: !!contentId,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id, title, kind, description, duration_sec, file_path, is_published, topic_id, batch_id, course_id, created_at",
        )
        .eq("id", contentId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ContentItem | null) ?? null;
    },
  });
}
