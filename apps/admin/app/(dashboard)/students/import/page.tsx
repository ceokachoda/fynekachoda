import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ImportClient } from "./import-client";

export const metadata = {
  title: "Import students · FyneStudy Admin",
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ImportStudentsPage() {
  await requireAdmin();
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
      <header>
        <Link href="/students" className="text-sm text-blue-600 hover:underline">
          ← Students
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Bulk import students
        </h1>
        <p className="text-sm text-slate-500">
          Upload a CSV to create many student accounts at once. You&apos;ll
          review the rows before anything is created.
        </p>
      </header>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          You need at least one active batch first.{" "}
          <Link href="/batches" className="text-blue-600 hover:underline">
            Create a batch.
          </Link>
        </div>
      ) : (
        <ImportClient batches={batches} />
      )}
    </div>
  );
}
