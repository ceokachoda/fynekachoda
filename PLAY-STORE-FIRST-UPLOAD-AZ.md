# 🚀 FyneStudy → Google Play Store — First-Time Upload (A‑Z, noob-proof)

You already built the **`.aab`** with EAS. This guide takes you from *"I have a file"*
to *"my app is on the Play Store"*, click by click. Read top to bottom — don't skip.

> **Should you just run `eas submit`?** ❌ **No, not this first time.** `eas submit`
> needs a Google "service account" API key you haven't created yet, and your
> first release has to be set up by hand in the Play Console anyway. **Upload the
> `.aab` manually** (Part 7). You can automate with `eas submit` for *future*
> updates once everything exists.

---

## ⏱️ Reality check — how long this takes
A brand-new **Personal** Google Play account can't go straight to the public store:

1. Create + pay for account, verify your identity → **1–3 days** (Google reviews ID).
2. **Closed test with 12+ real testers for 14 days** → **14 days minimum** (Google rule for new personal accounts).
3. Apply for production access → Google reviews → **a few days to ~1 week**.

➡️ **Plan for ~2–3 weeks total** before it's live to the public. The app *works*
for your testers on day 1 — it's just the *public* listing that waits.

---

## 📋 Table of contents
- [Part 0 — What you need ready](#part-0)
- [Part 1 — Create + pay for the developer account](#part-1)
- [Part 2 — Verify your identity](#part-2)
- [Part 3 — Create the app](#part-3)
- [Part 4 — Fill the "Set up your app" forms](#part-4) ← the big one
- [Part 5 — Main store listing (text + pictures)](#part-5)
- [Part 6 — Create the Closed testing track + add 12 testers](#part-6)
- [Part 7 — Upload your `.aab` and release to testers](#part-7)
- [Part 8 — Run the 14-day test → apply for production](#part-8)
- [Part 9 — Go live to the public](#part-9)
- [Appendix A — Copy-paste answers for FyneStudy](#appendix-a)
- [Appendix B — Common rejection reasons](#appendix-b)

---

<a name="part-0"></a>
## Part 0 — What you need ready (gather these first)

- [ ] The **`.aab`** file (you have it ✅). Know where it is on your computer.
- [ ] A **Google account** (Gmail) you'll use as the developer.
- [ ] **$25 USD** on a card (one-time, non-refundable developer fee).
- [ ] **Your ID** (passport/Aadhaar/driving licence) + address + phone (for identity check).
- [ ] **Privacy policy URL** — it's already hosted: **`https://fyne-study-app-admin.vercel.app/privacy`**
      👉 Open that link in a browser RIGHT NOW and confirm a privacy page loads. If it
      doesn't, tell me and we'll fix/publish it before you continue.
- [ ] **2 test logins** (a student + a teacher) from your `CREDENTIALS.local.md` —
      Google's reviewer needs these because your app has **no public sign-up**.
- [ ] **App graphics** (we'll make/locate these in Part 5):
  - App icon **512×512 PNG** (from your FyneStudy shield).
  - Feature graphic **1024×500 PNG**.
  - **At least 2–4 phone screenshots** (just take them on your phone).
- [ ] **12 people** (friends/colleagues/staff) with Gmail addresses who'll be your testers.

---

<a name="part-1"></a>
## Part 1 — Create + pay for the developer account

1. Go to **https://play.google.com/console** and sign in with your Google account.
2. Click **"Create developer account"**. Choose account type **"Yourself" (Personal)**.
3. Fill in: developer name (this shows publicly — e.g. **"FyneStudy"**), your legal
   name, address, email, phone. Verify the email/phone if asked.
4. Accept the **Developer Distribution Agreement** (tick the box).
5. **Pay the $25** registration fee with your card.
6. You'll land on the Play Console home. ✅ Account created.

> ⚠️ If it says your account is **"pending verification"** — that's normal, continue
> with the next parts; you can do most setup while it verifies.

---

<a name="part-2"></a>
## Part 2 — Verify your identity

1. In Play Console, look for a banner or **"Account" → "Identity verification"** task.
2. Enter your legal name + address exactly as on your ID.
3. Upload a photo of your **government ID** if asked.
4. Submit. Google reviews this (can take 1–3 days). You can keep setting up meanwhile.

---

<a name="part-3"></a>
## Part 3 — Create the app

1. On the Play Console home, click **"Create app"** (top-right).
2. Fill the form:
   - **App name:** `FyneStudy`
   - **Default language:** `English (India) – en-IN` (or English (US)).
   - **App or game:** **App**.
   - **Free or paid:** **Free**.
3. Tick the declarations:
   - **Developer Program Policies** ✅
   - **US export laws** ✅
4. Click **"Create app"**. You're now on the app **Dashboard**.

> You'll see a checklist: **"Set up your app"** and **"Test and release"**. We'll do
> "Set up your app" next (Part 4), then testing (Part 6).

---

<a name="part-4"></a>
## Part 4 — Fill the "Set up your app" forms (the big one)

On the **Dashboard**, click **"View tasks"** under *"Set up your app"*. Do each task.
Click **Save** at the bottom of every page. Exact answers for FyneStudy are in
[Appendix A](#appendix-a) — keep it open in another tab.

### 4.1 App access ← ⭐ MOST IMPORTANT, don't skip
Your app needs a login and has **no public sign-up**, so the reviewer can't get in
unless you give them an account.
1. Open **"App access"**.
2. Choose **"All or some functionality is restricted"**.
3. Click **"Add new instructions"**. Add **two** entries:
   - Name: `Student login` — provide the test **student** username + password.
   - Name: `Teacher login` — provide the test **teacher** username + password.
4. In the instructions box, write: *"Accounts are issued by the institute; there is no
   public sign-up. On first login the app forces a password change — please keep the
   given password (it is already changed) or use the credentials exactly as provided."*
5. **Save.**

> ❗ If you skip this, Google **will reject** the app ("we couldn't access it").

### 4.2 Ads
- **"Does your app contain ads?"** → **No**. Save.

### 4.3 Content rating
1. Open **"Content ratings"** → **"Start questionnaire"**.
2. Enter your **email**, pick category **"Reference, News, or Educational"**.
3. Answer the questions — for FyneStudy everything is **No** (no violence, no sexual
   content, no profanity, no drugs, no gambling, no user-to-user *un-moderated* sharing
   of personal info). ⚠️ Note: your app DOES have a **live chat** — answer the
   "users can interact / share content" questions **honestly = Yes** (it's moderated by
   teachers). It will still rate low.
4. Submit → you'll get a rating (likely **Everyone / PEGI 3 / Rated for 3+**). Save.

### 4.4 Target audience and content
1. Open **"Target audience and content"**.
2. **Select the age groups your students actually fall in.** For JEE/NEET/CUET coaching
   that's usually **13–15, 16–17, and 18+**. ✅ Tick those.
   - ⚠️ Do **NOT** tick **"Under 13"** unless you truly have under-13 students — it
     triggers strict "Designed for Families" rules.
3. "Is your app appealing to children?" → **No** (it's a coaching tool).
4. Save and follow any follow-up prompts.

### 4.5 Data safety ← ⭐ second most important
1. Open **"Data safety"** → **"Start"**.
2. **"Does your app collect or share any of the required user data types?"** → **Yes**.
3. Mark these as **collected** (and **NOT shared** with third parties):
   - **Name**, **Email address**, **Phone number**, **Date of birth** (under *Personal info*).
   - **App activity / in-app actions** (attendance, quiz & exam activity).
4. For each: purpose = **App functionality** and **Account management** (NOT advertising).
   Required = **Yes** (or "Optional" where true). Shared = **No**.
5. **"Is all of the user data encrypted in transit?"** → **Yes**.
6. **"Do you provide a way for users to request that their data is deleted?"** → **Yes**,
   and give your support email / the deletion request method (e.g. *"email
   support@fynestudy and the institute admin deletes the account"*).
7. Review the summary → **Save**.

> Be honest here. Lying on Data safety is the fastest way to get an app removed.

### 4.6 The remaining small tasks (answer No unless true)
- **Government apps** → No.
- **Financial features** → No.
- **Health** → No.
- **News app** → No.
- **COVID-19 contact tracing/status** → No.
- **Privacy policy** (there's a dedicated field, often under *App content* or *Store
  settings*) → paste **`https://fyne-study-app-admin.vercel.app/privacy`**. Save.

✅ When every task under "Set up your app" has a green tick, move on.

---

<a name="part-5"></a>
## Part 5 — Main store listing (the public page text + pictures)

Go to **"Grow" → "Store presence" → "Main store listing"** (left menu).

### 5.1 Text (copy-paste from [Appendix A](#appendix-a))
- **App name:** `FyneStudy`
- **Short description** (max 80 chars) — paste from Appendix A.
- **Full description** (max 4000 chars) — paste from Appendix A.

### 5.2 Graphics
- **App icon:** upload a **512×512 PNG** of the FyneStudy shield.
- **Feature graphic:** **1024×500 PNG** (a banner; can be the shield + name on a
  brand-blue background).
- **Phone screenshots:** upload **at least 2** (Google allows up to 8). PNG/JPG,
  between 320px and 3840px per side, 16:9 or 9:16. **Easiest way:** open the app on
  your phone, take screenshots of the nicest screens (dashboard, a live class, a quiz,
  the leaderboard, attendance QR), and upload those.
  - 👉 Need the **icon (512) / feature graphic (1024×500)** generated from your shield?
    Tell me and I'll produce them with the brand script.

### 5.3 Store settings
- **App category:** **Education**.
- **Tags:** add "Education", "Education" sub-tags as offered.
- **Contact details:** your **email** (required), optional phone + website
  (`https://fynestudy.live`).
- **Save.**

---

<a name="part-6"></a>
## Part 6 — Create the Closed testing track + add 12 testers

New personal accounts must run a **closed test (12+ testers, 14 days)** before
production. Set it up now.

1. Left menu → **"Test and release" → "Testing" → "Closed testing"**.
2. You'll see a default track (often called **"Alpha"**) or click **"Create track"**.
   Name it e.g. **"Closed test"**.
3. Open the track → **"Testers"** tab → **"Create email list"**:
   - Name the list (e.g. `FyneStudy testers`).
   - **Add 12+ Gmail addresses** (one per line) of people who'll actually open the app.
   - Save and **tick the list** to attach it to this track.
4. Copy the **"Join on the web"** opt-in link (under "How testers join"). You'll send
   this to your testers in Part 8.

> ✅ Tip: testers must (a) click the opt-in link, (b) install from the link, and
> (c) actually **open and use the app** so Google counts the test as "active".

---

<a name="part-7"></a>
## Part 7 — Upload your `.aab` and release to testers

1. Still in **Closed testing → your track**, click **"Create new release"** (top-right).
2. **App signing:** Google will show **"Play App Signing"** — click **"Continue"** /
   accept Google generating/managing the signing key. (EAS already made your *upload*
   key inside the `.aab`; you don't need to do anything extra.) ✅
3. Under **"App bundles"**, click **"Upload"** and select your **`.aab`** file.
   Wait for it to process (a minute).
4. **Release name** auto-fills (e.g. `1 (1.0.0)`) — leave it.
5. **Release notes** — type something simple between the language tags, e.g.:
   ```
   <en-US>First release of FyneStudy — live classes, attendance, quizzes, exams, and study materials.</en-US>
   ```
6. Click **"Next"** → review any warnings (warnings are usually OK; **errors** must be
   fixed). Then **"Save"** → **"Review release"** → **"Start rollout to Closed testing"**
   → confirm.
7. ✅ Your app is now live **for your testers**. It may take a few hours to appear.

---

<a name="part-8"></a>
## Part 8 — Run the 14-day test → apply for production

1. Send each tester the **opt-in link** from Part 6. Ask them to:
   - Click it → click **"Become a tester"** → install FyneStudy from the link →
     **open it and log in** (give them a real student/teacher account) and click around.
2. Keep at least **12 testers opted-in and using it for 14 consecutive days**. Don't
   remove testers during this time.
3. After 14 days, go to **"Test and release" → "Production"** (or a banner appears) →
   **"Apply for production access"**. Fill the short form:
   - How you tested, who your testers are, what the app does.
4. Submit and wait for Google's approval.

> 📌 You can prepare the Production release (Part 9) now, but you can only **roll it
> out** after Google grants production access.

---

<a name="part-9"></a>
## Part 9 — Go live to the public

1. Left menu → **"Test and release" → "Production"** → **"Create new release"**.
2. Under **"App bundles"**, click **"Add from library"** and pick the **same `.aab`**
   you already uploaded (no need to rebuild).
3. Add release notes (same style as Part 7) → **"Next"** → **"Save"** →
   **"Review release"** → **"Start rollout to Production"** → confirm.
4. **Countries/regions:** make sure your target countries (e.g. India) are selected
   under the track's **"Countries / regions"**.
5. Google reviews the production release (a few days). When approved, **FyneStudy is
   live on the Play Store** 🎉. Search your package `com.fynestudy.app` or your store URL.

---

<a name="appendix-a"></a>
## Appendix A — Copy-paste answers for FyneStudy

**Short description (≤80 chars):**
```
Live classes, attendance, quizzes & graded exams for your coaching institute.
```

**Full description (paste into "Full description"):**
```
FyneStudy is the all-in-one app for our coaching institute — built for JEE, NEET and
CUET preparation. Students and teachers log in with accounts issued by the institute
(there is no public sign-up).

What you can do:
• Live classes — join live lessons streamed by your teacher, with a real-time chat and
  raise-hand. Watch in portrait or landscape with the chat right beside the video.
• Attendance — mark attendance in seconds with a secure rotating QR code; teachers can
  also take a roster manually.
• Practice quizzes — sharpen concepts with instant, auto-graded practice.
• Graded exams — sit timed, exam-like tests; results are released by your teacher.
• Study materials — watch recorded lessons and read PDFs from your course library.
• Progress & motivation — track mastery, streaks, and your batch leaderboard.

FyneStudy keeps your data private: it is only used to run your classes and is never
sold or shared for advertising. Accounts are managed by your institute's admin.

This app is for enrolled students and teachers of the institute.
```

**Category:** Education · **Free**

**Privacy policy URL:** `https://fyne-study-app-admin.vercel.app/privacy`
*(confirm it loads first)*

**App access (test credentials):** use the **student** + **teacher** logins from
`CREDENTIALS.local.md`. Note in the instructions: *"No public sign-up; accounts are
issued by the institute."*

**Data safety quick map:**
| Data | Collected? | Shared? | Purpose |
|---|---|---|---|
| Name | Yes | No | App functionality, Account management |
| Email | Yes | No | App functionality, Account management |
| Phone number | Yes | No | App functionality, Account management |
| Date of birth | Yes | No | App functionality |
| App activity (attendance, quiz/exam) | Yes | No | App functionality |
| Encrypted in transit? | **Yes** | | |
| Users can request deletion? | **Yes** (via institute admin / support email) | | |

**Content rating:** category *Educational*; answer No to violence/sex/drugs/gambling;
**Yes** to "users can interact / chat" (it's teacher-moderated). Expected: Everyone/3+.

**Target audience:** 13–15, 16–17, 18+ (NOT under-13). "Appealing to children" = No.

---

<a name="appendix-b"></a>
## Appendix B — Common reasons first apps get rejected (avoid these)

1. **No login given to the reviewer** → always fill **App access** with working test
   accounts (Part 4.1). #1 cause for login-gated apps like yours.
2. **Data safety doesn't match reality** → declare name/email/phone/DOB honestly.
3. **Privacy policy link broken or missing** → confirm the URL loads before submitting.
4. **Screenshots that aren't really the app** (placeholders, marketing-only) → use real
   in-app screenshots.
5. **Wrong target age / "appealing to children"** mismatches → answer truthfully.
6. **Didn't complete the 12-tester / 14-day closed test** → required for new personal
   accounts before production.

---

## ✅ Your immediate next 5 actions
1. Confirm the privacy URL loads.
2. Create + pay for the developer account (Part 1).
3. Create the app + do **App access** and **Data safety** first (Parts 3–4).
4. Make/collect icon, feature graphic, screenshots; fill the store listing (Part 5).
5. Create the closed-test track, add 12 testers, **upload the `.aab`** (Parts 6–7).

> Stuck on any screen? Tell me which step number + what you see, and I'll walk you
> through that exact screen. Want me to generate the **512×512 icon** and
> **1024×500 feature graphic** from your shield right now? Just say so.
