import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { QuizzesClient } from "./quizzes-client";

export const metadata = {
  title: "Quizzes · FyneStudy Admin",
};

export interface QuizRow {
  id: string;
  title: string;
  course_id: string;
  course_code: string;
  batch_id: string | null;
  batch_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  is_published: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  question_count: number;
  attempt_count: number;
}

export interface CourseOpt {
  id: string;
  code: string;
  name: string;
}

export interface BatchOpt {
  id: string;
  name: string;
  course_id: string;
}

interface PageProps {
  searchParams: Promise<{
    course?: string;
    batch?: string;
    status?: string;
    q?: string;
  }>;
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
    .from("quizzes")
    .select(
      "id, title, course_id, batch_id, topic_id, chapter_id, duration_min, marks_correct, marks_wrong, marks_skip, is_published, created_by, created_at, courses(code), batches(name), topics:topic_id(name), chapters:chapter_id(name), creator:app_users!created_by(full_name), quiz_questions(count), quiz_attempts(count)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (filters.course && /^[0-9a-f-]{36}$/i.test(filters.course)) {
    query = query.eq("course_id", filters.course);
  }
  if (filters.batch === "course-wide") {
    query = query.is("batch_id", null);
  } else if (filters.batch && /^[0-9a-f-]{36}$/i.test(filters.batch)) {
    query = query.eq("batch_id", filters.batch);
  }
  if (filters.status === "published") query = query.eq("is_published", true);
  if (filters.status === "unpublished") query = query.eq("is_published", false);
  if (filters.q && filters.q.trim().length > 0) {
    query = query.ilike("title", `%${filters.q.trim()}%`);
  }
  const res = await query;
  type Row = {
    id: string;
    title: string;
    course_id: string;
    batch_id: string | null;
    topic_id: string | null;
    chapter_id: string | null;
    duration_min: number;
    marks_correct: number | string;
    marks_wrong: number | string;
    marks_skip: number | string;
    is_published: boolean;
    created_by: string;
    created_at: string;
    courses: { code: string } | null;
    batches: { name: string } | null;
    topics: { name: string } | null;
    chapters: { name: string } | null;
    creator: { full_name: string } | null;
    quiz_questions: Array<{ count: number }>;
    quiz_attempts: Array<{ count: number }>;
  };
  const rows: QuizRow[] = ((res.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    course_id: r.course_id,
    course_code: r.courses?.code ?? "—",
    batch_id: r.batch_id,
    batch_name: r.batches?.name ?? null,
    topic_id: r.topic_id,
    topic_name: r.topics?.name ?? null,
    chapter_id: r.chapter_id,
    chapter_name: r.chapters?.name ?? null,
    duration_min: r.duration_min,
    marks_correct: Number(r.marks_correct),
    marks_wrong: Number(r.marks_wrong),
    marks_skip: Number(r.marks_skip),
    is_published: r.is_published,
    created_by: r.created_by,
    created_by_name: r.creator?.full_name ?? "(unknown)",
    created_at: r.created_at,
    question_count: r.quiz_questions?.[0]?.count ?? 0,
    attempt_count: r.quiz_attempts?.[0]?.count ?? 0,
  }));
  return { courses, batches, rows };
}

export default async function QuizzesPage({ searchParams }: PageProps) {
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
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Quizzes</h1>
        <p className="text-sm text-slate-500">
          Moderate practice quizzes · publish / unpublish · delete.
        </p>
      </header>
      <QuizzesClient
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
