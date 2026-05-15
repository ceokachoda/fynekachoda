import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import { isNetworkError, NETWORK_ERROR_MESSAGE, withTimeout } from "@/features/auth/network-errors";

export interface MyBatch {
  batch_id: string;
  batch_name: string;
  course_code: string;
  course_name: string;
}

interface State {
  data: MyBatch | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useMyBatch(): State {
  const { appUser } = useSession();
  const [data, setData] = useState<MyBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    if (!appUser?.id) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: row, error: dbErr } = await withTimeout(
        supabase
          .from("students")
          .select(
            "batch_id, batches(id, name, courses(code, name))",
          )
          .eq("user_id", appUser.id)
          .maybeSingle(),
      );
      if (dbErr) {
        setError(dbErr.message);
        setData(null);
        return;
      }
      if (!row || !row.batch_id) {
        setData(null);
        return;
      }
      const r = row as unknown as {
        batch_id: string;
        batches: { id: string; name: string; courses: { code: string; name: string } | null } | null;
      };
      if (!r.batches) {
        setData(null);
        return;
      }
      setData({
        batch_id: r.batches.id,
        batch_name: r.batches.name,
        course_code: r.batches.courses?.code ?? "—",
        course_name: r.batches.courses?.name ?? "—",
      });
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load batch info.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, isLoading, refresh: load };
}
