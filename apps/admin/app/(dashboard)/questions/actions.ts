"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface QuestionActionState {
  error?: string;
  ok?: boolean;
}

const ArchiveForm = z.object({
  question_id: z.string().uuid(),
  next: z.enum(["archive", "unarchive"]),
});

export async function archiveQuestionAction(
  _prev: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const parsed = ArchiveForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string }>(
    "quiz-admin-mutate",
    {
      op: "archive_question",
      question_id: parsed.data.question_id,
      is_archived: parsed.data.next === "archive",
    },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/questions");
  return { ok: true };
}

const DeleteForm = z.object({ question_id: z.string().uuid() });

export async function deleteQuestionAction(
  _prev: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const parsed = DeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string; detail?: unknown }>(
    "quiz-admin-mutate",
    { op: "delete_question", question_id: parsed.data.question_id },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/questions");
  return { ok: true };
}
