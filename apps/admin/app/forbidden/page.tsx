import Link from "next/link";
import { FyneLogo } from "@/components/fyne-logo";

export const metadata = {
  title: "Access denied · FyneStudy Admin",
};

export default function ForbiddenPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 dark:bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(48rem 28rem at 50% -8%, rgba(59,91,219,0.12), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="header" />
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-card p-8 text-center shadow-xl shadow-slate-900/[0.05] dark:shadow-none">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Access denied
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You are signed in, but your account does not have admin permissions
            for this panel. Students and teachers use the FyneStudy mobile app.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-blue-600 dark:text-blue-500 transition-colors hover:text-blue-700 dark:hover:text-blue-400 hover:underline"
          >
            Use a different account
          </Link>
        </div>
      </div>
    </main>
  );
}
