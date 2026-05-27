# Phase 9 — YouTube Live Setup Guide (complete, beginner-friendly, A‑Z)

> **Who this is for:** you, doing this for the first time, with zero prior YouTube‑API
> or OBS experience. Every step says **exactly** where to click, what you'll see, and
> what to copy. If a step ever looks different from what's written, stop and tell me —
> don't guess.
>
> **What this gets you:** the ability to run a **real live class** that streams from a
> teacher's computer (through OBS) to **the institute's YouTube channel**, and shows up
> inside the FyneStudy app for students — with working chat, raise‑hand, pin, and a
> recording afterwards. This is the only part of Phase 9 that needs things only **you**
> can provide (a Google account, a phone for an SMS code, and OBS on a computer).
>
> **✅ STATUS (2026-05-26): this setup is DONE.** All 5 secrets are in Vault, the OAuth app
> is **published** (permanent token, no 7‑day expiry), and it's verified working on channel
> **"NOvA FX"** (`UCSa8awrJseI_8r_oZQjuvYQ`, live‑streaming enabled). The steps below are
> kept as the **reference** for how it was done + how to redo it. ⚠ NOvA FX is a temporary
> personal account — to move streaming to the **client's** channel, see
> [`phase-9-youtube-client-handover.md`](./phase-9-youtube-client-handover.md).
>
> _(Before it was provisioned, the app's "Set up live class" screen showed an amber
> "YouTube isn't configured yet" card and the broadcast call returned 503 — D‑195. That's
> the pre‑setup behaviour; you should now see a real Server + Stream key.)_

---

## 0. Read this first — what we're actually doing, in plain English

You don't need to understand any of this to follow the steps, but 60 seconds here makes
every later step make sense.

- **A "live class" in FyneStudy is just a private YouTube live stream wrapped inside the
  app.** Students never see YouTube's website — they see the video *inside* the app, with
  a moving watermark and the app's own chat.
- For the app's backend to *create and control* that stream on **your channel**, it has
  to prove to YouTube that it's allowed to act on that channel's behalf. It proves this
  with **four secret values** (below). You generate them once; I store them in an
  encrypted vault; the app uses them forever after.
- The actual *video* (your screen + webcam + voice) is sent to YouTube by a free program
  called **OBS Studio** running on the teacher's computer. OBS doesn't log into YouTube —
  the app hands it a one‑time **address + key** for each class, and OBS just pushes video
  to that address.

So there are **two completely separate machines/roles**, and that's the whole trick:
- **The app's backend** (server) → authenticates to YouTube with the four secrets, and
  *creates* each broadcast.
- **OBS on a laptop** → *sends the actual video* using a per‑class key the app gives the
  teacher. OBS needs no login, no account, nothing.

### The four values you'll produce

```
1. YT_CLIENT_ID         ← from Google Cloud  ("OAuth client ID")
2. YT_CLIENT_SECRET     ← from Google Cloud  ("OAuth client secret")
3. YT_REFRESH_TOKEN     ← from the Google OAuth Playground (after you sign in)
4. INSTITUTE_CHANNEL_ID ← your YouTube channel's ID (starts with "UC…")
```

### Glossary (plain words — skim, then refer back)

| Term | What it means here |
|---|---|
| **Channel** | Your institute's YouTube channel — where all live classes + recordings live. |
| **Channel ID** | The channel's permanent code, looks like `UCxxxxxxxxxxxx…` (24 chars). Value #4. |
| **Google Cloud project** | A free "container" where you register the app so it's allowed to call YouTube's API. Not a payment thing — just registration. |
| **YouTube Data API v3** | The YouTube feature set our backend calls to create/start/stop broadcasts. You "enable" it in the project. |
| **OAuth consent screen** | The Google permission screen a user sees ("FyneStudy wants to manage your YouTube account → Allow"). You configure it once. |
| **OAuth Client ID + Secret** | The app's "username + password" with Google. Values #1 and #2. |
| **Refresh token** | A long‑lived key, created *after* you sign in and click Allow, that lets the backend keep getting fresh access without you re‑logging in. Value #3. |
| **Supabase Vault** | An encrypted secret store in our backend. The four values live here — never in the app code, never in git. |
| **OBS Studio** | Free program on the teacher's computer that captures screen + webcam + mic and streams it. |
| **RTMP URL / Server** | The address OBS sends video to (e.g. `rtmp://a.rtmp.youtube.com/live2`). The app shows it per class. |
| **Stream key** | A one‑time secret for a single class, pasted into OBS alongside the server. The app shows it; it's never stored. |
| **Broadcast** | One scheduled live event on the channel. The backend creates one per class. |

---

## 0A. One institute channel vs. each teacher's own channel

There are two possible "destinations" a live class can stream to. **This guide is for the
first one** — the shared **FyneStudy institute channel** — which is what's built and
working today and what you should set up first:

| Destination | What it needs | Status |
|---|---|---|
| **FyneStudy institute channel** (this doc) | The four `YT_*` secrets, set up **once** by you. Teachers need **no** YouTube account at all. | **Built & ready** — just needs you to complete this guide. |
| **Each teacher's own channel** (optional, later) | Each teacher connects their own YouTube once; needs the OAuth app to be *published*. | **Planned feature** — see the separate guide **[`phase-9-youtube-own-channel.md`](./phase-9-youtube-own-channel.md)** and tell me which mode you want before I build it. |

