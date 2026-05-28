# Phase 0 — Overview & Architecture (read before Phase 1)

This document is the single source of truth for the **web app conversion**. It contains:

1. The goal and the locked product decisions
2. A complete A-to-Z inventory of what exists today (screens, design, data)
3. The target architecture for `apps/web`
4. The **engineering decisions table** (every default — veto any you dislike before Phase 1)
5. The web equivalents for the 6 mobile-only features
6. Backend reuse + the *only* backend config changes needed (no schema changes)
7. Conventions, repo layout, and acceptance philosophy

---

## 1. Goal & locked decisions

Build `apps/web` — a Next.js 15 web client giving **students and teachers** full FyneStudy functionality in any modern browser, installable as a PWA, **reusing the existing Supabase backend unchanged**.

| # | Question | Decision (locked 2026-05-28) |
|---|---|---|
| 1 | Reuse Expo-web or build separate? | **Separate Next.js 15 app** (`apps/web`), mirroring `apps/admin`. |
| 2 | Which roles? | **Students + teachers** (full parity). Admins are redirected to the admin panel. |
| 3 | Desktop layout? | **Responsive** — side-rail + multi-column on desktop; bottom tabs on mobile-web. Exact design ported. |
| 4 | Installable? | **Yes — PWA**. |

---

## 2. A-to-Z inventory of the current app

### 2.1 Backend (reused as-is — DO NOT change)

- **Supabase project:** `orqwyazvcthgxoadfxfv` (region `ap-south-1`), this is production.
- **57 migrations** in `supabase/migrations/` — full schema, RLS, RPCs, triggers, cron, storage buckets.
- **51 edge functions** in `apps/functions/*/index.ts`. The web app calls the same functions the mobile app + admin call, with the logged-in user's JWT.
- **5 RPCs** (Postgres functions, `SECURITY DEFINER` with own-or-admin guards): `student_dashboard`, `teacher_dashboard`, `teacher_batch_overview`, `my_batch_leaderboard`, `student_public_card`.
- **Private storage buckets** (signed-URL access only): `exam-images`, `study-materials`, `profile-pictures`, `badge-assets`.
- **Realtime publication** members used by clients: `attendance`, `chat_messages`, `raise_hand_events`, `chat_bans` (+ the dashboards refetch on focus, not realtime).

> **Backend rule:** if a feature needs a backend change, that's a red flag — re-read the spec. Conversion = front-end only.

### 2.2 Screen inventory (what the web app must reproduce — ≈36 screens)

Source files are in `apps/mobile/app/`. The web routes mirror these (Next App Router under `apps/web/app/`).

**Auth / entry (8)** — `app/index.tsx` (role router), `login.tsx`, `forgot-password.tsx`, `reset.tsx`, `force-password-change.tsx`, `suspended.tsx`, `admin-redirect.tsx`, `role-chooser.tsx`.

**Student tabs (7)** — group `app/(student)/`:
| Tab | Mobile file | Purpose |
|---|---|---|
| Home | `(student)/index.tsx` | Dashboard: greeting, next-card, stats strip, today's schedule, weak topics, continue-watching, recent badges, badge-celebration + streak modals. |
| Classes | `(student)/classes.tsx` | Live / Upcoming / Recorded segments + exams list. |
| Library | `(student)/library.tsx` | Subject→Chapter→Topic→Item drill-down + search + per-topic quizzes. |
| Attendance | `(student)/attendance.tsx` | Rotating QR to *show*, today's sessions, history rings, realtime. |
| Ranks | `(student)/leaderboard.tsx` | Weekly/All-time leaderboard, my-rank card, public-card modal, calc modal. |
| Profile | `(student)/profile.tsx` | 3 tabs: Profile / Mastery / Badges + change password. |
| Menu | `(student)/menu.tsx` | Settings menu + sign out. |

**Student top-level (6)** — outside the tab group (per mobile decision D-169/D-157, keep these as standalone routes): `video/[contentId].tsx`, `pdf/[contentId].tsx`, `quiz/[id].tsx` (4-stage), `exam/[id].tsx` (5-stage), `live/[sessionId].tsx`, `recording/[sessionId].tsx`. Plus `modal.tsx` (streak 30-day calendar).

