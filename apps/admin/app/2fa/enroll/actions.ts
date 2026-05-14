"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface EnrollSetup {
  factorId: string;
  qrSvg: string;
  uri: string;
  secret: string;
}

// Removes any pre-existing unverified factors (left over from incomplete prior
// enrollments) and creates a fresh TOTP factor. Returns the QR + secret for
// the UI to render.
export async function startTotpEnrollment(): Promise<
  | { ok: true; setup: EnrollSetup }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  const { data: factorsData, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { ok: false, error: listErr.message };

  // `factorsData.totp` is already filtered to verified factors by the SDK;
  // unverified leftovers live in `factorsData.all`. Drop them so we don't
  // accumulate dead enrollment attempts.
  for (const f of factorsData?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "FyneStudy Admin",
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "enroll failed" };
  }

  return {
    ok: true,
    setup: {
      factorId: data.id,
      qrSvg: data.totp.qr_code,
      uri: data.totp.uri,
      secret: data.totp.secret,
    },
  };
}

const VerifyInput = z.object({
  factor_id: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your app"),
});

export interface VerifyEnrollState {
  error?: string;
  fieldError?: string;
}

export async function verifyEnrollmentAction(
  _prev: VerifyEnrollState,
  formData: FormData,
): Promise<VerifyEnrollState> {
  const parsed = VerifyInput.safeParse({
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
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}
