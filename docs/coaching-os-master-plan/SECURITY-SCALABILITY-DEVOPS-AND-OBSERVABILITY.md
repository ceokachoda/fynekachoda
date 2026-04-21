# Security, Scalability, DevOps & Observability

## 1. Security posture

### 1.1 Threat model (concise)

| Threat | Attack vector | Defense |
|---|---|---|
| Attendance fraud | Friend scans a screenshot | Rotating 15s JWT + single-use JTI + class window |
| Paid-content leakage | Student shares URL | Short-lived signed URLs + per-request authorization |
| Account takeover | Phone-number SIM swap | OTP throttled; admin action required for phone change |
| Data exfil by employee | Teacher reads another batch | RLS policies; audit log on admin reads |
| Webhook replay/forgery | External API imitation | HMAC verify + event-id idempotency + 5-min freshness |
| Credential theft from device | Stolen phone | SecureStore/Keystore; session invalidation on admin "suspend" |
| DDoS on Edge Functions | Abuse of public endpoints | Per-key rate limiting + Cloudflare in front of Supabase |
| SQL injection | Malicious admin CSV | Parameterized queries only; CSV parser sanitizes |
| PII in logs | Dev leaving debug prints | Sentry `beforeSend` scrubbing; PR review checklist |

### 1.2 Auth hardening

- Phone OTP: 5 attempts/hour/phone; lockout 30 min after 10 failed attempts.
- Admin/teacher passwords: `zxcvbn` score ≥3; rotation encouraged annually.
- Session refresh rotation (Supabase default).
- Admin MFA (TOTP) added post-launch if client requires; scaffolded via Supabase MFA.
- No password stored anywhere in the app; always fetched via Supabase Auth API.

### 1.3 Data protection

- All Supabase data transit via TLS.
- At-rest encryption (Supabase default).
- PII columns (`phone`, `email`) indexed but never exposed in public views.
- Search indexes exclude PII.
- Sentry scrubbers drop `phone`, `email`, `payload`, `Authorization`.
- Analytics sends `user_id` only; no names/phones.

### 1.4 QR anti-fraud (full detail)

- Per-student HMAC secret stored server-side.
- Client signs JWT with 20s expiry.
- Scanner validates: signature, `exp`, `jti` not in 10-min cache, class window, enrollment, membership (optional for attendance per PRD).
- Scanner is role-gated; only teachers/admins can call `consume-qr-token`.
- Screen capture discouraged via `expo-screen-capture` (Android only).
- Clock-skew handled with ±30s tolerance and hint shown to students after repeated failures.

### 1.5 Secure media access

- Paid content only reachable via Edge-Function-issued signed URLs.
- Bunny Stream token auth with per-request token scoped by student id (so even if a URL is shared, a log shows which student generated it).
- PDFs watermarked with the student phone number in low-opacity diagonal overlay to discourage sharing.
- Video URLs expire in 1 hour; refreshing requires re-authorizing.

### 1.6 Rate limiting / abuse prevention

- Per-endpoint rate limit table (SQL counter + Edge Function check). Thresholds in `API-DESIGN-AND-SERVICE-BOUNDARIES.md` §1.
- Global DDoS: Supabase is behind Cloudflare by default; can add WAF rules if we see abuse.
- OTP abuse: throttle per phone + IP.

### 1.7 Secrets management

- All secrets in Supabase project secrets and EAS secrets.
- Never in source; `.env.example` only.
- Rotation runbook: Razorpay webhook secret, 100ms app secret, Bunny API key, Expo token quarterly.

### 1.8 Code security

- Dependabot / Renovate bot weekly for dep bumps.
- `pnpm audit` in CI; fails on high severity.
- GitHub Actions secrets never echoed.
- Protected branches: `main` requires PR + review + green CI.

### 1.9 Client-side security

- Deep links validated to known routes.
- Intent filters locked to our app package on Android.
- Android: `FLAG_SECURE` on QR + gated content screens.
- iOS: no screenshot blocking available; accept.
- Obfuscation via Hermes bytecode (default) + R8/ProGuard.

