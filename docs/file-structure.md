# File Structure

A **pnpm workspace** with three top-level apps and shared packages. The current repo only contains `apps/mobile`; the layout below describes the target structure as the backend, admin panel, and shared packages come online.

## Top-level

```
FyneStudyLive/
├── CLAUDE.md                           # Source-of-truth context for AI agents
├── README.md                           # Human onboarding
├── pnpm-workspace.yaml                 # Workspace manifest
├── package.json                        # Root scripts (lint, typecheck, test, build all)
├── tsconfig.base.json                  # Shared TS strict config (extended by every app/package)
├── .editorconfig
├── .gitignore
├── .nvmrc
│
├── apps/
│   ├── mobile/                         # React Native + Expo app (student + teacher, same binary)
│   ├── admin/                          # Next.js 15 admin panel
│   └── functions/                      # Supabase Edge Functions (Deno)
│
├── packages/
│   ├── shared/                         # Cross-app types, enums, zod schemas, time helpers
│   ├── supabase-types/                 # Generated DB types (`supabase gen types`)
│   └── ui-tokens/                      # Brand colors, spacing, typography — shared between mobile + admin
│
├── supabase/
│   ├── config.toml                     # Local dev project config
│   ├── migrations/                     # Versioned SQL migrations (numbered)
│   ├── seed.sql                        # Demo seed
│   └── functions/                      # Symlink → ../apps/functions for `supabase functions deploy`
│
├── .github/
│   └── workflows/
│       ├── ci.yml                      # lint + typecheck + test on PR
│       ├── mobile-eas-preview.yml      # PR-triggered EAS preview build
│       └── deploy-functions.yml        # Deploy edge functions on main merge
│
└── docs/
    ├── project.md
    ├── file-structure.md               # This file
    ├── backend-architecture.md
    ├── AppsFeatures_260501_151101.pdf
    ├── spec/
    │   ├── authentication.md
    │   ├── student-dashboard.md
    │   ├── attendance.md
    │   ├── practice-quizzes.md
    │   ├── examinations.md
    │   ├── youtube-live-stream.md
    │   ├── study-materials.md
    │   ├── leaderboard-and-gamification.md
    │   ├── parents-report.md
    │   ├── admin-panel.md
    │   ├── teacher-panel.md
    │   └── security.md
    └── phases/                         # phase-1.md … phase-4.md (filled later)
```

## apps/mobile

The student and teacher UIs share one Expo binary. Role-gated route groups switch the experience.

