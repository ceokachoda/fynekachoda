import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listAuditForEntity } from "@/lib/audit";
import { AssignBatchButton } from "./assign-batch-button";
import { UnassignBatchButton } from "./unassign-batch-button";

export const metadata = {
  title: "Teacher · FyneStudy Admin",
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
    <div className="space-y-6">
      <div>
        <Link href="/teachers" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to teachers
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{teacher.full_name}</h1>
            <p className="text-sm text-slate-500">{teacher.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${teacher.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {teacher.is_active ? "Active" : "Suspended"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-slate-200">
        <TabLink href={`/teachers/${id}`} active={tab === "profile"}>
          Profile
        </TabLink>
        <TabLink href={`/teachers/${id}?tab=audit`} active={tab === "audit"}>
          Audit
        </TabLink>
      </nav>

      {tab === "profile" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Profile">
            <Row label="Full name" value={teacher.full_name} />
            <Row label="Email" value={teacher.email} />
            <Row label="Phone" value={teacher.phone ?? "—"} />
            <Row label="Subjects" value={(teacher.teachers?.subjects ?? []).join(", ") || "—"} />
            <Row label="Bio" value={teacher.teachers?.bio ?? "—"} />
          </Card>

          <Card
            title={`Assigned batches (${assigned.length})`}
            action={
              <AssignBatchButton teacherId={teacher.id} available={available} />
            }
          >
            {assigned.length === 0 ? (
              <p className="text-sm text-slate-500">Not assigned to any batch yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {assigned.map((a) => (
                  <li key={a.batch_id} className="flex items-center justify-between py-2">
                    <div>
                      {a.batches ? (
                        <Link href={`/batches/${a.batches.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline">
                          {a.batches.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-500">(unknown)</span>
                      )}
                      <p className="text-xs text-slate-500">
                        {a.batches?.courses
                          ? `${a.batches.courses.code} · ${a.batches.courses.name}`
                          : ""}
                        {a.batches && !a.batches.is_active ? " · INACTIVE" : ""}
                      </p>
                    </div>
                    <UnassignBatchButton
                      batchId={a.batch_id}
                      teacherId={teacher.id}
                      batchName={a.batches?.name ?? "this batch"}
                    />
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
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const cls = active
    ? "border-b-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-700"
    : "border-b-2 border-transparent px-4 py-2 text-sm text-slate-500 hover:text-slate-800";
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
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

async function AuditTab({ teacherId }: { teacherId: string }) {
  const entries = await listAuditForEntity("app_users", teacherId);
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No audit entries recorded.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Actor role</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 text-slate-700">{new Date(e.occurred_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-slate-600">{e.actor_role ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-800">{e.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
