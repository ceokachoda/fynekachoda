# Open Questions, Assumptions & Recommendations

This is the **single decision log**. Every open question from the PRD has a recommended answer with rationale. When the client gives us a different answer, update the row here and the affected phase docs will already reference this page.

## 1. Assumptions made (so we could start planning)

| # | Assumption | Why | Reversible? |
|---|---|---|---|
| A1 | Single institute, single branch for MVP | Multi-tenancy is invisible at demo and adds weeks of work | Yes — add `institute_id` later |
| A2 | India-first; INR + English/Hindi UI | Client is Indian institute; Razorpay + MSG91 + Bunny India POPs chosen accordingly | Reversible at cost |
| A3 | ~500–2,000 students at launch, plan to 20k | Drives infra sizing, not architecture | Trivially |
| A4 | Students own Android phones (80%+); iOS secondary | Demo phone budget + polish ordering | UI works on both |
| A5 | Owner is non-technical | Admin panel must be self-serve | Always true |
| A6 | Live classes average ≤30 concurrent per room | Drives 100ms pricing estimate | Affects cost only |
| A7 | Recordings kept 2 years by default | Storage retention policy | Configurable |
| A8 | One active membership per student at a time | Simplifies plan model | Easy to extend |
| A9 | Teachers have moderate tech comfort | Why we build a web panel + simplified mobile scanner | Affects training, not architecture |
| A10 | Demo within ~8–10 weeks of kickoff | Phase plan sized for a single engineer; 2 engineers halves the timeline | Scales with team |
| A11 | No offline video download in MVP | Piracy risk; streaming works well enough with Bunny | Can enable later |
| A12 | Parent dashboard and multi-branch are future | Scope gate | Additive |
| A13 | Owner will handle customer support | No in-app support module at MVP | Add chat widget later |
| A14 | 100ms minute cost acceptable in ₹ thousands/month | Validates live-video vendor path | Switch to LiveKit if not |

## 2. Open questions from the PRD — with recommended answers

### Q1. Should attendance QR be static, dynamic, or time-based?

**Recommendation: Dynamic + time-based + single-use (rotating 15s JWT with replay protection).**

Why:
- Static QR = screenshot-and-share = fraud.
- Time-only without single-use = shareable within the window.
- Server-round-trip-per-refresh = bad on weak classroom WiFi.
- The chosen design: per-student HMAC secret (fetched once, cached), client signs a JWT every 15s, server-side single-use `jti` cache prevents replay within 10 min, class-window check prevents marking for other classes.

If client pushes back (e.g., "too complex"): our fallback is "time-bound QR with 60s refresh, same JTI replay protection" — still safe, marginally simpler client code.

**Decision: finalize before building Phase 3.**

### Q2. External streaming service or custom?

**Recommendation: External — 100ms.live for MVP; LiveKit Cloud (or self-hosted LiveKit) as migration target.**

Why:
- Custom RTMP/WebRTC is months of engineering; we'd own quality and infra.
- 100ms gives Mumbai POPs, React Native SDK, cloud recording, India-friendly INR billing.
- Provider-abstraction in code (`ILiveProvider`) keeps switching cost low.

**Decision: finalize before Phase 4. Alternate: LiveKit Cloud (comparable, slightly more global).**

### Q3. One-time membership vs recurring subscription?

**Recommendation: Plan-based memberships with manual renewal for MVP; recurring subscription (Razorpay mandate/UPI AutoPay) post-launch.**

Why:
- UPI AutoPay setup requires KYC + approval dance that risks slipping the demo.
- Plans (monthly/quarterly/yearly/course-wise) cover every institute pricing need the PRD mentions.
- Renewal reminders + simple re-pay flow feels natural to Indian users.

**Decision: finalize plan prices with owner before Phase 6. Subscription can be a P2 feature.**

### Q4. Should downloaded content be allowed?

**Recommendation: Allow PDFs/images to download (with watermark). Do NOT allow video download.**

Why:
- PDFs are reading material; students need them offline before exams.
- Videos are the core monetizable asset; download = piracy.
- Watermark each preview/download with the student's phone for accountability.

**Decision: finalize per-content-type toggle in admin: "allow download" boolean. Default true for PDFs/images, false for videos.**

### Q5. Clips — manually by teachers or automatically?

**Recommendation: Manually by teachers in MVP. AI auto-highlights post-launch.**

Why:
- Teacher-authored clips are higher quality and zero ML risk.
- Auto-highlights need transcripts + scoring; months of work.
- The clip workflow (mark in/out, submit) in Phase 5 is already fast.

**Decision: final.**

### Q6. Multi-branch support from day one?

**Recommendation: No. Design for it; don't build it.**