```
apps/mobile/
├── app.json                            # Expo SDK 54, new arch ON, iOS bundle id, Android package
├── eas.json                            # Build profiles: development, preview, production
├── package.json
├── tsconfig.json                       # Strict, "@/*" path alias
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── nativewind-env.d.ts
├── expo-env.d.ts
├── .env.example                        # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, etc.
│
├── app/                                # Expo Router screens (file-based)
│   ├── _layout.tsx                     # Root: theme, Sentry init, query client, auth gate
│   ├── index.tsx                       # Splash → role router (redirects into (student) or (teacher))
│   ├── login.tsx                       # Email + password
│   ├── forgot-password.tsx             # Email magic-link reset
│   ├── force-password-change.tsx       # First-login forced change
│   │
│   ├── (student)/                      # Student-only routes (role gate enforced in layout)
│   │   ├── _layout.tsx                 # Bottom tabs
│   │   ├── index.tsx                   # Dashboard
│   │   ├── classes.tsx                 # Live / Upcoming / Recorded segmented
│   │   ├── library.tsx                 # Subjects → Chapters → Topics
│   │   ├── attendance.tsx              # QR display + history
│   │   ├── leaderboard.tsx
│   │   ├── profile.tsx                 # Stats, badges, streak, settings
│   │   ├── menu.tsx                    # Logout, support, privacy
│   │   ├── quiz/[id].tsx               # Take a quiz
│   │   ├── exam/[id].tsx               # Take an exam (locked-down)
│   │   ├── live/[sessionId].tsx       # Wrapped YT live + chat + raise-hand
│   │   ├── recording/[sessionId].tsx  # Wrapped YT recording + chat replay
│   │   ├── pdf/[contentId].tsx        # In-app PDF reader
│   │   └── video/[contentId].tsx      # Wrapped YT lesson player
│   │
│   ├── (teacher)/                      # Teacher-only routes
│   │   ├── _layout.tsx
│   │   ├── index.tsx                   # Teacher dashboard
│   │   ├── scan.tsx                    # QR scanner camera
│   │   ├── roster/[sessionId].tsx     # Manual attendance roster
│   │   ├── classes.tsx                 # My classes + create live
│   │   ├── live-control/[sessionId].tsx
│   │   ├── content.tsx                 # Upload PDF / link YT video
│   │   ├── quiz-builder.tsx
│   │   ├── exam-builder.tsx
│   │   ├── exam/[id]/results.tsx       # Results, regrade, release
│   │   ├── offline-scores.tsx          # Enter pen-paper test scores
│   │   └── batch/[id].tsx              # Batch performance dashboard
│   │
│   └── modal.tsx                       # Generic modal route
│
├── components/                         # Pure UI, no data fetching
│   ├── ui/                             # Primitives: Button, Input, Card, Sheet, Toast
│   ├── attendance/                     # QrDisplay, AttendanceRing, AttendanceHistory
│   ├── classes/                        # ClassCard, ScheduleStrip, LobbyCountdown
│   ├── live/                           # WrappedYtPlayer, ChatPane, RaiseHandButton, Watermark
│   ├── quiz/                           # QuestionCard, OptionRadio, NavigationGrid, TimerPill, FlagButton
│   ├── exam/                           # ExamGate (start window check), TabSwitchWarning, ResultBanner
│   ├── library/                        # SubjectTile, ChapterAccordion, ContentRow
│   ├── leaderboard/                    # RankRow, RankBadge, ScopeTabs
│   ├── gamification/                   # StreakFlame, BadgeShowcase, BadgeEarnedModal
│   ├── dashboard/                      # MasteryCard, NextClassCard, StatsStrip
│   └── teacher/                        # ScannerOverlay, BatchPicker, QuestionEditor
│
├── features/                           # Domain logic — hooks, queries, mutations, state machines
│   ├── auth/                           # useSession, useRole, login + reset mutations
│   ├── attendance/                     # QR sign client, scan handler, server-time sync
│   ├── classes/                        # Class queries, YT playback config fetcher
│   ├── quiz/                           # Quiz state machine + auto-save
│   ├── exam/                           # Exam state machine + server timer sync + tab-switch logger
│   ├── library/                        # Content tree navigation
│   ├── mastery/                        # Mastery queries
│   ├── gamification/                   # Streak + badge derivation
│   ├── chat/                           # Realtime channel subscription
│   └── teacher/                        # Quiz builder state, exam builder state, content upload
│
├── lib/                                # Glue
│   ├── supabase.ts                     # Supabase client tuned for RN (AsyncStorage off, SecureStore on)
│   ├── env.ts                          # Typed env access
│   ├── analytics.ts                    # PostHog wrapper with consent gate
│   ├── crash.ts                        # Sentry wrapper
│   ├── yt-player.ts                    # Wrapped YT controller
│   ├── secure-store.ts                 # expo-secure-store typed helpers
│   ├── permissions.ts                  # Camera permission flow + denied screens
│   ├── time.ts                         # IST helpers, formatters, server-time sync
│   ├── watermark.ts                    # Live/recording watermark overlay
│   └── pdf.ts                          # react-native-pdf helpers
│
├── constants/
│   ├── theme.ts                        # Bridges to packages/ui-tokens
│   ├── roles.ts                        # Role enum + permission checks
│   └── routes.ts                       # Centralized route names
│
├── hooks/                              # Generic hooks (existing folder; gradually move app-specific into features/)
│
└── assets/
    ├── images/
    ├── icons/                          # Badge SVGs, role icons
    └── fonts/
```

## apps/admin (Next.js 15)

