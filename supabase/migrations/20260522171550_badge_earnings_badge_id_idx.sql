-- Phase 10 CP1 (addendum) — index the badge_id FK so the `on delete cascade`
-- from badges + award-by-badge inserts don't seq-scan badge_earnings.
-- (Clears advisor 0001_unindexed_foreign_keys on badge_earnings_badge_id_fkey.)
create index badge_earnings_badge_idx on public.badge_earnings (badge_id);
