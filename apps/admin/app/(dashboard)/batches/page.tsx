import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewBatchButton } from "./new-batch-button";
import { PageHeader } from "@/components/page-header";
import { DataTableLayout } from "@/components/data-table-layout";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Component } from "lucide-react";

export const metadata = {
  title: "Batches · FyneStudy Admin",
};

interface BatchRow {
  id: string;
  name: string;
  capacity: number;
  is_active: boolean;
  starts_on: string;
  ends_on: string | null;
  courses: { code: string; name: string } | null;
}

interface CourseOption {
  id: string;
  code: string;
  name: string;
}

async function fetchBatchesAndCounts(): Promise<{
  batches: BatchRow[];
  studentCounts: Map<string, number>;
  teacherCounts: Map<string, number>;
  courses: CourseOption[];
}> {
  const supabase = await createSupabaseServerClient();

  const [batchesRes, coursesRes] = await Promise.all([
    supabase
      .from("batches")
      .select("id, name, capacity, is_active, starts_on, ends_on, courses(code, name)")
      .order("name"),
    supabase
      .from("courses")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code"),
  ]);

  const batches = ((batchesRes.data ?? []) as unknown) as BatchRow[];
  const courses = ((coursesRes.data ?? []) as unknown) as CourseOption[];

  const ids = batches.map((b) => b.id);
  const studentCounts = new Map<string, number>();
  const teacherCounts = new Map<string, number>();
  if (ids.length > 0) {
    const [stRes, tcRes] = await Promise.all([
      supabase.from("students").select("batch_id").in("batch_id", ids),
      supabase.from("batch_teachers").select("batch_id").in("batch_id", ids),
    ]);
    for (const s of stRes.data ?? []) studentCounts.set(s.batch_id, (studentCounts.get(s.batch_id) ?? 0) + 1);
    for (const t of tcRes.data ?? []) teacherCounts.set(t.batch_id, (teacherCounts.get(t.batch_id) ?? 0) + 1);
  }

  return { batches, studentCounts, teacherCounts, courses };
}

export default async function BatchesPage() {
  const { batches, studentCounts, teacherCounts, courses } = await fetchBatchesAndCounts();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Batches" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Batches" }]}
      >
        <NewBatchButton courses={courses} />
      </PageHeader>

      <DataTableLayout>
        {batches.length === 0 ? (
          <EmptyState
            icon={Component}
            title="No batches yet"
            description="You haven't created any batches."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Teachers</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Starts</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.map((b) => {
                const sc = studentCounts.get(b.id) ?? 0;
                const tc = teacherCounts.get(b.id) ?? 0;
                const fillPct = Math.round((sc / b.capacity) * 100);
                return (
                  <tr key={b.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/batches/${b.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.courses ? (
                        <>
                          <span className="font-mono text-xs">{b.courses.code}</span>
                          <span className="ml-1 opacity-70">{b.courses.name}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {sc} <span className="text-muted-foreground">/ {b.capacity}</span>
                      <span className="ml-1 text-xs text-muted-foreground">({fillPct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{tc}</td>
                    <td className="px-4 py-3 text-foreground">{b.capacity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.starts_on}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.is_active ? "Active" : "Inactive"} variant={b.is_active ? "success" : "default"} />
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
