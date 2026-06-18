import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";
import { ContentModerationClient } from "./content-client";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Content · FyneStudy Admin",
};

interface PageProps {
  searchParams: Promise<{
    course?: string;
    batch?: string;
    kind?: string;
    status?: string;
    q?: string;
  }>;
}

export interface CourseOpt {
  id: string;
  code: string;
  name: string;
}
export interface BatchOpt {
  id: string;
  name: string;
  course_id: string;
}
export interface ContentItem {
  id: string;
  kind: "video" | "pdf" | "note";
  title: string;
  description: string | null;
  topic_id: string;
  topic_name: string;
  chapter_name: string;
  subject_name: string;
  course_id: string;
  course_code: string;
  batch_id: string | null;
  batch_name: string | null;
  yt_video_id: string | null;
  file_path: string | null;
  duration_sec: number | null;
  uploaded_by: string;
  uploader_name: string;
  is_published: boolean;
  created_at: string;
}

async function loadData(filters: {
  course?: string;
  batch?: string;
  kind?: string;
  status?: string;
  q?: string;
}) {
  const supabase = await createSupabaseServerClient();

  const coursesRes = await supabase
    .from("courses")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  const courses: CourseOpt[] = (coursesRes.data ?? []) as CourseOpt[];

  const batchesRes = await supabase
    .from("batches")
    .select("id, name, course_id")
    .eq("is_active", true)
    .order("name");
  const batches: BatchOpt[] = (batchesRes.data ?? []) as BatchOpt[];

  let query = supabase
    .from("content_items")
    .select(
      "id, kind, title, description, topic_id, batch_id, course_id, yt_video_id, file_path, duration_sec, uploaded_by, is_published, created_at, topics(name, chapters(name, subjects(name))), batches(name), courses(code), uploader:app_users!uploaded_by(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.course && /^[0-9a-f-]{36}$/i.test(filters.course)) {
    query = query.eq("course_id", filters.course);
  }
  if (filters.batch && /^[0-9a-f-]{36}$/i.test(filters.batch)) {
    if (filters.batch === "course-wide") {
      // sentinel handled below
    } else {
      query = query.eq("batch_id", filters.batch);
    }
  }
  if (filters.batch === "course-wide") {
    query = query.is("batch_id", null);
  }
  if (filters.kind && ["video", "pdf", "note"].includes(filters.kind)) {
    query = query.eq("kind", filters.kind);
  }
  if (filters.status === "published") query = query.eq("is_published", true);
  if (filters.status === "unpublished") query = query.eq("is_published", false);
  if (filters.q && filters.q.trim().length > 0) {
    query = query.ilike("title", `%${filters.q.trim()}%`);
  }
  const itemsRes = await query;
  const items: ContentItem[] = ((itemsRes.data ?? []) as unknown as Array<{
    id: string;
    kind: "video" | "pdf" | "note";
    title: string;
    description: string | null;
    topic_id: string;
    batch_id: string | null;
    course_id: string;
    yt_video_id: string | null;
    file_path: string | null;
    duration_sec: number | null;
    uploaded_by: string;
    is_published: boolean;
    created_at: string;
    topics:
      | {
        name: string;
        chapters: { name: string; subjects: { name: string } | null } | null;
      }
      | null;
    batches: { name: string } | null;
    courses: { code: string } | null;
    uploader: { full_name: string } | null;
  }>).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    topic_id: r.topic_id,
    topic_name: r.topics?.name ?? "—",
    chapter_name: r.topics?.chapters?.name ?? "—",
    subject_name: r.topics?.chapters?.subjects?.name ?? "—",
    course_id: r.course_id,
    course_code: r.courses?.code ?? "—",
    batch_id: r.batch_id,
    batch_name: r.batches?.name ?? null,
    yt_video_id: r.yt_video_id,
    file_path: r.file_path,
    duration_sec: r.duration_sec,
    uploaded_by: r.uploaded_by,
    uploader_name: r.uploader?.full_name ?? "(unknown)",
    is_published: r.is_published,
    created_at: r.created_at,
  }));

  return { courses, batches, items };
}

export default async function ContentPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const { courses, batches, items } = await loadData({
    course: params.course,
    batch: params.batch,
    kind: params.kind,
    status: params.status,
    q: params.q,
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Content library" 
        breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Content" }]}
      />

      <ContentModerationClient
        items={items}
        courses={courses}
        batches={batches}
        filters={{
          course: params.course ?? "",
          batch: params.batch ?? "",
          kind: params.kind ?? "",
          status: params.status ?? "",
          q: params.q ?? "",
        }}
      />
    </div>
  );
}
