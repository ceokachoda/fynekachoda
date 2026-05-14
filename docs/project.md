# FyneStudy — Coaching OS

> A hybrid operating system for offline coaching institutes preparing students for JEE, NEET, and CUET. One mobile app for students and teachers, one web panel for admins, all backed by a single Supabase project. Attendance, live classes, study material, practice quizzes, graded exams, and parent communication — unified.

---

## 1. Vision

FyneStudy replaces the spreadsheets, WhatsApp groups, and standalone tools that coaching institutes patch together. Everything a student, teacher, or admin does day-to-day lives inside one product.

- **Students** prep with structured material, take self-paced practice quizzes, sit teacher-scheduled exams, attend live classes, and track their own mastery and rank.
- **Teachers** run classes, exams, and attendance from their phones; build the question bank; upload study material.
- **Admins** manage the institute from a web panel — users, batches, content, reports, audit log.
- **Parents** receive an automated weekly WhatsApp PDF report on attendance and test performance.

The product is mobile-first because that is how Indian coaching students work. The admin panel is web because admins need spreadsheet-grade screens.

## 2. Audience & Roles

| Role | Where they work | Primary outcomes |
|---|---|---|
| **Student** | Mobile app | Mark attendance, take quizzes, sit exams, attend live classes, watch recordings, browse material, see mastery + rank |
| **Teacher** | Mobile app (same binary, role-gated) | Scan QRs / mark attendance, author quizzes + exams, schedule + host live classes, upload material, enter offline scores, view batch performance |
| **Owner Admin** | Web panel | Everything below + manage other admins, billing settings, institute configuration |
| **Staff Admin** | Web panel | CRUD on students, attendance corrections, content moderation, report generation. No admin-management, no institute settings. |
| **Parent** | WhatsApp (no app login) | Receive weekly PDF report on child's attendance + scores |

A single human can hold multiple roles (e.g., owner-admin who also teaches). Roles are additive.

## 3. Org Model

```
Institute (single tenant for MVP)
├── Courses                  JEE Main / JEE Advanced / NEET UG / CUET UG (admin-editable)
│   └── Subjects             Physics, Chemistry, Biology, Mathematics, etc.
│       └── Chapters
│           └── Topics
│               └── { Videos, PDFs, Notes, Quizzes }   (content_items)
└── Batches                  e.g., "NEET 2027 Morning"
    ├── Course               (exactly one)
    ├── Teachers             (one or more)
    ├── Students             (capacity-capped; each student in exactly one batch)
    └── Sessions             scheduled or ad-hoc class meetings (drives attendance + live class link)
```

## 4. MVP Scope

### In MVP

- Email + password auth, admin-issued credentials, forced first-login password change
- Student dashboard — today's schedule, attendance %, mastery summary, current streak, next class
- QR attendance — student displays rotating QR; teacher scans. Manual roster mark as fallback.
- Live classes — Unlisted YouTube broadcasts wrapped in `react-native-youtube-iframe`, custom chat via Supabase Realtime, raise-hand queue, watermarked playback. Auto-saved as the same YT video for replay.
- Study material library — Course → Subject → Chapter → Topic → { Video | PDF | Note | Quiz }. Videos hosted on YouTube Unlisted. PDFs in Supabase Storage, in-app viewer only.
- Practice quizzes — self-paced, retakeable, configurable marking, view-solution flow with explanation + linked video.
- Exams — teacher-scheduled, server-enforced timer, synchronized start, hard cut, image + LaTeX questions, optional question randomization, teacher releases results.
- Offline test scores — teachers enter handwritten/pen-paper test scores per student, feed parents' report + mastery.
- Mastery dashboard — rolling average of last N=5 attempts per topic; student and teacher views.
- Batch leaderboard — weekly + all-time, composite (60% scores / 25% attendance / 15% streak).
- Gamification — streaks (active-day rule, no freeze) + badge collection.
- Parents' WhatsApp report — auto weekly + on-demand. Server-rendered PDF, sent via Gupshup template message. Email fallback if delivery fails.
- Admin panel — full CRUD on students, teachers, batches, courses, content, exams. Audit log viewer. Attendance corrections. On-demand parent reports.
- Teacher panel — in-mobile-app, role-gated. QR scanner, exam builder, content upload, live control, batch performance.
- Crash reporting (Sentry) + product analytics (PostHog).
- Audit log on all admin write actions.

