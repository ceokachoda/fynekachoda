# Decisions Log

> **Source of truth when specs disagree.** Every locked decision lives here with a date, the rule, why we picked it, and which docs it touches. New decisions append; old ones are never deleted — if a decision is overturned, add a new dated entry referencing the old `D-NNN`.

Format:
- **D-NNN (YYYY-MM-DD):** the decision in one sentence
  - **Why:** rationale
  - **Impacts:** which docs/files apply
  - **Status:** `Locked` / `Superseded by D-NNN` / `Deferred`

---

## Identity & Roles

- **D-001 (2026-05-14):** Four role tiers — `student`, `teacher`, `staff_admin`, `owner_admin`.
  - Why: institutes need a clear split between operational staff (`staff_admin`) and the institute owner (`owner_admin`); teachers need batch-scoped access broader than students but narrower than admins.
  - Impacts: `spec/authentication.md`, `spec/admin-panel.md`, RLS in `backend-architecture.md §5`.
  - Status: Locked.

- **D-002 (2026-05-14):** Roles are **additive** — a user can hold multiple roles.
  - Why: small institutes commonly have a senior teacher who also does ops; we don't want to model that as two separate accounts.
  - Impacts: `spec/authentication.md`, role-switch UI in `(student)/menu.tsx`.
  - Status: Locked.

- **D-003 (2026-05-14):** **Parents do not have app login.** Parents are reached only via WhatsApp PDF reports.
  - Why: cuts auth scope; parents prefer WhatsApp over installing yet another app.
  - Impacts: `spec/parents-report.md`.
  - Status: Locked.

- **D-004 (2026-05-14):** A student belongs to **exactly one batch at a time**.
  - Why: simplifies attendance, leaderboard, schedule; transfers handled by admin.
  - Impacts: `students.batch_id NOT NULL`, `spec/admin-panel.md §10.1`.
  - Status: Locked.

- **D-005 (2026-05-14):** A teacher can be assigned to **multiple batches**.
  - Why: real institutes share teachers across batches.
  - Impacts: `batch_teachers` join table.
  - Status: Locked.

## Brand & Pace

- **D-007 (2026-05-14):** **Brand name = "FyneStudy"** (final, not a placeholder).
  - Why: locked by founder; goes into PDFs, WhatsApp templates, app store listing, domain (`fynestudy.<tld>`).
  - Impacts: every visible string; `institute_config.name` default.
  - Status: Locked.

- **D-008 (2026-05-14):** **No fixed demo/launch date.** Build phases at a "one-per-day-when-active" cadence; quality > speed.
  - Why: founder has no client-demo pressure; prefers thoroughness.
  - Impacts: phase ordering remains as documented; no compression of Phase 1–7 to hit an early demo.
  - Status: Locked.

- **D-009 (2026-05-14):** **iOS + Android day-one at production launch.**
  - Why: confirmed in user dialog; matches D-119/D-120 device support.
  - Impacts: Apple Developer Program enrollment must be active before Phase 12 (App Store submission). Recommended to start during Phase 7 to leave a buffer for Apple's review delays.
  - Status: Locked.

## Institute & Org Model

- **D-010 (2026-05-14):** **Single institute** (no multi-branch) for MVP.
  - Why: removes multi-tenancy from MVP scope; can layer later if institute grows.
  - Impacts: every table — no `institute_id` column. `spec/admin-panel.md`.
  - Status: Locked.

- **D-011 (2026-05-14):** Hierarchy: **Course → Subject → Chapter → Topic → Content Item**.
  - Why: matches Indian coaching pedagogy and the original blueprint PDF.
  - Impacts: `backend-architecture.md §3.2 & §3.5`, `spec/study-materials.md §3`.
  - Status: Locked.

- **D-012 (2026-05-14):** **Courses are admin-editable**. Seeded with JEE Main / JEE Advanced / NEET UG / CUET UG.
  - Why: institute may add specialty tracks later.
  - Impacts: `spec/admin-panel.md §11`.
  - Status: Locked.

- **D-013 (2026-05-14):** A batch has **exactly one course**.
  - Why: simplest mental model; combined batches handled by enrolling two batches if needed.
  - Impacts: `batches.course_id NOT NULL`.
  - Status: Locked.

- **D-014 (2026-05-14):** Timezone is **Asia/Kolkata (IST)** for all schedules, streaks, and reports.
  - Why: single-region institute; no need for per-user TZ.
  - Impacts: `packages/shared/time/ist.ts`.
  - Status: Locked.

- **D-015 (2026-05-14):** UI language is **English only** for MVP.
  - Why: every student speaks English in JEE/NEET prep; localization deferred to phase 2+.
  - Impacts: no i18n library in MVP.
  - Status: Locked.

## Identity Editability (added 2026-05-14)

- **D-016 (2026-05-14):** **Students and teachers cannot self-change** `batch_id`, `course_id` (derived), `email`, `phone`, `parent_phone_*`, `dob`, or `full_name`. All such changes go through admin.
  - Why: prevents drift from institute records; admin is single source of truth.
  - Impacts: profile screens in `(student)` and `(teacher)` show these fields read-only with a "Contact admin" hint; RLS has no UPDATE policy on these columns for non-admin roles. `spec/authentication.md`, `spec/admin-panel.md`.
  - Status: Locked.

- **D-017 (2026-05-14):** Users **can self-change**: password, avatar, MFA enrollment (where allowed), display preferences (theme), notification opt-ins (when notifications ship).
  - Why: anything not affecting institute records is fine to self-manage.
  - Impacts: `(student)/menu.tsx`, `(teacher)/profile.tsx`.
  - Status: Locked.

## Authentication

- **D-020 (2026-05-14):** Login method = **email + password**, admin-issued.
  - Why: simpler ops than phone-OTP; aligns with admission paperwork; deterministic credentials.
  - Impacts: replaces existing `app/index.tsx` + `app/verify.tsx` OTP screens. `spec/authentication.md`.
  - Status: Locked. Supersedes the phone-OTP UI present in the current build.

