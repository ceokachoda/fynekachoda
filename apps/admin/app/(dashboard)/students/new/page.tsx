import Link from "next/link";
import { NewStudentForm } from "./new-student-form";

export const metadata = {
  title: "New student · FyneStudy Admin",
};

export default function NewStudentPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Back to students
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          New student
        </h1>
        <p className="text-sm text-slate-500">
          Creating the account generates an initial password that the admin
          must share with the student. Batch and course are assigned later
          (Phase 3).
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewStudentForm />
      </div>
    </div>
  );
}
