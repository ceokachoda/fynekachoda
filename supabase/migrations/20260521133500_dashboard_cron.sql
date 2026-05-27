-- Phase 8 CP7: nightly recompute crons (D-106 idempotent; D-074 IST boundary).
-- Both jobs call the SECURITY DEFINER DB fns directly (no pg_net round-trip):
-- simpler + transactional + no JWT. The fns are pure recomputes, so a missed or
-- retried run never double-counts. Schedules are UTC; IST = UTC+5:30.
--   streak-recompute : 02:00 IST = 20:30 UTC
--   mastery-sweep    : 02:30 IST = 21:00 UTC
select cron.unschedule(jobid) from cron.job where jobname in ('streak-recompute', 'mastery-sweep');
select cron.schedule('streak-recompute', '30 20 * * *', $$select public.streak_recompute();$$);
select cron.schedule('mastery-sweep',    '0 21 * * *',  $$select public.mastery_recompute(p_full := true);$$);
