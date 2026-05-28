"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useMyBatch } from "@/features/org/useMyBatch";
import type { LibraryTree, ContentItem, Subject, Chapter, Topic } from "./types";

interface RawSubject {
  id: string;
  name: string;
  sort_order: number;
  chapters: Array<{
    id: string;
    name: string;
    sort_order: number;
    topics: Array<{ id: string; name: string; sort_order: number }>;
  }>;
}

interface RawItem {
  id: string;
  title: string;
  kind: "video" | "pdf" | "note";
  description: string | null;
  duration_sec: number | null;
  yt_video_id: string | null;
  file_path: string | null;
  is_published: boolean;
  topic_id: string;
  chapter_id: string;
  subject_id: string;
  batch_id: string | null;
  course_id: string;
  created_at: string;
}

export function buildLibraryTree(
  subjects: RawSubject[],
  items: RawItem[],
  searchQuery: string,
): LibraryTree {
  const q = searchQuery.trim().toLowerCase();
  const filteredItems = q
    ? items.filter((i) => i.title.toLowerCase().includes(q))
    : items;

  const itemsByTopic = new Map<string, ContentItem[]>();
  for (const i of filteredItems) {
    const arr = itemsByTopic.get(i.topic_id) ?? [];
    arr.push(i as ContentItem);
    itemsByTopic.set(i.topic_id, arr);
  }

  const builtSubjects: Subject[] = [];
  for (const s of subjects) {
    const builtChapters: Chapter[] = [];
    let subjectItemCount = 0;
    for (const c of s.chapters ?? []) {
      const builtTopics: Topic[] = [];
      let chapterItemCount = 0;
      for (const t of c.topics ?? []) {
        const tItems = itemsByTopic.get(t.id) ?? [];
        chapterItemCount += tItems.length;
        builtTopics.push({
          id: t.id,
          name: t.name,
          sort_order: t.sort_order ?? 0,
          items: tItems,
        });
      }
      subjectItemCount += chapterItemCount;
      if (!q || chapterItemCount > 0) {
        builtChapters.push({
          id: c.id,
          name: c.name,
          sort_order: c.sort_order ?? 0,
          topics: builtTopics,
          item_count: chapterItemCount,
        });
      }
    }
    if (!q || subjectItemCount > 0) {
      builtSubjects.push({
        id: s.id,
        name: s.name,
        sort_order: s.sort_order ?? 0,
        chapters: builtChapters,
        item_count: subjectItemCount,
      });
    }
  }

  builtSubjects.sort((a, b) => a.sort_order - b.sort_order);
  return { subjects: builtSubjects };
}

export function useLibraryTree(searchQuery = "") {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const { data: batch } = useMyBatch();

  const tree = useQuery({
    queryKey: ["library-tree", studentId, batch?.batch_id],
    enabled: !!studentId && !!batch?.batch_id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: batchRow, error: batchErr } = await supabase
        .from("batches")
        .select("course_id")
        .eq("id", batch!.batch_id)
        .maybeSingle();
      if (batchErr) throw batchErr;
      const courseId = (batchRow as { course_id?: string } | null)?.course_id;
      if (!courseId) return { subjects: [] as RawSubject[], items: [] as RawItem[] };

      const [subjectsRes, itemsRes] = await Promise.all([
        supabase
          .from("subjects")
          .select(
            "id, name, sort_order, chapters(id, name, sort_order, topics(id, name, sort_order))",
          )
          .eq("course_id", courseId)
          .order("sort_order"),
        supabase
          .from("content_items")
          .select(
            "id, title, kind, description, duration_sec, yt_video_id, file_path, is_published, topic_id, chapter_id, subject_id, batch_id, course_id, created_at",
          )
          .eq("is_published", true)
          .or(`batch_id.eq.${batch!.batch_id},batch_id.is.null`)
          .eq("course_id", courseId)
          .order("created_at", { ascending: false }),
      ]);
      if (subjectsRes.error) throw subjectsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return {
        subjects: (subjectsRes.data ?? []) as unknown as RawSubject[],
        items: (itemsRes.data ?? []) as unknown as RawItem[],
      };
    },
  });

  const filtered = useMemo<LibraryTree>(() => {
    if (!tree.data) return { subjects: [] };
    return buildLibraryTree(tree.data.subjects, tree.data.items, searchQuery);
  }, [tree.data, searchQuery]);

  return {
    data: filtered,
    isLoading: tree.isLoading,
    error: tree.error,
    refresh: tree.refetch,
  };
}
