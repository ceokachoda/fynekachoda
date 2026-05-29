import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { signOutAction } from "@/app/actions/sign-out";

export const metadata = {
  title: "Account suspended",
};

export default function SuspendedPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-red-50/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
            <svg
              className="size-7 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Account suspended
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Your account has been suspended by an administrator. Please contact your
            institute to reactivate it.
          </p>
          <form action={signOutAction} className="mt-6">
            <Button
              type="submit"
              size="lg"
              variant="default"
              className="h-12 w-full bg-slate-900 text-base font-bold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
