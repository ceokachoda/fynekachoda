# Push Notifications — Production Diagnosis & Fix (2026-06-17)

> **Symptom reported:** ~50 students (Play Store app) and the web app get **no push
> notifications** when a teacher starts a class or publishes anything.
>
> **Verdict after a full backend + code audit:** The notification *code and backend
> are correct and live* — but **two separate operational gaps** mean almost nobody
> actually receives a push. Neither is a bug in the app code.

---

## What I checked (all green ✅)

| Layer | Status | Evidence |
|---|---|---|
| 4 push edge fns deployed (`push-dispatch`, `push-register`, `push-unregister`, `push-class-reminders`) | ✅ ACTIVE | `list_edge_functions` |
| 9 event hooks call `notifyStudents()` (go-live, schedule, content, quiz, exam, results) | ✅ wired | grep + read of each fn |
| `pg_cron` "class starting soon" job runs every minute | ✅ active, returns 200 | `cron.job` + `net._http_response` |
| Vault secrets (VAPID pub/priv/subject, cron secret, fn URL, apikey) | ✅ all present | `vault.decrypted_secrets` |
| **VAPID public key in web app matches the Vault keypair** | ✅ byte-identical | `apps/web/lib/env.ts:23` == Vault `VAPID_PUBLIC_KEY` |
| Service worker has `push` + `notificationclick` handlers | ✅ correct | `apps/web/app/sw.ts` |
| **Web push actually delivered in prod today** | ✅ proven | cron sent 4 reminders to Batch A (`reminder_sent_at` set 07:25–08:04); 2 dead subs auto-deactivated via real 404/410 |

**The web pipeline works.** The mobile *code* is also correct (`expo-notifications` is a
dependency + config plugin, `PushGate` registers the token on sign-in).

---

## Root cause #1 — Native Android app cannot register OR receive push (the 50 users)

**Fact from the live DB:**
- `device_push_tokens`: **1 row total**, and it's the `review.teacher` *iPhone*.
- The real batch **"NEET ELITE BATCH" (40 active students): 0 native push tokens.**

**Why:** On Android, `Notifications.getExpoPushTokenAsync()` needs **Firebase Cloud
Messaging (FCM)** initialised in the build. The app has **no `google-services.json`
and no FCM V1 service-account key** configured. So on every student's phone the token
call throws → it's caught silently → **no token is ever stored → no push can be sent.**
Even if a token were issued, Expo could not deliver to Android without the FCM V1 key.

➡️ **This is THE reason the Play Store users get nothing. It needs a Firebase setup +
a new app build. Steps in "FIX A" below.**

## Root cause #2 — No event has ever targeted the real students' batch (the web users)

18 of the 40 NEET ELITE students **did** subscribe to web push (Android Chrome). But:

```
sessions / live classes / quizzes / exams created for batch 6806985e (NEET ELITE) = 0 / 0 / 0 / 0
```

Every class, schedule, and reminder the teacher made was on **"Batch A"** (the review/test
batch, `86816cc3`) — never on **"NEET ELITE BATCH"** (`6806985e`). A push only goes to the
**batch of the event**. So the real students' web subscriptions are healthy but **nothing
has ever fired for their batch.**

➡️ **Fix: teachers must create classes/content for "NEET ELITE BATCH", not "Batch A".**
The moment they do, the 18 web-subscribed students get notified. (Steps in "FIX B".)

---

# FIX A — Turn on Android push for the Play Store app (REQUIRES your Google account)

> ⚠️ I cannot do this part for you — it needs **your** Firebase/Google login and an EAS
> build on your account. Follow exactly; it takes ~20 min. Labels verified against
> Expo docs 2026-06-17.

### A1. Create the Firebase project + register the Android app
1. Go to **https://console.firebase.google.com** → **Add project** (or reuse one).
   Name it e.g. `FyneStudy`. You can skip Google Analytics.
2. On the project dashboard click the **Android** icon ("Add app").
3. **Android package name** — type **exactly**: `com.fynestudy.app`
   (must match `apps/mobile/app.json` → `android.package`).
4. Nickname `FyneStudy Android`. Click **Register app**.
5. Click **Download google-services.json**.

### A2. Put google-services.json into the project
1. Save the downloaded file to **exactly**: `apps/mobile/google-services.json`
2. ✅ **`app.json` is already wired** — I added `"googleServicesFile": "./google-services.json"`
   to the `android` block for you. You only need to drop the file in.
