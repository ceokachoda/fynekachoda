import Link from "next/link";

export const metadata = {
  title: "Access denied · FyneStudy Admin",
};

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Access denied</h1>
        <p className="text-sm text-slate-600">
          You are signed in, but your account does not have admin permissions
          for this panel. Students and teachers use the FyneStudy mobile app.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Use a different account
        </Link>
      </div>
    </main>
  );
}
