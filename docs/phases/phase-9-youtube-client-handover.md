# Phase 9 — Hand the live-streaming over to the CLIENT's YouTube account

> **What this doc is for.** Right now all live classes broadcast through **"NOvA FX"** —
> *your personal* YouTube account, which you used to get streaming working. When you hand
> the product to the client (the institute owner), you want every live class to broadcast
> on **the client's own YouTube account** instead, and your personal account fully
> disconnected. This doc is the **complete, step‑by‑step** for that switch.
>
> **This is NOT the same as** `phase-9-youtube-own-channel.md`. That other doc is an
> optional future feature where *individual teachers* each stream on *their own* channels.
> **This** doc is about the single **institute channel** changing owner: from you → the
> client. For a normal institute, this doc is what you want.

---

## 0. The one idea that makes this simple

The app broadcasts on **whichever YouTube channel the `YT_REFRESH_TOKEN` in Vault belongs
to.** Nothing in the app code knows or cares *whose* channel it is. So "switch to the
client's channel" always boils down to:

> **Mint a new refresh token while signed in as the CLIENT's channel, then update two Vault
> secrets** (`YT_REFRESH_TOKEN` + `INSTITUTE_CHANNEL_ID`). That's the whole switch.

The only real decision is **how much you also hand over** (just the token, or the entire
Google Cloud project too) — see §2.

### Where things stand today (so you know what's changing)
| Vault secret | Today points to | After handover |
|---|---|---|
| `YT_REFRESH_TOKEN` | NOvA FX (yours) | **client's channel** |
| `INSTITUTE_CHANNEL_ID` | `UCSa8awrJseI_8r_oZQjuvYQ` (NOvA FX) | **client's `UC…`** |
| `YT_CLIENT_ID` / `YT_CLIENT_SECRET` | your Google Cloud project | yours *or* client's (§2) |
| `YT_DATA_API_KEY` | your Google Cloud project | yours *or* client's (§2) |

---

## 1. STEP 1 — Set up the CLIENT's YouTube channel (on the CLIENT's Google account)

Exactly the same as the original `phase-9-youtube-setup.md` STEP 1, but done on **the
client's** Google account. **It has two ~24‑hour holds — start it days before the actual
handover.**

1. Sign into **https://www.youtube.com** as the **client's institute Google account**. If
   there's no channel yet: profile picture (top‑right) → **Create a channel** → name it →
   confirm.
2. **Verify it (phone):** **https://www.youtube.com/verify** → country → SMS code →
   **Verified**. *(starts a ~24 h clock)*
