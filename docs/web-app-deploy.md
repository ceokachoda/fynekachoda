# Web App — Deploy & Launch Guide (`apps/web`)

The FyneStudy web app is a **Next.js 15 PWA** (students + teachers, full parity with the
mobile app) that reuses the **existing Supabase backend** (`orqwyazvcthgxoadfxfv`,
`fynestudy-dev` = production). It deploys to **Vercel**, exactly like the admin app.

> **TL;DR for the owner:** the backend is already configured (done for you — see
> §1). You only need to (1) create a Vercel project named **`fyne-study-web`**
> pointed at `apps/web`, (2) add 2 environment variables, (3) deploy. Then run the
> smoke checks in §6. Full steps below.

---

## 1. Backend — ALREADY DONE (no action needed)

These were applied to the production Supabase project on 2026-05-29:

| Change | Status | Detail |
|---|---|---|
| Edge-fn **CORS** allows the web origin | ✅ Deployed | `apps/functions/_shared/cors.ts` now allows `https://fyne-study-web.vercel.app`, its preview deploys (`fyne-study-web-*.vercel.app`), and `localhost`. **All 52 edge functions were redeployed.** |
| Supabase Auth **redirect URLs** | ✅ Set | `site_url = https://fyne-study-web.vercel.app`; allow-list includes the web prod + preview + `localhost:3000` + admin origins (needed for the password-reset email link → `/reset`). |
| Exam **answer-key leak** fix | ✅ Migrated + deployed | Migration `20260529120000_exam_attempts_hide_snapshot.sql` revokes `exam_attempts.question_snapshot` from logged-in users; new `exam-answer-keys` edge fn serves it to teachers only. (See `docs/decisions.md` / phase-5 W-DEC.) |
| `health` / `server-time` stay public | ✅ Preserved | Redeployed with `verify_jwt = false`. |

> **⚠ The Vercel project MUST be named `fyne-study-web`** so its URL becomes
> `https://fyne-study-web.vercel.app` — that exact host is what the edge-fn CORS
> allow-list and the Supabase redirect URLs were configured for. If you name it
> something else, the web app's privileged calls (QR, quiz/exam submit, live,
> chat) **and** the password-reset link will be blocked. If you must use a
> different name, tell me and I'll update `cors.ts` (+ redeploy) and the Supabase
> redirect URLs.

---

## 2. Create the Vercel project (owner — one time)

1. Go to **vercel.com → Add New → Project** and import this GitHub repo.
2. **Project Name:** `fyne-study-web` (exactly — see the warning above).
3. **Framework Preset:** Next.js (auto-detected).
4. **Root Directory:** `apps/web` (click *Edit* and select it). This is a pnpm
   monorepo; Vercel installs workspace deps from the repo root automatically — set
   it up the same way the admin app (`fyne-study-app-admin`) is configured.
   - Build command: `next build` (default) — leave as is.
   - Install command: leave default (Vercel detects `pnpm` from the root lockfile).
   - Output: `.next` (default).
5. Add the **environment variables** in §3, then click **Deploy**.

The production URL will be **`https://fyne-study-web.vercel.app`**.

---

## 3. Environment variables (set in Vercel → Settings → Environment Variables)

Add these for **Production, Preview, and Development** scopes:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://orqwyazvcthgxoadfxfv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9` |

Optional (only if you attach a custom domain later — see §7):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://app.yourdomain.com` (your custom domain) |

> These are **publishable** (anon) keys — safe to expose to the browser. **Never**
> add the Supabase *service-role* key to Vercel; the web app never uses it.

---

## 4. Build / deploy / rollback

- **Deploy:** every push to the connected branch triggers a Vercel build. Promote a
  preview to Production from the Vercel dashboard, or push to the production branch.
- **Local production build (sanity):**
  ```bash
  pnpm --filter @fynestudy/web build      # must succeed; emits public/sw.js
  pnpm --filter @fynestudy/web start       # serve the prod build locally
  ```
- **Rollback:** Vercel → Deployments → pick a previous green deploy → **Promote to
  Production** (instant; no rebuild).
