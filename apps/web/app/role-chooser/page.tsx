import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { loadWebSession } from "@/lib/auth";
import { setActiveRoleAction } from "@/app/actions/set-active-role";
import { signOutAction } from "@/app/actions/sign-out";

export const metadata = {
  title: "Choose a role",
};

export default async function RoleChooserPage() {
  const { session, redirectTo } = await loadWebSession();
  // Only multi-role users should land here. Anyone else gets routed away.
  if (redirectTo && redirectTo !== "/role-chooser") redirect(redirectTo);
  if (!session) redirect("/login");
  const isStudent = session.roles.includes("student");
  const isTeacher = session.roles.includes("teacher");
  if (!(isStudent && isTeacher)) redirect("/");

  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <header className="space-y-1.5 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Choose a role
          </h1>
          <p className="text-sm text-slate-500">
            Your account has both student and teacher roles. Which one are you using today?
          </p>
        </header>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-7">
          <form action={setActiveRoleAction}>
            <input type="hidden" name="role" value="student" />
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full text-base font-bold shadow-sm transition-all hover:shadow-md"
            >
              Continue as student
            </Button>
          </form>

          <form action={setActiveRoleAction}>
            <input type="hidden" name="role" value="teacher" />
            <Button
              type="submit"
              size="lg"
              variant="outline"
              className="h-12 w-full text-base font-bold"
            >
              Continue as teacher
            </Button>
          </form>

          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="h-11 w-full text-sm text-slate-500 hover:text-slate-700"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
