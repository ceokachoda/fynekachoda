"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callEdgeFn, requireAdmin } from "@/lib/auth";

const Input = z.object({
  code: z.string().trim().min(1, "Enter a recovery code"),
});

export interface RecoveryState {
  error?: string;
  fieldError?: string;
}

export async function consumeRecoveryAction(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = Input.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0]?.message ?? "Enter a recovery code." };
  }

  const session = await requireAdmin();
  const result = await callEdgeFn<{ consumed: boolean; factors_deleted: number }>(
    "mfa-codes-consume",
    { code: parsed.data.code },
    session.access_token,
  );

  if (result.status === 401) {
    const detail =
      typeof result.data === "object" && result.data && "error" in result.data
        ? String((result.data as { error: unknown }).error)
        : "invalid recovery code";
    return {
      fieldError:
        detail.toLowerCase().includes("already used")
          ? "That code has already been used. Try a different one."
          : "That recovery code is not valid. Try a different one.",
    };
  }
  if (result.status !== 200) {
    const detail =
      typeof result.data === "object" && result.data && "error" in result.data
        ? String((result.data as { error: unknown }).error)
        : `status ${result.status}`;
    return { error: `Could not consume recovery code: ${detail}` };
  }

  // Factor has been deleted server-side. Middleware will route the next
  // request through Stage A (no verified factor) → /2fa/enroll, where a fresh
  // batch of codes is issued.
  revalidatePath("/", "layout");
  redirect("/2fa/enroll");
}
