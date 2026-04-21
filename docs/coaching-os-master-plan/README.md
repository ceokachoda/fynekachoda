# Coaching OS — Master Plan

Working title: **Coaching OS** (product brand: FyneStudy Live).
Purpose: hybrid coaching-institute operating system covering student app, QR attendance, live classes, recorded content, clips, study materials, memberships, notifications, and admin/teacher ops.

This folder is the implementation-grade plan. Any developer or AI coding agent should be able to start building Phase 1 directly from these docs without re-asking product questions.

---

## 1. Product in one paragraph

An institute-branded mobile app that lets students log in, see today's classes, mark attendance by showing a rotating QR to staff, join live classes inside the app, rewatch recordings, download/read study materials, and pay/renew membership. Teachers schedule and host live classes, upload materials, and clip highlight segments from recordings. Admins run everything from a web panel: users, batches, courses, content moderation, attendance override, payments, announcements, reports.

---

## 2. Recommended stack (short form)

| Layer | Choice | Rationale |
|---|---|---|
| Student app | **React Native + Expo (managed workflow, dev clients)** + TypeScript | Single codebase Android/iOS, Expo ecosystem covers QR, camera, notifications, media, OTA updates. Dev clients unlock any native module we need. |
| UI styling | **NativeWind (Tailwind for RN)** + Expo Router | Fast iteration, consistent design tokens, premium feel on Android. |
| State / data | **TanStack Query** for server state + **Zustand** for local UI state | Minimal boilerplate, excellent cache/invalidation, realtime-friendly. |
| Admin/teacher panel | **Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind** on Vercel | Desktop-class workflows (tables, uploads, reports) are miserable in RN. Same Supabase backend. |
| Backend-as-a-Service | **Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)** | Biggest leverage per engineer-hour. Postgres + RLS gives a real relational model with role-based access without hand-rolling an auth server. |
| Live classes | **100ms.live** (MVP) with migration path to **LiveKit Cloud** | Mumbai POP, India-tuned SFU, SDKs for React Native + Web, built-in recording, Razorpay-friendly INR billing. |
| Video storage + playback | **Bunny Stream** (HLS, per-GB cheap in India, signed URLs, token auth) | Cheaper and faster in India than Mux/Cloudflare Stream for our volume, supports clipping. |
| Object storage (PDFs, images) | **Supabase Storage** (S3-compatible under the hood) | Integrates with RLS; signed URLs for access control. |
| Payments | **Razorpay** (subscriptions + one-time) | Standard in India, UPI/cards/netbanking, good webhooks, invoice generation. |
| Push notifications | **Expo Notifications** → APNs + FCM | Works on managed Expo, token storage in Supabase, Edge Function fanout. |
| Background jobs | **Supabase Edge Functions** + **pg_cron** + **Supabase Queues (pgmq)** | Scheduled reminders, webhook processing, signed-URL refresh, no separate worker infra for MVP. |
| Observability | **Sentry (RN + Next.js + Edge Functions)**, **Supabase logs + Logflare**, **PostHog** for product analytics | Covers crashes, backend logs, funnels. |
| CI/CD | **GitHub Actions** + **EAS Build/Submit** + **Vercel** | Standard, free tier sufficient for MVP. |

Full reasoning and rejected alternatives: see `BACKEND-ARCHITECTURE.md` and `FRONTEND-ARCHITECTURE-REACT-NATIVE.md`.

---

## 3. Why React Native for the student app

1. **One codebase, two stores.** The institute must reach every student phone; Android dominates in India but the owner and some students will be on iOS. A native-per-platform team is not justified at MVP cost.
2. **Camera + QR + push + video are all first-class in Expo.** `expo-camera`, `expo-barcode-scanner`, `expo-notifications`, `expo-av` / `react-native-video`, `expo-file-system` cover almost everything we need without ejecting.
3. **Premium feel is achievable.** With NativeWind + Reanimated + Moti + good typography, the demo-critical student UI can match native feel — this is the single most important visual deliverable for the client.
4. **OTA updates via EAS Update** let us patch the demo build without resubmission — invaluable during the client sales cycle.
5. **Dev clients** give us escape hatches (e.g., LiveKit/100ms native SDK, advanced QR libraries) without losing Expo's DX.

