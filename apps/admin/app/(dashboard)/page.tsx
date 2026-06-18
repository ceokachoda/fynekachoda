import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listRecentAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { MetricCard, QuickActionButton, ActivityFeedItem } from "./_components/dashboard-widgets";
import { Users, GraduationCap, Layers, BookOpen, UserPlus, CheckSquare, Calendar, Presentation, Bell, BarChart3, Database, FileText } from "lucide-react";

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
  const [session, m, activity] = await Promise.all([
    requireAdmin(),
    loadMetrics(),
    listRecentAudit(8)
  ]);

  return (
    <div className="space-y-8 animate-in-fade pb-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back, {session.full_name.split(" ")[0] || "User"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here is what&apos;s happening across FyneStudy today.
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold tracking-tight text-foreground/90">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionButton
            label="Add Student"
            description="Enroll a new user"
            href="/students/new"
            icon={UserPlus}
            colorClass="bg-primary text-primary-foreground"
          />
          <QuickActionButton
            label="Manage Batches"
            description="Update schedules"
            href="/batches"
            icon={Layers}
            colorClass="bg-chart-5 text-white"
          />
          <QuickActionButton
            label="Mark Attendance"
            description="Record today's sessions"
            href="/attendance"
            icon={CheckSquare}
            colorClass="bg-chart-2 text-white"
          />
          <QuickActionButton
            label="Manage Faculty"
            description="Update teacher roles"
            href="/teachers"
            icon={Presentation}
            colorClass="bg-chart-3 text-white"
          />
        </div>
      </section>

      <div className="grid xl:grid-cols-[1fr_400px] gap-8 items-start">
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold tracking-tight text-foreground/90 flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                Operational Metrics
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                label="Total Students"
                value={m.students}
                href="/students"
                hint="Total enrolled accounts"
                icon={Users}
                accent="text-primary"
              />
              <MetricCard
                label="Active Faculty"
                value={m.teachers}
                href="/teachers"
                hint="Teachers assigned to courses"
                icon={GraduationCap}
                accent="text-chart-2"
              />
              <MetricCard
                label="Active Batches"
                value={m.activeBatches}
                href="/batches"
                hint="Currently running classes"
                icon={Layers}
                accent="text-chart-3"
              />
              <MetricCard
                label="Course Programs"
                value={m.courses}
                href="/courses"
                hint="Total active courses offered"
                icon={BookOpen}
                accent="text-chart-5"
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold tracking-tight text-foreground/90 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                Content & Engagement
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                label="Upcoming Sessions"
                value={m.upcomingSessions}
                href="/attendance"
                hint="Scheduled ahead"
                icon={Calendar}
                accent="text-foreground"
                isSecondary
              />
              <MetricCard
                label="Published Quizzes"
                value={m.publishedQuizzes}
                href="/quizzes"
                hint="Live for students"
                icon={CheckSquare}
                accent="text-muted-foreground"
                isSecondary
              />
              <MetricCard
                label="Published Exams"
                value={m.publishedExams}
                href="/exams"
                hint="Live for students"
                icon={FileText}
                accent="text-muted-foreground"
                isSecondary
              />
              <MetricCard
                label="Study Materials"
                value={m.studyMaterials}
                href="/content"
                hint="Videos & notes"
                icon={BookOpen}
                accent="text-muted-foreground"
                isSecondary
              />
            </div>
          </section>
        </div>

        <section className="bg-card rounded-2xl border border-border shadow-sm flex flex-col h-[500px] xl:h-[calc(100vh-8rem)] xl:sticky xl:top-24 xl:max-h-[800px]">
          <div className="flex items-center justify-between border-b border-border px-6 py-5 shrink-0">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Recent Activity
            </h2>
            <Link
              href="/audit"
              className="text-xs font-medium text-primary transition-colors hover:text-primary-dark hover:underline bg-primary/10 px-2.5 py-1 rounded-full"
            >
              View all
            </Link>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            {activity.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activity.map((a) => (
                  <ActivityFeedItem
                    key={a.id}
                    actionLabel={ACTION_LABEL[a.action] ?? a.action.replace(/_/g, " ")}
                    actionRaw={a.action}
                    entity={a.entity_table}
                    actorRole={a.actor_role ?? ""}
                    time={fmtTime(a.occurred_at)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
