# Phase 8 — Mastery, Streaks, Dashboard

> Real mastery computation (rolling-N), real streak ticks (nightly cron), and the fully-wired student + teacher dashboards. Stats strip, weak topics, today's schedule, continue watching, recent badges (badges themselves come in Phase 10 — Phase 8 leaves room).

**Status: 🟡 CODE-COMPLETE, MANUAL QA PENDING — 2026-05-21.** All 13 checkpoints are code-complete and every automated test is green (ledger in §15). NOT yet verified on a real device or in a real browser — rendering / realtime / heatmap-lag / streak-calendar / next-card-priority bugs are EXPECTED and have not been ruled out. Manual QA plan: `docs/phases/phase-8-manual-tests.md`. Do NOT mark Phase 8 "done" until the manual QA signs off the ACCEPTED line in §15.

---

## 1. Goal

Turn the placeholder dashboard into a live, useful screen. Every data signal a student or teacher cares about (attendance %, mastery %, weak topics, batch heatmaps) is computed from existing tables. No new business primitives — purely composition + aggregation + UI polish.

## 2. Prerequisites

- [ ] Phase 7 accepted.
- [ ] At least 1 batch with attendance + quiz attempts + exam attempts populated (use seed if needed).
- [ ] Confirm: rolling N = 5 (D-070). Confirm composite weights stable.

## 3. Scope

### In
- DB: `mastery` (per (student, topic)), `streaks` (per student).
- Edge functions (real implementations): `mastery-recompute`, `streak-recompute`.
- pg_cron schedules: streak nightly (02:00 IST), mastery sweep nightly (02:30 IST).
- DB function `student_dashboard(student_id)` → single JSON return for the dashboard (perf optimization).
- Mobile student: rebuild `(student)/index.tsx` per `spec/student-dashboard.md §3` — next card, stats strip, today's schedule (live), weak topics, continue watching, recent badges (still empty until Phase 10).
- Mobile teacher: `(teacher)/index.tsx` with pending tasks list, today's classes, quick actions.
- Mobile teacher: `(teacher)/batch/[id].tsx` with attendance heatmap, topic mastery breakdown, students-at-risk list.
- Per-feature wiring updates: `quiz-submit`, `exam-submit`, `attendance-qr-verify`, `offline-score-upsert` all call `mastery-recompute` (no longer no-op).

### Out
- Badges (Phase 10).
- Leaderboard rank pill on dashboard (Phase 10 — placeholder shown).
- Charts beyond simple bar (no advanced visualizations).
- Trend lines / week-over-week deltas.

## 4. Specs in play

- `docs/spec/student-dashboard.md` — primary.
- `docs/spec/teacher-panel.md §5, §13` (teacher dashboard + batch view).
- `docs/spec/leaderboard-and-gamification.md §4` (streak rules).
- `docs/decisions.md` D-070, D-074, D-075.

## 5. Backend work

### 5.1 Migration: mastery + streaks tables (Checkpoint 1)

`supabase/migrations/0017_mastery_streaks.sql`:

```sql
create table public.mastery (
  student_id      uuid not null references public.students(user_id) on delete cascade,
  topic_id        uuid not null references public.topics(id) on delete cascade,
  mastery_pct     numeric not null check (mastery_pct between 0 and 100),
  attempt_count   int not null default 0,
  last_attempt_at timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (student_id, topic_id)
);

create index mastery_student_idx on public.mastery (student_id);
create index mastery_weak_idx on public.mastery (student_id, mastery_pct) where mastery_pct < 60;

create table public.streaks (
  student_id   uuid primary key references public.students(user_id) on delete cascade,
  current_days int not null default 0,
  best_days    int not null default 0,
  last_active  date,
  updated_at   timestamptz not null default now()
);
```

### 5.2 Migration: mastery + streaks RLS (Checkpoint 2)

`supabase/migrations/0018_mastery_streaks_rls.sql`:

