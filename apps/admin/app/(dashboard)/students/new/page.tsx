import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewStudentForm } from "./new-student-form";

export const metadata = {
  title: "New student · FyneStudy Admin",
};

async function fetchActiveBatches(): Promise<{
  id: string;
  name: string;
  course: string;
}[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("id, name, courses(code, name)")
    .eq("is_active", true)
    .order("name");
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    courses: { code: string; name: string } | null;
  }>).map((b) => ({
    id: b.id,
    name: b.name,
    course: b.courses ? `${b.courses.code} · ${b.courses.name}` : "—",
  }));
}

export default async function NewStudentPage() {
  const batches = await fetchActiveBatches();
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
          must share with the student. Pick the student&apos;s batch — the
          course is derived from the batch.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewStudentForm batches={batches} />
      </div>
    </div>
  );
}
