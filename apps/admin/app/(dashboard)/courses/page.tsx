import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewCourseButton } from "./new-course-button";

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
  const activeCount = courses.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Courses
          </h1>
          <p className="text-sm text-slate-500">
            {courses.length} total · {activeCount} active
          </p>
        </div>
        <NewCourseButton />
      </header>

      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No courses yet. Create one to start adding subjects, chapters, and topics.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {c.code}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/courses/${c.id}`}
                      className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.description ? (
                      <p className="text-xs text-slate-500">{c.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {subjectCounts.get(c.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
