import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/page-header";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { GraduationCap, UserPlus, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export default async function TeachersPage() {
  const { rows, assignmentCounts } = await fetchTeachers();

  return (
    <div className="space-y-6 animate-in-fade pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Faculty Management" 
          breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Teachers" }]}
        />
        <Button asChild className="shadow-sm">
          <Link href="/teachers/new" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add Faculty Member
          </Link>
        </Button>
      </div>

      <DataTableLayout>
        {rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No faculty yet"
            description="You haven't added any teachers to the platform."
          >
            <Button asChild>
              <Link href="/teachers/new">Add First Teacher</Link>
            </Button>
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="px-6 py-4">Faculty Member</th>
                <th className="px-6 py-4">Contact Details</th>
                <th className="px-6 py-4">Specialization</th>
                <th className="px-6 py-4">Active Batches</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => {
                const subjects = row.teachers?.subjects ?? [];
                return (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chart-2/10 text-xs font-semibold text-chart-2 shadow-sm border border-chart-2/20">
                          {getInitials(row.full_name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <Link href={`/teachers/${row.id}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate">
                            {row.full_name}
                          </Link>
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
                      <div className="flex flex-wrap gap-1">
                        {subjects.length > 0 ? (
                          subjects.map(sub => (
                            <span key={sub} className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                              {sub}
                            </span>
                          ))
                        ) : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center justify-center min-w-6 h-6 rounded-full bg-muted text-xs font-bold text-foreground">
                        {assignmentCounts.get(row.id) ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.is_active ? "Active" : "Suspended"} variant={row.is_active ? "success" : "destructive"} />
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
                            <Link href={`/teachers/${row.id}`}>View Profile</Link>
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
