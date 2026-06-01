import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { StudentsFilters } from "./students-filters";

export const metadata = {
  title: "Students · FyneStudy Admin",
};

type StatusFilter = "all" | "active" | "suspended" | "must_change";

interface StudentListRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  suspended_at: string | null;
  created_at: string;
  students: {
    school_name: string | null;
    current_class: string | null;
  } | null;
}

async function fetchStudents(
  q: string | null,
  status: StatusFilter,
): Promise<StudentListRow[]> {
  const supabase = await createSupabaseServerClient();
  // FK hints are required because both `user_roles` and `students` have two
  // foreign keys to `app_users` (user_id + granted_by / parent_consent_by).
  let query = supabase
    .from("app_users")
    .select(
      "id, full_name, email, phone, is_active, must_change_password, suspended_at, created_at, user_roles!user_id!inner(role), students!user_id(school_name, current_class)",
    )
    .eq("user_roles.role", "student")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "active") query = query.eq("is_active", true);
  if (status === "suspended") query = query.eq("is_active", false);
  if (status === "must_change") query = query.eq("must_change_password", true);

  if (q && q.trim().length > 0) {
    const safe = q.replace(/[%_]/g, (m) => `\\${m}`).trim();
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("students list query failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as StudentListRow[];
}

function statusFromSearch(value: string | undefined): StatusFilter {
  if (value === "active" || value === "suspended" || value === "must_change") {
    return value;
  }
  return "all";
}

function statusBadge(row: StudentListRow): { label: string; tone: string } {
  if (!row.is_active) {
    return { label: "Suspended", tone: "bg-red-100 text-red-800" };
  }
  if (row.must_change_password) {
    return { label: "Pending PW change", tone: "bg-amber-100 text-amber-800" };
  }
  return { label: "Active", tone: "bg-emerald-100 text-emerald-800" };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || null;
  const status = statusFromSearch(sp.status);
  const rows = await fetchStudents(q, status);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Students
          </h1>
          <p className="text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? "result" : "results"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/students/import">Import CSV</Link>
          </Button>
          <Button asChild>
            <Link href="/students/new">+ New student</Link>
          </Button>
        </div>
      </header>

      <StudentsFilters initialQ={q ?? ""} initialStatus={status} />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No students match this view.
          {q || status !== "all" ? (
            <>
              {" "}
              <Link href="/students" className="text-blue-600 hover:underline">
                Clear filters.
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => {
                const badge = statusBadge(row);
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/students/${row.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {row.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.students?.current_class ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.tone}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(row.created_at).toLocaleDateString()}
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
