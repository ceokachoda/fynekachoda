"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

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
  revalidatePath("/offline-scores");
  return { ok: true };
}
