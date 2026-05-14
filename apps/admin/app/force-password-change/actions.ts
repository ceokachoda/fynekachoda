"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callEdgeFn } from "@/lib/auth";

const Input = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/\d/, "Include a digit")
      .regex(/^\S+$/, "No spaces allowed"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export interface ChangeState {
  error?: string;
  fieldErrors?: { password?: string; confirm?: string };
}

export async function forcePasswordChangeAction(
  _prev: ChangeState,
  formData: FormData,
): Promise<ChangeState> {
  const parsed = Input.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: ChangeState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "password") fieldErrors.password = issue.message;
      if (field === "confirm") fieldErrors.confirm = issue.message;
    }
    return { error: "Check the form below.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expired. Sign in again." };

  if (user.email && parsed.data.password.toLowerCase() === user.email.toLowerCase()) {
    return {
      error: "Check the form below.",
      fieldErrors: { password: "Password cannot match your email" },
    };
  }

  const { error: pwErr } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (pwErr) return { error: pwErr.message };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Lost session while saving password. Sign in again." };

  const clear = await callEdgeFn(
    "auth-clear-must-change",
    {},
    session.access_token,
  );
  if (clear.status !== 200) {
    const detail =
      typeof clear.data === "object" && clear.data && "error" in clear.data
        ? String((clear.data as { error: unknown }).error)
        : `status ${clear.status}`;
    return { error: `Could not clear the change-password flag: ${detail}` };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
