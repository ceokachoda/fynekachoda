import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ImportClient } from "./import-client";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";

export const metadata = {
  title: "Import students · FyneStudy Admin",
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ImportStudentsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  const batches = (data ?? [])
    .filter((b) => b.is_active !== false)
    .map((b) => ({ id: b.id as string, name: b.name as string }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk import students"
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Students", href: "/students" },
          { label: "Import" }
        ]}
        description="Upload a CSV to create many student accounts at once. You'll review the rows before anything is created."
      />

      {batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          You need at least one active batch first.{" "}
          <Link href="/batches" className="text-primary hover:underline font-medium">
            Create a batch.
          </Link>
        </div>
      ) : (
        <ImportClient batches={batches} />
      )}
    </div>
  );
}
