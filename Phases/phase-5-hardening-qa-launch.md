# Phase 5 — Hardening, QA & Launch

> **Prerequisite:** Phase 4 accepted (full feature parity reached). This phase makes the web app **production-grade**: responsive + cross-browser + performance + security + accessibility hardening, a full click-by-click manual test plan, and the production launch on a custom domain. Nothing new is *built* here functionally — everything is *verified, polished, and shipped*.

---

## Goal / Definition of Done

The web app is **live on a public custom domain**, installable as a PWA, and has passed:
- Responsive QA on phone/tablet/desktop widths for **every** screen.
- Cross-browser QA: Chrome (desktop + Android), Safari (iOS + macOS), Edge, Firefox.
- A performance budget (Lighthouse + bundle size + realtime/player hygiene).
- A security review (RLS from web, no service-role, signed URLs, no answer-key leak, CSP, CORS locked).
- An accessibility pass (keyboard, focus, contrast, reduce-motion).
- The full **§A–§J manual test plan** (below) on the three primary browsers.
- Docs + `CLAUDE.md` updated; web build documented in a launch guide.

---

## Prerequisites
- Phase 4 acceptance ticked (parity reached).
- A custom domain available (e.g., `app.fynestudy.com`) or the decision to launch on the Vercel domain.

---

## Work items

### A. Responsive & visual polish
1. Walk every route at **375px (phone), 768px (tablet), 1280px + 1440px (desktop)**. Fix: overflow, cramped grids, oversized hit targets, text truncation. Confirm the side-rail↔bottom-tabs switch at the `lg` breakpoint is clean.
2. Desktop polish: dashboards and lists use **multi-column grids + max-width containers** (not a stretched phone column). Hover states on interactive rows/cards. Empty states centered.
3. Side-by-side compare against the mobile app for color/spacing/radius fidelity (the design tokens are in `00-overview-and-architecture.md §2.3`).

### B. Cross-browser
4. Matrix test (login → a student flow → a teacher flow → a quiz → a live/recording → PDF/video): **Chrome desktop, Chrome Android, Safari iOS, Safari macOS, Edge, Firefox.** Note iOS Safari quirks: `getUserMedia` (scanner) needs HTTPS + gesture; video `playsinline`; `100vh` → use `100dvh`; date inputs; PWA install via Share→Add to Home Screen.
5. Fix any browser-specific breakage (esp. the QR scanner on iOS and the YouTube IFrame autoplay-gesture rule, D-173).

### C. Performance budget
6. **Code-split the heavy libs** so they're not in the initial bundle: `react-pdf`/pdf.js, `react-youtube`, `@yudiel/react-qr-scanner`, `katex`, `canvas-confetti` → dynamic `import()` / `next/dynamic` on the screens that use them.
7. Use `next/image` for thumbnails/avatars; signed badge/thumb images via the `*-sign` fns.
8. **Realtime hygiene audit:** grep for every `supabase.channel(` and confirm a matching `removeChannel` on unmount (no ghost subscriptions). Confirm **only one media player** is ever mounted (unmount on navigate/blur).
9. Lighthouse (mobile + desktop) on key routes; targets: Performance ≥ 80 mobile, PWA installable = pass, no layout-shift on the dashboard. Run `@next/bundle-analyzer`; keep route chunks lean.
10. TanStack Query: sensible `staleTime`/`gcTime`; don't refetch storms on focus for the heavy RPCs (mirror the mobile 60s caches, e.g., leaderboard).

