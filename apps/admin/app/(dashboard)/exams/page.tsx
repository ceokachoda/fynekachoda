import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { ExamsClient } from "./exams-client";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Exams · FyneStudy Admin",
};

export interface ExamRow {
  id: string;
  title: string;
  batch_id: string;
  batch_name: string;
  course_code: string;
  starts_at: string;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  result_release: "manual" | "instant";
  is_published: boolean;
  results_released_at: string | null;
  created_by: string;
  created_by_name: string;
  question_count: number;
  attempt_count: number;
  submitted_count: number;
}

export interface BatchOpt {
  id: string;
  name: string;
  course_id: string;
}

export interface CourseOpt {
  id: string;
  code: string;
  name: string;
}

interface PageProps {
  searchParams: Promise<{
    course?: string;
    batch?: string;
    status?: string; // draft|scheduled|live|closed|released
    q?: string;
  }>;
}

function statusFor(
  now: number,
  startsAt: string,
  durationMin: number,
  is_published: boolean,
  results_released_at: string | null,
): "draft" | "scheduled" | "live" | "closed" | "released" {
  if (!is_published) return "draft";
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * 60_000;
  if (results_released_at) return "released";
  if (now < start) return "scheduled";
  if (now < end) return "live";
  return "closed";
}

async function loadData(filters: {
  course?: string;
  batch?: string;
  status?: string;
  q?: string;
}) {
  const supabase = await createSupabaseServerClient();

  const coursesRes = await supabase
    .from("courses")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  const courses: CourseOpt[] = (coursesRes.data ?? []) as CourseOpt[];

  const batchesRes = await supabase
    .from("batches")
    .select("id, name, course_id")
    .eq("is_active", true)
    .order("name");
  const batches: BatchOpt[] = (batchesRes.data ?? []) as BatchOpt[];

  let query = supabase
    .from("exams")
    .select(
      "id, title, batch_id, starts_at, duration_min, marks_correct, marks_wrong, marks_skip, result_release, is_published, results_released_at, created_by, batches!inner(name, course_id, courses!inner(code)), creator:app_users!created_by(full_name), exam_questions(count), exam_attempts(id, submitted_at)",
    )
    .order("starts_at", { ascending: false })
    .limit(300);
  if (filters.batch && /^[0-9a-f-]{36}$/i.test(filters.batch)) {
    query = query.eq("batch_id", filters.batch);
  }
  if (filters.q && filters.q.trim().length > 0) {
    query = query.ilike("title", `%${filters.q.trim()}%`);
  }
  const res = await query;

  type Row = {
    id: string;
    title: string;
    batch_id: string;
    starts_at: string;
    duration_min: number;
    marks_correct: number | string;
    marks_wrong: number | string;
    marks_skip: number | string;
    result_release: "manual" | "instant";
    is_published: boolean;
    results_released_at: string | null;
    created_by: string;
    batches: { name: string; course_id: string; courses: { code: string } } | null;
    creator: { full_name: string } | null;
    exam_questions: Array<{ count: number }>;
    exam_attempts: Array<{ id: string; submitted_at: string | null }>;
  };

  let rows: ExamRow[] = ((res.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    batch_id: r.batch_id,
    batch_name: r.batches?.name ?? "—",
    course_code: r.batches?.courses?.code ?? "—",
    starts_at: r.starts_at,
    duration_min: r.duration_min,
    marks_correct: Number(r.marks_correct),
    marks_wrong: Number(r.marks_wrong),
    marks_skip: Number(r.marks_skip),
    result_release: r.result_release,
    is_published: r.is_published,
    results_released_at: r.results_released_at,
    created_by: r.created_by,
    created_by_name: r.creator?.full_name ?? "(unknown)",
    question_count: r.exam_questions?.[0]?.count ?? 0,
    attempt_count: r.exam_attempts?.length ?? 0,
    submitted_count: (r.exam_attempts ?? []).filter((a) => a.submitted_at !== null).length,
  }));

  // Course filter (admin-side because PostgREST embed filter is awkward).
  if (filters.course && /^[0-9a-f-]{36}$/i.test(filters.course)) {
    const batchCourseMap = new Map<string, string>();
    for (const b of batches) batchCourseMap.set(b.id, b.course_id);
    rows = rows.filter((r) => batchCourseMap.get(r.batch_id) === filters.course);
  }
  if (filters.status) {
    const now = Date.now();
    rows = rows.filter(
      (r) =>
        statusFor(
          now,
          r.starts_at,
          r.duration_min,
          r.is_published,
          r.results_released_at,
        ) === filters.status,
    );
  }
  return { courses, batches, rows };
}

export default async function ExamsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const { courses, batches, rows } = await loadData({
    course: params.course,
    batch: params.batch,
    status: params.status,
    q: params.q,
  });
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Exams" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Exams" }]}
      />
      <ExamsClient
        rows={rows}
        courses={courses}
        batches={batches}
        filters={{
          course: params.course ?? "",
          batch: params.batch ?? "",
          status: params.status ?? "",
          q: params.q ?? "",
        }}
      />
    </div>
  );
}
