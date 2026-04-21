# Phase 00 — Product Overview & Execution Map

Phase 00 is not an engineering phase. It is the **shared mental model** every later phase assumes. Read this before reading any `PHASE-0X` file.

---

## 1. One-paragraph pitch

Coaching OS is the app and admin console for a hybrid coaching institute. Students log in, see today's schedule, get into live classes with one tap, scan in by QR at the physical classroom, catch up via recordings and teacher-clipped highlights, read notes from the study library, and keep track of fee/membership status. Teachers host live sessions, upload recordings and clips, and upload materials. Admins manage everything from a web dashboard.

## 2. Product principles

1. **The demo is the product.** The first version has to feel polished enough to close the sale, not comprehensive enough to run a chain of institutes.
2. **Mobile-first, Android-low-end-first.** Every decision optimizes for a 4 GB RAM Android on 4G.
3. **One source of truth: Supabase Postgres.** Every other service (100ms, Bunny, Razorpay, Expo Push) writes back to Postgres via webhooks.
4. **Access control is the schema.** If an RLS policy would be awkward, the schema is wrong.
5. **Boring tech for boring problems.** Custom code only where it produces product value.

## 3. Personas

### 3.1 Student (primary)
- Age 15–22, owns a mid-range Android, uneven data, sometimes on WiFi.
- Daily actions: check today's class, tap to join live, show QR at door, rewatch last night's class, download PDF.
- Pain today: WhatsApp group chaos, missed classes, no single place for notes.
- KPIs we move: class join rate, attendance % digitally recorded, recording watch time.

### 3.2 Teacher
- Institute's subject faculty, 30–50 yrs, moderate tech comfort.
- Daily actions: start scheduled live class, post materials, mark clips "important", view who attended.
- Pain today: sharing recordings by Drive links, manual attendance.
- KPIs we move: content upload time, live class uptime, attendance clarity.

### 3.3 Admin / owner
- Runs the institute; non-technical but operations-minded.
- Daily actions: add/remove students, check who paid, send announcements, approve uploads, view daily attendance snapshot.
- Pain today: Excel spreadsheets, chasing fees.
- KPIs we move: % students on active membership, number of support queries per week.

### 3.4 Scanner (physical role, not a separate human account)
- A teacher or front-desk staff using the app in **"scanner mode"** (in-app toggle inside the teacher build).
- Scans student QR at classroom door to mark attendance.

### 3.5 Parent (future, not in MVP)
- View child's attendance, fee status. Mentioned for completeness; not built in phases 1–8.

## 4. Top user journeys (demo script)

Each journey is designed to be demoable in <60 seconds to the client.

### 4.1 Morning login → join live
1. Student opens app (already logged in, SplashScreen → Dashboard).
2. Sees "Physics — 10:00 AM — Live now" on the dashboard.
3. Taps "Join Live" → lands in a classroom room with teacher's video + chat.
4. Teacher is visible, audio is clear, delay <1s (100ms SFU).

### 4.2 QR attendance at the door
1. Student taps the floating "Attendance" button.
2. Full-screen rotating QR appears (refreshes every 15s).
3. Staff opens teacher app in scanner mode, scans student's QR.
4. Scanner shows green checkmark with student name.
5. Student's phone shows "Attendance marked for Physics, 10:03 AM" via push + in-app.

### 4.3 Watch last night's recording
1. Student opens "Classes" tab → "Recordings".
2. Sees yesterday's Physics class with duration and teacher.
3. Taps → HLS playback starts within 2s, resume from last position.
4. Can scrub, change speed, pick quality.

### 4.4 Read a PDF
1. Student opens "Library" → "Physics — Ch. 3 Notes".
2. PDF opens inline, can zoom, can swipe pages.

### 4.5 Check membership
1. Profile → "Membership".
2. Sees "Active until 12 May 2026" with progress ring.
3. "Renew" CTA (Phase 6) goes to Razorpay checkout.

### 4.6 Admin adds a new student
1. Owner opens admin web panel.
2. "Students" → "Add student" → fills name/phone/batch.
3. Invitation SMS/email is sent, student logs in via OTP.

These journeys are the demo script. Every phase should be scored against "does this make one of these journeys better?".

## 5. Module map

