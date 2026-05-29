import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { env } from "@/lib/env";
import { signOutAction } from "@/app/actions/sign-out";

export const metadata = {
  title: "Admin account",
};

export default function AdminRedirectPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md">
          <h1 className="text-2xl font-extrabold text-slate-900">Admin account</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Admin operations happen on the web admin panel. Use a browser to sign
            in at the admin URL below.
          </p>

          <Button asChild size="lg" className="mt-6 h-12 w-full text-base font-bold shadow-sm transition-all hover:shadow-md">
            <Link href={env.adminUrl} target="_blank" rel="noreferrer">
              Open admin panel
            </Link>
          </Button>

          <form action={signOutAction} className="mt-3">
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
