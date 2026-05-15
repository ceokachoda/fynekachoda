import Link from "next/link";
import { RecoveryForm } from "./recovery-form";

export const metadata = {
  title: "Use a recovery code · FyneStudy Admin",
};

export default function RecoveryPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Use a recovery code
          </h1>
          <p className="text-sm text-slate-500">
            Each code works once. After you use one, 2FA will be reset and
            you&apos;ll be prompted to enroll a new authenticator.
          </p>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <RecoveryForm />
        </div>
        <p className="text-center text-sm">
          <Link href="/2fa/verify" className="text-slate-600 underline-offset-2 hover:underline">
            Back to authenticator code
          </Link>
        </p>
      </div>
    </main>
  );
}
