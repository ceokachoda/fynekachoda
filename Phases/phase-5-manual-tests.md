# Phase 5 — Manual Test Plan (`apps/web` — Hardening, QA & Launch)

> **Audience:** the human running the tests. **Zero coding background required.** Every step gives the exact URL to type, the exact button/label to click, and exactly what you should SEE on screen. Number-by-number, click-by-click.
>
> **What you're testing:** the **whole web app** (`apps/web`) — a Next.js 15 PWA at full feature parity with the FyneStudy mobile app, talking to the same Supabase backend (`orqwyazvcthgxoadfxfv`). Phases 1–4 built every screen; **Phase 5 is the final hardening + launch sweep.** Nothing new is *built* here — everything is *verified, polished, and shipped*. This plan covers §A Auth → §J Performance/security spot-checks (the same §A–§J listed in `phase-5-hardening-qa-launch.md §G`).
>
> ---
>
> ## How to run this plan (READ FIRST)
>
> **Run every section on THREE browsers**, in this order:
> 1. **Chrome on a laptop/desktop** (the bulk of the work — do this first and fully).
> 2. **iOS Safari** on a real iPhone (camera, PWA "Add to Home Screen", `100dvh`, video `playsinline`).
> 3. **Android Chrome** on a real phone (install prompt, camera, layout).
>
> Each test row has a **Chrome / iOS / Android** tick set so you can record all three on one line.
>
> **Where is the app?** Two possible URLs:
> - **Local dev (Chrome desktop only):** `http://localhost:3000` — used for the §0 setup + the desktop sweep. **Camera + clipboard need HTTPS**, so the webcam-scan + RTMP-copy tests will only fully work on the deployed URL or `https://localhost`.
> - **Production:** the **Vercel `*.vercel.app` URL** (custom domain is optional and can be attached later — decision logged in `phase-5-hardening-qa-launch.md §H/20`). The phone tests (iOS Safari, Android Chrome) MUST use the HTTPS Vercel URL — phones can't reach your laptop's `localhost`. Write the exact production URL here once Phase 5 §H deploys it:
>
>    **PRODUCTION URL:** `https://__________________________.vercel.app`
>
> **How to record results:** every test ends with three tick sets, e.g.
> `Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A`.
> Tick one box per browser. If anything FAILs, write what you saw on the **"Notes / patch:"** line under each subsection and ping me — I'll diagnose. Mark **N/A** with a reason if a step doesn't apply (e.g. a desktop-only DevTools step on a phone).
>
> **Estimated time:** ~4 hours on Chrome desktop for §A–§J; ~1.5 hours each for the iOS + Android phone passes (skip the desktop-only DevTools rows on phones); +30 min for the §G real OBS→YouTube dry-run.
>
> **Golden rule:** if a step says "you should see X" and you see Y, that's a FAIL — write down exactly what Y was. Don't talk yourself into a pass.

---

## 🔑 Test accounts — quick reference

Same accounts as every prior phase. Source of truth: `CREDENTIALS.local.md` at the repo root (git-ignored — do not paste publicly).

| Use in section | Email | Password |
|---|---|---|
| **All student tests (§B–§F student side, §G student side)** | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **All teacher tests (§G teacher side, §H)** | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| **Admin → redirect test (§A)** | `owner@fynestudy.example.com` | `FyneOwner#2026` |
| Extra student (Aarav) — second-window realtime | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Extra student (Diya) | `test.diya@fynestudy.app` | `TestPass#2026` |

> **No multi-role test account exists** (never created). Where a step says "multi-role," mark it **N/A — account not provisioned** unless I tell you otherwise.

---

## Table of contents

- **§0 Setup** — branch, env, seed, dev server, DevTools, how to use the device emulator (8 tasks)
- **§A Auth & onboarding** — login (student/teacher/admin-redirect/suspended), forgot+reset email, force-password-change, role-chooser, sign-out (from Profile), PWA install (9 tests)
- **§B Student dashboard & profile** — greeting, next-card, stats, today's schedule, weak topics, continue-watching, recent badges, badge-celebration modal, streak modal, profile 3 tabs, change password, Terms & privacy, sign out (12 tests)
- **§C Attendance & leaderboard** — rotating QR (30s window / 25s refresh) + live teacher mark, history rings, leaderboard weekly/all-time + my-rank + public card + calc modal (7 tests)
- **§D Library & players** — Subject→Chapter→Topic→Item drill + search; video (resume sheet, watermark, no-controls=0, progress); PDF (resume page, tiled watermark, zoom +/-, page progress) (8 tests)
- **§E Quizzes** — intro→attempt→result→solution, flag, nav grid, auto-save + resume, KaTeX solutions, retake (7 tests)
- **§F Exams** — instant vs manual release, server timer + clock-skew, tab-switch banner, auto-submit at deadline, locked result card (6 tests)
- **§G Live + recordings** — lobby→go-live, chat + 5/30s rate-limit, raise-hand, ban + delete, pinned/announcement, end-of-class; recording replay + speed pills + chat replay; **one real OBS→YouTube dry-run** (10 tests)
- **§H Teacher portal** — scan (gesture + denied fallback), classes/schedule/ad-hoc, content upload, quiz + exam builder, results release + 3-mode regrade, offline scores, batch analytics, roster corrections, live-control (12 tests)
- **§I Cross-cutting** — responsive 320→1440 every route, cross-browser matrix, offline banner, deep-link/refresh resume, pinch-zoom, prefers-reduced-motion (7 tests)
- **§J Performance/security spot-checks** — Lighthouse ≥80 + PWA installable, no `is_correct` in network, no service-role in bundle, signed-URL expiry + raw-bucket 403, CSP not breaking YT/pdf.js, httpOnly+Secure cookies (8 tests)
- **§Z Acceptance sign-off** — tick boxes mirroring the hardening doc's "Acceptance criteria"

---

# §0 — Setup (do this once)

Allow ~10 minutes the first time.

### 0.1 — Confirm the repo + branch

**👉 Do this:**

1. Open **PowerShell** (`Win+R` → `powershell` → Enter).
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Check the branch:
   ```powershell
   git status
   ```

**✅ What you should see:**

- First line: `On branch web-phase-1` (all five web-conversion phases share this branch).
- `git status` also lists pre-existing unstaged edits under `apps/mobile/`, `docs/`, `apps/functions/`, etc. — leave them alone.

**❓ If something looks different:**

- `On branch main` → run `git checkout web-phase-1`.
- `fatal: not a git repository` → wrong folder; re-run the `cd`.

