# FyneStudy

> Hybrid coaching-institute OS for JEE / NEET / CUET prep. One mobile app (students + teachers, role-gated). One web admin panel. One Supabase backend. Live classes via wrapped YouTube. Attendance via rotating QR. Practice quizzes + graded exams. Weekly parents' WhatsApp PDF.

This is a **pnpm monorepo** in active development on `main`. Don't open issues here — feature work happens in numbered phases under [`docs/phases/`](docs/phases/README.md).

> 🚀 **Launching to the Play Store?** Follow **[`START-HERE.md`](START-HERE.md)** — the ordered, step-by-step launch playbook (build → test on a phone → Google Play Console → publish). It points to every other doc at the right moment.

## What's here

```
FyneStudyLive/
├── CLAUDE.md                    # Hard rules, tech stack, module map — read this FIRST
├── apps/
│   ├── mobile/                  # React Native + Expo (students + teachers, same binary)
│   ├── web/                     # Next.js 15 PWA (students + teachers — full mobile parity, on Vercel)
│   ├── admin/                   # Next.js 15 admin panel (on Vercel)
│   └── functions/               # Supabase Edge Functions (Deno)
├── packages/
│   ├── shared/                  # Cross-app types + zod schemas
│   ├── supabase-types/          # Generated DB types
│   └── ui-tokens/               # Brand colors / spacing — shared mobile + admin
├── supabase/migrations/         # Versioned SQL migrations
├── scripts/                     # Bootstrap + smoke tests + RLS tests
└── docs/
    ├── project.md               # Product overview
    ├── decisions.md             # Source of truth when specs disagree
    ├── backend-architecture.md  # Topology + schema
    ├── file-structure.md        # This map, in detail
    ├── spec/                    # Feature specs (one per feature)
    └── phases/                  # 12-phase roadmap + kickoff prompts
```

## Project status

| Phase | Status |
|---|---|
| 1–10 | ✅ done — auth, courses/batches, attendance, library, quizzes, exams, mastery/dashboards, live classes, leaderboard |
| 11 | ⏭️ skipped — parents' WhatsApp report (see [`docs/decisions.md`](docs/decisions.md)) |
| 12 | 🟡 final polish + **launch** — see [`START-HERE.md`](START-HERE.md) |
| Web app | 🟢 `apps/web` — Next.js 15 PWA at full mobile parity; code-complete + backend deployed. Deploy guide: [`docs/web-app-deploy.md`](docs/web-app-deploy.md) |

Authoritative live status: [`CLAUDE.md`](CLAUDE.md) → **Status**.

## Quick start (local development)

```bash
# Install everything
pnpm install

# Run mobile (LAN-IP aware; opens QR for Expo Go on phone)
pnpm dev:mobile

# Run admin (localhost:3000)
pnpm dev:admin

# Mechanical gates
pnpm -r typecheck
pnpm --filter @fynestudy/mobile lint
pnpm --filter @fynestudy/mobile test

# Live-flow smoke + RLS tests (require apps/admin/.env.local with Supabase keys)
pnpm smoke:cp5
pnpm smoke:cp8
pnpm test:rls
```

Owner demo credentials and other test fixtures: see the [`demo-owner` memory note](~/.claude/projects/C--Users-kaust-OneDrive-Desktop-FyneStudyLive/memory/project_demo-owner.md) if you're the agent picking this up, or the project owner directly.

## Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native 0.81 + Expo SDK 54 + Expo Router 6 + NativeWind 4 |
| Admin | Next.js 15 + Tailwind 4 + shadcn/ui on Vercel |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), `ap-south-1` |
| Live stream | YouTube Live Unlisted, wrapped via `react-native-youtube-iframe` |
| Chat | Supabase Realtime |
| PDF | `pdf-lib` in Supabase Edge Functions |
| WhatsApp | Gupshup Business API |
| Math | KaTeX |

Full rationale in [`docs/decisions.md`](docs/decisions.md).

## Working in this codebase

- Hard rules are in [`CLAUDE.md`](CLAUDE.md) — RLS on every user-data table, every privileged write goes through an edge function, every admin write writes an audit_log row, no `console.log` in production, no service-role from app code, etc.
- Architectural decisions are dated and immutable in [`docs/decisions.md`](docs/decisions.md). Old decisions are never deleted — if a decision is overturned, add a new one referencing the old `D-NNN`.
- Each phase is a vertical slice (backend + frontend together), driven by a single doc under [`docs/phases/`](docs/phases/README.md). Phases don't merge until every Acceptance Criterion passes.
- For agents: [`docs/phases/README.md`](docs/phases/README.md) has kickoff prompts to paste at the start of a fresh conversation for any pending phase.

## License

Private — all rights reserved. Not yet licensed for external use.
