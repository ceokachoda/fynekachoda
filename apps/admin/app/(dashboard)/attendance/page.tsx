import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { AttendanceMatrix } from "./attendance-client";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Attendance · FyneStudy Admin",
};

interface PageProps {
  searchParams: Promise<{
    date?: string;
    batch?: string;
    session?: string;
  }>;
}

interface BatchOption {
  id: string;
  name: string;
  course_code: string;
}

interface StudentRow {
  user_id: string;
  full_name: string;
  email: string;
}

interface SessionCol {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  subject_name: string | null;
  title: string | null;
  is_ad_hoc: boolean;
}

export interface AttendanceCell {
  attendance_id: string;
  status: "present" | "late" | "absent";
  method: "qr" | "manual" | "correction";
  marked_at: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return isoDate(new Date());
}

function thirtyDaysAgoIso(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 30);
  return isoDate(d);
}

function safeIsoDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

async function loadData(filters: { from: string; to: string; batch?: string }) {
  const supabase = await createSupabaseServerClient();

  const batchesRes = await supabase
    .from("batches")
    .select("id, name, courses(code)")
    .eq("is_active", true)
    .order("name");
  const batches: BatchOption[] = ((batchesRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    courses: { code: string } | null;
  }>).map((b) => ({
    id: b.id,
    name: b.name,
    course_code: b.courses?.code ?? "—",
  }));

  if (!filters.batch) {
    return {
      batches,
      students: [] as StudentRow[],
      sessions: [] as SessionCol[],
      cells: new Map<string, AttendanceCell>(),
    };
  }

  const fromIso = new Date(`${filters.from}T00:00:00+05:30`).toISOString();
  const toIso = new Date(
    new Date(`${filters.to}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();

  const studentsRes = await supabase
    .from("students")
    .select("user_id, app_users!user_id(full_name, email)")
    .eq("batch_id", filters.batch);
  const students: StudentRow[] = ((studentsRes.data ?? []) as unknown as Array<{
    user_id: string;
    app_users: { full_name: string; email: string } | null;
  }>)
    .map((r) => ({
      user_id: r.user_id,
      full_name: r.app_users?.full_name ?? "(unknown)",
      email: r.app_users?.email ?? "",
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const sessionsRes = await supabase
    .from("sessions")
    .select("id, scheduled_start, scheduled_end, is_ad_hoc, title, subjects(name)")
    .eq("batch_id", filters.batch)
    .gte("scheduled_start", fromIso)
    .lt("scheduled_start", toIso)
    .order("scheduled_start", { ascending: true });
  const sessions: SessionCol[] = ((sessionsRes.data ?? []) as unknown as Array<{
    id: string;
    scheduled_start: string;
    scheduled_end: string;
    is_ad_hoc: boolean;
    subjects: { name: string } | null;
    title: string | null;
  }>).map((s) => ({
    id: s.id,
    scheduled_start: s.scheduled_start,
    scheduled_end: s.scheduled_end,
    subject_name: s.subjects?.name ?? null,
    title: s.title ?? null,
    is_ad_hoc: s.is_ad_hoc,
  }));

  const cells = new Map<string, AttendanceCell>();
  if (sessions.length > 0 && students.length > 0) {
    const attRes = await supabase
      .from("attendance")
      .select("id, session_id, student_id, status, method, marked_at")
      .in(
        "session_id",
        sessions.map((s) => s.id),
      );
    for (const a of ((attRes.data ?? []) as unknown as Array<{
      id: string;
      session_id: string;
      student_id: string;
      status: "present" | "late" | "absent";
      method: "qr" | "manual" | "correction";
      marked_at: string;
    }>)) {
      cells.set(`${a.session_id}|${a.student_id}`, {
        attendance_id: a.id,
        status: a.status,
        method: a.method,
        marked_at: a.marked_at,
      });
    }
  }

  return { batches, students, sessions, cells };
}

export default async function AttendancePage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const date = safeIsoDate(params.date, todayIso());
  const from = thirtyDaysAgoIso(date);
  const to = date;
  
  const batch = params.batch && /^[0-9a-f-]{36}$/i.test(params.batch) ? params.batch : undefined;
  const sessionParam = params.session && /^[0-9a-f-]{36}$/i.test(params.session) ? params.session : undefined;

  const { batches, students, sessions, cells } = await loadData({ from, to, batch });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Attendance Management" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Attendance" }]}
      />

      <AttendanceMatrix
        selectedDate={date}
        selectedBatchId={batch}
        selectedSessionId={sessionParam}
        batches={batches}
        students={students}
        sessions={sessions}
        cellsRecord={Object.fromEntries(cells)}
      />
    </div>
  );
}