## 2. Scalability path

### 2.1 MVP → small growth (<5k students)
- Supabase Pro tier.
- Single region (Mumbai).
- 100ms pay-as-you-go.
- Bunny Stream pay-per-GB.

### 2.2 Mid scale (5k–20k)
- Supabase dedicated compute (2-core → 4-core as needed).
- Enable PgBouncer pooled mode for Edge Functions (already defaults).
- Add read replicas for admin analytics views.
- Move heavy analytics (PostHog + BI) off Postgres by exporting via Supabase pg_net to a warehouse (ClickHouse / BigQuery free tier).
- Bunny signed URL pre-batching (generate URLs in SSR for admin panel to avoid burst at class end).

### 2.3 Large scale (20k+) / multi-institute
- Multi-tenancy: add `institute_id` column, extend RLS, or provision one Supabase project per institute (preferred for data sovereignty).
- Consider LiveKit self-host on Hetzner India for lower per-minute cost.
- CDN signed URLs batched at job level.
- Separate workers (Node) for transcode retries if pgmq proves noisy.

### 2.4 Bottleneck tracking

| Metric | Alert threshold | Action |
|---|---|---|
| Postgres CPU | >70% for 10 min | Upsize compute |
| Postgres connection count | >80% of pool | Investigate leaky Edge Functions |
| Edge Function p95 latency | >1s | Profile; add caching |
| Storage bandwidth | >50% of plan | Upgrade plan |
| 100ms minutes | >₹50k/month | Evaluate LiveKit migration |
| Bunny transfer | >1TB/month | Move archives to cold storage |
| Notification queue depth | >500 rows >5 min old | Scale fanout or check Expo status |

## 3. Environments

| Env | URL (example) | DB | Purpose |
|---|---|---|---|
| Local | `localhost` | `supabase start` | Dev |
| Dev | `dev.fynestudy.live` | coachos-dev | PR previews, staging of new features |
| Staging | `staging.fynestudy.live` | coachos-staging | Pre-prod verification; mirrors prod |
| Prod | `app.fynestudy.live` | coachos-prod | Live traffic |

Mobile builds:
- `dev` build profile → dev Supabase + dev Razorpay + test 100ms.
- `preview` → staging.
- `production` → prod.

## 4. CI/CD

### 4.1 CI (GitHub Actions)

Pipelines:
- **lint** (pnpm lint): eslint + prettier + tsc across all packages.
- **unit**: vitest, deno test, pgTAP against ephemeral Postgres.
- **build-mobile**: `eas build --platform android --profile preview --non-interactive` on PRs.
- **build-admin**: `pnpm --filter admin build`.
- **e2e-admin**: playwright smoke against a staging preview (nightly).
- **e2e-mobile**: Maestro against an Android emulator (nightly).
- **security**: `pnpm audit`, Gitleaks for secret scanning.
- **db**: `supabase db lint` + RLS test suite.

PR gating: lint + unit + db + security + build-mobile must pass. E2E runs nightly to avoid flakiness blocking merges.

### 4.2 CD

- **Admin panel**: Vercel auto-deploys on push to `main` → staging; prod deploy triggered from GitHub Release tag.
- **Supabase migrations**: `supabase db push` step in GitHub Actions when files in `supabase/migrations/**` change and target is `main` → first staging, then prod after manual approval.
- **Edge Functions**: `supabase functions deploy` per-function on path-based changes.
- **Mobile OTA**: `eas update --branch prod` triggered from Release tag.
- **Mobile store**: `eas submit` manual (monthly cadence for binary updates; OTA handles most).

### 4.3 Release management

- Semantic version on `main`: `v<MAJOR>.<MINOR>.<PATCH>`.
- Every OTA tagged in Sentry releases (automatic via `@sentry/react-native` + EAS hook).
- Release notes in `CHANGELOG.md` generated from Conventional Commits.

## 5. Monitoring & logging

### 5.1 Sentry

