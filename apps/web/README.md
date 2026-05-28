# @fynestudy/web — FyneStudy Web Client

The browser-installable Next.js 15 PWA giving students and teachers full FyneStudy parity in any modern browser.

Reuses the existing Supabase backend (`orqwyazvcthgxoadfxfv`) unchanged — anon key only, all privileged writes through edge functions.

## Quick start

```bash
cp apps/web/.env.example apps/web/.env.local   # then fill in values
pnpm install                                   # at repo root
pnpm --filter @fynestudy/web dev               # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm --filter @fynestudy/web dev` | Next.js dev server |
| `pnpm --filter @fynestudy/web build` | Production build (includes Serwist service worker) |
| `pnpm --filter @fynestudy/web start` | Production server |
| `pnpm --filter @fynestudy/web typecheck` | `tsc --noEmit` |
| `pnpm --filter @fynestudy/web lint` | `eslint` (Next core-web-vitals + typescript rules) |
| `pnpm --filter @fynestudy/web test` | `vitest run` |
| `pnpm --filter @fynestudy/web e2e` | Playwright cross-browser auth E2E |

## Architecture

See `Phases/00-overview-and-architecture.md` and `Phases/phase-1-foundation-auth-shell.md` (root of repo).