```
apps/admin/
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── middleware.ts                       # Auth gate, 2FA enforcement, role check on every request
│
├── app/
│   ├── layout.tsx                      # Root: theme, providers, Sentry, query client
│   ├── login/page.tsx                  # Admin login (email + password + TOTP)
│   ├── 2fa/
│   │   ├── enroll/page.tsx             # First-time TOTP setup
│   │   └── verify/page.tsx
│   │
│   ├── (dashboard)/                    # Authenticated admin layout
│   │   ├── layout.tsx                  # Sidebar nav + breadcrumb
│   │   ├── page.tsx                    # Overview: counts, alerts, audit feed
│   │   │
│   │   ├── students/
│   │   │   ├── page.tsx                # List, filters, bulk actions
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Profile, attendance, scores, history
│   │   │       └── edit/page.tsx
│   │   ├── teachers/
│   │   ├── admins/                     # Owner-only
│   │   ├── batches/
│   │   ├── courses/                    # Curriculum (Subjects → Chapters → Topics)
│   │   ├── content/                    # All uploaded materials + moderation
│   │   ├── exams/                      # Cross-batch oversight
│   │   ├── attendance/                 # Corrections + reports
│   │   ├── reports/                    # Parent PDFs, downloadable institute reports
│   │   ├── whatsapp/                   # Templates + send log
│   │   ├── audit/                      # Audit log viewer
│   │   └── settings/                   # Institute config, branding, 2FA enforcement (owner-only)
│   │
│   └── api/
│       └── webhooks/
│           └── gupshup/route.ts        # WhatsApp delivery callbacks (HMAC-verified)
│
├── components/
│   ├── ui/                             # shadcn/ui primitives (generated)
│   ├── tables/                         # DataTable wrapper around TanStack Table
│   ├── forms/                          # Student form, batch form, content form
│   └── charts/                         # Recharts wrappers for attendance/mastery
│
├── lib/
│   ├── supabase-server.ts              # Server-side Supabase client (cookies-based)
│   ├── supabase-browser.ts             # Browser client
│   ├── auth.ts                         # Server-side session helper, role check
│   ├── audit.ts                        # Audit log writer (server actions)
│   ├── pdf.ts                          # Client for parent-report-generate edge fn
│   └── env.ts
│
└── public/
```

## apps/functions (Supabase Edge Functions)

Deno runtime. One folder per function. Shared modules live under `_shared/` and are not deployed as standalone functions.

```
apps/functions/
├── _shared/                            # Shared Deno modules (imported by functions, never deployed)
│   ├── supabase.ts                     # Service-role Supabase client (server-only)
│   ├── auth.ts                         # JWT verification + role checks
│   ├── audit.ts                        # Audit log writer
│   ├── ratelimit.ts                    # Postgres-backed token bucket
│   ├── yt-api.ts                       # YouTube Data API v3 client (channel-scoped OAuth)
│   ├── gupshup.ts                      # WhatsApp client + template registry
│   ├── pdf.ts                          # pdf-lib renderer
│   ├── hmac.ts                         # HMAC sign/verify for QR + playback payloads
│   ├── time.ts                         # IST helpers
│   └── crash.ts                        # Sentry init for edge runtime
│
├── auth-bootstrap/index.ts             # Admin creates user → assigns role → emails initial creds
├── yt-broadcast-create/index.ts        # Create Unlisted broadcast for a scheduled class
├── yt-playback-sign/index.ts           # Return one-shot signed playback config to authorized client
├── attendance-qr-sign/index.ts         # Issue rotating 30s QR token to student
├── attendance-qr-verify/index.ts       # Verify scanned token, mark attendance, replay-protect
├── exam-submit/index.ts                # Server-enforced timer + grading + result write
├── mastery-recompute/index.ts          # Rolling-N mastery aggregation (per-attempt + nightly)
├── streak-recompute/index.ts           # Nightly: tick streaks, award streak badges
├── whatsapp-send/index.ts              # Send templated WA message via Gupshup
├── parent-report-generate/index.ts     # Build weekly PDF + queue WA send (loops per student)
├── audit-log-cleanup/index.ts          # Quarterly anonymization of audit rows past retention
└── gupshup-callback/index.ts           # Handle Gupshup delivery webhook (status updates)
```

