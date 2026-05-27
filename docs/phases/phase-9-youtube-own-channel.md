# Phase 9 — "Teacher's own YouTube channel" option: what publishing the OAuth app actually involves

> You asked for the dual-mode setup: when a teacher is about to stream, the app
> offers **two choices** — broadcast on the **FyneStudy channel** (already built)
> or on **the teacher's own channel**. This doc explains the *one* thing that
> gates the second choice and that **only you can do**: getting the institute's
> Google OAuth app out of "Testing" so real teachers can connect their own
> channels without their access dying every 7 days.
>
> **Read this, then tell me which operating mode you want.** I won't build the
> own-channel code until you've picked one, because the mode changes some details
> of what I build (and whether it's even usable for more than a 7-day trial).
>
> This is the companion to `phase-9-youtube-setup.md` (the FyneStudy-channel
> setup). That one still stands; this one is only about the **own-channel**
> addition.

---

## 0. The 30-second version

For a teacher to stream to **their own** channel, our backend has to talk to
YouTube **as that teacher** — which means that teacher must **authorise our app
once** (tap "Connect my YouTube", sign into their Google account, approve). That
authorisation is governed by the **publishing status of the institute's OAuth
consent screen** (the same Google Cloud project from `phase-9-youtube-setup.md`,
project `orqwyazvcthgxoadfxfv`):

- **Testing** (where it is now): only emails you hand-add as "test users" can
  connect (max 100), **and their connection breaks after 7 days** — they'd have
  to reconnect weekly. Fine for a quick trial, useless for daily teaching.
- **In production + verified**: any teacher can connect, the connection lasts
  indefinitely, no scary warning. This needs a one-time Google **verification**
  (brand review + a short demo video) — **but NOT a paid security audit**,
  because the YouTube scope we use is *sensitive*, not *restricted*.

So the real question for you is just: **Testing trial, or go through production
verification?** Everything else I handle in code.

---

## 0A. Two different "verifications" — don't mix them up

This trips everyone up. There are **two unrelated verifications** in play:

| # | Name | Where | Who does it | How often | What it unlocks |
|---|---|---|---|---|---|
| **A** | **OAuth app verification** | Google **Cloud** Console (our project) | **You, once** | One-time for the whole institute | Lets *any* teacher connect *their* channel with no 7-day expiry and no warning |
| **B** | **YouTube channel verification + live-enable** | **YouTube** (youtube.com/verify + /features) | **Each teacher**, on their own channel | Once per teacher channel | Lets that specific channel go live at all (the same 2× ~24 h waits the FyneStudy channel went through) |

This doc is about **A**. Every teacher who picks "my own channel" *also* needs
**B** done on their channel (it's the exact Steps 1.2 + 1.3 from
`phase-9-youtube-setup.md`, just on their account instead of the institute's).
There's no way around B — YouTube requires a channel to be verified +
live-enabled before it can stream, full stop.

---

## 1. The three operating modes, compared

| | **Mode 1 — Testing (trial)** | **Mode 2 — Production, unverified** | **Mode 3 — Production, verified** |
|---|---|---|---|
| Who can connect their channel | Only emails you add as test users (≤ 100) | Anyone, but capped to a limited number of users until verified | Anyone |
| Connection lifetime | **Breaks after 7 days** — reconnect weekly | Indefinite | Indefinite |
| Sign-in warning teacher sees | "Google hasn't verified this app" (click Advanced → continue) | Same warning | **None** — clean Google screen |
| What you must do | Add each teacher's email under Test users | Click "Publish app" (1 button) | Publish **+** complete Google's verification |
| Cost | Free | Free | **Free** (sensitive scope = brand review only, no paid CASA audit) |
| Google review time | None | None | A few days to ~2–3 weeks |
| Good for | A quick 1–2 teacher trial before you commit | Awkward middle ground (still warned + capped) — I don't recommend stopping here | **Real production** |

Sources for the constraints above: Google's
[Manage App Audience](https://support.google.com/cloud/answer/15549945) (7-day
testing-token expiry, 100 test users, unverified user cap + warning) and
[OAuth invalid_grant explainer](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/).

### Why it's only a "sensitive" scope (and that's good news)
Our code requests `https://www.googleapis.com/auth/youtube.force-ssl` (create &
control live broadcasts). Google classifies that as a **sensitive** scope, not a
**restricted** one. Restricted scopes (Gmail contents, full Drive, etc.) force a
paid third-party **CASA security assessment** every year. Sensitive scopes do
**not** — verification is just: a real homepage, a privacy policy, a verified
domain, and a short demo video. So Mode 3 costs **time, not money**.

---

## 2. My recommendation

- **If you just want to see the own-channel feature work** with yourself or one
  teacher in the next few days → **Mode 1 (Testing)**. Zero waiting, but you'll
  re-connect every 7 days. Perfectly fine to validate the flow.
- **For actual daily use by your teachers** → **Mode 3 (Production, verified)**.
  It's free; it just needs a homepage + privacy policy + domain + a 2-minute
  screen-recording, then a Google review. Start it early because of the review
  wait.
- **Mode 2 is a trap** — teachers still get the scary warning and you hit the
  user cap, so don't stop there; it's only the intermediate state between
  publishing and finishing verification.

You can do **Mode 1 now and Mode 3 later** — they're the same project; publishing
+ verifying it later doesn't break existing connections.

---

## 3. Mode 1 — run a 7-day trial (do this in 2 minutes)

> Use this to try the own-channel option immediately, before deciding on full
> verification.

1. Go to **https://console.cloud.google.com/apis/credentials/consent** (sign in
   with the **project account**, make sure project **`FyneStudy Live`** is
   selected top-left).
2. Make sure **Publishing status = Testing** (it already is).
3. Under **Test users** (new UI: **Audience → Test users**), click **+ Add
   users** and add **each teacher's Google email** (the account that owns the
   channel they'll stream on). Save.
4. Tell me you've done this — I'll have the "Connect my YouTube" button live.
   Each teacher taps it, signs in, approves, and can stream to their channel.
5. **Remember:** every test user must **re-connect after 7 days**. The app will
   show them a clear "Reconnect your YouTube" prompt when their token expires —
   it's not a bug, it's the Testing-mode rule.

That's the whole trial path. No homepage, no privacy policy, no review.

---

## 4. Mode 3 — publish + verify for production (the real path)

This is a sequence of clicks plus a few small assets. None of it is hard, but the
**Google review has a wait**, so kick it off early.

### 4.1 — Gather the assets you'll need (once)
| Asset | What it is | Easiest way to get it |
|---|---|---|
| **Homepage URL** | A public page describing FyneStudy | Your institute website, or a one-page site. Must be live and public. |
| **Privacy policy URL** | A public page stating what data the app uses | A standard privacy policy hosted **on the same domain** as the homepage. |
| **Verified domain** | The domain those URLs live on, proven yours | Verify it in **Google Search Console** (TXT record or HTML file) — Google links it to the Cloud project automatically. |
| **App logo** | 120×120 px PNG, no rounded corners | The FyneStudy logo. |
| **Demo video (YouTube link)** | 1–3 min screen recording | See 4.4 — record it with OBS, upload **unlisted**, paste the link. |

> If you don't have a website at all, a single static page (even a free host with
> a custom domain) satisfying homepage + privacy policy is enough. The domain
> just has to be one you can verify in Search Console.