### D. Security review
11. Run the **`rlscheck`** skill against the project; confirm: every user-data table has RLS; web uses anon key only; **no service-role key in `apps/web`** (grep the build output); edge fns enforce JWT + `is_active`.
12. **No answer-key leak:** re-run the Phase-3 network assertion in production build — `is_correct`/option-correctness never sent during an attempt.
13. **Signed URLs only** for storage (video/pdf/badge/thumb); confirm they're short-lived and that raw bucket access 403s.
14. **No stream keys / video IDs** exposed to non-creators (live-control only; via `yt-*` fns).
15. **CSP + headers:** add a Content-Security-Policy (allow Supabase origin, YouTube iframe `https://www.youtube.com`, `https://www.youtube-nocookie.com`, KaTeX fonts/self, `blob:` for pdf.js/worker), `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, HSTS. Configure in `next.config.ts` headers or Vercel.
16. **CORS locked:** edge-fn CORS allow-list = the production web domain + `localhost:3000` only (remove wildcards if present).
17. Cookie auth: confirm `@supabase/ssr` cookies are httpOnly + secure in production.

### E. PWA finalize
18. Verify offline shell (service worker precache) loads the app frame offline; API calls fail gracefully with a banner. App icons (192/512 + maskable), splash, `theme_color`. Test "Add to Home Screen" on iOS + Android and desktop install.

### F. Accessibility
19. Keyboard navigation across nav + forms + dialogs (focus trap in modals, `Esc` to close). Visible focus rings. Color contrast AA on text/badges. Respect `prefers-reduced-motion` (gate confetti + transitions). `alt`/`aria-label` on icon-only buttons. Form labels tied to inputs.

### G. Full manual test plan (§A–§J) — run on Chrome desktop + iOS Safari + Android Chrome
Mirror the mobile phase manual-test discipline; click-by-click with expected output. Sections:
- **§A Auth & onboarding:** login (each role), forgot/reset, force-change, suspended, admin-redirect, role-chooser, sign-out, PWA install.
- **§B Student dashboard & profile:** all dashboard sections, badge celebration, streak modal, profile tabs, change password.
- **§C Attendance & leaderboard:** QR rotation + live mark, history, leaderboard scopes + public card.
- **§D Library & players:** drill-down + search, video (resume/watermark/controls), PDF (resume/watermark/zoom).
- **§E Quizzes:** full attempt + resume + solutions + math.
- **§F Exams:** instant + manual release, server timer + skew, tab-switch banner, auto-submit, locked results.
- **§G Live + recordings:** lobby→live, chat + rate-limit, raise-hand, bans, pinned, end-of-class; recording replay + speed; **one real OBS→YouTube dry-run**.
- **§H Teacher portal:** scan (+ denied fallback), classes/schedule/ad-hoc, content upload, quiz/exam builders, results release/regrade, offline scores, batch analytics, roster corrections, live-control.
- **§I Cross-cutting:** responsive 320→1440, cross-browser matrix, offline banner, deep-link/refresh-resume on quiz/exam/live.
- **§J Performance/security spot-checks:** Lighthouse pass, network has no `is_correct`, no service-role in bundle, signed-URL expiry.

Write this as `Phases/phase-5-manual-tests.md` (full click-by-click), record results inline (PASS/FAIL + patch notes), exactly like `docs/phases/phase-N-manual-tests.md`.

### G2. Basic SEO + meta (public pages only)
19a. Public routes (`/login`, `/privacy`, `/terms`) need a clean `<title>`/`<meta description>` + Open Graph image (use one from `store-assets/`). Auth-gated routes can have a neutral default title. Add `robots.txt` (allow `/`, `/privacy`, `/terms`; **disallow** everything under `(student)`/`(teacher)` and the focused routes — there's no value indexing auth-gated pages). Add a `sitemap.ts` covering only the public routes.

### G3. Monitoring (status: deferred — same as mobile)
19b. **Sentry + PostHog stay DEFERRED** for the web app, mirroring the mobile decision (see CLAUDE.md Phase-1 status — they were explicitly skipped on mobile, and Phase 12 kept them deferred). Add `console.error`s for caught exceptions + a simple `lib/log.ts` shim so wiring Sentry later is a one-file change. Do **not** ship a half-wired DSN. Note this as a `W-DEC` if anything changes.

### H. Launch
20. **Production deploy:** the Vercel project from Phase 1 is the production project — just promote the latest deploy. Production env vars must match dev (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). **Domain (decided 2026-05-28): launch on the `*.vercel.app` URL.** A custom domain is *optional* and can be attached later via Vercel → Domains; if/when added, also add it to Supabase **Redirect URLs / Site URL** and to edge-fn CORS — until then, ensure the `*.vercel.app` URL is in those allow-lists.
21. Final production smoke: log in on the real Vercel URL on a phone + a laptop; run §A + one flow each from §D/§E/§G/§H.
22. **Docs:** `docs/web-app-deploy.md` (how to build/deploy/rollback, env, current Vercel URL, Supabase config, how to attach a custom domain later), update `README.md`, and update **`CLAUDE.md`** (mark the web app shipped; add `apps/web` to the file entry points + module map; note it's the 4th surface on the same backend). Record any `W-DEC` deviations.

---

## Gotchas / carried-over decisions
- **`100vh` on iOS** overflows under the toolbar — use `100dvh`/`svh` for full-height screens (lobby, exam, players).
- **iOS PWA** has no `beforeinstallprompt`; instruct users via Share→Add to Home Screen; test standalone routing (auth cookies persist in standalone).
- **Don't regress the answer-key guarantee** when adding caching/prefetch — prefetching `quiz-start`/`exam-start` is fine (no answers), prefetching results is not (until released).
- **Service worker + auth:** don't cache authenticated API responses in the SW; precache only the static shell. A stale cached page must still hit the network for data.
- **CSP + YouTube + pdf.js:** the most common launch breakage is a too-strict CSP blocking the YT iframe or the pdf.js worker (`blob:`/`worker-src`). Test players *after* enabling CSP.

## Acceptance criteria
- [ ] Responsive QA passed for every screen at phone/tablet/desktop.
- [ ] Cross-browser matrix passed (Chrome desktop/Android, Safari iOS/macOS, Edge, Firefox).
- [ ] Lighthouse targets met; heavy libs code-split; realtime + player hygiene verified.
- [ ] `rlscheck` clean; no service-role in bundle; signed-URL-only storage; no answer-key leak; CSP + CORS locked; httpOnly cookies.
- [ ] PWA installs + offline shell works on iOS + Android + desktop.
- [ ] Accessibility pass (keyboard/focus/contrast/reduce-motion).
- [ ] `phase-5-manual-tests.md` §A–§J all PASS on the three primary browsers (incl. one real OBS dry-run).
- [ ] Live on the production Vercel URL (custom domain optional/later); Supabase redirect/CORS list the production origin; production smoke green.
- [ ] SEO meta + `robots.txt` + `sitemap.ts` on public pages; auth-gated pages disallowed from indexing.
- [ ] Sentry/PostHog status documented (deferred, mirroring mobile); `lib/log.ts` shim in place.
- [ ] `docs/web-app-deploy.md` written; `README.md` + `CLAUDE.md` updated. **Conversion complete.**

---

## W-DEC — Phase 5 deviations (recorded 2026-05-29)

- **W-DEC-5.1 — Backend change beyond "front-end only".** The conversion rule is
  "front-end only," but the Phase-5 security review (verified by SQL) found a
  pre-existing **cross-surface** answer-key leak: `exam_attempts.question_snapshot`
  (pins `correct_option_id`) was readable by a student mid-exam (RLS filters rows,
  not columns). With the owner's approval, the fix touched the backend + BOTH
  clients: migration `20260529120000_exam_attempts_hide_snapshot.sql` (column
  revoke) + new `exam-answer-keys` edge fn + rerouted web **and** mobile
  `useExamResultsBoard` off the direct read. See **D-204**. Grading is unaffected
  (service-role). Mobile picks up its client change on its next build.
- **W-DEC-5.2 — CORS pinned to the `fyne-study-web` Vercel slug.** `_shared/cors.ts`
  allow-lists `https://fyne-study-web.vercel.app` + a `fyne-study-web-*.vercel.app`
  preview regex (mirroring the admin pattern). The Vercel project **must** be named
  `fyne-study-web` or privileged calls are CORS-blocked. A custom domain is added
  to the allow-list when attached (see `docs/web-app-deploy.md §7`).
- **W-DEC-5.3 — Supabase `site_url` set to the web prod URL + redirect allow-list
  expanded** (`localhost:3000`, web prod + preview, admin) so the `/reset` email
  link resolves. Admin + mobile use server-side / explicit-`redirectTo` reset
  flows, so they're unaffected. Backend config change per overview §6.
- **W-DEC-5.4 — KaTeX JS left route-confined (not further lazy-split).** Next's
  route-based code-splitting already keeps `react-katex` out of the initial/shared
  bundle (it ships only in `/quiz` + `/exam` chunks). The real bundle leak was the
  **global** `katex.min.css` `@import` in `globals.css`; that import was moved into
  the `MathText` module so the stylesheet travels only with the assessment routes.
  Satisfies §C6's intent without a higher-risk component refactor.