```sql
alter table public.mastery enable row level security;
alter table public.streaks enable row level security;

create policy mastery_self on public.mastery for select to authenticated using (student_id = public.current_app_user_id());
create policy mastery_teacher on public.mastery for select to authenticated using (
  public.has_role('teacher')
  and student_id in (
    select s.user_id from public.students s
    where s.batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  )
);
create policy mastery_admin on public.mastery for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy streaks_self on public.streaks for select to authenticated using (student_id = public.current_app_user_id());
create policy streaks_teacher on public.streaks for select to authenticated using (
  public.has_role('teacher')
  and student_id in (
    select s.user_id from public.students s
    where s.batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  )
);
create policy streaks_admin on public.streaks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

### 5.3 Edge fn: mastery-recompute (real) (Checkpoint 3)

`apps/functions/mastery-recompute/index.ts`:

Input options:
- `{ student_id, topic_ids?: string[] }` — targeted
- `{ full: true }` — sweep all (admin/cron)

Algorithm per `(student_id, topic_id)`:
```sql
with attempts as (
  select submitted_at, score / nullif(max_score, 0) * 100 as pct
  from (
    select qa.submitted_at, qa.score, qa.max_score
    from public.quiz_attempts qa
    join public.quiz_questions qq on qq.quiz_id = qa.quiz_id
    join public.questions q on q.id = qq.question_id
    where qa.student_id = $1 and qa.submitted_at is not null and q.topic_id = $2

    union all

    select ea.submitted_at, ea.score, ea.max_score
    from public.exam_attempts ea
    join public.exam_questions eq on eq.exam_id = ea.exam_id
    join public.questions q on q.id = eq.question_id
    where ea.student_id = $1 and ea.submitted_at is not null and q.topic_id = $2
  ) all_attempts
  order by submitted_at desc
  limit 5
)
insert into public.mastery (student_id, topic_id, mastery_pct, attempt_count, last_attempt_at, updated_at)
select $1, $2,
       coalesce(avg(pct), 0),
       count(*),
       max(submitted_at),
       now()
from attempts
on conflict (student_id, topic_id) do update
set mastery_pct     = excluded.mastery_pct,
    attempt_count   = excluded.attempt_count,
    last_attempt_at = excluded.last_attempt_at,
    updated_at      = now();
```

Offline scores also contribute, but only at the subject level (since they don't tag topic). Approach: distribute the offline subject-level score equally across all topics in the subject for that student's batch, BUT weight only 10% (so per-topic quiz/exam attempts dominate). Or simpler: ignore offline for mastery in MVP and use them only in parents' report. **Decision for Phase 8: offline scores feed mastery at the subject summary level only, not per-topic. Per-topic mastery uses quizzes + exams only.**

Bulk sweep: iterate students × distinct topics they've touched in last 30 days.

### 5.4 Edge fn: streak-recompute (real) (Checkpoint 4)

`apps/functions/streak-recompute/index.ts`:

Triggered nightly at 02:00 IST.

```sql
-- For each student, check activity_days yesterday → tick or reset.
update public.streaks s
set current_days = case
      when exists (select 1 from public.activity_days a where a.student_id = s.student_id and a.day = (current_date - interval '1 day')::date)
        then s.current_days + 1
      else 0
    end,
    best_days = greatest(s.best_days, case when ... then s.current_days + 1 else s.current_days end),
    last_active = (select max(day) from public.activity_days a where a.student_id = s.student_id),
    updated_at = now()
from public.students st
where st.user_id = s.student_id;