- **D-021 (2026-05-14):** **No self-signup** anywhere.
  - Why: institute controls who's in.
  - Impacts: removes any future temptation to expose a signup screen. `spec/authentication.md`.
  - Status: Locked.

- **D-022 (2026-05-14):** **Force password change on first login.**
  - Why: admin-issued temp password should never be the long-term password.
  - Impacts: `app_users.must_change_password` flag; `app/force-password-change.tsx`.
  - Status: Locked.

- **D-023 (2026-05-14):** **TOTP MFA required** for both admin tiers; optional for teacher; off for student.
  - Why: admins have blast radius; teachers handle PII; students get friction-free login.
  - Impacts: `spec/authentication.md §9`, admin middleware.
  - Status: Locked.

- **D-024 (2026-05-14):** Account lockout = **5 failed attempts / email / 15 minutes**.
  - Why: matches Supabase native + industry norm.
  - Impacts: `spec/authentication.md §8`.
  - Status: Locked.

- **D-025 (2026-05-14):** **Multi-device login allowed.**
  - Why: students may switch phones; no good reason to force single-device.
  - Impacts: no device-pinning logic.
  - Status: Locked.

- **D-026 (2026-05-14):** Refresh tokens stored in **`expo-secure-store`** (Android Keystore / iOS Keychain). Never AsyncStorage.
  - Why: AsyncStorage is world-readable on rooted devices.
  - Impacts: `lib/secure-store.ts`, `lib/supabase.ts`.
  - Status: Locked.

- **D-027 (2026-05-14):** Access JWT = 1 hour; refresh token = 30 days rolling.
  - Why: Supabase defaults that balance freshness and UX.
  - Status: Locked.

- **D-147 (2026-05-15):** Single `auth-suspend` edge fn handles both suspend AND unsuspend via a `mode: "suspend" | "unsuspend"` discriminated field — not two separate functions.
  - Why: same caller (admin), same target (`app_users.is_active`), same audit shape. One fn keeps the contract symmetric and avoids two near-identical implementations drifting apart.
  - Impacts: `apps/functions/auth-suspend/index.ts`, `_shared/schemas.ts SuspendInputSchema`.
  - Status: Locked.

- **D-148 (2026-05-15):** Every mobile Supabase auth call and edge-fn fetch must be wrapped in `withTimeout(...)` (15s default). Edge-fn fetches additionally use an `AbortController`.
  - Why: RN's fetch and supabase-js have no built-in timeout. During CP8 a dropped response packet stranded the UI on "Saving…" forever (server side completed, client never knew). The 15s cap is well past p99 for every call we make, and all our auth mutations are idempotent so retries are safe.
  - Impacts: `apps/mobile/features/auth/network-errors.ts` (helper); every call site in `apps/mobile/features/auth/auth.ts`.
  - Status: Locked.

- **D-149 (2026-05-15):** The forgot-password flow always returns success-looking UI ("Check your inbox…") for any syntactically-valid email, regardless of whether the address exists. Only network errors surface to the user.
  - Why: prevents email-enumeration attacks (standard pattern: GitHub, Google, etc.) AND sidesteps Supabase Auth's built-in rejection of reserved test domains (`.example.com`, `.test`) that would otherwise confuse demo users with seed-data accounts.
  - Impacts: `apps/mobile/features/auth/auth.ts requestPasswordReset`.
  - Status: Locked.

- **D-150 (2026-05-15, Phase 3 CP3):** `auth-bootstrap` accepts an optional `batch_id: uuid` for the student role; falls back to the "Default Batch (rename me)" lookup when absent.
  - Why: lets CP7's `/students/new` form pass the picker selection directly; keeps the v1 path (no batch_id) working for the demo bootstrap script and any other backwards-compat callers. One edge fn, two callers, zero churn for the older one.
  - Impacts: `apps/functions/auth-bootstrap/index.ts`, `apps/functions/_shared/schemas.ts BootstrapInputSchema`, `apps/admin/app/(dashboard)/students/new/actions.ts`.
  - Status: Locked.

- **D-151 (2026-05-15, Phase 3 CP6 + CP7):** **One `*-mutate` edge function per resource family** (`curriculum-mutate` 12 ops via discriminated-union body, `batch-mutate` 8 ops) instead of one edge fn per op (20 functions would otherwise have been needed).
  - Why: mutation + audit + capacity check + RLS validation belong server-side; consolidating keeps the audit pattern uniform and reduces edge-fn count. The op switch is a single `discriminatedUnion` zod schema; bodies are tiny.
  - Impacts: `apps/functions/curriculum-mutate/`, `apps/functions/batch-mutate/`, `_shared/schemas.ts (CurriculumMutateInputSchema, BatchMutateInputSchema)`.
  - Status: Locked. Same shape applies for future resource families that need >2 admin ops.

- **D-152 (2026-05-15, Phase 3 CP10):** When a mobile screen embeds another user's row through a join (e.g., `students.select("user_id, app_users!user_id(full_name)")`), the target table needs an RLS policy granting the calling role access — not just the bridge table. The CP10 fix added `app_users_teacher_batch_read` to `public.app_users` so teachers can resolve student names for embedded joins.
  - Why: PostgREST silently returns NULL on the embedded relation when RLS blocks the join target — there's no error, just empty fields. CP10's batch-detail screen rendered every student name as "—" because of this exact pattern. Locked in by `test-rls.ts` Tests 14 + 15.
  - Impacts: any future "teacher/admin views another user's profile through an embed" surface — Phase 4 attendance roster, Phase 8 mastery dashboards, Phase 10 leaderboards. Mirror this policy shape on `app_users` for the requesting role.
  - Status: Locked.

