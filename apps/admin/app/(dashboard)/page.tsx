import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata = {
  title: "Overview · FyneStudy Admin",
};

async function counts() {
  const supabase = await createSupabaseServerClient();
  const [students, teachers, admins] = await Promise.all([
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "teacher"),
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .in("role", ["owner_admin", "staff_admin"]),
  ]);
  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    admins: admins.count ?? 0,
  };
}

export default async function OverviewPage() {
  const c = await counts();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">
          Phase 2 placeholder dashboard. Real metrics arrive in Phase 11.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Students" value={c.students} />
        <Stat label="Teachers" value={c.teachers} />
        <Stat label="Admins" value={c.admins} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium text-slate-700">
          Phase 2 roadmap (Checkpoint 6)
        </h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>Sign in, 2FA enroll/verify, forced password change — done.</li>
          <li>Role gate and middleware — done.</li>
          <li>Student create/list/detail pages — coming in Checkpoint 7.</li>
          <li>Mobile-side auth rewrite — coming in Checkpoint 8.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
