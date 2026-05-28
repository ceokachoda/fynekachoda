"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

function coerceCard(raw: Record<string, unknown>): PublicCard {
  const badges = Array.isArray(raw.badges) ? raw.badges : [];
  return {
    full_name: String(raw.full_name ?? ""),
    batch_name: String(raw.batch_name ?? ""),
    streak: Number(raw.streak ?? 0),
    badges: badges.map((b) => {
      const x = (b ?? {}) as Record<string, unknown>;
      return {
        code: String(x.code ?? ""),
        name: String(x.name ?? ""),
        icon_path: String(x.icon_path ?? ""),
      };
    }),
  };
}

export function useLeaderboard(scope: LeaderboardScope) {
  const { appUser } = useSession();
  const studentId = appUser?.id;

  return useQuery({
    queryKey: ["leaderboard", studentId, scope],
    enabled: !!studentId,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("my_batch_leaderboard", {
        p_scope: scope,
      });
      if (error) throw error;
      const rows = ((data ?? []) as Record<string, unknown>[]).map(coerce);
      const me = rows.find((r) => r.is_me) ?? null;
      return { rows, me, total: rows.length };
    },
  });
}

export async function fetchStudentCard(
  studentId: string,
): Promise<PublicCard | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("student_public_card", {
      p_student: studentId,
    });
    if (error || !data) return null;
    return coerceCard(data as Record<string, unknown>);
  } catch {
    return null;
  }
}
