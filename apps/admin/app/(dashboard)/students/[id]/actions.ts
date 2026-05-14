"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

const SuspendInput = z.object({
  user_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export interface SuspendResult {
  ok: boolean;
  error?: string;
}

export async function suspendStudentAction(
  formData: FormData,
): Promise<SuspendResult> {
  const parsed = SuspendInput.safeParse({
    user_id: formData.get("user_id"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid form data." };
  }
  const session = await requireAdmin();

  const result = await callEdgeFn(
    "auth-suspend",
    {
      user_id: parsed.data.user_id,
      mode: "suspend",
      reason: parsed.data.reason,
    },
    session.access_token,
  );
  if (result.status !== 200) {
    return errorFor(result);
  }
  revalidatePath(`/students/${parsed.data.user_id}`);
  revalidatePath("/students");
  return { ok: true };
}

export async function unsuspendStudentAction(
  formData: FormData,
): Promise<SuspendResult> {
  const userId = formData.get("user_id");
  if (typeof userId !== "string" || !uuidRe.test(userId)) {
    return { ok: false, error: "Invalid user id." };
  }
  const session = await requireAdmin();

  const result = await callEdgeFn(
    "auth-suspend",
    { user_id: userId, mode: "unsuspend" },
    session.access_token,
  );
  if (result.status !== 200) {
    return errorFor(result);
  }
  revalidatePath(`/students/${userId}`);
  revalidatePath("/students");
  return { ok: true };
}

export interface ForceResetResult {
  ok: boolean;
  error?: string;
  initial_password?: string;
}

export async function forceResetStudentAction(
  formData: FormData,
): Promise<ForceResetResult> {
  const userId = formData.get("user_id");
  if (typeof userId !== "string" || !uuidRe.test(userId)) {
    return { ok: false, error: "Invalid user id." };
  }
  const session = await requireAdmin();

  const result = await callEdgeFn<{ initial_password: string }>(
    "auth-force-reset",
    { user_id: userId },
    session.access_token,
  );
  if (result.status !== 200) {
    return errorFor(result);
  }
  revalidatePath(`/students/${userId}`);
  const data = result.data as { initial_password: string };
  return { ok: true, initial_password: data.initial_password };
}

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorFor(result: {
  status: number;
  data: unknown;
}): { ok: false; error: string } {
  const detail =
    typeof result.data === "object" && result.data && "error" in result.data
      ? String((result.data as { error: unknown }).error)
      : `status ${result.status}`;
  return { ok: false, error: detail };
}
