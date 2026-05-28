import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { QuizBuilderClient } from "./_components/QuizBuilderClient";

export const metadata = { title: "Quiz builder" };
export const dynamic = "force-dynamic";

// Top-level route outside (protected) per W-23 / mobile D-169 — FocusLayout,
// no side-rail. Auth is enforced by middleware.ts (teacher-only). The Client
// wraps its own QueryProvider + SessionProvider (W-DEC-3.6 pattern).
interface Props {
  params: Promise<{ quizId: string }>;
}

export default async function QuizBuilderPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session || session.active_role !== "teacher") redirect("/");
  const { quizId } = await params;
  return <QuizBuilderClient quizId={quizId} />;
}
