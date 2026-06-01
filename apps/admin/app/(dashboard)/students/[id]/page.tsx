import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listAuditForEntity } from "@/lib/audit";
import { ActionButtons } from "./action-buttons";
import { TransferBatchButton } from "./transfer-batch-button";

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
  // FK hints — see students/page.tsx for why.
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
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Back to students
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {student.full_name}
            </h1>
            <p className="text-sm text-slate-500">{student.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill student={student} />
              {student.must_change_password ? (
                <Pill tone="amber">Must change password</Pill>
              ) : null}
            </div>
          </div>
          <ActionButtons userId={student.id} isActive={student.is_active} />
        </div>
      </div>

      <Tabs id={student.id} active={tab} />

      {tab === "identity" ? (
        <IdentityTab student={student} otherBatches={otherBatches} />
      ) : null}
      {tab === "activity" ? <ActivityTab /> : null}
      {tab === "audit" ? <AuditTab studentId={student.id} /> : null}
    </div>
  );
}

function StatusPill({ student }: { student: StudentDetail }) {
  if (!student.is_active) {
    return (
      <Pill tone="red">
        Suspended
        {student.suspended_reason ? ` — ${student.suspended_reason}` : ""}
      </Pill>
    );
  }
  return <Pill tone="emerald">Active</Pill>;
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "emerald" | "red" | "amber" | "slate";
}) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function Tabs({ id, active }: { id: string; active: Tab }) {
  const items: { key: Tab; label: string }[] = [
    { key: "identity", label: "Identity" },
    { key: "activity", label: "Activity" },
    { key: "audit", label: "Audit" },
  ];
  return (
    <div className="border-b border-slate-200">
      <nav className="flex gap-4">
        {items.map((item) => (
          <Link
            key={item.key}
            href={`/students/${id}${item.key === "identity" ? "" : `?tab=${item.key}`}`}
            className={
              active === item.key
                ? "border-b-2 border-slate-900 px-1 pb-2 text-sm font-medium text-slate-900"
                : "border-b-2 border-transparent px-1 pb-2 text-sm text-slate-500 hover:text-slate-700"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function IdentityTab({
  student,
  otherBatches,
}: {
  student: StudentDetail;
  otherBatches: BatchOption[];
}) {
  const batchName = student.students?.batches?.name ?? "—";
  const courseLabel = student.students?.batches?.courses
    ? `${student.students.batches.courses.code} · ${student.students.batches.courses.name}`
    : "—";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Personal">
        <Row label="Full name" value={student.full_name} />
        <Row label="Email" value={student.email} />
        <Row label="Phone" value={student.phone ?? "—"} />
        <Row label="Date of birth" value={student.dob ?? "—"} />
        <Row label="Gender" value={student.gender ?? "—"} />
      </Card>
      <Card
        title="Academic"
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
        <Row label="School" value={student.students?.school_name ?? "—"} />
        <Row label="Board" value={student.students?.board ?? "—"} />
        <Row label="Class" value={student.students?.current_class ?? "—"} />
        <Row label="Batch" value={batchName} />
        <Row label="Course" value={courseLabel} />
      </Card>
      <Card title="Parents">
        <Row label="Parent 1" value={student.students?.parent_phone_1 ?? "—"} />
        <Row label="Parent 2" value={student.students?.parent_phone_2 ?? "—"} />
        <Row
          label="Consent"
          value={
            student.students?.parent_consent_method
              ? `${student.students.parent_consent_method} on ${
                  student.students.parent_consent_at
                    ? new Date(student.students.parent_consent_at).toLocaleDateString()
                    : "—"
                }`
              : "Not recorded"
          }
        />
      </Card>
      <Card title="Account">
        <Row
          label="Created"
          value={new Date(student.created_at).toLocaleString()}
        />
        <Row
          label="Suspended at"
          value={
            student.suspended_at
              ? new Date(student.suspended_at).toLocaleString()
              : "—"
          }
        />
      </Card>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 lg:col-span-2">
        Identity fields stay read-only per D-016 (admin is the single source
        of truth). Batch transfer is allowed via the action button above,
        which records an audit entry with the reason.
      </div>
    </div>
  );
}

function ActivityTab() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
      Attendance, quiz attempts, exams, and live-class history land in
      Phase 4 onwards.
    </div>
  );
}

async function AuditTab({ studentId }: { studentId: string }) {
  const entries = await listAuditForEntity("app_users", studentId);
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No audit entries recorded for this user.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Actor role</th>
            <th className="px-4 py-3 font-medium">Action</th>
            <th className="px-4 py-3 font-medium">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 text-slate-700">
                {new Date(e.occurred_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-slate-600">{e.actor_role ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-800">
                {e.action}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">
                {e.ip_address ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-slate-500">{title}</h2>
        {action ?? null}
      </div>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}
