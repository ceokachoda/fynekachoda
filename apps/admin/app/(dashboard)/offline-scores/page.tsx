import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { OfflineScoresClient } from "./offline-scores-client";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Offline Scores · FyneStudy Admin",
};

export interface OfflineScoreRow {
  id: string;
  batch_id: string;
  batch_name: string;
  course_code: string;
  student_id: string;
  student_name: string;
  subject_id: string | null;
  subject_name: string | null;
  test_name: string;
  test_date: string;
  score: number;
  max_score: number;
  notes: string | null;
  entered_by: string;
  entered_by_name: string;
  entered_at: string;
}

export interface BatchOpt {
  id: string;
  name: string;
  course_id: string;
}

interface PageProps {
  searchParams: Promise<{ batch?: string; q?: string }>;
}

async function loadData(filters: { batch?: string; q?: string }) {
  const supabase = await createSupabaseServerClient();

  const batchesRes = await supabase
    .from("batches")
    .select("id, name, course_id")
    .order("name");
  const batches: BatchOpt[] = (batchesRes.data ?? []) as BatchOpt[];

  let query = supabase
    .from("offline_test_scores")
    .select(
      "id, batch_id, student_id, subject_id, test_name, test_date, score, max_score, notes, entered_by, entered_at, batches!inner(name, courses!inner(code)), students!inner(user_id, app_users!user_id(full_name)), subjects:subject_id(name), entered:app_users!entered_by(full_name)",
    )
    .order("test_date", { ascending: false })
    .order("entered_at", { ascending: false })
    .limit(500);
  if (filters.batch && /^[0-9a-f-]{36}$/i.test(filters.batch)) {
    query = query.eq("batch_id", filters.batch);
  }
  if (filters.q && filters.q.trim().length > 0) {
    query = query.ilike("test_name", `%${filters.q.trim()}%`);
  }
  const res = await query;
  type Row = {
    id: string;
    batch_id: string;
    student_id: string;
    subject_id: string | null;
    test_name: string;
    test_date: string;
    score: number | string;
    max_score: number | string;
    notes: string | null;
    entered_by: string;
    entered_at: string;
    batches: { name: string; courses: { code: string } } | null;
    students: { app_users: { full_name: string } | null } | null;
    subjects: { name: string } | null;
    entered: { full_name: string } | null;
  };
  const rows: OfflineScoreRow[] = ((res.data ?? []) as unknown as Row[]).map(
    (r) => ({
      id: r.id,
      batch_id: r.batch_id,
      batch_name: r.batches?.name ?? "—",
      course_code: r.batches?.courses?.code ?? "—",
      student_id: r.student_id,
      student_name: r.students?.app_users?.full_name ?? "(unknown)",
      subject_id: r.subject_id,
      subject_name: r.subjects?.name ?? null,
      test_name: r.test_name,
      test_date: r.test_date,
      score: Number(r.score),
      max_score: Number(r.max_score),
      notes: r.notes,
      entered_by: r.entered_by,
      entered_by_name: r.entered?.full_name ?? "(unknown)",
      entered_at: r.entered_at,
    }),
  );
  return { batches, rows };
}

export default async function OfflineScoresPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const { batches, rows } = await loadData({
    batch: params.batch,
    q: params.q,
  });
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Offline scores" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Offline Scores" }]}
      />
      <OfflineScoresClient
        rows={rows}
        batches={batches}
        filters={{ batch: params.batch ?? "", q: params.q ?? "" }}
      />
    </div>
  );
}
