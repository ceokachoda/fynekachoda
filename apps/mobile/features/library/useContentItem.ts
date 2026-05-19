import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface ContentItemDetail {
  id: string;
  kind: "video" | "pdf" | "note";
  title: string;
  description: string | null;
  duration_sec: number | null;
  yt_video_id: string | null;
  file_path: string | null;
  topic_id: string;
  course_id: string;
  batch_id: string | null;
  is_published: boolean;
  created_at: string;
}

interface State {
  data: ContentItemDetail | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useContentItem(contentId: string | undefined): State {
  const [data, setData] = useState<ContentItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!contentId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        supabase
          .from("content_items")
          .select(
            "id, kind, title, description, duration_sec, yt_video_id, file_path, topic_id, course_id, batch_id, is_published, created_at",
          )
          .eq("id", contentId)
          .maybeSingle(),
      );
      if (res.error) setError(res.error.message);
      setData((res.data as unknown as ContentItemDetail) ?? null);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load content.",
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, isLoading, refresh: load };
}
