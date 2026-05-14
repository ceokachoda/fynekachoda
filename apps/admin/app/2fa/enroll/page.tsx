import { startTotpEnrollment } from "./actions";
import { EnrollClient } from "./enroll-client";

export const metadata = {
  title: "Set up 2-factor auth · FyneStudy Admin",
};

export default async function EnrollPage() {
  const result = await startTotpEnrollment();

  if (!result.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">Could not start 2FA enrollment.</p>
          <p className="mt-1">{result.error}</p>
          <p className="mt-3 text-xs text-red-600">
            Try signing out and signing back in, then retry. If this persists,
            contact your platform admin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Set up 2-factor auth
          </h1>
          <p className="text-sm text-slate-500">
            Required for all admin accounts.
          </p>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <EnrollClient setup={result.setup} />
        </div>
      </div>
    </main>
  );
}