> **Bottom line:** finish *this* guide first. The "own channel" option is an add‑on you
> can decide on later; it does not block anything here.

---

## 0B. Using two different Google accounts? (optional — skip if you'll use one)

Totally fine, and common. The four values split across **two roles**, which *can* be two
different Google accounts:

| Role | Owns | Produces | Different account OK? |
|---|---|---|---|
| **Project account** | the Google Cloud project (API, OAuth client, consent screen) | `YT_CLIENT_ID`, `YT_CLIENT_SECRET` | **Yes — any Google account.** It's only the "app registration." |
| **Channel account** | the YouTube channel you broadcast on (your *streaming* account) | `YT_REFRESH_TOKEN`, `INSTITUTE_CHANNEL_ID` | This *is* the channel you stream to. |

The backend always broadcasts on **whichever channel the refresh token belongs to**. So
the only two rules that make a split‑account setup work:

> 1. **STEP 5 (Playground sign‑in):** sign in as the **channel / streaming account** — the
>    refresh token (and every broadcast) is bound to whoever signs in here.
> 2. **STEP 3.5 (Test users):** the consent screen is in "Testing" on the **project
>    account**, so **add the channel account's email as a Test User**, or STEP 5 fails
>    with `access_denied`.

If you'll just use **one** Google account for everything, ignore this section — every
step below just uses that one account.

---

## 1. Gather these before you start

| Thing | Why | Notes |
|---|---|---|
| A Google account for the institute | Owns the channel + the API project | A normal Gmail works. Use a **dedicated institute account**, not a personal one — whoever holds it controls the live streams. |
| A phone that can receive an SMS | YouTube requires phone verification to live stream | One‑time. |
| ~15 min of clicking + **up to ~48 h of waiting** | Channel verification (~24 h) and live‑streaming enablement (~24 h) each have a first‑time hold | **Do Steps 1.2 + 1.3 FIRST** so the two clocks run while you do the rest. |
| A computer with OBS Studio | Sends the actual video to YouTube | Free, from obsproject.com. Windows / macOS / Linux all fine. |

**Order of operations (important — saves you a day):**

1. **STEP 1** — create + **verify** the channel and **enable live streaming** → starts the
   two ~24 h clocks **now**.
2. While those clocks run: **STEPS 2 → 3 → 4 → 5** (Cloud project, consent screen, OAuth
   client, refresh token). No waiting on these.
3. **STEP 6** — install + set up OBS any time.
4. **STEP 7** — send me the four values; I load them + redeploy; we confirm together.
5. **STEP 8** — the full end‑to‑end live class (this is the §G dry‑run).

---

## 2. ⚠ How to hand the four values to me — SAFELY (read before STEP 7)

These four values are **secrets**. The refresh token especially lets the holder control
your YouTube channel. So:

- **NEVER paste the real values into this file, into a `.env` file, or into any file in
  the project.** Everything in the repo is tracked by git and committing a secret is a
  hard rule we never break. This guide only ever shows **placeholders**.
- **Two safe ways to give them to me:**
  - **Option A (recommended — easiest):** once you have all four, **paste them to me
    directly in our chat**, like this:
    ```
    YT_CLIENT_ID = 1234....apps.googleusercontent.com
    YT_CLIENT_SECRET = GOCSPX-....
    YT_REFRESH_TOKEN = 1//0g....
    INSTITUTE_CHANNEL_ID = UC....
    ```
    I load them into Vault for project `orqwyazvcthgxoadfxfv` and redeploy. They never
    touch the repo.
  - **Option B (you run it yourself):** run the SQL in **STEP 7.2** in the Supabase SQL
    editor, then tell me, and I'll redeploy.
- If a value ever leaks, revoke it instantly at
  **https://myaccount.google.com/permissions** (removes the app's access), then redo
  STEP 5 to mint a fresh token.

---

## STEP 1 — Institute YouTube channel + Channel ID

> **Produces:** **`INSTITUTE_CHANNEL_ID`** (looks like `UCabc123…`, 24 characters).
> **Do on:** the **channel / streaming** account.

### 1.1 — Make sure the institute has a channel
1. Go to **https://www.youtube.com** and sign in with the **institute Google account**.
2. Click your **profile picture** (top‑right).
3. If you see **"Create a channel"**, click it, give it the institute's name, confirm. If
   you already see **"Your channel"**, you're done here.

### 1.2 — Verify the channel (phone) — *starts the first ~24 h clock*
1. Go to **https://www.youtube.com/verify** (signed in as the institute account).
2. Choose your **country**, pick **"Receive verification code by SMS"**, enter the phone
   number → **Get code**.
3. Enter the 6‑digit code from the SMS → **Submit**.
4. You should see **"Verified" / "Your account is verified."**

### 1.3 — Enable live streaming — *starts the second ~24 h clock*
1. Go to **https://www.youtube.com/features** (signed in as the institute account).
2. Find **"Live streaming"** and click **Enable** / **Request**. (You can also reach this
   via **Create → Go live** in YouTube Studio.)
3. You'll likely see **"Your channel will be eligible to live stream in 24 hours."** —
   that's normal. **Note the date/time**; come back after it passes. Keep doing the other
   steps meanwhile.

