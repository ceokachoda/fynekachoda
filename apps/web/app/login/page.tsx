import { FyneLogo } from "@/components/fyne/FyneLogo";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
  description:
    "Sign in to FyneStudy with the email your institute issued. Students and teachers, on every device.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>

        <header className="space-y-1.5 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Welcome to FyneStudy
          </h1>
          <p className="text-sm text-slate-500">
            Sign in with the email your institute issued.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-7">
          <LoginForm next={next} />
        </div>

        <p className="text-center text-xs text-slate-500">
          Admin-issued accounts only. Contact your institute if you don&apos;t have one.
        </p>
      </div>
    </main>
  );
}
