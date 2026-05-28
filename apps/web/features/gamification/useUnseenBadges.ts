"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { invokeEdgeFn } from "@/lib/edge-fn";

export interface UnseenBadge {
  earning_id: string;
  badge_id: string;
  code: string;
  name: string;
  description: string;
  earned_at: string;
}

interface RawEarning {
  id: string;
  badge_id: string;
  earned_at: string;
  badges: { code: string; name: string; description: string } | null;
}

interface IconSignResponse {
  icons: Record<string, string>;
}

export function useUnseenBadges() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const qc = useQueryClient();

  const queue = useQuery<UnseenBadge[]>({
    queryKey: ["unseen-badges", studentId],
    enabled: !!studentId,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("badge_earnings")
        .select("id, badge_id, earned_at, badges(code, name, description)")
        .eq("student_id", studentId!)
        .is("seen_at", null)
        .order("earned_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as RawEarning[];
      return rows.map<UnseenBadge>((r) => ({
        earning_id: r.id,
        badge_id: r.badge_id,
        code: r.badges?.code ?? "",
        name: r.badges?.name ?? "Badge",
        description: r.badges?.description ?? "",
        earned_at: r.earned_at,
      }));
    },
  });

  const iconUrls = useQuery<Record<string, string>>({
    queryKey: ["badge-icon-urls"],
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const res = await invokeEdgeFn<IconSignResponse>("badge-icon-sign", {});
      if (res.status !== 200 || !res.body) return {};
      return res.body.icons ?? {};
    },
  });

  const dismiss = useMutation({
    mutationFn: async (earningId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("badge_earnings")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", earningId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unseen-badges", studentId] });
    },
  });

  const current = queue.data?.[0] ?? null;

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["unseen-badges", studentId] });
  }, [qc, studentId]);

  return {
    current,
    iconUrls: iconUrls.data ?? {},
    isLoading: queue.isLoading,
    refresh,
    dismiss: (id: string) => dismiss.mutate(id),
  };
}
