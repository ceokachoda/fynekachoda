import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewCourseButton } from "./new-course-button";
import { PageHeader } from "@/components/page-header";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { BookOpen } from "lucide-react";

export const metadata = {
  title: "Courses · FyneStudy Admin",
};

interface CourseRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

async function fetchCoursesAndCounts(): Promise<{
  courses: CourseRow[];
  subjectCounts: Map<string, number>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("id, code, name, description, is_active, created_at")
    .order("code");

  if (cErr) {
    console.error("courses list query failed:", cErr.message);
    return { courses: [], subjectCounts: new Map() };
  }

  const ids = (courses ?? []).map((c) => c.id);
  const subjectCounts = new Map<string, number>();

  if (ids.length > 0) {
    const { data: subjects } = await supabase
      .from("subjects")
      .select("course_id")
      .in("course_id", ids);
    for (const s of subjects ?? []) {
      subjectCounts.set(s.course_id, (subjectCounts.get(s.course_id) ?? 0) + 1);
    }
  }

  return { courses: (courses ?? []) as CourseRow[], subjectCounts };
}

export default async function CoursesPage() {
  const { courses, subjectCounts } = await fetchCoursesAndCounts();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Courses" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Courses" }]}
      >
        <NewCourseButton />
      </PageHeader>

      <DataTableLayout>
        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Create one to start adding subjects, chapters, and topics."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {c.code}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/courses/${c.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.description ? (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {subjectCounts.get(c.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.is_active ? "Active" : "Inactive"} variant={c.is_active ? "success" : "default"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTableLayout>
    </div>
  );
}
