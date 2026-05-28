import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { ExamClient } from "./_components/ExamClient";

export const metadata = { title: "Exam" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ExamPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    redirect("/");
  }
  const { id } = await params;
  return <ExamClient examId={id} />;
}
