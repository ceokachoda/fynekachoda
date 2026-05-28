# Phase 1 — Manual Test Plan (`apps/web`)

> **Audience:** the human running the manual tests. **Zero coding background required** — every step has the exact buttons to click, the exact URL to type, and what you should see on screen.
>
> **What you're testing:** the brand-new `apps/web` web client (Next.js 15 PWA) before we declare Phase 1 done. Walk through every section in order. **Chrome on a laptop / desktop is required.** iOS Safari + Android Chrome rows that need HTTPS are tagged **carry-over** (do them after the Vercel deploy session — that's intentional and not a blocker).
>
> **How to record results:** every test ends with `[ ] PASS / [ ] FAIL / [ ] N/A`. Tick one box. If FAIL, write what you saw in the space below it and ping me — I'll diagnose. If N/A, write the reason (most common: the optional accounts in §0.3 don't exist yet).
>
> **Estimated time:** ~45 minutes on Chrome desktop if no failures. Add ~15 min for the optional §0.3 account creation. iOS + Android carry-overs are ~20 min each, done later.

---

## 🔑 Test accounts — quick reference (verified live 2026-05-28)

All 5 accounts below were just checked against Supabase auth. Email + password copy-paste straight from here.

| Use in section | Email | Password |
|---|---|---|
| **§B1** + **§C4–C7** + **§D1/D3/D4** + **§E** + **§F** + **§G** (student) | `review.student@fynestudy.app` | `ReviewStudent#2026` |
| **§B2** + **§B3** (teacher) | `review.teacher@fynestudy.app` | `ReviewTeacher#2026` |
| **§B5** (owner — admin redirect) | `owner@fynestudy.example.com` | `FyneOwner#2026` |
| Bonus extra student (Aarav, Batch A) — handy if you need a 2nd account | `test.aarav@fynestudy.app` | `TestPass#2026` |
| Bonus extra student (Diya, Batch A) — same | `test.diya@fynestudy.app` | `TestPass#2026` |

**🆕 §C1–§C3 fresh account (created 2026-05-28, ready to use):**

| Field | Value |
|---|---|
| Email | `c.fresh.20260528110246@fynestudy.app` |
| Temp password | `Dc_gj3q%nYME2t` |
| `must_change_password` | `true` (so first login → `/force-password-change`) |
| Batch | Batch A |

