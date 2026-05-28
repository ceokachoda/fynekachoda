# Phase 1 — Foundation, Auth & App Shell

> **Read [`00-overview-and-architecture.md`](./00-overview-and-architecture.md) first.** This phase stands up the `apps/web` skeleton: the design system, the Supabase cookie-auth, the full login/onboarding flow, the responsive shell (side-rail desktop / bottom-tabs mobile), and PWA installability — deployed to Vercel. No feature screens yet beyond a placeholder home per role.

---

## Goal / Definition of Done

A real user can:

1. Open the web URL on a laptop, iPhone (Safari), or Android (Chrome).
2. **Log in** with their FyneStudy email + password.
3. Be routed correctly: **student → student shell**, **teacher → teacher shell**, **multi-role → role-chooser**, **admin → redirected to the admin panel**, **suspended → suspended screen**, **first login → force-password-change**.
4. See the **responsive empty shell** with the FyneStudy branding, exact colors, nav (side-rail on desktop, bottom tabs on mobile-web), and a profile menu with **Sign out**.
5. **Install the app** ("Add to Home Screen") on mobile and as a desktop PWA.

Everything is typechecked, linted, builds clean, deploys to Vercel, and the auth E2E + RLS smoke pass on all three browsers.

---

## Prerequisites

- Repo on a fresh branch: `git checkout -b web-phase-1` (off the current `phase-4`/`main` tip).
- Node + pnpm already set up (this is the existing monorepo).
- Access to the Supabase dashboard (to add redirect URLs) and a Vercel account.
- A test **student**, **teacher**, **multi-role**, and **suspended** account (use the admin panel to create them, or reuse seed accounts; see `CREDENTIALS.local.md`).

---

## Scope

### Screens (8 auth/entry + shells)
| Web route | Mirrors mobile | Notes |
|---|---|---|
| `/login` | `app/login.tsx` | Email+password, FyneStudy logo, branded. |
| `/forgot-password` | `app/forgot-password.tsx` | Sends Supabase reset email → `redirectTo` web `/reset`. |
| `/reset` | `app/reset.tsx` | Handles recovery session from URL, sets new password. |
| `/force-password-change` | `app/force-password-change.tsx` | Calls `auth-change-own-password`; clears `must_change_password`. |
| `/suspended` | `app/suspended.tsx` | Static "account deactivated" screen. |
| `/admin-redirect` | `app/admin-redirect.tsx` | Tells admin-only users to use the admin panel + link. |
| `/role-chooser` | `app/role-chooser.tsx` | Student+teacher users pick which experience. |
| `(student)/` & `(teacher)/` layouts | `(student)/_layout.tsx`, `(teacher)/_layout.tsx` | Responsive shell only (placeholder home content). |
| `/` (root) | (middleware/redirect) | Redirects to `/login` if unauth, else to the correct role group. |
| `/privacy` | (new public page) | Hosts `docs/legal/privacy-policy.md` — closes the mobile carry-over "Phase 12 deferred /privacy Vercel hosting route". |
| `/terms` | (new public page) | Static Terms of Use page (basic). |
| Error / 404 / Loading | `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` | Branded fallbacks at the app root + per route group. |

### Components built this phase (the design-system foundation)
- **shadcn primitives:** `button`, `card`, `input`, `dialog`, `sheet`, `dropdown-menu`, `tabs`, `skeleton`, `table` (install via `pnpm dlx shadcn add ...`).
- **FyneStudy primitives** (`components/fyne/`): `FyneLogo`, `SplashOverlay`, `AppShell` (responsive nav frame), `SideRail`, `BottomTabs`, `TopBar`, `ProfileMenu`, `PageHeader`, `EmptyState`, `Segmented` (segmented control), `StatusBadge`/`Pill`, `ListRow`. These reproduce the mobile look from `apps/mobile/components/*` (`FyneStudyLogo.tsx`, `SplashOverlay.tsx`, themed primitives) — open those for exact styling.

### Hooks / lib built this phase
- `lib/supabase/{server,browser,middleware}.ts`, `lib/auth.ts`, `lib/edge-fn.ts`, `lib/query.ts` (+ `QueryProvider`).
- `features/auth/`: `SessionProvider` (client context: `session`, `appUser`, `roles`, `isLoading`, `refresh`), `useSession`, `useRole` (ported from `apps/mobile/features/auth/*`).

### Edge functions / RPC used
- `auth-change-own-password` (force-password-change + reset).
- Direct reads of `app_users` + `user_roles` for the session profile (RLS-guarded, own-row).

---

## Step-by-step build order

