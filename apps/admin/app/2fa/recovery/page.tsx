import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RecoveryForm } from "./recovery-form";

export const metadata = {
  title: "Use a recovery code · FyneStudy Admin",
};

export default function RecoveryPage() {
  return (
    <AuthShell
      title="Use a recovery code"
      description="Each code works once. After you use one, 2FA will be reset and you'll be prompted to enroll a new authenticator."
      footer={
        <p className="text-center text-sm">
          <Link
            href="/2fa/verify"
            className="text-slate-600 underline-offset-2 hover:underline"
          >
            Back to authenticator code
          </Link>
        </p>
      }
    >
      <RecoveryForm />
    </AuthShell>
  );
}
