import { requireTeacher } from "@/lib/auth";
import { TeacherBatchOverviewClient } from "./_components/TeacherBatchOverviewClient";

export const metadata = { title: "Batch overview" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BatchOverviewPage({ params }: Props) {
  await requireTeacher();
  const { id } = await params;
  return <TeacherBatchOverviewClient batchId={id} />;
}
