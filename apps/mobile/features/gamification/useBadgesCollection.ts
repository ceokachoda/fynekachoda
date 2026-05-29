import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  withTimeout,
} from "@/features/auth/network-errors";

// The full 11-badge catalogue + which the student has earned + a signed icon URL each.
export interface BadgeCollectionItem {
  code: string;
  name: string;
  description: string;
  icon_path: string;
  iconUrl: string | null;
  earned: boolean;
  earned_at: string | null;
}

interface State {
  items: BadgeCollectionItem[];
  earnedCount: number;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBadgesCollection(): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [items, setItems] = useState<BadgeCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!studentId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Icons render as lightweight coloured glyphs (BadgeGlyph), so we no
      // longer fetch signed SVG URLs here — saves a network round-trip + an
      // edge-fn cold start every time the Badges grid / streak modal opens.
      const [catRes, earnRes] = await Promise.all([
        withTimeout(supabase.from("badges").select("id, code, name, description, icon_path").order("sort_order")),
        withTimeout(supabase.from("badge_earnings").select("badge_id, earned_at").eq("student_id", studentId)),
      ]);
      if (catRes.error) {
        setError(catRes.error.message);
        return;
      }
      const earnedMap = new Map<string, string>();
      for (const e of (earnRes.data ?? []) as { badge_id: string; earned_at: string }[]) {
        earnedMap.set(e.badge_id, e.earned_at);
      }
      const list = ((catRes.data ?? []) as {
        id: string;
        code: string;
        name: string;
        description: string;
        icon_path: string;
      }[]).map((b) => ({
        code: b.code,
        name: b.name,
        description: b.description,
        icon_path: b.icon_path,
        iconUrl: null,
        earned: earnedMap.has(b.id),
        earned_at: earnedMap.get(b.id) ?? null,
      }));
      setItems(list);
    } catch (err) {
      setError(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : "Couldn't load your badges.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, earnedCount: items.filter((i) => i.earned).length, isLoading, error, reload };
}
