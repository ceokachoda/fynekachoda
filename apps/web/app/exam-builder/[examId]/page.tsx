import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { ExamBuilderClient } from "./_components/ExamBuilderClient";

export const metadata = { title: "Exam builder" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function ExamBuilderPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || session.active_role !== "teacher") redirect("/");
  const { examId } = await params;
  return <ExamBuilderClient examId={examId} />;
}
