import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFn } from "@/lib/edge-fn";
import { useSession } from "@/features/auth/useSession";
import { withTimeout } from "@/features/auth/network-errors";

// Polls for badge_earnings the student hasn't seen yet (is_seen=false), oldest first.
// The dashboard celebration host shows one at a time; dismiss() flips is_seen and
// advances. Best-effort: any failure leaves the queue empty (no celebration), never
// blocks the screen.
export interface UnseenBadge {
  badge_id: string;
  code: string;
  name: string;
  description: string;
  icon_path: string;
}

interface State {
  current: UnseenBadge | null;
  iconUrls: Record<string, string>;
  refresh: () => Promise<void>;
  dismiss: () => Promise<void>;
}

export function useUnseenBadges(): State {
  const { appUser } = useSession();
  const studentId = appUser?.id;
  const [queue, setQueue] = useState<UnseenBadge[]>([]);
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});
  const iconsFetched = useRef(false);
  // Badges already dismissed locally this session. The is_seen UPDATE may not have
  // committed/propagated before a focus-driven refresh re-queries (is_seen still
  // false), which would re-pop the same celebration — so we filter them out here.
  const dismissedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await withTimeout(
        supabase
          .from("badge_earnings")
          .select("badge_id, badges(code, name, description, icon_path)")
          .eq("student_id", studentId)
          .eq("is_seen", false)
          .order("earned_at", { ascending: true }),
      );
      if (res.error) return;
      const items = ((res.data ?? []) as { badge_id: string; badges: unknown }[])
        .map((r) => {
          const b = (Array.isArray(r.badges) ? r.badges[0] : r.badges) as {
            code: string;
            name: string;
            description: string;
            icon_path: string;
          };
          return { badge_id: r.badge_id, code: b.code, name: b.name, description: b.description, icon_path: b.icon_path };
        })
        .filter((b) => !dismissedRef.current.has(b.badge_id));
      setQueue(items);
      if (items.length > 0 && !iconsFetched.current) {
        const sign = await invokeEdgeFn<{ icons: Record<string, string> }>("badge-icon-sign", {});
        // Only latch as fetched on success, so a transient edge-fn failure can retry
        // on the next refresh (otherwise icons would stay grey for the whole session).
        if (sign.body?.icons) {
          setIconUrls(sign.body.icons);
          iconsFetched.current = true;
        }
      }
    } catch {
      /* best-effort */
    }
  }, [studentId]);

  const current = queue[0] ?? null;

  const dismiss = useCallback(async () => {
    if (!current || !studentId) return;
    const badgeId = current.badge_id;
    dismissedRef.current.add(badgeId);
    setQueue((q) => q.slice(1)); // optimistic advance to the next badge
    try {
      await withTimeout(
        supabase.from("badge_earnings").update({ is_seen: true }).eq("student_id", studentId).eq("badge_id", badgeId),
      );
    } catch {
      /* best-effort: the row stays unseen and will re-surface next poll */
    }
  }, [current, studentId]);

  return { current, iconUrls, refresh, dismiss };
}
