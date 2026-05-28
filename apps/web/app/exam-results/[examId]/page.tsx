import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { ExamResultsClient } from "./_components/ExamResultsClient";

export const metadata = { title: "Exam results" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function ExamResultsPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || session.active_role !== "teacher") redirect("/");
  const { examId } = await params;
  return <ExamResultsClient examId={examId} />;
}