- **Gates before any deploy** (all currently green):
  ```bash
  pnpm --filter @fynestudy/web typecheck
  pnpm --filter @fynestudy/web lint
  pnpm --filter @fynestudy/web test        # 196 unit tests
  pnpm --filter @fynestudy/web build       # 38 routes + sw.js
  ```

---

## 5. Re-deploying edge functions (only if `apps/functions` changes)

The backend is already deployed. If you ever change an edge function or
`_shared/cors.ts`, redeploy via the repo's staging pattern (D-170/D-187 — no
Docker needed):

```bash
node scripts/stage-functions-deploy.cjs       # prints WORKDIR
# deploy ALL (preserves health/server-time verify_jwt via the staged config.toml):
npx supabase functions deploy --workdir "<WORKDIR>" --project-ref orqwyazvcthgxoadfxfv
# or a single fn:
npx supabase functions deploy <name> --workdir "<WORKDIR>" --project-ref orqwyazvcthgxoadfxfv
```
Requires `SUPABASE_ACCESS_TOKEN` in the environment (a Supabase Personal Access
Token, `sbp_…`).

---

## 6. Production smoke test (owner — after first deploy)

Open `https://fyne-study-web.vercel.app` on a **phone** and a **laptop** and run, at
minimum (full plan in `Phases/phase-5-manual-tests.md`):

1. **§A** Log in as a student → dashboard loads. Log out (Profile → Sign out).
2. **§A** Forgot password → check the reset email link opens `…/reset` and works.
3. **§D** Open a video and a PDF in Library → they play / render with the watermark.
4. **§E** Start a quiz → answer → submit → see solutions.
5. **§G** (if you have a live session) join a live class → chat + raise hand work.
6. **§H** Log in as a teacher → scan/roster, builders, results load.
7. **§J** DevTools → Network during a quiz/exam → **no `is_correct`** in any response;
   View Source → **no service-role key**.
8. Install the PWA (desktop install icon / Android prompt / iOS Share → Add to Home
   Screen) and confirm it opens standalone.

---

## 7. Attaching a custom domain later (optional)

1. Vercel → Project → **Settings → Domains** → add e.g. `app.fynestudy.com` and
   follow the DNS instructions.
2. Add the domain to the **edge-fn CORS** allow-list: edit
   `apps/functions/_shared/cors.ts` (add `"https://app.fynestudy.com"` to
   `ALLOWED_ORIGINS`) and redeploy the functions (§5).
3. Add it to **Supabase → Auth → URL Configuration**: set it as a Redirect URL
   (`https://app.fynestudy.com/**`) and optionally as the Site URL. (Or ask me to
   do it via the Management API.)
4. Set `NEXT_PUBLIC_SITE_URL=https://app.fynestudy.com` in Vercel so SEO metadata
   (`robots.txt`, `sitemap.xml`, OpenGraph) points at the custom domain.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Privileged calls fail with a CORS error in the browser console | The Vercel project isn't named `fyne-study-web` (so its origin isn't in the CORS allow-list). Rename it, or ask me to add the actual origin to `cors.ts` + redeploy. |
| Password-reset email link 404s / "redirect not allowed" | The deployed origin isn't in Supabase Auth → Redirect URLs. It's set for `fyne-study-web.vercel.app`; adjust if your URL differs. |
| YouTube player or PDF blank | CSP too strict — confirm `next.config.ts` CSP allows `https://www.youtube.com`, `https://www.youtube-nocookie.com`, and `worker-src 'self' blob:` (it does by default). |
| "Missing env: NEXT_PUBLIC_SUPABASE_URL" at build/runtime | Env vars not set in Vercel (§3). |
| Teacher exam-results "answer-keys failed" | The `exam-answer-keys` edge fn must be deployed (it is). If you reset functions, redeploy it (§5). |

---

## 9. Monitoring (deferred — same as mobile)

Sentry + PostHog remain **deferred** (mirroring the mobile decision). Caught
exceptions route through `apps/web/lib/log.ts` (`logError`) — wiring Sentry later is
a one-file change (swap that function's body). `console.error`/`console.warn`
survive the production build and show in Vercel logs.
