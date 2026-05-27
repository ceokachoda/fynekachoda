import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listRecentAudit } from "@/lib/audit";

export const metadata = {
  title: "Overview · FyneStudy Admin",
};

export const dynamic = "force-dynamic";

interface Metrics {
  students: number;
  teachers: number;
  activeBatches: number;
  courses: number;
  publishedQuizzes: number;
  publishedExams: number;
  studyMaterials: number;
  upcomingSessions: number;
}

async function loadMetrics(): Promise<Metrics> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const [
    students,
    teachers,
    activeBatches,
    courses,
    publishedQuizzes,
    publishedExams,
    studyMaterials,
    upcomingSessions,
  ] = await Promise.all([
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "teacher"),
    supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    supabase
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_start", nowIso),
  ]);

  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    activeBatches: activeBatches.count ?? 0,
    courses: courses.count ?? 0,
    publishedQuizzes: publishedQuizzes.count ?? 0,
    publishedExams: publishedExams.count ?? 0,
    studyMaterials: studyMaterials.count ?? 0,
    upcomingSessions: upcomingSessions.count ?? 0,
  };
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_LABEL: Record<string, string> = {
  create_user: "created an account",
  suspend_user: "suspended an account",
  reactivate_user: "reactivated an account",
  force_reset: "forced a password reset",
  correct_attendance: "corrected attendance",
};

export default async function OverviewPage() {
  const [m, activity] = await Promise.all([loadMetrics(), listRecentAudit(8)]);

  const primary = [
    { label: "Students", value: m.students, href: "/students", hint: "Enrolled accounts" },
    { label: "Teachers", value: m.teachers, href: "/teachers", hint: "Active faculty" },
    { label: "Active batches", value: m.activeBatches, href: "/batches", hint: "Currently running" },
    { label: "Courses", value: m.courses, href: "/courses", hint: "Programs offered" },
  ];
  const secondary = [
    { label: "Published quizzes", value: m.publishedQuizzes, href: "/quizzes", hint: "Live for students" },
    { label: "Published exams", value: m.publishedExams, href: "/exams", hint: "Live for students" },
    { label: "Study materials", value: m.studyMaterials, href: "/content", hint: "Videos & notes" },
    { label: "Upcoming sessions", value: m.upcomingSessions, href: "/attendance", hint: "Scheduled ahead" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">
          A live snapshot of your institute.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primary.map((s) => (
          <StatCard key={s.label} {...s} accent="text-blue-600" />
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {secondary.map((s) => (
          <StatCard key={s.label} {...s} accent="text-violet-600" />
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          <Link href="/audit" className="text-xs font-medium text-blue-600 hover:underline">
            View audit log →
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">
                    <span className="font-medium text-slate-900">
                      {a.actor_role ? a.actor_role.replace("_", " ") : "system"}
                    </span>{" "}
                    {ACTION_LABEL[a.action] ?? a.action.replace(/_/g, " ")}
                    <span className="text-slate-400"> · {a.entity_table}</span>
                  </p>
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {fmtTime(a.occurred_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  hint,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  hint: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </Link>
  );
}
