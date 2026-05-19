import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAssignedBatches } from "@/features/org/useAssignedBatches";
import { withTimeout } from "@/features/auth/network-errors";

export interface CourseOption {
  course_id: string;
  course_code: string;
  course_name: string;
  batches: { batch_id: string; batch_name: string }[];
  subjects: Array<{
    id: string;
    name: string;
    chapters: Array<{
      id: string;
      name: string;
      topics: Array<{ id: string; name: string }>;
    }>;
  }>;
}

interface State {
  courses: CourseOption[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Returns the full curriculum tree for every course the teacher has any
// batch in. Used by the teacher upload form's cascading pickers.
export function useTeacherCurriculum(): State {
  const { data: batches, isLoading: batchesLoading } = useAssignedBatches();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const batchesKey = useMemo(
    () => (batches ?? []).map((b) => b.batch_id).sort().join("|"),
    [batches],
  );

  const load = useCallback(async () => {
    if (batchesLoading) {
      setIsLoading(true);
      return;
    }
    if (!batches || batches.length === 0) {
      setCourses([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const batchRes = await withTimeout(
        supabase
          .from("batches")
          .select("id, name, course_id, courses(id, code, name)")
          .in("id", batches.map((b) => b.batch_id)),
      );
      if (batchRes.error) {
        setError(batchRes.error.message);
        setCourses([]);
        return;
      }
      const batchRows = (batchRes.data ?? []) as unknown as Array<{
        id: string;
        name: string;
        course_id: string;
        courses: { id: string; code: string; name: string } | null;
      }>;
      const byCourse = new Map<
        string,
        { code: string; name: string; batches: { batch_id: string; batch_name: string }[] }
      >();
      for (const b of batchRows) {
        const c = b.courses;
        if (!c) continue;
        const entry = byCourse.get(c.id) ?? { code: c.code, name: c.name, batches: [] };
        entry.batches.push({ batch_id: b.id, batch_name: b.name });
        byCourse.set(c.id, entry);
      }
      const courseIds = Array.from(byCourse.keys());
      if (courseIds.length === 0) {
        setCourses([]);
        return;
      }
      const subjRes = await withTimeout(
        supabase
          .from("subjects")
          .select(
            "id, name, sort_order, course_id, chapters(id, name, sort_order, topics(id, name, sort_order))",
          )
          .in("course_id", courseIds)
          .order("sort_order", { ascending: true }),
      );
      if (subjRes.error) {
        setError(subjRes.error.message);
        setCourses([]);
        return;
      }
      const subjectsByCourse = new Map<
        string,
        CourseOption["subjects"]
      >();
      for (const s of ((subjRes.data ?? []) as unknown as Array<{
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
      }>)) {
        const subj = {
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
      const result: CourseOption[] = [];
      for (const [course_id, entry] of byCourse) {
        result.push({
          course_id,
          course_code: entry.code,
          course_name: entry.name,
          batches: entry.batches,
          subjects: subjectsByCourse.get(course_id) ?? [],
        });
      }
      setCourses(result);
    } catch (err) {
      setError((err as Error).message ?? "Couldn't load curriculum.");
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  }, [batches, batchesLoading, batchesKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { courses, isLoading, error, refresh: load };
}