```
Coaching OS
├── Student App (React Native / Expo)
│   ├── Auth (OTP)
│   ├── Dashboard
│   ├── Attendance (QR show)
│   ├── Classes (Live + Recorded)
│   ├── Library (PDFs, Clips)
│   ├── Membership
│   └── Profile
│
├── Teacher App (same RN binary, role-gated + "scanner mode")
│   ├── My Classes (schedule, start live)
│   ├── Scanner (QR reader)
│   ├── Uploads (recording upload, clip marker)
│   └── Attendance view
│
├── Admin Panel (Next.js web)
│   ├── Users & Roles
│   ├── Batches & Courses
│   ├── Classes & Schedule
│   ├── Content (materials, recordings, clips) + moderation
│   ├── Payments & Memberships
│   ├── Announcements
│   └── Reports
│
└── Backend
    ├── Supabase (Auth, Postgres, Storage, Realtime, Edge Functions)
    ├── 100ms.live (live video SFU + recording)
    ├── Bunny Stream (recorded video CDN + clipping)
    ├── Razorpay (payments)
    └── Expo Push + FCM/APNs (notifications)
```

## 6. Execution map (phase sequencing)

```mermaid
gantt
    title Coaching OS — Phase Sequencing (1 engineer)
    dateFormat  YYYY-MM-DD
    section Foundation
    Phase 1 Foundation            :p1, 2026-04-22, 7d
    section Student MVP
    Phase 2 Student App Shell     :p2, after p1, 10d
    Phase 3 Attendance & QR       :p3, after p2, 6d
    Phase 4 Live + Recorded       :p4, after p3, 14d
    section Content & Money
    Phase 5 Materials + Clips     :p5, after p4, 7d
    Phase 6 Membership + Payments :p6, after p5, 8d
    section Ops & Launch
    Phase 7 Admin Panel           :p7, parallel, after p2, 12d
    Phase 8 Notif/Analytics/Launch:p8, after p6, 7d
```

Phase 7 runs **in parallel** with Phases 3–6 because the RN engineer can context-switch to the Next.js panel whenever mobile is blocked on design or client input.

### Phase dependencies (hard)
- P2 depends on P1 (auth + schema).
- P3 depends on P2 (need student session).
- P4 depends on P1 (classes table), P2 (dashboard entry), P6 access-control stub.
- P5 clips depend on P4 (recordings must exist).
- P6 enforcement depends on P4 (gating live/recorded).
- P7 depends on P1 (schema). Can start after P1 in parallel with P2+.
- P8 depends on P2–P6.

## 7. Milestones and demo gates

| Milestone | Criterion | Who signs off |
|---|---|---|
| M1 — Foundation Ready | Supabase up, CI green, RN shell boots with login, Sentry receiving events | Eng |
| M2 — Student Demo | Journeys 4.1–4.5 working against seeded data | Eng + Client preview |
| M3 — Admin Usable | Owner can add a student/batch/class/material without a dev | Owner |
| M4 — Client Demo | All journeys 4.1–4.6 live, OTA build installed on demo phone | Owner + Eng |
| M5 — Soft Launch | 1 batch piloted for 2 weeks in production | Owner |
| M6 — GA | Full Razorpay live, notifications, clips, analytics | Owner |

## 8. Out of scope for this plan

Explicitly deferred (documented here so nobody re-asks mid-build):
- Multi-branch multi-tenant.
- Parent dashboard.
- ID-card hardware scanning (extension of QR module later).
- AI summaries, doubt-solving, test series.
- Offline full-video download (we allow PDF download; video is streaming only).
- iOS first-class polish for teachers (teachers get a working build but the demo is Android-led).

## 9. Demo-day readiness checklist (preview of P8)

- [ ] Demo phone charged, OTA-updated build installed.
- [ ] Demo Supabase project seeded (3 batches, 2 teachers, 1 student login, 2 scheduled classes, 1 live recording, 5 PDFs).
- [ ] Internet fallback: 4G hotspot on separate SIM.
- [ ] Backup Android phone with identical build.
- [ ] Admin panel open in a browser tab on demo laptop.
- [ ] Razorpay test-mode checkout rehearsed (if shown).
- [ ] 100ms test room verified 30 min before demo.
- [ ] Sentry quiet (no red alerts in last 24h).

## 10. Handoff to Phase 1

Phase 1 starts with the repo and the Supabase project. Do not start Phase 2 UI until Phase 1 acceptance criteria are fully green, or you will reshape schemas under live screens and lose days.
