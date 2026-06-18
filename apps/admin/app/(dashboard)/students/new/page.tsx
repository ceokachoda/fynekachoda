import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewStudentForm } from "./new-student-form";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader
        title="New student"
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Students", href: "/students" },
          { label: "New student" }
        ]}
        description="Creating the account generates an initial password that the admin must share with the student. Pick the student's batch — the course is derived from the batch."
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <NewStudentForm batches={batches} />
      </div>
    </div>
  );
}
