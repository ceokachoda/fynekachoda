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

## Attendance

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
