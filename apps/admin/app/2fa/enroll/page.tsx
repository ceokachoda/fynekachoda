import { FyneLogo } from "@/components/fyne-logo";
import { AuthShell } from "@/components/auth-shell";
import { startTotpEnrollment } from "./actions";
import { EnrollClient } from "./enroll-client";

export const metadata = {
  title: "Set up 2-factor auth · FyneStudy Admin",
};

export default async function EnrollPage() {
  const result = await startTotpEnrollment();

  if (!result.ok) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-4">
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-xl shadow-red-900/[0.05]">
            <p className="font-medium">Could not start 2FA enrollment.</p>
            <p className="mt-1">{result.error}</p>
            <p className="mt-3 text-xs text-red-600">
              Try signing out and signing back in, then retry. If this persists,
              contact your platform admin.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AuthShell
      title="Set up 2-factor auth"
      description="Required for all admin accounts."
    >
      <EnrollClient setup={result.setup} />
    </AuthShell>
  );
}
