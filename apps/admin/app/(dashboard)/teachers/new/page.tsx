import Link from "next/link";
import { NewTeacherForm } from "./new-teacher-form";

export const metadata = {
  title: "New teacher · FyneStudy Admin",
};

export default function NewTeacherPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/teachers" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to teachers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">New teacher</h1>
        <p className="text-sm text-slate-500">
          Creating the account generates an initial password. After creation,
          you can assign the teacher to one or more batches from their profile.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewTeacherForm />
      </div>
    </div>
  );
}
