"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/SessionProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { invokeEdgeFn } from "@/lib/edge-fn";

export interface BadgeCollectionItem {
  id: string;
  code: string;
  name: string;
  description: string;
  iconUrl: string | null;
  earned: boolean;
  earned_at: string | null;
}

interface BadgeRow {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_path: string;
}

interface EarningRow {
  badge_id: string;
  earned_at: string;
}

interface IconSignResponse {
  icons: Record<string, string>;
}

export function useBadgesCollection() {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  return useQuery<{ items: BadgeCollectionItem[]; earnedCount: number }>({
    queryKey: ["badges-collection", studentId],
    enabled: !!studentId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [catalogRes, earnRes, signRes] = await Promise.all([
        supabase
          .from("badges")
          .select("id, code, name, description, icon_path")
          .order("sort_order"),
        supabase
          .from("badge_earnings")
          .select("badge_id, earned_at")
          .eq("student_id", studentId!),
        invokeEdgeFn<IconSignResponse>("badge-icon-sign", {}),
      ]);
      if (catalogRes.error) throw catalogRes.error;
      if (earnRes.error) throw earnRes.error;
      const catalog = (catalogRes.data ?? []) as BadgeRow[];
      const earnings = new Map<string, string>(
        ((earnRes.data ?? []) as EarningRow[]).map((e) => [e.badge_id, e.earned_at]),
      );
      const icons = signRes.status === 200 ? signRes.body?.icons ?? {} : {};
      const items = catalog.map<BadgeCollectionItem>((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description,
        iconUrl: icons[b.code] ?? null,
        earned: earnings.has(b.id),
        earned_at: earnings.get(b.id) ?? null,
      }));
      const earnedCount = items.filter((b) => b.earned).length;
      return { items, earnedCount };
    },
  });
}