## supabase/

```
supabase/
├── config.toml                         # Local dev project config (db port, auth providers)
├── migrations/
│   ├── 0001_init_users_roles.sql
│   ├── 0002_courses_batches.sql
│   ├── 0003_content_library.sql
│   ├── 0004_attendance.sql
│   ├── 0005_question_bank_quizzes.sql
│   ├── 0006_exams.sql
│   ├── 0007_classes_recordings.sql
│   ├── 0008_chat_realtime.sql
│   ├── 0009_mastery.sql
│   ├── 0010_leaderboard_gamification.sql
│   ├── 0011_parent_reports.sql
│   ├── 0012_audit_log.sql
│   ├── 0013_rls_policies.sql
│   ├── 0014_indexes_perf.sql
│   └── 0015_views_fns.sql
├── seed.sql                            # Demo seed: 30 students, 4 teachers, 3 batches, 50 quizzes
└── functions/                          # Symlink → ../apps/functions
```

## packages/

```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types/                          # Domain types (Course, Batch, Quiz, etc.) re-exported from supabase-types
    ├── enums/                          # Role, AttendanceMethod, ContentType, ExamStatus, BadgeKind
    ├── constants/
    │   ├── mastery.ts                  # ROLLING_N = 5
    │   ├── marking.ts                  # Default schemes (+4/-1, +1/0)
    │   ├── attendance.ts               # WINDOW_BEFORE_MIN = 15, etc.
    │   └── leaderboard.ts              # Weights (0.6, 0.25, 0.15)
    ├── validation/                     # zod schemas for forms + edge function inputs
    └── time/
        ├── ist.ts                      # Asia/Kolkata helpers
        └── serverTime.ts               # Sync helper for exam timers

packages/supabase-types/
├── index.ts                            # Generated by `supabase gen types typescript --linked`
├── package.json
└── README.md                           # How to regenerate

packages/ui-tokens/
├── package.json
├── colors.ts                           # Brand palette
├── typography.ts                       # Font scale, weights
├── spacing.ts                          # 4-pt grid
└── radius.ts
```

## .github/workflows/

```
.github/workflows/
├── ci.yml                              # On every PR: pnpm lint, typecheck, test, build dry-run
├── mobile-eas-preview.yml              # On PR: EAS Build preview, comment QR back on PR
├── mobile-eas-update.yml               # On main merge: EAS Update for OTA hotfixes
├── deploy-admin.yml                    # On main merge: trigger Vercel deploy (or rely on Vercel git integration)
├── deploy-functions.yml                # On main merge: supabase functions deploy --project-ref $PROD
└── nightly-db-backup-check.yml         # Verify backup ran via Supabase Management API
```

## Conventions

- **TypeScript strict everywhere.** No `any` without a justification comment.
- **Path aliases.** Mobile and admin both use `@/*` rooted at the app root. Cross-app code goes through `packages/*`.
- **Naming.**
  - Files: `kebab-case.tsx` / `.ts`
  - React components: `PascalCase`
  - Hooks: `useFooBar`
  - Server actions / edge fns: `verb-noun`
  - DB tables: `snake_case`, plural
- **State management.**
  - Server state: TanStack Query on mobile, React Query on admin (same package).
  - Client state: `useState` / `useReducer` first. Zustand only if a feature genuinely needs cross-component state (e.g., exam state machine).
  - No Redux or MobX.
- **Forms.** `react-hook-form` + zod schemas re-exported from `packages/shared/validation`.
- **Comments.** Default to none. Only annotate non-obvious *why* — never *what*.
- **Tests.** Unit tests next to source as `*.test.ts`. E2E specs under `apps/mobile/e2e/` (Maestro flows).
- **Lint.** `eslint`, `prettier`, `stylelint` (admin only). Same rules across all apps via root `eslint.config.js`.
- **Imports.** Auto-sorted. No deep relative imports beyond two levels — use aliases.
- **Secrets.** `.env.*` files git-ignored. Real secrets in Supabase Vault (edge) or Vercel/EAS environment variables (apps). Never commit a `.env` file.