**Teacher tabs (8)** — group `app/(teacher)/`: Home (`index.tsx`), Scan (`scan.tsx`), Classes (`classes.tsx`), Content/Library (`content.tsx`), Quizzes (`quizzes.tsx`), Exams (`exams.tsx`), Batch (`batch/index.tsx` → `batch/[id].tsx`), Profile (`profile.tsx`).

**Teacher top-level (6)** — `quiz-builder/[quizId].tsx`, `exam-builder/[examId].tsx`, `exam-results/[examId].tsx`, `offline-scores.tsx`, `roster/[sessionId].tsx`, `live-control/[sessionId].tsx`.

Complexity tiers (drives effort & ordering):
- **Simple** (list/detail/forms): most tabs, profile, menu, classes lists, builders' list views.
- **Complex** (realtime / player / sync): library players, live, recording, roster, batch analytics, exam-results.
- **Highly complex** (state machine + server-timing + locked UI): quiz, **exam**, live-control.

### 2.3 Design system (copy 1:1)

Mobile uses **NativeWind 4 + Tailwind 3**. The palette is the **standard Tailwind palette** (so it ports verbatim). Key tokens:

- **Primary** `blue-600 #2563eb` (actions, selected), darker `blue-800 #1d4ed8`, light bg `blue-50 #eff6ff`.
- **Success** `emerald-500 #10b981` / `emerald-600 #059669`; bg `#dcfce7`.
- **Error/absent** `red-500 #ef4444` / `red-600 #dc2626`; bg `red-50 #fef2f2`.
- **Warning/flag/late** `amber-500 #f59e0b`, `orange-500 #f97316`.
- **Neutrals** slate scale: borders `slate-200 #cbd5e1`, surfaces `slate-50 #f8fafc`/`slate-100 #f1f5f9`, muted text `slate-500 #64748b`, headings `slate-900 #0f172a`.
- **Theme constants** (light/dark) in `apps/mobile/constants/theme.ts`: text `#11181C`, bg `#fff`, tint `#0a7ea4`, icon `#687076` (light); `#ECEDEE` / `#151718` / `#fff` / `#9BA1A6` (dark).
- **Radius:** cards `rounded-2xl` (16px), sheets/big cards `rounded-[28px]`, buttons `rounded-xl/2xl`, badges `rounded-md`, pills `rounded-full`.
- **Shadows:** `shadow-sm shadow-slate-200/50` (cards), `shadow-sm shadow-blue-300/40` (primary card).
- **Type:** system fonts only (no custom font files). Scale: body 16/24, semibold 16/24/600, title 32/bold, subtitle 20/bold, labels `text-[10px]/[11px] uppercase tracking-wide(r/st)`.
- **Icons:** `lucide-react-native` on mobile → **`lucide-react`** on web (same icon names).
- **Buttons:** primary `bg-blue-600 text-white rounded-2xl py-3.5 font-bold`; secondary `bg-white border border-slate-200`; disabled `opacity-50`/`bg-slate-300`.
- **Segmented control:** `bg-slate-200/70 p-1.5 rounded-2xl`, active tab = white bg + `text-blue-600`.

**48 mobile components** to reproduce (catalogued by folder): `components/{attendance,teacher,quiz,exam,dashboard,live,leaderboard,gamification,ui}/*` + root themed primitives. The per-phase docs list which components each phase builds. The full catalogue is in the mobile design-system analysis; the implementer should open the matching `apps/mobile/components/...` file and reproduce its look with web Tailwind.

### 2.4 Data contract (reuse identically)

Mobile talks **directly to Supabase** (no BFF). The web app does the same. Three call shapes:

**(a) Edge functions** (privileged writes / signed URLs / grading) — via `lib/edge-fn.ts` (`invokeEdgeFn` adds the JWT; `invokeEdgeFnPublic` does not). Functions referenced by clients:

