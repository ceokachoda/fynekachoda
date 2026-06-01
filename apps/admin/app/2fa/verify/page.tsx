import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthShell } from "@/components/auth-shell";
import { VerifyForm } from "./verify-form";

export const metadata = {
  title: "2-factor verify · FyneStudy Admin",
};

export default async function VerifyPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  // `data.totp` is already filtered to verified factors by the SDK.
  const factor = data?.totp[0];

  if (error || !factor) {
    // No verified factor — middleware should have routed to /2fa/enroll
    // instead, but guard anyway.
    redirect("/2fa/enroll");
  }

  return (
    <AuthShell
      title="Confirm it's you"
      description="Enter the 6-digit code from your authenticator app."
      footer={
        <p className="text-center text-sm">
          <Link
            href="/2fa/recovery"
            className="text-slate-600 underline-offset-2 hover:underline"
          >
            Lost your authenticator? Use a recovery code
          </Link>
        </p>
      }
    >
      <VerifyForm factorId={factor.id} />
    </AuthShell>
  );
}