We explicitly **do not** use React Native for the admin/teacher panel — see `FRONTEND-ARCHITECTURE-REACT-NATIVE.md` §2.

---

## 4. Why Supabase for the backend

Finalists we considered: Supabase, Firebase, Node/NestJS + Postgres on a VPS, Appwrite.

Ranked summary (full table in `BACKEND-ARCHITECTURE.md`):

| Concern | Supabase | Firebase | Node/NestJS + PG | Appwrite |
|---|---|---|---|---|
| Relational data (batches, enrollments, payments) | ✅ Postgres | ❌ Firestore forces denormalization | ✅ | ⚠️ MariaDB, weaker |
| Row-level auth rules | ✅ RLS policies in SQL | ⚠️ security rules DSL | ❌ hand-rolled | ⚠️ limited |
| Realtime (live class presence, attendance updates) | ✅ Postgres CDC | ✅ | ❌ build it | ⚠️ |
| File storage with signed URLs | ✅ | ✅ | build it | ✅ |
| Time-to-MVP | **Fastest** | Fast | Slow | Medium |
| Cost at MVP | Free → ₹2k/mo | Free → unpredictable | ₹1.5k+ VPS + ops | Free/self-host |
| Lock-in risk | Low — standard Postgres; can self-host | High — Firestore semantics | None | Medium |

**Decision: Supabase (cloud) for MVP → option to self-host the same stack if the institute later requires on-prem data.** Postgres means every query, every schema, every index is portable. RLS gives us security-as-data-schema rather than security-as-middleware, which is the right trade-off for a multi-role product where the same table is read differently by student / teacher / admin.

Live-streaming is explicitly **not** built on Supabase — it's delegated to 100ms.live. Supabase is the system of record; 100ms is an ephemeral session layer. See `BACKEND-ARCHITECTURE.md` §8.

---

## 5. Execution order (phased roadmap)

Phases are sequenced to produce a **client-demo-ready MVP after Phase 4** with all demo-critical screens working end-to-end.

| Phase | Title | Duration (1 eng) | Demo-critical? |
|---|---|---|---|
| 0 | Product Overview & Execution Map | 2 days | Planning |
| 1 | Foundation & Core Architecture | 5–7 days | ✅ (enables all) |
| 2 | Student App MVP (auth, dashboard, shell) | 7–10 days | ✅ |
| 3 | Attendance & QR System | 4–6 days | ✅ |
| 4 | Live Classes & Recorded Content | 10–14 days | ✅ |
| 5 | Study Materials & Clip System | 5–7 days | ⚠️ (materials yes, clips later) |
| 6 | Membership, Payments & Access Control | 6–8 days | ⚠️ (gating yes, live Razorpay optional) |
| 7 | Teacher/Admin Panel & Ops | 8–12 days | ✅ (enough to upload demo data) |
| 8 | Notifications, Analytics, Testing, Launch | 5–7 days | ❌ (post-demo polish) |

Demo freeze target: **end of Phase 4 + minimum Phase 7 admin tooling to seed demo data**.

### MVP-critical (demo day must have)
- Phase 1 entirely.
- Phase 2 entirely.
- Phase 3 entirely.
- Phase 4 entirely (live + at least one recorded class playable).
- Phase 5 §1 (study material browse/download).
- Phase 6 §access-control only (a flag per student, no live payment).
- Phase 7 §admin-can-upload-and-schedule only.

### Post-demo (safe to defer)
- Full Razorpay integration, subscription renewal automation.
- Clip trimming tool (teachers can mark highlights after demo).
- Analytics dashboards.
- Parent dashboard, multi-branch, ID-card scanning (future expansion).

---

## 6. How to use this folder

