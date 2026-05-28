"use client";

// Phase 4 Track 4B — full curriculum tree (course → subject → chapter → topic
// + batches per course) for every batch the teacher is assigned to. Mirrors
// mobile features/library/useTeacherCurriculum.ts. Used by the upload form
// + quiz/exam builders.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAssignedBatches } from "./useAssignedBatches";

export interface CurriculumTopic {
  id: string;
  name: string;
}
export interface CurriculumChapter {
  id: string;
  name: string;
  topics: CurriculumTopic[];
}
export interface CurriculumSubject {
  id: string;
  name: string;
  chapters: CurriculumChapter[];
}
export interface CurriculumBatch {
  batch_id: string;
  batch_name: string;
}
export interface CurriculumCourse {
  course_id: string;
  course_code: string;
  course_name: string;
  batches: CurriculumBatch[];
  subjects: CurriculumSubject[];
}

export function useTeacherCurriculum() {
  const batches = useAssignedBatches();
  const batchIds = (batches.data ?? []).map((b) => b.batch_id).sort();
  const batchKey = batchIds.join("|");

  return useQuery({
    queryKey: ["teacher-curriculum", batchKey],
    enabled: !batches.isLoading,
    queryFn: async (): Promise<CurriculumCourse[]> => {
      if (batchIds.length === 0) return [];
      const supabase = createSupabaseBrowserClient();
      const batchRes = await supabase
        .from("batches")
        .select("id, name, course_id, courses(id, code, name)")
        .in("id", batchIds);
      if (batchRes.error) throw new Error(batchRes.error.message);
      type BatchRow = {
        id: string;
        name: string;
        course_id: string;
        courses: { id: string; code: string; name: string } | null;
      };
      const byCourse = new Map<
        string,
        {
          code: string;
          name: string;
          batches: CurriculumBatch[];
        }
      >();
      for (const b of (batchRes.data ?? []) as unknown as BatchRow[]) {
        const c = b.courses;
        if (!c) continue;
        const entry = byCourse.get(c.id) ?? {
          code: c.code,
          name: c.name,
          batches: [],
        };
        entry.batches.push({ batch_id: b.id, batch_name: b.name });
        byCourse.set(c.id, entry);
      }
      const courseIds = Array.from(byCourse.keys());
      if (courseIds.length === 0) return [];
      const subjRes = await supabase
        .from("subjects")
        .select(
          "id, name, sort_order, course_id, chapters(id, name, sort_order, topics(id, name, sort_order))",
        )
        .in("course_id", courseIds)
        .order("sort_order", { ascending: true });
      if (subjRes.error) throw new Error(subjRes.error.message);
      type SubjRow = {
        id: string;
        name: string;
        sort_order: number;
        course_id: string;
        chapters: Array<{
          id: string;
          name: string;
          sort_order: number;
          topics: Array<{ id: string; name: string; sort_order: number }>;
        }> | null;
      };
      const subjectsByCourse = new Map<string, CurriculumSubject[]>();
      for (const s of (subjRes.data ?? []) as unknown as SubjRow[]) {
        const subj: CurriculumSubject = {
          id: s.id,
          name: s.name,
          chapters: (s.chapters ?? [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => ({
              id: c.id,
              name: c.name,
              topics: (c.topics ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((t) => ({ id: t.id, name: t.name })),
            })),
        };
        const arr = subjectsByCourse.get(s.course_id) ?? [];
        arr.push(subj);
        subjectsByCourse.set(s.course_id, arr);
      }
      const out: CurriculumCourse[] = [];
      for (const [courseId, entry] of byCourse) {
        out.push({
          course_id: courseId,
          course_code: entry.code,
          course_name: entry.name,
          batches: entry.batches,
          subjects: subjectsByCourse.get(courseId) ?? [],
        });
      }
      return out;
    },
    staleTime: 60_000 * 5,
  });
}