### A. Scaffold `apps/web`
1. `mkdir apps/web` and create a Next.js 15 app *matching admin's versions* (copy `apps/admin/package.json` as the template; set `"name": "@fynestudy/web"`). Pin: `next 15.5.18`, `react`/`react-dom` `19.1.0`, `@supabase/ssr ^0.7.0`, `@supabase/supabase-js ^2.105.4`, `tailwindcss ^4`, `@tailwindcss/postcss ^4`, `shadcn ^4.7.0`, `lucide-react ^1.16.0`, `zod ^3.24.0`, `react-hook-form ^7.54.0`, `@hookform/resolvers ^3.9.0`, `clsx`, `tailwind-merge`, `class-variance-authority`. Add `@tanstack/react-query ^5`, `qrcode.react ^4.2.0`, `@serwist/next` + `serwist`. **Test harness deps:** `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`. Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"e2e": "playwright test"`, `"typecheck": "tsc --noEmit"`, `"lint": "next lint"`.
2. Add `apps/web` to `pnpm-workspace.yaml` (already globs `apps/*` — confirm). Run `pnpm install` from repo root.
3. Copy `apps/admin/tsconfig.json` path aliases (`@/*`, `@fynestudy/shared`, `@fynestudy/supabase-types`, `@fynestudy/ui-tokens`). Verify `pnpm --filter @fynestudy/web typecheck` runs.
4. Copy `apps/admin/postcss.config.mjs`, `next.config.ts` (extend for Serwist later), `components.json` (style `radix-nova`, lucide).

### B. Design tokens (exact mobile palette)
5. Create `app/globals.css` based on admin's, **but override the theme tokens with the mobile palette** from §2.3 of the overview. Define CSS variables for `--primary: #2563eb`, success/error/warning/slate scale, radii (`--radius` plus the `28px` sheet radius), and shadow utilities. The mobile palette uses standard Tailwind color names, so most components can just use `bg-blue-600`, `text-slate-900`, etc. — but set `--primary`/`--background`/`--foreground`/`--border`/`--muted` to the mobile values so shadcn components inherit the FyneStudy look.
6. Build the `components/fyne/` primitives to match `apps/mobile/components/`:
   - `FyneLogo` ← `FyneStudyLogo.tsx` (reproduce the blue→dark gradient SVG + wordmark; `large` and `header` variants).
   - `SplashOverlay` ← `SplashOverlay.tsx` (full-screen logo + spinner + backend-status dot).
   - Card/Button/Badge/Segmented/ListRow/EmptyState/PageHeader matching the patterns in overview §2.3.
7. **Visual check:** render a `/_styleguide` dev-only page showing every primitive + the palette swatches; eyeball against the mobile app screenshots.

### C. Supabase cookie-auth (copy admin, adapt roles)
8. Copy `apps/admin/lib/supabase-server.ts`, `supabase-browser.ts`, `supabase-middleware.ts` → `apps/web/lib/supabase/{server,browser,middleware}.ts`. Switch `createBrowserClient`/`createServerClient` to use `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`. Set `detectSessionInUrl: true` on the browser client (needed for the `/reset` recovery link).
9. Copy `apps/admin/middleware.ts` and **adapt the role machine** for students/teachers (the admin machine requires aal2/MFA — we do NOT):
   - Public paths: `/login`, `/forgot-password`, `/reset`, `/suspended`, `/manifest.webmanifest`, `/_next/*`, icons.
   - Funnel paths: `/force-password-change`, `/role-chooser`, `/admin-redirect`.
   - Machine (in order): no user → `/login`; not in `app_users` → `/login`; `is_active=false` → `/suspended`; roles ⊇ admin **and** no student/teacher role → `/admin-redirect`; `must_change_password` → `/force-password-change`; multi-role (student **and** teacher) and no role chosen (cookie/query) → `/role-chooser`; else allow. Mirror the routing logic in `apps/mobile/app/index.tsx` + `SessionProvider` (see memory note: auth routers must WAIT during profile-load; broken account → admin-redirect not login).
10. `lib/auth.ts`: `requireUser()`, `requireStudent()`, `requireTeacher()` returning a typed `WebSession { app_user_id, email, full_name, roles, must_change_password, access_token }` (model on `apps/admin/lib/auth.ts`). Server Components in `(student)`/`(teacher)` call these.
11. `lib/edge-fn.ts`: port `apps/mobile/lib/edge-fn.ts` — `invokeEdgeFn<T>(name, body)` does `fetch(`${url}/functions/v1/${name}`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, apikey, 'content-type':'application/json' }, body })` and **returns `{ status, body, error }` preserving non-2xx** (the app needs 423/409/429). Token comes from the browser client's session. `invokeEdgeFnPublic` omits `Authorization` (for `server-time`).

