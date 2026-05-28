import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PageHeader } from "@/components/fyne/PageHeader";
import { EmptyState } from "@/components/fyne/EmptyState";
import { LibraryClient } from "./_components/LibraryClient";

export const metadata = { title: "Library" };

interface Props {
  searchParams: Promise<{
    subject?: string;
    chapter?: string;
    topic?: string;
    q?: string;
  }>;
}

export default async function LibraryPage({ searchParams }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  if (session.active_role !== "student") {
    return (
      <div className="space-y-6">
        <PageHeader title="Library" />
        <EmptyState
          title="Teacher library uploads ship in Phase 4"
          description="Switch to your student tab to browse content."
        />
      </div>
    );
  }
  const sp = await searchParams;
  return (
    <LibraryClient
      initialSubject={sp.subject ?? null}
      initialChapter={sp.chapter ?? null}
      initialTopic={sp.topic ?? null}
      initialQuery={sp.q ?? ""}
    />
  );
}
