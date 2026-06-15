import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { QuizResultsClient } from "./results-client";

export const metadata = {
  title: "Quiz results · FyneStudy Admin",
};

// One attempt (submitted or in-progress) by one student.
export interface AttemptRow {
  id: string;
  attempt_no: number; // 1-based within the student's attempts, by started_at
  started_at: string;
  submitted_at: string | null;
  is_auto_submit: boolean;
  score: number | null;
  max_score: number | null;
  pct: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
}

// A student who has at least one attempt row for this quiz.
export interface StudentResult {
  student_id: string;
  student_name: string;
  enrollment_no: string | null;
  batch_name: string | null;
  in_roster: boolean;
  attempts: AttemptRow[];
  submitted_count: number;
  best_score: number | null;
  best_pct: number | null;
  latest_submitted_score: number | null;
}

// A student in the quiz's expected audience who has NOT attempted at all.
export interface NotAttemptedRow {
  student_id: string;
  student_name: string;
  enrollment_no: string | null;
  batch_name: string | null;
}

export interface QuestionAnalysisRow {
  question_id: string;
  sort_order: number;
  prompt_md: string;
  total_attempts: number; // submitted attempts (denominator)
  correct_attempts: number;
  pct_correct: number;
}

export interface QuizMeta {
  id: string;
  title: string;
  course_code: string;
  course_name: string;
  batch_name: string | null; // null => course-wide
  is_published: boolean;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  question_count: number;
  created_by_name: string;
  created_at: string;
}