### D. Auth + onboarding screens
12. `/login`: react-hook-form + zod; `supabase.auth.signInWithPassword`; on success `router.refresh()` so middleware re-routes. Reproduce the mobile login visual (`apps/mobile/app/login.tsx`): logo, heading, email/password, primary button, "Forgot password?" link. Show inline errors.
13. `/forgot-password`: `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset` })`. Confirmation copy.
14. `/reset`: on mount the browser client picks up the recovery session from the URL (`detectSessionInUrl`); show new-password form → call `auth-change-own-password` (clears flag + audit) → redirect to `/`.
15. `/force-password-change`: same component as reset but for logged-in `must_change_password=true`; **do not** call `supabase.auth.updateUser` directly — use `auth-change-own-password` (carries over mobile D-153 rationale: keep audit + flag-clear server-side and consistent).
16. `/suspended`, `/admin-redirect` (with a button linking to the admin URL), `/role-chooser` (two big cards "Continue as Student" / "Continue as Teacher"; persist choice in a cookie; multi-role users can switch later from the profile menu).

### E. Responsive app shell
17. `(student)/layout.tsx` & `(teacher)/layout.tsx` (Server Components): call `requireStudent()`/`requireTeacher()`, then render `<AppShell role=...>` (Client Component) wrapping `{children}` in `SessionProvider` + `QueryProvider`.
18. `AppShell`: at `lg` and up → `SideRail` (vertical nav, FyneLogo top, nav items with lucide icons, profile at bottom) + content area with a max-width container; below `lg` → `TopBar` (logo + profile) + `BottomTabs` (the mobile tab set). Nav items:
    - Student: Home, Classes, Library, Attendance, Ranks, Profile, Menu (icons: Home, Video, BookOpen, QrCode, Trophy, User, Menu).
    - Teacher: Home, Scan, Classes, Library, Quizzes, Exams, Batch, Profile (icons: Home, QrCode, Video, BookOpen, ListChecks, ClipboardCheck, Users, User).
19. `ProfileMenu`: name + role badge, "Switch role" (multi-role only), **Sign out** (`supabase.auth.signOut()` → `router.push('/login')`).
20. Placeholder home: each role's `index` shows a branded "Welcome, {name}" card + "Coming in Phase 2/4" note (so the shell is demonstrable).
21. **Focused/full-screen routes** (W-23): create a shared `FocusLayout` that the standalone routes (added in later phases) will use to hide the rail/tabs. Stub it now.

### F. PWA
22. `app/manifest.ts`: name "FyneStudy", short_name "FyneStudy", `display: "standalone"`, `theme_color: "#2563eb"`, `background_color: "#ffffff"`, icons from `store-assets/` (192/512 + maskable). Reference the existing app icon art.
23. `@serwist/next`: add `withSerwist` in `next.config.ts`, create `app/sw.ts` (precache the shell, network-first for API). Register only in production.
24. Add iOS PWA meta (`apple-touch-icon`, `apple-mobile-web-app-capable`) in `app/layout.tsx`.

### G. Backend config (no schema change)
25. Supabase dashboard → **Authentication → URL Configuration**: add `http://localhost:3000` and the future Vercel domain to **Redirect URLs** (so `/reset` works). Add the Vercel domain to **Site URL** allow-list.
26. Confirm edge-fn CORS allows the web origin (check the shared CORS header in `apps/functions/_shared/`; add `localhost:3000` + the web domain if it's an allow-list). Test `server-time` from the browser (it's public) to confirm CORS.

### H. Deploy
27. New Vercel project rooted at `apps/web` (monorepo: set root directory + `pnpm` build). Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Deploy. Update the Supabase redirect URLs with the real Vercel domain.

### I. Error handling, legal pages, and test harness
28. **Root `/` page:** create `app/page.tsx` (Server Component) that calls `supabase.auth.getUser()` — if no user → `redirect('/login')`, else → `redirect('/(student)' | '/(teacher)' | '/role-chooser' | '/admin-redirect')` per the role machine. Middleware will already handle most of this; this page is the polite fallback.
29. **Error / 404 / Loading:** add `app/error.tsx` (branded error fallback with a "Try again" button — wraps a client component using the `error.tsx` segment convention), `app/not-found.tsx` (branded 404 with a link home), `app/loading.tsx` (branded spinner using `SplashOverlay`). Also add `(student)/loading.tsx` and `(teacher)/loading.tsx` so route transitions are smooth.
30. **Legal pages (public, no auth):** `/privacy` renders the content of `docs/legal/privacy-policy.md` (use `next-mdx-remote` or a simple server-rendered import + a markdown→HTML helper) and `/terms` renders a basic Terms of Use page. Add both to the **public paths** allow-list in `middleware.ts`. This **closes the Phase-12 mobile carry-over** "deferred `/privacy` Vercel hosting route" — the Play Store privacy URL can now point to `https://<vercel-url>/privacy`.
31. **Test harness:**
    - `vitest.config.ts` with `environment: 'jsdom'`, `setupFiles: './vitest.setup.ts'` (imports `@testing-library/jest-dom`). Sample unit test under `lib/__tests__/edge-fn.test.ts` (mocks `fetch`, asserts non-2xx preservation).
    - `playwright.config.ts` (baseURL = `http://localhost:3000`, projects: chromium-desktop, webkit-iphone, chromium-android). Sample E2E `e2e/auth.spec.ts` per the "Automated tests" section below.
    - Add CI step: `pnpm --filter @fynestudy/web typecheck && lint && test && build`.
