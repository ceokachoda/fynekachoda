import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listAuditForEntity } from "@/lib/audit";
import { AssignBatchButton } from "./assign-batch-button";
import { UnassignBatchButton } from "./unassign-batch-button";
import { StatusBadge } from "@/components/status-badge";
import { User, Mail, Phone, BookOpen, ShieldAlert, GraduationCap, CheckCircle2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityFeedItem } from "../../_components/dashboard-widgets";

export const metadata = {
  title: "Teacher Profile · FyneStudy Admin",
};

interface TeacherDetail {
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

interface AssignedBatch {
  batch_id: string;
  batches: {
    id: string;
    name: string;
    is_active: boolean;
    courses: { code: string; name: string } | null;
  } | null;
}

interface BatchOption {
  id: string;
  name: string;
  course: string;
}

async function fetchTeacher(id: string): Promise<TeacherDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, phone, is_active, suspended_at, created_at, user_roles!user_id!inner(role), teachers!user_id(subjects, bio)",
    )
    .eq("id", id)
    .eq("user_roles.role", "teacher")
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as TeacherDetail;
}

async function fetchAssignedBatches(teacherId: string): Promise<AssignedBatch[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("batch_teachers")
    .select("batch_id, batches(id, name, is_active, courses(code, name))")
    .eq("teacher_id", teacherId);
  return ((data ?? []) as unknown) as AssignedBatch[];
}

async function fetchAvailableBatches(assignedIds: Set<string>): Promise<BatchOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("id, name, courses(code, name)")
    .eq("is_active", true)
    .order("name");
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    courses: { code: string; name: string } | null;
  }>)
    .filter((b) => !assignedIds.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      course: b.courses ? `${b.courses.code} · ${b.courses.name}` : "—",
    }));
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export default async function TeacherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "audit" ? "audit" : "profile";

  const teacher = await fetchTeacher(id);
  if (!teacher) notFound();

  const assigned = await fetchAssignedBatches(id);
  const assignedIds = new Set(
    assigned.map((a) => a.batches?.id).filter((x): x is string => Boolean(x)),
  );
  const available = await fetchAvailableBatches(assignedIds);

  return (
    <div className="space-y-8 animate-in-fade pb-8">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-chart-2/20 via-chart-2/10 to-transparent" />
        <div className="px-6 sm:px-8 pb-6 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 mb-4">
            <div className="flex items-end gap-5">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-background text-3xl font-semibold text-chart-2 shadow-md border-4 border-card relative z-10">
                {getInitials(teacher.full_name)}
              </div>
              <div className="mb-1 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {teacher.full_name}
                  {teacher.is_active ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <UserX className="w-5 h-5 text-destructive" />
                  )}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{teacher.email}</span>
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{teacher.phone ?? "No phone"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge 
                status={teacher.is_active ? "Active Faculty" : "Suspended"} 
                variant={teacher.is_active ? "success" : "destructive"} 
              />
            </div>
          </div>
          
          <nav className="flex gap-2 mt-6">
            <TabLink href={`/teachers/${id}`} active={tab === "profile"} icon={<User className="w-4 h-4" />}>
              Profile Overview
            </TabLink>
            <TabLink href={`/teachers/${id}?tab=audit`} active={tab === "audit"} icon={<ShieldAlert className="w-4 h-4" />}>
              Security & Audit
            </TabLink>
          </nav>
        </div>
      </div>

      {tab === "profile" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Professional Details" icon={<GraduationCap className="w-4 h-4" />}>
            <Row label="Full Name" value={teacher.full_name} />
            <Row label="Email Address" value={teacher.email} />
            <Row label="Phone Number" value={teacher.phone ?? "—"} />
            <Row label="Specialization" value={(teacher.teachers?.subjects ?? []).join(", ") || "—"} />
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-sm font-medium text-muted-foreground mb-2">Biography & Notes</p>
              <p className="text-sm text-foreground leading-relaxed">{teacher.teachers?.bio ?? "No biography provided."}</p>
            </div>
          </Card>

          <Card
            title={`Batch Assignments (${assigned.length})`}
            icon={<BookOpen className="w-4 h-4" />}
            action={
              <AssignBatchButton teacherId={teacher.id} available={available} />
            }
          >
            {assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg mt-2">
                Not assigned to any batch yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/40 mt-2">
                {assigned.map((a) => (
                  <li key={a.batch_id} className="flex items-center justify-between py-3 group">
                    <div>
                      {a.batches ? (
                        <Link href={`/batches/${a.batches.id}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                          {a.batches.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">(Unknown Batch)</span>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {a.batches?.courses
                            ? `${a.batches.courses.code} · ${a.batches.courses.name}`
                            : "No Course"}
                        </span>
                        {a.batches && !a.batches.is_active && (
                          <span className="text-[9px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                            INACTIVE
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <UnassignBatchButton
                        batchId={a.batch_id}
                        teacherId={teacher.id}
                        batchName={a.batches?.name ?? "this batch"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <AuditTab teacherId={teacher.id} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function Card({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {action ?? null}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4 text-sm py-2 border-b border-border/40 last:border-0 last:pb-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

async function AuditTab({ teacherId }: { teacherId: string }) {
  const entries = await listAuditForEntity("app_users", teacherId);
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p>No security or administrative audit events have been recorded for this faculty member yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <h3 className="font-semibold text-lg mb-6">Security & Administrative Log</h3>
      <div className="space-y-2 relative">
        {/* Timeline Line */}
        <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />
        {entries.map((e) => (
          <ActivityFeedItem
            key={e.id}
            actionLabel={e.action.replace(/_/g, " ")}
            actionRaw={e.action}
            entity={e.entity_table}
            actorRole={e.actor_role ?? "System"}
            time={`${new Date(e.occurred_at).toLocaleDateString()} at ${new Date(e.occurred_at).toLocaleTimeString()}`}
          />
        ))}
      </div>
    </div>
  );
}
