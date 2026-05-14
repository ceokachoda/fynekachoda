import { ForcePasswordChangeForm } from "./form";

export const metadata = {
  title: "Choose a new password · FyneStudy Admin",
};

export default function ForcePasswordChangePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Choose a new password
          </h1>
          <p className="text-sm text-slate-500">
            Your admin-issued temporary password must be changed before you can
            access the panel.
          </p>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <ForcePasswordChangeForm />
        </div>
      </div>
    </main>
  );
}