- RN: crashes + performance + release health.
- Next.js: server + client errors.
- Edge Functions: wrap handlers in `Sentry.withScope`.
- Alert rules: new issue on prod → Slack; spike in error count → Slack; crash-free sessions <99% → Slack.

### 5.2 Supabase logs

- Log drains forwarded to Logflare.
- Daily sampling dashboard: slowest queries, top error codes, RLS policy denials.

### 5.3 PostHog

- Product analytics (Phase 8).
- Session replay gated behind feature flag; disabled by default in prod for privacy.

### 5.4 Uptime / synthetic

- A cron-driven Edge Function `health` returns DB + storage + external-provider status.
- UptimeRobot or BetterStack pings `health` every minute.
- Dashboard visible to owner.

### 5.5 Alerts
| Signal | Severity | Channel |
|---|---|---|
| Prod crash-free sessions <99% (24h) | P1 | Slack + email |
| Sentry new P1 issue | P1 | Slack |
| Supabase DB CPU >80% for 15 min | P1 | Slack |
| Notification queue stale >5 min | P2 | Slack |
| Recording pipeline stalled >1 hr | P2 | Slack |
| Payment verification failures >5/hr | P1 | Slack |
| RLS denial spike | P3 | Weekly digest |

## 6. Backup & recovery

- Supabase PITR on Pro (7-day rolling).
- Nightly `pg_dump` to S3 bucket outside Supabase (separate cloud account).
- Supabase Storage snapshots via bucket versioning (where supported).
- Monthly DR drill documented in `docs/ops/DR-DRILL.md`.

Recovery targets (first 12 months):
- RPO (acceptable data loss) ≤ 24 hours (nightly backup). Real RPO is closer to PITR (near-zero) in practice.
- RTO (time to restore) ≤ 4 hours.

## 7. Incident response

1. On-call engineer acknowledges Slack alert within 15 min (business hours) or 1 hr (off-hours).
2. Follow runbook in `docs/ops/RUNBOOKS/<topic>.md`.
3. If user-facing, post status to `status.fynestudy.live` (static page hosted on Vercel).
4. Post-mortem within 5 business days using `docs/ops/POSTMORTEM-TEMPLATE.md`.

## 8. Compliance & policies

- India IT Act compliance for user data (retention, breach notification).
- Privacy Policy + Terms of Service published before launch.
- Account deletion endpoint live (required on Play Store).
- Razorpay PCI compliance inherited (we never see card numbers).
- Age gate: per product direction, students 15+; under-18 users require parental consent prompt on signup (post-launch flag).

## 9. Access control for the team

- Supabase: admin invites only; principle of least privilege.
- GitHub: protected `main`; CODEOWNERS on security-sensitive dirs.
- Vercel: role-based access.
- Razorpay dashboard: 2FA required; merchant admin only.
- 100ms / Bunny: team accounts; no shared passwords.

## 10. Cost controls

- Billing alerts on every provider (Supabase, 100ms, Bunny, Razorpay, PostHog, Sentry).
- Cap: Bunny cache-policy tuned to maximize cache hits (classes replay a lot).
- Cap: 100ms rooms auto-end after scheduled + duration + 30 min (safety net).
- Cap: storage cleanup jobs prune raw recordings after 30 days.

## 11. Performance budgets

| Surface | Metric | Budget |
|---|---|---|
| Mobile cold start | Time-to-dashboard | <2.5s on 4 GB Android |
| Mobile route nav | Perceived | <200 ms |
| Live class join | Time-to-video | <3s on 4G |
| Recording first frame | TTFB | <2s |
| Admin dashboard LCP | Desktop | <2.0s |
| Admin table load (500 rows) | Render | <500 ms after data |
| Edge Function p95 latency | Critical (QR, live token) | <400 ms |

CI fails a PR if a performance test regresses >15% vs main.

## 12. Future considerations

- Multi-region (Singapore DR) once there's revenue to justify.
- WAF + CDN for admin domain.
- SOC 2 / ISO 27001 only if we expand to enterprise clients.
- Bug bounty once the user base is large enough to attract attention.
