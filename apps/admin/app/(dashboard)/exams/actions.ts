"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface ExamActionState {
  error?: string;
  ok?: boolean;
}

const ToggleForm = z.object({
  exam_id: z.string().uuid(),
  next: z.enum(["publish", "unpublish"]),
});

export async function togglePublishExamAction(
  _prev: ExamActionState,
  formData: FormData,
): Promise<ExamActionState> {
  const parsed = ToggleForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const r = await callEdgeFn<{ error?: string }>(
    "exam-admin-mutate",
    {
      op: "toggle_publish_exam",
      exam_id: parsed.data.exam_id,
      is_published: parsed.data.next === "publish",
    },
    session.access_token,
  );
  if (r.status !== 200) {
    const d = r.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${r.status}).` };
  }
  revalidatePath("/exams");
  return { ok: true };
}

const ReleaseForm = z.object({
  exam_id: z.string().uuid(),
  mode: z.enum(["release", "unrelease"]),
});

export async function forceReleaseAction(
  _prev: ExamActionState,
  formData: FormData,
): Promise<ExamActionState> {
  const parsed = ReleaseForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const r = await callEdgeFn<{ error?: string }>(
    "exam-admin-mutate",
    {
      op: parsed.data.mode === "release" ? "force_release_results" : "force_unrelease_results",
      exam_id: parsed.data.exam_id,
    },
    session.access_token,
  );
  if (r.status !== 200) {
    const d = r.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${r.status}).` };
  }
  revalidatePath("/exams");
  return { ok: true };
}

const DeleteForm = z.object({ exam_id: z.string().uuid() });

export async function deleteExamAction(
  _prev: ExamActionState,
  formData: FormData,
): Promise<ExamActionState> {
  const parsed = DeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const r = await callEdgeFn<{ error?: string }>(
    "exam-admin-mutate",
    { op: "delete_exam", exam_id: parsed.data.exam_id },
    session.access_token,
  );
  if (r.status !== 200) {
    const d = r.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${r.status}).` };
  }
  revalidatePath("/exams");
  return { ok: true };
}
