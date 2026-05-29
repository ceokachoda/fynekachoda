import { redirect } from "next/navigation";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ForcePasswordForm } from "./force-form";

export const metadata = {
  title: "Choose a new password",
};

export default async function ForcePasswordChangePage() {
  // Middleware guarantees: user is signed-in, app_users row exists, is_active,
  // and either must_change_password is true OR a multi-role admin landed here
  // pre-cookie. We just need the email for the password-cannot-match check.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login");

  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <header className="space-y-1.5 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Choose a new password
          </h1>
          <p className="text-sm text-slate-500">
            Your admin-issued temporary password must be changed before you continue.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-7">
          <ForcePasswordForm email={user.email} />
        </div>
      </div>
    </main>
  );
}
