import { FyneLogo } from "@/components/fyne/FyneLogo";
import { ForgotForm } from "./forgot-form";

export const metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <header className="space-y-1.5 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Reset password
          </h1>
          <p className="text-sm text-slate-500">
            We&apos;ll send a one-time reset link to your registered email.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-7">
          <ForgotForm />
        </div>
      </div>
    </main>
  );
}
