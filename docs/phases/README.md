# Phases — Roadmap & Kickoff Prompts

> 12 phases from current state (Phase 1 UI scaffolded, no backend) to production-ready coaching OS. Each phase is a **vertical slice** — backend + frontend together — designed to be testable end-to-end before moving on. After every phase: user tests, reviews, accepts → only then does the next phase begin.

> ⚠️ **Before starting Phase 1, read [`docs/external-setup-timeline.md`](../external-setup-timeline.md).** Several external accounts (YouTube channel verification, Gupshup WhatsApp Business, Apple Developer Program, OAuth refresh tokens) have multi-day lead times. They must be started in parallel with code work or they will block later phases.

---

## Rules of engagement

1. **One phase at a time.** Don't combine. Don't skip.
2. **Every phase ends green.** Lint, typecheck, tests all pass. CI green on the phase branch.
3. **Every phase is reviewable.** The Acceptance Criteria are listed in each phase doc; all must pass before next phase begins.
4. **Rollback plan exists.** Every phase doc has one. If something breaks, we revert before fixing — `main` is never left half-broken.
5. **Specs are the contract.** Phase docs implement specs. If implementation drifts, update the spec (and `docs/decisions.md` if it's a new decision) — don't leave the spec stale.
6. **Existing frontend is edited in-place.** Every phase's "Frontend → files edited / deleted" section is explicit about what's touched. No silent churn.
7. **No combining "for efficiency."** Better to ship 12 clean increments than 6 muddy ones.

## Phase index

| # | Title | Primary outcome | Test command(s) |
|---|---|---|---|
| 1 | Foundation & Infrastructure | Workspace + Supabase + CI live; mobile + admin connect to dev backend | `pnpm typecheck`, `pnpm dev:mobile`, visit admin Vercel preview |
| 2 | Identity & Authentication | Admin creates user → user logs in mobile with forced password change | `pnpm test:rls`, manual flow per `phase-2.md §AC` |
| 3 | Courses, Batches, Curriculum | Admin builds course tree + batches + assigns teacher + adds student | Manual flow per `phase-3.md §AC` |
| 4 | Sessions & Attendance | QR + manual roster end-to-end; corrections audited | Manual flow per `phase-4.md §AC` |
| 5 | Study Materials Library | Wrapped YT video + watermarked PDF + library tree | Manual flow per `phase-5.md §AC` |
| 6 | Practice Quizzes | Author quiz → student attempts → solution view with explanation + linked video | Manual flow per `phase-6.md §AC` |
| 7 | Graded Exams | Server-timed exam → release results → regrade | Manual flow per `phase-7.md §AC` |
| 8 | Mastery, Streaks, Dashboard | Live student + teacher dashboards with real data | Manual flow per `phase-8.md §AC` |
| 9 | Live Classes (YouTube wrap) | Real OBS-driven live class → chat → recording → replay | Manual flow per `phase-9.md §AC` |
| 10 | Leaderboard & Gamification | Composite leaderboard, streak ticks, badge celebrations | Manual flow per `phase-10.md §AC` |
| 11 | Parents' WhatsApp Report | Weekly cron + on-demand report → WhatsApp arrives | Manual flow per `phase-11.md §AC` |
| 12 | Admin Completion, Hardening, Demo, Production Deploy | Final 30%, then production cutover | Full demo run + production health check |

## Kickoff prompts (copy-paste exactly)

Each prompt is self-contained. Claude reads the named phase doc and executes it. **Checkpoint protocol**: Claude pauses at each numbered checkpoint inside the phase for review before continuing. Use the prompt block verbatim.

---

### 🚀 Phase 1 — Foundation & Infrastructure

```
Start Phase 1: Foundation & Infrastructure. Read docs/phases/phase-1.md and execute it carefully, in order. Pause at each numbered Checkpoint inside the doc and summarize what you've done so I can verify before continuing. Do not combine steps. When the phase is complete, list each Acceptance Criterion and how you verified it. Stop and wait for me to say "Phase 1 accepted" before doing anything else.
```

### 🔐 Phase 2 — Identity & Authentication

```
Phase 1 accepted. Begin Phase 2: Identity & Authentication. Read docs/phases/phase-2.md and execute. Same checkpoint protocol — pause at each Checkpoint inside the doc, summarize, wait for "continue". Don't touch any feature outside Phase 2 scope.
```

### 🏫 Phase 3 — Courses, Batches, Curriculum

```
Phase 2 accepted. Begin Phase 3: Courses, Batches, Curriculum. Read docs/phases/phase-3.md and execute. Same checkpoint protocol.
```

### 🎟️ Phase 4 — Sessions & Attendance

```
Phase 3 accepted. Begin Phase 4: Sessions & Attendance. Read docs/phases/phase-4.md and execute. Same checkpoint protocol. Pay special attention to the QR HMAC + replay protection — this is high-stakes correctness.
```

### 📚 Phase 5 — Study Materials Library

```
Phase 4 accepted. Begin Phase 5: Study Materials Library. Read docs/phases/phase-5.md and execute. Same checkpoint protocol. Verify wrapped YT player + PDF watermark work on a real low-end device before declaring AC met.
```

### 📝 Phase 6 — Practice Quizzes

```
Phase 5 accepted. Begin Phase 6: Practice Quizzes. Read docs/phases/phase-6.md and execute. Same checkpoint protocol. Confirm answers never leak to client during attempt — it's a hard rule from CLAUDE.md.
```

### 🎯 Phase 7 — Graded Exams

```
Phase 6 accepted. Begin Phase 7: Graded Exams. Read docs/phases/phase-7.md and execute. Same checkpoint protocol. Verify server-time enforcement by attempting clock-skew tests before declaring AC met.
```

### 📊 Phase 8 — Mastery, Streaks, Dashboard

```
Phase 7 accepted. Begin Phase 8: Mastery, Streaks, Dashboard. Read docs/phases/phase-8.md and execute. Same checkpoint protocol. Now the dashboard goes live with real data — verify cold-start budget on Redmi 8A class device.
```

### 🎥 Phase 9 — Live Classes (YouTube wrap)

```
Phase 8 accepted. Begin Phase 9: Live Classes. Read docs/phases/phase-9.md and execute. Same checkpoint protocol. This is the most external-dependency-heavy phase (YT OAuth, OBS) — confirm prerequisites are done BEFORE writing code.
```

### 🏆 Phase 10 — Leaderboard & Gamification

```
Phase 9 accepted. Begin Phase 10: Leaderboard & Gamification. Read docs/phases/phase-10.md and execute. Same checkpoint protocol.
```

### 📱 Phase 11 — Parents' WhatsApp Report

```
Phase 10 accepted. Begin Phase 11: Parents' WhatsApp Report. Read docs/phases/phase-11.md and execute. Same checkpoint protocol. Confirm Gupshup business account + templates are approved BEFORE writing code.
```

### 🚢 Phase 12 — Admin Completion, Hardening, Demo, Production Deploy

```
Phase 11 accepted. Begin Phase 12: Admin Completion, Hardening, Demo, Production Deploy. Read docs/phases/phase-12.md and execute. Same checkpoint protocol. This phase ends with the production cutover — do NOT cut over without my explicit "go live" approval after the demo dry-run.
```

---

## Acceptance protocol

For each phase:

1. Claude announces "Phase N complete. Acceptance Criteria:" and lists every AC item with how it was verified.
2. You run through the AC list yourself — manually or via the listed commands.
3. If all pass → reply `Phase N accepted, begin Phase N+1` (or copy the next phase prompt).
4. If something fails → tell Claude precisely what failed; Claude fixes it; re-verify.
5. **Do not start Phase N+1 with anything failing in Phase N.** Production-level discipline.

## What happens AFTER Phase 12

Phase 12 ends with:
- Production Supabase project, Vercel admin deployment, EAS-built mobile binaries
- Demo seed data + pre-baked accounts
- Sentry alerts + PostHog dashboards configured
- Runbook in `docs/runbook.md` (drafted in Phase 12)
- Incident response playbook in `docs/incident-playbook.md`

At that point, the **client demo** is ready. Post-demo, the deferred items (payments, push notifications, multi-branch — see `decisions.md §"Out of MVP"`) become candidates for the next roadmap.

## Cross-phase rules (never break these)

- **No phase touches a feature outside its scope.** If you find a bug in a different feature, log it under `docs/known-issues.md` (create the file lazily) and address in its own phase.
- **No half-done frontend.** If a screen is touched, it ends the phase complete — no "we'll wire it up later" notes.
- **No silent breakage of past phases.** Every phase's CI includes a regression check on all prior phases' tests.
- **No bypassing RLS to make tests pass.** If a test needs special access, use a `service_role` helper in tests, never weaken the policy.
- **No skipping audit log** on admin writes.
- **No new dependencies without justification.** New package added → mention it in the phase doc with a one-line reason.

## Estimated effort (very rough)

| Phase | Est. effort | Notes |
|---|---|---|
| 1 | 3–4 days | Mostly setup, no business logic |
| 2 | 4–5 days | Auth is critical; spend time on RLS |
| 3 | 3–4 days | CRUD + curriculum tree UX |
| 4 | 4–5 days | Camera + HMAC are tricky |
| 5 | 4–5 days | Watermark + PDF reader on low-end |
| 6 | 4–5 days | Quiz UI is content-heavy |
| 7 | 4–6 days | Server-time + tab-switch + locked-down UX |
| 8 | 3–4 days | Mostly composing existing data |
| 9 | 6–8 days | Most external-integration risk |
| 10 | 3–4 days | Straightforward composition |
| 11 | 4–6 days | Gupshup approval can stall this |
| 12 | 5–7 days | Hardening + demo prep + deploy |

Totals ~50–60 days of focused work. Real calendar time depends on Gupshup approval, YT verification, etc.
