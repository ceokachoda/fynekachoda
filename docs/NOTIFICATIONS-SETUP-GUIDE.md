# 🔔 Notifications Setup — Complete Step‑by‑Step Guide (noob‑friendly)

> **Goal:** make push notifications work for **every** student, on **every** device —
> the Android app (Play Store), the iPhone app (if you ship one), and the web app
> (`fynestudy.live`) on laptop, Android phone, and iPhone.
>
> **Read this once, top to bottom.** Do the parts that apply to you. Every step says
> exactly what to click and what you should see. Total time for the big one
> (Android): about **20–30 minutes**.

---

## 🗺️ The big picture (read this first — 2 minutes)

Your app can notify students about: a class going **live**, a class **scheduled** (+ a
reminder ~10 min before), new **study material**, new **quizzes**, new **exams**, and
**results** released. The code for all of this is already built and working. There are
just two things standing in the way:

| Where students use FyneStudy | Does push work today? | What you must do |
|---|---|---|
| **Web app** on laptop (Chrome/Edge/Firefox) | ✅ Yes (already live) | Students tap **Allow** once. (Part A) |
| **Web app** on Android phone (Chrome) | ✅ Yes (already live) | Students tap **Allow** + "Add to Home screen". (Part A) |
| **Web app** on iPhone (Safari) | ⚠️ Only if installed | Students must **Add to Home Screen** first, then Allow. (Part A) |
| **Android app** (Play Store) | ❌ Not yet | **Set up Firebase/FCM + rebuild** (Part B) — *the main job* |
| **iPhone app** (if you publish one) | ❌ Not yet | Set up Apple push key (Part C) |

> ### ⭐ One golden rule that catches everyone
> A notification only goes to the **batch the event belongs to.** If you start a class
> for **"Batch A"**, only Batch A students get pinged — **not** your "NEET ELITE BATCH"
> students. So when you teach your real students, **pick their real batch.** (This alone
> was why your web students saw nothing — every test class was on the wrong batch.)

---

# PART A — Web app notifications (works RIGHT NOW, no app release) ✅

Nothing to build here. The web app is already deployed with everything it needs. You
just need students to **turn notifications on** in their browser.

### A1. What a student does (tell them this)
1. Open **https://fynestudy.live** in their browser and **log in**.
2. A small **"Turn on notifications"** banner appears on the home screen, and there's a
   🔔 **bell** at the top (and a **Notifications** item in the profile menu). Tap
   **Enable**.
3. The browser asks "Allow notifications?" → tap **Allow**.
4. **On a phone (Android or iPhone), also do this so alerts arrive when the app is
   closed:** open the browser menu (⋮ on Android Chrome, or the Share icon on iPhone
   Safari) → **Add to Home Screen / Install app** → then open FyneStudy from the new
   home‑screen icon.

> **iPhone note:** Apple only allows web notifications for a website that has been
> **Added to Home Screen** (iOS 16.4 or newer). If an iPhone student just uses Safari
> without installing, web push will *not* work for them — they should either install it
> (above) or use the iPhone app once you ship Part C.

### A2. Test it yourself (5 minutes — proves web push works)
1. On your **laptop**, open `https://fynestudy.live` in Chrome, log in as the **review
   student** (`review.student@fynestudy.app` / `ReviewStudent#2026`). Tap the 🔔 bell →
   **Enable** → **Allow**. Leave that tab open.