### 4.2 — Fill in the consent screen branding
1. **https://console.cloud.google.com/apis/credentials/consent** → **Branding**
   (classic UI: "Edit App").
2. Set **App name** = `FyneStudy Live` (or your institute name), **User support
   email**, **App logo**, **Application home page** (your homepage URL),
   **Privacy policy URL**, and **Authorised domains** (the verified domain).
   Save.

### 4.3 — Confirm the scope is listed
1. **Data access** tab (classic: "Scopes") → confirm
   `https://www.googleapis.com/auth/youtube.force-ssl` is present (add it if not).
2. Google will ask you to **justify** each sensitive scope in a sentence — use
   something like: *"FyneStudy creates and controls unlisted YouTube live
   broadcasts on the signed-in teacher's channel so they can teach live classes
   inside our coaching app."*

### 4.4 — Record the demo video (this is the part people skip and get rejected for)
Google wants to *see* the OAuth consent + the scope being used. A 1–3 min
**unlisted YouTube** screen recording that shows, in order:
1. The OAuth consent screen with the **full URL bar visible** (so they can see
   the client ID / `…googleusercontent.com`).
2. A user clicking **Allow**.
3. The app then **using** the permission — i.e. the teacher creating/going live
   on their own channel from inside FyneStudy.

Narrate or caption what's happening. Paste the video link into the verification
form.

