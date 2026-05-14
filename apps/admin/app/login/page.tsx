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
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">FyneStudy Admin</h1>
          <p className="text-sm text-slate-500">Sign in with your admin email.</p>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>
        <p className="text-center text-xs text-slate-400">
          Admin accounts are issued by the institute owner. No self-signup.
        </p>
      </div>
    </main>
  );
}
