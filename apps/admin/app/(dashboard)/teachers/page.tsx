import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata = {
  title: "Teachers · FyneStudy Admin",
};

interface TeacherListRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  suspended_at: string | null;
  created_at: string;
  teachers: {
    subjects: string[] | null;
    bio: string | null;
  } | null;
}

async function fetchTeachers(): Promise<{
  rows: TeacherListRow[];
  assignmentCounts: Map<string, number>;
}> {
  const supabase = await createSupabaseServerClient();
  // FK hint pattern: same shape as students list.
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, phone, is_active, suspended_at, created_at, user_roles!user_id!inner(role), teachers!user_id(subjects, bio)",
    )
    .eq("user_roles.role", "teacher")
    .order("full_name");
  if (error) {
    console.error("teachers list query failed:", error.message);
    return { rows: [], assignmentCounts: new Map() };
  }
  const rows = ((data ?? []) as unknown) as TeacherListRow[];

  const ids = rows.map((r) => r.id);
  const assignmentCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: bts } = await supabase
      .from("batch_teachers")
      .select("teacher_id")
      .in("teacher_id", ids);
    for (const bt of bts ?? []) {
      assignmentCounts.set(bt.teacher_id, (assignmentCounts.get(bt.teacher_id) ?? 0) + 1);
    }
  }
  return { rows, assignmentCounts };
}

export default async function TeachersPage() {
  const { rows, assignmentCounts } = await fetchTeachers();
  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Teachers
          </h1>
          <p className="text-sm text-slate-500">
            {rows.length} total · {activeCount} active
          </p>
        </div>
        <Button asChild>
          <Link href="/teachers/new">+ New teacher</Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No teachers yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Batches</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                const subjects = row.teachers?.subjects ?? [];
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/teachers/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                        {row.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.email}</td>
                    <td className="px-4 py-3 text-slate-600">{row.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {subjects.length > 0 ? subjects.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {assignmentCounts.get(row.id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {row.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
