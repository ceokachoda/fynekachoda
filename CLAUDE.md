# FyneStudyLive — Coaching OS

## Project Overview
Hybrid coaching institute operating system. Student-facing mobile app + admin/teacher panel.

**Working title:** Coaching OS  
**Goal:** Win client demo by showing working MVP with polished student UI.

## Current Status
- **Phase:** Phase 2 UI complete, backend not started
- **UI:** 100% polished, demo-ready screens built in React Native + Expo
- **Backend:** 0% — all data is hardcoded mock data
- **Admin Panel:** Not started

| Module | UI | Backend |
|--------|-----|---------|
| Login / OTP | ✅ | ❌ |
| Course Selection | ✅ | ❌ |
| Student Dashboard | ✅ | ❌ |
| QR Attendance | ✅ (display only) | ❌ |
| Live Classes | ✅ (placeholder) | ❌ |
| Recorded Classes | ✅ (placeholder) | ❌ |
| Study Library | ✅ | ❌ |
| Profile & Settings | ✅ | ❌ |
| Membership / Fees | ❌ | ❌ |
| Admin / Teacher Panel | ❌ | ❌ |
| Push Notifications | ❌ | ❌ |

## Tech Stack (Actual)
| Layer | Technology |
|-------|------------|
| Mobile | React Native 0.81.5 + Expo 54.0.33 |
| Routing | Expo Router 6.0 (file-based) |
| Styling | NativeWind 4.2.3 + Tailwind CSS 3.4.19 |
| Icons | lucide-react-native 1.8.0 |
| Animations | React Native Animated API + Reanimated 4.1.1 |
| QR | react-native-qrcode-svg 6.3.21 |
| Language | TypeScript 5.9.2 (strict) |
| Package Manager | pnpm (monorepo workspace) |
| Backend (planned) | Supabase (PostgreSQL + Auth + Storage) |
| Streaming (planned) | 100ms SFU |
| Payments (planned) | Razorpay |
| Admin Panel (planned) | React / Next.js |

## File Structure
```
FyneStudyLive/
├── CLAUDE.md
├── docs/
│   └── coaching-os-master-plan/        # Full planning docs (phases, DB schema, API design, etc.)
│       ├── README.md
│       ├── PHASE-00 through PHASE-08 .md
│       ├── API-DESIGN-AND-SERVICE-BOUNDARIES.md
│       ├── BACKEND-ARCHITECTURE.md
│       ├── DATABASE-SCHEMA-AND-STORAGE-PLAN.md
│       ├── FRONTEND-ARCHITECTURE-REACT-NATIVE.md
│       ├── OPEN-QUESTIONS-ASSUMPTIONS-AND-RECOMMENDATIONS.md
│       ├── SECURITY-SCALABILITY-DEVOPS-AND-OBSERVABILITY.md
│       └── USER-FLOWS-WORKFLOWS-AND-SEQUENCE-DIAGRAMS.md
└── apps/
    └── mobile/                         # React Native app (Expo)
        ├── app.json                    # Expo config (SDK 54, new arch enabled)
        ├── package.json
        ├── tsconfig.json               # Strict, path alias @/*
        ├── tailwind.config.js
        ├── global.css
        ├── babel.config.js
        ├── metro.config.js
        ├── app/                        # Expo Router screens
        │   ├── _layout.tsx             # Root layout
        │   ├── index.tsx               # Login screen
        │   ├── verify.tsx              # OTP verification
        │   ├── select-course.tsx       # Course selection (JEE Main/Adv, NEET, CUET)
        │   ├── live-session.tsx        # Live class room (placeholder)
        │   ├── modal.tsx               # Modal template
        │   └── (tabs)/                 # Bottom tab navigation
        │       ├── _layout.tsx         # Tab bar layout
        │       ├── index.tsx           # Home / Dashboard
        │       ├── classes.tsx         # Classes (Live / Upcoming / Recorded)
        │       ├── library.tsx         # Study Material Library
        │       ├── check-in.tsx        # QR Attendance display
        │       ├── profile.tsx         # Student profile + stats
        │       └── menu.tsx            # Settings / menu
        ├── components/
        │   ├── themed-text.tsx
        │   ├── themed-view.tsx
        │   ├── external-link.tsx
        │   ├── haptic-tab.tsx
        │   ├── hello-wave.tsx
        │   ├── parallax-scroll-view.tsx
        │   └── ui/
        │       ├── collapsible.tsx
        │       ├── icon-symbol.tsx
        │       └── icon-symbol.ios.tsx
        ├── constants/
        │   └── theme.ts                # Colors and font definitions
        ├── hooks/
        │   ├── use-color-scheme.ts
        │   ├── use-color-scheme.web.ts
        │   └── use-theme-color.ts
        └── assets/images/              # Icons, logos, splash
```

