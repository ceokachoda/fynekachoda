import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listAuditForEntity } from "@/lib/audit";
import { ActionButtons } from "./action-buttons";
import { TransferBatchButton } from "./transfer-batch-button";
import { ActivityFeedItem } from "../../_components/dashboard-widgets";
import { User, Mail, GraduationCap, MapPin, ShieldAlert, KeyRound, Clock, UserCog, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  is_active: boolean;
  must_change_password: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  students:
    | {
        school_name: string | null;
        board: string | null;
        current_class: string | null;
        address: string | null;
        parent_phone_1: string | null;
        parent_phone_2: string | null;
        parent_consent_method: string | null;
        parent_consent_at: string | null;
        batch_id: string | null;
        batches: {
          id: string;
          name: string;
          courses: { code: string; name: string } | null;
        } | null;
      }
    | null;
}

interface BatchOption { id: string; name: string; course: string }

async function fetchOtherBatches(currentBatchId: string | null): Promise<BatchOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("id, name, is_active, courses(code, name)")
    .eq("is_active", true)
    .order("name");
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    courses: { code: string; name: string } | null;
  }>)
    .filter((b) => b.id !== currentBatchId)
    .map((b) => ({
      id: b.id,
      name: b.name,
      course: b.courses ? `${b.courses.code} · ${b.courses.name}` : "—",
    }));
}

async function fetchStudent(id: string): Promise<StudentDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, phone, dob, gender, is_active, must_change_password, suspended_at, suspended_reason, created_at, user_roles!user_id!inner(role), students!user_id(school_name, board, current_class, address, parent_phone_1, parent_phone_2, parent_consent_method, parent_consent_at, batch_id, batches(id, name, courses(code, name)))",
    )
    .eq("id", id)
    .eq("user_roles.role", "student")
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as StudentDetail;
}

type Tab = "identity" | "activity" | "audit";

function tabFromSearch(value: string | undefined): Tab {
  if (value === "activity" || value === "audit") return value;
  return "identity";
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = tabFromSearch(sp.tab);

  const student = await fetchStudent(id);
  if (!student) notFound();
  const otherBatches = await fetchOtherBatches(student.students?.batch_id ?? null);

  return (
    <div className="space-y-8 animate-in-fade pb-8">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="px-6 sm:px-8 pb-6 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 mb-4">
            <div className="flex items-end gap-5">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-background text-3xl font-semibold text-primary shadow-md border-4 border-card relative z-10">
                {getInitials(student.full_name)}
              </div>
              <div className="mb-1 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {student.full_name}
                  {student.is_active ? (
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <UserX className="w-5 h-5 text-destructive" />
                  )}
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{student.email}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{student.students?.address ?? "No address"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {student.must_change_password ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 border border-amber-500/20">
                  <KeyRound className="w-3.5 h-3.5" />
                  Pending PW Reset
                </div>
              ) : null}
              <ActionButtons userId={student.id} isActive={student.is_active} />
            </div>
          </div>
          <Tabs id={student.id} active={tab} />
        </div>
      </div>

      {tab === "identity" ? (
        <IdentityTab student={student} otherBatches={otherBatches} />
      ) : null}
      {tab === "activity" ? <ActivityTab /> : null}
      {tab === "audit" ? <AuditTab studentId={student.id} /> : null}
    </div>
  );
}

function Tabs({ id, active }: { id: string; active: Tab }) {
  const items: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "identity", label: "Profile Identity", icon: <User className="w-4 h-4" /> },
    { key: "activity", label: "Activity Metrics", icon: <Clock className="w-4 h-4" /> },
    { key: "audit", label: "Security & Audit", icon: <ShieldAlert className="w-4 h-4" /> },
  ];
  return (
    <nav className="flex gap-2 mt-6">
      {items.map((item) => (
        <Link
          key={item.key}
          href={`/students/${id}${item.key === "identity" ? "" : `?tab=${item.key}`}`}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors",
            active === item.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function IdentityTab({
  student,
  otherBatches,
}: {
  student: StudentDetail;
  otherBatches: BatchOption[];
}) {
  const batchName = student.students?.batches?.name ?? "Not Assigned";
  const courseLabel = student.students?.batches?.courses
    ? `${student.students.batches.courses.code} · ${student.students.batches.courses.name}`
    : "No Course";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Personal Information" icon={<User className="w-4 h-4" />}>
        <Row label="Full Name" value={student.full_name} />
        <Row label="Email Address" value={student.email} />
        <Row label="Phone Number" value={student.phone ?? "—"} />
        <Row label="Date of Birth" value={student.dob ?? "—"} />
        <Row label="Gender" value={student.gender ?? "—"} />
      </Card>
      
      <Card
        title="Academic Enrollment"
        icon={<GraduationCap className="w-4 h-4" />}
        action={
          student.students?.batch_id ? (
            <TransferBatchButton
              studentId={student.id}
              currentBatchName={batchName}
              otherBatches={otherBatches}
            />
          ) : null
        }
      >
        <Row label="Current Batch" value={batchName} highlight />
        <Row label="Enrolled Course" value={courseLabel} />
        <Row label="Previous School" value={student.students?.school_name ?? "—"} />
        <Row label="Education Board" value={student.students?.board ?? "—"} />
        <Row label="Grade / Class" value={student.students?.current_class ?? "—"} />
      </Card>
      
      <Card title="Guardian Details" icon={<UserCog className="w-4 h-4" />}>
        <Row label="Primary Guardian Phone" value={student.students?.parent_phone_1 ?? "—"} />
        <Row label="Secondary Guardian Phone" value={student.students?.parent_phone_2 ?? "—"} />
        <Row
          label="Consent Status"
          value={
            student.students?.parent_consent_method
              ? `${student.students.parent_consent_method} (via ${
                  student.students.parent_consent_at
                    ? new Date(student.students.parent_consent_at).toLocaleDateString()
                    : "—"
                })`
              : "Not provided"
          }
        />
      </Card>
      
      <Card title="Account Administration" icon={<ShieldAlert className="w-4 h-4" />}>
        <Row
          label="Account Created"
          value={new Date(student.created_at).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
        />
        <Row
          label="Suspension Status"
          value={
            student.suspended_at
              ? `Suspended on ${new Date(student.suspended_at).toLocaleDateString()} (${student.suspended_reason ?? "No reason"})`
              : "Account in good standing"
          }
          isWarning={!!student.suspended_at}
        />
      </Card>
      
      <div className="lg:col-span-2 mt-4 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
        <p className="leading-relaxed">
          Identity fields remain read-only in accordance with strict educational data protocols. Batch transfers must be executed via the dedicated action button, which ensures comprehensive audit logging of all enrollment modifications.
        </p>
      </div>
    </div>
  );
}

function ActivityTab() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <p className="max-w-sm">
        Advanced metrics including Attendance visualizations, quiz analytics, exam scoring, and live-class participation history are rolling out in the next platform phase.
      </p>
    </div>
  );
}

async function AuditTab({ studentId }: { studentId: string }) {
  const entries = await listAuditForEntity("app_users", studentId);
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p>No security or administrative audit events have been recorded for this user yet.</p>
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
      <dl className="space-y-4 flex-1">{children}</dl>
    </div>
  );
}

function Row({ label, value, highlight, isWarning }: { label: string; value: string; highlight?: boolean; isWarning?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-4 text-sm py-1 border-b border-border/40 last:border-0 last:pb-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={cn("text-right font-medium", highlight ? "text-primary" : "text-foreground", isWarning ? "text-destructive" : "")}>{value}</dd>
    </div>
  );
}