Why:
- Every table has clean FKs today. Adding `institute_id` later is a 1-day migration.
- Building multi-tenant from day one doubles the admin panel complexity.
- Client's current problem is one branch.

**Decision: final unless client contradicts.**

### Q7. Offline download mode?

**Recommendation: PDF offline = yes. Video offline = no.**

Why:
- Same reasoning as Q4.
- Offline PDF is expected and cheap (filesystem + pre-signed URL at download time).
- Offline video requires encrypted local storage, DRM, re-entry logic; high effort, high piracy risk.

**Decision: final.**

### Q8. Should live classes use external service or custom?
Duplicate of Q2 — see Q2.

## 3. Product decisions finalized here (not in PRD but implied)

| Area | Decision | Rationale |
|---|---|---|
| Frontend platform for students/teachers | React Native (Expo, dev client, TS) | PRD-preferred, practical |
| Frontend for admins | Next.js 15 web panel | Desk-workflow ergonomics |
| Backend-as-a-service | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) | Best leverage, Postgres-native |
| Live video | 100ms.live | India POPs, recording, DX |
| Video CDN | Bunny Stream | Cost + India performance |
| Payments | Razorpay | India standard |
| Push | Expo Push → FCM/APNs | Managed and simple |
| OTP | MSG91 via Supabase Auth | INR pricing |
| Analytics | PostHog | Events + funnels + session replay |
| Crash reporting | Sentry | Cross-platform |
| Invoice generation | Async PDF via HTML template | Cheap, flexible |
| Search | Postgres FTS (`tsvector`) | No separate search infra at MVP |
| Monorepo | pnpm + turbo | Minimal ceremony |
| Styling (RN) | NativeWind | Tailwind DX, perf |
| Styling (Web) | Tailwind + shadcn/ui | Professional polish fast |
| State (RN) | TanStack Query + Zustand | Right tool per state kind |

## 4. Things that must be finalized **before** coding starts

1. **Q1 QR policy** — because `issue-qr-token` design baked into Phase 3.
2. **Q2 live provider** — because 100ms account setup is first Phase 4 task.
3. **Payment provider account** — Razorpay KYC can take 3–7 days; start now regardless.
4. **Domains + branding** — app name, logo, colors, SSL certs for `app.` and `admin.` subdomains.
5. **Seed data shape** — courses, batches, subjects for the institute.
6. **Plan catalog** — names, durations, prices.
7. **Who is the owner persona during demo** — to tailor copy and navigation emphasis.

## 5. Things that can be safely deferred

- Recurring subscription with UPI AutoPay.
- Multi-branch / multi-tenant.
- Parent dashboard.
- ID-card scanning (extension of QR; uses same API).
- AI summaries, auto-clips, doubt-solving, test series.
- In-app chat / support widget.
- Coupon codes, referral codes.
- Offline video download.
- Push WhatsApp (Meta Business API).
- Gamification (streaks, badges).
- Dark mode refinements beyond the baseline.

## 6. Provisional decisions (may reverse cheaply if client input differs)

| Decision | Default | Trivially reversible? |
|---|---|---|
| Grace period after membership expiry | 7 days | Yes (single config) |
| QR rotation interval | 15s with 20s exp | Yes |
| Watch position sync interval | 10s | Yes |
| Signed URL TTL (video) | 1 hour | Yes |
| Signed URL TTL (material) | 10 minutes | Yes |
| Max concurrent students per live room | 60 | Yes (100ms config) |
| Default recording quality | 720p | Yes |
| Teacher upload requires admin approval | Yes, toggle in admin settings | Yes |
| Language default | English with Hindi toggle | Yes |
| Notification opt-outs | All on by default | Yes |
| Audit log retention | 7 years | Yes |

## 7. Questions to ask the client at kickoff

1. Confirm plan prices and durations for at least 3 plans (monthly/quarterly/yearly).
2. Confirm recording retention comfort: 2 years default, longer if required.
3. Confirm a demo batch size (helps seed realistic data).
4. Logo/brand assets, primary color, font preference.
5. Who will be the admin during demo (owner, office manager)?
6. Razorpay merchant KYC status — is their business ready to accept payments live?
7. Preferred demo device (we'll target that exact model).
8. Acceptable demo date/time window (affects our Phase schedule).
9. Which subjects and batches exist today so we can seed.
10. Does the institute need multiple classroom locations tracked (Phase 2+) or is one site enough for demo?

## 8. Change management process

Any future change to these decisions must:
1. Be recorded in this file (replace or append with date + reason).
2. Cross-reference every phase doc that depends on it.
3. Produce a delta PR rather than editing history — so past decisions stay auditable.