-- Initialize rows for students missing one
insert into public.streaks (student_id, current_days, best_days)
select user_id, 0, 0 from public.students s
where not exists (select 1 from public.streaks where student_id = s.user_id);
```

Idempotent (running twice in a day doesn't double-tick — the check is "did yesterday have activity, has streak already accounted for it"). Add an `accounted_until` date column if needed:

```sql
alter table public.streaks add column accounted_until date;
-- only tick when accounted_until < current_date - 1
```

(Simpler: track `last_evaluated_date` and skip if already evaluated for that boundary.)

### 5.5 DB function: student_dashboard(student_id) (Checkpoint 5)

`supabase/migrations/0019_student_dashboard_fn.sql`:

```sql
create or replace function public.student_dashboard(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'next_card', (
      -- complex selector per spec/student-dashboard.md §4.1
      select jsonb_build_object('type', 'live', 'session_id', s.id, 'subject', sub.name, 'starts_in_sec', extract(epoch from (s.scheduled_start - now())))
      from public.sessions s
      left join public.subjects sub on sub.id = s.subject_id
      where s.batch_id = (select batch_id from public.students where user_id = p_student)
        and (s.status = 'live'
          or (s.scheduled_start <= now() + interval '30 min' and s.scheduled_start > now() - interval '15 min'))
      order by s.scheduled_start asc
      limit 1
    ),
    'stats', jsonb_build_object(
      'attendance_pct', (
        select round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*), 0), 0)
        from public.sessions s
        left join public.attendance a on a.session_id = s.id and a.student_id = p_student
        where s.batch_id = (select batch_id from public.students where user_id = p_student)
          and s.scheduled_start >= now() - interval '30 days'
          and s.scheduled_start < now()
      ),
      'mastery_pct', (
        select round(coalesce(avg(mastery_pct), 0), 0) from public.mastery where student_id = p_student
      ),
      'rank', null  -- Phase 10 fills this
    ),
    'today', (
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'subject', sub.name,
        'start', s.scheduled_start,
        'end', s.scheduled_end,
        'status', coalesce(a.status, case when s.status = 'live' then 'live' when s.scheduled_end < now() then 'missed' else 'upcoming' end)
      ))
      from public.sessions s
      left join public.subjects sub on sub.id = s.subject_id
      left join public.attendance a on a.session_id = s.id and a.student_id = p_student
      where s.batch_id = (select batch_id from public.students where user_id = p_student)
        and s.scheduled_start::date = current_date
      order by s.scheduled_start
    ),
    'weak_topics', (
      select jsonb_agg(jsonb_build_object('topic_id', topic_id, 'topic_name', t.name, 'mastery', mastery_pct))
      from (
        select m.topic_id, m.mastery_pct, t.name from public.mastery m
        join public.topics t on t.id = m.topic_id
        where m.student_id = p_student and m.mastery_pct < 50 and m.attempt_count >= 2
        order by m.mastery_pct asc
        limit 3
      ) sub
    ),
    'continue', (
      select jsonb_agg(jsonb_build_object('content_id', vp.content_id, 'title', c.title, 'watched_pct', vp.watched_pct))
      from public.video_progress vp
      join public.content_items c on c.id = vp.content_id
      where vp.student_id = p_student and vp.watched_pct < 95
      order by vp.last_watched_at desc
      limit 3
    ),
    'streak', (
      select jsonb_build_object('current_days', current_days, 'best_days', best_days) from public.streaks where student_id = p_student
    ),
    'recent_badges', '[]'::jsonb  -- Phase 10
  );