1. Start with `PHASE-00-Product-Overview-and-Execution-Map.md` for the big picture.
2. Read `BACKEND-ARCHITECTURE.md` and `FRONTEND-ARCHITECTURE-REACT-NATIVE.md` before writing any code — they define the invariants every phase assumes.
3. Each `PHASE-XX` file is self-contained: scope, screens, tasks, acceptance criteria, folder layout, and suggested order of implementation.
4. When a phase is "done", verify against its acceptance criteria before moving on — phases have real dependencies.
5. `OPEN-QUESTIONS-ASSUMPTIONS-AND-RECOMMENDATIONS.md` lists every decision taken with a default answer. Override there when the client gives us new inputs, and it will flow through the other docs.

---

## 7. Files in this package

| File | Purpose |
|---|---|
| `README.md` | You are here. |
| `PHASE-00-Product-Overview-and-Execution-Map.md` | Non-technical product map, personas, journeys, demo script. |
| `PHASE-01-Foundation-and-Core-Architecture.md` | Repo setup, Supabase project, base schema, auth, RLS, CI. |
| `PHASE-02-Student-App-MVP.md` | Student shell: login, dashboard, profile, navigation. |
| `PHASE-03-Attendance-and-QR-System.md` | Rotating QR, scanner mode, attendance data model. |
| `PHASE-04-Live-Classes-and-Recorded-Content.md` | 100ms integration, recording pipeline, playback. |
| `PHASE-05-Study-Materials-and-Clip-System.md` | PDF/doc library + Bunny-based clip creation. |
| `PHASE-06-Membership-Payments-and-Access-Control.md` | Plans, Razorpay, membership enforcement. |
| `PHASE-07-Teacher-Admin-Panel-and-Ops.md` | Next.js panel, uploads, moderation, reports. |
| `PHASE-08-Notifications-Analytics-Testing-and-Launch.md` | Push, analytics, e2e, release checklist. |
| `BACKEND-ARCHITECTURE.md` | Full backend decision record and system design. |
| `FRONTEND-ARCHITECTURE-REACT-NATIVE.md` | App architecture, libraries, navigation, folder layout. |
| `DATABASE-SCHEMA-AND-STORAGE-PLAN.md` | Tables, columns, indexes, storage buckets, retention. |
| `API-DESIGN-AND-SERVICE-BOUNDARIES.md` | Module boundaries, endpoints/RPC, error conventions. |
| `USER-FLOWS-WORKFLOWS-AND-SEQUENCE-DIAGRAMS.md` | Mermaid sequence diagrams per flow. |
| `SECURITY-SCALABILITY-DEVOPS-AND-OBSERVABILITY.md` | Hardening, scaling path, CI/CD, monitoring. |
| `OPEN-QUESTIONS-ASSUMPTIONS-AND-RECOMMENDATIONS.md` | Every open question from the PRD with a recommended answer. |

---

## 8. Non-negotiables (carry into every phase)

1. **Access control is enforced at the database layer (RLS) and at the signed-URL layer.** Never trust the client.
2. **QR tokens are short-lived (≤30s) and single-use per session.** No static QR, ever.
3. **Video URLs are always signed and time-bound.** No public bucket for paid content.
4. **Every write goes through a typed Supabase client with RLS on.** No service-role key in the mobile app, period.
5. **Mobile-first and Android-low-end-first.** Test on a 4 GB Android device every week.
6. **OTA updates enabled from day one.** The demo build must be patchable without a store release.
7. **Observability is part of Phase 1, not Phase 8.** Sentry in the app before the first feature ships.

---

## 9. Most important assumptions

These can be overridden in `OPEN-QUESTIONS-ASSUMPTIONS-AND-RECOMMENDATIONS.md` but shape the whole plan:

- Single institute, single branch for MVP (multi-branch is Phase 2 of the real product, not covered here).
- Primary market is India; Razorpay + INR + Hindi/English UI supported.
- ~500–2,000 active students and ~5–20 teachers at launch; plan is built to scale to 20k without rewrite.
- Owner is non-technical; admin panel must be usable without SQL knowledge.
- Client demo is the single most important near-term milestone; every phase is ordered around making the demo strong.