Sign in with these in §C1 → web app forces you to `/force-password-change` (that's §C1 PASS). Set any strong new password in §C2 (≥10 chars, upper + lower + digit). The account is single-use — burn it on §C1–§C3 only.

**Skipped sections (mark N/A):**
- **§B4** multi-role (`web.multirole@fynestudy.app`) — account never created.
- **§B6** suspended (`web.suspended@fynestudy.app`) — account never created.
- **§D2** multi-role switch — same reason as §B4.
- **§C5–§C7** reset-email flow — `review.student@fynestudy.app` is a placeholder domain with no real inbox; mark N/A with reason "no inbox access for the test student" (the test plan already offers this).

> Source of truth for credentials: `CREDENTIALS.local.md` at the repo root (git-ignored, do not paste publicly).

---

## Table of contents

- **§0 Setup** — `apps/web` dev server, env file, test accounts (do this once)
- **§A Public + unauth** — visiting the site signed-out (6 tests)
- **§B Role-based login + routing** — student / teacher / admin / multi-role / suspended (9 tests)
- **§C Force-password-change + forgot/reset** — `auth-change-own-password` + audit (7 tests)
- **§D Profile menu + sign-out + browser-back** — 4 tests
- **§E Responsive layout** — desktop ↔ mobile-web (4 tests)
- **§F PWA installability** — manifest + service worker + Lighthouse (4 tests)
- **§G Static-asset + security checks** — bundle audit (5 tests)
- **§H Automated tests** — typecheck / lint / vitest / build / Playwright (5 commands)
- **§I Acceptance sign-off** — sum up the boxes and post the date

---

# §0 — Setup (do this once, before any test below)

This section gets your laptop ready. Allow ~10 minutes.

### 0.1 — Open a terminal and confirm the repo + branch

**👉 Do this:**

1. Open **PowerShell** on Windows: press `Win+R`, type `powershell`, press Enter.
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Check what git branch you're on:
   ```powershell
   git status
   ```

**✅ What you should see:**

- The very first line says: `On branch web-phase-1`.
- Underneath, a long list of files (some marked `M` = modified, some marked `??` = untracked). That's expected — Phase 1's new files (`apps/web/...`) are uncommitted on purpose. **Do NOT commit them yet.**

**❓ If something looks different:**

- Says `On branch phase-4` or `main` → you forgot to switch branches. Run `git checkout web-phase-1` and try again.
- Says `fatal: not a git repository` → you're in the wrong folder. Re-run the `cd` command exactly as above.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### 0.2 — Confirm `apps/web/.env.local` exists and has the right keys

The `.env.local` file holds private config (Supabase URL + anon key) that the web app reads on startup. It's in `.gitignore` so it never gets committed.

**👉 Do this:**

1. In the same PowerShell terminal:
   ```powershell
   notepad apps/web/.env.local
   ```
2. Notepad opens.

**✅ What you should see (3 lines, in any order):**

```
NEXT_PUBLIC_SUPABASE_URL=https://orqwyazvcthgxoadfxfv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZfvA-ky5eOQ3c-e9yCiLnQ_c06ZYmz9
NEXT_PUBLIC_ADMIN_URL=https://fyne-study-app-admin.vercel.app
```

**❓ If something looks different:**

- "Cannot find the path …" → the file is missing. Create it by copying these 3 lines into a new file at `C:\Users\kaust\OneDrive\Desktop\FyneStudyLive\apps\web\.env.local`. Save as **All Files**, not `.txt`.
- File has extra lines containing `SUPABASE_SERVICE_ROLE_KEY` or `SENTRY` → **delete those lines** and save. The web app must NEVER see the service-role key.

Close Notepad after confirming.

`Result:` [ ] PASS · [ ] FAIL

---

### 0.3 — Start the web dev server (leave it running for the whole session)

The dev server is the local copy of the FyneStudy web app, running on your laptop at `http://localhost:3000`.

**👉 Do this:**

1. In the PowerShell terminal:
   ```powershell
   pnpm --filter @fynestudy/web dev
   ```
2. Wait about 5 seconds.

**✅ What you should see (in the terminal):**

```
> @fynestudy/web@0.0.0 dev …
> next dev

   ▲ Next.js 15.5.18
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000
   - Environments: .env.local

 ✓ Starting...
 ○ (serwist) Serwist is disabled.
 ✓ Ready in 3.4s
```

The terminal **stays running** — that's the dev server. Don't close the window. (When you're done with all tests, you'll close it by pressing `Ctrl+C` twice and answering `Y`.)

**❓ If something looks different:**

- "Cannot find module …" → the deps aren't installed. Stop the dev server (`Ctrl+C`), then run `pnpm install` at the repo root, then re-run the `pnpm --filter @fynestudy/web dev` command.
- "Port 3000 is in use" → something else is using that port. Stop the dev server, then in a NEW PowerShell window run `taskkill /F /IM node.exe` to kill any stuck Node processes, then re-run.
- "Missing env: NEXT_PUBLIC_SUPABASE_URL" → you skipped §0.2. Go back and create the `.env.local` file.

**Now open a browser tab:** type `http://localhost:3000` in the address bar and press Enter. You should be redirected to `http://localhost:3000/login` and see the FyneStudy logo + a sign-in form.

`Result:` [ ] PASS · [ ] FAIL

---

### 0.4 — (Optional) Create the multi-role + suspended test accounts

> **🟡 SKIPPED by user 2026-05-28** — you chose to skip account creation. §B4 + §B6 below default to **N/A**. The carry-over is logged for Phase 5 hardening. Jump to §0.5.

These are needed for §B4 (multi-role flow) and §B6 (suspended flow). **You can skip this and mark those tests N/A** — they're tracked as a Phase 1 carry-over. Or take ~10 minutes now and do them properly.

You'll create two NEW accounts in the FyneStudy admin panel.

#### 0.4.A — Sign in to the admin panel

**👉 Do this:**

1. Open a NEW browser tab.
2. Go to: `https://fyne-study-app-admin.vercel.app/login`
3. Email: `owner@fynestudy.example.com`
4. Password: `FyneOwner#2026`
5. Click **Sign in**.
6. You'll be asked for a TOTP code → open your authenticator app (Google Authenticator / Authy / etc.) → find "FyneStudy Admin" → type the 6-digit code → submit.

**✅ What you should see:** an admin dashboard with a left sidebar (Overview, Students, Teachers, Admins, Batches, …).

**❓ If you've lost your TOTP app:** see `CREDENTIALS.local.md §1` ("Lost the authenticator app?"). Skip §0.4 entirely and mark §B4 + §B6 as N/A below.

#### 0.4.B — Create the multi-role account

A multi-role user is one who has BOTH a `student` row AND a `teacher` row tied to the same email.

**👉 Do this:**

1. In the admin sidebar, click **Students**.
2. Click the **+ New student** button (top right corner).
3. Fill the form:
   - Email: `web.multirole@fynestudy.app`
   - Full name: `Web MultiRole`
   - Batch: pick **Batch A** (or whichever first batch shows up)
   - Phone / DOB / gender / etc. — fill any plausible value (e.g. phone `9999999991`, DOB `2010-01-01`, gender `Male`).
4. Click **Create student**.
5. A success screen shows a **temporary password** (something like `Temp#abc123`). **Write it down** — you'll need it.
6. Now in the sidebar, click **Teachers**.
7. Click **+ New teacher**.
8. Fill the form using the **SAME email**: `web.multirole@fynestudy.app`, full name `Web MultiRole`, pick the first subject available. (The system will attach a `teacher` role to the existing `app_user` row — it won't create a duplicate.)
9. Submit. If there's a confirmation prompt about the email already existing, click **Continue** / **Yes** / **Attach role** — whichever the wording is.

**Now log in once to clear the must-change-password flag:**

10. Open a NEW browser tab (or use Chrome Incognito): `http://localhost:3000/login`.
11. Email: `web.multirole@fynestudy.app`
12. Password: the temp password you wrote down.
13. Click Sign in. You'll land on **/force-password-change**.
14. New password: `WebMulti#2026` (or anything you'll remember that's ≥10 chars + has upper + lower + digit).
15. Confirm new password: same.
16. Click **Save and continue**. You'll land on **/role-chooser** because the account now has both student + teacher roles. **That's correct.**
17. Click **Continue as student** (or teacher — doesn't matter, we just want to land on the dashboard once).
18. Once on `/`, sign out (top-right avatar → Sign out).

**✅ Account is ready.** Add these credentials to a sticky note for §B4:
```
Email: web.multirole@fynestudy.app
Password: WebMulti#2026
```

#### 0.4.C — Create the suspended account

**👉 Do this:**

1. Back to the admin panel tab.
2. Sidebar → **Students** → **+ New student**.
3. Fill:
   - Email: `web.suspended@fynestudy.app`
   - Full name: `Web Suspended`
   - Batch: **Batch A**
   - Phone / DOB — any plausible.
4. Submit. Write down the temp password.
5. Open `http://localhost:3000/login` in a new Incognito tab.
6. Sign in with the suspended email + temp password.
7. You'll land on `/force-password-change`. Set a new password (e.g. `WebSuspended#2026`).
8. Once on `/`, sign out (top-right avatar → Sign out).
9. Back in the admin panel: Sidebar → **Students** → find `Web Suspended` in the table → click the row.
10. On the student detail page, find a **Suspend** button (or a toggle labeled `Active` that you flip off). Click it.
11. Confirm the suspension.

**✅ Account is ready.** Credentials for §B6:
```
Email: web.suspended@fynestudy.app
Password: WebSuspended#2026
```

`Result of §0.4:` [ ] DONE — both accounts created · [ ] SKIPPED — §B4 + §B6 will be N/A

---

### 0.5 — Owner-admin test account (already exists, no creation needed)

For §B5 you'll log in to the web app as the owner admin. The web app should redirect to `/admin-redirect` (because admins use the dedicated admin panel, not the web app).

The TOTP code you'd see on the admin panel is **not relevant** for the web app — the web app routes admins away BEFORE asking for any TOTP code. So you only need email + password:

```
Email: owner@fynestudy.example.com
Password: FyneOwner#2026
```

`Result:` [ ] noted — proceed.

---

### 0.6 — Open the browser DevTools

You'll use DevTools (the developer panel built into Chrome) several times below. Get familiar with how to open it now.

**👉 Do this:**

1. On the `http://localhost:3000/login` tab in Chrome.
2. Press **F12** on your keyboard. (Or: right-click anywhere on the page → **Inspect**.)
3. A panel opens — usually at the bottom or right side of the browser. It has tabs at the top: `Elements`, `Console`, `Sources`, `Network`, `Performance`, `Memory`, `Application`, `Security`, `Lighthouse`.

**❓ If you can't see DevTools:** they may have opened in a separate window. Look at your taskbar for a second Chrome window. If still can't find it, close Chrome and reopen, then press F12 again.

`Result:` [ ] PASS — DevTools opens.

---

# §A — Public + unauth flows (Chrome desktop)

These are the first impressions a signed-out person sees. Open `http://localhost:3000` in a Chrome **Incognito window** so cookies from previous tests don't interfere (Ctrl+Shift+N for a new Incognito window).

---

### A1 — Visiting the root URL while signed-out redirects to /login

**👉 Do this:**

1. In the Incognito window's address bar, type: `http://localhost:3000/`
2. Press Enter.

**✅ What you should see:**

- The address bar URL changes to: `http://localhost:3000/login`
- The page shows:
  - The FyneStudy logo (blue gradient pill + "fynestudy" wordmark) at the top.
  - A heading **"Welcome to FyneStudy"**.
  - Subtitle: "Sign in with the email your institute issued."
  - An `Email` field, a `Password` field, and a blue **Sign in** button.
  - A small "Forgot password?" link on the right under the button.
  - Footer text: "Admin-issued accounts only. Contact your institute if you don't have one."

**❓ If you see something else:**

- Browser shows "This site can't be reached" → dev server died. Go back to PowerShell and check it's still running. If terminated, restart with `pnpm --filter @fynestudy/web dev`.
- Page shows "Something went wrong" → bug. Take a screenshot, copy the **Reference: xxxxx** number, and paste it below.

`Result:` [ ] PASS · [ ] FAIL — _If FAIL, what you saw:_

---

### A2 — Privacy Policy page renders

**👉 Do this:**

1. In the same Incognito window, address bar: `http://localhost:3000/privacy`
2. Press Enter.

**✅ What you should see:**

- A long document with the heading **"FyneStudy — Privacy Policy"** at the top.
- The FyneStudy logo at the very top (small, links back to `/`).
- Sections like "Who this policy is for", "What data we collect", "Children and minors", etc.
- The text contains `{{PLACEHOLDER}}` strings — that's normal (the institute fills those in before publishing).

**❓ If you see something else:**

- "404 — that page doesn't exist" → file path bug. Tell me.
- Page is blank → the markdown loader failed. Tell me.

`Result:` [ ] PASS · [ ] FAIL

---

### A3 — Terms of Use page renders

**👉 Do this:**

1. Address bar: `http://localhost:3000/terms`
2. Press Enter.

**✅ What you should see:**

- Heading **"FyneStudy — Terms of Use"**.
- A line `Last updated: 28 May 2026`.
- Sections 1–7 (Who can use FyneStudy, Acceptable use, Content ownership, Data handling, etc.).
- A link in section 4 saying "Privacy Policy" — clicking it goes back to `/privacy`.

`Result:` [ ] PASS · [ ] FAIL

---

### A4 — Wrong password shows inline error

**👉 Do this:**

1. Address bar: `http://localhost:3000/login`
2. In the Email field type: `review.student@fynestudy.app`
3. In the Password field type: `definitely-wrong-xxx`
4. Click **Sign in**.

**✅ What you should see:**

- The button text briefly changes to **"Signing in…"**.
- Then a **red error banner** appears above the button with the text **"Invalid email or password."**.
- The URL stays on `http://localhost:3000/login` — you are NOT redirected.

**❓ If you see something else:**

- "Something went wrong" error page → bug.
- Redirects to `/` despite the wrong password → very bad bug; tell me.

`Result:` [ ] PASS · [ ] FAIL

---

### A5 — Clicking "Forgot password?" goes to /forgot-password

**👉 Do this:**

1. Still on `/login`, click the small **Forgot password?** link below the password field.

**✅ What you should see:**

- URL becomes `http://localhost:3000/forgot-password`.
- New heading: **"Reset password"**.
- Subtitle: "We'll send a one-time reset link to your registered email."
- A single `Email` field and a **Send reset link** button.

`Result:` [ ] PASS · [ ] FAIL

---

### A6 — Submitting the forgot-password form shows the success card

**👉 Do this:**

1. On `/forgot-password`, type `review.student@fynestudy.app` in the email field.
2. Click **Send reset link**.

**✅ What you should see:**

- The button briefly says "Sending…".
- Then a **green confirmation card** appears with: "If an account exists for **review.student@fynestudy.app**, we've sent a reset link. It expires in 1 hour. Check your inbox (and spam folder)."
- A link "← Back to sign in" below the card.

**❓ Note:** the actual email may or may not arrive (depends on whether Supabase SMTP is set up for that test address). The web app's behavior — showing this confirmation card — is what we're checking. (You'll test the real email flow in §C.)

`Result:` [ ] PASS · [ ] FAIL

---

# §B — Role-based login + routing

Close the Incognito window from §A. We'll do these in a regular (non-incognito) Chrome window so cookies persist across tests.

---

### B1 — Sign in as a student → lands on student home

**👉 Do this:**

1. Open `http://localhost:3000/login` in a fresh Chrome tab.
2. Email: `review.student@fynestudy.app`
3. Password: `ReviewStudent#2026`
4. Click **Sign in**.

**✅ What you should see (after ~1 sec):**

- URL becomes `http://localhost:3000/`.
- **Side-rail** on the left (since your window is wide enough — must be ≥ 1024 px) with the FyneStudy logo at the top and 7 navigation items in this order: **Home** (highlighted blue), **Classes**, **Library**, **Attendance**, **Ranks**, **Profile**, **Menu**. Each row has an icon on the left + a label.
- Main content area shows:
  - A greeting like **"Good morning, Review"** (the time of day changes the word).
  - A blue-tinted welcome card with the heading **"Welcome to FyneStudy on the web"**.
  - Inside the card: "You're signed in as a **student**. The full student experience…".
  - Two grey-bordered cards underneath: "Today's schedule" and "Weak topics", both showing "Coming in Phase 2".
- At the bottom of the side-rail: your name **Review Student** + email + an avatar circle with your initials.

**❓ If you see something else:**

- "Something went wrong" → bug. Paste the **Reference: xxxxx** number below.
- URL goes to `/force-password-change` → the seed account got a flag reset somehow. Tell me; for now use the multi-role account from §0.4 instead.
- Side-rail doesn't show, only a bottom bar → your browser window is < 1024 px wide. Resize wider.

`Result:` [ ] PASS · [ ] FAIL

---

### B2 — Sign out + sign in as a teacher → teacher home

**👉 Do this:**

1. Click your name / avatar at the bottom of the side-rail. A dropdown menu opens.
2. Click **Sign out**.
3. URL becomes `/login`.
4. Email: `review.teacher@fynestudy.app`
5. Password: `ReviewTeacher#2026`
6. Click **Sign in**.

**✅ What you should see:**

- URL becomes `/`.
- Side-rail now shows **8** items in this order: **Home** (highlighted), **Scan**, **Classes**, **Library**, **Quizzes**, **Exams**, **Batch**, **Profile**. (Note: no "Ranks", no "Attendance", no "Menu" — those are student-only.)
- Welcome card text says "You're signed in as a **teacher**".
- The right-side card now says "Active batches" (not "Weak topics").

`Result:` [ ] PASS · [ ] FAIL

---

### B3 — Click each side-rail item → each shows a placeholder

Still signed in as teacher.

**👉 Do this:**

1. In the side-rail, click each of these items in order: **Scan**, **Classes**, **Library**, **Quizzes**, **Exams**, **Batch**, **Profile**. After each click, look at the page.
2. Then click **Home** at the top to return.

**✅ What you should see (for each tab):**

- The URL changes to match the tab name (`/scan`, `/classes`, `/library`, etc. — except **Library** for teacher is at `/content`).
- The tab you just clicked is highlighted in the side-rail (blue tint).
- The main area shows:
  - A page heading matching the tab (e.g. "Scan", "Quizzes", "Batch").
  - A dashed-border card with an icon, the text "Coming in Phase 2/3/4", and a description.
- Clicking "Home" returns you to the dashboard with the welcome card.

**❓ Special note:** "Library" appears in the teacher side-rail but routes to `/content` (the teacher upload UI). That's correct — student-facing library is at `/library`, teacher-facing is at `/content`. You'll see them merge in Phase 2.

`Result:` [ ] PASS · [ ] FAIL

---

### B4 — Multi-role flow (only if §0.4.B accounts exist)

**Mark this section N/A if you skipped §0.4.B.**

> **🟡 N/A (default) — user skipped §0.4 on 2026-05-28.** Tick the N/A box on each B4 sub-test and move to §B5. Re-test in Phase 5 hardening once the multi-role account is created.

#### B4 — Sign in as multi-role → forced to /role-chooser

**👉 Do this:**

1. Sign out (avatar → Sign out).
2. Email: `web.multirole@fynestudy.app`
3. Password: `WebMulti#2026`
4. Click Sign in.

**✅ What you should see:**

- URL becomes `http://localhost:3000/role-chooser`.
- Heading: **"Choose a role"**.
- Subtitle: "Your account has both student and teacher roles. Which one are you using today?"
- Two large buttons stacked: **Continue as student** (blue) and **Continue as teacher** (outline).
- A small "Sign out" link below them.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason:_

#### B4.1 — Continue as teacher

**👉 Do this:**

1. On the role-chooser, click **Continue as teacher**.

**✅ What you should see:**

- URL becomes `/`.
- Side-rail shows the **8-item teacher nav** (same as §B2).
- Welcome card says **"teacher"**.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

#### B4.2 — Switch role via profile menu

**👉 Do this:**

1. Click your avatar at the bottom of the side-rail. The dropdown opens.
2. You should now see an item **"Switch to student"** (because this is a multi-role account).
3. Click **Switch to student**.

**✅ What you should see:**

- URL stays `/`.
- Side-rail flips to the **7-item student nav** (Home, Classes, Library, Attendance, Ranks, Profile, Menu).
- Welcome card now says **"student"**.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

---

### B5 — Admin account is redirected to /admin-redirect

**👉 Do this:**

1. Sign out.
2. Email: `owner@fynestudy.example.com`
3. Password: `FyneOwner#2026`
4. Click Sign in.

**✅ What you should see:**

- URL becomes `http://localhost:3000/admin-redirect`.
- A card with the heading **"Admin account"**.
- Text: "Admin operations happen on the web admin panel. Use a browser to sign in at the admin URL below."
- A blue **Open admin panel** button. Hovering it shows the target = `https://fyne-study-app-admin.vercel.app` (your admin URL from `.env.local`).
- A small **Sign out** link.
- **No side-rail.** Only the centered card.

**❓ Note:** the web app does NOT ask for a TOTP code. Admins are routed away BEFORE any client-side MFA step — that's by design (only the admin panel needs TOTP, the mobile/web client doesn't).

**👉 Click the "Open admin panel" button.** A new tab opens to `https://fyne-study-app-admin.vercel.app`. ✅ Confirmed — close that tab. Then come back to the original tab and click **Sign out** before continuing.

`Result:` [ ] PASS · [ ] FAIL

---

### B6 — Suspended account is locked out (only if §0.4.C account exists)

**Mark N/A if you skipped §0.4.C.**

> **🟡 N/A (default) — user skipped §0.4 on 2026-05-28.** Tick the N/A box on each B6 sub-test and move to §C. Re-test in Phase 5 hardening once the suspended account is created.

#### B6 — Sign in as suspended → /suspended

**👉 Do this:**

1. From `/login`, email: `web.suspended@fynestudy.app`
2. Password: `WebSuspended#2026`
3. Click Sign in.

**✅ What you should see:**

- URL becomes `http://localhost:3000/suspended`.
- A red-bordered card with heading **"Account suspended"**.
- Text: "Your account has been suspended by an administrator. Please contact your institute to reactivate it."
- A dark **Sign out** button.
- **No side-rail.**

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

#### B6.1 — Suspended user cannot reach a tab even by typing the URL

**👉 Do this:**

1. While on `/suspended`, manually type into the address bar: `http://localhost:3000/library` and press Enter.

**✅ What you should see:**

- URL bounces straight back to `http://localhost:3000/suspended`. You never see the library page.
- The middleware blocks the request before any tab can render.

**👉 Also test:** type `/classes` → also bounces to `/suspended`. Type `/` → also bounces to `/suspended`. Then click **Sign out** to clean up.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

---

# §C — Force-password-change + forgot/reset (uses `auth-change-own-password` edge fn — locked in mobile decision D-153)

This section verifies the password-change flow that all new accounts (and recovered accounts) go through. The web app calls a single Supabase edge function called `auth-change-own-password` (not the standard Supabase API) — this is intentional so the password rotation, the must-change-password flag clear, and the audit-log entry all happen server-side in one transaction.

---

### C1 — Forced password-change after creating a fresh account

You need a NEW account that hasn't logged in yet (so its `must_change_password = true`). **Claude already created one for you 2026-05-28 — just use it directly.**

**👉 Do this:**

1. In your web-app tab, sign in at `http://localhost:3000/login`:
   - Email: `c.fresh.20260528110246@fynestudy.app`
   - Password: `Dc_gj3q%nYME2t`
2. Click Sign in.

**✅ What you should see:**

- URL becomes `http://localhost:3000/force-password-change` (NOT `/`).
- Heading: **"Choose a new password"**.
- Subtitle: "Your admin-issued temporary password must be changed before you continue."
- Two password fields + **Save and continue** button + a small Sign out button.
- **Try typing `/` in the address bar** → you bounce right back to `/force-password-change`. You can't skip this step.

`Result:` [ ] PASS · [ ] FAIL

---

### C2 — Fill in a new password and submit

**👉 Do this:**

1. New password: type `StrongP@ss123` (or anything that's ≥10 chars, has a lower + upper + digit, no spaces, and is not your email).
2. Confirm new password: same.
3. Click **Save and continue**.

**✅ What you should see:**

- Button briefly says "Saving…".
- URL becomes `/`.
- The student dashboard appears (welcome card, side-rail, etc.).

**👉 Now sign out and sign back in:**

4. Avatar → Sign out → back to `/login`.
5. Email: `web.freshpwd@fynestudy.app`, password: `StrongP@ss123`.
6. Sign in.

**✅ What you should see:** You go **directly to `/`** — NOT to `/force-password-change`. (The flag was cleared.)

`Result:` [ ] PASS · [ ] FAIL

---

### C3 — Audit row was written for the password change

This verifies that calling `auth-change-own-password` left a row in the database's audit log. (Mobile decision D-153 — see `docs/decisions.md` — requires this audit trail.)

**👉 Do this:**

1. Open a NEW browser tab.
2. Go to: `https://supabase.com/dashboard/project/orqwyazvcthgxoadfxfv/editor`
3. If asked, sign in to Supabase with the project owner's Google account.
4. In the left sidebar of the Supabase dashboard, click the **Table Editor** icon (looks like a grid).
5. In the schema dropdown (top of the table list), make sure **public** is selected.
6. Scroll the table list to find **audit_log** and click it.
7. The table opens, showing the most recent rows.
8. Click the **Sort** button (or the column header for `created_at`) → sort by `created_at` descending so newest is first.

**✅ What you should see:**

- The top row has:
  - `action` = `auth-change-own-password`
  - `created_at` = within the last few minutes
  - `actor_app_user_id` or `subject_app_user_id` = the ID for `web.freshpwd@fynestudy.app` (you can verify by clicking the row and reading the JSON in `before`/`after`).

**❓ If you don't see this row:**

- Wait 10 seconds, refresh, look again (edge functions can take a moment).
- If still missing, the edge function may have failed silently — paste the row count of the table below and ping me.

`Result:` [ ] PASS · [ ] FAIL

---

### C4 — Forgot-password flow: request the reset email

**👉 Do this:**

1. Back in the web-app tab. Sign out if signed in.
2. On `/login`, click **Forgot password?**.
3. URL becomes `/forgot-password`.
4. Email: `review.student@fynestudy.app`
5. Click **Send reset link**.

**✅ What you should see:**

- The green confirmation card from §A6 appears.

`Result:` [ ] PASS · [ ] FAIL

---

### C5 — Open the reset email link

**👉 Do this:**

1. The email is sent to `review.student@fynestudy.app`. Check that inbox.
2. **If you don't own that inbox** (the address is a test placeholder), you can verify the flow with your own admin email instead: go to admin panel → Students → find a student you own the email for → Reset password — or use the Supabase dashboard's **Authentication → Users** view to manually send a password recovery to your own email.
3. Open the email titled "Reset Your Password" (or similar from Supabase).
4. Click the **Reset Password** link inside the email.

**✅ What you should see:**

- A browser tab opens to `http://localhost:3000/reset` with a URL hash that includes `#access_token=…&type=recovery`.
- After a half-second pause (caption "Verifying reset link…"), the form appears with two password fields and a **Save and sign in** button.

**❓ If you see:**

- "This reset link is invalid or has expired" → the email link expired (1-hour limit). Re-do §C4 to get a fresh one.
- A 404 → your local dev server isn't on `localhost:3000`. Check the PowerShell window.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A — _reason: no inbox access for the test student_

---

### C6 — Set new password via reset and sign in

**👉 Do this:**

1. New password: `Reset#abc2026` (any valid password).
2. Confirm new password: same.
3. Click **Save and sign in**.

**✅ What you should see:**

- URL becomes `/` (student dashboard renders).

**👉 Sign out + sign in again with the new password to verify it sticks:**

4. Avatar → Sign out.
5. Email + new password → Sign in.
6. Lands on `/`. ✅

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

---

### C7 — Audit row for the reset password

**👉 Do this:**

1. Repeat §C3 — open Supabase Studio → Table Editor → audit_log → sort by `created_at` desc.

**✅ What you should see:**

- A new top row with `action = auth-change-own-password` and `created_at` within the last few minutes.

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

---

# §D — Profile menu + sign-out + browser-back

Make sure you're signed in as the student (`review.student@fynestudy.app` / `ReviewStudent#2026`) for the next 4 tests.

---

### D1 — Profile menu for a single-role student

**👉 Do this:**

1. On `/` (the dashboard), look at the BOTTOM of the side-rail. You should see a button with your avatar (initials in a blue circle) + your name **"Review Student"** + the role label **"student"** in tiny grey caps.
2. Click that button.

**✅ What you should see:**

- A dropdown menu opens above (or below) the button.
- It contains:
  - Your full name (bold) + your email (subtle grey).
  - A separator line.
  - A red **Sign out** item with a logout icon.
- **NO "Switch to teacher" item** — because this is a single-role student account.

**👉 Click anywhere outside the menu** to close it (or press Escape).

`Result:` [ ] PASS · [ ] FAIL

---

### D2 — Profile menu for a multi-role user has "Switch to …"

**Only if §0.4.B exists; mark N/A otherwise.**

**👉 Do this:**

1. Sign out → sign in as `web.multirole@fynestudy.app` / `WebMulti#2026`.
2. On the role-chooser, pick **Continue as teacher**.
3. Click the profile menu at the bottom of the side-rail.

**✅ What you should see:**

- The dropdown now has THREE items:
  1. Name + email header.
  2. **"Switch to student"** (with a refresh icon).
  3. **"Sign out"** (red).

**👉 Click "Switch to student"** → side-rail flips to student nav. ✅

`Result:` [ ] PASS · [ ] FAIL · [ ] N/A

---

### D3 — Sign-out routes to /login

**👉 Do this:**

1. Click profile menu → **Sign out**.

**✅ What you should see:**

- URL becomes `http://localhost:3000/login`.
- Logo + sign-in form visible.
- **No flash** of the dashboard before the redirect.

`Result:` [ ] PASS · [ ] FAIL

---

### D4 — Browser back-button cannot re-enter the app after sign-out

**👉 Do this:**

1. After §D3, click the browser's **Back** arrow (top-left of the browser).

**✅ What you should see:**

- URL stays on `/login` (or briefly tries `/` then bounces back).
- The dashboard does NOT appear.
- This proves the session cookie was cleared (the middleware sees no auth and re-redirects).

**❓ If the dashboard appears:** that's a bug — pings me.

`Result:` [ ] PASS · [ ] FAIL

---

# §E — Responsive layout

The web app has two layouts: a **side-rail desktop** layout (window ≥ 1024 px wide) and a **bottom-tabs mobile** layout (< 1024 px). You'll test both via Chrome DevTools' device-emulation mode.

Sign back in as the student.

---

### E1 — Desktop view: side-rail visible, no bottom tabs

**👉 Do this:**

1. Make sure your Chrome window is wide (≥ 1024 px — almost any normal-sized window).
2. On `/`.

**✅ What you should see:**

- Vertical **side-rail** on the LEFT (256 px wide).
- **No bottom navigation bar.**
- **No top bar with a logo + avatar.**

`Result:` [ ] PASS · [ ] FAIL

---

### E2 — Mobile-web view: top bar + bottom tabs

**👉 Do this:**

1. Open DevTools (F12).
2. Click the **device-emulation icon** — top-left of DevTools, looks like a tablet + phone outline. (Or press `Ctrl+Shift+M`.)
3. At the top of the browser viewport, a dropdown appears (probably says "Dimensions: Responsive"). Click it → pick **"iPhone 14 Pro"** or just set width manually to **390** and height to **844**.

**✅ What you should see (in the emulated viewport):**

- The side-rail is **gone**.
- A **TopBar** at the top of the page: small FyneStudy logo on the left + an avatar circle on the right.
- A **BottomTabs** bar fixed at the bottom: 7 tabs side-by-side (Home, Classes, Library, Attendance, Ranks, Profile, Menu — for the student). Each tab has an icon on top + the label below in tiny text.
- The active tab (currently Home) has its icon + label in the blue primary color.

`Result:` [ ] PASS · [ ] FAIL

---

### E3 — Layout resizes cleanly between 320 px ↔ 1440 px

**👉 Do this:**

1. Still in device-emulation mode, drag the right edge of the viewport to resize, OR change the width number at the top.
2. Try widths: 320 (small iPhone SE), 500, 768, 1023, 1024, 1280, 1440.

**✅ What you should see:**

- Layout never overflows horizontally (no horizontal scroll bar at the bottom).
- At widths < 1024 px → TopBar + BottomTabs.
- At widths ≥ 1024 px → side-rail.
- The switch happens crisply at 1024 — no half-rendered states.

`Result:` [ ] PASS · [ ] FAIL

---

### E4 — Bottom-tab navigation works on mobile

**👉 Do this:**

1. Set viewport width to 390 (iPhone).
2. In the bottom tab bar, click each tab in order (Home → Classes → Library → Attendance → Ranks → Profile → Menu → Home).

**✅ What you should see:**

- Each click navigates to the same routes you tested in §B3.
- The clicked tab is highlighted in blue.

**👉 Now close device-emulation** (click the device-icon button in DevTools again, or `Ctrl+Shift+M`). Layout returns to desktop side-rail. ✅

`Result:` [ ] PASS · [ ] FAIL

---

# §F — PWA installability

A PWA (Progressive Web App) lets the user "install" the website as a desktop / mobile app. This needs three things to work: a manifest file, a service worker, and the right meta tags.

Stay signed in as the student. You'll work in DevTools' **Application** tab.

---

### F1 — Manifest file loaded with the right values

**👉 Do this:**

1. Open DevTools (F12).
2. Click the **Application** tab at the top of DevTools. (If you don't see it, click the `»` chevron — it might be hidden because the panel is narrow.)
3. In the left sidebar of the Application panel, find the **Manifest** section (under "Application") and click it.

**✅ What you should see (right side):**

- **Name:** `FyneStudy — Coaching OS`
- **Short name:** `FyneStudy`
- **Description:** `FyneStudy: classes, attendance, quizzes, exams, library and live sessions for students and teachers.`
- **Start URL:** `/`
- **Theme color:** a blue swatch (`#2563EB`)
- **Background color:** white (`#FFFFFF`)
- **Display:** `standalone`
- **Icons:** three entries listed — 192 (any), 512 (any), 512 (maskable).

**❓ If you see "No manifest detected":** the manifest endpoint didn't load. Check Network tab for `/manifest.webmanifest` returning 200.

`Result:` [ ] PASS · [ ] FAIL

---

### F2 — Install the app on Chrome desktop

**👉 Do this:**

1. Look at the Chrome address bar. On the RIGHT side, you should see an **install icon** — a small computer/monitor with a downward arrow. (If you don't see it, click the URL bar — the icon may appear after a beat. Or check the three-dot menu → "Install FyneStudy…")
2. Click the install icon.
3. A small confirmation dialog appears: "Install FyneStudy?" with an Install button.
4. Click **Install**.

**✅ What you should see:**

- A new **standalone window** opens, with NO browser chrome (no address bar, no tabs) — just the FyneStudy app.
- The title bar / dock shows the FyneStudy icon (blue gradient pill).
- The web app works inside that window exactly like it does in the browser.

**👉 Close the installed window when done.** (To uninstall later: open the standalone app → click the three-dot menu in its title bar → "Uninstall FyneStudy".)

**Mobile carry-over note:**
- iOS Safari requires HTTPS for "Add to Home Screen" → defer to the Vercel deploy session.
- Android Chrome also typically wants HTTPS for "Install app" prompts → defer to the Vercel deploy session.

`Result on Chrome desktop:` [ ] PASS · [ ] FAIL
`iOS Safari:` [ ] CARRY-OVER (do after Vercel deploy)
`Android Chrome:` [ ] CARRY-OVER (do after Vercel deploy)

---

### F3 — Service worker is registered and running

**👉 Do this:**

1. Back in DevTools → Application tab → left sidebar → **Service Workers** (under "Application" or "Background services").

**✅ What you should see:**

- A row labeled `localhost:3000` with a service worker source `sw.js`.
- Status: **#xxxx activated and is running** (where xxxx is a number).
- Update on reload: a checkbox (usually checked in dev).

**❓ Note:** Serwist (the service-worker library we use) is **disabled in dev mode** — only the `next start` production build registers a SW. So if the panel says "No service worker", that's expected in dev. To test:
1. Stop the dev server (`Ctrl+C` in PowerShell).
2. Run `pnpm --filter @fynestudy/web build` (wait ~30 sec).
3. Run `pnpm --filter @fynestudy/web start` (production server on `localhost:3000`).
4. Re-do this test — the SW should appear.

For Phase 1 it's enough to confirm either (a) the dev message saying SW is disabled, or (b) the SW is active in a production build. Pick one and tick PASS.

`Result:` [ ] PASS — _which mode you verified:_
[ ] dev (Serwist disabled banner in terminal) · [ ] production (SW listed as activated)

---

### F4 — Lighthouse PWA audit

Lighthouse is Chrome's built-in automated quality auditor. It'll grade the app for PWA-ness.

**👉 Do this:**

1. **First switch to production mode** (run `pnpm --filter @fynestudy/web build` then `pnpm --filter @fynestudy/web start` — see §F3 note). Lighthouse needs a production build to give meaningful scores.
2. Open the production app at `http://localhost:3000` (sign in as the student or just stay on `/login`).
3. DevTools (F12) → **Lighthouse** tab at the top.
4. Settings on the right side of the Lighthouse panel:
   - Mode: **Navigation (Default)**
   - Device: **Desktop**
   - Categories: tick **Performance**, **Accessibility**, **Best Practices**, **PWA**. (You can leave SEO off.)
5. Click **Analyze page load**.
6. Wait ~20 seconds while it runs.

**✅ What you should see:**

- A report appears below with 4 circular score gauges.
- **PWA category**: scroll to it. You should see green checkmarks for:
  - ✅ Installable manifest
  - ✅ Configured for a custom splash screen (or similar)
  - ✅ Sets theme-color
  - ✅ Has a `<meta name="viewport">`
- Some warnings are OK (e.g. "Icon dimensions don't match the size declared" — we use 512px for both 192 and 512 entries, a known carry-over).

**❓ If "Installable" fails:** Look at what specifically failed. Common causes:
- Service worker not registered → re-check §F3.
- Manifest icon paths wrong → look at the manifest section.

**👉 Stop the production server** (`Ctrl+C` in PowerShell) and re-run `pnpm --filter @fynestudy/web dev` to switch back to dev for the remaining tests.

`Result:` [ ] PASS — Installable green; some warnings expected · [ ] FAIL

---

# §G — Static-asset + security checks

These verify the production build is safe to ship.

---

### G1 — All static assets load (no 404s)

**👉 Do this:**

1. Open DevTools → **Network** tab (at the top of DevTools).
2. Tick the checkbox **"Disable cache"** at the top of the Network panel.
3. Press F5 to reload the page (still on `localhost:3000`).
4. Scan the list of requests that appears.

**✅ What you should see:**

- Every row has a green **200** in the Status column (some 304s for cached items are also fine).
- Specifically look for and confirm 200 on:
  - `manifest.webmanifest`
  - `sw.js` (only in production mode — see §F3 note)
  - `icons/icon-192.png`
  - `icons/icon-512.png`
  - Various `_next/static/...` chunks

**❓ If you see any 404 (red):** click the row to inspect; tell me what URL 404'd.

`Result:` [ ] PASS · [ ] FAIL

---

### G2 — No service-role key in the browser bundle

This is the single most important security check. The Supabase **service-role key** must NEVER appear in any file the browser downloads. Only the **anon (publishable)** key should be there.

**👉 Do this:**

1. In DevTools, click the **Sources** tab.
2. In the left tree, expand `localhost:3000` → `_next` → `static` → `chunks`.
3. With the chunks folder selected, press **`Ctrl+Shift+F`** (or click the magnifying-glass icon at the top-left of the Sources panel). A "Search across all files" input opens.
4. In the search box type: `SUPABASE_SERVICE_ROLE`
5. Press Enter.

**✅ What you should see:**

- **"No matches found"** or zero results.
- This proves the service-role key isn't in any JS file the browser downloaded.

**👉 Also search for:** `service_role` (lowercase). Should also be zero results.

**❓ If you see matches:** STOP. Tell me immediately. Don't deploy.

`Result:` [ ] PASS · [ ] FAIL — _matches found:_ ____

---

### G3 — Supabase auth cookie is HttpOnly

The session cookie should be HttpOnly (so JavaScript can't read it) and have `SameSite=Lax` (mitigates CSRF).

**👉 Do this:**

1. While signed in as the student.
2. DevTools → **Application** tab.
3. In the left sidebar of the Application panel: **Storage** → **Cookies** → **http://localhost:3000**.
4. Look at the table of cookies on the right.

**✅ What you should see:**

- One or more cookies named `sb-orqwyazvcthgxoadfxfv-auth-token` (Supabase may chunk it, so you may see `…auth-token.0`, `…auth-token.1`, etc.).
- For each Supabase auth cookie, the **HttpOnly** column has ✓ (checkmark).
- The **SameSite** column shows `Lax`.
- The **Secure** column may show empty on `localhost` (this is fine — Secure becomes true only on HTTPS, which Vercel will provide).
- Also see a `fynestudy_active_role` cookie (only if signed in as multi-role) with HttpOnly = empty (this one is intentionally readable — see `app/actions/set-active-role.ts`).

`Result:` [ ] PASS · [ ] FAIL

---

### G4 — No red errors in the console

**👉 Do this:**

1. DevTools → **Console** tab.
2. Click the trash-can icon at the top of the Console to clear it.
3. Click between tabs in the side-rail (Home → Classes → Library → Home).

**✅ What you should see:**

- **No red error messages** in the Console.
- Yellow warnings are OK (Next.js dev mode prints some). Specifically these are known + harmless:
  - "Using the user object as returned from supabase.auth.getSession() … insecure!" — this is a Supabase advisory; we use `getUser()` in the security-critical paths so this is informational.
  - "Serwist is disabled" — expected in dev mode.

**❓ If you see red errors:** click each to expand; paste the message below.

`Result:` [ ] PASS · [ ] FAIL — _red errors:_ ____

---

### G5 — RLS smoke script passes

This proves that with the anon key, a student JWT can only see their own row in the `app_users` table (no information disclosure via the anon-key surface).

**👉 Do this:**

1. Open a NEW PowerShell window (leave the dev server running in the first window).
2. Navigate to the repo:
   ```powershell
   cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
   ```
3. Run:
   ```powershell
   pnpm tsx apps/web/scripts/smoke-rls.ts
   ```

**✅ What you should see (printed in the terminal):**

```
✅ Signed in as review.student@fynestudy.app
✅ app_users returns exactly the signed-in user's row.
✅ exam_answers returned 0 rows; RLS is gating per-attempt access (see schema).

All Phase 1 RLS smoke checks passed.
```

**❓ If you see anything else:** copy the full output and ping me.

`Result:` [ ] PASS · [ ] FAIL

---

# §H — Automated tests (run from PowerShell)

These are the green gates a CI pipeline would enforce. Run each command and look at the bottom-line output.

**👉 In a PowerShell at the repo root, run each in order. Each ends with success/failure noise — only the trailing summary matters.**

### H1 — Typecheck

```powershell
pnpm --filter @fynestudy/web typecheck
```

**✅ Expected:** the command finishes silently (no errors printed). Exit code 0.

`Result:` [ ] PASS · [ ] FAIL

---

### H2 — Lint

```powershell
pnpm --filter @fynestudy/web lint
```

**✅ Expected:** no error output. The command exits silently.

`Result:` [ ] PASS · [ ] FAIL

---

### H3 — Unit tests (Vitest)

```powershell
pnpm --filter @fynestudy/web test
```

**✅ Expected (last lines):**

```
 Test Files  2 passed (2)
      Tests  13 passed (13)
```

`Result:` [ ] PASS · [ ] FAIL

---

### H4 — Production build

```powershell
pnpm --filter @fynestudy/web build
```

**✅ Expected (last lines):**

- A table of routes (`/`, `/login`, etc.) with sizes.
- A line `ƒ Middleware  89.4 kB`.
- No red errors anywhere in the output.
- The `(serwist) Bundling the service worker script` line shows the SW was bundled.

`Result:` [ ] PASS · [ ] FAIL

---

### H5 — Playwright end-to-end tests (3 browser projects)

Before running this, **stop the `pnpm dev` you started in §0.3** (Ctrl+C in that PowerShell window, type `Y` to confirm) — Playwright starts its own dev server.

```powershell
cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive\apps\web
pnpm exec playwright test e2e/auth.spec.ts --workers=2 --reporter=list
```

The first time you run this, Playwright will download the test browsers (~200 MB, one-time). After that it takes ~1 minute.

**✅ Expected (last line):**

```
21 passed, 6 skipped (1m)
```

The 6 skipped tests are the multi-role + suspended flows × 3 browsers, intentionally skipped until you set the env vars (see below). 21 = 9 implemented tests × 3 browser projects minus the role-chooser + suspended (5 tests × 3 = 15… see actual breakdown). Either way the number to watch is: **0 failed**.

**👉 Optional: un-skip multi-role + suspended** if §0.4 accounts exist:

```powershell
$env:E2E_MULTIROLE_EMAIL = "web.multirole@fynestudy.app"
$env:E2E_MULTIROLE_PASSWORD = "WebMulti#2026"
$env:E2E_SUSPENDED_EMAIL = "web.suspended@fynestudy.app"
$env:E2E_SUSPENDED_PASSWORD = "WebSuspended#2026"
pnpm exec playwright test e2e/auth.spec.ts --workers=2 --reporter=list
```

Now 27 tests should pass and 0 skipped.

**👉 After H5, restart the dev server in the original PowerShell window:**

```powershell
cd C:\Users\kaust\OneDrive\Desktop\FyneStudyLive
pnpm --filter @fynestudy/web dev
```

`Result:` [ ] PASS · [ ] FAIL — _passed/failed/skipped counts:_ ____

---

# §I — Acceptance sign-off

Tick the checkboxes once all rows above are marked PASS (or N/A with reason).

- [ ] **§A** all 6 PASS (public + unauth)
- [ ] **§B** B1, B2, B3, B5 PASS · B4/B4.1/B4.2 PASS or N/A · B6/B6.1 PASS or N/A
- [ ] **§C** C1–C2 PASS · C3 audit row confirmed · C4–C6 PASS or N/A · C7 audit row confirmed or N/A
- [ ] **§D** all 4 PASS (D2 may be N/A without multi-role)
- [ ] **§E** all 4 PASS
- [ ] **§F** F1, F3, F4 PASS · F2 PASS on Chrome desktop · iOS + Android marked CARRY-OVER
- [ ] **§G** all 5 PASS
- [ ] **§H** H1–H5 PASS (H5 with multi-role + suspended either un-skipped or accepted as skipped)

**Sign-off:**

```
Tester name:
Date:
Notes / anything unusual:
```

Once these boxes are ticked, paste this back to me (Claude). I will then:

1. Append the acceptance ledger to the bottom of `Phases/phase-1-foundation-auth-shell.md`.
2. Update `CLAUDE.md`'s "Web App Conversion track" with `Phase 1 ✅ — <today's date>` + a one-line summary.
3. Save `project_web-phase-1-status.md` in the project memory + add the pointer to `MEMORY.md`.
4. Commit the Phase 1 work to the `web-phase-1` branch (one commit, message `feat(web-phase-1): foundation, auth, app shell`).
5. **Stop.** Phase 2 starts in a fresh new conversation.

---

# Carry-overs (NOT blockers for Phase 1 acceptance)

These items are explicitly deferred and tracked:

1. **Vercel deploy** + Supabase Authentication redirect-URL whitelist + extending `apps/functions/_shared/cors.ts` with a `web-*.vercel.app` regex. (Per your 2026-05-28 decision: do this after Phase 1 acceptance, not during.)
2. **iOS Safari + Android Chrome on-device PWA install.** Both need HTTPS, which only Vercel provides. After Vercel deploy: open the Vercel URL on the phone and walk §F2 there.
3. **Un-skipping Playwright multi-role + suspended cases** for CI: set `E2E_MULTIROLE_*` + `E2E_SUSPENDED_*` env vars in `apps/web/.env.local` (the test file already reads them).
4. **`apps/web` CI workflow** — a new file under `.github/workflows/` running the H1–H5 commands on every push.
5. **`react-pdf` + `katex` local bundle** (Phase 2 hardening — out of scope for Phase 1).
6. **192×192 icon at real 192×192 resolution.** Today we serve the 512px icon at the `/icons/icon-192.png` path; some Lighthouse "PWA Optimized" warnings about this are expected (it doesn't block "Installable"). When you're ready, regenerate a real 192 from `store-assets/icon-512.png` using any image editor.

# Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm dev` says "port 3000 in use" | Stuck Node from a previous run | New PowerShell → `taskkill /F /IM node.exe` → re-run |
| "Cannot find module" on `pnpm dev` | Deps not installed | `pnpm install` at repo root, then re-run |
| Browser shows "This site can't be reached" | Dev server died | Look at the PowerShell window — restart it |
| "Something went wrong" page in dev | A Server Component threw an error | Look at the dev server's PowerShell output for the stack trace |
| Lighthouse score is missing data | Ran on `pnpm dev`, not `pnpm start` | Switch to production build (see §F4) |
| Playwright "No tests found" | Forgot to `cd apps/web` first | Run from `apps/web` directory |
| Reset email never arrives | Supabase SMTP not set up for test inbox | Use a real email you control (see §C5 note) |
