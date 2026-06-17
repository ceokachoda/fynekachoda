# 🔄 FyneStudy → Play Store UPDATE (v1.1) — push a new build to your Closed testers

> This is the **update** flow (you already did the first upload). It assumes the app
> already exists in Play Console and you already have a **Closed testing** track with
> testers. You do **NOT** re-create the app, re-add testers, or redo the questionnaires.
> You just upload a newer `.aab` and roll it out. Read top to bottom, click by click.

**This update:** version name **`1.1.0`**, versionCode **`7`** (Google requires every
new upload to have a *higher* versionCode than the last — EAS bumped it automatically).

---

## Part 0 — Get the new `.aab` file

The new bundle is building on Expo's servers right now.

1. Open your build dashboard:
   **https://expo.dev/accounts/kaustabborah/projects/fynestudy/builds**
2. The newest build at the top says **Android · production**. Wait until its status goes
   from **"In queue" → "In progress" → ✅ "Finished"** (about **10–20 minutes**).
3. Click that build to open it. Click the big **"Download"** button → it saves a file
   ending in **`.aab`** (e.g. `application-xxxx.aab`) to your computer's Downloads folder.
   - 👉 **Remember where it saved.** That `.aab` is what you upload to Google.

> The `.apk` you may have used for side-loading tests is different — for the Play Store
> you always upload the **`.aab`**.

---

## Part 1 — Open the app in Play Console

1. Go to **https://play.google.com/console** and sign in.
2. Click your app **FyneStudy** in the list. You land on its **Dashboard**.

---

## Part 2 — Create a new release on the Closed testing track

1. Left menu → **"Test and release" → "Testing" → "Closed testing"**.
2. You'll see your existing track (the one you made last time, e.g. **"Closed test"**).
   Click **"Manage track"** (or click the track name) to open it.
3. Top-right → click **"Create new release"**.

> Use the **same track** your testers are already on. Don't make a new track — if you do,
> your existing testers won't see the update.

---

## Part 3 — Upload the new `.aab`

1. Under **"App bundles"**, click **"Upload"** and pick the **`.aab`** you downloaded in Part 0.
2. Wait for it to process (~1 minute). It should appear in the list showing
   **version code 7** and **1.1.0**.
   - ✅ If you ever see a red error like *"Version code 7 has already been used"*, it means
     this exact build was uploaded before — just build again (it'll become 8) and re-upload.
   - You do **NOT** touch "App signing" — Google already manages your signing key from the
     first release. Nothing to do here.
3. **Release name** auto-fills to something like **`7 (1.1.0)`** — leave it as is.

---

## Part 4 — Write release notes

In the **"Release notes"** box, type what's new between the language tags. Example:

```
<en-US>
What's new in 1.1:
• Smoother, more secure video player with full-screen + landscape.
• Cleaner date/time and dropdown pickers across the app.
• New dedicated Quiz tab.
• Fixes to the study library, stay-signed-in, and live classes.
</en-US>
```

> If your store uses **English (India) / en-IN** as the default language, use
> `<en-IN> ... </en-IN>` instead (whatever language code Play shows you in that box).

---

## Part 5 — Review and roll out

1. Click **"Next"** (bottom-right).
2. Google shows a review screen. **Warnings** (yellow) are usually fine; **errors** (red)
   must be fixed before you can continue.
3. Click **"Save"** → then **"Review release"** → then
   **"Start rollout to Closed testing"** → confirm in the popup.
4. ✅ Done. The update is now rolling out to your closed testers.

---

## Part 6 — What your testers do (and how fast they get it)

Your testers are **already opted in** from last time — they do **not** need a new link.

- The update reaches them automatically through the Play Store, usually within
  **a few minutes to a few hours** (Google's processing).
- To get it **immediately**, a tester can:
  1. Open the **Play Store** app on their phone.
  2. Search **FyneStudy** (or open **My apps & games → Updates**).
  3. Tap **Update** if shown. (If it still shows the old version, wait ~30–60 min and retry —
     it's Google's rollout delay, not a problem with your build.)
- If you added **new** testers since last time, send them the same **"Join on the web"**
  opt-in link from the track's **Testers** tab; they click it, become a tester, then install.

> ⚠️ **14-day rule reminder:** if you are still inside Google's required 12-tester /
> 14-day closed test (for new Personal accounts before you can apply for production),
> pushing this update is fine and does **not** reset the clock — keep your 12+ testers
> opted in and using the app.

---

## Optional — automate future updates with `eas submit`

Once you've done this manual upload a couple of times, you *can* skip the download+upload
by setting up a Google **service account** key and running:

```
cd apps/mobile
eas submit --platform android --profile production --latest
```

That uploads the latest finished EAS build straight to the track set in `eas.json`
(currently `internal`). ⚠️ Note: today your testers are on a **Closed** track, not the
**Internal** one, so until that's reconciled, **stick with the manual upload above** for
closed testers. Ask me when you want to wire up `eas submit` properly.

---

## Quick cheat-sheet (for next time)

1. `cd apps/mobile && eas build --platform android --profile production` → wait → download `.aab`.
2. Play Console → FyneStudy → Test and release → Testing → **Closed testing** → your track → **Create new release**.
3. Upload `.aab` → add release notes → **Next → Save → Review release → Start rollout**.
4. Testers auto-update from the Play Store. Done.