### Out of MVP (deferred)

- Razorpay payments / fee management
- Push notifications (Expo Notifications)
- Multi-branch / multi-tenant
- Offline downloads (PDF / video)
- AI features (explain question, recommended topics)
- In-class polls
- Co-hosted live classes
- In-app rich-text notes (uploaded PDF only)
- Parent login
- Pen-paper exam OMR scanning
- Webinar-style external attendees

## 5. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile | React Native 0.81 + Expo SDK 54 | iOS + Android from one codebase; New Architecture on; works perfectly on both |
| Routing | Expo Router 6 (file-based) | Already in place; deep links + role-gated layouts |
| Styling | NativeWind 4 + Tailwind CSS 3 | Already in place; tokens shared with admin panel |
| Mobile build | EAS Build (managed workflow) + EAS Update | Cloud-built binaries; OTA hotfixes without store review |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) | Single vendor; RLS-first; `ap-south-1` (Mumbai) region |
| Edge runtime | Deno (Supabase Edge Functions) | Bundled with Supabase, low cold start |
| Live stream | YouTube Live (Unlisted) + `react-native-youtube-iframe` wrap | Free, infinite scale, India CDN, auto-recording |
| Realtime (chat + raise-hand) | Supabase Realtime (Postgres + presence channels) | Included with Supabase; no extra service |
| PDF generation | `pdf-lib` inside a Supabase Edge Function | Pure Deno, no third-party PDF service to procure |
| WhatsApp | Gupshup WhatsApp Business API | India-native, ~₹0.42 / business-initiated message, template approvals friendly |
| Admin panel | Next.js 15 (App Router) + Tailwind + shadcn/ui | Server components for fast tables; types shared via `packages/supabase-types` |
| Admin deploy | Vercel | Auto-deploy from `main`; preview deployments on PR |
| Crash reporting | Sentry (free tier) | Standard, supports RN + Next |
| Analytics | PostHog Cloud (free tier) | India-friendly, OSS, session replay later if needed |
| CI | GitHub Actions | Lint + typecheck + test + build check on every PR |
| Mobile package mgr | pnpm (monorepo workspace) | Already in place; fast, deterministic |
| Math rendering | KaTeX via WebView for mobile, native for admin | Required for STEM exam questions |
| PDF viewer | `react-native-pdf` | In-app only, no external opener |
| Crypto (QR + playback signing) | HMAC-SHA256 with secret rotated quarterly | Stateless verification on edge |
| Device secure storage | `expo-secure-store` (Android Keystore / iOS Keychain) | Refresh tokens never touch AsyncStorage |
| Auth MFA | Supabase MFA (TOTP) | Required for admin role |
| Domain | `fynestudy.<tld>` (TBD) with `admin.` subdomain | Branded, decoupled from Supabase project URL |

## 6. Module Map

### Student-facing (mobile)

1. **Authentication** — login, force-password-change, forgot-password
2. **Dashboard** — schedule strip, attendance ring, mastery summary, streak flame, next class CTA
3. **Attendance** — QR display (rotating 30s tokens), attendance history
4. **Library** — Subjects → Chapters → Topics; PDF reader, wrapped video player
5. **Practice Quizzes** — start, attempt, auto-save, submit, view solution + linked video
6. **Exams** — list of scheduled / live / completed, take exam (locked-down), wait for results
7. **Live Classes** — list of live / upcoming / recorded, in-class screen with chat + raise hand, recording screen with chat replay
8. **Leaderboard** — weekly + all-time, batch-scoped
9. **Profile** — stats, badges collection, streak, app settings
10. **Menu / Settings** — change password, logout, support, privacy

### Teacher-facing (mobile, role-gated)

1. **Teacher Dashboard** — today's classes, pending tasks (release results, ungraded offline scores)
2. **Attendance Scanner** — camera-driven QR scan + roster fallback
3. **Class Control** — schedule live class (creates YT broadcast), go-live screen with chat moderation, end class, view recording
4. **Quiz Builder** — author questions, set marking + duration, publish to topic
5. **Exam Builder** — author + schedule, configure timer, release results
6. **Question Bank** — browse + reuse questions tagged by topic
7. **Content Upload** — upload PDFs, link YT video lessons, set scope (batch / course)
8. **Offline Scores** — per-batch table for entering pen-paper test marks
9. **Batch Dashboard** — attendance heatmap, topic mastery breakdown, students at risk

