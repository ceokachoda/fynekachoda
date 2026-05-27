# FyneStudy — Google Play Store Publishing Guide

> Click-by-click guide to ship **FyneStudy** to Android via Google Play. Written for a solo developer new to coding. Follow it top to bottom.
>
> **Verify-in-console note:** Google changes the Play Console UI often. Where a button or page name might have moved, this guide says **(verify in console)**. The *policies* below were confirmed for 2026 (see citations at the end); the *exact wording on screen* may differ slightly.

## App facts (use these exactly)

| Field | Value |
|---|---|
| Display name | FyneStudy |
| Android package (`applicationId`) | `com.fynestudy.app` |
| iOS bundle id | `com.fynestudy.app` |
| Version name | `1.0.0` |
| Built with | Expo SDK 54 + EAS Build (React Native 0.81) |
| Expo account owner | `kaustabborah` |
| Expo slug | `fynestudy` |
| EAS projectId | `d5d970db-963d-4ac5-bdb7-020cb0d6f542` |
| Target API level (auto) | **Android 16 / API 36** (RN 0.81 default — already above Play's 2026 minimum) |
| Payments / ads / tracking SDKs | **None** (no payments, no ads, Sentry/PostHog off) |
| Backend | Supabase (data processor, region `ap-south-1`) |
| Permissions declared | `CAMERA` (QR scan) only — `RECORD_AUDIO` **already removed** (see §3.0) |

---

## 0. Realistic timeline (read first)

**The single biggest variable is your account type.** A **personal/individual** account created today is forced through a mandatory closed test (**12 testers, opted-in continuously for 14 days**) *before* Google will even unlock the Production track. An **organization** account skips that, but must prove the business exists with a **D-U-N-S number**.

So decide your account type first — it changes your launch date by ~2 weeks.

| Step | Personal account | Organization account |
|---|---|---|
| Pay $25 + create account | Day 0 | Day 0 |
| Identity / business verification | Hours to ~2 business days (ID upload) | Often longer; D-U-N-S lookup + review (allow several days, can be 1–2 weeks if you don't yet have a D-U-N-S) |
| First **Internal testing** install on your own phone | **Same day** (after the build finishes) | **Same day** |
| **Closed test** with 12 testers for 14 continuous days | **Required** before Production unlocks | **Not required** |
| Apply for **Production access** | Only after the 14-day test; Google review usually ≤7 days | Available without the closed-test gate |
| **Realistic time to Production** | **~2.5 to 3 weeks** (14-day test + reviews) | **A few days to ~2 weeks**, mostly business verification |

### Personal vs Organization — which should *you* pick?

| | Personal / Individual | Organization |
|---|---|---|
| One-time fee | $25 | $25 |
| Needs a registered business + **D-U-N-S number** | No | **Yes** (free to request from Dun & Bradstreet, but takes time) |
| Subject to the **12-tester / 14-day** closed-test rule | **Yes** (accounts created after 13 Nov 2023) | **No (exempt)** |
| Developer name shown on store | Your verified personal name | The organization name |
| Best for | A solo dev who wants to ship fastest *and already accepts the 14-day wait*, or has no business entity | The coaching institute, if it has/can get a D-U-N-S and wants to skip the 14-day gate and publish under the institute's name |

**Recommendation for FyneStudy:** this is an institute's app used by minors and seen by paying parents — the **Organization** account (registered to the coaching institute) is the better long-term home: it publishes under the institute's name and is **exempt from the 14-day closed-test gate**. *But* it needs a D-U-N-S number, which can take days to obtain if the institute doesn't have one. If you are time-pressured and the institute has no D-U-N-S yet, start a **Personal** account today and run the 14-day closed test in parallel — you lose nothing by starting the clock now. You cannot convert Personal ⇄ Organization later, so choose deliberately.

> **Honest summary:** account + build + **Internal testing** install on your phone is achievable **today**. A real **Production** launch is **days (org) to ~2+ weeks (personal)**. Tell the client this up front.

---

## 1. Prerequisites & costs

- [ ] A **Google account** for the developer account (use a stable one you control long-term; for Organization, ideally an institute account).
- [ ] **$25 USD** one-time Google Play registration fee. A real **credit/debit card** — Google does **not** accept most prepaid/virtual cards.
- [ ] A **government photo ID** for identity verification (personal), or the **business details + D-U-N-S number** (organization).
- [ ] **Node.js ≥ 20.19.4** installed (Expo SDK 54 requirement) and this repo cloned. Check: `node -v`.
- [ ] An **Expo account** (owner `kaustabborah`) — you'll log in from the terminal.
- [ ] A **public privacy-policy URL** (we draft the policy in `docs/legal/privacy-policy.md`; host it per §8).
- [ ] At least one **Android phone** to test on (and ideally a Redmi 8A-class low-end device per the project's performance rules).
- [ ] **12 people** you can recruit as closed testers if you use a Personal account (§10).

**Total cash cost to launch on Android: $25, one time.** (iOS later is a separate $99/yr — see §14.) EAS Build has a free tier with a build queue; very heavy use may need a paid Expo plan, but a handful of builds is fine on free.

---

## 2. Create your Google Play Console account

1. Go to **https://play.google.com/console** and sign in with your chosen Google account.
2. Accept the **Developer Distribution Agreement**.
3. Choose account type: **An organization** or **Yourself** (personal/individual). *(This choice is permanent — re-read §0.)*
4. Pay the **$25** registration fee with a card.

### 2a. Personal / individual path

5. Enter your **public developer name** (shown on the store), **contact email**, **country**.
6. Complete **identity verification**: upload a valid government photo ID when prompted. Verification typically takes from a few hours up to ~2 business days; Google emails the account owner when done.
7. Until verified, some features stay locked, but you can still create the app and set up **Internal testing**.

### 2b. Organization path

5. Provide the **organization's legal name and address**, and a **D-U-N-S number** (the 9-digit Dun & Bradstreet business identifier). If the institute doesn't have one, request it free from D&B first — **this can take several days**, so start early.
6. Google verifies the business against the D-U-N-S record; you may also verify a contact identity and a domain/email. Allow extra days for this.
7. Organization accounts are **exempt** from the 12-tester / 14-day closed-test requirement (§10), so once verified you can move toward Production without that wait.

> If the console shows additional "verify your identity / address / phone / payment" tasks on the home dashboard, complete them — unfinished verification is a common reason Production stays locked. **(verify in console)**

---

## 3. Build the Android app with EAS

You do **not** build Android binaries on your laptop. EAS Build compiles them on Expo's servers and hands you a download link. You run two builds: a quick **preview APK** to sanity-check on a real phone, then the **production AAB** that you upload to Play.

### 3.0 RECORD_AUDIO permission — already removed for you ✅

`RECORD_AUDIO` has **already been removed** from the app, so there's nothing to do here — this note just records what changed and why.

- **CAMERA is kept** — students scan attendance QR codes (the `expo-camera` plugin carries the usage string).
- **RECORD_AUDIO was removed.** Teachers stream live classes from a **laptop via OBS**, not from the phone, and a codebase search found **no audio-recording code** (`expo-av` / `expo-audio` / any `Audio` API) anywhere in the mobile app. Unjustified mic access is a frequent Play-review friction point and looks bad to privacy-conscious parents.

Two changes were made in `apps/mobile/app.json`: `RECORD_AUDIO` was dropped from `expo.android.permissions`, **and** the `expo-camera` plugin now sets `"recordAudioAndroid": false` — important, because the plugin would otherwise silently re-add the mic permission on its own. The next EAS build picks this up automatically.

> If you ever add on-device recording later, set `recordAudioAndroid` back to `true` (or re-add the permission) and be ready to justify microphone use in review + the Data safety form.

### 3.1 Log in to EAS from the terminal

Open a terminal **in the mobile app folder**:

```bash
cd apps/mobile
npx eas-cli login
```

Enter your Expo credentials for owner **`kaustabborah`**. Confirm you're logged in:

```bash
npx eas-cli whoami
```

> **Non-interactive / CI option:** instead of `eas-cli login`, create an **access token** at https://expo.dev → account settings → **Access Tokens**, then set it before build commands:
> - macOS/Linux: `export EXPO_TOKEN=your_token_here`
> - Windows PowerShell: `$env:EXPO_TOKEN = "your_token_here"`
> With `EXPO_TOKEN` set you can skip `login` entirely.

### 3.2 Sanity-check build — installable **APK** (`preview` profile)

This produces a `.apk` you can sideload onto your phone to confirm the app launches and login works **before** you spend time on the store build.

```bash
npx eas-cli build --profile preview --platform android
```

- Builds run on Expo's servers; expect **~15–40 minutes** depending on queue.
- The terminal prints a **build URL**. You can also watch/download it at **https://expo.dev → your project → Builds**.
- The `preview` profile in `apps/mobile/eas.json` is set to `"buildType": "apk"`, so the artifact is a directly installable **APK**.
- Download the APK to your phone and tap to install (enable "install unknown apps" for your browser/Files app if Android prompts). Open FyneStudy, log in with a test account, and confirm core screens load.

> The very first Android build will ask **"Generate a new Android Keystore?"** — answer **Yes**. EAS creates and securely stores your signing keys for you. (More on signing in §3.4.)

### 3.3 Release build — Play **AAB** (`production` profile)

Google Play requires an **Android App Bundle (`.aab`)**, not an APK, for release. The `production` profile produces an AAB (no `buildType: apk` override):

```bash
npx eas-cli build --profile production --platform android
```

- Same servers, same ~15–40 min, same Builds dashboard.
- The artifact is an **`.aab`**. Download it — you'll upload this file to Play in §9.
- The `production` profile has `"autoIncrement": true` and the project uses `"appVersionSource": "remote"`, so **EAS auto-increments the Android `versionCode` for every release** and tracks it remotely. You don't manage `versionCode` by hand. (See §12.)

> **Optional one-step submit:** EAS can upload the AAB to Play for you (`eas submit`), but it needs a Google service-account JSON key set up first. For your **first** release it's simpler and more transparent to **download the .aab and upload it manually** in §9. Use `eas submit` later once you're comfortable.

### 3.4 Play App Signing, in plain language

Android apps are cryptographically signed so Google can verify updates come from you. There are two keys:

- **App signing key** — the key that ultimately signs what users download. **Let Google manage this** (Play App Signing). Google keeps it safe so you can never lose it; losing it would mean you could never update your app again.
- **Upload key** — the key **EAS** holds and uses to sign the bundle you upload. Google checks the upload key, then re-signs with the app signing key before distributing.

**What you do:** during the first upload, Play offers **Play App Signing** — accept/enroll (it's the default for new apps). Your EAS-managed keystore is the **upload** key. If an upload key is ever lost, Google can help you reset it; the app signing key, held by Google, never changes. **Net effect: you can't brick your app by losing a key.** **(verify in console)**

---

## 4. Create the app in Play Console & fill the store listing

In Play Console home, click **Create app**, then fill:

1. **App name:** `FyneStudy` (this is the public name; ≤30 chars).
2. **Default language:** `English (India) – en-IN` (or `English (United States)` if you prefer; the app's dates are pinned to IST/en-IN).
3. **App or game:** **App**.
4. **Free or paid:** **Free**. *(Note: a free app generally cannot later be switched to paid.)*
5. Tick the **declarations** (Developer Program Policies, US export laws).
6. Click **Create app**.

Then complete the **store listing** (left nav: **Grow → Store presence → Main store listing**, names **(verify in console)**):

### 4.1 App name & descriptions

- **App name:** `FyneStudy`
- **Short description (≤80 chars)** — draft:
  > `Coaching app for JEE, NEET & CUET — live classes, quizzes, attendance & results.`
  (74 chars — count after any edit.)
- **Full description (≤4000 chars)** — ready-to-paste draft:

```
FyneStudy is the official learning app for students and teachers of our coaching institute, built for JEE, NEET, and CUET preparation.

Note: FyneStudy is a private app for enrolled students and teachers only. There is no public sign-up — your institute creates your account and gives you your login. If you are not enrolled with us, you will not be able to sign in.

FOR STUDENTS
• Join live online classes streamed by your teachers, and watch recordings later.
• Mark your attendance in seconds by scanning the QR code your teacher shows in class.
• Practise with topic-wise quizzes and review detailed solutions.
• Take timed, graded examinations and see your results when your teacher releases them.
• Track your topic mastery, study streaks, and progress over time.
• Stay motivated with badges and a friendly leaderboard within your own batch.
• Read and view study material — notes and PDFs — organised by subject, chapter, and topic.

FOR TEACHERS
• See your batches, rosters, and each student's progress at a glance.
• Schedule and run live classes.
• Build and assign practice quizzes and graded exams.
• Mark and correct attendance, and review batch performance.

PRIVACY & SAFETY
• No advertising. No third-party ad tracking. We never sell your data.
• Your data is stored securely with encryption in transit.
• Because our students include minors, accounts for minors are created only with a parent's or guardian's consent.
• The camera is used only to scan attendance QR codes; images are processed on your device and are not stored.

Questions about your account or your data? Contact your institute's office.
```

> Edit the institute-specific wording before publishing, but keep the **"no public sign-up / institute issues accounts"** sentence — it pre-empts a reviewer (and a confused parent) trying to register and failing.

### 4.2 Graphics (exact sizes)

Prepare these as **PNG** (or JPG where noted). Play rejects wrong dimensions.

| Asset | Size / format | Notes |
|---|---|---|
| **App icon** | **512 × 512 px**, 32-bit PNG | Your FyneStudy logo on a solid background. (Separate from the in-app adaptive icon in `assets/images/`.) |
| **Feature graphic** | **1024 × 500 px**, PNG/JPG | Banner shown at the top of the listing. No important text near edges. |
| **Phone screenshots** | **min 2, up to 8**; PNG/JPG; 16:9 or 9:16; each side **320–3840 px** | Show real screens: login, student dashboard, a quiz, attendance QR, results. |
| (Optional) 7-inch & 10-inch tablet screenshots | same rules, larger | App supports tablets (`supportsTablet`), but tablet shots are optional. |

### 4.3 How to capture screenshots

**From a real Android phone (recommended — true rendering):**
1. Install the app (the §3.2 preview APK is perfect).
2. Open the screen you want; press **Power + Volume-Down** together.
3. Find the PNGs in the phone's gallery → transfer to your computer (USB or share to yourself).

**From an Android emulator (if you have Android Studio):**
1. Launch a Pixel emulator and install the APK (drag the `.apk` onto the emulator window, or `adb install app.apk`).
2. Click the **camera icon** in the emulator's side toolbar to save a screenshot to your machine.

Crop/clean if needed, but keep them within the size rules above. Do **not** add fake UI or claims.

---

## 5. Content rating questionnaire

Left nav: **Monetize/Policy → App content → Content ratings** **(verify in console)**. Click **Start questionnaire**.

1. **Email address:** your support email.
2. **Category:** choose **Reference, News, or Educational** (an education app; **not** a game).
3. Answer the content questions. For FyneStudy, the honest answers are essentially **No** across the sensitive categories:
   - Violence, blood, sexual content, nudity: **No**.
   - Profanity / crude humor: **No**.
   - Controlled substances (drugs/alcohol/tobacco) references: **No**.
   - **Gambling** (real or simulated): **No**. *(A leaderboard/badges are not gambling — there is no wager or prize of value.)*
   - **User-generated content / user-to-user communication shared publicly:** the in-class **chat** is communication between a class's members. Answer truthfully — if asked whether users can interact/communicate, say **Yes** and that it's limited to a class/batch and moderated by teachers (teachers can delete messages and ban users). Do not overstate it as public social networking.
   - In-app purchases: **No**. Ads: **No**.
4. **Submit.** Ratings (e.g. IARC) are issued automatically. You can re-take the questionnaire if anything changes.

---

## 6. Target audience & content + Families policy

This section matters because **FyneStudy's audience includes minors**. Left nav: **App content → Target audience and content** **(verify in console)**.

> Prerequisite: Play requires you to have already set **Ads = No** (§7/App content), provided **App access** instructions (§13), and added a **privacy policy URL** (§8) before/while completing this section.

1. **Target age groups:** select the age bands that match your students. JEE/NEET/CUET students span roughly **13–17 and 18+**, and some students may be **under 13**. Select every band that genuinely applies — if any band under 18 is selected, your app must meet **Families policy** expectations. Answer truthfully; do not exclude minors to dodge the policy.
2. Because minors are included, you'll be asked about **content appropriate for children**, **ads to children** (answer **No ads**), and your **handling of children's data**.
3. Confirm your **privacy policy** (it must specifically address children's data and parental consent — the drafted `docs/legal/privacy-policy.md §8` does).
4. **Parental consent:** the app already records parental consent for minors when the institute creates the account. Be ready to describe this if asked; it is your basis for collecting personal data from minors.
5. If a **Families** section / "Designed for Families" opt-in appears, you are **not** required to join the Designed-for-Families *program*, but you **must** comply with **Families policy** (no ads to children, no selling kids' data, appropriate content, accurate data disclosures). FyneStudy already meets these. **(verify in console)**

> Heads-up (not a Play blocker, but coming): 2026 brings new **age-verification / age-signal** rules in some regions (e.g. certain US states). Since the institute controls onboarding and records ages and parental consent off-app, you're well positioned, but watch for any new console prompt asking you to integrate an age-signal API.

---

## 7. Data safety form

Left nav: **App content → Data safety** **(verify in console)**. This is a public disclosure of what you collect and why — it **must match** the app's real behaviour and your privacy policy, or you risk rejection/removal.

**Top-level answers for FyneStudy:**
- Does your app **collect or share** user data? **Yes** (it collects; see table).
- Is data **encrypted in transit?** **Yes** (HTTPS/TLS to Supabase).
- Do you provide a way to **request data deletion?** **Yes** — users/parents request deletion by contacting the institute (state this; the in-app accounts are admin-managed). Provide your support email.
- Is all collected data **processed ephemerally?** **No** (most is stored).
- Has your data collection been **independently reviewed?** Optional/leave per truth.

**Per-data-type table — fill it like this:**

| Play data type | Collected? | Shared? | Purpose | Optional/Required | Encrypted in transit | User can request delete |
|---|---|---|---|---|---|---|
| Name | Yes | No | App functionality, Account management | Required | Yes | Yes |
| Email address | Yes | No | App functionality, Account management | Required | Yes | Yes |
| Phone number | Yes | No | App functionality, Account management | Required | Yes | Yes |
| **Other personal info — Date of birth** | Yes | No | App functionality | Required | Yes | Yes |
| **Other personal info — Gender** | Yes | No | App functionality | Required | Yes | Yes |
| Address (postal) | Yes | No | App functionality, Account management | Required | Yes | Yes |
| **Other info — School / board / class** | Yes | No | App functionality | Required | Yes | Yes |
| **Other info — Parent/guardian phone & consent record** | Yes | No | App functionality (contacting family; consent for minors) | Required | Yes | Yes |
| Teacher: name / email / phone / bio / subjects | Yes | No | App functionality, Account management | Required | Yes | Yes |
| **App activity** — attendance, quiz/exam scores, mastery, streaks, leaderboard | Yes | No | App functionality | Required | Yes | Yes |
| **Photos / Camera images** | **No (not collected)** | — | Camera used **only** to scan QR codes; image processed **on-device, not stored or transmitted** | — | — | — |
| Location | No | — | Not collected | — | — | — |
| Audio/Voice | No | — | Not recorded (remove `RECORD_AUDIO`, §3.0) | — | — | — |
| Financial info / Payments | No | — | No payments | — | — | — |
| **Advertising / tracking IDs** | No | — | No ads, no analytics/ads SDK | — | — | — |

**Key honesty points:**
- "**Shared**" in Play's sense means transfer to a *separate company* (excludes service providers/processors acting for you). Supabase and Expo are **processors**, and YouTube playback is a feature — so for advertising/selling purposes, **nothing is shared**. Answer **Not shared** for every type.
- Camera: declare it as **a permission used for app functionality** but **do not** mark "Photos" as *collected*, because images aren't stored or sent. If the form has a free-text or permissions note, write: *"Camera is used solely to scan attendance QR codes; images are processed on-device and never stored or transmitted."*
- If you keep `RECORD_AUDIO`, you'd have to disclose microphone/audio handling — another reason to remove it (§3.0).

Save and **submit** the Data safety form.

---

## 8. Privacy policy (public URL required)

Google **requires a publicly accessible privacy-policy URL** for any app that handles personal/sensitive data and for any app whose audience includes children — that's FyneStudy on both counts. Add it under **App content → Privacy policy** **(verify in console)** and reference it in the store listing.

A draft policy specific to this app is in **`docs/legal/privacy-policy.md`** — fill its `{{PLACEHOLDERS}}` (institute name, contact email, effective date), then host it. Three free options:

| Option | How | Effort |
|---|---|---|
| **A public route on your Vercel admin site** (recommended) | You already deploy the admin panel on Vercel. Add a public page, e.g. `apps/admin/app/privacy/page.tsx`, that renders the policy, then use `https://<your-admin-domain>/privacy`. Same domain you already trust, no new account. | Low |
| **GitHub Pages** | Put the HTML/markdown in a repo, enable Pages in repo settings → get a `github.io` URL. | Low–Medium |
| **Google Sites** | sites.google.com → new site → paste the text → publish → copy the public URL. No code. | Lowest (non-technical) |

**Recommended:** the **Vercel public route**, because it's the same infrastructure you maintain, the URL stays stable, and you can update the text by editing the repo. If you want zero code today, use **Google Sites** and switch to the Vercel route later (Play lets you update the URL).

> The URL must be **directly reachable, not behind a login**, and must actually describe *this* app's data. A dead or login-gated link is a top rejection cause (§13).

---

## 8.5 Create the reviewer test accounts (Google MUST be able to log in)

Your app has **no public sign-up**, so a Google reviewer cannot create an account — you must give them a working **student** login and a working **teacher** login, or the app gets rejected. Your production database is already clean with one course ("General Program") and one batch ("Batch A") ready for these accounts.

1. Open the **admin panel** (your Vercel URL, or run `pnpm dev:admin` and open `http://localhost:3000`). Log in as the owner (`owner@fynestudy.example.com`).
2. **Create the reviewer student:** Students → **+ New student**. Full name `Review Student`; email `review.student@fynestudy.app` (a domain that never needs to receive mail is fine); Batch = **Batch A**. Submit, then **copy the temporary password shown**.
3. **Create the reviewer teacher:** Teachers → **+ New teacher**. Full name `Review Teacher`; email `review.teacher@fynestudy.app`. Submit and **copy the temporary password**. (Optional: open Batch A and assign this teacher so the teacher view has content.)
4. **Turn the temp passwords into stable passwords** so they don't force a change on the reviewer. Easiest way — do it once on your phone (preview APK from §3.2, or Expo Go):
   - Open the app → log in as `review.student@fynestudy.app` with its temp password → the app forces a password change → set a password you'll hand to Google, e.g. `ReviewStudent#2026`.
   - Repeat for `review.teacher@fynestudy.app`, e.g. `ReviewTeacher#2026`.
   - *(Alternative: your developer can set `must_change_password = false` on these two rows so the temp passwords work directly — but the step above needs no database access.)*
5. In Play Console → **App content → App access**, choose **"All or some functionality is restricted"** and paste the credentials using the template in §13. Keep both accounts **active** until the app is approved.

---

## 9. Upload the AAB to Internal testing → install → verify

**Internal testing** is the fastest track: it has **no review wait** and lets up to 100 testers install almost immediately — perfect for confirming the release build runs.

1. Left nav: **Test and release → Testing → Internal testing** → **Create new release**.
2. **App signing:** if prompted, **enroll in Play App Signing** (§3.4). Accept the default (Google-managed app signing key).
3. **Upload** the **`.aab`** you downloaded in §3.3 (drag it into the App bundles box).
4. **Release name** auto-fills from the version (e.g. `1.0.0 (1)`). Add brief **release notes** (e.g. "Initial internal test build.").
5. Click **Next → Save → Review release → Start rollout to Internal testing**. Confirm.
6. Go to the **Testers** tab of Internal testing → create/select an **email list** → add your own Google account (and a couple of helpers). Save.
7. Click **Copy link** to get the **opt-in URL**. On your phone (signed into a tester Google account), open the link → **Become a tester** → tap the Play Store link → **Install**.
8. **Verify on-device:**
   - App launches without crashing (cold start should feel ≤3 s on a mid device).
   - **Login works** with a real institute-issued account (there is no self-signup).
   - QR attendance scanner opens the camera and asks permission.
   - A quiz/exam screen loads; the library lists content.
9. Fix anything broken: edit code → run a **new** `production` build (§3.3, versionCode auto-increments) → upload as a **new release** → re-test.

> If the Play Store says the app isn't available to your account, double-check the tester email matches the account on the phone, and that you actually clicked **Start rollout** (not just Save).

---

## 10. Closed testing (the 12-tester / 14-day rule — Personal accounts)

**Skip this section if you have an Organization account — you're exempt.** For **Personal** accounts created after 13 Nov 2023, Google requires a closed test of **≥12 testers opted-in for ≥14 continuous days** before the **Production** track unlocks.

### 10.1 Set it up

1. Left nav: **Test and release → Testing → Closed testing** → use the default **Closed testing** track (or **Create track**).
2. **Create new release**, upload your **`.aab`** (you can reuse the same bundle/version from Internal testing, or a newer one). Add release notes. **Start rollout to Closed testing.**
3. **Testers tab:** create an **email list** and add **at least 12 distinct Google-account email addresses**. (Add a couple of spares — if someone opts out, the continuous count can reset.)
4. **Copy the opt-in link** and send it to all testers.

### 10.2 Recruit & keep 12 testers for 14 continuous days

- Each tester must **open the opt-in link, tap "Become a tester," and install the app** from Play.
- The **14-day clock effectively needs 12 testers continuously enrolled** — if testers drop below 12, you risk resetting progress. Recruit a few extra and ask them **not to leave the test** until you say so.
- Good sources of 12: the institute's own staff and a pilot batch of students/parents (with consent), friends, family. They just need a Google account and a phone.
- Have testers actually **use** the app a little (open it on a few different days); Google looks for genuine testing, not just installs.

### 10.3 Apply for Production access

- After **14 continuous days** with ≥12 testers, the Play Console **Dashboard** shows that you can **apply for production access** (a button/card appears). Click it and answer the short questionnaire about your testing.
- Google reviews the request — **usually ≤7 days**, occasionally longer. They email the **account owner** with the result.
- Once approved, the **Production** track unlocks for §11.

> The closed test and Internal testing can run **in parallel**. Start the closed test the same day you create the app so the 14-day clock begins immediately — that's the fastest path to Production for a personal account.

---

## 11. Production release

Once Production is available (org accounts: after verification; personal accounts: after §10):

1. Left nav: **Test and release → Production → Create new release**.
2. Upload the **`.aab`** (or **promote** the bundle you already tested from Internal/Closed — Play lets you reuse the same artifact so you ship exactly what you tested).
3. Add **release notes** (what's new — for `1.0.0`: "Initial release.").
4. Confirm **store listing, content rating, data safety, target audience, privacy policy, and App access** all show **complete/green** on the dashboard — Production won't roll out with any of these unfinished.
5. Choose a **staged rollout %** (e.g. start at **20%**, then raise to 100% over a few days once you see no crash spike) or **100%** for a small institute audience. Staged is safer.
6. **Review release → Start rollout to Production.**
7. **Review wait:** first-time production review for a new app commonly takes **a few days to ~7 days** (sometimes longer, especially for an app involving minors). Google emails the account owner on approval. The app then appears on the Play Store at `https://play.google.com/store/apps/details?id=com.fynestudy.app`.

> Keep the country/region targeting to where the institute operates (e.g. **India**) unless you intend wider distribution.

---

## 12. Post-launch updates

You have **two** kinds of updates — pick the right one:

| Change type | Tool | Store review? | Notes |
|---|---|---|---|
| **JS-only** (UI tweak, bug fix, copy change — no new native code/permissions) | **EAS Update (OTA)** | No | `npx eas-cli update --branch production --message "fix X"`. Phones on the matching `production` channel pull the new JS bundle on next launch. Fast, but **cannot** change native code, permissions, or the SDK. |
| **Native change** (new permission, new native module, Expo SDK bump, app icon/version) | **New EAS build → new Play release** | Yes | `npx eas-cli build --profile production --platform android`, upload the new `.aab` to Production. |

- **`versionCode` auto-increments:** because `production` has `"autoIncrement": true` and the project uses `"appVersionSource": "remote"`, every new production **build** gets a fresh Android `versionCode` automatically — you never edit it by hand. Bump the human-readable **`version`** (`1.0.0` → `1.0.1`) in `app.json` when you want a new marketing version.
- **Don't ship native changes via OTA.** OTA only swaps the JS bundle; a native change pushed as OTA will crash or silently not apply. When in doubt, do a full build.
- **Keep targeting current:** you're already on **API 36** (RN 0.81 default), comfortably above Play's requirements. Google raises the **minimum target API yearly** (new apps/updates must target **API 36 from 31 Aug 2026**) — so just keep upgrading Expo SDK over time and you stay compliant.

---

## 13. Common rejection reasons & how to avoid them

| Rejection cause | How it bites FyneStudy | Fix |
|---|---|---|
| **No test credentials for a login-gated app** | **There is no self-signup** — a Google reviewer cannot create an account, so they can't see past your login and will **reject** the app. | In **App content → App access**, choose **"All or some functionality is restricted,"** and provide a **working test student account (and a teacher account)**: email + password + any steps. Keep these accounts active. **This is the most likely rejection for this app — do not skip it.** |
| **Privacy policy missing / unreachable / login-gated** | Required for personal data + minors. | Host a **public** policy (§8), paste the exact URL, verify it loads in an incognito window. |
| **Data safety mismatch** | Form says one thing, app does another (e.g. you forgot to declare DOB, or you marked camera images as collected). | Make the form match §7 exactly and match the privacy policy. Don't over- or under-declare. |
| **Unjustified / excessive permissions** | `RECORD_AUDIO` with no recording feature; or CAMERA without explanation. | `RECORD_AUDIO` is **already removed** (§3.0). CAMERA is fine — its usage string already says "scan attendance QR codes." |
| **Crashes / broken on launch** | Reviewer's device or a low-end phone crashes. | Test the **release AAB** via Internal testing (§9) on a real and ideally low-end device before promoting. |
| **Misleading store listing** | Claiming features the app lacks, or public sign-up. | Use the §4 drafts; keep the "private, institute-issued accounts" line. |
| **Minors / Families issues** | Audience includes children but target-audience/consent/data answers are inconsistent. | Complete §6 truthfully; ensure the privacy policy's children section (§8 / policy §8) is live. |
| **Target API too low** | Below Play's minimum. | Not a risk now — you're on **API 36**. |

> **App access test-credentials text (template):**
> *"FyneStudy has no public sign-up; accounts are issued by the institute. Test student — email: `reviewer-student@…`, password: `…`. Test teacher — email: `reviewer-teacher@…`, password: `…`. Open the app, tap Login, enter the credentials. The student account shows the dashboard, quizzes, attendance scanner, and library; the teacher account shows batches and class tools."*  Create these accounts in your Supabase backend and keep them enabled.

---

## 14. iOS later

iOS uses the **same EAS build flow** but a different store. You'll need an **Apple Developer Program** membership (**$99/year**, paid annually — not one-time). Build with `npx eas-cli build --profile production --platform ios`, then upload to **App Store Connect** (or use `eas submit -p ios`), distribute via **TestFlight** first for testing, then submit for **App Store review** with the same metadata, privacy "nutrition labels" (App Store's equivalent of Data safety), and the **same test credentials** (Apple reviewers also can't self-register). Apple review for a minors-facing app tends to be stricter — budget extra time. Your `bundleIdentifier` is already `com.fynestudy.app`.

---

## Appendix — verified facts (2026) & citations

These policy facts were confirmed via web search while writing this guide (May 2026). **Re-verify anything that affects spend or a client promise**, because Google updates policies and UI frequently.

- **Registration fee:** **$25 USD, one-time** (no renewal). [IconikAI](https://www.iconikai.com/blog/google-play-developer-account-fee-2026), [Afkar Software](https://afkarsoftware.com/en/blog-detail/google-play-console-account-2026-one-time-25-fee/)
- **12-tester / 14-day closed-test rule** applies to **personal** accounts **created after 13 Nov 2023**; you then **apply for production** (review usually ≤7 days). [Play Console Help — testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- **Organization accounts are exempt** from the 12-tester rule but **require a D-U-N-S number**; verification can take longer. [Org thread](https://support.google.com/googleplay/android-developer/thread/398243168/clarification-on-14-day-12-tester-requirement-for-organization-accounts?hl=en), [Testers Community](https://www.testerscommunity.com/blog/google-play-12-testers-policy), [Enrolling as an organization](https://medium.com/@bayufasmoro/a-guide-to-enrolling-in-google-play-console-as-an-organization-26afaa852aa6)
- **Identity verification (personal):** upload a valid ID; **a few hours to ~2 business days**. [Locatify guide](https://support.locatify.com/hc/en-us/articles/15558326877213-How-to-create-a-Google-Play-Console-Developer-Account)
- **Target API level:** new apps/updates currently must target **API 35 (Android 15)**; from **31 Aug 2026** the minimum rises to **API 36 (Android 16)**. **Expo SDK 54 / React Native 0.81 already targets API 36 by default — you're compliant.** [Android Developers — target SDK](https://developer.android.com/google/play/requirements/target-sdk), [Play Console Help](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [RN 0.81 release notes](https://reactnative.dev/blog/2025/08/12/react-native-0.81)
- **Data safety form** and a **public privacy-policy URL** are required; the form must match real behaviour. **Target audience & content** requires declaring age groups; audiences including **children** must meet **Families policy**, and collecting children's personal data requires disclosure and **parental consent** where applicable. [Manage target audience & content](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en), [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)
