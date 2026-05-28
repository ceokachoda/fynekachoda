# FyneStudy — Web App Conversion Phases

> **Goal:** Add a fourth surface to the FyneStudy platform — a **public, responsive, installable web app** (`apps/web`) that gives **students *and* teachers** the full FyneStudy experience in any modern browser (laptop, iPad/iOS Safari, Android Chrome), reusing the **exact same Supabase backend** that already powers the mobile app and the admin panel.
>
> Nothing about the backend changes. We are building a new front-end client only.

---

## What we are building (decided 2026-05-28)

| Decision | Choice |
|---|---|
| Build style | **A separate Next.js 15 web app** (`apps/web`), mirroring the existing admin app's stack — *not* an Expo-web reuse. |
| Audience | **Full parity**: students **and** teachers (admins keep using the existing admin panel; they are redirected to it). |
| Layout | **Responsive desktop layout** — side-rail nav + multi-column grids on wide screens, bottom tab bar on mobile-web. Exact mobile colors/components ported. |
| Install | **Installable PWA** — manifest + service worker, add-to-home-screen on iOS/Android. |
| Backend | **Unchanged.** Same Supabase project (`orqwyazvcthgxoadfxfv`), same 51 edge functions, same RLS, same 5 RPCs, same realtime. |

The full reasoning, the complete A-to-Z analysis of the current app, and every engineering-level default (auth model, Tailwind version, data-fetching pattern, the libraries chosen for QR/PDF/YouTube/KaTeX, etc.) live in **[`00-overview-and-architecture.md`](./00-overview-and-architecture.md)** — **read that first.**

---

## How to use this folder

These docs are **sequential**. Do them in order. Do not start Phase *N+1* until Phase *N*'s **Acceptance Criteria** are all ticked and its manual tests pass on Chrome desktop + iOS Safari + Android Chrome.

| # | Phase | What you can do at the end of it | Doc |
|---|---|---|---|
| 0 | Overview & Architecture | (reference — read before Phase 1) | [`00-overview-and-architecture.md`](./00-overview-and-architecture.md) |
| 1 | **Foundation, Auth & App Shell** | Log in as student/teacher on the web, get force-password-change / suspended / admin-redirect handling, see the responsive empty shell, install it as a PWA. | [`phase-1-foundation-auth-shell.md`](./phase-1-foundation-auth-shell.md) |
| 2 | **Student Learning Surfaces** | Dashboard, profile + mastery + badges, leaderboard, attendance (show QR + history), library, watch videos, read PDFs. | [`phase-2-student-learning-surfaces.md`](./phase-2-student-learning-surfaces.md) |
| 3 | **Assessments (Quizzes + Exams)** | Take practice quizzes and server-timed graded exams end-to-end, with math rendering, auto-save, results and solutions. | [`phase-3-assessments-quizzes-exams.md`](./phase-3-assessments-quizzes-exams.md) |
| 4 | **Live Classes + Teacher Portal** | Join live classes (chat + raise-hand) and watch recordings; full teacher tools incl. browser QR attendance scanning, builders, results, live control. | [`phase-4-live-classes-teacher-portal.md`](./phase-4-live-classes-teacher-portal.md) |
| 5 | **Hardening, QA & Launch** | Cross-browser + responsive + performance + security + accessibility hardening, full manual test plan, production deploy on the Vercel URL (custom domain optional later). | [`phase-5-hardening-qa-launch.md`](./phase-5-hardening-qa-launch.md) |

At the end of **Phase 5** the web app is feature-complete, hardened, and live on a public URL — fully converted.

### 🟢 New-conversation workflow — copy-paste prompts
For sanity (small context = better builds), **start a NEW Claude Code conversation for each phase** and paste the corresponding kickoff prompt from **[`PHASE-PROMPTS.md`](./PHASE-PROMPTS.md)**. Each prompt is self-contained: it tells the new conversation what to read, the locked decisions, the hard rules, the exact task, the tests, the acceptance criteria, and a clear stop condition. Five prompts total — one per phase.

---

## Ground rules carried over from the mobile build (still apply)

These are non-negotiable and are repeated in each phase where relevant:

- **Every user-data table has RLS on.** The web app uses the **anon key only** + the logged-in user's JWT. **No service-role key in `apps/web`, ever.**
- **Every privileged write goes through an edge function** (the same ones the mobile app uses). The web app never writes privileged data directly.
- **Server is the only source of truth for the exam timer + QR validity.** Never trust the browser clock.
- **Never send `is_correct` to the client during a quiz/exam attempt.** (Already enforced server-side; don't add a client path that breaks it.)
- **Never expose YouTube video IDs or stream keys to non-creators** — always go through `yt-playback-sign`.
- **All Storage buckets stay private** — access via short-lived signed URLs only (via the existing `*-sign` edge functions).
- **Copy the exact design.** Colors, spacing, radii, component look must match the mobile app 1:1 (tokens are catalogued in the overview doc).

---

## Timeline (honest note)

A separate Next.js rebuild at *full parity* is genuinely **multi-session** work (≈36 distinct screens, several of them complex state machines). These docs are the complete, locked plan so the build can proceed phase-by-phase without re-deciding anything. Treat each phase as its own focused work session with its own QA sign-off — exactly like the mobile phases in `docs/phases/`.

> This folder (web conversion) is **separate** from `docs/phases/` (the mobile build, Phases 1–12). Don't confuse the two.