`Result:` Chrome [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.2 — Confirm `apps/web/.env.local` has the right keys (and NO service-role key)

**👉 Do this:**

1. In PowerShell:
   ```powershell
   notepad apps/web/.env.local
   ```

**✅ What you should see (in any order):**

```
NEXT_PUBLIC_SUPABASE_URL=https://orqwyazvcthgxoadfxfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9
NEXT_PUBLIC_ADMIN_URL=https://fyne-study-app-admin.vercel.app
```

There MUST NOT be any line containing `SUPABASE_SERVICE_ROLE_KEY` or `service_role`. If there is, **delete that line and save** — this is the single most important launch-blocker.

`Result:` Chrome [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.3 — Install dependencies

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm install
   ```
2. Wait ~20 seconds.

**✅ What you should see:** output ends with `Done in …`. Yellow `WARN` peer-dep lines are harmless.

`Result:` Chrome [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.4 — Seed all the fixtures you'll need

You need: a live session, an upcoming session, a recording, quizzes, exams (instant + manual), library content, leaderboard rows, and badge celebrations. Run all four seed scripts (each is idempotent with `--reset`).

**👉 Do this — from the repo root, one at a time:**

```powershell
pnpm seed:live-manual-test --reset
pnpm seed:quiz-manual-test --reset
pnpm seed:exam-manual-test --reset
pnpm seed:leaderboard-manual-test --reset
```

**✅ What you should see:** each ends with `✓ Seed complete` and prints IDs. **Write the Live session id, Recording session id, a quiz id, an instant-exam id, and a manual-exam id here** — you'll deep-link to them later:

- Live session id: `__________________________`
- Recording session id: `__________________________`
- Quiz id: `__________________________`
- Instant-release exam id: `__________________________`
- Manual-release exam id: `__________________________`

**❓ If something looks different:**

- "Missing service-role key" → the seed scripts need `SUPABASE_SERVICE_ROLE_KEY` in `apps/mobile/.env.local` or `apps/functions/.env.local` (this is fine — seeds run server-side, never in the web app).

`Result:` Chrome [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.5 — Start the dev server (leave running)

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm --filter @fynestudy/web dev
   ```
2. Wait ~15 seconds.

**✅ What you should see:**

```
   ▲ Next.js 15.5.18
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000
 ○ (serwist) Serwist is disabled.
 ✓ Ready in 3.4s
```

> `(serwist) Serwist is disabled` in dev is **correct** — the service worker only turns on in a production build (you'll verify the PWA in §A.9 + §J.2 against the production build / Vercel URL).

**Do NOT close this terminal.** `Ctrl+C` twice → `Y` when done.

`Result:` Chrome [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.6 — Open Chrome DevTools

**👉 Do this:**

1. Open **Google Chrome** → go to `http://localhost:3000` (you'll be redirected to `/login`).
2. Press **F12** to open DevTools.

**✅ What you should see:** the DevTools panel with `Elements · Console · Network · Application · Lighthouse · …` tabs.

`Result:` Chrome [ ] PASS — DevTools opens.

---

### 0.7 — Learn the DevTools device emulator (used in §I)

**👉 Do this (just learn it, no pass needed):**

1. In DevTools, click the **device toolbar** icon (top-left of DevTools, a phone+tablet icon) or press **Ctrl+Shift+M**.
2. A dropdown appears at the top of the page area labelled **Dimensions: Responsive**. You can type a width (e.g. `320`) into the width box, or pick a preset like `iPhone SE` / `iPad`.
3. Click the same icon again to exit emulation.

`Result:` Chrome [ ] PASS — I can resize with the emulator.

---

### 0.8 — How to set a phone's home-screen + camera permission (for iOS/Android passes)

When you do the iOS Safari + Android Chrome passes, you'll need the **production HTTPS URL** (camera + clipboard + PWA install don't work over plain `http://`). Keep the production URL from the top of this doc handy. On each phone:

- **iOS Safari:** open the production URL → log in once → the cookie session persists.
- **Android Chrome:** same.

`Result:` Chrome [ ] PASS — understood (no action on desktop).

---

# §A — Auth & onboarding

> Do §A on Chrome desktop first. The PWA-install row (§A.9) needs the **production HTTPS** build for iOS/Android.

### A.1 — Student login → dashboard

**👉 Do this:**

1. Go to `http://localhost:3000/login`.

**✅ What you should see (the login page):**

- A centered card on a subtle blue-tinted gradient background, with the FyneStudy logo.
- An **Email** field (auto-focused) and a **Password** field.
- A full-width blue **Sign in** button (tall, ~48px).
- A right-aligned **Forgot password?** link below.

2. Enter `review.student@fynestudy.app` / `ReviewStudent#2026` → click **Sign in**.

**✅ What you should see:**

- The button briefly reads **Signing in…**.
- URL changes to `http://localhost:3000/`.
- A large heading: `Good morning,` / `Good afternoon,` / `Good evening,` / `Hi,` + the student's first name (depends on IST time of day).
- On a wide window: a **left side-rail** with the FyneStudy logo + 6 nav items: **Home** (highlighted blue), **Classes**, **Library**, **Attendance**, **Ranks**, **Profile**.
- Console: no red errors.

> **Note:** the student nav is **6 items** (no "Menu" tab — it was removed; **Profile** is the only settings/sign-out surface).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### A.2 — Wrong password → inline error (no crash)

**👉 Do this:**

1. Sign out (we'll cover the proper sign-out in A.8; for now just go to `http://localhost:3000/login` in a fresh tab).
2. Enter `review.student@fynestudy.app` / `wrongpassword` → **Sign in**.

**✅ What you should see:**

- A red alert box appears above the button with text like **"Invalid login credentials"** (or similar).
- You stay on `/login`. No white-screen crash, no console red unhandled-rejection.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### A.3 — Teacher login → teacher dashboard

**👉 Do this:**

1. At `/login`, sign in as `review.teacher@fynestudy.app` / `ReviewTeacher#2026`.

**✅ What you should see:**

- URL `/`, greeting heading.
- The side-rail now shows **8 teacher nav items**: **Home, Scan, Classes, Library, Quizzes, Exams, Batch, Profile**.
- The teacher dashboard shows **Quick actions** tiles (Scan QR / New exam / Upload), a **Pending** section, and a **My batches** list.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### A.4 — Admin login → redirected away to the admin panel

**👉 Do this:**

1. Sign out / open a fresh `/login`.
2. Sign in as `owner@fynestudy.example.com` / `FyneOwner#2026`.

**✅ What you should see:**

- You are NOT taken to the student/teacher app. Instead you land on `/admin-redirect`, a centered card that explains admins use the admin panel, with a button/link to the admin URL (`https://fyne-study-app-admin.vercel.app`).
- (Admins have no `student`/`teacher` active role, so the app refuses to show student/teacher surfaces — this is correct.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### A.5 — Suspended-user screen (advanced — SQL)

> Skip if you don't want to touch SQL — mark N/A. Otherwise:

**👉 Do this:**

1. Open Supabase Studio SQL editor: `https://supabase.com/dashboard/project/orqwyazvcthgxoadfxfv/sql/new`.
2. Suspend the Diya account:
   ```sql
   UPDATE public.app_users SET is_active = false WHERE email = 'test.diya@fynestudy.app';
   ```
3. In the web app, try to log in as `test.diya@fynestudy.app` / `TestPass#2026`.

**✅ What you should see:**

- You land on `/suspended` — a centered card with a lifted warning medallion and a message that the account is suspended / to contact the admin, plus a **Sign out** option.

4. **Re-enable Diya immediately:**
   ```sql
   UPDATE public.app_users SET is_active = true WHERE email = 'test.diya@fynestudy.app';
   ```

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] N/A · Android [ ] N/A

---

### A.6 — Forgot password → reset email round-trip

**👉 Do this:**

1. Go to `/login` → click **Forgot password?** → lands on `/forgot-password`.

**✅ What you should see:** a card with an **Email** field + a **Send reset link** (or similarly-labelled) primary button, on the same gradient background.

2. Enter `review.student@fynestudy.app` → submit.

**✅ What you should see:** a green/neutral confirmation (e.g. "If an account exists, we've emailed a reset link.") via a `role="status"` message — NOT an error.

3. **Open the reset email.** (For test accounts, check the inbox or Supabase Auth logs.) Click the reset link.

**✅ What you should see:**

- The link opens `…/reset` on the web app (NOT the mobile deep link). For this to work, the web origin (`http://localhost:3000` for dev, the Vercel URL for prod) must be in **Supabase → Authentication → URL configuration → Redirect URLs**. If the link bounces to an error, that allow-list entry is missing — note it (it's a Phase-5 §H/16 launch item).
- The `/reset` page shows **New password** + **Confirm** fields + a primary button.

4. Enter a valid new password twice → submit.

**✅ What you should see:** success → redirected into the app (or to `/login` to sign in with the new password). Sign in to confirm the new password works, then change it back if you want.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**Notes / patch:** _(record the Redirect-URL allow-list state here)_

---

### A.7 — Force-password-change on first login (advanced — SQL)

> Skip with N/A if you don't want SQL. Otherwise:

**👉 Do this:**

1. In Supabase Studio, force Diya into the change-on-next-login state:
   ```sql
   UPDATE public.app_users SET must_change_password = true WHERE email = 'test.diya@fynestudy.app';
   ```
2. Log in as `test.diya@fynestudy.app` / `TestPass#2026`.

**✅ What you should see:**

- You are routed to `/force-password-change`, NOT the dashboard.
- The form shows **New password** + **Confirm new password** + helper text "At least 10 characters with upper, lower, and a digit. No spaces. Cannot match your email."
- A **Save and continue** button + a ghost **Sign out** below.

3. Type a weak password (e.g. `abc`) → submit.

**✅ What you should see:** an inline red `role="alert"` with the validation message. No crash.

4. Type a valid new password (e.g. `DiyaPass#2026`) in both fields → **Save and continue**.

**✅ What you should see:** redirect to `/` (the dashboard). The flag is cleared. (Behind the scenes this called the `auth-change-own-password` edge fn, never `supabase.auth.updateUser` — D-153.)

5. Reset Diya's password back if you like (admin/SQL), and confirm `must_change_password` is now false.

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] N/A · Android [ ] N/A

---

### A.8 — Sign out (from Profile)

**👉 Do this:**

1. Sign in as the student (`review.student@fynestudy.app`).
2. Click **Profile** in the side-rail (or bottom-tab on mobile-web).
3. On the **Profile** tab, scroll to the bottom group → click the red **Sign out** row (with the log-out icon).

**✅ What you should see:**

- You are returned to `/login`.
- Pressing the browser Back button does NOT silently re-enter the app (a protected route must bounce you back to `/login` because the cookie session is gone).

> **Note:** there is also a **Sign out** in the side-rail/top-bar profile menu (the avatar at the bottom of the side-rail) — both work. The Menu tab no longer exists; Profile is the canonical place.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### A.9 — PWA install (desktop + Android prompt; iOS Share→Add to Home Screen)

> This must be done against the **production HTTPS Vercel URL** (or a local production build), because the service worker is disabled in `pnpm dev`. If you only have dev running, mark this **N/A — pending Vercel** and revisit after §H.

**👉 Desktop Chrome:**

1. Open the production URL → log in.
2. Look in the address bar (right side) for an **install icon** (a monitor with a down-arrow) OR open the ⋮ menu → **Install FyneStudy…**.
3. Click **Install**.

**✅ What you should see:** the app opens in its own standalone window (no browser address bar), titled **FyneStudy**, with the blue theme color. Auth cookies persist — you're still logged in.

**👉 Android Chrome:**

1. Open the production URL in Chrome → log in → wait a few seconds.
2. An **"Add FyneStudy to Home screen"** banner or a ⋮-menu → **Install app** option appears.
3. Tap install → the icon appears on your home screen → tap it → opens standalone.

**👉 iOS Safari (no automatic prompt — that's expected on iOS):**

1. Open the production URL in Safari → log in.
2. Tap the **Share** button (the square with an up-arrow) → scroll → **Add to Home Screen** → **Add**.
3. Tap the new home-screen icon.

**✅ What you should see (all three):** the app launches full-screen (standalone), shows the FyneStudy icon, and you remain logged in (the auth cookie persists in standalone mode).

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**Notes / patch:**

---

# §B — Student dashboard & profile

> Sign in as `review.student@fynestudy.app`. The leaderboard seed (§0.4) sets up the streak + badge celebrations.

### B.1 — Greeting + overall dashboard layout

**👉 Do this:**

1. Go to `/` (Home).

**✅ What you should see:**

- An H1 greeting: `Good morning/afternoon/evening,` + first name.
- Top-right of the greeting: a **streak flame** chip showing a day count (if the seed gave the student a streak).
- On a wide window the dashboard is a **2-column grid**: left = Next card + stats + Today's schedule + Continue learning; right = Weak topics + Recent badges. On a narrow window everything stacks in one column.
- Console: no red errors.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.2 — Next card (the "Up next" hero)

**👉 Do this:**

1. Look at the top-left card.

**✅ What you should see:**

- If there's an upcoming class/exam/live session, a **blue gradient card** (gradient from primary blue to a darker blue) with a subject/title, batch, a start time, an icon in a ringed circle, and a CTA button (e.g. "Take Attendance" / "Join" / "Open").
- If there's nothing upcoming, the card is absent (no empty placeholder).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.3 — Stats strip

**👉 Do this:**

1. Below the Next card, look at the row of stat tiles.

**✅ What you should see:**

- Several tiles (e.g. **Attendance %**, **Mastery / Avg**, **Streak**, etc. — exact labels depend on the seed) each with a number in **tabular figures** and an uppercase label.
- Hovering a tile lifts it slightly (0.5px). No layout jump on hover.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.4 — Today's schedule strip

**👉 Do this:**

1. Look at the **"Today's schedule"** section (uppercase slate label).

**✅ What you should see:**

- Either a list of today's sessions (each row = a colored icon chip + subject + time + status), OR an EmptyState with a subject-appropriate icon if nothing's scheduled.
- Each row has a hover/focus ring; clicking a session row navigates appropriately.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.5 — Weak topics

**👉 Do this:**

1. Look at the **"Weak topics"** section (right column on desktop).

**✅ What you should see:**

- Either a list of weak topics (each with a topic name + an amber chip + a "Practice" CTA arrow), OR an emerald-tinted "All topics looking strong" empty card.
- Clicking a weak-topic row with a quiz routes to `/quiz/<id>`.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.6 — Continue learning

**👉 Do this:**

1. Look for a **"Continue learning"** section (only shows if the student has partially-watched videos / partial reads — you can create one by watching a video in §D first, then return).

**✅ What you should see:** a card per in-progress item with a progress bar + a focus ring; tapping resumes the video/PDF. If you've not watched anything yet, the section is absent (that's correct).

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.7 — Recent badges strip

**👉 Do this:**

1. Look at **"Recent badges"** (right column).

**✅ What you should see:** a horizontal strip of recently-earned badge tiles (each ringed), OR a warm empty state if none earned. (The leaderboard seed grants badges.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.8 — Badge celebration modal + confetti

The leaderboard seed leaves a few **unseen** badges so a celebration fires on first dashboard load.

**👉 Do this:**

1. Fresh-load `/` as the student (the seed sets 3 unseen-badge celebrations).

**✅ What you should see:**

- A **Badge earned** modal pops up over the dashboard with the badge icon, the badge name, and a dismiss button. **Confetti** animates behind/around it.
- Dismiss → the next unseen badge's modal appears, then the next. After the last one, no more modals on subsequent loads (they're marked seen).

**❓ If something looks different:**

- No modal → either the seed didn't leave unseen badges (re-run `pnpm seed:leaderboard-manual-test --reset`) or `useUnseenBadges` didn't poll. Check Console.
- Confetti animates but you have **prefers-reduced-motion ON** → confetti SHOULD be suppressed (you'll verify that specifically in §I.7).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.9 — Streak modal (30-day calendar)

**👉 Do this:**

1. Click the **streak flame** chip next to the greeting.

**✅ What you should see:**

- A modal opens with a **30-day calendar grid** — each day a colored cell (active days filled, gaps empty), plus the current streak count + (if any) streak badges listed.
- Press **Esc** or click the close/backdrop → modal closes. Focus returns to the page.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.10 — Profile tab (identity + read-only lock)

**👉 Do this:**

1. Click **Profile** in the nav.

**✅ What you should see:**

- A gradient avatar tile (initials) + the student's name + email.
- A segmented control: **Profile · Mastery · Badges** (Profile selected).
- Under Profile: identity rows for **Email, Phone, Date of birth, Batch, Course** — each with a 40px icon chip, an uppercase label, the value, and a **lock icon** on the right (read-only).
- A note: "Identity details are managed by your institute admin. Contact them for any updates."
- Buttons: **Change password** + **Contact admin**.
- Below: a group with **Terms & privacy** (routes to `/privacy`) + the red **Sign out** row.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.11 — Mastery + Badges tabs

**👉 Do this:**

1. Click the **Mastery** segment.

**✅ What you should see:** a list of per-topic **MasteryCard**s with colored progress bars + tabular percentages, OR a "No mastery data yet" empty card (GraduationCap icon) if the student has no quiz/exam history.

2. Click the **Badges** segment.

**✅ What you should see:** a violet summary chip ("**N earned** · M to go") + a **BadgeShowcase** grid (earned badges colored, unearned greyed). Tapping an earned badge may show its detail.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### B.12 — Change password dialog + Terms & privacy link

**👉 Do this:**

1. On the **Profile** tab click **Change password**.

**✅ What you should see:** a dialog with **Current** / **New** / **Confirm** fields (or new+confirm) + a primary action. Trapping focus inside; **Esc** closes it. (You can test a real change with the student's own creds, then change it back — or just open/close it.)

2. Close the dialog. Click **Terms & privacy**.

**✅ What you should see:** routes to `/privacy` — a readable privacy-policy page (public route). Back button returns to Profile.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§B Notes / patch:**

---

# §C — Attendance & leaderboard

### C.1 — Rotating QR shows for an open class window

> Needs a class whose window is **open** for the student's batch. The live seed creates one; if no QR shows, re-run `pnpm seed:live-manual-test --reset`.

**👉 Do this:**

1. Click **Attendance** in the nav (`/attendance`).

**✅ What you should see:**

- A centered card titled **"QR for <subject>"** with a QR code, on a `shadow-md` card.
- Below the QR: **"Refreshes in Ns"** with a **pulsing green dot**, counting down.
- If there's no open window: a dashed-border empty card with a Calendar icon + **"No class window open"** + "Your QR will appear here when a class starts."
- Below: a **Today's classes** section (each row = subject + time + a status pill: Open / Soon / Closed / Present / Late / Absent) and a **My history** section with two attendance rings (**This week**, **Last 30 days**).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### C.2 — QR rotates: 30s validity, 25s refresh

**👉 Do this:**

1. Watch the **"Refreshes in Ns"** countdown.

**✅ What you should see:**

- The number counts down (e.g. 25 → 24 → … → 0), then the QR image **changes** (a new token) and the counter resets.
- (The signing window is 30s; the client refreshes at ~25s so a fresh token is always ready before the old one expires — there's a small safety overlap.)
- Open DevTools → Network and confirm a `POST` to `…/functions/v1/attendance-qr-sign` returns `200` on each refresh. The response does NOT contain any secret HMAC key — only an opaque signed payload.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### C.3 — Multiple eligible classes → session picker pills

**👉 Do this:**

1. If the student has more than one open class window, picker pills appear below the QR (one per subject). Click a different pill.

**✅ What you should see:** the QR card's subject title changes to the picked class; the picked pill turns solid blue with a focus ring. If only one class is open, mark **N/A**.

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### C.4 — Teacher scans the QR → student gets marked LIVE (realtime)

> This is the realtime test. Best done with a second device/window.

**👉 Do this:**

1. Keep the student's `/attendance` open (showing the QR).
2. In a **second Chrome window** (File → New Window), sign in as the **teacher** (`review.teacher@fynestudy.app`) → go to `/scan` → **Start camera** → Allow → pick the same class in the session picker → point the webcam at the student's QR (hold the phone/another screen up, or use a screenshot).
3. (If you can't get two cameras working, alternatively mark the student from the teacher **roster** at `/roster/<sessionId>` by tapping the **P** pill on the student's row.)

**✅ What you should see (student window):**

- Within ~1–2 seconds the QR card swaps to a green **"You're marked!"** check (the `useAttendanceRealtime` channel pushed the change — no refresh).
- The **Today's classes** row for that subject flips its pill to a green **Present**.
- The dashboard attendance stat (if you go back to `/`) refreshes too.

**❓ If something looks different:**

- No live update → DevTools → Network → WS in the student window should show a `student-attendance-{id}` postgres_changes frame. If absent, the realtime channel didn't subscribe — reload.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### C.5 — Attendance history rings

**👉 Do this:**

1. On `/attendance`, look at **My history**.

**✅ What you should see:** two ring charts — **This week** and **Last 30 days** — each showing present/total as a filled arc + a center number/percent. Below, a recent-history list with per-day method labels (uppercase text-xs).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### C.6 — Leaderboard: weekly / all-time scopes + my-rank hero

**👉 Do this:**

1. Click **Ranks** in the nav (`/leaderboard`).

**✅ What you should see:**

- A header with a gradient amber **Trophy** chip + **"Leaderboard"** + the batch name, and a round **(i)** info button on the right ("How rank is calculated").
- A segmented control: **Weekly · All-time**.
- A **"Your rank"** hero — a **blue gradient card** showing `#<rank> / <total>` (tabular) + your composite score (e.g. `0.73`).
- A ranked list of **RankRow**s (rank number, name, score). If empty, a Trophy empty state ("No rankings yet").

2. Click **All-time** → the list + your-rank hero update to the all-time scope.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### C.7 — Tap a row → public card; tap (i) → calc modal

**👉 Do this:**

1. Click any rank **row**.

**✅ What you should see:** a dialog (PublicCardDialog) opens, briefly showing a loading state, then the student's public card (name, batch, rank, streak, badges) from the `student_public_card` RPC. **Esc** closes it. (If a row's data is missing it should NOT crash — guarded.)

2. Click the round **(i)** info button (top-right).

**✅ What you should see:** the **LeaderboardCalcModal** explains the composite formula (0.60 Quiz + 0.25 Attendance + 0.15 Streak, or similar). **Esc** closes.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§C Notes / patch:**

---

# §D — Library & players

### D.1 — Library drill-down: Subject → Chapter → Topic → Item

**👉 Do this:**

1. Click **Library** in the nav (`/library`).

**✅ What you should see:**

- Header: a blue **BookOpen** chip + **"Library"** + subtitle "Subjects → Chapters → Topics → Items".
- A **Search content…** input (only at the subjects level).
- A grid/list of **Subjects** (each = a BookOpen chip + name + "N items" + a `>` chevron).

2. Click a subject → the list becomes **Chapters** (header shows a back arrow + the subject name). Click a chapter → **Topics**. Click a topic → **Items** (videos/PDFs/notes).

**✅ What you should see at each level:**

- The header title updates to the current level's name; a back-arrow (circle) appears.
- Chapters/topics with **0 items are disabled** (greyed, not clickable).
- The browser **Back button** unwinds one level at a time (URL carries `?subject=…&chapter=…&topic=…`).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.2 — Library search

**👉 Do this:**

1. Go back to the subjects level. Type a word from a content title (e.g. part of a seeded video title) into **Search content…**.

**✅ What you should see:**

- After ~300ms the tree filters to matching content; the URL gains `?q=<word>`.
- Clearing the box restores the full tree and drops `?q=`.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.3 — Practice-quiz strip at the topic level

**👉 Do this:**

1. Drill into a topic that has quizzes ("· quiz available" shows on the topic row).

**✅ What you should see:** below the content items, an amber **"Practice quizzes"** card listing each quiz (title + "N min · +marks" + attempt count). Each is a focusable link → `/quiz/<id>`. (You'll attempt one in §E.)

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.4 — Video player: opens, watermark overlay, native controls (NO controls=0)

**👉 Do this:**

1. From a topic's items, click a **video** item (PlayCircle icon).

**✅ What you should see:**

- URL `/video/<contentId>` — full-screen black player view (no side-rail), back-arrow + title at top.
- The YouTube player loads. **YouTube's native play button is visible** (the video starts paused — autoplay is intentionally off, D-173).
- A **watermark** text overlay (`Your name • last-4-of-phone`, or `0000`) sits over the player and **moves between 5 positions** slowly over ~60s.
- DevTools → Elements: the YouTube iframe `src` is `https://www.youtube.com/embed/<id>?…` and **must NOT contain `controls=0`** (D-173). DevTools → Network: a `POST` to `…/functions/v1/yt-playback-sign` returned `200` with a `video_id` (the raw YouTube ID is never in the page HTML except inside the iframe src after signing).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.5 — Video resume sheet (only if you've watched >10s before)

**👉 Do this:**

1. Press play on the video, watch ~20 seconds, then click the back-arrow to `/library`.
2. Re-open the **same** video.

**✅ What you should see:**

- A **"Resume from M:SS?"** sheet slides up (bottom on mobile, centered on desktop) with **Start over** + **Resume** buttons.
- Click **Resume** → the player seeks to where you left off.
- (If you'd watched ≤10s, the sheet is skipped and it auto-restarts — that's correct.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.6 — PDF player: opens, tiled diagonal watermark

**👉 Do this:**

1. From a topic's items, click a **PDF** item (red FileText icon).

**✅ What you should see:**

- URL `/pdf/<contentId>` — full-screen dark viewer, back-arrow + title at top.
- The PDF renders page-by-page (scrollable).
- A **tiled diagonal watermark** (a 3×4 grid of faint repeated `Your name • last-4` text rotated diagonally) overlays the whole page area.
- DevTools → Network: a `POST` to `…/functions/v1/content-pdf-sign` returned `200` (signed URL — D-171). Trying the raw bucket URL directly would 403 (you'll confirm in §J.4).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.7 — PDF zoom +/- controls (new on web) + page memory

**👉 Do this:**

1. At the top of the PDF viewer there's a sticky bar: **"Page X / N"** + a **−** (zoom out) button + a **percent** + a **+** (zoom in) button.
2. Click **+** a few times.

**✅ What you should see:**

- The pages get larger; the percent rises (e.g. 100% → 125% → 150% …). The **+** disables at 300%; the **−** disables at 50%.
- Scroll down a few pages — the **"Page X / N"** counter updates to the page you're viewing.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### D.8 — PDF resume to saved page

**👉 Do this:**

1. In the PDF, scroll to page ~3 (so the counter reads "Page 3 / N").
2. Click the back-arrow to `/library`, then re-open the **same** PDF.

**✅ What you should see:**

- The viewer loads and **auto-scrolls to page 3** (the saved `last_page`), not page 1. The counter reads "Page 3 / N".
- (This is the page-progress save via `pdf_progress`.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§D Notes / patch:**

---

# §E — Quizzes

> Use the seeded quiz (from `pnpm seed:quiz-manual-test --reset`). Reach it via Library → a topic → Practice quizzes, or deep-link `/quiz/<quiz id>`.

### E.1 — Intro stage

**👉 Do this:**

1. Open a quiz (e.g. click a Practice-quiz row, or go to `/quiz/<id>`).

**✅ What you should see:**

- A close (**X**) button top-left.
- The quiz **title** + "**N questions · M min**".
- A marks card: **Correct +X / Wrong −Y / Skip Z / Total possible**.
- A big blue **Start Quiz** button + helper "Auto-saves every action. You can refresh or leave and come back."

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### E.2 — Attempt stage: question, options, flag, nav grid, timer

**👉 Do this:**

1. Click **Start Quiz**.

**✅ What you should see:**

- Header: **X** (exit) + quiz title + a **TimerPill** counting down (mm:ss). It pulses red when ≤60s remain.
- A **QuestionCard** (Question 1 of N, difficulty pill, the prompt — with math rendered if present).
- **OptionRadio** rows (A/B/C/D). Click one → it shows selected (blue ring + shadow). A **Clear** link appears to deselect.
- A **flag** toggle (FlagButton) — click it; the question's nav-grid cell shows a flag marker.
- A **NavigationGrid** of numbered cells (40px each, WCAG) — answered cells colored, current cell ringed. Click a cell to jump.
- Bottom bar: **Prev** / **Next** + "Answered X/N" + (on the last question) a green **Submit**.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### E.3 — Auto-save + resume on refresh

**👉 Do this:**

1. Answer 2–3 questions + flag one.
2. Press **F5** (refresh) the browser.

**✅ What you should see:**

- The quiz reloads and jumps **straight back into the attempt stage** (not the intro), with your earlier answers + flags intact, and the timer continuing from where it was (server-anchored, not reset).
- DevTools → Network during answering shows `PATCH`/`POST` to `quiz_answers` (the ~250ms debounced auto-save).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### E.4 — No `is_correct` leak during the attempt (eyeball)

**👉 Do this:**

1. While in the attempt stage, open DevTools → **Network** → click the `quiz-start` request and any `quiz_answers` requests → **Response/Preview** tab.

**✅ What you should see:**

- The question + option payloads contain prompt text + option text but **NO `is_correct` field and NO `correct_option_id`**. (The automated test in §J.3 enforces this too.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### E.5 — Submit → result stage

**👉 Do this:**

1. Navigate to the last question → click **Submit** → confirm in the dialog (which lists answered/flagged/unanswered counts).

**✅ What you should see:**

- A **Result** screen: a big score `X / Y` + percent + a 3-tile breakdown **Correct / Wrong / Skipped** (tabular numbers).
- Buttons: **Review solutions**, **Retake**, **Back to Library**.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### E.6 — Solutions with math (KaTeX)

**👉 Do this:**

1. Click **Review solutions**.

**✅ What you should see:**

- A list of **SolutionCard**s, one per question — each showing the prompt, the options with the **correct one marked**, your choice, and an explanation.
- Any math (e.g. `$\frac{a}{b}$` or `$$\int x\,dx$$`) renders as proper **typeset KaTeX** (fractions/integrals look like real math, not raw `$...$` text). If you see literal dollar signs / un-rendered LaTeX, that's a FAIL (a CSP or KaTeX-font issue — note it for §J.5).
- Back arrow returns to the result.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### E.7 — Retake

**👉 Do this:**

1. From the result, click **Retake**.

**✅ What you should see:** returns to the **intro** stage with a fresh attempt (answers cleared). Starting again works.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§E Notes / patch:**

---

# §F — Exams

> Use the seeded exams. You need both an **instant-release** and a **manual-release** exam. Reach them via `/classes` (the Upcoming/exam rows) or deep-link `/exam/<id>`.

### F.1 — Pre stage + Rules + countdown / Enter window

**👉 Do this:**

1. Open an exam (`/exam/<id>`).

**✅ What you should see:**

- **X** close button + exam **title** + "IST date · M min · N questions".
- A **Rules** card listing: server clock decides; leaving the tab is logged (no auto-submit on switch); auto-saves + resume; results shown instantly OR released by teacher.
- A status card:
  - If the start time is in the future → **"Starts in"** + a live countdown + a **disabled Enter Exam** button.
  - If within the window → a red **"Live now"** dot + "Window closes in …" + an enabled **Enter Exam**.
  - If ended → "This exam has ended." + (if you attempted) a **View Result** button.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### F.2 — Enter exam → locked attempt UI

**👉 Do this:**

1. With the window open, click **Enter Exam**.

**✅ What you should see:**

- The locked attempt UI: header with **X** (titled "Leaving counts as a tab switch") + title + a **TimerPill**. (Briefly you may see `--:--` while server time syncs, then the real countdown.)
- Question + options + flag + nav grid + Prev/Next/Submit (like the quiz).
- **Right-click is disabled** (try it — no browser context menu). **Text selection is disabled** on the question area (try to drag-select — nothing highlights).
- **No confetti, no fancy animation** (exam is deliberately plain).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### F.3 — Server timer resists device-clock change (the important one)

**👉 Do this:**

1. While in the exam attempt, note the TimerPill's current remaining time (e.g. `28:14`).
2. **Change your computer's clock**: Windows → Settings → Time & language → Date & time → turn OFF "Set time automatically" → set the clock **1 hour forward** → back to the exam tab. (On a Mac: System Settings → General → Date & Time.)

**✅ What you should see:**

- The TimerPill does **NOT** jump or expire. It keeps counting from where it was (it's anchored to **server** time via `server-time` + a 60s `useServerTimeOffset` resync, D-183). The device clock is ignored for the countdown.
- After a minute, the timer may correct by a second or two (the 60s resync) but never honors your fake +1h.

3. **Restore your clock** (turn "Set time automatically" back ON). Important — leave it correct for the rest of testing.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### F.4 — Tab-switch banner increments

**👉 Do this:**

1. While in the exam attempt, switch to another browser tab (or click a different window) for ~2 seconds, then come back. Do it twice.

**✅ What you should see:**

- A **TabSwitchBanner** appears/updates at the top of the question area, showing the switch count (e.g. "You left this tab 2 times. This is logged."). It does NOT auto-submit your exam.
- DevTools → Network: a fire-and-forget `POST` to `…/functions/v1/exam-tab-switch` fires on each switch (D-182).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### F.5 — Instant release: submit shows the result immediately

**👉 Do this:**

1. In the **instant-release** exam, answer some questions → go to the last → **Submit** → confirm.

**✅ What you should see:**

- Straight to a **Result** screen (score + breakdown + **Review solutions**), because instant-release shows results on submit.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### F.6 — Manual release: locked result card pre-release, then unlocks

**👉 Do this:**

1. In the **manual-release** exam, submit your attempt.

**✅ What you should see:**

- A **LockedResultCard** ("Submitted — your teacher will release results"), with the submitted timestamp + tab-switch count + a **Refresh** action. NO score is shown (it's not released yet).

2. In a **second window** as the teacher, go to `/exam-results/<that exam id>` → click **Release results to students** → confirm.
3. Back in the student window, click the **Refresh** on the locked card (or refresh the page).

**✅ What you should see:**

- The locked card flips to the full **Result** screen with the score + breakdown + Review solutions (D-181 re-open routing).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

> **§F bonus — auto-submit at deadline (optional, slow):** if you have a short-duration seeded exam, enter it and wait for the timer to hit 0. The exam should auto-submit and land on the result (instant) or locked card (manual) without you clicking Submit. Mark this inside F.5/F.6's notes if you test it.

**§F Notes / patch:**

---

# §G — Live + recordings

> The most involved section. Student side first (§G.1–§G.5) using the seeded live session; then the teacher live-control + **real OBS dry-run** (§G.6–§G.10). For two-way realtime tests, use a second Chrome window (student) + the main window (teacher), or two devices.

### G.1 — Lobby countdown / waiting state

**👉 Do this:**

1. As the student, go to **Classes** (`/classes`) → the **Live** segment (or **Upcoming** if your seeded session isn't live yet) → click the session card. (Or deep-link `/live/<live session id>`.)

**✅ What you should see:**

- URL `/live/<id>` — full-width focus view (NO side-rail), header = back-arrow + subject + (if live) a red **Live** pill with a pulsing dot.
- If the session is **scheduled** (not yet live): a **LobbyCountdown** screen (dark) counting down to the scheduled start.
- If the session is **live**: the wrapped YouTube player + a chat pane (see G.2).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.2 — Live player + chat pane + watermark

**👉 Do this:**

1. With the seeded session **live**, observe the `/live/<id>` page.

**✅ What you should see:**

- On wide screens: player on the LEFT (~70vw), chat pane on the RIGHT. On narrow: player as a 16:9 hero, chat below.
- A moving **watermark** over the player.
- The chat pane: an empty-state ("No messages yet") or seeded messages; a **Raise hand** button above the composer; an **enabled** chat text input + send button.
- DevTools → Network: `yt-playback-sign` returned `200` with a `video_id`. The iframe src has NO `controls=0`.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.3 — Post a chat message + realtime to a second window

**👉 Do this:**

1. Type `Hello from Phase 5` in the composer → Enter (or click send).
2. In a **second Chrome window**, sign in as **Aarav** (`test.aarav@fynestudy.app`) → open the same live session → send `Hi from Aarav`.

**✅ What you should see:**

- Your message appears in your pane within ~1s (avatar initials + your name + `(you)` + time + body).
- Aarav's message appears in **your** window within ~1s with `AS` initials and NO `(you)` suffix — proving the realtime `chat-{id}` channel works.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.4 — Chat rate-limit: 6th message in 30s is blocked

**👉 Do this:**

1. Quickly send 5 messages (`1`,`2`,`3`,`4`,`5`), then immediately a 6th (`6`).

**✅ What you should see:**

- Messages 1–5 appear; message **6 does NOT** — an inline red error appears above the composer ("Too many messages — please wait…" or the raw rate-limit error). DevTools → Network shows the `chat_messages` insert returning **4xx**.
- Wait ~30s → `6` now sends.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.5 — Raise hand → lower hand

**👉 Do this:**

1. Click **Raise hand**.

**✅ What you should see:** the button flips amber to **Lower hand** + a "Hand raised ✋" indicator appears (DevTools shows an insert to `raise_hand_events`). Click again → back to **Raise hand**, indicator gone (an update sets `resolved_at`).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.6 — Recording: open + speed pills + chat replay

**👉 Do this:**

1. As the student, go to **Classes** → **Recorded** segment → click the seeded recording (or deep-link `/recording/<recording session id>`).

**✅ What you should see:**

- URL `/recording/<id>` — full-width view, player on the left/top with **native YouTube controls** (the video starts paused), watermark overlay.
- A **CHAT REPLAY** column on the right/below.
- A **Speed** bar with pills **1× (selected) · 1.5× · 2×**.

2. Press play → watch ~15s. Click **1.5×**, then **2×**, then back to **1×**.

**✅ What you should see:** the playback rate changes (faster audio + scrubber); the active pill turns blue; replayed chat messages reveal timed to the player position (and reveal faster at higher speeds). Scrubbing the YouTube bar to ~60% reveals all messages up to that point.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.7 — Teacher live-control Setup: RTMP URL + stream key + Copy buttons

> Teacher side. Needs YouTube Vault secrets provisioned (they are, on the dev "NOvA FX" channel). If you get a 503 "YouTube isn't configured," note it — Vault may need re-checking.

**👉 Do this:**

1. As the **teacher**, go to **Classes** (`/classes`) → click the red **Schedule Live** FAB → pick a batch → **Set up live class** → you land on `/live-control/<new session id>`. (Or open an existing scheduled live session's control.)

**✅ What you should see:**

- A brief "Preparing broadcast…" spinner, then a **Setup card** with **Server (RTMP URL)**, **Stream key** (masked), individual **Copy** buttons + a combined **Copy Server + Key**, and a red **Go Live** button.
- Click each **Copy** → the button flashes a green **Copied** for ~1.6s. Paste into Notepad — verify you get an `rtmp://a.rtmp.youtube.com/live2`-style server + a key string.
- **Important security note:** the stream key lives only in component state — it must NOT appear in any React Query cache, localStorage, or a network response visible to students (verified by an automated source-scan test; you're just eyeballing it copies correctly).

**❓ If something looks different:** clipboard blocked → you're on plain `http://` over a LAN IP. Use `localhost`, `https://localhost`, or the Vercel URL.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.8 — REAL OBS → YouTube dry-run (the big one)

> Allow ~30 min. Needs **OBS Studio** installed.

**👉 Do this:**

1. Open **OBS Studio** → Settings → **Stream** → Service: **Custom…**.
2. **Server:** paste the RTMP URL (from G.7's Copy). **Stream Key:** paste the stream key. Apply → close.
3. In OBS click **Start Streaming**. Wait ~10s.
4. In the web app's live-control, click **Go Live**.

**✅ What you should see (teacher):**

- A spinner on Go Live, then ~3s later the page swaps to the **LIVE view**: a player preview at top, two tabs **Stream · Moderate**, header shows a pulsing red dot + "Live now".

**✅ What you should see (student — second window):**

- `/classes` → **Live** segment shows the session with a red **Live** pill.
- Clicking it opens `/live/<id>` and the YouTube player streams OBS's feed within ~5–10s.

**❓ If something looks different:**

- Go Live → 503 → OBS hasn't connected yet; wait + retry.
- Student stuck on lobby → `yt-playback-sign` 409 → the broadcast isn't fully live yet in YouTube Studio; wait.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] N/A · Android [ ] N/A

---

### G.9 — Moderate: delete message, ban (mute), pin announcement, resolve hand

**👉 Do this (teacher live-control, with a student window posting):**

1. Have the student post 2–3 chat messages + raise a hand.
2. Teacher → **Moderate** tab.
3. Hover a student message → kebab (⋯) → **Delete message**.
4. Hover another → kebab → **Mute … for this class**.
5. Click **Pin an announcement** → type "Quiz at 8 PM" → **Pin**.
6. In the raise-hand queue → **Resolve** the student's hand.

**✅ What you should see:**

- Deleted message strikes through / shows "(message deleted)" in **both** windows.
- The muted student's chat composer + Raise-hand button **disable live** in the student window ("You've been muted by the teacher…").
- A blue **Pinned by <teacher>** banner appears above the chat in both the Stream tab and the student window.
- The resolved hand vanishes from the queue + the student's Raise-hand toggles back within ~1s.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### G.10 — End class

**👉 Do this:**

1. Teacher → top-right red **End class** → confirm "End class for everyone?".

**✅ What you should see:**

- The teacher returns to `/classes`. (`yt-broadcast-stop` fires; session `status='ended'`; a `kind='system'` chat row is inserted.)
- The student window pivots from the live player to a **"This class has ended"** panel with a **Watch recording** button (recording becomes playable after YouTube finishes processing, ~5–15 min).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§G Notes / patch:**

---

# §H — Teacher portal

> Sign in as `review.teacher@fynestudy.app`.

### H.1 — Teacher home dashboard

**👉 Do this:** go to `/`.

**✅ What you should see:** greeting + **Quick actions** (Scan QR / New exam / Upload) + **Pending** (exams awaiting release / raised hands, or "all caught up" emerald card) + **My batches** list (course code + name + student count). On wide screens it's a 2-column layout.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.2 — Scan: camera off on mount, starts on gesture, denied → roster fallback

**👉 Do this:**

1. Go to **Scan** (`/scan`). Observe the dark camera box — there's a **Start camera** button + helper text; the browser has NOT yet asked for camera permission.
2. Click **Start camera** → **Allow** when prompted.

**✅ What you should see:** the live webcam feed appears with a corner-bracket viewfinder; **Reset camera** + **Stop** buttons appear; a session picker bar above. (Scanning a student QR shows a green "✔ <name> · Marked present" toast — same as §C.4.)

3. **Denied fallback:** click **Stop** → in the address bar click the camera icon → **Block** → reload → **Start camera**.

**✅ What you should see:** an amber "Camera permission was blocked" card + an **Open roster instead** link → `/roster/<session>`.

> On iOS Safari, `getUserMedia` needs HTTPS + a user gesture — this only works on the Vercel URL.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.3 — Classes: segmented + Schedule-Live FAB + Ad-hoc FAB

**👉 Do this:**

1. Go to **Classes** (`/classes`). See **Today · Upcoming · Past** tabs with counts + rows with status pills + **Roster**/**Scan**/**Go live** chips.
2. Click the red **Radio** FAB (bottom-right) → pick a batch → **Set up live class** → routes to `/live-control/<id>`.
3. Back on `/classes`, click the blue **Plus** FAB → confirm a non-live session → routes to `/roster/<id>`.

**✅ What you should see:** both FABs create sessions and route correctly (live-control vs roster).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.4 — Content upload: cascading picker + Video URL + PDF presign→upload→finalize

**👉 Do this:**

1. Go to **Library** (teacher) (`/content`). Pick Subject → Chapter → Topic (each enables after the prior), then a Batch.
2. **Video:** Kind = Video → paste a YouTube URL → Title → **Upload** → expect a green "Video linked" pill; the student `/library` lists it under that topic.
3. **PDF:** Kind = PDF → pick a PDF ≤5MB → **Upload** → a blue progress bar 0→100% → green "Uploaded — content added to library" pill.

**✅ What you should see:** both flows succeed; the new content shows in the student Library.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.5 — Quiz builder: list → builder → add from bank → publish

**👉 Do this:**

1. Go to **Quizzes** (`/quizzes`) → **New quiz** → lands on `/quiz-builder/new` (focus view).
2. Pick Subject → Chapter → Topic. Title it. Click **From bank** → tick 2–3 questions → **Add**. Reorder with up/down arrows; remove one with the trash icon.
3. **Save draft** → redirect to `/quizzes`, new row "Draft". Re-open it → **Publish** → status flips to "Published"; the student Library surfaces it.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.6 — Exam builder + atomic question replace

**👉 Do this:**

1. Go to **Exams** (`/exams`) → **New exam** → `/exam-builder/new`. Fill title + batch + a future datetime + duration + release mode (Manual/Instant) + marking. Add 3 bank questions → **Publish**.
2. Re-open the exam, remove 1 question + add 1 different + reorder → **Publish** again.

**✅ What you should see:** the publish never leaves the exam with zero questions mid-save (upsert-then-delete). In Supabase Studio, `SELECT * FROM exam_questions WHERE exam_id='<id>' ORDER BY sort_order;` shows exactly your saved set.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.7 — Exam results: release + 3-mode regrade

**👉 Do this:**

1. Open a manual-release exam with ≥1 submitted attempt → `/exam-results/<id>` → **Release results to students** → confirm → banner turns green with the IST timestamp (this also unlocks the student's locked card — see §F.6).
2. In the question analysis, click **Regrade** on a question → **Change correct option** → pick a different option → reason ≥3 chars → **Apply regrade**. Then on another question → **Mark all correct** → reason → Apply.

**✅ What you should see:** each regrade pops "N attempt(s) recomputed."; the analysis percentages update. (Audit rows are written — D-172.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.8 — Offline scores: pre-fill + validation + save

**👉 Do this:**

1. Go to `/offline-scores` → pick a batch → type "Weekly Test 12" → today's date pre-fills → the roster loads.
2. Validation: type `abc` in a cell → **Save all** → "isn't a number" pill. Type `150` (max 100) → "outside [0, 100]". Leave all empty → "Enter at least one student's score…".
3. Enter 2–3 valid scores → **Save all** → green "N new, M updated." A student's profile reflects the new offline-test row.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.9 — Batch analytics: Risk / Mastery / Attendance

**👉 Do this:**

1. Go to **Batch** (`/batch`) → tap a batch → `/batch/<id>` (analytics stay inside the shell — side-rail visible).
2. **Risk** tab → at-risk list (composite <0.4) or an emerald "No students at risk" card.
3. **Mastery** tab → topic mastery bars (green ≥75% / amber 50–74% / red <50%).
4. **Attendance** tab → a 30-day heatmap with a legend.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.10 — Roster corrections: pills, D-164 toggle, correction dialog, bulk

**👉 Do this:**

1. Open `/roster/<sessionId>`. Tap a **P** pill on an unmarked row → turns solid emerald (persists on refresh).
2. Tap the now-active **P** pill again → "Un-mark this student?" dialog → confirm → back to unmarked (D-164).
3. Mark someone Present, then tap their **L** pill → a **CorrectionDialog** opens (status pre-set Late) with preset reason chips → Save → persists.
4. Tap **All Present** → confirm → the Pending chip drops to 0; unmarked rows flip to Present; existing marks unchanged.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.11 — Roster realtime sync (second device)

**👉 Do this:** keep `/roster/<id>` open in one window; in a second window mark a student (scan or another teacher).

**✅ What you should see:** the first window updates within ~1s (the `teacher-roster-{id}` channel).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### H.12 — Live-control deep-link / refresh resume

**👉 Do this:** copy a `/live-control/<id>` URL → open in a new tab → refresh.

**✅ What you should see:** the control page re-loads to the correct phase (Setup or Live) without crashing; you stay logged in. (If you were mid-OBS-stream, the stream key is re-fetched idempotently, never persisted.)

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§H Notes / patch:**

---

# §I — Cross-cutting

### I.1 — Responsive sweep at 320 / 375 / 768 / 1280 / 1440 px (every route)

**👉 Do this:**

1. In Chrome DevTools enable the device emulator (Ctrl+Shift+M). For each width below, visit **every** route and check: no horizontal scrollbar, no clipped text, tap targets ≥40px, and the **side-rail switches to bottom-tabs below the `lg` (1024px) breakpoint** (so 320/375/768 = bottom-tabs; 1280/1440 = side-rail).

Routes to check (sign in as student for the student ones, teacher for teacher ones):

**Student:** `/` · `/classes` · `/library` · `/attendance` · `/leaderboard` · `/profile` · `/video/<id>` · `/pdf/<id>` · `/quiz/<id>` · `/exam/<id>` · `/live/<id>` · `/recording/<id>`
**Teacher:** `/` · `/scan` · `/classes` · `/content` · `/quizzes` · `/exams` · `/batch` · `/batch/<id>` · `/quiz-builder/new` · `/exam-builder/new` · `/exam-results/<id>` · `/offline-scores` · `/roster/<id>` · `/live-control/<id>`
**Public/auth:** `/login` · `/forgot-password` · `/reset` · `/privacy` · `/terms`

Set the widths one at a time:

- **320px** — `Chrome [ ] PASS [ ] FAIL` (no horizontal scroll anywhere)
- **375px** — `Chrome [ ] PASS [ ] FAIL`
- **768px** — `Chrome [ ] PASS [ ] FAIL` (still bottom-tabs)
- **1280px** — `Chrome [ ] PASS [ ] FAIL` (side-rail; dashboards multi-column)
- **1440px** — `Chrome [ ] PASS [ ] FAIL`

**Notes / which route + width broke:**

---

### I.2 — Cross-browser matrix

**👉 Do this:** run one full happy path (login → a student flow → a teacher flow → one quiz → one live OR recording → a PDF + a video) on each browser. Tick each:

- **Chrome desktop** — [ ] PASS [ ] FAIL
- **Chrome Android** — [ ] PASS [ ] FAIL [ ] N/A
- **Safari iOS** — [ ] PASS [ ] FAIL [ ] N/A (watch: camera needs HTTPS+gesture; video `playsinline`; full-height screens use `100dvh` so nothing hides under the toolbar)
- **Safari macOS** — [ ] PASS [ ] FAIL [ ] N/A
- **Edge** — [ ] PASS [ ] FAIL [ ] N/A
- **Firefox** — [ ] PASS [ ] FAIL [ ] N/A

**Notes / browser-specific breakage:**

---

### I.3 — Offline banner (app shell loads; data fails gracefully)

> Best against the **production build / Vercel URL** (service worker is off in dev). If only dev is running, mark N/A.

**👉 Do this:**

1. Load the app (production), then DevTools → Network → **Offline**.
2. Navigate to a route you've visited (e.g. `/`).

**✅ What you should see:** the **app shell** (side-rail/tabs + layout) still renders from the service-worker precache; data sections show a graceful loading/error state or an **offline banner** — NOT a raw browser "no internet" error page or a white crash. Authenticated API responses are NOT served stale from cache (the SW only precaches the static shell).
3. Switch back to **Online** → data loads.

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### I.4 — Deep-link + refresh resume on quiz / exam / live

**👉 Do this:** for each — `/quiz/<id>`, `/exam/<id>`, `/live/<id>` — paste the URL into a **new tab** and also press **F5** mid-flow.

**✅ What you should see:** each opens correctly (you stay logged in via the cookie), and mid-attempt refresh resumes in place (quiz/exam answers + timer intact; live re-loads chat history).

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### I.5 — Pinch-zoom is allowed (accessibility)

**👉 Do this (on a phone or DevTools touch emulation):** on a normal content page (e.g. `/library` or a `/pdf/<id>`), pinch to zoom.

**✅ What you should see:** the browser zooms (we do NOT lock `user-scalable=no` — a11y). On the PDF, both the browser pinch-zoom AND the in-app +/- zoom (§D.7) work.

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### I.6 — Keyboard navigation + focus + Esc-to-close

**👉 Do this (Chrome desktop):**

1. On `/login`, press **Tab** repeatedly — focus moves Email → Password → Sign in → Forgot password?, each with a **visible focus ring**.
2. Open any dialog (e.g. Profile → Change password, or a leaderboard public card) — Tab cycles **within** the dialog (focus trap); **Esc** closes it; focus returns to the trigger.

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] N/A · Android [ ] N/A

---

### I.7 — prefers-reduced-motion disables confetti

**👉 Do this:**

1. Enable reduced motion: Chrome DevTools → open the Command palette (**Ctrl+Shift+P**) → type "Emulate CSS prefers-reduced-motion" → select **reduce**. (Or OS-level: Windows → Settings → Accessibility → Visual effects → Animation effects OFF.)
2. Trigger a badge celebration (re-seed leaderboard if needed and reload `/`).

**✅ What you should see:** the badge modal still appears, but **confetti does NOT animate** (it's gated on reduced-motion). Transitions are minimal.
3. Set the emulation back to "no override".

`Result:` Chrome [ ] PASS [ ] FAIL · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

**§I Notes / patch:**

---

# §J — Performance & security spot-checks

### J.1 — Lighthouse mobile ≥80 + PWA installable (on /login + dashboard)

> Run against the **production build / Vercel URL** for meaningful numbers (dev mode is slower).

**👉 Do this:**

1. Open the production URL → DevTools → **Lighthouse** tab → Device: **Mobile** → Categories: **Performance** + **Best Practices** + **PWA** (if shown) → **Analyze page load**. Run once on **/login** (logged out), then log in and run on **/** (dashboard).

**✅ What you should see:** Performance score **≥ 80** (mobile) on both; PWA = **installable** (manifest + service worker + icons detected); no major layout-shift flag on the dashboard.

`Result (/login):` Chrome [ ] PASS [ ] FAIL — score: ____
`Result (/dashboard):` Chrome [ ] PASS [ ] FAIL — score: ____

---

### J.2 — Heavy libs code-split (not in the initial bundle)

**👉 Do this:**

1. DevTools → **Network** → filter JS. Load `/login` fresh (hard reload, Ctrl+Shift+R).
2. Then navigate to a `/pdf/<id>` and a `/quiz/<id>`.

**✅ What you should see:** the big libs (pdf.js / `react-pdf`, `react-youtube`, `katex`, the QR scanner, `canvas-confetti`) load **only when you hit the screen that uses them** (their chunk requests appear on the player/quiz/scan pages, not on `/login`). The login bundle stays lean.

`Result:` Chrome [ ] PASS [ ] FAIL

---

### J.3 — No `is_correct` / `correct_option_id` leaks during an attempt (automated)

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm --filter @fynestudy/web test -- features/quiz/__tests__/cacheKeySecurity.test.ts
   ```

**✅ What you should see:** the cache-key-security test passes. It source-scans attempt-stage code for `is_correct` / `correct_option_id` and fails if any sneak in.

2. (Eyeball, prod): repeat the §E.4 / §F network check on the production build — `quiz-start`/`exam-start` responses contain no answer key.

`Result:` Chrome [ ] PASS [ ] FAIL

---

### J.4 — No service-role key in the built bundle + signed-URL-only storage

**👉 Do this:**

1. Build + scan:
   ```powershell
   pnpm --filter @fynestudy/web build
   Get-ChildItem apps/web/.next/static -Include *.js -Recurse | Select-String -Pattern 'SUPABASE_SERVICE_ROLE|service_role|sb_secret' | Measure-Object | Select-Object -ExpandProperty Count
   ```

**✅ What you should see:** the build completes (36 routes + `sw.js`); the Select-String count prints **`0`**.

2. **Raw bucket 403:** in DevTools → Network on a `/pdf/<id>` or video, find the signed URL request. Copy the storage URL but **strip the `?token=…` query string** and open it in a new tab.

**✅ What you should see:** the unsigned/raw bucket URL returns **403/Unauthorized** (buckets are private; access is signed-URL-only). The signed URL itself is short-lived — re-using an old one after its TTL also 403s.

`Result (bundle scan):` Chrome [ ] PASS [ ] FAIL — count: ____
`Result (raw 403):` Chrome [ ] PASS [ ] FAIL

---

### J.5 — CSP doesn't break the YouTube player or pdf.js

**👉 Do this (production build, where CSP headers are active):**

1. Load a `/video/<id>` (YouTube), a `/live/<id>` (YouTube), and a `/pdf/<id>` (pdf.js worker) → watch the DevTools **Console**.

**✅ What you should see:** the YouTube iframe renders + plays, the PDF renders, and there are **NO** red Console errors like "Refused to frame … because it violates the Content-Security-Policy" or "Refused to load the worker … blob:". KaTeX (§E.6) renders with proper fonts (no CSP font-block).

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A — _N/A if only dev (no CSP) is running_

---

### J.6 — httpOnly + Secure auth cookies

**👉 Do this:**

1. While logged in (production HTTPS), DevTools → **Application** → **Cookies** → select the site.

**✅ What you should see:** the Supabase auth cookie(s) (`sb-…-auth-token`) have **HttpOnly = ✓** and **Secure = ✓** (the Secure flag only shows on HTTPS — on `localhost` HTTP it may be unset, which is expected; verify on the Vercel URL). HttpOnly means client JS can't read them (you also can't see the token value in `document.cookie` from the Console).

`Result:` Chrome [ ] PASS [ ] FAIL [ ] N/A · iOS [ ] PASS [ ] FAIL [ ] N/A · Android [ ] PASS [ ] FAIL [ ] N/A

---

### J.7 — Realtime channel cleanup parity (automated)

**👉 Do this:**

1. From the repo root:
   ```powershell
   pnpm --filter @fynestudy/web test -- features/live/__tests__/realtimeCleanupAudit.test.ts
   ```

**✅ What you should see:** the realtime-cleanup audit passes — every `supabase.channel(` has a matching `removeChannel` on unmount (no ghost subscriptions). If it fails, it prints the offending file path.

`Result:` Chrome [ ] PASS [ ] FAIL

---

### J.8 — Full automated gate sweep

**👉 Do this — from the repo root, in order:**

```powershell
pnpm --filter @fynestudy/web typecheck
pnpm --filter @fynestudy/web lint
pnpm --filter @fynestudy/web test
pnpm --filter @fynestudy/web build
```

**✅ What you should see:**

- `typecheck` → 0 errors.
- `lint` → 0 errors / 0 warnings.
- `test` → all unit tests pass (196/196 across 24 files at the Phase-4 baseline; Phase 5 may add hardening tests — note the new total).
- `build` → 36 routes + `sw.js`, no `Attempted import error`.

`Result:` typecheck [ ] PASS [ ] FAIL · lint [ ] PASS [ ] FAIL · test [ ] PASS [ ] FAIL (___/___) · build [ ] PASS [ ] FAIL

**§J Notes / patch:**

---

# §Z — Acceptance sign-off

Tick when every box is green (or correctly N/A). These mirror the **Acceptance criteria** in `phase-5-hardening-qa-launch.md`.

- [ ] **§A** Auth & onboarding all PASS on Chrome + iOS + Android (login each role, forgot/reset round-trip, force-change, suspended, admin-redirect, sign-out from Profile, PWA install on all three).
- [ ] **§B** Student dashboard & profile (every section, badge celebration + confetti, streak modal, 3 profile tabs, change password, Terms & privacy).
- [ ] **§C** Attendance (rotating QR 30s/25s, live teacher-mark realtime, history rings) + leaderboard (weekly/all-time, my-rank, public card, calc modal).
- [ ] **§D** Library drill + search + video (resume/watermark/no-controls=0) + PDF (resume page/tiled watermark/zoom +/-).
- [ ] **§E** Quizzes (full attempt + auto-save resume + KaTeX solutions + retake + no answer-key leak).
- [ ] **§F** Exams (instant + manual release, **server timer survives a device-clock change**, tab-switch banner, auto-submit, locked result card).
- [ ] **§G** Live (lobby→live, chat + 5/30s rate-limit, raise-hand, ban + delete, pinned, end-of-class) + recording (replay + speed pills + chat replay) + **one real OBS→YouTube dry-run**.
- [ ] **§H** Teacher portal (scan + denied fallback, classes/schedule/ad-hoc, content upload, quiz + exam builders, results release + 3-mode regrade, offline scores, batch analytics, roster corrections, live-control).
- [ ] **§I** Responsive 320→1440 every route; cross-browser matrix; offline banner; deep-link/refresh resume; pinch-zoom allowed; reduced-motion disables confetti; keyboard/focus/Esc.
- [ ] **§J** Lighthouse mobile ≥80 + PWA installable; heavy libs code-split; **no `is_correct` in network**; **no service-role key in bundle**; signed-URL-only storage + raw-bucket 403; CSP doesn't break YT/pdf.js; httpOnly+Secure cookies; realtime cleanup parity; typecheck/lint/test/build green.
- [ ] **Launch:** live on the production Vercel URL; Supabase **Redirect URLs / Site URL** include the production origin; edge-fn **CORS** allow-list includes the production origin + `localhost:3000`; production smoke (login + one flow each from §D/§E/§G/§H) green.
- [ ] **Docs:** `docs/web-app-deploy.md` written; `README.md` + `CLAUDE.md` updated; Sentry/PostHog deferred (documented, mirroring mobile) with a `lib/log.ts` shim in place.

**Tested by:** _____________________________
**Date:** _________________________________
**Browser versions (Chrome / iOS Safari / Android Chrome):** _____________________________
**Production URL tested:** _____________________________
**Open follow-ups / patches:** _____________________________

---

## Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Reset email link 404s / bounces | Web origin not in Supabase Redirect URLs | Add the web origin (Authentication → URL configuration); §A.6 + §H/16 |
| Camera won't start on a phone | `getUserMedia` needs HTTPS + a gesture | Use the Vercel URL; tap **Start camera** (don't expect auto-start) |
| Copy buttons in live-control do nothing | Clipboard blocked on insecure context | Use `localhost`/`https`/Vercel, not a plain `http://` LAN IP |
| Exam timer jumps when I change my clock | (Should NOT happen) server-time resync broken | If it does, that's a §F.3 FAIL — report it (D-183 regression) |
| Math shows as `$...$` text | CSP blocked KaTeX fonts, or KaTeX not loaded | Check Console for a CSP font-block; §J.5 |
| YouTube iframe blank + "Refused to frame" in Console | CSP too strict | Allow `https://www.youtube.com` + `youtube-nocookie.com` in frame-src; §J.5 |
| PDF blank + "Refused to load worker blob:" | CSP `worker-src`/`blob:` missing | Add `blob:` to worker-src; §J.5 |
| Bundle scan prints a non-zero count | Service-role secret bundled into a client file | Stop; find the `process.env.SUPABASE_SERVICE_ROLE_KEY` in a `"use client"` file |
| Live chat doesn't sync across windows | Realtime websocket not subscribed | DevTools → Network → WS; look for the `chat-{id}` frame; reload |
| App white-screens offline | SW caching authenticated API responses | SW must precache only the static shell; §I.3 |

End of Phase 5 manual test plan.