export interface ResultsSummary {
  roster_size: number;
  attempted_students: number; // distinct students with >=1 attempt row
  submitted_students: number; // distinct students with >=1 submitted attempt
  not_attempted: number;
  total_attempts: number;
  submitted_attempts: number;
  avg_score: number | null; // over submitted attempts
  avg_pct: number | null;
  high_score: number | null;
  low_score: number | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadData(quizId: string) {
  const supabase = await createSupabaseServerClient();

  // 1. Quiz meta.
  const quizRes = await supabase
    .from("quizzes")
    .select(
      "id, title, course_id, batch_id, duration_min, marks_correct, marks_wrong, marks_skip, is_published, created_at, courses(code, name), batches(name), creator:app_users!created_by(full_name)",
    )
    .eq("id", quizId)
    .maybeSingle();
  if (quizRes.error || !quizRes.data) return null;
  const q = quizRes.data as unknown as {
    id: string;
    title: string;
    course_id: string;
    batch_id: string | null;
    duration_min: number;
    marks_correct: number | string;
    marks_wrong: number | string;
    marks_skip: number | string;
    is_published: boolean;
    created_at: string;
    courses: { code: string; name: string } | null;
    batches: { name: string } | null;
    creator: { full_name: string } | null;
  };

  // 2. Questions in this quiz (ordered) + their correct option.
  const qqRes = await supabase
    .from("quiz_questions")
    .select("question_id, sort_order, questions!inner(id, prompt_md)")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true });
  const qqRows = ((qqRes.data ?? []) as unknown as Array<{
    question_id: string;
    sort_order: number;
    questions: { id: string; prompt_md: string } | null;
  }>).filter((r) => r.questions);
  const questionIds = qqRows.map((r) => r.question_id);

  const correctByQ = new Map<string, string>();
  if (questionIds.length > 0) {
    const optRes = await supabase
      .from("question_options")
      .select("id, question_id, is_correct")
      .in("question_id", questionIds);
    for (const o of (optRes.data ?? []) as Array<{
      id: string;
      question_id: string;
      is_correct: boolean;
    }>) {
      if (o.is_correct) correctByQ.set(o.question_id, o.id);
    }
  }

  // 3. All attempts for this quiz.
  const attRes = await supabase
    .from("quiz_attempts")
    .select(
      "id, student_id, started_at, submitted_at, is_auto_submit, score, max_score, correct_count, wrong_count, skipped_count",
    )
    .eq("quiz_id", quizId)
    .order("started_at", { ascending: true });
  const attempts = ((attRes.data ?? []) as unknown as Array<{
    id: string;
    student_id: string;
    started_at: string;
    submitted_at: string | null;
    is_auto_submit: boolean;
    score: number | string | null;
    max_score: number | string | null;
    correct_count: number | null;
    wrong_count: number | null;
    skipped_count: number | null;
  }>);

  // 4. Expected roster: batch-scoped => that batch; course-wide => whole course.
  let rosterQuery = supabase
    .from("students")
    .select("user_id, enrollment_no, batch_id, batches!inner(name, course_id)");
  if (q.batch_id) {
    rosterQuery = rosterQuery.eq("batch_id", q.batch_id);
  } else {
    rosterQuery = rosterQuery.eq("batches.course_id", q.course_id);
  }
  const rosterRes = await rosterQuery;
  const rosterRows = ((rosterRes.data ?? []) as unknown as Array<{
    user_id: string;
    enrollment_no: string | null;
    batch_id: string;
    batches: { name: string; course_id: string } | null;
  }>);

  // 5. Names for everyone referenced (roster + attempters not in roster).
  const allIds = Array.from(
    new Set([
      ...attempts.map((a) => a.student_id),
      ...rosterRows.map((r) => r.user_id),
    ]),
  );
  const nameById = new Map<string, string>();
  if (allIds.length > 0) {
    const usersRes = await supabase
      .from("app_users")
      .select("id, full_name")
      .in("id", allIds);
    for (const u of (usersRes.data ?? []) as Array<{
      id: string;
      full_name: string;
    }>) {
      nameById.set(u.id, u.full_name);
    }
  }
  const rosterById = new Map<
    string,
    { enrollment_no: string | null; batch_name: string | null }
  >();
  for (const r of rosterRows) {
    rosterById.set(r.user_id, {
      enrollment_no: r.enrollment_no,
      batch_name: r.batches?.name ?? null,
    });
  }

  // 6. Answers for submitted attempts (drives question-level analysis).
  const submittedAttempts = attempts.filter((a) => a.submitted_at !== null);
  const submittedIds = submittedAttempts.map((a) => a.id);
  const selByQ = new Map<string, Array<string | null>>(); // question_id -> selected option per submitted attempt that answered it
  if (submittedIds.length > 0 && questionIds.length > 0) {
    // Chunk the IN list defensively for large attempt sets.
    const chunkSize = 200;
    for (let i = 0; i < submittedIds.length; i += chunkSize) {
      const chunk = submittedIds.slice(i, i + chunkSize);
      const ansRes = await supabase
        .from("quiz_answers")
        .select("attempt_id, question_id, selected_option_id")
        .in("attempt_id", chunk);
      for (const a of (ansRes.data ?? []) as Array<{
        attempt_id: string;
        question_id: string;
        selected_option_id: string | null;
      }>) {
        const list = selByQ.get(a.question_id) ?? [];
        list.push(a.selected_option_id);
        selByQ.set(a.question_id, list);
      }
    }
  }

  // ---- Assemble ----
  const meta: QuizMeta = {
    id: q.id,
    title: q.title,
    course_code: q.courses?.code ?? "—",
    course_name: q.courses?.name ?? "",
    batch_name: q.batches?.name ?? null,
    is_published: q.is_published,
    duration_min: q.duration_min,
    marks_correct: Number(q.marks_correct),
    marks_wrong: Number(q.marks_wrong),
    marks_skip: Number(q.marks_skip),
    question_count: questionIds.length,
    created_by_name: q.creator?.full_name ?? "(unknown)",
    created_at: q.created_at,
  };

  // Group attempts by student.
  const byStudent = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = byStudent.get(a.student_id) ?? [];
    list.push(a);
    byStudent.set(a.student_id, list);
  }

  const students: StudentResult[] = [];
  for (const [studentId, list] of byStudent.entries()) {
    const sorted = [...list].sort(
      (x, y) =>
        new Date(x.started_at).getTime() - new Date(y.started_at).getTime(),
    );
    const attemptRows: AttemptRow[] = sorted.map((a, idx) => {
      const score = num(a.score);
      const maxScore = num(a.max_score);
      const pct =
        score !== null && maxScore && maxScore > 0
          ? Math.round((score / maxScore) * 100)
          : null;
      return {
        id: a.id,
        attempt_no: idx + 1,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        is_auto_submit: a.is_auto_submit,
        score,
        max_score: maxScore,
        pct: a.submitted_at !== null ? pct : null,
        correct_count: a.correct_count,
        wrong_count: a.wrong_count,
        skipped_count: a.skipped_count,
      };
    });
    const submitted = attemptRows.filter((a) => a.submitted_at !== null);
    const scores = submitted
      .map((a) => a.score)
      .filter((s): s is number => s !== null);
    const best = scores.length ? Math.max(...scores) : null;
    const bestRow =
      best !== null ? submitted.find((a) => a.score === best) ?? null : null;
    const latestSubmitted =
      submitted.length > 0 ? submitted[submitted.length - 1] : null;
    const roster = rosterById.get(studentId);
    students.push({
      student_id: studentId,
      student_name: nameById.get(studentId) ?? "(unknown)",
      enrollment_no: roster?.enrollment_no ?? null,
      batch_name: roster?.batch_name ?? null,
      in_roster: !!roster,
      attempts: attemptRows,
      submitted_count: submitted.length,
      best_score: best,
      best_pct: bestRow?.pct ?? null,
      latest_submitted_score: latestSubmitted?.score ?? null,
    });
  }
  students.sort((a, b) => {
    const ab = a.best_score ?? -Infinity;
    const bb = b.best_score ?? -Infinity;
    if (bb !== ab) return bb - ab;
    return a.student_name.localeCompare(b.student_name);
  });

  // Not-attempted = roster students without any attempt row.
  const attemptedIds = new Set(students.map((s) => s.student_id));
  const notAttempted: NotAttemptedRow[] = rosterRows
    .filter((r) => !attemptedIds.has(r.user_id))
    .map((r) => ({
      student_id: r.user_id,
      student_name: nameById.get(r.user_id) ?? "(unknown)",
      enrollment_no: r.enrollment_no,
      batch_name: r.batches?.name ?? null,
    }))
    .sort((a, b) => a.student_name.localeCompare(b.student_name));

  // Question analysis (over submitted attempts).
  const submittedTotal = submittedAttempts.length;
  const questionAnalysis: QuestionAnalysisRow[] = qqRows.map((r) => {
    const correctOpt = correctByQ.get(r.question_id);
    const selections = selByQ.get(r.question_id) ?? [];
    let correct = 0;
    for (const sel of selections) {
      if (correctOpt && sel === correctOpt) correct++;
    }
    return {
      question_id: r.question_id,
      sort_order: r.sort_order,
      prompt_md: r.questions?.prompt_md ?? "",
      total_attempts: submittedTotal,
      correct_attempts: correct,
      pct_correct:
        submittedTotal > 0 ? Math.round((correct / submittedTotal) * 100) : 0,
    };
  });

  // Summary.
  const submittedScores = submittedAttempts
    .map((a) => num(a.score))
    .filter((s): s is number => s !== null);
  const submittedPcts = submittedAttempts
    .map((a) => {
      const s = num(a.score);
      const m = num(a.max_score);
      return s !== null && m && m > 0 ? (s / m) * 100 : null;
    })
    .filter((p): p is number => p !== null);
  const summary: ResultsSummary = {
    roster_size: rosterRows.length,
    attempted_students: students.length,
    submitted_students: students.filter((s) => s.submitted_count > 0).length,
    not_attempted: notAttempted.length,
    total_attempts: attempts.length,
    submitted_attempts: submittedAttempts.length,
    avg_score: submittedScores.length
      ? Math.round(
          (submittedScores.reduce((a, b) => a + b, 0) /
            submittedScores.length) *
            100,
        ) / 100
      : null,
    avg_pct: submittedPcts.length
      ? Math.round(
          submittedPcts.reduce((a, b) => a + b, 0) / submittedPcts.length,
        )
      : null,
    high_score: submittedScores.length ? Math.max(...submittedScores) : null,
    low_score: submittedScores.length ? Math.min(...submittedScores) : null,
  };

  return { meta, summary, students, notAttempted, questionAnalysis };
}

export default async function QuizResultsPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const data = await loadData(id);
  if (!data) notFound();

  return (
    <QuizResultsClient
      meta={data.meta}
      summary={data.summary}
      students={data.students}
      notAttempted={data.notAttempted}
      questionAnalysis={data.questionAnalysis}
    />
  );
}
