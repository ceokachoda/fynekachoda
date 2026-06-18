import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CourseOverviewForm } from "./course-overview-form";
import { CurriculumEditor } from "./curriculum-editor";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

export const metadata = {
  title: "Course · FyneStudy Admin",
};

interface CourseDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Topic {
  id: string;
  name: string;
  sort_order: number;
}
interface Chapter {
  id: string;
  name: string;
  sort_order: number;
  topics: Topic[];
}
interface Subject {
  id: string;
  name: string;
  sort_order: number;
  chapters: Chapter[];
}

async function fetchCourseTree(
  courseId: string,
): Promise<{ course: CourseDetail | null; subjects: Subject[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("id, code, name, description, is_active, created_at")
    .eq("id", courseId)
    .maybeSingle();
  if (cErr || !course) return { course: null, subjects: [] };

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, sort_order")
    .eq("course_id", courseId)
    .order("sort_order");

  const subjectIds = (subjects ?? []).map((s) => s.id);
  let chapters: Array<{ id: string; subject_id: string; name: string; sort_order: number }> = [];
  let topics: Array<{ id: string; chapter_id: string; name: string; sort_order: number }> = [];
  if (subjectIds.length > 0) {
    const { data: chData } = await supabase
      .from("chapters")
      .select("id, subject_id, name, sort_order")
      .in("subject_id", subjectIds)
      .order("sort_order");
    chapters = chData ?? [];
    const chapterIds = chapters.map((c) => c.id);
    if (chapterIds.length > 0) {
      const { data: tData } = await supabase
        .from("topics")
        .select("id, chapter_id, name, sort_order")
        .in("chapter_id", chapterIds)
        .order("sort_order");
      topics = tData ?? [];
    }
  }

  const tree: Subject[] = (subjects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    sort_order: s.sort_order,
    chapters: chapters
      .filter((c) => c.subject_id === s.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
        topics: topics
          .filter((t) => t.chapter_id === c.id)
          .map((t) => ({ id: t.id, name: t.name, sort_order: t.sort_order })),
      })),
  }));

  return { course: course as CourseDetail, subjects: tree };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "curriculum" ? "curriculum" : "overview";

  const { course, subjects } = await fetchCourseTree(id);
  if (!course) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.name}
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Courses", href: "/courses" },
          { label: course.name }
        ]}
        actions={
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground border border-border">
              {course.code}
            </span>
            <StatusBadge 
              status={course.is_active ? "Active" : "Inactive"} 
              variant={course.is_active ? "success" : "default"} 
            />
          </div>
        }
      />

      <nav className="flex gap-1 border-b border-border">
        <TabLink href={`/courses/${course.id}?tab=overview`} active={tab === "overview"}>
          Overview
        </TabLink>
        <TabLink href={`/courses/${course.id}?tab=curriculum`} active={tab === "curriculum"}>
          Curriculum ({subjects.length} subjects)
        </TabLink>
      </nav>

      {tab === "overview" ? (
        <CourseOverviewForm
          id={course.id}
          name={course.name}
          description={course.description ?? ""}
          isActive={course.is_active}
        />
      ) : (
        <CurriculumEditor courseId={course.id} subjects={subjects} />
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
    ? "border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
    : "border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors";
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
