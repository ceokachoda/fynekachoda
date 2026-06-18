import { FyneLogo } from "@/components/fyne-logo";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · FyneStudy Admin",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 dark:bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(48rem 28rem at 50% -8%, rgba(59,91,219,0.12), transparent 70%), radial-gradient(38rem 24rem at 85% 110%, rgba(79,70,229,0.10), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md space-y-6">
        <header className="flex flex-col items-center space-y-3 text-center">
          <FyneLogo variant="large" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Sign in with your admin email.</p>
        </header>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-card p-7 shadow-xl shadow-slate-900/[0.05] dark:shadow-none">
          <LoginForm next={next} />
        </div>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Admin accounts are issued by the institute owner. No self-signup.
        </p>
      </div>
    </main>
  );
}