### 1.4 — Find and copy the Channel ID
1. Go to **https://studio.youtube.com** (YouTube Studio).
2. Bottom‑left, click **Settings** (the ⚙ gear).
3. In the dialog: **Channel → Advanced settings**.
4. You'll see **"Channel ID"** starting with **`UC…`** and a **Copy** button. Copy it →
   this is **`INSTITUTE_CHANNEL_ID`**. Save it somewhere safe (not in the repo).

> _Alternative:_ on your channel page, the URL `youtube.com/channel/UC…` contains the ID —
> the part after `/channel/`.

---

## STEP 2 — Google Cloud project + enable the YouTube Data API

> **Produces:** nothing to copy yet — sets up the project the OAuth client lives in.
> **Do on:** the **project** account (can be the same as the channel account).

1. Go to **https://console.cloud.google.com** and sign in.
   - First time? It may ask you to agree to terms and pick a country — do that; no payment
     or credit card is required for what we're doing.
2. At the very top, click the **project dropdown** (says "Select a project") → **New
   Project**.
3. Name it e.g. **`FyneStudy Live`** → **Create**. Wait a few seconds, then make sure that
   project is **selected** in the top dropdown.
4. Enable the API: open
   **https://console.cloud.google.com/apis/library/youtube.googleapis.com**
   (this is "YouTube Data API v3"). Confirm the right project is selected at the top, then
   click the blue **Enable** button.
   - You should land on the API's "Overview" page showing it's enabled.

---

## STEP 3 — OAuth consent screen ("Google Auth Platform")

> **Produces:** nothing to copy — but you **must** finish this before STEP 4 or sign‑in
> fails. **This is the screen you're on now** (the "Project configuration" wizard).

> 🔎 **What you're seeing.** Google replaced the old "OAuth consent screen" with the
> **"Google Auth Platform"**. The **first** time you open it, it shows a one‑time
> onboarding **wizard** titled **"Project configuration"** with four numbered steps:
> **1 App Information → 2 Audience → 3 Contact Information → 4 Finish**. The left‑nav items
> (**Branding / Audience / Clients / Data access / Verification centre**) are **locked /
> greyed until you finish this wizard.** ✅ **Completing this wizard IS "creating the
> app."** You can't click Branding/Clients yet *because* the app doesn't exist yet — that's
> exactly what these four steps create. So: **fill the wizard first (3.1–3.4), then the
> tabs unlock and you do 3.5–3.6.**

### 3.0 — If you don't see the wizard
If instead the page already shows filled‑in tabs (Branding has an app name, etc.), your
app was already created — **skip to 3.5**.

### 3.1 — Wizard Step 1: "App Information"
On the screen you're on now:
1. **App name** → type `FyneStudy Live` (any name; this is what users see on the consent
   screen).
2. **User support email** → click the dropdown and pick your email.
3. Click **Next**.

### 3.2 — Wizard Step 2: "Audience"
1. Choose **External** (pick **Internal** only if this is a Google **Workspace** account —
   it's simpler but most institutes are on a normal Gmail, so **External** is the usual
   pick).
2. Click **Next**.

### 3.3 — Wizard Step 3: "Contact Information"
1. Enter an **email address** (your institute email is fine — this is for Google to send
   you project notices).
2. Click **Next**.

### 3.4 — Wizard Step 4: "Finish"
1. Tick the box agreeing to the **Google API Services User Data Policy**.
2. Click **Create** (the blue button at the bottom — visible in your screenshot).
3. The wizard closes and the **left‑nav tabs are now active** (Branding, Audience,
   Clients, Data access). 🎉 The "app" now exists.

> The initial wizard does **not** ask for scopes or test users — you add those next, in the
> now‑unlocked tabs.

### 3.5 — Add the two YouTube scopes (left nav → **Data access**)
1. In the left nav click **Data access**.
2. Click **Add or remove scopes**. A panel titled **"Update selected scopes"** slides in
   from the right, with a **checkbox table** of scopes (it only lists scopes for APIs
   you've enabled — that's why the **YouTube Data API v3** scopes show, because you enabled
   it in STEP 2).

You need **exactly these two**, no more, no less:

| Tick this row (by its description) | = scope | Need it? |
|---|---|---|
| **"Manage your YouTube account"** | `.../auth/youtube` | ✅ yes |
| **"See, edit and permanently delete your YouTube videos, ratings, comments and captions"** | `.../auth/youtube.force-ssl` | ✅ yes (the important one — lets the backend control broadcasts) |
| "View your YouTube account" | `.../auth/youtube.readonly` | ❌ leave unticked |
| "Manage your YouTube videos" | `.../auth/youtube.upload` | ❌ leave unticked |
| anything `youtubepartner…` / `channel-memberships…` | (partner scopes) | ❌ leave unticked |

**Two ways to select them — use whichever is easier:**

- **Way A — tick the checkboxes:** in the table, tick the box on the **"Manage your YouTube
  account"** row and the **"See, edit and permanently delete your YouTube videos…"** row.
  Be careful not to confuse "Manage" (✅) with "View your YouTube account" (❌ readonly).
