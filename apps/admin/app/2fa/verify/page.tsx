import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Confirm it&apos;s you
          </h1>
          <p className="text-sm text-slate-500">
            Enter the 6-digit code from your authenticator app.
          </p>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <VerifyForm factorId={factor.id} />
        </div>
      </div>
    </main>
  );
}
