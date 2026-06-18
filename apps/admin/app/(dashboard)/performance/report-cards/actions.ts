"use server";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function getAvailableTestsForBatch(batchId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // We need to find all distinct test_names that have been recorded for this batch
  const { data, error } = await supabase
    .from("offline_test_scores")
    .select("test_name, test_date")
    .eq("batch_id", batchId)
    .order("test_date", { ascending: false });

  if (error || !data) return [];

  // Deduplicate by test_name
  const map = new Map<string, string>();
  for (const row of data) {
    if (!map.has(row.test_name)) {
      map.set(row.test_name, row.test_date);
    }
  }

  return Array.from(map.entries()).map(([name, date]) => ({ name, date }));
}
