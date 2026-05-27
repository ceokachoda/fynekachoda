# Deploy the FyneStudy Admin Panel to Vercel

> The admin panel (`apps/admin/`) is a Next.js app. Vercel rebuilds it automatically every time the **`main`** branch on GitHub (`DebugNova/FyneStudy-App`) changes. The current live deploy is old because `main` was behind. This doc gets the latest version live.

## What makes a Vercel deploy work (3 things)

1. **The latest code is on the `main` branch** (Vercel's production branch).
2. **The 2 environment variables are set** in the Vercel project (or the build fails).
3. **The project's "Root Directory" is `apps/admin`** (because this is a monorepo).

---

## Step 1 — Set the environment variables (you do this in the Vercel dashboard)

1. Go to **https://vercel.com** → log in → open the project that serves your admin panel (the one behind `https://admin-kohl-sigma.vercel.app/`, or whatever your admin URL is).
2. **Settings → Environment Variables.**
3. Add these two (tick **Production**, **Preview**, and **Development** for each):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://orqwyazvcthgxoadfxfv.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9` |

   Both are **publishable** values (safe to store here — they ship in the app anyway). You do **not** need `SUPABASE_SERVICE_ROLE_KEY` — the admin never uses it (all privileged writes go through edge functions). Leave Sentry/PostHog vars empty (not enabled yet).
4. Click **Save**.

## Step 2 — Verify the build settings (Vercel dashboard)

1. **Settings → General → Build & Development Settings.**
2. **Root Directory** must be **`apps/admin`**. If it isn't, click **Edit**, set it to `apps/admin`, **Save**. *(This is the most common reason the old deploy showed a blank/placeholder page.)*
3. **Framework Preset:** Next.js. **Install Command:** leave default (Vercel auto-detects pnpm). **Build Command:** leave default (`next build`).
   - The admin app has **no internal workspace dependencies**, so it builds standalone from `apps/admin` without needing the monorepo root — the defaults work.

## Step 3 — Get the latest code onto `main`

Your developer (or Claude Code) does this — it pushes all the work to `main`, which triggers Vercel to rebuild automatically:

```bash
# from the repo root, on the phase-4 branch with everything committed:
git checkout main
git merge phase-4        # fast-forward — main is a direct ancestor of phase-4
git push origin main     # this triggers the Vercel deploy
git checkout phase-4     # go back to the working branch
```

> If you'd rather not move everything onto `main`, you can instead change Vercel's **Production Branch** (Settings → Git) to `phase-4` and push that branch. But `main` is the conventional production branch.

## Step 4 — Watch the deploy & test it

1. In Vercel → **Deployments**, you'll see a new build start. It takes ~1–2 minutes.
2. If it **succeeds** (green): open your admin URL, log in as the owner, and confirm the new **Overview** dashboard, **/audit**, **/admins**, and **Students → Import CSV** pages all load.
3. If it **fails** (red): click the build → read the log. 99% of the time it's a missing env var (Step 1) or wrong Root Directory (Step 2). Fix and click **Redeploy**.

## Step 5 — Custom domain (optional, later)

Settings → **Domains** → add `admin.yourinstitute.in` (or similar) and follow Vercel's DNS instructions. Until then your `*.vercel.app` URL works fine.

---

## Quick troubleshooting

| Symptom | Fix |
|---|---|
| Blank page / "404" / placeholder | Root Directory not set to `apps/admin` (Step 2). |
| Build fails: "Missing env: NEXT_PUBLIC_SUPABASE_URL" | Env vars not set (Step 1), then Redeploy. |
| Login works but data is empty/errors | Env vars point at the wrong Supabase project — confirm the URL in Step 1. |
| New pages don't appear | The latest code isn't on `main` yet (Step 3). |
