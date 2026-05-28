import { FyneLogo } from "@/components/fyne/FyneLogo";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>

        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Welcome to FyneStudy
          </h1>
          <p className="text-sm text-slate-500">
            Sign in with the email your institute issued.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>

        <p className="text-center text-xs text-slate-400">
          Admin-issued accounts only. Contact your institute if you don&apos;t have one.
        </p>
      </div>
    </main>
  );
}