- **Way B — paste box (most foolproof):** scroll **down** inside the same panel to the
  **"Manually add scopes"** text box (the info banner at the top calls it the *"Pasted
  Scopes text box"*). Paste both of these, one per line, then click **Add to table**:
  ```
  https://www.googleapis.com/auth/youtube
  https://www.googleapis.com/auth/youtube.force-ssl
  ```

3. Click the blue **Update** button at the bottom of the panel. The panel closes.
4. Back on the **Data access** page you'll now see the two scopes listed —
   `.../auth/youtube` under **"Your sensitive scopes"** (or non‑sensitive) and
   `.../auth/youtube.force-ssl` under **"Your sensitive scopes"**. Click **Save** if a Save
   button appears at the bottom.

> _Note: don't worry which table ("sensitive" vs "non‑sensitive") each lands in — Google
> sorts them automatically. `youtube.force-ssl` is "sensitive"; that's expected and fine._

### 3.6 — Add your test user (left nav → **Audience**)
1. In the left nav click **Audience**.
2. Confirm **Publishing status = Testing** (it will be).
3. Under **Test users** click **Add users** and add the **channel / streaming account's
   email** (the account that owns the YouTube channel you'll broadcast on) — **even if your
   Cloud project is on a different account** (§0B). Click **Save**.
   > Skip this and the STEP 5 sign‑in fails with `access_denied`.

> ⏳ **The 7‑day token caveat (important):** while **Publishing status = "Testing"**, the
> refresh token from STEP 5 **stops working after 7 days** — you'd have to re‑mint it every
> week. To stop that for good, **publish the app** in **3.7** below. For a quick one‑off
> test you can skip 3.7 (just remember the weekly re‑mint); for real daily use, **do 3.7.**

### 3.7 — (Recommended) Publish the app so the token never expires

This flips the app from **Testing** → **In production**, which **removes the 7‑day token
expiry**. For your single institute account this is safe and free — you do **NOT** need
Google's full verification (that's only for the separate own‑channel feature).

1. Left nav → **Audience**.
2. Under **Publishing status** (shows "Testing"), click **Publish app**.
3. A dialog says the app will be available to any Google user — click **Confirm**.
   - Status now reads **"In production."** If Google shows a "Prepare for verification" /
     "Verification required" prompt, you can **ignore/close it** — the app still works; you
     just keep the "unverified app" warning when consenting (which only you ever see).
4. **Re‑mint the token once:** because your current token was issued while in Testing, redo
   **STEP 5** now (it takes 2 min) to get a fresh token under the published app. *That* one
   won't carry the 7‑day expiry. Send me the new `YT_REFRESH_TOKEN` (it replaces the old).

> **Order tip for next time:** if you ever set this up again from scratch, do 3.7
> (publish) **before** STEP 5, so the very first token you mint is already permanent.

> Why no paid verification: `youtube.force-ssl` is a **sensitive** scope, not a
> *restricted* one — publishing it doesn't trigger the paid CASA security audit. (More in
> `phase-9-youtube-own-channel.md`.)

---

## STEP 4 — Create the OAuth Client ID + Secret

> **Produces:** **`YT_CLIENT_ID`** and **`YT_CLIENT_SECRET`**.
> **You can only do this after STEP 3's wizard is finished** (the Clients tab was locked
> before that).

1. In the **Google Auth Platform** left nav, click **Clients**.
   - (Direct link: **https://console.cloud.google.com/auth/clients** — or the classic
     **https://console.cloud.google.com/apis/credentials**. Make sure your project is
     selected at the top.)
2. Click **+ Create client** (classic UI: **+ Create Credentials → OAuth client ID**).
3. **Application type:** choose **Web application**.
4. **Name:** anything, e.g. **`FyneStudy OAuth Playground`**.
5. Under **Authorised redirect URIs**, click **+ Add URI** and paste this **exactly** (no
   trailing slash, no spaces):
   ```
   https://developers.google.com/oauthplayground
   ```
   ⚠ If this doesn't match perfectly, STEP 5 fails with **"redirect_uri_mismatch"**.
6. Click **Create**. A panel/dialog shows:
   - **Your Client ID** → copy → **`YT_CLIENT_ID`** (looks like
     `1234567890-abcd.apps.googleusercontent.com`).
   - **Your Client Secret** → copy → **`YT_CLIENT_SECRET`** (looks like `GOCSPX-xxxx`).
   - You can **Download JSON** to keep a backup somewhere safe — but **not** in this repo.

---

## STEP 5 — Get the refresh token (Google OAuth Playground)

> **Produces:** **`YT_REFRESH_TOKEN`** (looks like `1//0g…`, a long string).
> **Sign in here as the CHANNEL / streaming account** (the one that owns the channel).

1. Open **https://developers.google.com/oauthplayground** in your browser.
2. Click the **gear ⚙** (top‑right). The **"OAuth 2.0 configuration"** panel opens. Set:
   - **Access type** = **Offline** (already the default — this is what makes Google return
     a *refresh* token, not just a temporary one).
   - **Force prompt** = **Consent Screen** (already the default — guarantees a fresh
     refresh token every time).
   - ✅ Tick **"Use your own OAuth credentials"** (near the bottom — it's **unchecked** by
     default). **Ticking it reveals two new fields:** *OAuth Client ID* and *OAuth Client
     secret*.
   - Paste your **OAuth Client ID** and **OAuth Client secret** (from STEP 4) into those
     two fields.
   - Click **Close**.
