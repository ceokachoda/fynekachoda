"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const Input = z.object({
  factor_id: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export interface VerifyState {
  error?: string;
  fieldError?: string;
}

export async function verifyChallengeAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = Input.safeParse({
    factor_id: formData.get("factor_id"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0]?.message ?? "Invalid code." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factor_id,
    code: parsed.data.code,
  });
  if (error) return { error: "That code didn't work. Try again." };

  revalidatePath("/", "layout");
  redirect("/");
}
