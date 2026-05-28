import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { QuizClient } from "./_components/QuizClient";

export const metadata = { title: "Quiz" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

// Top-level quiz route (outside the (protected) group on purpose — mirrors
// the mobile D-169 decision so the AppShell side-rail / bottom-tabs don't
// render in attempt mode). Auth is still enforced by middleware.ts.
export default async function QuizPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    // Teacher / admin trying to take a quiz — bounce to home; teacher panel
    // (Phase 4) is the right place.
    redirect("/");
  }
  const { id } = await params;
  return <QuizClient quizId={id} />;
}
