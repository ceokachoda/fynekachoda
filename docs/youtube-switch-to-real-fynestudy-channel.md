# How to switch live classes to the real FyneStudy YouTube channel

> **Read this if:** live classes currently stream through a *personal/test* YouTube
> account (the developer's channel, **"NOvA FX"**), and you want every live class to go
> out on the **institute's own "FyneStudy" YouTube channel** instead.
>
> **Who this is for:** a complete beginner. You do **not** need to know any coding. Every
> step tells you the exact website to open, the exact button to click, and what you should
> see on screen afterwards. Take your time — you can't break the app by following this.
>
> **How long it takes:** about **30–45 minutes of clicking**, BUT see the ⚠ warning in
> Part 2 — YouTube makes you **wait up to 2 days** before a brand-new channel is allowed
> to go live. So **start this a few days before** your first real class.

---

## Part 0 — The one idea behind all of this (please read)

The app doesn't "know" whose YouTube channel it uses. It simply reads **5 secret values**
stored safely in our database (Supabase). Switching channels = **replacing those 5 values**
with ones that belong to the FyneStudy channel. That's the whole job.

Here are the 5 values you'll collect. Don't worry about what they mean yet — each Part
below produces one or two of them.

| # | Secret name (exactly this) | In plain English | Looks like |
|---|---|---|---|
| 1 | `INSTITUTE_CHANNEL_ID` | The ID of the FyneStudy YouTube channel | `UCxxxxxxxxxxxxxxxxxxxxxx` (starts with `UC`, 24 characters) |
| 2 | `YT_DATA_API_KEY` | A key that lets the app read YouTube info | `AIzaSyD...` (about 39 characters) |
| 3 | `YT_CLIENT_ID` | The app's "username" with Google | `1234567890-abc...apps.googleusercontent.com` |
| 4 | `YT_CLIENT_SECRET` | The app's "password" with Google | `GOCSPX-xxxxxxxxxxxxxxxx` |
| 5 | `YT_REFRESH_TOKEN` | A permanent "stay logged in" pass for the FyneStudy channel | `1//0xxxxxxxxxxxxxxxxxxxx` (long) |

> 🔐 **Golden safety rule:** these 5 values are like passwords. **Never** put them in an
> email, a chat that others can read, a screenshot you share publicly, or any file inside
> the app's code. The only safe place is the Supabase Vault (Part 8). Keep a private copy
> (e.g. in your phone's notes app or a password manager) so you can switch back later.

**Tip:** open a blank note on your computer titled *"FyneStudy YouTube values"*. As you
finish each Part, paste that Part's value into the note. By Part 8 you'll have all 5 ready
to enter in one go.

---

## Part 1 — Before you begin (checklist)

You need:

- [ ] A **Google account** that will OWN the FyneStudy channel. (A normal `@gmail.com`
      account is fine. Use the institute's official Google account, **not** your personal
      one — this account ends up controlling the live streams.)
- [ ] Access to the **Supabase dashboard** for this project. Sign in at
      **https://supabase.com/dashboard** → open the project named **`fynestudy-dev`**
      (that is our live database). If you don't have access, ask whoever set up the app to
      add you, or to do Part 8 for you.
- [ ] A phone that can receive an **SMS code** (for verifying the channel).
- [ ] About **45 minutes**, and ideally **2 days of lead time** before your first class.

---

## Part 2 — Set up the FyneStudy YouTube channel

> ⚠ **The 2-day warning (do this part first, then wait).** A brand-new YouTube channel is
> NOT allowed to live-stream immediately. Turning on live streaming starts a **clock of up
> to 24 hours**, and phone-verifying the account starts **another ~24 hours**. Until both
> finish, live classes will fail with a "permission" error even if everything else is
> perfect. So: do steps 1–3 below now, then come back to Part 3 tomorrow.

1. **Sign in as the FyneStudy Google account.** Go to **https://www.youtube.com** →
   click your **profile picture** (top-right) → if it says **"Create a channel"**, click
   it, name the channel **FyneStudy**, and confirm. If a FyneStudy channel already exists,
   just make sure you're signed in to it.

2. **Verify the account with your phone.** Go to **https://www.youtube.com/verify** →
   choose your country → enter your phone number → type the 6-digit code YouTube texts you
   → you should see **"Verified"**. *(This starts one ~24-hour clock.)*

3. **Turn on live streaming.** Go to **https://www.youtube.com/features** → find
   **"Live streaming"** → click **Enable**. It may say you'll be eligible in 24 hours —
   **note the date/time it shows you.** *(This starts the second ~24-hour clock.)*

> ✅ When both clocks have passed (usually next day), this channel can go live. You can
> continue with Parts 3–8 right now while you wait — only the final test (Part 9) needs the
> wait to be over.

---

## Part 3 — Get the Channel ID  →  produces `INSTITUTE_CHANNEL_ID`

1. Go to **https://studio.youtube.com** (still signed in as FyneStudy).
2. Bottom-left → **Settings** (the ⚙ gear icon).
3. In the pop-up, click **Channel** → then the **Advanced settings** tab.
4. Scroll to **"Channel ID"**. It starts with **`UC`** and is 24 characters long.
   Click **Copy**.
5. Paste it into your note next to **`INSTITUTE_CHANNEL_ID`**. ✅ (1 of 5 done.)

---

## Part 4 — Create a Google Cloud project + API key  →  produces `YT_DATA_API_KEY`

This sounds scary but it's just clicking through a free Google service. Stay signed in as
the FyneStudy Google account the whole time.

1. Go to **https://console.cloud.google.com**. If it asks you to agree to terms, agree.
2. At the very top, click the **project dropdown** (it may say "Select a project") →
   **New Project** → Name it **`fynestudy-youtube`** → **Create**. Wait a few seconds, then
   make sure that new project is the one selected in the top dropdown.
3. In the search bar at the top, type **`YouTube Data API v3`** and click it in the
   results → click the blue **Enable** button. Wait for it to finish.
4. Now create the API key: in the search bar type **`Credentials`** → open
   **APIs & Services → Credentials**.
5. Click **+ CREATE CREDENTIALS** (top) → **API key**. A box pops up with your key
   (`AIzaSy...`). Click **Copy**.
6. Paste it into your note next to **`YT_DATA_API_KEY`**. ✅ (2 of 5 done.)
7. *(Optional but recommended)* In that pop-up click **Edit API key** → under
   **API restrictions** choose **Restrict key** → tick **YouTube Data API v3** → **Save**.
   This makes the key safer.

---

## Part 5 — Set up the consent screen + PUBLISH it

This is the screen Google shows when our app asks for permission to use the channel. We
must fill it in once, and **publish** it so the login pass we create in Part 7 never
expires.

1. In the search bar type **`OAuth consent`** → open **APIs & Services → OAuth consent
   screen** (newer dashboards call this **"Google Auth Platform → Branding/Audience"**).
2. If asked to choose a user type, pick **External** → **Create**.
3. Fill the required fields:
   - **App name:** `FyneStudy`
   - **User support email:** the FyneStudy email
   - **Developer contact email** (at the bottom): the FyneStudy email
   - Leave everything else blank. Click **Save and Continue**.
4. **Scopes step:** click **Add or Remove Scopes**. In the filter box, paste this and tick
   it: `https://www.googleapis.com/auth/youtube.force-ssl`. Then also add:
   `https://www.googleapis.com/auth/youtube`. Click **Update** → **Save and Continue**.
   *(These two permissions let the app create and manage live broadcasts on the channel.)*
5. **Test users step** (if shown): you can skip it — we're going to publish instead.
   Click **Save and Continue** → **Back to Dashboard**.
6. **PUBLISH (important!):** on the OAuth consent screen / **Audience** page, find
   **Publishing status**. If it says *"Testing"*, click **Publish app** → **Confirm**.
   - You may see a banner about "verification required." **Ignore it** — that's only for
     apps with millions of public users. Our app still works perfectly while unverified.
   - Why this matters: if you leave it in "Testing", the login pass from Part 7 **stops
     working after 7 days** and live classes break. Publishing makes it permanent.

✅ Nothing to paste in your note from this Part — but it's the most-skipped step, so
double-check the status now reads **"In production"** (i.e. published).

---

## Part 6 — Create the OAuth Client  →  produces `YT_CLIENT_ID` + `YT_CLIENT_SECRET`

1. Go back to **APIs & Services → Credentials** (search `Credentials`).
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. **Application type:** choose **Web application**.
4. **Name:** `FyneStudy live`.
5. Find **Authorised redirect URIs** → click **+ ADD URI** → paste **exactly**:
   `https://developers.google.com/oauthplayground`
   *(This must match exactly — no trailing slash, no spaces. It lets us create the login
   pass in Part 7.)*
6. Click **Create**. A box pops up showing **Client ID** and **Client secret**.
7. Copy both into your note:
   - **Client ID** → next to **`YT_CLIENT_ID`** ✅ (3 of 5)
   - **Client secret** → next to **`YT_CLIENT_SECRET`** ✅ (4 of 5)
8. Click **OK**/Done. (You can always re-open this from the Credentials page to copy them
   again.)

---

## Part 7 — Create the permanent login pass  →  produces `YT_REFRESH_TOKEN`

This is the step that actually ties everything to the **FyneStudy** channel.

1. Open **https://developers.google.com/oauthplayground** in your browser.
2. Click the **⚙ gear icon** (top-right). In the panel that opens:
   - Tick **"Use your own OAuth credentials"**.
   - **OAuth Client ID:** paste your `YT_CLIENT_ID` (from Part 6).
   - **OAuth Client secret:** paste your `YT_CLIENT_SECRET` (from Part 6).
   - Make sure **Access type** is **Offline** and (if shown) **Force prompt =
     Consent screen**.
   - Close the gear panel.
3. On the **left side**, find the box that says **"Input your own scopes"**. Paste this and
   press the **Authorize APIs** button below it:
   `https://www.googleapis.com/auth/youtube.force-ssl`
4. A Google sign-in window opens. **Sign in as the FyneStudy channel's Google account**
   (the same one from Part 2 — NOT your personal account).
   - If you see **"Google hasn't verified this app"**, click **Advanced** →
     **Go to FyneStudy (unsafe)** → **Continue**. (This is expected for our unverified
     app and is safe — it's your own app.)
   - Click **Allow** on the permissions screen.
5. You're sent back to the Playground, now on **Step 2**. Click the blue button
   **"Exchange authorization code for tokens"**.
6. On the right you'll now see a **`Refresh token`** that starts with `1//`. Click to
   select it and copy it.
7. Paste it into your note next to **`YT_REFRESH_TOKEN`**. ✅ (5 of 5 — all values
   collected!)

> ✅ Because you published the app in Part 5, this refresh token is **permanent**. (You can
> tell it worked: the response does NOT contain a line called `refresh_token_expires_in`.)

---

## Part 8 — Put all 5 values into Supabase (the actual switch)

Now we save your 5 values into the app's secure Vault. The moment you do this, the next
live class streams on the **FyneStudy** channel. No app rebuild or redeploy is needed — the
app reads these live.

1. Go to **https://supabase.com/dashboard** → open the **`fynestudy-dev`** project.
2. In the left sidebar, click **SQL Editor** → **+ New query**.
3. Copy the block below into the editor. Then replace each `PASTE_..._HERE` with the
   matching value from your note. **Keep the single quotes** around each value.

   ```sql
   select vault.update_secret((select id from vault.secrets where name='INSTITUTE_CHANNEL_ID'), 'PASTE_CHANNEL_ID_HERE');
   select vault.update_secret((select id from vault.secrets where name='YT_DATA_API_KEY'),      'PASTE_DATA_API_KEY_HERE');
   select vault.update_secret((select id from vault.secrets where name='YT_CLIENT_ID'),         'PASTE_CLIENT_ID_HERE');
   select vault.update_secret((select id from vault.secrets where name='YT_CLIENT_SECRET'),     'PASTE_CLIENT_SECRET_HERE');
   select vault.update_secret((select id from vault.secrets where name='YT_REFRESH_TOKEN'),     'PASTE_REFRESH_TOKEN_HERE');
   ```

4. Click the green **Run** button. You should see **"Success. No rows returned"** (that's
   the normal success message for this kind of command).

> ❓ **If `update_secret` gives an error like "secret does not exist"** it means the secret
> was never created before. In that case, change `vault.update_secret(...)` to
> `vault.create_secret('PASTE_VALUE_HERE', 'SECRET_NAME')` for that one line — for example:
> `select vault.create_secret('UCabc...', 'INSTITUTE_CHANNEL_ID');`. (For our existing
> project all 5 already exist, so `update_secret` is correct.)

✅ The switch is done. The old NOvA FX values are now overwritten by the FyneStudy ones.

---

## Part 9 — Test that it actually works

Do this **after** the 2-day wait from Part 2 is over.

1. **In the teacher app:** open the **Classes** tab → tap the **Schedule Live** button →
   pick a batch, a time (now), and create the class.
2. Open the class → you should see a **"Stream setup"** card with a **Server URL** and a
   **Stream key** (and Copy buttons). Seeing a real key here means the FyneStudy channel
   connected successfully. *(If instead you see an error, jump to Troubleshooting below.)*
3. **In OBS** (the streaming software — see `docs/phases/phase-9-youtube-setup.md` for the
   full OBS walk-through): paste the Server URL and Stream key → **Start Streaming**.
4. Back in the teacher app, tap **Go Live**. Within ~20–30 seconds a **student** account
   should see the class as **Live** and be able to watch.
5. **Confirm it's on the right channel:** open **https://studio.youtube.com** as FyneStudy
   → **Content → Live** → your broadcast should be listed there. 🎉

---

## Part 10 — Troubleshooting (common problems)

| What you see | What it usually means | Fix |
|---|---|---|
| "Stream setup" shows a **permission / 403 error** instead of a key | The channel's 2-day live-streaming wait (Part 2) **isn't over yet**, OR live streaming was never enabled | Wait until the date YouTube showed you in Part 2 step 3, then re-check **https://www.youtube.com/features** says live streaming is **on** |
| Live worked for a few days then **suddenly broke** | The OAuth app was left in **"Testing"**, so the refresh token expired after 7 days | Do **Part 5 step 6** (Publish the app), then redo **Part 7** to mint a fresh token, then **Part 8** again |
| Sign-in in Part 7 used the **wrong account** | The token now points at the wrong channel | Redo **Part 7**, and at the Google sign-in screen carefully pick the **FyneStudy** account |
| The broadcast appears on the **old/test** channel | Part 8 didn't actually save, or the refresh token is still the old one | Re-run the Part 8 SQL and confirm **"Success"**; make sure the refresh token you pasted is the **new** one from the FyneStudy sign-in |
| Adding a YouTube **video to the library** fails | `YT_DATA_API_KEY` is wrong or the API isn't enabled | Re-check **Part 4** (API enabled + key copied correctly into Part 8) |
| "**quota exceeded**" error | Too many live classes created in one day on a brand-new Google Cloud project | This is rare for a single institute; Google resets the daily quota every 24h. If it persists, request a quota increase in the Cloud Console |

> Still stuck? Send the developer the **exact error text** you see (a screenshot is fine —
> just **blur out any of the 5 secret values** first).

---

## Part 11 — How to switch BACK to the old/test channel (if ever needed)

Because the only thing that changed is the 5 Vault values, switching back is just running
Part 8 again with the **old** values. So **before** you overwrite anything, it's wise to
have saved the old values. The original test channel was:

- `INSTITUTE_CHANNEL_ID` = `UCSa8awrJseI_8r_oZQjuvYQ`  *(the "NOvA FX" test channel)*
- The other 4 old values belong to the developer's Google Cloud project — ask the developer
  for them if you ever need to revert.

To revert: open **Part 8**, paste the old values instead, and click **Run**.

---

## Part 12 — Final checklist

- [ ] **Part 2:** FyneStudy channel created, phone-verified, live streaming enabled, and
      both ~24h waits are over.
- [ ] **Part 3:** `INSTITUTE_CHANNEL_ID` copied (`UC…`).
- [ ] **Part 4:** Google Cloud project made, YouTube Data API v3 enabled, `YT_DATA_API_KEY`
      copied.
- [ ] **Part 5:** Consent screen filled in, both YouTube scopes added, and app status is
      **Published / In production**.
- [ ] **Part 6:** `YT_CLIENT_ID` + `YT_CLIENT_SECRET` copied.
- [ ] **Part 7:** Signed in as the FyneStudy channel, `YT_REFRESH_TOKEN` (starts `1//`)
      copied.
- [ ] **Part 8:** All 5 values saved in Supabase Vault → "Success".
- [ ] **Part 9:** Test live class streamed and showed up on the FyneStudy channel.
- [ ] Saved a private backup copy of all 5 values (and the old ones) somewhere safe.

---

### Related, more technical docs (for the developer)
- `docs/phases/phase-9-youtube-setup.md` — original A-to-Z YouTube + OBS setup.
- `docs/phases/phase-9-youtube-client-handover.md` — the same switch written for the
  developer (includes a "keep my Cloud project vs hand everything over" decision).
- `docs/phases/phase-9-youtube-own-channel.md` — a future option for letting individual
  teachers stream on their own channels.