3. **Enable live streaming:** **https://www.youtube.com/features** → **Live streaming →
   Enable**. *(starts a second ~24 h clock — note the date/time it says you'll be eligible)*
4. **Copy the Channel ID:** **https://studio.youtube.com → Settings (⚙) → Channel →
   Advanced settings → Channel ID** (`UC…`, 24 chars). Save it — it becomes the new
   `INSTITUTE_CHANNEL_ID`.

> ⚠ Until **both** 24 h holds elapse on the **client's** channel, broadcasts 403 even with a
> perfect token — exactly like your channel did at first.

---

## 2. STEP 2 — Choose how much to hand over

| | **Option A — Quick re‑point** | **Option B — Full handover (recommended for a real handover)** |
|---|---|---|
| Who owns the Google Cloud project / OAuth app / API key | **You** (your existing "youtube‑integration‑v1" project) | **The client** (their own project) |
| Vault secrets that change | only `YT_REFRESH_TOKEN` + `INSTITUTE_CHANNEL_ID` | **all 5** secrets |
| Effort | ~5 min | ~20 min (redo setup STEPS 2–5 on the client's account) |
| Is the client independent of *your* Google account afterwards? | ❌ No — their streaming relies on your project staying alive + within quota | ✅ Yes — clean break, you can walk away |
| Pick this if… | you'll keep maintaining it for them | you're truly handing the product off |

Do **§3 (Option A)** *or* **§4 (Option B)**, then the common steps §5–§7.

---

## 3. Option A — Quick re‑point (keep your OAuth app, just change the channel)

1. **Make sure the client's account is allowed to consent.** Your OAuth app is already
   **Published / "In production"** (you did this), so **any** Google account can consent —
   nothing to do here. *(If it were still in "Testing," you'd add the client's email under
   Google Auth Platform → Audience → Test users.)*
2. **Mint a token signed in as the client.** Open
   **https://developers.google.com/oauthplayground** → gear ⚙ → **Access type = Offline**,
   **Force prompt = Consent Screen**, tick **"Use your own OAuth credentials"** and paste
   **your** Client ID + Secret (the same ones already in Vault) → Close.
3. Left side → "Input your own scopes" → paste
   `https://www.googleapis.com/auth/youtube.force-ssl` → **Authorize APIs**.
4. **Sign in as the CLIENT's channel account** (NOT NOvA FX) → "Google hasn't verified this
   app" → **Advanced → Continue → Allow**.
5. **Step 2 → Exchange authorization code for tokens** → copy the new **`refresh_token`**.
   (Because the app is published, this token is **permanent** — the response won't show
   `refresh_token_expires_in`.)
6. Give me the new **refresh token** + the **client's Channel ID** (from STEP 1.4). Go to §5.

---

## 4. Option B — Full handover (client owns everything)

Do all of `phase-9-youtube-setup.md` **on the client's Google account(s)**:

1. **STEP 2** — client creates their own **Google Cloud project** → enable **YouTube Data
   API v3**.
2. **STEP 3** — client configures the **consent screen** (App Information → Audience →
   Contact → Finish), adds the two scopes under **Data access**
   (`…/auth/youtube` + `…/auth/youtube.force-ssl`), and **Publishes the app** (Audience →
   Publish app → Confirm) so their token never expires. *(Ignore the "verification
   required" banner — same as you did.)*
3. **STEP 4** — client creates an **OAuth Client ID + Secret** (redirect URI exactly
   `https://developers.google.com/oauthplayground`).
4. **STEP 5** — mint the **refresh token**, signed in as the client's channel.
5. *(Optional, matches the original)* client creates a **YouTube Data API key** for
   `YT_DATA_API_KEY`.
6. Give me **all five** new values. Go to §5.

> You (the operator) can sit at the client's machine and do all of this on their accounts
> during handover — the client doesn't need to be technical.

---

## 5. STEP 3 — Hand me the values; I update Vault

Same safety rule as always: **never put these in a repo file.** Paste them to me in chat,
or run the SQL yourself in the Supabase SQL editor. No redeploy needed (the code reads
Vault live).

**Option A (2 secrets):**
```sql
select vault.update_secret((select id from vault.secrets where name='YT_REFRESH_TOKEN'),     'CLIENT_REFRESH_TOKEN');
select vault.update_secret((select id from vault.secrets where name='INSTITUTE_CHANNEL_ID'), 'CLIENT_UC_CHANNEL_ID');
```

**Option B (all 5):**
```sql
select vault.update_secret((select id from vault.secrets where name='YT_CLIENT_ID'),         'CLIENT_CLIENT_ID');
select vault.update_secret((select id from vault.secrets where name='YT_CLIENT_SECRET'),     'CLIENT_CLIENT_SECRET');
select vault.update_secret((select id from vault.secrets where name='YT_REFRESH_TOKEN'),     'CLIENT_REFRESH_TOKEN');
select vault.update_secret((select id from vault.secrets where name='INSTITUTE_CHANNEL_ID'), 'CLIENT_UC_CHANNEL_ID');
select vault.update_secret((select id from vault.secrets where name='YT_DATA_API_KEY'),      'CLIENT_API_KEY');
```

---

## 6. STEP 4 — Verify the switch

After Vault is updated, I run the same check I ran for NOvA FX — exchange the refresh token
and read which channel it controls. **Success =** the channel id comes back as the
**client's** `UC…` and `liveBroadcasts.list` returns 200 (client's channel is live‑enabled).
I'll paste you the result. Then, in the app: Teacher → schedule a live class → the "Stream
setup" card shows a real key, and the broadcast now lands on the **client's** channel.

---

## 7. STEP 5 — Disconnect your personal NOvA FX account (cleanup)

So nothing of yours is left wired in:
1. Sign into the **NOvA FX** Google account → **https://myaccount.google.com/permissions**.
2. Find the app (your OAuth app's name) → **Remove access**. This kills NOvA FX's old
   refresh token for good.
3. *(Option B only — if you also moved the Cloud project)* after confirming the client's
   setup works (§6), you may delete your old project at **console.cloud.google.com → IAM &
   Admin → Settings → Shut down**.

---

## 8. Handover checklist

- [ ] Client's channel **verified** + **live‑streaming enabled**, both 24 h elapsed (§1).
- [ ] Client's **Channel ID** copied (`UC…`).
- [ ] (Option B) Client's **Cloud project + API + consent screen published + OAuth client
      + API key** created.
- [ ] New **refresh token** minted **signed in as the client's channel**.
- [ ] Vault updated — 2 secrets (Option A) or 5 (Option B). I'll do it from your chat.
- [ ] Verified: token controls the **client's** channel + it's live‑enabled (§6).
- [ ] **NOvA FX access revoked** (§7).
- [ ] In the app: schedule a class → real key → an OBS test streams to the **client's**
      channel.

---

## 9. Which doc for what

| You want to… | Doc |
|---|---|
| First‑time YouTube + OBS setup (A‑Z) | `phase-9-youtube-setup.md` |
| Move the institute channel from your account to the client's | **this doc** |
| Let individual *teachers* stream on their *own* channels | `phase-9-youtube-own-channel.md` |
| Run the on‑device / OBS manual tests | `phase-9-manual-tests.md` |
