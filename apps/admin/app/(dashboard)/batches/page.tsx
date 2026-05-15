import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NewBatchButton } from "./new-batch-button";

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
  const activeCount = batches.filter((b) => b.is_active).length;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Batches</h1>
          <p className="text-sm text-slate-500">
            {batches.length} total · {activeCount} active
          </p>
        </div>
        <NewBatchButton courses={courses} />
      </header>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No batches yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
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
            <tbody className="divide-y divide-slate-200">
              {batches.map((b) => {
                const sc = studentCounts.get(b.id) ?? 0;
                const tc = teacherCounts.get(b.id) ?? 0;
                const fillPct = Math.round((sc / b.capacity) * 100);
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/batches/${b.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {b.courses ? (
                        <>
                          <span className="font-mono text-xs">{b.courses.code}</span>
                          <span className="ml-1 text-slate-400">{b.courses.name}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {sc} <span className="text-slate-400">/ {b.capacity}</span>
                      <span className="ml-1 text-xs text-slate-400">({fillPct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{tc}</td>
                    <td className="px-4 py-3 text-slate-700">{b.capacity}</td>
                    <td className="px-4 py-3 text-slate-500">{b.starts_on}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${b.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                        {b.is_active ? "Active" : "Inactive"}
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
