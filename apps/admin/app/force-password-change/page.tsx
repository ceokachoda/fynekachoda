import { AuthShell } from "@/components/auth-shell";
import { ForcePasswordChangeForm } from "./form";

export const metadata = {
  title: "Choose a new password · FyneStudy Admin",
};

export default function ForcePasswordChangePage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Your admin-issued temporary password must be changed before you can access the panel."
    >
      <ForcePasswordChangeForm />
    </AuthShell>
  );
}