3. On the **left** ("Step 1 — Select & authorize APIs"), find the **"Input your own
   scopes"** box at the bottom and paste:
   ```
   https://www.googleapis.com/auth/youtube.force-ssl
   ```
   (You can add `https://www.googleapis.com/auth/youtube` too, separated by a space.) Then
   click the blue **Authorize APIs**.
4. A Google sign‑in opens. **Sign in with the channel / streaming account** (the one that
   owns the channel and that you added as a Test User in STEP 3). If your Cloud project is
   on a different account, do **not** sign in with that here (§0B). Brand‑Account channel?
   You may get a "choose a channel" picker — pick the streaming channel.
   - If you see **"Google hasn't verified this app"**: click **Advanced** → **Go to
     `<your app name>` (unsafe)** (whatever you typed as App name in 3.1) → **Continue /
     Allow**. Expected for a Testing‑status app — it's your own app.
5. You're returned to the Playground on **"Step 2 — Exchange authorization code for
   tokens"**, with the **Authorization code** box now filled. The **Refresh token** and
   **Access token** fields below it are still **empty** at this point — that's normal.
   Click the blue **Exchange authorization code for tokens** button.
6. The **"Refresh token:"** field (left side) now fills with a long string starting
   `1//…` (and the right‑hand response also shows a `refresh_token`). **Copy that value**
   → **`YT_REFRESH_TOKEN`**.

> 🛠 **No `refresh_token` shown** (only an access token)? Google only returns one the
> *first* time you consent. Revoke the prior grant at
> **https://myaccount.google.com/permissions** (remove "FyneStudy Live"), then repeat from
> step 3 — making sure **Access type: Offline** is set in the gear panel.

---

## STEP 6 — Install & set up OBS Studio (once, before any class)

> **Produces:** nothing to send me. **OBS** captures your screen + webcam + mic and pushes
> it to YouTube. You set it up **once**. The per‑class "connect + go live" (pasting the
> key, Start Streaming) is **STEP 8** — you enter no key now, because the app gives a
> fresh, single‑use **Server + Stream key** for each class (never stored on the device, by
> design — D‑193).

### 6.1 — Download & install
1. Go to **https://obsproject.com** → click your OS (**Windows / macOS / Linux**) → the
   download starts.
2. Run the installer, accept the defaults, finish, and **launch OBS Studio**.
3. **macOS only — grant permissions** (or you get a black screen): **System Settings →
   Privacy & Security → Screen Recording → turn ON "OBS"**, and the same under **Camera**
   and **Microphone**. Then **quit and reopen OBS**.

### 6.2 — First‑launch Auto‑Configuration Wizard
The first time OBS opens it offers an **Auto‑Configuration Wizard**:
1. Pick **"Optimize for streaming, recording is secondary"** → **Next**.
2. **Base (Canvas) Resolution:** **1280×720** (or 1920×1080 if you'd rather design bigger
   — we scale the *output* to 720p in 6.5). **FPS:** **30** → **Next**.
3. If it asks for a streaming service / key, **skip or cancel** — we connect manually in
   STEP 8. Click **Apply Settings** (or just close the wizard).
   - No wizard shown? No problem — set everything by hand below.

### 6.3 — 30‑second tour of the OBS window
- **Big black area (center)** — the **canvas / preview**: exactly what students will see.
- **Scenes** (bottom‑left) — saved layouts; you'll use one.
- **Sources** (bottom, beside Scenes) — things in a scene (screen, webcam, mic, logo).
- **Audio Mixer** (bottom‑center) — live volume bars.
- **Controls** (bottom‑right) — **Start Streaming**, **Start Recording**, **Settings (⚙)**.

