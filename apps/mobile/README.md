# FyneStudy — Mobile

React Native + Expo SDK 54 app. One binary serves both students and teachers, with role-gated route groups (`app/(student)/` vs `app/(teacher)/`). Built as part of the [FyneStudy](../../README.md) pnpm monorepo.

## Get started

From the **repo root** (not this folder):

```bash
pnpm install
pnpm dev:mobile
```

`pnpm dev:mobile` is a thin wrapper around `expo start` that:
- Detects your LAN IP and advertises it to Metro (`REACT_NATIVE_PACKAGER_HOSTNAME`) so your phone on the same Wi-Fi can connect via Expo Go.
- Sets `EXPO_OFFLINE=1` to work around a Node 24 + Windows IPv6 hang against `api.expo.dev`.

When the QR code appears: open **Expo Go** on your phone → scan it. The app loads to the splash router and routes by session state (logged-in role, suspended, must-change-password, etc. — see `app/index.tsx`).

For why these scripts wrap `expo start` instead of using it directly, see [`docs/phases/phase-1.md §13`](../../docs/phases/phase-1.md) ledger entry under "Deliberate deviations from the original Phase 1 doc".

## Key directories

| Path | What's there |
|---|---|
| `app/` | Expo Router screens. `app/(student)/` + `app/(teacher)/` are role-gated tab groups. `app/_layout.tsx` wraps everything in `SessionProvider`. |
| `features/auth/` | Session provider, role helpers, password-change flows, `withTimeout` network helper. |
| `lib/` | `supabase.ts` (client wired to SecureStore per D-026), `secure-store.ts` (platform-dispatched: SecureStore on native, localStorage on web/SSR), `env.ts`, `crash.ts`, `analytics.ts`. |
| `components/` | Pure UI primitives. No data fetching. |
| `hooks/` | Cross-cutting hooks (color scheme, etc.). |

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | LAN-IP-aware Expo dev server (use this, not `pnpm start`). |
| `pnpm start` | Plain `expo start` — only use if you've already set `REACT_NATIVE_PACKAGER_HOSTNAME` manually. |
| `pnpm typecheck` | `tsc --noEmit`, strict mode. |
| `pnpm lint` | `expo lint`. |
| `pnpm test` | Jest (babel-jest, pure TS preset — see Phase 1 ledger for why not `jest-expo`). |

## Tests

- `lib/env.test.ts` — required env loader.
- `features/auth/schemas.test.ts` — password / email / login zod schemas.
- `features/auth/network-errors.test.ts` — `isNetworkError`, `withTimeout`, `TimeoutError`.
- `features/auth/role-helpers.test.ts` — `computeRoleHelpers` (pure derivation tested without a React tree).

## Authoritative docs

Everything not in this README lives in the monorepo docs:
- **Hard rules** + module map: [`/CLAUDE.md`](../../CLAUDE.md)
- **Decisions log**: [`/docs/decisions.md`](../../docs/decisions.md) — source of truth when specs disagree
- **Feature specs**: [`/docs/spec/*.md`](../../docs/spec/)
- **Phase status**: [`/docs/phases/README.md`](../../docs/phases/README.md)
- **Backend topology + schema**: [`/docs/backend-architecture.md`](../../docs/backend-architecture.md)

## Common gotchas

- **`TypeError: ExpoSecureStore.default.getValueWithKeyAsync is not a function`** → Expo started bundling for web alongside native, web has no SecureStore native module. `lib/secure-store.ts` dispatches by `Platform.OS` to fix this; if you see it, you reverted that file.
- **QR scan in Metro terminal says "no usable data found"** → Expo is in dev-build mode because `expo-dev-client` is installed. Press `s` in the Metro terminal to switch to Expo Go mode, then re-scan.
- **Mobile auth call hangs on "Saving…" forever** → some new code path bypassed `withTimeout` (D-148). Every Supabase auth call and edge-fn fetch must be wrapped — see `features/auth/network-errors.ts`.
- **OneDrive + pnpm flakiness** → repo lives in OneDrive; `.npmrc` has `package-import-method=copy` because pnpm's default hardlink store races with OneDrive's sync agent. If `pnpm install` produces weird errors, close OneDrive briefly.