### Admin-facing (web)

1. **Overview** — institute KPIs, system alerts, recent audit feed
2. **Students** — CRUD, bulk import, suspend, reset password, view full history
3. **Teachers** — CRUD, batch assignments
4. **Admins** — CRUD (owner-only), role/scope management
5. **Batches** — CRUD, schedule, capacity, student transfer
6. **Courses** — CRUD, curriculum (Subjects → Chapters → Topics)
7. **Content** — moderate teacher uploads, course-wide promotion
8. **Exams** — cross-batch oversight, regrades
9. **Attendance** — corrections with reason + audit
10. **Reports** — institute-wide attendance / exam reports, ad-hoc parent PDFs
11. **WhatsApp** — Gupshup template registry, send log, delivery callback errors
12. **Audit Log** — filter by actor, table, action, time range
13. **Settings** — institute name, branding, timezone, term dates, 2FA enforcement

### Backend services (Supabase Edge Functions)

| Function | Trigger | Purpose |
|---|---|---|
| `auth-bootstrap` | Admin web action | Create Supabase user, assign role, send initial credentials email |
| `yt-broadcast-create` | Teacher / admin scheduling a class | Call YouTube Data API v3 to create an Unlisted live broadcast tied to institute's channel |
| `yt-playback-sign` | Mobile client request | Verify caller has access to the class, return a one-shot signed playback config (never the raw YT URL) |
| `attendance-qr-sign` | Mobile student request, polled every 30s | HMAC-sign a `(student_id, class_id, expires_at)` payload, return the QR payload |
| `attendance-qr-verify` | Teacher scanner submit | Verify HMAC + freshness + replay protection, mark attendance |
| `exam-submit` | Mobile client submit | Server-enforced timer check, grade MCQs, write result |
| `mastery-recompute` | DB trigger on quiz/exam attempt + nightly cron | Recompute rolling-5 mastery per `(student, topic)` |
| `whatsapp-send` | Trigger from app or internal | Send a templated WA message via Gupshup, log delivery, handle callback |
| `parent-report-generate` | Weekly cron + admin on-demand | Render per-student PDF, queue WA sends |
| `streak-recompute` | Nightly cron | Tick streaks, freeze on miss, award badges |
| `audit-log-cleanup` | Quarterly cron | Anonymize audit rows past retention window |

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Total students at launch | ~600 |
| Peak concurrent in a live class | ~250 simultaneous viewers (YT scales beyond) |
| Cold app start | < 3s on a mid-tier Android 8 device |
| Screen transition on cached data | < 200ms |
| App bundle size | < 35 MB OTA delta, < 80 MB store |
| RLS coverage | 100% — every user-data table has policies |
| Audit coverage | 100% on admin write actions |
| Daily backup | Supabase managed daily Postgres backup (7-day retention on prod) |
| Region | `ap-south-1` (Mumbai) for both Supabase projects |
| Uptime target | 99.5% (single-region MVP) |
| Mean exam-submit latency | < 800 ms p95 |
| WhatsApp report delivery | < 2 minutes p95 from trigger to message receipt |

## 8. Security Posture (Summary)

Detailed controls live in `spec/security.md`. High-level guarantees:

- **Auth** — Supabase Auth, email + password, bcrypt at rest. JWT access tokens (1h), refresh tokens stored in `expo-secure-store`. 30-day rolling refresh.
- **MFA** — TOTP required for admin role, optional for teacher, off for student.
- **Account lockout** — 5 failed password attempts → 15-minute lockout (per email + per IP).
- **RLS** — every user-data table has SELECT/INSERT/UPDATE/DELETE policies. No service-role calls from clients. Edge functions are the only path to elevated DB ops.
- **Storage** — every bucket private. Access only via short-lived signed URLs (1h docs / 4h videos).
- **QR replay protection** — one successful scan per `(student_id, session_id)` enforced server-side. Tokens HMAC-signed and 30s-bound.
- **Live class URL** — YT video ID never leaves the server; `yt-playback-sign` returns a payload the wrapped player consumes directly.
- **Rate limits** — login, QR sign/verify, exam submit, WhatsApp trigger, password reset.
- **Audit log** — every admin write captured with actor, before/after diff, timestamp, IP.
- **DPDP Act 2023** — consent at admission, parental consent for minors (admin attests), right-to-be-forgotten, 2-year retention then anonymize.
- **PII** — phone, parent phone, DOB stored in Postgres, RLS-protected, at-rest encrypted by Supabase. No app-layer crypto.

