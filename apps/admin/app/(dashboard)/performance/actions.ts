"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface OfflineScoreActionState {
  error?: string;
  ok?: boolean;
}

const DeleteForm = z.object({ offline_score_id: z.string().uuid() });

export async function deleteOfflineScoreAction(
  _prev: OfflineScoreActionState,
  formData: FormData,
): Promise<OfflineScoreActionState> {
  const parsed = DeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const r = await callEdgeFn<{ error?: string }>(
    "exam-admin-mutate",
    {
      op: "delete_offline_score",
      offline_score_id: parsed.data.offline_score_id,
    },
    session.access_token,
  );
  if (r.status !== 200) {
    const d = r.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${r.status}).` };
  }
  revalidatePath("/performance");
  return { ok: true };
}

const UpsertForm = z.object({
  batch_id: z.string().uuid(),
  test_name: z.string().min(1).max(200),
  test_date: z.string(),
  subject_id: z.string().uuid().optional().nullable(),
  max_score: z.number().positive(),
  entries: z.array(
    z.object({
      student_id: z.string().uuid(),
      score: z.number().min(0),
      notes: z.string().optional().nullable(),
    })
  ),
});

export async function bulkUpsertOfflineScoresAction(
  _prev: OfflineScoreActionState,
  payload: {
    batch_id: string;
    test_name: string;
    test_date: string;
    subject_id?: string | null;
    max_score: number;
    entries: { student_id: string; score: number; notes?: string | null }[];
  }
): Promise<OfflineScoreActionState> {
  const parsed = UpsertForm.safeParse(payload);
  if (!parsed.success) {
    return { error: `Validation failed: ${parsed.error.issues.map(i => i.message).join(", ")}` };
  }

  const session = await requireAdmin();
  const r = await callEdgeFn<{ error?: string; inserted_count?: number; updated_count?: number }>(
    "offline-score-upsert",
    {
      ...parsed.data,
      subject_id: parsed.data.subject_id ?? undefined,
      entries: parsed.data.entries.map((e) => ({
        student_id: e.student_id,
        score: e.score,
        ...(e.notes ? { notes: e.notes } : {}),
      })),
    },
    session.access_token,
  );

  if (r.status !== 200) {
    const d = r.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${r.status}).` };
  }

  revalidatePath("/performance");
  return { ok: true };
}

export async function getBatchDetails(batchId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  
  const [studentsRes, subjectsRes] = await Promise.all([
    supabase
      .from("students")
      .select("user_id, app_users!user_id(full_name, email)")
      .eq("batch_id", batchId)
      .order("user_id"),
    supabase
      .from("batches")
      .select("course_id, courses(subjects(id, name))")
      .eq("id", batchId)
      .maybeSingle()
  ]);

  const students = ((studentsRes.data ?? []) as unknown as Array<{user_id: string; app_users: {full_name: string; email: string} | null}>).map(s => ({
    user_id: s.user_id,
    full_name: s.app_users?.full_name ?? "Unknown",
    email: s.app_users?.email ?? "Unknown"
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subjectsRaw = (subjectsRes.data as any)?.courses?.subjects ?? (subjectsRes.data as any)?.courses?.[0]?.subjects ?? [];
  const subjects = (subjectsRaw as Array<{id: string; name: string}>).map(s => ({
    id: s.id,
    name: s.name
  }));

  return { students, subjects };
}

export async function getStudentProfile(studentId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  
  const [studentRes, scoresRes, attendanceRes] = await Promise.all([
    supabase
      .from("students")
      .select("user_id, batch_id, app_users!user_id(full_name, email), batches(name, courses(code))")
      .eq("user_id", studentId)
      .single(),
    supabase
      .from("offline_test_scores")
      .select("id, test_name, test_date, score, max_score, notes, subjects(name)")
      .eq("student_id", studentId)
      .order("test_date", { ascending: false }),
    supabase
      .from("attendance")
      .select("status")
      .eq("student_id", studentId)
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = studentRes.data as any;
  const student = {
    id: studentId,
    name: s?.app_users?.full_name ?? "Unknown",
    email: s?.app_users?.email ?? "",
    batch: s?.batches?.name ?? "",
    course: s?.batches?.courses?.code ?? ""
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scores = (scoresRes.data ?? []).map((r: any) => ({
    id: r.id,
    test_name: r.test_name,
    test_date: r.test_date,
    score: Number(r.score),
    max_score: Number(r.max_score),
    subject: r.subjects?.name ?? "General",
    notes: r.notes
  }));

  const attData = attendanceRes.data ?? [];
  const totalSessions = attData.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presentSessions = attData.filter((a: any) => a.status === "present" || a.status === "late").length;
  const attendancePercentage = totalSessions > 0 ? (presentSessions / totalSessions) * 100 : null;

  return { 
    student, 
    scores, 
    attendance: { total: totalSessions, present: presentSessions, percentage: attendancePercentage } 
  };
}

export async function getBatchReportData(batchId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [batchRes, studentsRes, scoresRes, attRes] = await Promise.all([
    supabase.from("batches").select("name, courses(code)").eq("id", batchId).single(),
    supabase.from("students").select("user_id, app_users!user_id(full_name)").eq("batch_id", batchId),
    supabase.from("offline_test_scores").select("student_id, test_name, test_date, score, max_score, subjects(name)").eq("batch_id", batchId),
    supabase.from("attendance").select("student_id, status, sessions!inner(batch_id)").eq("sessions.batch_id", batchId)
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = batchRes.data as any;
  const batchInfo = {
    id: batchId,
    name: b?.name ?? "Unknown Batch",
    course: b?.courses?.code ?? ""
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (studentsRes.data ?? []).map((s: any) => ({
    id: s.user_id,
    name: s.app_users?.full_name ?? "Unknown"
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scores = (scoresRes.data ?? []).map((r: any) => ({
    student_id: r.student_id,
    test_name: r.test_name,
    test_date: r.test_date,
    score: Number(r.score),
    max_score: Number(r.max_score),
    subject: r.subjects?.name ?? "General"
  }));

  const attendanceData = attRes.data ?? [];

  return { batchInfo, students, scores, attendance: attendanceData };
}