32. **Sign-out everywhere:** `ProfileMenu`'s sign-out button calls `supabase.auth.signOut()` then `router.push('/login')`. Confirm the cookies are cleared so the back button can't re-enter the app (test on iOS Safari).

---

## Gotchas / carried-over decisions

- **Auth router must wait** during the post-login profile-load window or you get an index↔login navigation loop (mobile lesson, memory `project_auth-client-timeouts` rule 5). In Next this maps to: middleware does the redirect server-side (no flicker); client `SessionProvider` shows `SplashOverlay` until `appUser` resolves.
- **`auth-change-own-password`, not `updateUser`** for both reset and force-change (D-153) — keeps audit + flag-clearing atomic and server-side.
- **Cookie auth** means client-side `supabase.auth.getSession()` works after SSR because `@supabase/ssr` syncs cookies ↔ client. Don't hand-roll storage.
- **Service-role key must never appear in `apps/web`** — anon key only.
- **CORS:** unlike the native app, the browser enforces CORS on every edge-fn call. If a function 403s with no body in the browser but works in the app, suspect CORS, not auth.

## Automated tests
- `pnpm --filter @fynestudy/web typecheck && lint && build` green.
- **Auth E2E** (Playwright, add `apps/web/e2e/auth.spec.ts`): login as student → `/(student)`; teacher → `/(teacher)`; multi-role → `/role-chooser`; admin → `/admin-redirect`; suspended → `/suspended`; wrong password → inline error; sign-out → `/login`.
- **RLS smoke** (`apps/web/scripts/smoke-rls.ts` or reuse mobile's): with a student JWT, a `from('app_users').select()` returns only own row; cannot read another student's `exam_answers`.
- **Lighthouse PWA** check (CI or manual): installable = yes.

## Manual test checklist (Chrome desktop + iOS Safari + Android Chrome)
1. Visit URL → redirected to `/login` (not logged in).
2. Log in as **student** → lands on student home, side-rail on desktop / bottom tabs on phone. Colors match the mobile app.
3. Log in as **teacher** → teacher shell + teacher nav.
4. **Multi-role** account → role-chooser → pick Teacher → teacher shell; profile menu → Switch role → Student.
5. **Admin** account → `/admin-redirect` with a working link to the admin panel.
6. **Suspended** account → `/suspended`, cannot reach any tab.
7. **First-login** account → forced to `/force-password-change`; after change, lands on home; logging out + back in does **not** re-prompt.
8. **Forgot password** → email arrives → link opens `/reset` → set new password → can log in.
9. **Sign out** from profile menu → `/login`; back button doesn't re-enter the app.
10. **Install PWA**: iOS Safari "Add to Home Screen" + Android "Install app" → opens standalone with the FyneStudy icon + splash.
11. Rotate phone / resize browser from 320px → 1440px: layout switches between bottom-tabs and side-rail cleanly, no overflow.

## Acceptance criteria
- [ ] `apps/web` builds, typechecks, lints clean; deployed to Vercel.
- [ ] All 8 auth/entry routes work and route correctly per role/status (E2E green).
- [ ] Responsive shell matches mobile design tokens (side-rail desktop / bottom-tabs mobile).
- [ ] Force-password-change + forgot/reset flows use `auth-change-own-password`; audit row written.
- [ ] PWA installable on iOS + Android; standalone launch works.
- [ ] No service-role key in the web bundle; RLS smoke green; CORS verified.
- [ ] `/privacy` + `/terms` public pages live; `app/error.tsx` + `app/not-found.tsx` + `app/loading.tsx` present and branded.
- [ ] Test harness (Vitest + Playwright) wired with at least the sample unit + the auth E2E green.
- [ ] Manual checklist passes on Chrome desktop + iOS Safari + Android Chrome.