| Area | Edge functions used by the client |
|---|---|
| Auth | `auth-change-own-password` |
| Attendance | `attendance-qr-sign`, `attendance-qr-verify`, `attendance-correct`, `attendance-bulk-mark`, `attendance-manual-mark`, `attendance-unmark`, `session-create-ad-hoc` |
| Quizzes | `quiz-start`, `quiz-submit`, `quiz-attempt-result`, `quiz-image-presign`, `quiz-admin-mutate` (builder) |
| Exams | `exam-start`, `exam-submit`, `exam-attempt-result`, `exam-tab-switch`, `exam-release-results`, `exam-regrade`, `exam-admin-mutate` (builder), `offline-score-upsert`, `server-time` (public) |
| Content/Library | `content-presign-upload`, `content-finalize`, `content-create-video`, `content-pdf-sign`, `yt-playback-sign`, `yt-thumb-sign`, `content-toggle-publish`, `content-promote-coursewide`, `content-delete` |
| Live | `yt-broadcast-create`, `yt-broadcast-golive`, `yt-broadcast-stop`, `chat-delete`, `chat-ban` |
| Gamification | `badge-icon-sign` |

**(b) RPCs** — `supabase.rpc(...)`: `student_dashboard(p_student)`, `teacher_dashboard(p_teacher)`, `teacher_batch_overview(p_batch)`, `my_batch_leaderboard(p_scope)`, `student_public_card(p_student)`.

**(c) Direct table reads/writes guarded by RLS** — `supabase.from(...)`: dashboards/lists/progress (`attendance`, `sessions`, `mastery`, `streaks`, `activity_days`, `badges`, `badge_earnings`, `content_items`, `video_progress`, `pdf_progress`, `quizzes`, `quiz_attempts`, `quiz_answers`, `exams`, `exam_attempts`, `exam_answers`, `questions`, `question_options`, `chat_messages`, `chat_bans`, `raise_hand_events`, `students`, `batches`, `courses`, `subjects`, `chapters`, `topics`, …).

**61 mobile hooks** in `apps/mobile/features/*/` encapsulate all of this. Each per-phase doc maps the hooks it ports.

**6 realtime channels** (`supabase.channel(...).on('postgres_changes', …)` + `removeChannel` cleanup): `student-attendance-{id}`, `teacher-roster-{sessionId}`, `chat-{sessionId}`, `hands-{sessionId}`, `bans-{sessionId}`, `ban-{sessionId}-{userId}`.

---

## 3. Target architecture for `apps/web`

```
apps/web/
  app/
    layout.tsx                      root (fonts, providers, PWA meta)
    globals.css                     Tailwind 4 + design tokens (CSS vars)
    manifest.ts                     PWA manifest
    (auth)/                         public: login, forgot-password, reset, suspended
    onboarding/                     force-password-change, role-chooser, admin-redirect
    (student)/                      protected: layout (responsive shell) + 7 tab routes
      video/[contentId]/  pdf/[contentId]/  quiz/[id]/  exam/[id]/
      live/[sessionId]/   recording/[sessionId]/   modal route or dialog
    (teacher)/                      protected: layout + 8 tab routes
      quiz-builder/[quizId]/  exam-builder/[examId]/  exam-results/[examId]/
      offline-scores/   roster/[sessionId]/   live-control/[sessionId]/
  components/
    ui/                             shadcn primitives (button, card, dialog, input, sheet, table, tabs, …)
    fyne/                           ported FyneStudy components (dashboard/, quiz/, live/, …)
  features/                         TanStack Query hooks (ported 1:1 from mobile features/*)
  lib/
    supabase/{server,browser,middleware}.ts   @supabase/ssr clients
    auth.ts                         requireUser / requireStudent / requireTeacher
    edge-fn.ts                      invokeEdgeFn / invokeEdgeFnPublic (browser fetch + JWT)
    query.ts                        QueryClient + provider
  middleware.ts                     route protection + role machine
  sw.ts                             service worker (Serwist)
```