- **D-153 (2026-05-15, Phase 3 CP10):** Mobile **NEVER** calls `supabase.auth.updateUser({ password })` itself in the force-password-change or password-reset flows. The `auth-change-own-password` edge function is the single-call replacement; it uses service-role `admin.auth.admin.updateUserById` + clears `must_change_password` + writes the audit row, all server-side. **Supersedes the second-call portion of D-148** (the `auth-clear-must-change` invoke) and the original two-step flow in `phase-2.md §5.8`.
  - Why: on iOS Expo Go, `supabase.auth.updateUser` rotates the session JWT under the hood and the next RN fetch (whether raw `fetch` or `supabase.functions.invoke`) silently dies before reaching the wire. Three separate incidents (Phase 2 CP8, Phase 3 CP9, Phase 3 CP10) all displayed as "Couldn't reach the server" while server logs showed the password actually changed. Collapsing both steps into a single edge-fn call eliminates the JWT-rotation race entirely.
  - Impacts: `apps/functions/auth-change-own-password/index.ts` (deployed v1), `apps/mobile/features/auth/auth.ts changeOwnPassword + setPasswordAfterReset`. The original `auth-clear-must-change` edge fn is still deployed but unreachable; safe to leave or delete in future housekeeping.
  - Status: Locked.

- **D-154 (2026-05-15, Phase 3 CP10):** Mobile `supabase.auth.*` calls use `withTimeout(_, 30_000)` (30s budget, **refining D-148's 15s default**) AND check `supabase.auth.getSession()` after any timeout / network-error path to detect a session that landed asynchronously after the UI gave up. `apps/mobile/app/login.tsx` additionally subscribes to `useSession().session` and auto-routes to `/` when a session arrives while the user is still on the login screen.
  - Why: server-side auth `/token` returns 200 in ~89ms but the supabase-js promise can take 15+ seconds to resolve when iOS Expo Go is slow writing the session into the Keychain. The 30s timeout + post-timeout `sessionLanded()` check + login-screen session watcher cover three failure modes in concert. **All mobile `supabase.from()` / `supabase.functions.invoke()` calls continue to use D-148's 15s default** — only auth calls bump to 30s.
  - Impacts: `apps/mobile/features/auth/auth.ts AUTH_TIMEOUT_MS + sessionLanded`, `apps/mobile/app/login.tsx useEffect on session`.
  - Status: Locked.

- **D-155 (2026-05-15, Phase 3 CP11):** TOTP recovery codes are **10 codes per enrolment**, format `XXXXX-XXXXX` (10 chars + hyphen) from a 31-char ambiguity-stripped alphabet (`abcdefghjkmnpqrstuvwxyz23456789` — no `0/1/i/l/o`), stored as **SHA-256 hex hashes** in `public.mfa_recovery_codes`. **Consume = mark `used_at` + delete every verified TOTP factor on the user via GoTrue admin API + force re-enrol via middleware Stage A.**
  - Why: SHA-256 is in Web Crypto (Deno + Node both) — no Argon2 dep. ~50 bits of entropy per code is plenty against a hashed-leak attacker. The "delete factor + re-enrol" recovery loop is the only correct path because Supabase's MFA API has no public way to upgrade AAL using a non-TOTP secret.
  - Impacts: migration `20260515132622_mfa_recovery_codes`, `apps/functions/mfa-codes-issue/`, `apps/functions/mfa-codes-consume/`, `apps/admin/app/2fa/{enroll,recovery,verify}/*`, `apps/admin/middleware.ts FUNNEL_PATH_PREFIXES + Stage B`.
  - Status: Locked. Admin-driven "Reset MFA on another admin" UI deferred to Phase 12 (depends on admin-management page).

## Attendance

- **D-205 (2026-06-01):** Ad-hoc sessions are surfaced to teachers as **"offline classes"** and gain a teacher-given **`sessions.title`** plus a **date + start-time picker** (not just "now"). Both the offline (`is_live_class=false`) and live (`is_live_class=true`) create flows go through `session-create-ad-hoc`, which now carries `title`. Attendance for these classes works exactly as for materialized sessions — QR (`attendance-qr-verify`) or manual roster (`attendance-manual-mark`/`-bulk-mark`/`-unmark`), neither of which requires the class to be live.
  - Why: the institute runs offline classes that still need rotating-QR + manual attendance; teachers needed to name a class so students recognise it, and to schedule it ahead.
  - Decisions: `title` is `text` **nullable** in the DB (materialized recurring sessions have none) with `check (title is null or char_length(btrim(title)) between 1 and 120)`; **required in the create UI**; the edge fn validates it **inline from the request body** (not via `_shared/schemas.ts`) so the fn rolls out independently of every consumer of the shared schema. Display everywhere uses `sessionDisplayName(title, subject_name)` → `title || subject || "Class"`. Web anchors the picker to IST (`+05:30`); mobile reuses the exam-builder ScrollView picker (device-local wall clock labelled IST), matching existing mobile convention.
  - Impacts: migration `20260601120000_sessions_title.sql`; `session-create-ad-hoc` + `_shared/schemas.ts`; web (`SessionCreateSheet`, `session-schedule.ts`, `lib/session-name.ts`, teacher/student/roster/attendance/live/recording surfaces); mobile (`AdhocSheet`, `ScheduleLiveSheet`, `ClassDateTimePicker`, `lib/session-name.ts`, same surfaces); admin attendance matrix. `spec/attendance.md`.
  - Follow-up (not done): the `student_dashboard`/`teacher_dashboard` SQL fns still build their "Up next" + "today" `subject` from `coalesce(subject_name, 'Class')`; wiring `title` in needs a tested rewrite of those SECURITY DEFINER fns (deferred — primary surfaces already show the title).
  - **Deployed & LIVE (2026-06-01):** migration applied to prod (`fynestudy-dev` ledger version `20260601014957`); `session-create-ad-hoc` edge fn at v4 carrying `title`; web + admin live via `main` (commit `da5a048`). Post-DDL advisors: 0 ERROR (only the pre-existing accepted SECURITY DEFINER + leaked-password WARNs). The repo migration file is now idempotent so a fresh `db push` won't conflict with the already-applied column.
  - Status: Locked.

- **D-030 (2026-05-14):** **Rotating QR**, 30-second HMAC-signed token. Student displays, teacher scans.
  - Why: defeats screenshot-and-share; replay-impossible.
  - Impacts: `attendance-qr-sign` + `attendance-qr-verify` edge fns. `spec/attendance.md`.
  - Status: Locked.

- **D-031 (2026-05-14):** Replay protection via DB **unique constraint** `(session_id, student_id)`.
  - Why: cheap and absolute; no race conditions.
  - Status: Locked.

- **D-032 (2026-05-14):** **Manual roster mark** as fallback alongside QR.
  - Why: phones die, students lose connectivity; no demo-fragile single path.
  - Impacts: `(teacher)/roster/[sessionId].tsx`.
  - Status: Locked.

- **D-033 (2026-05-14):** Scan window: **15 min before scheduled start → 15 min after scheduled end**.
  - Why: covers slightly early arrivals and slightly delayed marks; rejects mass post-hoc fraud.
  - Status: Locked.

- **D-034 (2026-05-14):** Status bands: **on-time** ≤ start+10min, **late** ≤ start+30min, else **absent**.
  - Why: human-friendly thresholds.
  - Status: Locked.

- **D-035 (2026-05-14):** **No geofencing** for MVP.
  - Why: GPS friction; demo fragility; phones in basements; outdoor classes; not worth it.
  - Impacts: `spec/attendance.md §2`.
  - Status: Locked. Revisit phase 2+.

- **D-036 (2026-05-14):** **No half-day attendance.** Statuses are `present | late | absent`.
  - Why: not common in test-prep institutes; can add later.
  - Status: Locked.

- **D-037 (2026-05-14):** **Ad-hoc sessions** are first-class. Teacher creates one for makeup classes, etc.
  - Why: institutes run makeup and special sessions all the time.
  - Impacts: `sessions.is_ad_hoc`, `(teacher)/classes.tsx`.
  - Status: Locked.

- **D-038 (2026-05-14):** Attendance **corrections require a reason**, written to `attendance_corrections`, surfaced in audit log.
  - Why: prevents quiet grade-rigging.
  - Status: Locked.

## Live Classes & Recordings

- **D-040 (2026-05-14):** Live streaming = **YouTube Live Unlisted broadcasts**, wrapped in `react-native-youtube-iframe` with custom chrome.
  - Why: free, India CDN, infinite scale, auto-recording. Trade-offs (10–20s latency, no in-app screen-share, YT ID extractable by determined attackers) accepted and documented.
  - Impacts: `spec/youtube-live-stream.md`.
  - Status: Locked. Supersedes earlier 100ms SFU plan.

- **D-041 (2026-05-14):** **One institute YT channel** for all live classes.
  - Why: single point of OAuth + branding consistency.
  - Status: Locked.

- **D-042 (2026-05-14):** YT video IDs **never** leave the server in normal UX. Clients receive HMAC-signed playback payloads from `yt-playback-sign` edge fn.
  - Why: makes casual link-sharing useless; raises bar for leak.
  - Status: Locked.

- **D-043 (2026-05-14):** **Auto-recording** — the YT live broadcast IS the recording.
  - Why: no separate recording pipeline; instant replay.
  - Status: Locked.

- **D-044 (2026-05-14):** **Custom chat** via Supabase Realtime, persisted in `chat_messages`. YT chat is disabled on the broadcast.
  - Why: full moderation control; replay in sync with recording.
  - Impacts: `spec/youtube-live-stream.md §9`.
  - Status: Locked.

- **D-045 (2026-05-14):** **Watermark** on every playback: `"{full_name} • ••••{phone_last_4}"`, alpha 0.25, rotating position every 60 seconds.
  - Why: deters leak; identifies leaker if it happens.
  - Status: Locked.

- **D-046 (2026-05-14):** **One host per live class** (no co-hosts).
  - Why: simpler schema and OBS workflow; can add later.
  - Status: Locked.

- **D-047 (2026-05-14):** Chat **replays in sync** during recording playback.
  - Why: discussions during a live class are valuable context for the replay.
  - Status: Locked.

- **D-048 (2026-05-14):** Teacher streams **via OBS or Streamlabs** to the YT RTMP ingest URL. App provides ingest URL + stream key, not in-app capture.
  - Why: in-app capture is unreliable, low-quality, and battery-killing; teachers already use OBS.
  - Status: Locked.

- **D-190 (2026-05-22):** Pinned announcements and the end-of-class signal are carried as `chat_messages` rows (`kind` = `announcement` / `system`) over the RLS-scoped chat channel — not a separate Realtime broadcast.
  - Why: batch isolation comes free from the `cm_read` policy; the end signal is server-authoritative (`yt-broadcast-stop` inserts the `system` row via service role); everything is persisted + testable. Avoids private-channel auth setup.
  - Impacts: migration `live_chat`, `yt-broadcast-stop`, `useChatChannel`, live/recording screens.
  - Status: Locked. Refines D-044.

- **D-191 (2026-05-22):** `chat_messages.author_name`/`author_role` are denormalized by a `SECURITY DEFINER` BEFORE-INSERT trigger that also enforces a 5-messages/30s rate limit for `kind='chat'`.
  - Why: students can't read batch-mates' `app_users` rows (joining would force broadening PII RLS — see D-152); the trigger also makes displayed identity unspoofable and keeps chat a low-latency direct PostgREST insert (no edge-fn round-trip). EXECUTE revoked from client roles (D-189 pattern).
  - Impacts: migration `chat_message_trigger`, `useChatChannel`.
  - Status: Locked.

- **D-192 (2026-05-22):** Live-class lifecycle is create → **golive** → stop, with a dedicated `yt-broadcast-golive` edge fn that flips `sessions.status='live'`.
  - Why: the student live screen + `yt-playback-sign` live branch gate on `status='live'`, but teachers have no direct `sessions` UPDATE (RLS is admin-only), so a server fn must set it. golive + stop tolerate YouTube-unconfigured (still mutate session state) so the flow is testable without YT.
  - Impacts: `yt-broadcast-golive`, teacher `live-control`, `sessions` status flow.
  - Status: Locked.

- **D-193 (2026-05-22):** The RTMP stream key is never persisted in the DB; `yt-broadcast-create` is idempotent and re-fetches the key from YouTube via `liveBroadcasts.contentDetails.boundStreamId → liveStreams.cdn.ingestionInfo`.
  - Why: honors the "stream key reaches only the creating teacher, never persisted" hard rule; needs no new `sessions` columns (reuses the Phase-4 `yt_broadcast_id`/`yt_video_id`).
  - Impacts: `yt-broadcast-create`, `_shared/yt-api.ts`.
  - Status: Locked.

- **D-194 (2026-05-22):** The full-screen WebView screens `live/[sessionId]`, `recording/[sessionId]`, `live-control/[sessionId]` are top-level Stack routes outside the `(student)`/`(teacher)` tab groups (deleted the old `live-session.tsx`).
  - Why: mirrors D-169/D-157 (video, exam screens); a WebView player inside a tab group fights the tab bar + blur lifecycle. Reconciles the phase-9.md draft, which placed them under the tab groups.
  - Impacts: `app/_layout.tsx`, `app/live/[sessionId].tsx`, `app/recording/[sessionId].tsx`, `app/live-control/[sessionId].tsx`.
  - Status: Locked.

- **D-195 (2026-05-22):** `_shared/yt-api.ts` returns a clean 503 "YouTube not configured" (via `YtNotConfiguredError`) whenever the `YT_*` Vault secrets are absent.
  - Why: Phase 9 ships before the multi-day YouTube channel + OAuth setup; deployed fns must degrade gracefully instead of 500-ing. `get_vault_secret` reads any name, so the same code picks up the secrets once provisioned (after a redeploy / instance recycle).
  - Impacts: `_shared/yt-api.ts`, `yt-broadcast-create/golive/stop`.
  - Status: Locked.

- **D-196 (2026-05-22):** `chat_bans` is in the Realtime publication, chat delete/ban go only through audited edge fns (no client UPDATE policy on `chat_messages`, no client write policy on `chat_bans`), and all live RLS uses `private.*` helpers.
  - Why: a banned student's composer disables instantly (they can read their own ban row via `cb_read`); routing mutations through edge fns guarantees `audit_log` capture (D-172). The phase-9.md §5.2 draft used `public.*` helpers — wrong for this project (helpers live in `private`).
  - Impacts: migration `live_chat_rls`, `chat-delete`, `chat-ban`, `useSessionState`.
  - Status: Locked.

- **D-197 (2026-05-22):** The composite leaderboard is computed by two `security_invoker = true` views (`leaderboard_weekly`, `leaderboard_alltime`) with SELECT revoked from anon/authenticated; the ONLY client path is the `my_batch_leaderboard` SECURITY DEFINER fn with an internal own-batch / teacher-of-batch / admin guard.
  - Why: `security_invoker` keeps the views off the `0010_security_definer_view` lint AND makes any direct read RLS-limited (no cross-batch leak); the guarded RPC is the mitigated surface (D-186 pattern) — it must stay in the PostgREST schema to be RPC-callable. Tie-breaker: composite → q_norm → quiz_count → full_name.
  - Impacts: `leaderboard_views`, `my_batch_leaderboard_fn`, `useLeaderboard`.
  - Status: Locked.

- **D-198 (2026-05-22):** All gamification logic lives in SQL DB fns (`evaluate_student_badges`, `leaderboard_weekly_rollover`) as the runtime source of truth; the `badge-evaluate` / `leaderboard-weekly-rollover` edge fns are thin admin wrappers; the feeders (quiz-submit, exam-submit, attendance-qr-verify, streak_recompute) call the DB fn inline best-effort (D-188). EXECUTE on both fns is revoked from `authenticated` (service_role/postgres only).
  - Why: one place to maintain the predicates; revoking EXECUTE closes the self-award hole (an authenticated user must not award themselves). `packages/shared/src/constants/leaderboard.ts` mirrors the weights/thresholds for the unit tests + mobile copy (SQL can't import TS — kept in sync).
  - Impacts: `evaluate_student_badges_fn`, `leaderboard_weekly_rollover_fn`, `streak_recompute_badge_sweep`, the 3 feeders, `packages/shared/src/constants/leaderboard.ts`.
  - Status: Locked.

- **D-199 (2026-05-22):** `comeback` is awarded only when the student holds a CURRENT 7+ day streak AND has an earlier (now-broken) ≥7-day activity-day run (detected by gaps-and-islands over `activity_days`). Never on a first-ever streak.
  - Why: the spec's "restored a streak after a reset" must not false-fire for someone reaching 7 for the first time (risks table).
  - Impacts: `evaluate_student_badges`, `badgeEvaluators.comeback` (shared constants).
  - Status: Locked.

- **D-200 (2026-05-22):** The 11 badge icons are PLACEHOLDER flat-SVG art (colour disc + short glyph, one per code) in the private `badge-assets` bucket, fetched via the `badge-icon-sign` edge fn signed URL (D-171 pattern) and rendered with `react-native-svg`'s `SvgUri`. Final designed art is deferred to Phase 12.
  - Why: no designer asset pack for the MVP; private bucket + signed URL honors the "all buckets private" rule; `SvgUri` is already available (lucide depends on react-native-svg). Re-run `pnpm upload:badge-assets` to swap art.
  - Impacts: `storage_badge_assets`, `badge-icon-sign`, `scripts/upload-badge-assets.ts`, `BadgeIcon`.
  - Status: Locked (placeholder).

- **D-201 (2026-05-22):** The leaderboard tap-row public card (name + batch + streak + badges only) is served by a `student_public_card` SECURITY DEFINER fn with a same-batch / teacher / admin guard — NOT by direct table reads.
  - Why: a student cannot read a peer's `streaks` / `badge_earnings` directly (RLS), so a guarded fn is the privacy-safe way to expose the limited public fields; no other PII (email/phone/DOB) is ever returned.
  - Impacts: `student_public_card_fn`, `fetchStudentCard`, leaderboard public card modal.
  - Status: Locked.

- **D-202 (2026-05-22):** The leaderboard Attendance factor (A) is normalized over days-since-join (weekly = min(7, days enrolled); all-time = days enrolled) for fairness to recent joiners (spec §3.6); the weekly rollover is idempotent via `UNIQUE(batch_id, period_start)` on `leaderboard_snapshots` (D-106).
  - Why: a student who joined 2 days ago shouldn't be penalized to 2/7 attendance; running the Sunday cron twice must not double-award or duplicate the snapshot.
  - Impacts: `leaderboard_views`, `leaderboard_snapshots`, `leaderboard_weekly_rollover`.
  - Status: Locked.

## Quizzes vs Exams

- **D-050 (2026-05-14):** **Practice Quizzes and Exams are distinct features** with separate tables, screens, and edge fns.
  - Why: stakes and UX differ enough that one merged feature would be a mess.
  - Impacts: `spec/practice-quizzes.md`, `spec/examinations.md`.
  - Status: Locked.

- **D-051 (2026-05-14):** Practice quizzes: **unlimited retakes**, pausable, full solution view after submit (correct + explanation + related video link).
  - Why: low-stakes learning tool.
  - Status: Locked.

- **D-052 (2026-05-14):** Exams: **server-enforced timer**, synchronized start, hard cut, late entry gets remaining time only.
  - Why: integrity; uncheatable by client clock manipulation.
  - Status: Locked.

- **D-053 (2026-05-14):** **Marking scheme is per-quiz/exam configurable** by the teacher (default +4/-1/0).
  - Why: institutes vary; sometimes practice is +1/0.
  - Status: Locked.

- **D-054 (2026-05-14):** Question and option **randomization on by default**, toggleable.
  - Why: harder to share specific Q-by-Q answers; per-student snapshot stored.
  - Status: Locked.

- **D-055 (2026-05-14):** **Tab-switch logging during exams**, but **no auto-submit** on switch.
  - Why: visible signal to teacher without nuking a student who got a phone call.
  - Status: Locked.

- **D-056 (2026-05-14):** Exam results **released manually by teacher** by default. Instant-release is opt-in.
  - Why: prevents leakage while the exam window is still open for stragglers.
  - Status: Locked.

- **D-057 (2026-05-14):** Single **question bank** reused across quizzes and exams, tagged by topic.
  - Why: teachers don't want to re-type questions.
  - Impacts: `questions`, `question_options`, `question_solutions`.
  - Status: Locked.

- **D-058 (2026-05-14):** Question content supports **images + KaTeX**.
  - Why: STEM requires diagrams + equations.
  - Status: Locked.

- **D-059 (2026-05-14):** **Offline test scores** entered by teachers manually for pen-paper tests; feed mastery and parents' report.
  - Why: institutes still run paper tests for major assessments.
  - Impacts: `offline_test_scores` table, `(teacher)/offline-scores.tsx`.
  - Status: Locked.

## Study Material Library

- **D-060 (2026-05-14):** Videos hosted on **YouTube Unlisted** (same channel as live classes), wrapped the same way.
  - Why: free transcoding, India CDN, single playback infra.
  - Status: Locked.

- **D-061 (2026-05-14):** PDFs in **Supabase Storage**, private bucket, signed URL only, **in-app reader only**.
  - Why: keeps PDFs out of WhatsApp forwards; no download affordance.
  - Status: Locked.

- **D-062 (2026-05-14):** **Watermark on PDFs** (per-page client-side overlay, alpha 0.20, rotated).
  - Why: same logic as video watermarks.
  - Status: Locked.

- **D-063 (2026-05-14):** Limits: **PDF ≤ 50 MB**, **video length ≤ 3 h**.
  - Why: reasonable for coaching content.
  - Status: Locked. Revisit if a teacher complains.

- **D-064 (2026-05-14):** **Notes = uploaded PDF** for MVP; in-app rich-text deferred.
  - Why: reduces scope; teachers already make notes as PDFs.
  - Status: Locked.

- **D-065 (2026-05-14):** Default content visibility = **uploader's batch**. Admin can promote to course-wide.
  - Why: avoids accidental cross-batch leaks of work-in-progress material.
  - Status: Locked.

## Mastery, Leaderboard, Gamification

- **D-070 (2026-05-14):** Mastery = **rolling average of last 5 submitted attempts per topic** (quiz + exam combined).
  - Why: easy to explain, easy to compute, responsive to recent performance.
  - Impacts: `mastery-recompute` edge fn; `packages/shared/constants/mastery.ts` (`ROLLING_N = 5`).
  - Status: Locked.

- **D-071 (2026-05-14):** Composite leaderboard score = **0.60 × Q + 0.25 × A + 0.15 × S** (Quiz/Exam normalized, Attendance normalized, Streak normalized).
  - Why: rewards score-getting most, but doesn't ignore consistency.
  - Impacts: `leaderboard_weekly` view; `packages/shared/constants/leaderboard.ts`.
  - Status: Locked.

- **D-072 (2026-05-14):** Leaderboard **scope = batch only**, with **Weekly + All-Time** tabs.
  - Why: comparison across batches is unfair (different courses, different teachers).
  - Status: Locked.

- **D-073 (2026-05-14):** Leaderboard displays **first name + last name + last 2 digits of phone** for disambiguation; **no opt-out**.
  - Why: transparency is the point; anonymity defeats accountability.
  - Status: Locked.

- **D-074 (2026-05-14):** Streak = **consecutive IST days** with at least one **meaningful action** (attendance / quiz / exam / video ≥50%).
  - Why: passive opens shouldn't count; encourages real engagement.
  - Status: Locked.

- **D-075 (2026-05-14):** **No streak freeze.** Miss a day → reset to 0.
  - Why: simpler and stricter; freezes invite gaming.
  - Status: Locked.

- **D-076 (2026-05-14):** **Badges are sticky** — once earned, never revoked.
  - Why: rewards should not be taken away.
  - Status: Locked.

- **D-077 (2026-05-14):** Starter badge catalogue listed in `spec/leaderboard-and-gamification.md §5.1`.
  - Why: enough to feel rewarding; not overwhelming.
  - Status: Locked. Easy to add more.

## Parents' Report

- **D-203 (2026-05-26):** **Phase 11 (Parents' WhatsApp Report) is SKIPPED for MVP.** The roadmap goes Phase 10 → Phase 12. The entire Gupshup/WhatsApp delivery path (D-080…D-085 below) is **deferred, not deleted**.
  - Why: removes the only hard external dependency with multi-day approval lead time (Gupshup Business + template approval) from the critical path to shipping the app to the Play Store; the report is a nice-to-have, not core to the coaching-OS loop.
  - Impacts: `students.parent_phone` stays **collected-but-unused**; `docs/spec/parents-report.md` is a deferred/unbuilt spec; the `parent-report-generate` / `whatsapp-send` / `gupshup-callback` / `whatsapp-retry` edge fns are not built. In Phase 12: treat the "Phase 11 accepted" prereq as "Phase 10 accepted", drop parents-report from the demo dry-run, and remove the WhatsApp-failure Sentry alert + Gupshup rollback step from `phase-12.md`.
  - Status: Locked (deferral). Revisit post-MVP. D-080…D-085 → Status: Deferred (Phase 11 skipped, D-203).

- **D-080 (2026-05-14):** **Weekly auto-send** Sunday 18:00 IST + on-demand by teacher/admin.
  - Why: weekly cadence is what parents actually read.
  - Status: Locked.

- **D-081 (2026-05-14):** Delivery via **Gupshup WhatsApp Business** template messages.
  - Why: India-native pricing, template approval friendly.
  - Status: Locked.

- **D-082 (2026-05-14):** **Email fallback** if WhatsApp delivery fails twice within 1 hour.
  - Why: never lose a report silently.
  - Status: Locked.

- **D-083 (2026-05-14):** Support **up to 2 parent phone numbers** per student.
  - Why: many families want both parents updated.
  - Status: Locked.

- **D-084 (2026-05-14):** PDF generated via **`pdf-lib`** inside a Supabase Edge Function.
  - Why: pure Deno, no third-party PDF service.
  - Status: Locked.

- **D-085 (2026-05-14):** PDF link in WhatsApp is a **24-hour signed Storage URL**.
  - Why: limits accidental forwarding lifetime.
  - Status: Locked.

## Admin Panel

- **D-090 (2026-05-14):** Admin panel is **web-only** (no mobile admin app).
  - Why: admins need spreadsheet-grade screens.
  - Status: Locked.

- **D-091 (2026-05-14):** Tech = **Next.js 15 (App Router) + Tailwind + shadcn/ui + Vercel**.
  - Why: shares types with mobile via Supabase generated types; fastest path to a competent admin UI.
  - Status: Locked.

- **D-092 (2026-05-14):** **Bulk CSV import** for students (and teachers).
  - Why: institute onboarding from existing spreadsheets.
  - Impacts: `spec/admin-panel.md §7.3`.
  - Status: Locked.

- **D-093 (2026-05-14):** Every admin **write action** writes an `audit_log` row with before/after JSON.
  - Why: traceability for grade-fixing, suspensions, deletions.
  - Status: Locked.

- **D-094 (2026-05-14):** **Owner vs Staff** admin split.
  - Why: separates billing/configuration from day-to-day ops.
  - Status: Locked.

## Backend Infrastructure

- **D-100 (2026-05-14):** **Supabase**, region **`ap-south-1` (Mumbai)**.
  - Why: data residency + lowest latency for Indian institute.
  - Status: Locked.

- **D-101 (2026-05-14):** **Two Supabase projects** — `fynestudy-dev` and `fynestudy-prod`.
  - Why: safe migration testing; clean cutover.
  - Status: Locked.

- **D-102 (2026-05-14):** **RLS enabled on every user-data table.** Anonymous reads return nothing.
  - Why: defense in depth; even buggy client code can't leak.
  - Status: Locked.

- **D-103 (2026-05-14):** **All privileged writes go through edge functions** (service-role). No client-side service-role usage.
  - Why: single auditable surface for sensitive mutations.
  - Status: Locked.

- **D-104 (2026-05-14):** HMAC secrets (QR, playback, parent-report links) **rotated quarterly**, with 24h grace.
  - Why: limits damage from a leaked secret.
  - Status: Locked.

- **D-105 (2026-05-14):** **Daily Postgres backup** + **PITR** at launch. 7-day retention on prod.
  - Why: standard for production data.
  - Status: Locked.

- **D-106 (2026-05-14):** Scheduled jobs via **pg_cron** + Supabase Edge Functions.
  - Why: built-in; no external scheduler service.
  - Status: Locked.

- **D-146 (2026-05-15):** RLS helper functions (`is_admin()`, `is_active()`, `current_app_user_id()`, etc.) live in a **`private` schema**, not `public`.
  - Why: Supabase advisor lints `0028` / `0029` flag SECURITY DEFINER functions in `public` because PostgREST auto-exposes them as RPC endpoints. Moving them to `private` (with `USAGE`/`EXECUTE` limited to `authenticated`) keeps them callable from RLS policies but invisible to the API.
  - Impacts: `supabase/migrations/20260514222506_harden_auth_helper_schema.sql`; every new RLS policy must reference `private.is_admin()` etc.
  - Status: Locked. Supersedes the original placement implied by `backend-architecture.md §5.2`.

## Security & Compliance

- **D-110 (2026-05-14):** **DPDP Act 2023 compliance** baked into the design.
  - Why: legal requirement in India.
  - Impacts: `spec/security.md §13`.
  - Status: Locked.

- **D-111 (2026-05-14):** **Parental consent** for minors captured at admission (admin attests).
  - Why: DPDP requirement for under-18 data principals.
  - Status: Locked.

- **D-112 (2026-05-14):** **Right to erasure** supported — cascade delete + anonymization of aggregates.
  - Why: DPDP requirement.
  - Status: Locked.

- **D-113 (2026-05-14):** **2-year retention** post-graduation/withdrawal, then anonymize.
  - Why: balances compliance with usefulness of aggregated stats.
  - Status: Locked.

- **D-114 (2026-05-14):** **No app-layer encryption** on PII columns.
  - Why: breaks RLS query patterns; over-engineering for the threat model; Supabase encrypts at rest.
  - Status: Locked.

- **D-115 (2026-05-14):** **Rate limits** on every public edge function (login, QR ops, exam submit, WhatsApp trigger, parent reports).
  - Why: standard hygiene.
  - Status: Locked.

- **D-116 (2026-05-14):** **No PII in Sentry events** — scrubbed via `Sentry.beforeSend`.
  - Why: don't leak personal data to error tracker.
  - Status: Locked.

- **D-117 (2026-05-14):** All **Storage buckets private**; access only via short-lived signed URLs (1h docs, 4h videos, 24h reports).
  - Why: prevents bucket-listing and link-sharing.
  - Status: Locked.

## Devices & UX

- **D-120 (2026-05-14):** **Both iOS and Android first-class** day one.
  - Why: students use both; Expo makes it free.
  - Impacts: `spec/performance.md`.
  - Status: Locked.

- **D-121 (2026-05-14):** Min OS = **Android 8.0+ / iOS 14+**.
  - Why: covers >95% of Indian student devices.
  - Status: Locked.

- **D-122 (2026-05-14):** **Tablet uses same layout** as phone (no separate tablet UI).
  - Why: scope; layouts scale acceptably.
  - Status: Locked.

- **D-123 (2026-05-14):** **Dark mode** kept.
  - Why: already implemented; students appreciate it.
  - Status: Locked.

- **D-124 (2026-05-14):** Target low-end device for perf budget = **Redmi 8A class** (Android 9, 2 GB RAM, Snapdragon 439).
  - Why: typical Indian coaching student device.
  - Impacts: `spec/performance.md`.
  - Status: Locked.

- **D-204 (2026-05-29):** `exam_attempts.question_snapshot` (which pins each question's `correct_option_id` at attempt start, D-052/D-180) is **revoked from `authenticated`/`anon`** at the column level; the answer key is never directly selectable by clients. Discovered during the web Phase-5 security review: RLS filters rows, not columns, and the student self-read policy on `exam_attempts` exposed the frozen answer key mid-exam via a direct PostgREST select. Migration `20260529120000_exam_attempts_hide_snapshot.sql` revokes the column and re-grants the other 13. The only legitimate non-grading reader — the teacher results board (web + mobile) — now reads keys through the new **`exam-answer-keys`** edge fn (teacher-who-owns-exam / batch-teacher / admin scoped, service-role read), mirroring `exam-release-results`'s authorization. Grading/regrade/result fns are unaffected (they already run as service_role). Mirrors the established pattern (students have no read policy on `question_options`, so `is_correct` is never client-readable there).
  - Why: closes a graded-exam answer-key leak; honours the Phase-5 "no answer-key leak" gate.
  - Impacts: `supabase/migrations/`, `apps/functions/exam-answer-keys/`, `apps/web/features/teacher/useExamResultsBoard.ts`, `apps/mobile/features/exam/useExamResultsBoard.ts`.
  - Status: Locked. Applied to prod + deployed 2026-05-29.

## Out of MVP (deferred / rejected)

- **D-130 (2026-05-14):** **Razorpay payments / fees** — deferred to post-MVP.
- **D-131 (2026-05-14):** **Push notifications** — deferred to phase 3.
- **D-132 (2026-05-14):** **Multi-branch / multi-tenant** — deferred indefinitely.
- **D-133 (2026-05-14):** **Offline downloads** — deferred (would require DRM consideration).
- **D-134 (2026-05-14):** **AI features** (explain question, recommended topics) — deferred.
- **D-135 (2026-05-14):** **In-class polls** — deferred.
- **D-136 (2026-05-14):** **Co-hosted live classes** — deferred.
- **D-137 (2026-05-14):** **Rich-text notes** — deferred (PDF only for MVP).
- **D-138 (2026-05-14):** **Parent login / parent app** — rejected.
- **D-139 (2026-05-14):** **Geofenced attendance** — rejected.
- **D-140 (2026-05-14):** **Streak freeze (Duolingo-style)** — rejected.
- **D-141 (2026-05-14):** **100ms SFU** for live classes — rejected (in favor of YouTube wrap; see D-040).
- **D-142 (2026-05-14):** **Phone OTP authentication** — rejected (in favor of email + password; see D-020). Existing OTP screens are dead code.
- **D-143 (2026-05-14):** **Self-service course selection by students** — rejected (admin pre-assigns; see D-004, D-016). Existing `select-course.tsx` becomes read-only "Your Course" widget or is removed.
- **D-144 (2026-05-14):** **OMR scanning of paper exams** — deferred.
- **D-145 (2026-05-14):** **WebRTC fallback** for sub-second live latency — deferred (revisit if students complain).

---

## How to add a new decision

1. Pick the next available `D-NNN` (gap-fill OK; just don't reuse).
2. Date it. Use Asia/Kolkata.
3. Write the rule in **one declarative sentence**.
4. Add a **Why** (the reasoning; future readers should not have to re-derive it).
5. List **Impacts** — which specs and files it touches.
6. Set **Status**: `Locked` is default. `Deferred` only if explicitly out of scope. `Superseded by D-NNN` only if overturned (keep both entries).

## How to overturn an old decision

Don't delete. Add a new dated entry that says:

> **D-200 (2026-09-01):** [new rule]
>  - Why: [new reasoning]
>  - Supersedes: D-NNN
>  - Impacts: [...]
>  - Status: Locked.

Then edit D-NNN to `Status: Superseded by D-200`.
