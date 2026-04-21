# FyneStudyLive — Coaching OS

## Project Overview
Hybrid coaching institute operating system. Student-facing mobile app + admin/teacher panel.

**Working title:** Coaching OS  
**Goal:** Win client demo by showing working MVP with polished student UI.

## Core Modules
- **Auth** — email/phone + OTP, role-based (student / teacher / admin)
- **Student Dashboard** — schedule, attendance summary, membership status, recent content
- **QR Attendance** — unique per-student QR (dynamic/token-based), scan-to-mark, no duplicates
- **Live Classes** — in-app streaming room, low-latency, mobile-stable, access-gated
- **Recorded Classes** — auto-saved after live, playback with seek/speed/resume
- **Clip Upload** — teacher trims recording segments, publishes to content library
- **Study Material Library** — PDFs, images, docs, organized by course/batch/subject
- **Membership / Fees** — plan-based access control, payment history, admin manual override
- **Notifications** — class reminders, attendance alerts, new content, announcements

## User Roles
| Role | Key Powers |
|------|-----------|
| Student | View dashboard, mark attendance, join live/recorded classes, access materials, view fees |
| Teacher | Host live sessions, upload recordings/clips/materials, view attendance |
| Admin | Full CRUD on users, batches, content, payments, reports |

## MVP Priority Order
1. Student login + dashboard UI
2. QR attendance system
3. Live class room
4. Recorded class playback
5. Study material library
6. Membership / access control
7. Admin/teacher upload panel + backend APIs

## Tech Stack (TBD — to be finalized)
- Frontend: React Native (mobile) + React/Next.js (admin panel)
- Backend: Node.js / Supabase (TBD)
- Storage: Cloud storage for videos and documents
- Streaming: TBD (external service vs custom)
- DB: PostgreSQL (via Supabase or direct)

## Key Rules
- Mobile-first. Every student-facing screen must feel premium on Android.
- Access control is membership-gated — always enforce on the backend, not just UI.
- QR tokens must be dynamic/time-based to prevent replay attacks.
- Live streaming stability is non-negotiable for the client demo.
- Keep the MVP focused — do not build Phase 2/3 features until Phase 1 is demo-ready.

## Data Models (Core)
- `Student` — id, name, phone, email, batch, course, membership_status
- `Teacher` — id, name, subject, assigned_classes
- `Class` — id, batch, subject, datetime, type (live/recorded), attendance_list, recording_url
- `Attendance` — id, student_id, class_id, timestamp, method (qr/manual)
- `Content` — id, type, title, subject, batch, file_url, visibility
- `Payment` — id, student_id, plan_type, amount, status, transaction_date, expiry_date

## Phases
- **Phase 1** — Student app UI, core backend, QR attendance, dashboard, content library structure
- **Phase 2** — Live classes, recording playback, fees/membership, teacher upload panel
- **Phase 3** — Clip trimming, advanced admin, notifications, analytics

## Open Questions
- Static vs dynamic vs time-based QR?
- External streaming service (Agora/LiveKit/Daily) vs custom RTMP?
- One-time membership vs recurring subscription?
- Multi-branch support from day one?
- Allow offline downloads?