**Rendering model:** Server Components handle the protected-route shell + auth gating (via `middleware.ts` + `lib/auth.ts`, exactly like admin). **All feature data is fetched client-side with TanStack Query** inside Client Components, because the app is interactive and realtime-heavy. Realtime channels integrate with the Query cache (channel events invalidate/patch queries). This honors the repo convention ("Server state: TanStack Query") and keeps the exam/live/chat logic on the client where the mobile logic already lives.

**Auth model:** **`@supabase/ssr` cookie-based sessions** (httpOnly) — same as the admin app, *more secure than the mobile localStorage model*. The browser client (`createBrowserClient`) reads the cookie session for client-side queries + realtime; the server client + middleware handle SSR + redirects. Students/teachers do **not** need MFA (only admins do — and admins are redirected away).

---

## 4. Engineering decisions table (DEFAULTS — veto any before Phase 1)

| # | Topic | Default | Why |
|---|---|---|---|
| W-01 | App location | New `apps/web` in the **same monorepo** | One backend, shared packages, one deploy org. |
| W-02 | Framework | **Next.js 15.5.18 + React 19.1.0** (match admin exactly) | Consistency; reuse admin patterns. |
| W-03 | Auth | **`@supabase/ssr ^0.7.0`, cookie sessions** (copy admin's `lib/supabase-*.ts` + `middleware.ts`) | Secure (httpOnly), SSR-friendly, proven in admin. |
| W-04 | Styling | **Tailwind 4 + shadcn 4.7** (match admin) with the mobile palette ported as tokens | Mobile palette = standard Tailwind colors, ports verbatim; shadcn gives accessible primitives. |
| W-05 | Data fetching | **TanStack Query (client)** for all feature data; Server Components only for shell/auth | Repo convention; handles realtime + interactivity. |
| W-06 | Client state | `useState`/`useReducer`; Zustand only if cross-cutting | Same rule as mobile. |
| W-07 | Forms | **react-hook-form + zod** from `@fynestudy/shared` | Reuse existing schemas. |
| W-08 | Icons | **`lucide-react`** | Same icon names as mobile's `lucide-react-native`. |
| W-09 | DB types | **`@fynestudy/supabase-types`** | Already generated; shared. |
| W-10 | Edge-fn calls | Port mobile `lib/edge-fn.ts` to a **browser fetch** (`${url}/functions/v1/{name}` + `Authorization: Bearer <session jwt>`), preserving non-2xx status handling (423/409/429 etc.) | Mobile relies on reading real HTTP status; `functions.invoke` hides it. |
| W-11 | QR **scan** (teacher) | **`@yudiel/react-qr-scanner`** (uses `BarcodeDetector` with a zxing-wasm fallback) | Maintained, React-19 friendly, iOS-Safari capable. Lazy-loaded. |
| W-12 | QR **display** (student) | **`qrcode.react`** (admin already uses it) | Same lib already in the monorepo. |
| W-13 | YouTube player | **`react-youtube`** (IFrame API wrapper) — replaces `WrappedYtPlayer` | Gives play-state + `playbackRate` (recordings) + no-`controls=0` rule still applies. |
| W-14 | PDF viewer | **`react-pdf`** (pdf.js for React) + CSS watermark overlay | Native pdf.js on web (no WebView); D-174 pinch-zoom hack is *not* needed on web. |
| W-15 | Math (KaTeX) | **`katex` + `react-katex`** (server/client render) — replaces the WebView `MathText` | Native KaTeX on web is faster + cleaner than the mobile WebView approach. |
| W-16 | File upload (teacher) | HTML `<input type="file">` + the existing presign→PUT→finalize flow | No native picker needed on web. |
| W-17 | PWA | **`@serwist/next`** service worker + `app/manifest.ts` | Modern, App-Router compatible. |
| W-18 | Clipboard (live-control RTMP) | `navigator.clipboard` | Native browser API. |
| W-19 | Deploy | **Vercel** (separate project from admin), same Supabase env | Admin is already on Vercel. |
| W-20 | Screenshot prevention (PDF) | **Not enforceable on web** — keep the visible watermark only | Browser can't block screenshots; watermark is the real deterrent. |
| W-21 | Screen-orientation lock | **Drop** (responsive CSS instead) | Not applicable on web. |
| W-22 | Realtime ↔ Query | Channel events `queryClient.invalidateQueries`/`setQueryData`; **always `removeChannel` on unmount** | Prevents ghost subscriptions (mobile rule). |

> **Routing-group note (W-23):** mobile keeps `quiz/exam/video/pdf/live/recording/builder/roster/live-control` *outside* the tab group (mobile D-169/D-157) so they render full-screen without the tab bar. On web we reproduce this: those routes live under the `(student)`/`(teacher)` protected groups for auth, but their layout hides the side-rail/bottom-tabs and renders a focused full-width view.

---

## 5. The 6 mobile-only features → web equivalents

| Feature | Mobile impl | Web impl | Notes |
|---|---|---|---|
| Teacher QR **scan** | `expo-camera` `CameraView` in `(teacher)/scan.tsx` | `@yudiel/react-qr-scanner` → same `attendance-qr-verify` edge fn | Needs HTTPS + camera permission; provide a manual-mark fallback (already exists via roster) when no camera. |
| Student QR **display** | `react-native-qrcode-svg` in `QrDisplay.tsx` | `qrcode.react` | Token from `attendance-qr-sign`, 30s rotation (25s refresh). |
| **Video** player | `react-native-youtube-iframe` (`WrappedYtPlayer`) + rotating `Watermark` | `react-youtube` + absolutely-positioned watermark div | `video_id` only via `yt-playback-sign`; **never** set `controls=0` (D-173). |
| **PDF** viewer | WebView + pdf.js (`lib/pdf.ts`) + `PdfWatermark` | `react-pdf` + grid watermark overlay | Page progress via `pdf_progress`; signed URL via `content-pdf-sign`. |
| **Math** | WebView + KaTeX CDN (`MathText.tsx`) | `katex`/`react-katex` `MathText` | Render only when `$…$`/`$$…$$` detected (same heuristic). |
| Teacher file **upload** | `expo-document-picker` in `content.tsx` | `<input type="file">` | Same `content-presign-upload`→PUT→`content-finalize` flow. |

---

## 6. Backend reuse — the ONLY config changes (no schema changes)

1. **Supabase Auth → URL configuration:** add the web app's origin(s) to **Site URL / Redirect URLs** so the password-reset email link returns to `https://<web-domain>/reset` (and `http://localhost:3000/reset` for dev). Mobile used the `fynestudy://reset` deep link; web uses a normal URL + `detectSessionInUrl`.
2. **Edge-function CORS:** confirm the shared CORS helper allows the new web origin (mobile is native = no CORS; admin origin is already allowed). If functions echo an allow-list, add the web domain + `localhost:3000`.
3. **Env vars** (Vercel + `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable anon key — **never** the service-role key).

That's it. RLS, RPCs, triggers, cron, storage, realtime, and all 51 edge functions are reused without modification.

---

## 7. Conventions & acceptance philosophy

- **TypeScript strict**, no `any` without a justified comment. Files kebab-case, components PascalCase, hooks `useFoo`. Path alias `@/*` at app root; shared via `@fynestudy/*`.
- **Per phase:** `pnpm typecheck && pnpm lint && pnpm test` must be green, plus the phase's automated + **manual** test checklist on **Chrome desktop + iOS Safari + Android Chrome** before moving on. (Mirrors the mobile phase discipline.)
- **Each phase doc has:** Goal/DoD · Prerequisites · Scope (screens + hooks + components + edge fns) · Step-by-step build order · Gotchas (carried-over decisions) · Automated tests · Manual test checklist · Acceptance criteria.
- **Decisions log:** if you deviate from a default above, add a dated `W-DEC` note at the bottom of the relevant phase doc (don't silently diverge), mirroring `docs/decisions.md`.
- **Reliability beats cleverness; server enforcement beats client trust; documented beats undocumented.**
