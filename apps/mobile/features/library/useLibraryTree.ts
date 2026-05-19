import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMyBatch } from "@/features/org/useMyBatch";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

export interface SubjectNode {
  id: string;
  name: string;
  sort_order: number;
  item_count: number;
}

export interface ChapterNode {
  id: string;
  name: string;
  sort_order: number;
  item_count: number;
}

export interface TopicNode {
  id: string;
  name: string;
  sort_order: number;
  item_count: number;
}

export interface ContentRow {
  id: string;
  kind: "video" | "pdf" | "note";
  title: string;
  description: string | null;
  duration_sec: number | null;
  yt_video_id: string | null;
  file_path: string | null;
  topic_id: string;
  batch_id: string | null;
  created_at: string;
}

interface State<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// All items in the student's accessible scope, fetched once. RLS already
// restricts to the student's course (batch-wide + course-wide). For the
// Phase 5 catalog (course content ~hundreds at most) this is fine; we'll
// paginate if it ever ships >2k rows.
export function useLibraryAccessibleItems(): State<ContentRow[]> {
  const { data: batch, isLoading: batchLoading } = useMyBatch();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (batchLoading) {
      setIsLoading(true);
      return;
    }
    if (!batch?.batch_id) {
      setRows([]);
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
            "id, kind, title, description, duration_sec, yt_video_id, file_path, topic_id, batch_id, created_at",
          )
          .order("created_at", { ascending: false }),
      );
      if (res.error) {
        setError(res.error.message);
        setRows([]);
      } else {
        setRows((res.data ?? []) as unknown as ContentRow[]);
      }
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load library.",
      );
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [batchLoading, batch?.batch_id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data: rows, isLoading, error, refresh: load };
}

export interface LibraryTree {
  subjects: Array<
    SubjectNode & {
      chapters: Array<
        ChapterNode & {
          topics: Array<TopicNode & { items: ContentRow[] }>;
        }
      >;
    }
  >;
}

// Builds the Subject → Chapter → Topic → Item tree by joining the
// items with their topic/chapter/subject metadata. One round-trip for the
// curriculum and one for items keeps this cheap.
export function useLibraryTree(searchQuery = ""): State<LibraryTree> {
  const { data: items, isLoading: itemsLoading, error: itemsErr, refresh } =
    useLibraryAccessibleItems();
  const { data: batch } = useMyBatch();
  const [scaffold, setScaffold] = useState<
    | {
      subjects: Array<{
        id: string;
        name: string;
        sort_order: number;
        chapters: Array<{
          id: string;
          name: string;
          sort_order: number;
          topics: Array<{ id: string; name: string; sort_order: number }>;
        }>;
      }>;
    }
    | null
  >(null);
  const [scaffoldLoading, setScaffoldLoading] = useState(true);
  const [scaffoldErr, setScaffoldErr] = useState<string | null>(null);

  const loadScaffold = useCallback(async () => {
    if (!batch?.batch_id) {
      setScaffold(null);
      setScaffoldLoading(false);
      return;
    }
    setScaffoldLoading(true);
    setScaffoldErr(null);
    try {
      // Pull all subjects+chapters+topics for the student's course via nested embed.
      const courseRes = await withTimeout(
        supabase
          .from("batches")
          .select("course_id")
          .eq("id", batch.batch_id)
          .maybeSingle(),
      );
      const courseId = (courseRes.data as { course_id: string } | null)
        ?.course_id;
      if (!courseId) {
        setScaffold({ subjects: [] });
        return;
      }
      const subjRes = await withTimeout(
        supabase
          .from("subjects")
          .select(
            "id, name, sort_order, chapters(id, name, sort_order, topics(id, name, sort_order))",
          )
          .eq("course_id", courseId)
          .order("sort_order", { ascending: true }),
      );
      if (subjRes.error) {
        setScaffoldErr(subjRes.error.message);
        return;
      }
      setScaffold({
        subjects: ((subjRes.data ?? []) as unknown as Array<{
          id: string;
          name: string;
          sort_order: number;
          chapters: Array<{
            id: string;
            name: string;
            sort_order: number;
            topics: Array<{ id: string; name: string; sort_order: number }>;
          }> | null;
        }>).map((s) => ({
          id: s.id,
          name: s.name,
          sort_order: s.sort_order,
          chapters: (s.chapters ?? [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => ({
              id: c.id,
              name: c.name,
              sort_order: c.sort_order,
              topics: (c.topics ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order),
            })),
        })),
      });
    } catch (err) {
      setScaffoldErr(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Couldn't load curriculum.",
      );
    } finally {
      setScaffoldLoading(false);
    }
  }, [batch?.batch_id]);

  useEffect(() => {
    void loadScaffold();
  }, [loadScaffold]);

  const tree: LibraryTree = useMemo(() => {
    if (!scaffold) return { subjects: [] };
    const itemsByTopic = new Map<string, ContentRow[]>();
    for (const it of items) {
      if (
        searchQuery &&
        !it.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        continue;
      }
      const arr = itemsByTopic.get(it.topic_id) ?? [];
      arr.push(it);
      itemsByTopic.set(it.topic_id, arr);
    }
    return {
      subjects: scaffold.subjects.map((s) => {
        const chapters = s.chapters.map((c) => {
          const topics = c.topics.map((t) => {
            const tItems = itemsByTopic.get(t.id) ?? [];
            return { ...t, items: tItems, item_count: tItems.length };
          });
          return {
            ...c,
            topics,
            item_count: topics.reduce((acc, t) => acc + t.item_count, 0),
          };
        });
        return {
          ...s,
          chapters,
          item_count: chapters.reduce((acc, c) => acc + c.item_count, 0),
        };
      }),
    };
  }, [scaffold, items, searchQuery]);

  const refreshBoth = useCallback(async () => {
    await Promise.all([refresh(), loadScaffold()]);
  }, [refresh, loadScaffold]);

  return {
    data: tree,
    isLoading: itemsLoading || scaffoldLoading,
    error: itemsErr ?? scaffoldErr,
    refresh: refreshBoth,
  };
}
