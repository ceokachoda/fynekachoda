import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

// Reads the my_batch_leaderboard RPC (the only client path to the composite views).
// Cached 60s client-side per (student, scope) — pull-to-refresh forces a refetch.

export type LeaderboardScope = "weekly" | "alltime";

export interface LeaderRow {
  student_id: string;
  full_name: string;
  phone_last2: string | null;
  q_norm: number;
  a_norm: number;
  s_norm: number;
  quiz_count: number;
  composite: number;
  rank: number;
  is_me: boolean;
}

export interface PublicCard {
  full_name: string;
  batch_name: string;
  streak: number;
  badges: { code: string; name: string; icon_path: string }[];
}

interface State {
  rows: LeaderRow[];
  me: LeaderRow | null;
  total: number;
  isLoading: boolean;
  error: string | null;
  reload: (force?: boolean) => Promise<void>;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { ts: number; rows: LeaderRow[] }>();

function coerce(raw: Record<string, unknown>): LeaderRow {
  return {
    student_id: String(raw.student_id),
    full_name: String(raw.full_name ?? ""),
    phone_last2: raw.phone_last2 == null ? null : String(raw.phone_last2),
    q_norm: Number(raw.q_norm ?? 0),
    a_norm: Number(raw.a_norm ?? 0),
    s_norm: Number(raw.s_norm ?? 0),
    quiz_count: Number(raw.quiz_count ?? 0),
    composite: Number(raw.composite ?? 0),
    rank: Number(raw.rank ?? 0),
    is_me: Boolean(raw.is_me),
  };
}

export function useLeaderboard(scope: LeaderboardScope): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (force = false) => {
      if (!studentId) {
        setRows([]);
        setIsLoading(false);
        return;
      }
      const key = `${studentId}:${scope}`;
      const cached = cache.get(key);
      if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setRows(cached.rows);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await withTimeout(
          supabase.rpc("my_batch_leaderboard", { p_scope: scope }),
        );
        if (res.error) {
          setError(res.error.message);
          return;
        }
        const data = ((res.data ?? []) as Record<string, unknown>[]).map(coerce);
        cache.set(key, { ts: Date.now(), rows: data });
        setRows(data);
      } catch (err) {
        setError(
          isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load the leaderboard.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [studentId, scope],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const me = rows.find((r) => r.is_me) ?? null;
  return { rows, me, total: rows.length, isLoading, error, reload };
}

function coerceCard(raw: Record<string, unknown>): PublicCard {
  const badges = Array.isArray(raw.badges) ? raw.badges : [];
  return {
    full_name: String(raw.full_name ?? ""),
    batch_name: String(raw.batch_name ?? ""),
    streak: Number(raw.streak ?? 0),
    badges: badges.map((b) => {
      const x = (b ?? {}) as Record<string, unknown>;
      return { code: String(x.code ?? ""), name: String(x.name ?? ""), icon_path: String(x.icon_path ?? "") };
    }),
  };
}

// Public profile card for a tapped row (name + batch + streak + badges only).
export async function fetchStudentCard(studentId: string): Promise<PublicCard | null> {
  try {
    const res = await withTimeout(
      supabase.rpc("student_public_card", { p_student: studentId }),
    );
    if (res.error || !res.data) return null;
    return coerceCard(res.data as Record<string, unknown>);
  } catch {
    return null;
  }
}
