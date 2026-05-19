"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

export interface QuizActionState {
  error?: string;
  ok?: boolean;
}

const ToggleForm = z.object({
  quiz_id: z.string().uuid(),
  next: z.enum(["publish", "unpublish"]),
});

export async function togglePublishQuizAction(
  _prev: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const parsed = ToggleForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string }>(
    "quiz-admin-mutate",
    {
      op: "toggle_publish_quiz",
      quiz_id: parsed.data.quiz_id,
      is_published: parsed.data.next === "publish",
    },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/quizzes");
  return { ok: true };
}

const DeleteForm = z.object({ quiz_id: z.string().uuid() });

export async function deleteQuizAction(
  _prev: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const parsed = DeleteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid request." };
  const session = await requireAdmin();
  const result = await callEdgeFn<{ error?: string }>(
    "quiz-admin-mutate",
    { op: "delete_quiz", quiz_id: parsed.data.quiz_id },
    session.access_token,
  );
  if (result.status !== 200) {
    const d = result.data as { error?: string };
    return { error: d?.error ?? `Failed (status ${result.status}).` };
  }
  revalidatePath("/quizzes");
  return { ok: true };
}