2. On your **phone** (or a second browser window in Incognito), log in as the **owner
   admin** or **review teacher**, and **schedule a class ~10 minutes from now** for
   **"Batch A"** (the review student's batch), **or** start a live class for Batch A.
3. Within a minute (for "live") or ~10 min before start (for "scheduled"), the laptop
   shows a **"🔴 Live class started"** or **"Class starting soon"** notification. 🎉
   That's the whole pipeline working.

✅ **When students do A1 for the right batch, web notifications work on laptop and phone
today.** No Play Store update needed for the web app.

---

# PART B — Android app notifications (the main job: Firebase + FCM) 🤖

This is what makes the **Play Store app** able to receive notifications. Android needs
**Firebase Cloud Messaging (FCM)**. Without it, the app silently can't get a
notification token — which is exactly why your students get nothing in the app today.

> You only do this **once.** After it's set up, future builds just work.

### ✅ Before you start — you need
- A **Google account** (any Gmail works) → to use Firebase.
- Your **Expo/EAS account** that you built the app with (owner `kaustabborah`).
- The project on your computer at `…\FyneStudy\apps\mobile`.
- **EAS CLI** working. Quick check — open a terminal in `apps/mobile` and run:
  ```bash
  npx eas-cli whoami
  ```
  It should print your Expo username. If it says you're logged out, run `npx eas-cli login`.

---

### STEP B1 — Create a Firebase project
1. Go to **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Add project** (or "Create a project").
3. Project name: type **`FyneStudy`** → **Continue**.
4. "Google Analytics for your project" → you can toggle this **OFF** (not needed) →
   **Continue / Create project**.
5. Wait ~30 seconds → **Continue**. You'll land on the project dashboard.

✅ *Expected:* you see the FyneStudy project home page with a row of platform icons
(iOS, Android, Web).

---

### STEP B2 — Register your Android app
1. On the project home, click the **Android** icon (the little robot) — "Add app".
2. **Android package name** — type this **exactly** (one wrong letter = it won't work):
   ```
   com.fynestudy.app
   ```
3. **App nickname:** `FyneStudy Android` (anything is fine).
4. **Debug signing certificate SHA‑1:** **leave it blank** — not needed for push.
5. Click **Register app**.
6. Click **Download google-services.json**. Save it somewhere you can find (e.g. your
   Downloads folder).
7. On the next screens ("Add Firebase SDK", "Add initialization code") just click
   **Next → Next → Continue to console** — **you don't need to add any code.** Expo
   does all of that for you.

✅ *Expected:* you now have a file named **`google-services.json`** in Downloads.

---

### STEP B3 — Put google-services.json into your project
1. **Move** (or copy) the downloaded `google-services.json` into your mobile app folder:
   ```
   …\FyneStudy\apps\mobile\google-services.json
   ```
   The final path must be **`apps/mobile/google-services.json`** (file sitting directly
   inside `apps\mobile`).
2. ✅ **You do NOT need to edit `app.json`** — I already wired it up to read this file.
3. **Commit the file** so the build can use it. In a terminal at the repo root:
   ```bash
   git add apps/mobile/google-services.json
   git commit -m "chore(mobile): add Firebase google-services.json for FCM push"
   git push origin HEAD:web-phase-1
   ```
   > `google-services.json` is **safe to commit** (it's app config, not a password).

> ⚠️ **If you skip this file, the next build will stop with the error
> *"google-services.json not found"*.** That's on purpose — it stops you from shipping a
> build that silently has no notifications. Just add the file and build again.

---

### STEP B4 — Generate the FCM service‑account key (this one IS secret)
This key lets **Expo's servers** send notifications to Android through Firebase.

1. In the Firebase Console, click the **⚙️ gear** (top‑left, next to "Project Overview")
   → **Project settings**.
2. Open the **Service accounts** tab.
3. Click **Generate new private key** → confirm **Generate key**.
4. A **`.json`** file downloads (its name looks like `fynestudy-xxxxx-firebase-adminsdk-….json`).
   **Keep this private — never share it or commit it.** (Your `.gitignore` is already set
   up to block the usual names, but still — keep it out of the repo.)

✅ *Expected:* a second JSON file in Downloads — the **service account key**. This is a
**different** file from `google-services.json`.

---

### STEP B5 — Upload that key to EAS
1. Open a terminal **in the `apps/mobile` folder**:
   ```bash
   cd apps/mobile
   npx eas-cli credentials
   ```
2. Answer the prompts (use arrow keys + Enter):
   - **Select platform:** `Android`
   - **Which build profile?** `production`
   - Choose: **`Google Service Account`**
   - Choose: **`Manage your Google Service Account Key for Push Notifications (FCM V1)`**
   - Choose: **`Set up a Google Service Account Key for Push Notifications (FCM V1)`**
   - Choose: **`Upload a new service account key`**
   - It detects the JSON you just downloaded → press **Y** to use it (or point it to the
     file path).
3. *(If EAS shows a permission error)* go to **https://console.cloud.google.com/iam-admin/iam**,
   pick the FyneStudy project (top dropdown), find your account, click the ✏️ pencil →
   **Add another role** → search and add **"Firebase Messaging API Admin"** → **Save**.
   Then re‑run step B5.

✅ *Expected:* EAS prints something like *"Google Service Account Key assigned to
project for FCM V1"*.

---

### STEP B6 — Build the new app (AAB) and send it to the Play Store
1. Still in `apps/mobile`, build:
   ```bash
   npx eas-cli build -p android --profile production
   ```
   - This builds in the cloud and takes ~10–20 minutes. The **version code increments
     automatically** (your config handles that), so the Play Store will accept it as a
     new update.
   - When it finishes you get a link to the **`.aab`** file.
2. Send it to Google:
   ```bash
   npx eas-cli submit -p android --profile production
   ```
   *(or download the `.aab` from the build link and upload it in Play Console →
   your app → Testing/Production → Create new release → upload.)*
3. In **Play Console**, roll the release out (your closed‑testing track or production),
   same as you did for the last version.

✅ *Expected:* a new version appears in Play Console. Students get an **"Update"** in the
Play Store.

---

### STEP B7 — Each student updates + allows notifications
1. Students open the **Play Store → FyneStudy → Update**, then open the app and **log in**.
2. Android shows **"Allow FyneStudy to send notifications?"** → they tap **Allow**.
   (On Android 13+ this prompt is required; if a student taps "Don't allow", they can
   turn it back on later in **phone Settings → Apps → FyneStudy → Notifications**.)

✅ That's it — the Android app now receives notifications.

---

# PART C — iPhone app notifications (only if you publish an iOS app) 🍏

If you only ship Android right now, **skip this.** Do it when you submit to the App Store.

1. You need an **Apple Developer account** ($99/yr) and the app's iOS bundle id
   (`com.fynestudy.app`, already set).
2. In `apps/mobile`:
   ```bash
   cd apps/mobile
   npx eas-cli credentials
   ```
   - **Select platform:** `iOS` → **production**
   - Choose **`Push Notifications: Manage your Apple Push Notifications Key`** →
     **`Set up a new key`** → let EAS **create and upload** the APNs key for you (it
     handles the Apple side automatically when you're logged into your Apple account).
3. Build + submit:
   ```bash
   npx eas-cli build -p ios --profile production
   npx eas-cli submit -p ios --profile production
   ```
4. On the iPhone, after installing and logging in, tap **Allow** when iOS asks about
   notifications.

> The web app on iPhone (Part A) is a good stop‑gap until your iOS app is live.

---

# PART D — Prove notifications work for everyone (final test) 🧪

Do this after Part B is released (and Part A any time):

1. **Web (laptop):** log in as a test student on `fynestudy.live`, enable notifications.
2. **Android app:** on a phone, install the **updated** app, log in as a *different* test
   student in the **same batch**, tap **Allow**.
3. As owner/teacher, **start a live class for that batch** (or publish a quiz to it).
4. Both the laptop and the phone should get the notification within seconds. ✅

**Quick health‑check in the database** (Supabase → SQL Editor, project
`orqwyazvcthgxoadfxfv`) — run after students update/allow:
```sql
-- Android/iOS app tokens (should grow above 1 once students update + allow):
select count(*) filter (where is_active) as app_tokens from device_push_tokens;

-- Web subscriptions (grows as students open the web app + Allow):
select count(*) filter (where is_active) as web_subs from web_push_subscriptions;
```

---

# 🆘 Troubleshooting (common issues + fixes)

| Problem | Why | Fix |
|---|---|---|
| Build stops: **"google-services.json not found"** | You haven't added the file yet | Do **STEP B3** (add the file to `apps/mobile/` and commit), then build again |
| App installed but still no notifications | Student tapped "Don't allow", or it's an **old** app version | Phone **Settings → Apps → FyneStudy → Notifications → On**; make sure they **updated** from the Play Store |
| Web: student sees no "Enable" / no prompt | Already **blocked** earlier | Browser address bar → **lock icon → Notifications → Allow**, then reload. The **/notifications** page in the app explains this too |
| iPhone web: nothing happens | Not installed to home screen | Safari **Share → Add to Home Screen**, open from the icon, then Allow (needs iOS 16.4+) |
| Some students get it, others don't | They're in a **different batch**, or haven't enabled | Remember the **golden rule**: push goes to the **event's batch**. Confirm the student is in that batch and has allowed notifications |
| Notifications work in test but not for a class | Class was created on the **wrong batch** | Create the class/quiz/exam on the **students' real batch** |
| `eas credentials` permission error | Missing IAM role | Add **"Firebase Messaging API Admin"** in Google Cloud IAM (see STEP B5 note) |

---

# ✅ Final checklist

**Web (do now):**
- [ ] Tell students: open `fynestudy.live` → log in → tap 🔔 / banner → **Enable** → **Allow**.
- [ ] On phones: **Add to Home Screen** (required on iPhone).
- [ ] Always create classes/content on the **students' real batch**.

**Android app (the main fix):**
- [ ] B1 Create Firebase project
- [ ] B2 Register Android app `com.fynestudy.app` + download `google-services.json`
- [ ] B3 Put file in `apps/mobile/` + **commit it**
- [ ] B4 Generate the **service‑account key** (keep secret)
- [ ] B5 `eas credentials` → upload the key (FCM V1)
- [ ] B6 `eas build -p android --profile production` → `eas submit`
- [ ] B7 Students update + **Allow**

**iPhone app (only when you ship iOS):**
- [ ] C2 `eas credentials` → create/upload **APNs key**
- [ ] C3 build + submit

---

### Where things live (for reference)
- Mobile push code: `apps/mobile/lib/push.ts`, `apps/mobile/features/notifications/PushGate.tsx`
- Web push code: `apps/web/lib/web-push.ts`, `apps/web/app/sw.ts`, `apps/web/features/notifications/`
- Backend senders: `apps/functions/_shared/notify.ts`, `apps/functions/push-dispatch/`
- App build config: `apps/mobile/app.json` (already wired for `google-services.json`), `apps/mobile/eas.json`
- Deeper diagnosis of what was wrong: `docs/push-notifications-fix.md`

**You've got this — Part A works today; Part B is the one real job, and it's just
following B1→B7 once.** 🚀
