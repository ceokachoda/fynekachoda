import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { signOutAction } from "@/app/actions/sign-out";

export const metadata = {
  title: "Account suspended",
};

export default function SuspendedPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-red-700">
            Account suspended
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Your account has been suspended by an administrator. Please contact your
            institute to reactivate it.
          </p>
          <form action={signOutAction} className="mt-6">
            <Button
              type="submit"
              size="lg"
              variant="default"
              className="h-11 w-full bg-slate-900 text-white hover:bg-slate-800"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
