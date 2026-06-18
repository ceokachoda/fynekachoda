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
  if (!parsed.success) return { error: "Invalid data format." };

  const session = await requireAdmin();
  const r = await callEdgeFn<{ error?: string; inserted_count?: number; updated_count?: number }>(
    "offline-score-upsert",
    {
      ...parsed.data,
      subject_id: parsed.data.subject_id ?? undefined,
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