## 9. Demo Strategy

The client demo is the project's first hard milestone. The demo must look boringly reliable.

**Demo flow (~10 min):**

1. Open app → log in as a pre-baked student → land on dashboard.
2. Show today's schedule, attendance %, current streak, mastery snapshot.
3. Open attendance → rotating QR display.
4. Switch device → log in as teacher → scanner → scan student's QR → attendance marked.
5. Back on student → library → pick a chapter → play a video lesson (wrapped YT).
6. Start a practice quiz → answer 5 questions → submit → view solution with explanation + related video.
7. Join a live class (pre-staged) → chat + raise-hand demonstrated.
8. Switch to admin panel (web) → student list → drill into a student → attendance history + exam scores → "Send Parent Report Now" → WhatsApp PDF arrives.

**Seed data:** 30 students, 4 teachers, 3 batches across 2 courses (NEET 2027 Morning, JEE Main 2027 Evening), 50 quizzes, 10 sample videos, 1 scheduled live class, 1 completed exam with released results.

**Pre-baked demo accounts** with realistic data:
- `student.demo@fynestudy.in` / shown on screen
- `teacher.demo@fynestudy.in` / shown on screen
- `admin.demo@fynestudy.in` / shown on screen

## 10. Glossary

- **Course** — exam preparation track (JEE Main, JEE Advanced, NEET UG, CUET UG). Admin-editable.
- **Batch** — a specific cohort within a course (e.g., "NEET 2027 Morning"). Students belong to exactly one batch.
- **Session** — a single scheduled or ad-hoc meeting of a batch. Drives attendance and live class linking.
- **Subject** — top-level grouping of content under a course (e.g., Physics).
- **Chapter** — a unit within a subject (e.g., Kinematics).
- **Topic** — a sub-unit within a chapter (e.g., Projectile Motion). Mastery tracked at this level.
- **Content Item** — a single addressable resource: a video lesson, a PDF, a note, or a quiz.
- **Quiz** — self-paced, retakeable, chapter- or topic-bound MCQ set. Has full view-solution flow.
- **Exam** — teacher-scheduled, timed, synchronized-start, hard-cut MCQ test. Auto-graded.
- **Question Bank** — pool of MCQs tagged by `(subject, chapter, topic, difficulty)`. Reused across quizzes and exams.
- **Mastery** — per-topic rolling average of the student's last 5 graded attempts (quiz + exam).
- **Streak** — number of consecutive active days. Active day = app opened + at least one meaningful action.
- **Meaningful action** — attendance marked, quiz submitted, exam submitted, OR video watched >50%.
- **Wrapped YT** — `react-native-youtube-iframe` configured to hide YT chrome, overlay watermark, and consume server-issued playback payloads instead of raw URLs.
- **Owner Admin** — full-access admin who can manage other admins and institute settings.
- **Staff Admin** — operational admin; cannot manage other admins or change institute settings.
- **Service-role key** — Supabase elevated key. Only used by edge functions, never shipped to clients.

## 11. Out-of-Scope Decisions (Recorded)

These were debated and explicitly excluded from MVP:

- **Live stream via 100ms SFU** — rejected in favor of YouTube wrap (cost, scale, recording).
- **Phone OTP auth** — rejected; existing OTP UI will be replaced by email + password.
- **Course selection by student** — rejected; admin pre-assigns batch + course at admission. `select-course.tsx` becomes a read-only "Your Course" widget or is removed.
- **Razorpay payments** — deferred. Membership status tracked but no in-app payment.
- **Parent app login** — rejected. WhatsApp PDF only.
- **In-app rich-text notes** — deferred. PDF upload only for MVP.
- **Geofenced attendance** — rejected. Friction risk and demo fragility.
- **Streak freeze** — rejected. Hard reset on miss.

## 12. Decision Owners

| Topic | Owner |
|---|---|
| Product scope | Founder / Client |
| Engineering decisions | Founder + AI agent |
| Branding | Founder |
| WhatsApp template wording | Founder |
| Course curriculum | Subject-matter teachers (post-admission) |
| Exam scheduling | Teacher per batch |
| Admin staffing | Owner |