3. **Commit this file** (`git add apps/mobile/google-services.json`). It is *not* a
   secret, and the EAS cloud build needs it in git or the build fails.
   > Until you add the file, `eas build` will stop with *"google-services.json not
   > found"* — that's the intended guard so you never ship a build that silently has
   > no push. Add the file, then build.

### A3. Upload the FCM V1 service-account key to EAS
1. Firebase Console → ⚙️ **Project settings** → **Service accounts** tab →
   **Generate new private key** → **Generate key**. A `.json` downloads. **Keep it private.**
2. In a terminal, in `apps/mobile`, run:
   ```bash
   eas credentials
   ```
3. Choose: **Android** → **production** → **Google Service Account** →
   **"Manage your Google Service Account Key for Push Notifications (FCM V1)"** →
   **"Set up a Google Service Account Key for Push Notifications (FCM V1)"** →
   **"Upload a new service account key"** → press **Y** to use the detected JSON.
4. (If asked) In **Google Cloud Console → IAM**, give your account the
   **"Firebase Messaging API Admin"** role.
5. **Add the service-account JSON to `.gitignore`** — never commit it.

### A4. Rebuild and ship
```bash
# from apps/mobile
eas build -p android --profile production     # versionCode auto-increments (appVersionSource: remote)
eas submit  -p android --profile production   # or upload the .aab in Play Console
```
Students must **update the app** from the Play Store. After updating and logging in,
their device registers a token (verify with the SQL in "How to verify" below).

> **iOS (only if you ship an iOS build):** Push also needs an **APNs key**. Run
> `eas credentials` → **iOS** → **production** → **Push Notifications** and let EAS
> create/upload the APNs key. The existing iOS token already works, so APNs is likely
> set; do this only if iOS tokens stop appearing.

---

# FIX B — Make web notifications reach the real students (works TODAY, no rebuild)

The web PWA push already works. Two things make it visible to the NEET ELITE students:

1. **Run real events on the right batch.** When scheduling/going live/publishing,
   pick **"NEET ELITE BATCH"** (not "Batch A"). The 18 web-subscribed students get the
   push immediately.
2. **Get the other 22 students subscribed.** Ask students to open **https://fynestudy.live**
   in Chrome, log in, and tap **Allow** when the browser asks about notifications.
   Best on Android: browser menu → **Add to Home screen** (installs the PWA) so pushes
   arrive even when the tab is closed. (Note: iPhone Safari only supports web push for a
   PWA that's been **Added to Home Screen** on iOS 16.4+.)

**See it work yourself (proof):**
1. In Chrome, open `https://fynestudy.live`, log in as **review.student@fynestudy.app**
   (`ReviewStudent#2026`), tap **Allow** on the notification prompt. Leave the tab open
   (or install to home screen).
2. In another browser/incognito, log in as **review.teacher** (`ReviewTeacher#2026`) or
   the owner admin, and **schedule a class ~10 min out** for **Batch A**, or **start a
   live class** for Batch A.
3. The review.student window gets a **"Class starting soon" / "🔴 Live class started"**
   notification. (This exact path already fired 4× today — that's how I confirmed it.)

---

## How to verify the fix (SQL — run in Supabase SQL editor, project `orqwyazvcthgxoadfxfv`)

```sql
-- After students update the Android app + log in, native tokens should climb above 1:
select count(*) filter (where is_active) as android_ios_tokens from device_push_tokens;

-- Web subscriptions for the real batch (should grow as students open the web app):
select count(distinct w.user_id)
from web_push_subscriptions w
join students s on s.user_id = w.user_id
where s.batch_id = '6806985e-d294-4af4-a06d-fb48e0b95d51' and w.is_active;

-- Confirm a class you started for NEET ELITE actually exists (so a push could fire):
select id, status, is_live_class, scheduled_start
from sessions where batch_id = '6806985e-d294-4af4-a06d-fb48e0b95d51'
order by created_at desc limit 5;
```

## TL;DR
- **Code & backend: correct and deployed. No app bug.**
- **Android Play Store users get nothing** → set up **FCM (Firebase) + rebuild** (FIX A). *This is the big one.*
- **Web users get nothing** → because **all events were on "Batch A", never "NEET ELITE BATCH"**; use the right batch and tell students to open the web app + Allow notifications (FIX B). Web push already works.
