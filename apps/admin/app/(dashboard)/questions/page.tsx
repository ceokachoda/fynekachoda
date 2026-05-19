import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { QuestionsClient } from "./questions-client";

export const metadata = {
  title: "Question bank · FyneStudy Admin",
};

export interface QuestionRow {
  id: string;
  prompt_md: string;
  difficulty: "easy" | "medium" | "hard" | null;
  is_archived: boolean;
  topic_id: string;
  topic_name: string | null;
  chapter_name: string | null;
  subject_name: string | null;
  course_id: string | null;
  course_code: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  option_count: number;
  correct_option_count: number;
  use_count: number;
}

export interface CourseOpt {
  id: string;
  code: string;
  name: string;
}

interface PageProps {
  searchParams: Promise<{
    course?: string;
    difficulty?: string;
    status?: string;
    q?: string;
  }>;
}

async function loadData(filters: {
  course?: string;
  difficulty?: string;
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

  let query = supabase
    .from("questions")
    .select(
      "id, prompt_md, difficulty, is_archived, topic_id, created_by, created_at, topics:topic_id(name, chapters:chapter_id(name, subjects:subject_id(name, course_id, courses:course_id(code)))), creator:app_users!created_by(full_name), question_options(id, is_correct), quiz_questions(count)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (filters.difficulty && ["easy", "medium", "hard"].includes(filters.difficulty)) {
    query = query.eq("difficulty", filters.difficulty);
  }
  if (filters.status === "archived") query = query.eq("is_archived", true);
  if (filters.status === "active") query = query.eq("is_archived", false);
  if (filters.q && filters.q.trim().length > 0) {
    query = query.ilike("prompt_md", `%${filters.q.trim()}%`);
  }
  const res = await query;
  type Row = {
    id: string;
    prompt_md: string;
    difficulty: "easy" | "medium" | "hard" | null;
    is_archived: boolean;
    topic_id: string;
    created_by: string;
    created_at: string;
    topics: {
      name: string;
      chapters: {
        name: string;
        subjects: {
          name: string;
          course_id: string;
          courses: { code: string } | null;
        } | null;
      } | null;
    } | null;
    creator: { full_name: string } | null;
    question_options: Array<{ id: string; is_correct: boolean }>;
    quiz_questions: Array<{ count: number }>;
  };
  let rows: QuestionRow[] = ((res.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    prompt_md: r.prompt_md,
    difficulty: r.difficulty,
    is_archived: r.is_archived,
    topic_id: r.topic_id,
    topic_name: r.topics?.name ?? null,
    chapter_name: r.topics?.chapters?.name ?? null,
    subject_name: r.topics?.chapters?.subjects?.name ?? null,
    course_id: r.topics?.chapters?.subjects?.course_id ?? null,
    course_code: r.topics?.chapters?.subjects?.courses?.code ?? null,
    created_by: r.created_by,
    created_by_name: r.creator?.full_name ?? "(unknown)",
    created_at: r.created_at,
    option_count: (r.question_options ?? []).length,
    correct_option_count: (r.question_options ?? []).filter((o) => o.is_correct).length,
    use_count: r.quiz_questions?.[0]?.count ?? 0,
  }));
  if (filters.course && /^[0-9a-f-]{36}$/i.test(filters.course)) {
    rows = rows.filter((r) => r.course_id === filters.course);
  }
  return { courses, rows };
}

export default async function QuestionsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const { courses, rows } = await loadData({
    course: params.course,
    difficulty: params.difficulty,
    status: params.status,
    q: params.q,
  });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Question bank</h1>
        <p className="text-sm text-slate-500">
          Archive · delete · review every teacher-authored MCQ.
        </p>
      </header>
      <QuestionsClient
        rows={rows}
        courses={courses}
        filters={{
          course: params.course ?? "",
          difficulty: params.difficulty ?? "",
          status: params.status ?? "",
          q: params.q ?? "",
        }}
      />
    </div>
  );
}
