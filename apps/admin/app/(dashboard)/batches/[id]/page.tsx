import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BatchHeaderForm } from "./batch-header-form";
import { TeachersSection } from "./teachers-section";
import { ScheduleSection } from "./schedule-section";
import { StudentsSection } from "./students-section";

export const metadata = {
  title: "Batch · FyneStudy Admin",
};

interface BatchDetail {
  id: string;
  name: string;
  course_id: string;
  capacity: number;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  courses: { id: string; code: string; name: string } | null;
}

interface TeacherRow {
  user_id: string;
  app_users: { full_name: string; email: string } | null;
  subjects: string[] | null;
}

interface ScheduleRow {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  subjects: { name: string } | null;
}

interface StudentRow {
  user_id: string;
  app_users: { id: string; full_name: string; email: string; is_active: boolean } | null;
}

interface BatchOption { id: string; name: string }
interface TeacherOption { user_id: string; full_name: string }
interface SubjectOption { id: string; name: string }

async function fetchBatchPage(id: string): Promise<{
  batch: BatchDetail | null;
  assignedTeachers: TeacherRow[];
  schedule: ScheduleRow[];
  students: StudentRow[];
  allBatches: BatchOption[];
  allTeachers: TeacherOption[];
  subjects: SubjectOption[];
}> {
  const supabase = await createSupabaseServerClient();

  const { data: batch, error: bErr } = await supabase
    .from("batches")
    .select("id, name, course_id, capacity, starts_on, ends_on, is_active, courses(id, code, name)")
    .eq("id", id)
    .maybeSingle();
  if (bErr || !batch) {
    return {
      batch: null,
      assignedTeachers: [],
      schedule: [],
      students: [],
      allBatches: [],
      allTeachers: [],
      subjects: [],
    };
  }

  const batchTyped = batch as unknown as BatchDetail;

  const [teachersRes, scheduleRes, studentsRes, allBatchesRes, allTeachersRes, subjectsRes] = await Promise.all([
    supabase
      .from("batch_teachers")
      .select("teacher_id, teachers(user_id, subjects, app_users!user_id(full_name, email))")
      .eq("batch_id", id),
    supabase
      .from("batch_schedule")
      .select("id, weekday, start_time, end_time, subject_id, subjects(name)")
      .eq("batch_id", id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("students")
      .select("user_id, app_users!user_id(id, full_name, email, is_active)")
      .eq("batch_id", id)
      .order("user_id"),
    supabase
      .from("batches")
      .select("id, name")
      .neq("id", id)
      .order("name"),
    supabase
      .from("app_users")
      .select("id, full_name, user_roles!user_id!inner(role)")
      .eq("user_roles.role", "teacher")
      .order("full_name"),
    supabase
      .from("subjects")
      .select("id, name")
      .eq("course_id", batchTyped.course_id)
      .order("sort_order"),
  ]);

  const assignedTeachers: TeacherRow[] = ((teachersRes.data ?? []) as unknown as Array<{
    teacher_id: string;
    teachers: { user_id: string; subjects: string[] | null; app_users: { full_name: string; email: string } | null } | null;
  }>).map((t) => ({
    user_id: t.teachers?.user_id ?? t.teacher_id,
    subjects: t.teachers?.subjects ?? null,
    app_users: t.teachers?.app_users ?? null,
  }));
  const schedule = ((scheduleRes.data ?? []) as unknown) as ScheduleRow[];
  const students = ((studentsRes.data ?? []) as unknown) as StudentRow[];
  const allBatches = ((allBatchesRes.data ?? []) as unknown) as BatchOption[];
  const allTeachers = ((allTeachersRes.data ?? []) as unknown as Array<{ id: string; full_name: string }>).map((t) => ({ user_id: t.id, full_name: t.full_name }));
  const subjects = ((subjectsRes.data ?? []) as unknown) as SubjectOption[];

  return {
    batch: batchTyped,
    assignedTeachers,
    schedule,
    students,
    allBatches,
    allTeachers,
    subjects,
  };
}

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchBatchPage(id);
  if (!data.batch) notFound();
  const batch = data.batch;

  const occupancyPct = Math.round((data.students.length / batch.capacity) * 100);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/batches" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to batches
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{batch.name}</h1>
          {batch.courses ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              <span className="font-mono">{batch.courses.code}</span> · {batch.courses.name}
            </span>
          ) : null}
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${batch.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
            {batch.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Starts {batch.starts_on}
          {batch.ends_on ? ` · Ends ${batch.ends_on}` : ""}
          {" · "}
          {data.students.length}/{batch.capacity} seats filled ({occupancyPct}%)
        </p>
      </div>

      <BatchHeaderForm
        id={batch.id}
        name={batch.name}
        startsOn={batch.starts_on}
        endsOn={batch.ends_on}
        capacity={batch.capacity}
        isActive={batch.is_active}
      />

      <TeachersSection
        batchId={batch.id}
        assigned={data.assignedTeachers}
        allTeachers={data.allTeachers}
      />

      <ScheduleSection
        batchId={batch.id}
        rows={data.schedule}
        subjects={data.subjects}
      />

      <StudentsSection
        batchId={batch.id}
        batchName={batch.name}
        students={data.students}
        otherBatches={data.allBatches}
      />
    </div>
  );
}
