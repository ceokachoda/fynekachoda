import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { StudentsFilters } from "./students-filters";
import { PageHeader } from "@/components/page-header";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Users, MoreHorizontal, UserPlus, FileUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const metadata = {
  title: "Students · FyneStudy Admin",
};

export const dynamic = "force-dynamic";

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

function statusBadge(row: StudentListRow) {
  if (!row.is_active) {
    return "suspended";
  }
  if (row.must_change_password) {
    return "must_change";
  }
  return "active";
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
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
    <div className="space-y-6 animate-in-fade pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Student Management" 
          breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Students" }]}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="bg-background">
            <Link href="/students/import" className="flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              Import CSV
            </Link>
          </Button>
          <Button asChild className="shadow-sm">
            <Link href="/students/new" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              New Student
            </Link>
          </Button>
        </div>
      </div>

      <DataTableLayout filters={<StudentsFilters initialQ={q ?? ""} initialStatus={status} />}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description={q || status !== "all" ? "No students match the current filters." : "You haven't added any students yet."}
          >
            {q || status !== "all" ? (
              <Button variant="outline" asChild>
                <Link href="/students">Clear filters</Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Enrolled</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => {
                const s = statusBadge(row);
                return (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shadow-sm border border-primary/20">
                          {getInitials(row.full_name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/students/${row.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                          >
                            {row.full_name}
                          </Link>
                          <span className="text-xs text-muted-foreground truncate">{row.id.split("-")[0]?.toUpperCase() ?? ""}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-foreground">{row.email}</span>
                        <span className="text-xs text-muted-foreground">{row.phone ?? "No phone"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {row.students?.current_class ? (
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                          {row.students.current_class}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={s === "must_change" ? "Pending PW" : s} variant={s === "active" ? "success" : s === "suspended" ? "destructive" : "warning"} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(row.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100" aria-label={`Actions for ${row.full_name}`}>
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuItem asChild>
                            <Link href={`/students/${row.id}`}>View Profile</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/attendance?student=${row.id}`}>View Attendance</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DataTableLayout>
    </div>
  );
}