### 6.4 — Settings → Output (quality)
Click **Settings** (bottom‑right) → **Output** tab:
- **Output Mode:** **Simple** (easiest).
- **Video Bitrate:** **3000 Kbps** (2500 if your upload is slow, up to 4000 if it's fast).
- **Encoder:** pick a **Hardware** encoder if offered (**NVENC** = Nvidia, **QuickSync** =
  Intel, **AMD**, **Apple VT** = Mac) — smoother + easier on the CPU. Otherwise **Software
  (x264)**.
- **Audio Bitrate:** **160**.
- *(Optional, more reliable on YouTube)* **Output Mode → Advanced → Streaming → Keyframe
  Interval = 2** seconds.

### 6.5 — Settings → Video (resolution + frame rate)
**Settings → Video** tab:
- **Base (Canvas) Resolution:** `1280×720` (or `1920×1080`).
- **Output (Scaled) Resolution:** **`1280×720`** — keep this at **720p**; it matches the
  YouTube stream the backend creates (`yt-api.ts` requests `720p` @ `30fps`).
- **Downscale Filter:** **Bicubic** (or Lanczos).
- **Common FPS Values:** **30**.

### 6.6 — Settings → Audio (microphone)
**Settings → Audio** tab → **Sample Rate 48 kHz**; set **Mic/Auxiliary Audio** to the
teacher's microphone; set **Desktop Audio** only if students should hear the computer's
own sound (e.g. a video you play in class). Click **OK**.

### 6.7 — Build the scene: add what students will see (Sources)

> 🟢 **Beginner heads‑up:** the big preview is **black right now and that's normal** — it
> stays black until you add at least one **Source**. A "Source" is one ingredient of the
> picture (your screen, your webcam, a logo). You stack a few into one **Scene**.

**First, add your screen (so students see your slides/PDF/whiteboard):**
1. In the **Sources** box (bottom, next to Scenes) click the **+**.
2. Choose **Display Capture** (Windows/Linux) or **macOS Screen Capture** (Mac).
3. Leave **"Create new"** selected, keep the default name → **OK**.
4. A properties dialog opens → pick the **monitor/display** you'll teach from → **OK**.
   - The preview should now show your desktop (it may look like an infinity‑mirror if OBS
     is on that same screen — that's fine; it won't look like that to students once you're
     showing slides).
   - **Black instead of your screen?** That's the macOS permission or Windows multi‑GPU
     issue — see the OBS troubleshooting table in §9 ("Black screen").

**Next, add your webcam (the small talking‑head box):**
5. Click **+** again → **Video Capture Device** → **OK** → in **Device** pick your webcam →
   **OK**. Your camera appears, probably filling the whole canvas.
6. **Resize + move it:** click the webcam image in the preview — a **red box with square
   handles** appears. Drag a **corner handle** inward to shrink it, then drag the middle of
   the image to park it in a **corner** (bottom‑right is the classic spot).

**Order matters (what's in front):**
7. In the **Sources** list, the item at the **top sits in front**. Make sure the **webcam
   is ABOVE the Display Capture** in the list, or your screen will cover the camera. Drag
   to reorder if needed.

**Optional — add a logo/watermark:**
8. Click **+** → **Image** → browse to a PNG → **OK**, then resize/position it (e.g. a
   corner). Keep it above Display Capture too.

> **Typical final layout:** *Display Capture* filling the frame + a small *webcam* in the
> bottom‑right (picture‑in‑picture) + (optional) a logo in a corner.
>
> **Studio Mode:** if you see **two** side‑by‑side previews (a "Preview" and a "Program"),
> Studio Mode is on — for simple teaching click the **Studio Mode** button (bottom‑right)
> to turn it **off**, so there's just one preview = exactly what goes out.

### 6.8 — Check audio levels
Speak into the mic. In the **Audio Mixer**, the **Mic/Aux** bar should bounce in the
**green‑to‑yellow** zone. A flat bar → wrong mic (redo 6.6). Hitting **red** → drag its
slider down. Make sure the **speaker icon** under the bar isn't muted (not red).

### 6.9 — Do a 20‑second test recording first (smart)
Before any real class, click **Start Recording** (~20 s) → **Stop Recording** → open the
saved file (folder shown in **Settings → Output**). Confirm you can **see screen + webcam**
and **hear your voice**. If yes, OBS is ready — for a real class you only paste the
per‑class server/key (STEP 8).

### 6.10 — OBS readiness checklist
- [ ] OBS installed; (macOS) Screen Recording + Camera + Mic permissions granted.
- [ ] **Output:** Simple mode, ~3000 Kbps, hardware encoder if available, audio 160.
- [ ] **Video:** Output (Scaled) Resolution = **1280×720**, **30** FPS.
- [ ] **Audio:** Mic set; **Sample Rate 48 kHz**.
- [ ] **Sources:** Display Capture shows your screen + webcam shrunk into a corner +
      webcam is **above** Display Capture in the list.
- [ ] **Audio Mixer** bar bounces green‑to‑yellow when you talk; speaker icon not muted.
- [ ] 20‑second test recording played back with **picture + sound**.
- [ ] Studio Mode **off** (single preview).

> ℹ️ **You do NOT need OBS for most of the testing.** OBS is only for **§G** — the real
> live‑broadcast test in `phase-9-manual-tests.md`. The other tests (**§A–§F + §H**: chat,
> raise‑hand, pin, moderation, recording replay, lobby, iOS/Android parity) run on a
> seeded demo video and need no OBS at all — so you can start those right away.

---

## STEP 7 — Send me the four values; I finish the wiring

### 7.1 — Send them (recap of §2)
Paste into our chat (Option A), filling in your real values:
```
YT_CLIENT_ID         = ...apps.googleusercontent.com
YT_CLIENT_SECRET     = GOCSPX-...
YT_REFRESH_TOKEN     = 1//0g...
INSTITUTE_CHANNEL_ID = UC...
```

### 7.2 — What I run (or you can, Option B)
I load them into Vault for project **`orqwyazvcthgxoadfxfv`** (SQL editor:
**https://supabase.com/dashboard/project/orqwyazvcthgxoadfxfv/sql/new** — but prefer
letting me do it from chat):
```sql
select vault.create_secret('PASTE_CLIENT_ID',     'YT_CLIENT_ID');
select vault.create_secret('PASTE_CLIENT_SECRET', 'YT_CLIENT_SECRET');
select vault.create_secret('PASTE_REFRESH_TOKEN', 'YT_REFRESH_TOKEN');
select vault.create_secret('PASTE_UC_CHANNEL_ID', 'INSTITUTE_CHANNEL_ID');
```

> 🔁 **Refreshing the token later** (e.g. after a 7‑day Testing expiry): the name already
> exists, so *update*, don't create:
> ```sql
> select vault.update_secret(
>   (select id from vault.secrets where name = 'YT_REFRESH_TOKEN'),
>   'NEW_REFRESH_TOKEN'
> );
> ```

### 7.3 — Redeploy (precautionary)
`yt-api.ts` reads these from Vault **live on every call**, so they take effect on the
**next** broadcast attempt — a redeploy isn't strictly required. As a clean‑slate step I
redeploy the three functions that use the credentials:
```
node scripts/stage-phase9-deploy.cjs
# copy the printed  WORKDIR=...  path, then:
npx supabase functions deploy yt-broadcast-create --workdir <WORKDIR> --project-ref orqwyazvcthgxoadfxfv
npx supabase functions deploy yt-broadcast-golive --workdir <WORKDIR> --project-ref orqwyazvcthgxoadfxfv
npx supabase functions deploy yt-broadcast-stop   --workdir <WORKDIR> --project-ref orqwyazvcthgxoadfxfv
```

### 7.4 — How we confirm it worked
- I re‑query Vault — it should now list **4** secrets.
- **On the device:** Teacher → schedule a live class → the live‑control **"Stream setup"**
  card no longer shows amber "YouTube isn't configured yet" — instead it shows a real
  **Server (RTMP URL)** + **Stream key**, each with a **Copy** button (and a **Copy Server
  + Key** button). That's the green light for the STEP 8 / §G dry‑run.

---

## STEP 8 — Going live, end to end (this *is* the §G dry‑run)

Repeat for **every** live class. Uses the **app and OBS together**. Pre‑reqs: STEPS 1–7
done (channel live‑enabled + secrets loaded) and OBS set up (STEP 6). This is exactly **§G**
in `phase-9-manual-tests.md` and closes deferred AC **2–7, 14–15, 22**.

### 8.1 — App (phone): create the class + open its stream setup
1. Sign in as **Teacher** → **Classes** tab.
2. Tap the **red broadcast (Radio) FAB** (the upper of the two floating buttons) → in the
   **"Schedule live class"** sheet pick the batch + duration → **"Set up live class"**.
3. You land on **live‑control** (header **"Setup"**). The **"Stream setup"** card now shows
   (because the secrets are loaded):
   - **Server (RTMP URL)** — e.g. `rtmp://a.rtmp.youtube.com/live2`
   - **Stream key** — a long secret string
   - **Copy** buttons on each, plus a **Copy Server + Key** button.
   > Still amber "YouTube isn't configured yet"? The secrets aren't in Vault — go to STEP 7.

### 8.2 — Get the key from the phone to the streaming computer
The app is on your **phone**; OBS is on a **computer**. To move the values across:
1. In the app tap **Copy Server + Key** (copies a labelled block with both values).
2. Paste it into a **message to yourself** — WhatsApp "Message yourself", Telegram "Saved
   Messages", or an email to yourself.
3. Open that message **on the streaming computer** and copy the two values from there.
> The stream key is single‑use per class and stops working when the class ends — but still
> keep it private; don't post it in a group.

### 8.3 — OBS: paste server + key, then Start Streaming
1. OBS → **Settings → Stream**.
2. **Service:** **"Custom…"** (most reliable — the app already gives YouTube's exact ingest
   address). *(The built‑in "YouTube - RTMPS" service also works.)*
3. **Server:** paste the **Server (RTMP URL)** from the app.
4. **Stream Key:** paste the **Stream key** from the app → **OK**.
5. Click **Start Streaming** (bottom‑right). The bottom bar turns **green** with a kbps
   reading + a **dropped‑frames** count + a **LIVE** timer = OBS is sending to YouTube.

### 8.4 — Confirm it reached YouTube
Within **~10–30 s** the broadcast goes live. Verify in **https://studio.youtube.com →
Create → (Manage broadcasts / Live)** — **Stream health** should read **"Good"** or
**"Excellent."** (The broadcast is created with **auto‑start on**, so YouTube flips it
live by itself once it sees a healthy stream.)

### 8.5 — App: tap "Go Live"
On the teacher **live‑control** screen, tap the red **"Go Live"** button. The header flips
to **"● Live now"**, the **Chat / Hands** tabs + **"End class"** appear, and the session now
shows in students' **Live** tab.

### 8.6 — Students join + you teach
A batch student opens **Classes → Live → the row** → the **wrapped player** shows **your
OBS feed** with the moving watermark (AC 5/6/7). Run chat / raise‑hand / pin / delete / ban
as in `phase-9-manual-tests.md` **§B**, now against the real stream.

### 8.7 — End the class (in this order)
1. **App:** tap red **"End class"** → confirm. This transitions the YouTube broadcast to
   **complete** and sets the session **ended** (AC 14).
2. **OBS:** click **Stop Streaming**.
3. YouTube finishes processing; the saved video becomes the **recording**: a student →
   **Classes → Recorded** can open it (same wrapped player + watermark, AC 15) and the live
   chat **replays in sync** (AC 16).
> Tap **End class in the app first** — that's what finalises the broadcast on YouTube *and*
> updates the session + recording link. (Stopping OBS first also ends it via auto‑stop, but
> the app button is the clean path.)

---

## 9. Troubleshooting (the errors people actually hit)

| Symptom | Cause | Fix |
|---|---|---|
| **`redirect_uri_mismatch`** during STEP 5 sign‑in | The redirect URI in STEP 4 isn't *exactly* `https://developers.google.com/oauthplayground` | Edit the OAuth client (STEP 4.5), fix the URI exactly (no trailing slash), save, retry. |
| **"Google hasn't verified this app"** scary screen | App is in **Testing** with sensitive scopes | Expected — click **Advanced → Go to `<your app name>` (unsafe) → Continue**. It's your own app. |
| **`access_denied`** after sign‑in | The signed‑in account isn't a **test user** | Add that exact email under STEP 3.5 (Test users), or publish the app. |
| **No `refresh_token`** in STEP 5 response | Already consented once / offline access off | Revoke at myaccount.google.com/permissions, ensure **Access type: Offline** in the gear, retry. |
| App suddenly returns **503 / "YouTube isn't configured"** after it worked | A required secret missing/empty in Vault | Re‑check `YT_CLIENT_ID` / `YT_CLIENT_SECRET` / `YT_REFRESH_TOKEN` exist (these three are mandatory). |
| Broadcast create fails with **`invalid_grant`** / OAuth refresh failed | Refresh token **expired** (7‑day Testing rule) or revoked | Re‑run **STEP 5**, then *update* the Vault secret (7.2 update snippet). |
| **403** when creating a broadcast | Channel **not yet live‑stream‑enabled** (24 h hold not elapsed) or not verified | Confirm STEPS 1.2 + 1.3 are complete and 24 h has passed. |
| Stream shows in app but **video never goes live** | OBS not streaming, or wrong server/key | Use the **exact** Server + Stream Key from the live‑control screen; click **Start Streaming**; wait ~10–30 s. |
| "You've reached your quota" | YouTube Data API daily quota (10,000 units) | Each broadcast ≈ 50 units — you'd need ~200 creates/day to hit it. Wait for the daily reset, or raise quota in Cloud console. |

### OBS‑specific issues (streaming, audio, black screen)

| Symptom | Cause | Fix |
|---|---|---|
| **Black screen** where your display should show | Screen‑capture permission (macOS) or multi‑GPU laptop (Windows) | macOS: System Settings → Privacy & Security → **Screen Recording** → enable OBS, reopen OBS. Windows: right‑click the **Display Capture** source → **Properties** → try a different **Method/Adapter**, or use **Window Capture** instead. |
| **"Failed to connect to server"** on Start Streaming | Wrong Server URL, or the key was already used / the class ended | Re‑copy **Server + Stream key** from the app's live‑control card; if reused, schedule a fresh class for a new key, paste again. |
| **Dropped frames** climbing / red "Network congestion" | Bitrate higher than your upload can sustain | Lower **Video Bitrate** to **2500** (Settings → Output). You need roughly **1.5×** your bitrate in upload speed (~5 Mbps up for 3000 Kbps). Prefer wired/ethernet. |
| **No audio** reaches students | Wrong mic, or mic muted | Settings → Audio → set **Mic/Auxiliary**; in the **Audio Mixer** confirm the bar moves and the **speaker icon** isn't muted. |
| OBS pins the **CPU at ~100%** / video stutters | Software x264 encoder is heavy | Settings → Output → **Encoder** → a **Hardware** encoder (NVENC/QuickSync/AMD/Apple VT), or lower resolution/FPS. |
| Stream looks **delayed** vs. real life | Normal YouTube live latency | Expected — there's inherent video delay; chat + raise‑hand are realtime regardless. |

---

## 10. Appendix — the four values at a glance

| Vault secret name | What it looks like | Comes from | Required by the code? |
|---|---|---|---|
| `YT_CLIENT_ID` | `123-abc.apps.googleusercontent.com` | STEP 4 | **Yes** |
| `YT_CLIENT_SECRET` | `GOCSPX-xxxxxxxxxxxx` | STEP 4 | **Yes** |
| `YT_REFRESH_TOKEN` | `1//0gXXXXXXXX…` (long) | STEP 5 | **Yes** |
| `INSTITUTE_CHANNEL_ID` | `UCxxxxxxxxxxxxxxxxxxxxxx` (24 chars) | STEP 1.4 | Optional in code, but send it — it identifies the channel and rounds out the config |

> Source of truth for "required": `apps/functions/_shared/yt-api.ts` (`loadCredentials()`
> errors only if one of the first three is missing; the channel ID is read but not
> required). The 503 "not configured" behaviour is decision **D‑195**.

### Final checklist before you tell me you're ready

- [ ] Channel **verified** (1.2) and **live‑streaming enabled** (1.3), 24 h elapsed.
- [ ] `INSTITUTE_CHANNEL_ID` copied (`UC…`).
- [ ] Cloud project created + **YouTube Data API v3 enabled** (STEP 2).
- [ ] Consent screen done, **both scopes added**, channel email a **test user** (STEP 3).
- [ ] `YT_CLIENT_ID` + `YT_CLIENT_SECRET` copied (STEP 4).
- [ ] `YT_REFRESH_TOKEN` copied from the Playground (STEP 5).
- [ ] OBS installed + a 20‑second test recording looked/sounded right (STEP 6).
- [ ] Sent me the four values (STEP 7) **or** ran the Vault SQL yourself.

---

**Bottom line:** none of this blocks the rest of Phase 9 — run manual tests **§A–§F + §H**
today. Do STEPS **1.2 + 1.3 first** to start the 24 h clocks, fill in the rest while you
wait, paste me the four values, and I'll have §G ready in minutes. For letting *teachers
use their own channels*, read **[`phase-9-youtube-own-channel.md`](./phase-9-youtube-own-channel.md)**.
