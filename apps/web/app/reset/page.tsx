import { FyneLogo } from "@/components/fyne/FyneLogo";
import { ResetForm } from "./reset-form";

export const metadata = {
  title: "Set a new password",
};

export default function ResetPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Set a new password
          </h1>
          <p className="text-sm text-slate-500">
            Pick something you&apos;ll remember.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ResetForm />
        </div>
      </div>
    </main>
  );
}