## Core Modules
- **Auth** — phone + OTP, role-based (student / teacher / admin)
- **Student Dashboard** — daily schedule, attendance card, course progress, recent materials
- **QR Attendance** — per-student QR display, dynamic/token-based, scan-to-mark, no duplicates
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

## Screens & What They Do
| Screen | File | Description |
|--------|------|-------------|
| Login | `app/index.tsx` | Name + phone input, gradient logo, form validation |
| OTP Verify | `app/verify.tsx` | 6-digit OTP entry |
| Course Select | `app/select-course.tsx` | Pick from JEE Main, JEE Advanced, NEET UG, CUET UG |
| Dashboard | `app/(tabs)/index.tsx` | Schedule, attendance %, course progress, recent content |
| Classes | `app/(tabs)/classes.tsx` | Segmented tabs: Live Now / Upcoming / Recorded |
| Library | `app/(tabs)/library.tsx` | Search + filter: videos, PDFs, assignments |
| Check-In | `app/(tabs)/check-in.tsx` | QR code display + animated scan line + history |
| Profile | `app/(tabs)/profile.tsx` | User info, stats (attendance %, test avg, rank), settings |
| Menu | `app/(tabs)/menu.tsx` | Settings grouped: General / Security / About |
| Live Session | `app/live-session.tsx` | Video placeholder, live chat, raise hand, pinned announcements |

## Data Models (Core)
- `Student` — id, name, phone, email, batch, course, membership_status, attendance_rate, rank
- `Teacher` — id, name, subject, assigned_classes
- `Class` — id, batch, subject, datetime, type (live/recorded), instructor, room, recording_url
- `Attendance` — id, student_id, class_id, timestamp, method (qr/manual), qr_token, streak
- `Content` — id, type (pdf/video/clip/assignment), title, subject, batch, file_url, visibility, duration
- `Payment` — id, student_id, plan_type, amount, status, transaction_date, expiry_date

## Key Rules
- Mobile-first. Every student-facing screen must feel premium on Android.
- Access control is membership-gated — always enforce on the backend, not just UI.
- QR tokens must be dynamic/time-based to prevent replay attacks.
- Live streaming stability is non-negotiable for the client demo.
- Keep the MVP focused — do not build Phase 2/3 features until Phase 1 is demo-ready.
- All styles use Tailwind/NativeWind classes. Inline styles only for animations.
- No global state manager yet — use React Context when backend wiring begins.

## MVP Priority Order
1. ✅ Student login + dashboard UI
2. ✅ QR attendance UI
3. ✅ Live class room UI
4. ✅ Recorded class UI
5. ✅ Study material library UI
6. 🔲 Wire Supabase auth + database
7. 🔲 Live streaming (100ms SFU)
8. 🔲 Membership / access control backend
9. 🔲 Admin/teacher upload panel

## Phases
- **Phase 1** — Student app UI ✅ DONE
- **Phase 2** — Backend APIs, Supabase auth, QR attendance backend, real class data
- **Phase 3** — Live streaming (100ms), recording playback, fees/membership, Razorpay
- **Phase 4** — Clip trimming, admin/teacher panel (Next.js), notifications, analytics

## Open Questions (Decided or Pending)
- QR: **Dynamic/time-based** token decided (per CLAUDE rules)
- Streaming: **100ms SFU** noted in master plan (confirm with client)
- Membership: One-time vs recurring — **TBD**
- Multi-branch support — **TBD** (out of MVP scope)
- Offline downloads — **TBD** (Phase 4+)
- Admin panel framework — **Next.js** tentative