### 4.5 — Publish + submit
1. On the consent screen click **Publish app** → status becomes **In
   production**.
2. Google will prompt to **Prepare for verification / Submit for verification** —
   complete that form (it pulls in your branding, scope justification, and demo
   video).
3. Submit. You'll get email updates; respond to any follow-ups quickly. When
   approved, the warning disappears and the user cap lifts.

### 4.6 — One technical thing I need from you afterwards
When I build the in-app "Connect my YouTube" flow, I'll generate a **redirect URI**
(an edge-function callback URL on `…supabase.co`). You'll add it to the OAuth
client's **Authorised redirect URIs** (same place Step 4.5 of the setup doc added
the Playground URL). I'll give you the exact string then — it's a 30-second paste.

---

## 5. What I build once you choose (so you see the dependency)

Independent of the mode, when you green-light the feature I'll add (schema →
edge fn → mobile → UI, per our conventions):

- **`teacher_youtube_accounts` table** — stores each teacher's channel id, title,
  and refresh token, with the token column locked so only edge functions (service
  role) can read it; the app sees only "connected / not connected + channel name".
- **3 edge functions** — `yt-oauth-start` (hands back the Google consent URL),
  `yt-oauth-callback` (exchanges the code, saves the token, deep-links back),
  `yt-channel-disconnect` (revokes + forgets it).
- **`yt-api.ts` refactor** — so a broadcast can be created with *either* the
  institute token *or* a teacher's token.
- **`yt-broadcast-create/golive/stop`** — accept a `destination` and remember it
  on the session so go-live/stop use the same channel.
- **Mobile** — a **destination picker** in the Schedule-Live sheet ("FyneStudy
  channel" vs "My channel"), a **Connect my YouTube** flow + status in the
  teacher profile, and a friendly **"reconnect" prompt** when a Testing-mode
  token expires.

The **FyneStudy-channel** path stays exactly as it is today and remains the
default, so this is purely additive — nothing you've already tested changes.

---

## 6. What I need from you to move forward

Pick one and tell me:

- **"Mode 1 — trial"** → you add the teacher emails as test users (§3), I build
  the feature, you trial it (re-connecting weekly). Good for seeing it work fast.
- **"Mode 3 — production"** → you start the publish + verification (§4) in
  parallel; I build the feature so it's ready when Google approves. Best for real
  use.
- **"Not now"** → we ship Phase 9 on the FyneStudy-channel path + the new Copy
  buttons only, and revisit own-channel later.

Whatever you pick, the **FyneStudy-channel** broadcast + the new **Copy buttons**
are already done and need none of this — you can run the §G dry-run in
`phase-9-manual-tests.md` today.

---

## 7. Appendix — quick links

| Page | URL |
|---|---|
| OAuth consent screen (publish / test users / branding) | https://console.cloud.google.com/apis/credentials/consent |
| OAuth client (redirect URIs) | https://console.cloud.google.com/apis/credentials |
| Google Search Console (verify your domain) | https://search.google.com/search-console |
| Manage App Audience (testing limits, the 7-day rule) | https://support.google.com/cloud/answer/15549945 |
| OAuth verification FAQ | https://support.google.com/cloud/answer/9110914 |
| Companion: FyneStudy-channel setup | `docs/phases/phase-9-youtube-setup.md` |