$$;
```

Single round-trip for the dashboard. Cached client-side 60s.

### 5.6 Wire up mastery feeder calls (Checkpoint 6)

Update existing edge fns to call `mastery-recompute` at end:
- `quiz-submit` → invoke `mastery-recompute({student_id, topic_ids})`.
- `exam-submit` → same.
- `attendance-qr-verify` → not needed for mastery, but call streak feeder (insert into `activity_days`).
- `offline-score-upsert` → currently doesn't drive per-topic mastery; skip mastery call.

Calls are fire-and-forget (don't block the user-facing response). Use Supabase Edge's internal HTTP between functions or, simpler, perform the SQL inline.

For simplicity: inline the recompute SQL directly into `quiz-submit` and `exam-submit` for the specific student + topics touched. The standalone `mastery-recompute` fn exists for cron sweeps.

### 5.7 pg_cron schedules (Checkpoint 7)

```sql
select cron.schedule('streak-recompute',   '30 20 * * *', $$select net.http_post(... call streak-recompute fn ...)$$);
select cron.schedule('mastery-sweep',      '0 21 * * *',  $$select net.http_post(... call mastery-recompute fn with full=true ...)$$);
-- 20:30 UTC = 02:00 IST, 21:00 UTC = 02:30 IST
```

(Use `pg_net` or schedule a small SQL wrapper to invoke edge fns.)

## 6. Frontend work

### 6.1 Mobile student: dashboard rebuild (Checkpoint 8)

`apps/mobile/app/(student)/index.tsx`:

Layout per `spec/student-dashboard.md §3`. Replaces Phase 4 partial wiring.

- Greeting line: "Good morning, Aarav" + streak flame.
- `NextCard` (one of 7 priorities per spec §4.1).
- `StatsStrip` (attendance, mastery, rank).
- `TodaySchedule` rows.
- `WeakTopics` cards with "Practice" CTA.
- `ContinueWatching` strip.
- `RecentBadges` (empty until Phase 10; show "Earn your first badge soon!").

Data: one call to `student_dashboard(student_id)` via Supabase RPC. 60s cache. Realtime subscription on `sessions` + `attendance` for invalidation.

### 6.2 Mobile student: streak detail modal (Checkpoint 9)

`apps/mobile/app/modal.tsx?type=streak`:
- Calendar heatmap (30 days): each day a green/grey square.
- Streak rules text.
- "Best streak: N days" caption.

### 6.3 Mobile student: mastery breakdown (Checkpoint 10)

`apps/mobile/app/(student)/profile.tsx?tab=mastery`:
- Tab in profile screen.
- Lists topics with current mastery + small bar.
- Tap a topic → list of attempts that contributed.

### 6.4 Mobile teacher: dashboard live (Checkpoint 11)

`apps/mobile/app/(teacher)/index.tsx` rebuild (replaces Phase 3 stub):

Per `spec/teacher-panel.md §5`:
- Greeting + today's date.
- NEXT card (next live class or imminent session).
- PENDING list: exams awaiting result release, offline scores not entered for recent tests, unresolved raised-hands (Phase 9, so empty here).
- TODAY'S CLASSES list.
- QUICK ACTIONS: Scan QR, New Exam, Upload.

Data: a parallel `teacher_dashboard(teacher_id)` SQL function (similar pattern).

### 6.5 Mobile teacher: batch dashboard (Checkpoint 12)

`apps/mobile/app/(teacher)/batch/[id].tsx` (replaces Phase 3 placeholder):

Tabs:
- **Attendance**: 30-day heatmap (date × student matrix simplified to date × overall pct line + per-student rows).
- **Mastery**: bar chart per topic.
- **Risk**: students with composite < 0.4 (use a simplified score until Phase 10 lands the full composite — fall back to: avg(mastery) below 40% OR attendance < 60%).

Each risk row: send parent report (Phase 11), write a teacher note (Phase 11), view full student profile.

For Phase 8, the "send parent report" + "write note" buttons are disabled placeholders.

### 6.6 Stats strip on dashboard reflects rank placeholder (Checkpoint 13)

Show "Rank: —" until Phase 10 wires leaderboard. Don't break the layout.

## 7. Files changed (summary)

### Mobile — edited
- `app/(student)/index.tsx` — full rebuild.
- `app/(student)/profile.tsx` — add mastery tab.
- `app/(teacher)/index.tsx` — full rebuild.
- `app/(teacher)/batch/[id].tsx` — full rebuild.
- `app/modal.tsx` — streak modal type.

### Mobile — added
- `components/dashboard/NextCard.tsx`, `StatsStrip.tsx`, `MasteryCard.tsx`, `StreakFlame.tsx`, `TodayScheduleStrip.tsx`, `WeakTopicsList.tsx`, `ContinueStrip.tsx`, `RecentBadgesStrip.tsx`
- `components/teacher/PendingList.tsx`, `BatchHeatmap.tsx`, `TopicMasteryBars.tsx`, `AtRiskList.tsx`
- `features/dashboard/useStudentDashboard.ts`, `useTeacherDashboard.ts`, `useStreak.ts`, `useMastery.ts`

### Edge fns
- `mastery-recompute` (real implementation; replaces stub)
- `streak-recompute` (real)
- Updated `quiz-submit`, `exam-submit`, `attendance-qr-verify` to call mastery/streak feeders inline.

### DB
- 3 migrations (tables, RLS, dashboard fn)
- pg_cron schedules

## 8. Integration & cross-cutting

- Audit: not needed for reads; mastery recompute writes are system-internal.
- Telemetry: `dashboard_viewed`, `dashboard_next_card_clicked`, `dashboard_weak_topic_clicked`, `dashboard_continue_clicked`, `streak_modal_opened`.
- Performance: `student_dashboard()` SQL fn target p95 < 200ms (verify with `explain analyze`).

## 9. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Mastery recompute cost when many students × topics | Mostly incremental (per-attempt). Nightly sweep limited to last 30 days of changed students. |
| Dashboard SQL fn returns null for new students | Coalesce defaults everywhere; UI handles "no data yet" gracefully. |
| Streak ticks wrong across IST midnight | All date math uses `AT TIME ZONE 'Asia/Kolkata'`. |
| Dashboard re-renders on every realtime event | TanStack Query `select` projects only changed slice; React.memo on cards. |
| First-load empty state looks broken | Skeleton loader for 800ms, then real data or empty state with helpful copy. |
| Teacher batch heatmap slow for batches with 30+ students × 60 days | Server-side aggregate in a DB view; client gets one row per date with %, not full matrix. |

## 10. Acceptance criteria

1. Migrations clean. `mastery` + `streaks` tables exist; RLS green.
2. After a student submits a quiz, their `mastery` row for that topic updates within 2s.
3. After a student is marked attendance, `activity_days` row inserted; streak doesn't tick until next cron.
4. Trigger `streak-recompute` manually: streak `current_days` becomes 1 for active students.
5. Dashboard loads <1.5s warm, <3s cold on Redmi 8A.
6. Next card priority reflects spec §4.1 — verify each of 7 priorities by setting up scenarios.
7. Stats strip shows real attendance % and mastery %; rank is "—".
8. Today's schedule shows actual sessions for current day with correct statuses.
9. Weak topics: only topics with mastery <50% and ≥2 attempts appear; "Practice" CTA launches a quiz.
10. Continue watching shows videos with watched_pct < 95% sorted by recency.
11. Streak modal: calendar shows the right green/grey pattern matching `activity_days`.
12. Mastery tab in profile shows per-topic breakdown.
13. Teacher dashboard shows pending exams + today's classes; quick actions work.
14. Teacher batch view: heatmap renders without lag on a batch of 30 students.
15. Teacher topic mastery bars sorted by avg ascending (weakest first).
16. Students-at-risk list correctly identifies struggling students.
17. RLS: student cannot read another student's mastery; teacher only sees own batches.
18. Dashboard handles network drop gracefully (cached data + offline banner).
19. CI green.

## 11. Test plan

### Unit
- Rolling-N calculation (5 attempts, 6 attempts, 0 attempts).
- IST date boundary tests for streak.

### Integration
- `mastery-recompute`: targeted vs full sweep; idempotent.
- `streak-recompute`: idempotent on same day; ticks across days.

### RLS
- Mastery read scoped correctly.
- Streak read scoped correctly.
- Dashboard fn restricts results to caller's data.

### Manual QA
- Seed data: 5 students, varying quiz/attendance patterns. Verify each dashboard reflects expected numbers.
- Force tomorrow's cron via SQL; verify streak ticks.
- 7-day-streak student: streak flame is large/orange.
- Empty student (no activity): dashboard shows zeros without errors.

### Performance
- Run `explain analyze public.student_dashboard(uuid)` on a 30-row batch with full data — verify <100ms.
- Redmi 8A: dashboard cold-load measured + recorded.

## 12. Rollback plan

If Phase 8 breaks:
1. Revert migrations 0017–0019.
2. Roll back changes to quiz-submit/exam-submit/attendance-qr-verify edge fns (re-add no-op feeders).
3. Mobile dashboard reverts to Phase 4 partial layout.
4. Existing features still functional.

## 13. Definition of done

- [ ] All 19 AC pass.
- [ ] Dashboard query p95 < 200ms server-side.
- [ ] Dashboard cold-load on Redmi 8A < 3s.
- [ ] Cron jobs visible in `cron.job` table with next-run times.
- [ ] CI green.
- [ ] User says "Phase 8 accepted".

## 14. Hand-off to Phase 9

- Mastery + streaks live; dashboard fully composes real data.
- Pending the "rank" placeholder in stats strip (Phase 10).
- Phase 9 takes the wrapped YT player (built in Phase 5) and adds live broadcast creation, chat, raise-hand, recording.

---

## 15. Acceptance ledger

**Status: 🟡 CODE-COMPLETE, DATA-LAYER RE-VERIFIED, VISUAL QA PENDING — 2026-05-21 (re-verified 2026-05-22).**
**ACCEPTED:** _(pending **visual / on-device** QA sign-off — see `phase-8-manual-tests.md`)_

> **2026-05-22 agent re-verification.** The entire data + logic layer was re-run on
> the dev project and is green: `test:dashboard` 16/16, `smoke:dashboard-rls` 9/9,
> `smoke:dashboard-fns` 11/11; backend deploy (2 edge fns ACTIVE + 2 crons + 6 DB
> fns); seeded composition cross-checked against the dashboard RPC definitions (A1
> 89%/64%/streak 7/Kinematics 27.78/Laws 100/video 45%/offline 68/exam awaiting
> release; A2 8%/33% at-risk; A3 clean zeros; teacher topic bars 18/100, at-risk = A2
> only, attendance heatmap 9 days; next-card cascade P1→P7 correct by construction);
> §I sanity (RLS on, 3 policies each, streak_rows=student_rows 162, recompute
> idempotent 6→6, `attendance` in realtime publication); quiz-submit feeder wired;
> advisor sweep 0 ERRORs (only accepted D-186 + Phase-1 WARNs). **`phase-8-manual-tests.md`
> was trimmed to VISUAL / ON-DEVICE ONLY** — the SQL-only sub-tests (old §0.1, §0.4,
> §C3, §D3, §H3, §I) are done; full results live in that doc's §J. Only real-device
> rendering / routing / realtime-refresh / heatmap-scroll / cold-start remain for the
> user to sign off.

### Checkpoints
| CP | Scope | State |
|----|-------|-------|
| CP1 | `mastery` + `streaks` tables (+ RLS-on) | 🟢 code-complete |
| CP2 | mastery + streaks RLS (self / teacher-batch / admin) | 🟢 |
| CP3 | `mastery_recompute()` DB fn + `mastery-recompute` edge wrapper | 🟢 |
| CP4 | `streak_recompute()` DB fn + `streak-recompute` edge wrapper | 🟢 |
| CP5 | `student_dashboard(p_student)` single-JSON fn (7 next-card priorities) | 🟢 |
| CP6 | inline mastery feeders in quiz-submit + exam-submit; video≥50% activity trigger | 🟢 |
| CP7 | pg_cron streak (02:00 IST) + mastery sweep (02:30 IST) | 🟢 |
| CP8 | student `(student)/index.tsx` rebuild + `(student)/classes.tsx` real feed | 🟢 |
| CP9 | streak detail modal (`modal.tsx?type=streak`, 30-day heatmap) | 🟢 |
| CP10 | profile mastery tab (`profile.tsx?tab=mastery`) | 🟢 |
| CP11 | teacher `(teacher)/index.tsx` rebuild + `teacher_dashboard()` fn | 🟢 |
| CP12 | teacher `(teacher)/batch/[id].tsx` analytics + `teacher_batch_overview()` fn | 🟢 |
| CP13 | tests + ledger + seed + manual plan + memory | 🟢 |

### Migrations (10, applied + filed in `supabase/migrations/`)
`20260521130000_mastery_streaks`, `…130500_mastery_streaks_rls`, `…131000_mastery_recompute_fn`,
`…131500_streak_recompute_fn`, `…132000_student_dashboard_fn`, `…132500_teacher_dashboard_fn`,
`…133000_video_activity_trigger`, `…133500_dashboard_cron`, `…134000_teacher_batch_overview_fn`,
`…134500_revoke_trigger_fn_execute`.

### DB functions
- `public.mastery_recompute(p_student, p_topic_ids, p_full)` — SECURITY DEFINER, service_role only.
- `public.streak_recompute(p_today)` — SECURITY DEFINER, service_role only.
- `public.student_dashboard(p_student)` / `public.teacher_dashboard(p_teacher)` / `public.teacher_batch_overview(p_batch)` — SECURITY DEFINER + own-or-admin guard, granted to `authenticated` (the mobile RPC surface).
- `public.video_progress_activity()` — SECURITY DEFINER trigger fn; EXECUTE revoked (not RPC-exposed).

### Edge functions
- **New:** `mastery-recompute`, `streak-recompute` (admin-gated wrappers over the DB fns).
- **Redeployed:** `quiz-submit` (v2), `exam-submit` (v3) — inline best-effort mastery recompute on submit.
- Deploy method: `node scripts/stage-phase8-deploy.cjs` → `npx supabase functions deploy <fn> --workdir <staged> --project-ref orqwyazvcthgxoadfxfv` (global CLI absent; no Docker needed for `functions deploy`).

### Cron (`cron.job`)
- `streak-recompute` `30 20 * * *` → `select public.streak_recompute();`
- `mastery-sweep` `0 21 * * *` → `select public.mastery_recompute(p_full := true);`
- Both call the DB fns directly (no pg_net); idempotent by construction (D-185 / D-106).

### Tests (automated — all green)
- `pnpm test:dashboard` — **16/16** (rolling-N math, per-attempt clamp, IST streak gaps/boundaries).
- `pnpm smoke:dashboard-rls` — **9/9** (mastery/streaks self vs teacher-batch scoping; dashboard guard).
- `pnpm smoke:dashboard-fns` — **11/11** (dashboard RPCs over HTTP; recompute admin-gates 403/400; recompute→mastery).
- Mobile: `typecheck` clean · `lint` 0 errors (no new warnings) · `jest` **53/53**.
- Perf: `EXPLAIN ANALYZE student_dashboard(rich student)` = **13.5 ms** server-side (target <100 ms; AC #5/§13). `teacher_batch_overview` on a 28-student batch returns promptly.
- DB-fn correctness verified by SQL: mastery dedup + clamp + idempotent; streak across 5 reset/gap/restart scenarios; student/teacher dashboards on seeded data (A1 mastery 64 / weak Kinematics 27.78 / streak 7 / continue / next-card P3; A2 at-risk 8%/33%; topic bars asc; attendance heatmap).

### Advisor sweep
- Security: only `auth_leaked_password_protection` (pre-existing Phase 1 backlog) + 3× `authenticated_security_definer_function_executable` for the dashboard RPCs (**intentional, accepted — D-186**). The `video_progress_activity` 0028/0029 findings were resolved by revoking EXECUTE.
- Performance: `multiple_permissive_policies` (project-wide accepted), one `unused_index` on the fresh `mastery_weak_idx`, one `unindexed_foreign_keys` INFO on `mastery.topic_id` (joins the accepted-INFO set; only matters for topic-deletion cascade).

### Decisions (D-184 … D-189)
- **D-184** — Mastery = rolling avg of the **last 5 distinct submitted attempts per (student, topic)**, quiz+exam pooled (D-070); whole-attempt % per spec §6 (a multi-topic exam's % is attributed to each of its topics). Fixed the spec draft's row-multiplication bug with `EXISTS` (each attempt counted once) and clamped each attempt's % to [0,100] before averaging (negative marking can push a raw score below 0; the table CHECK is 0–100).
- **D-185** — `streak_recompute` is a **from-scratch gaps-and-islands** computation over `activity_days` (current = length of the most-recent consecutive run iff it reaches yesterday/today, else 0; best is sticky). Idempotent and self-healing across missed cron runs (D-106), unlike the spec's incremental tick draft. Crons call the DB fns directly (no pg_net round-trip).
- **D-186** — The three dashboard composers (`student_dashboard`, `teacher_dashboard`, `teacher_batch_overview`) are **SECURITY DEFINER with an internal own-or-admin guard** and granted to `authenticated`. The resulting `authenticated_security_definer_function_executable` WARN is accepted: SECURITY INVOKER would risk silent under-fetch from RLS-limited joins (the D-152 scar), and they must stay in the PostgREST-exposed `public` schema to be callable as RPCs. The guard (caller must equal the arg or be admin) is the mitigation; read-only, no injection surface.
- **D-187** — Phase 8 edge-fn deploys use `npx supabase functions deploy --workdir <D-170 staged dir>` because the global `supabase` CLI is not installed in this environment (only `SUPABASE_ACCESS_TOKEN`); `functions deploy` bundles natively (no Docker).
- **D-188** — The mastery feeder is an **inline `await admin.rpc('mastery_recompute', …)`** at the end of quiz-submit/exam-submit, wrapped in try/catch so it never fails the submit (deterministic + fresh-on-return, chosen over `EdgeRuntime.waitUntil` for testability; cost ~tens of ms).
- **D-189** — The video≥50% half of the active-day rule (D-074) is a **SECURITY DEFINER trigger** (`video_progress_activity`) on `video_progress` (students have no direct `activity_days` INSERT); EXECUTE is revoked so the trigger fn is not reachable as an RPC. attendance/quiz/exam feeders remain inline in their edge fns (already present).

### Files changed (summary)
- **Migrations:** 10 new (above).
- **Edge fns:** `apps/functions/mastery-recompute/`, `streak-recompute/` (new); `quiz-submit/index.ts`, `exam-submit/index.ts` (inline feeder); `scripts/stage-phase8-deploy.cjs`.
- **Mobile — features/dashboard/:** `types.ts`, `useStudentDashboard.ts`, `useStudentSchedule.ts`, `useStreak.ts`, `useMastery.ts`, `useTeacherDashboard.ts`, `useTeacherBatchOverview.ts`.
- **Mobile — components/dashboard/:** `NextCard`, `StatsStrip`, `StreakFlame`, `TodayScheduleStrip`, `WeakTopicsList`, `ContinueStrip`, `RecentBadgesStrip`, `MasteryCard`. **components/teacher/:** `PendingList`, `BatchHeatmap`, `TopicMasteryBars`, `AtRiskList`.
- **Mobile — screens:** `app/(student)/index.tsx`, `app/(student)/classes.tsx`, `app/(student)/profile.tsx`, `app/modal.tsx`, `app/(teacher)/index.tsx`, `app/(teacher)/batch/[id].tsx`.
- **Scripts:** `test-dashboard-helpers.ts`, `smoke-test-dashboard-rls.ts`, `smoke-test-dashboard-edge-fns.ts`, `seed-dashboard-manual-test.ts` (+ 4 root `package.json` script entries).

### Carry-overs into Phase 9+
- **Tests-tab consolidation deferred** (teacher bar still 8 tabs): merging the Phase-6 Quizzes + Phase-7 Exams screens is a UI refactor over prior-phase surfaces — skipped in an autonomous run without device QA to avoid regression; the 8-tab bar is functional.
- `next_card` types `live_class` / `upcoming_session` route to `/classes` until Phase 9 ships the live screen; "Join Lobby" / "Go Live" CTAs are placeholders.
- Mastery tab shows the rolling-N **summary** ("avg of last N attempts · practiced X"); per-attempt drill-down is a future nicety.
- `sessions` is not in the Realtime publication, so the dashboard uses **attendance-realtime + focus-refetch** (attendance is the live-changing signal); add `sessions` to the publication later if live-class start needs push invalidation.
- Redmi 8A cold-start (AC #5 hardware leg) — measure on device or record hardware-deferred; not a code blocker.
- Seed: `pnpm seed:dashboard-manual-test --reset` (plants p8-* fixtures: A1 Streak Star / A2 At Risk / A3 Fresh Start).
