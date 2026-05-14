# External Setup Timeline

> Time-sensitive setups that have **multi-day lead times**. Several should be started in parallel with Phase 1 so they don't block later phases. The phase docs link back here.

---

## Why this exists

Some required external accounts and approvals take days, not minutes. If you wait until the phase that needs them, that phase blocks. This doc lists each external, its lead time, where to start, and which phase consumes it.

## Quick map (start NOW or you'll block)

| Setup | Lead time | Needed by | Start before |
|---|---|---|---|
| Domain (`fynestudy.<tld>`) | minutes | Phase 1 | Day 1 |
| Supabase organization + dev project | minutes | Phase 1 | Day 1 |
| Supabase prod project | minutes | Phase 12 | Phase 11 |
| Sentry account + 2 projects | minutes | Phase 1 | Day 1 |
| PostHog account | minutes | Phase 1 | Day 1 |
| Vercel + GitHub link | minutes | Phase 1 | Day 1 |
| Expo / EAS account | minutes | Phase 1 | Day 1 |
| **YouTube channel + verification** | **24h hold after first verify** | Phase 5, Phase 9 | Day 1 |
| **YouTube live streaming enabled** | another 24h hold; separate enable | Phase 9 | Phase 1 |
| **YouTube OAuth client + refresh token** | hours (manual flow) | Phase 9 | Phase 7 |
| **Gupshup WhatsApp Business account** | days for verification | Phase 11 | Phase 2 |
| **Gupshup template approval** | 1–3 business days per template | Phase 11 | Phase 5 |
| **Apple Developer Program** ($99/yr) | enrollment + 1–3 days approval | Phase 12 (store submit) | Phase 7 |
| **Google Play Console** ($25 one-time) | minutes | Phase 12 | Phase 9 |
| OBS Studio (teacher's machine) | minutes | Phase 9 | Phase 8 |

---

## Detailed instructions

### 1. Domain

- Buy `fynestudy.<tld>` (recommended `.in` for India brand).
- Set up two A/CNAME records ready to point later: `admin.fynestudy.<tld>` (admin panel on Vercel) and optionally `app.fynestudy.<tld>` (app store landing page).
- DNS provider: Namecheap, GoDaddy, Cloudflare — any.

### 2. Supabase organization + projects

- Create org "fynstudy".
- Create `fynestudy-dev` (region `ap-south-1`).
- Save: project URL, anon key, service-role key.
- Create `fynestudy-prod` (same region) — leave empty for now; Phase 12 cuts over.
- Enable PITR on prod project (small monthly cost; turn on at Phase 12 cutover).

### 3. Sentry

- Create org.
- Two projects: `fynestudy-mobile` (React Native), `fynestudy-admin` (Next.js).
- Save: DSNs for each, auth token for source-map upload.
- Defer alert-rule setup to Phase 12.

### 4. PostHog

- Create org. One project: `fynestudy`.
- Save: client key + host URL.
- Free tier covers MVP-scale events.

### 5. Vercel + GitHub

- Link Vercel to your GitHub.
- Don't import the repo yet — Phase 1 creates `apps/admin/` and then imports.

### 6. Expo / EAS

- Create Expo account.
- `npm i -g eas-cli` locally.
- `eas login`.

### 7. YouTube channel (CRITICAL — start day 1)

**Step 7a: Create the channel**
- Use a dedicated Google account for the institute (not a personal account).
- Create the channel (yt.com/account → "Create a channel for [Institute Name]").
- Save the **Channel ID** (`UC...` format) — needed for verification later.

**Step 7b: Verify the channel** (24h hold)
- YT Studio → Settings → Channel → Feature eligibility → Verify your phone number.
- This enables features like longer uploads. Required for live streaming.

**Step 7c: Enable Live Streaming** (separate 24h hold)
- YT Studio → "Go Live" → first-time enable.
- Says "wait 24 hours". Plan accordingly.

**Step 7d: Manually test a live broadcast end-to-end via YT Studio + OBS** before Phase 9 starts — confirms channel health and your OBS setup works.

### 8. YouTube OAuth client + refresh token (for Phase 9)

Phase 9's `yt-broadcast-create` edge function needs a **refresh token** to call the YouTube Data API on the institute's behalf. One-time setup:

**Step 8a: Cloud project**
- console.cloud.google.com → create project "fynestudy".
- Enable APIs: **YouTube Data API v3**.

**Step 8b: OAuth consent screen**
- APIs & Services → OAuth consent screen → "External" (or "Internal" if you have Google Workspace).
- App name: "FyneStudy".
- Scopes:
  - `https://www.googleapis.com/auth/youtube`
  - `https://www.googleapis.com/auth/youtube.force-ssl`
- Add the institute Google account as a test user.

**Step 8c: Create OAuth Client ID**
- APIs & Services → Credentials → Create Credentials → OAuth Client ID.
- Application type: **Web application**.
- Authorized redirect URIs: `https://developers.google.com/oauthplayground` (using the playground to get the token).
- Save: **Client ID**, **Client Secret**.

**Step 8d: Obtain refresh token via OAuth Playground**
1. Visit https://developers.google.com/oauthplayground.
2. Click the gear icon (top right) → check "Use your own OAuth credentials" → paste Client ID + Client Secret.
3. Step 1: scroll to "YouTube Data API v3 v3" → select both scopes from step 8b → click "Authorize APIs".
4. Sign in with the institute Google account → consent.
5. Step 2: click "Exchange authorization code for tokens".
6. Save the **refresh_token** value. This is the long-lived credential.

**Step 8e: Store in Supabase Vault** (during Phase 9)
- `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, `INSTITUTE_CHANNEL_ID`.

**If the refresh token is ever revoked** (user revokes app access, password change, 6 months unused), re-do steps 8d → 8e.

### 9. YouTube API key (for Phase 5)

Phase 5's `content-create-video` verifies a pasted YT URL belongs to the institute channel. This uses an **API key**, not OAuth — simpler.

- APIs & Services → Credentials → Create Credentials → API key.
- Restrict to YouTube Data API v3 only.
- Save: `YT_API_KEY`. Add to Supabase Vault during Phase 5.

(Unlisted videos ARE returned by `videos.list` with API key when you have the ID, so this works without OAuth.)

### 10. Gupshup WhatsApp Business (start during Phase 2)

**Step 10a: Account**
- gupshup.io → sign up.
- Apply for WhatsApp Business API access.
- They'll ask for: business name, GST/registration, business category, sample message use cases.

**Step 10b: Phone number**
- Provision a dedicated phone number (cannot be one already on WhatsApp).
- ~$5–10/month for the number.

**Step 10c: Display name approval**
- Submit a business display name (shown to recipients).
- Takes 1–3 business days.

**Step 10d: Template submission** (start during Phase 5)
Submit these templates for approval:

1. `parent_weekly_report` — Category: UTILITY
   ```
   Namaste, {{1}}'s weekly progress report from FyneStudy is here.
   Period: {{2}}
   Attendance this week: {{3}}
   Download PDF: {{4}}
   This link expires in 24 hours.
   ```

2. `student_credentials_initial` — Category: UTILITY
   ```
   Welcome to FyneStudy, {{1}}.
   Login email: {{2}}
   Initial password: {{3}}
   You'll be asked to change this on first login.
   ```

Each takes 1–3 business days.

**Step 10e: Webhook setup**
- After approval, register webhook URL: `https://<vercel-prod-domain>/api/webhooks/gupshup`.
- Save: webhook secret (used to verify HMAC signature).

### 11. Apple Developer Program (start during Phase 7 if you want iOS at launch)

- developer.apple.com → enroll.
- $99/year.
- Identity verification can take 1–3 days.
- After enrollment: create App ID `com.fynestudy.app`, App Store Connect entry.
- TestFlight first; production review takes ~24–48h per submission.

### 12. Google Play Console (start during Phase 9)

- play.google.com/console → enroll.
- $25 one-time.
- Pre-launch report review takes minutes.
- Internal testing → closed testing → production.

### 13. OBS Studio (teacher's machine, before Phase 9 dry run)

- obsproject.com — free, open-source.
- Install on the teacher's laptop.
- Create a profile with:
  - Server: YT-supplied RTMP URL (from edge fn response).
  - Stream Key: YT-supplied stream key.
  - Output: 720p @ 30fps, bitrate ~2500–4000 Kbps.
- Source: camera + screen capture (teacher's preference).
- 2-min onboarding video should be recorded for teachers.

---

## Recommended parallel-track schedule

```
Phase 1                Phase 2-3           Phase 4-7           Phase 8-9          Phase 10-12
─────────              ──────────          ──────────          ──────────         ────────────
Domain ✓               Gupshup signup      YT OAuth refresh    OBS install        Apple Dev
Supabase dev ✓         Apple Dev (start)   token (step 8)      on teacher box     final review
Sentry ✓               YT channel          Gupshup templates   Live class dry     Google Play
PostHog ✓              verified            submitted           run                final review
Vercel ✓               YT live enabled
EAS ✓
YT channel created
YT API key (step 9)
```

---

## What goes in Supabase Vault (track this carefully)

By the end of Phase 12:

| Secret | First used | Source |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 1 | Supabase project settings |
| `QR_TOKEN_SECRET_V1` | Phase 4 | Generated (32-byte) |
| `PLAYBACK_SIGN_SECRET_V1` | Phase 5 | Generated (32-byte) |
| `YT_API_KEY` | Phase 5 | Google Cloud Console |
| `YT_CLIENT_ID` | Phase 9 | Google Cloud Console |
| `YT_CLIENT_SECRET` | Phase 9 | Google Cloud Console |
| `YT_REFRESH_TOKEN` | Phase 9 | OAuth Playground (step 8d) |
| `INSTITUTE_CHANNEL_ID` | Phase 9 | YT channel settings |
| `GUPSHUP_API_KEY` | Phase 11 | Gupshup dashboard |
| `GUPSHUP_APP_NAME` | Phase 11 | Gupshup dashboard |
| `GUPSHUP_WEBHOOK_SECRET` | Phase 11 | Gupshup webhook config |
| `RESEND_API_KEY` (optional) | Phase 11 | Resend dashboard |

Rotation: quarterly (`*_SECRET` items). Externals (`YT_*`, `GUPSHUP_*`) only on compromise or expiry.

---

## What I CANNOT do for you

These all require human-in-the-loop with corporate identity, payment methods, and external review:

- Buy domain
- Verify YT phone (SMS to your phone)
- Complete OAuth consent + Playground flow (your Google account login)
- Apply for Gupshup WhatsApp Business (your business identity)
- Enroll Apple Developer (your DUNS / identity verification)
- Pay for Apple Developer + Play Console
- Approve Gupshup templates (Meta reviews)

If you want, when you start Phase 1 I can pause at Checkpoint 1 and remind you to verify each external setup is in motion.
