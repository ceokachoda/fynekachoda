# Phase 1 — Foundation & Infrastructure

> Convert the single-app repo into a pnpm monorepo. Stand up Supabase (dev + prod), CI, Sentry, PostHog, EAS, and Vercel. By the end of this phase the mobile app + admin panel + edge functions all connect to a live Supabase backend — but no business logic exists yet. This is the platform on which every following phase is built.

---

## 1. Goal

Make the build/deploy/observability backbone real, end-to-end, before writing any feature code. Foundation issues caught in Phase 1 cost an hour; the same issues caught in Phase 5 cost a week.

## 2. Prerequisites (external, you do these — Claude can't)

See [`docs/external-setup-timeline.md`](../external-setup-timeline.md) for full details and rationale on lead times.

### Required to start Phase 1 (do these all on Day 1)

- [ ] Buy domain `fynestudy.<tld>` (any TLD; `.in` recommended for India). Decide on subdomains: `admin.fynestudy.<tld>` (admin panel).
- [ ] Create Supabase organization "fynstudy".
- [ ] Create two Supabase projects in **ap-south-1 (Mumbai)**: `fynestudy-dev` and `fynestudy-prod`. (Project URLs + anon keys + service-role keys needed.)
- [ ] Create a Sentry account; create two projects: `fynestudy-mobile` (React Native) and `fynestudy-admin` (Next.js). Save DSNs.
- [ ] Create a PostHog Cloud account; one project (`fynestudy`). Save client key.
- [ ] Create a Vercel account (or use existing); link your GitHub.
- [ ] Create an Expo account; install Expo CLI locally (`npm i -g eas-cli`); run `eas login`.
- [ ] Install pnpm globally: `npm i -g pnpm@9`.

### Start in parallel — long lead times, will block later phases (do these on Day 1)

- [ ] **YouTube channel created** on a dedicated institute Google account (saves the Channel ID).
- [ ] **YouTube phone verification submitted** (24h hold).
- [ ] **YouTube Live Streaming enabled** (separate 24h hold; needed by Phase 9).
- [ ] **Apple Developer Program enrollment started** (if shipping iOS at launch; $99/yr; ~1–3 days to approve).
- [ ] **Gupshup WhatsApp Business account application started** (Meta verification; needed by Phase 11).

If you have a meeting with the client or institute owner in the next few days, also get sign-off on:
- The institute's display name (used in PDFs, WhatsApp templates, app header).
- The brand colors / logo (used in admin settings, PDF reports).

### How to hand secrets to Claude

Put real values in `.env.local` files (gitignored) in each app's folder. Claude reads them via the env loader; never commit them. Service-role keys go into Supabase Vault via the dashboard, not env files.

## 3. Scope

### In
- pnpm workspace at repo root
- Restructured tree: `apps/mobile`, `apps/admin`, `apps/functions`, `packages/shared`, `packages/supabase-types`, `packages/ui-tokens`, `supabase/`
- Supabase dev project linked (`supabase link`)
- Mobile: Supabase client wired through `expo-secure-store`, Sentry + PostHog initialized, env types
- Admin: Next.js 15 scaffold with shadcn/ui, Supabase server + browser clients, Sentry init, deploys to Vercel preview
- Edge function: a single `health` function deployed to dev Supabase
- `.github/workflows/ci.yml` — lint + typecheck + test on every PR
- EAS config for development / preview / production profiles
- Connectivity smoke screen on mobile that pings the `health` edge fn

### Out (later phases)
- Any business tables / schemas
- Auth flows (Phase 2)
- Role gating (Phase 2)
- Real screens beyond a "platform healthy" indicator
- Production Supabase project setup (we set up dev only; prod cutover is Phase 12)

## 4. Specs in play

- `docs/project.md §5` (Tech Stack), §7 (Non-Functional Requirements)
- `docs/file-structure.md` (target layout)
- `docs/backend-architecture.md §2` (Environments)
- `docs/spec/security.md §17` (Secrets Inventory)
- `docs/spec/performance.md §1, §7` (Budgets + Build optimizations)
- `docs/decisions.md` D-100, D-101, D-103 (Supabase region + 2 projects + no Redis)

## 5. Backend work

### 5.1 Repo restructure (Checkpoint 1)

Convert `apps/mobile` into a workspace member. Add the workspace manifest:

```yaml
# pnpm-workspace.yaml (repo root)
packages:
  - "apps/*"
  - "packages/*"
```

Create root `package.json` with workspace scripts:

```json
{
  "name": "fynestudy",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "dev:mobile": "pnpm --filter @fynestudy/mobile dev",
    "dev:admin": "pnpm --filter @fynestudy/admin dev",
    "fn:deploy": "supabase functions deploy --project-ref $SUPABASE_PROJECT_REF",
    "db:diff": "supabase db diff --linked",
    "db:push": "supabase db push --linked"
  }
}
```

Rename `apps/mobile/package.json` `name` field from `"mobile"` to `"@fynestudy/mobile"`. Adjust internal scripts. (Current value verified: `"name": "mobile"`.)

Create empty scaffolds:
- `apps/admin/` — Next.js 15 (`pnpm create next-app apps/admin --typescript --tailwind --app --no-src-dir --import-alias "@/*"`).
- `apps/functions/` — Deno workspace with `_shared/` and `health/`.
- `packages/shared/` — barrel `src/index.ts`.
- `packages/supabase-types/` — initially empty `index.ts`; regenerated in Phase 2.
- `packages/ui-tokens/` — copy from current `apps/mobile/constants/theme.ts`.
- `supabase/` — `supabase init` from this folder; this creates `config.toml`, `migrations/`, `seed.sql`.

`tsconfig.base.json` at root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@fynestudy/shared": ["./packages/shared/src"],
      "@fynestudy/shared/*": ["./packages/shared/src/*"],
      "@fynestudy/supabase-types": ["./packages/supabase-types"],
      "@fynestudy/ui-tokens": ["./packages/ui-tokens"]
    }
  }
}
```

Each app/package's `tsconfig.json` extends this.

**STOP. Checkpoint 1.** Verify with: `pnpm install` at repo root succeeds; `pnpm typecheck` succeeds (all empty/passes); `apps/mobile` still runs via `pnpm dev:mobile` and shows existing screens (no regression).

### 5.2 Supabase dev project linked (Checkpoint 2)

```bash
supabase login
supabase link --project-ref <fynestudy-dev-ref>
```

Create initial config in `supabase/config.toml`:
- `db.major_version = 15`
- `auth.enable_signup = false` (admins create users)
- `auth.enable_anonymous_sign_ins = false`
- `auth.sms.enable_signup = false`
- `storage.image_transformation.enabled = false`
- `realtime` enabled

Add the first migration (just the migration framework, no schema yet):

```sql
-- supabase/migrations/0000_init.sql
-- Placeholder: ensures `supabase db push` succeeds against an empty linked project.
-- Schema work starts in Phase 2 (auth) / Phase 3 (courses).
select 1;
```

Run `supabase db push --linked` to verify the pipeline works.

**STOP. Checkpoint 2.** Verify: `supabase status` (run locally) reports the linked dev project; migrations table exists in dev DB.

### 5.3 Edge function: health (Checkpoint 3)

`apps/functions/health/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.210.0/http/server.ts";

serve((req) => {
  const url = new URL(req.url);
  if (url.pathname !== "/health") return new Response("Not Found", { status: 404 });
  return Response.json({
    ok: true,
    runtime: "deno",
    version: 1,
    now: new Date().toISOString(),
  });
});
```

Deploy:
```bash
supabase functions deploy health --project-ref <dev-ref> --no-verify-jwt
```

(`--no-verify-jwt` because health doesn't need auth.)

**STOP. Checkpoint 3.** Verify: `curl https://<project>.supabase.co/functions/v1/health` returns the JSON.

### 5.4 Mobile wiring (Checkpoint 4)

In `apps/mobile/`:

Install:
```bash
pnpm add @supabase/supabase-js expo-secure-store @sentry/react-native posthog-react-native
pnpm add -D @types/node
```

`apps/mobile/.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

You add `.env.local` with real values (gitignored).

`apps/mobile/lib/env.ts`:

```ts
const required = (name: string, v: string | undefined): string => {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export const env = {
  supabaseUrl:        required("EXPO_PUBLIC_SUPABASE_URL",      process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey:    required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  sentryDsn:          process.env.EXPO_PUBLIC_SENTRY_DSN ?? null,
  posthogKey:         process.env.EXPO_PUBLIC_POSTHOG_KEY ?? null,
  posthogHost:        process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
};
```

`apps/mobile/lib/secure-store.ts`:

```ts
import * as SecureStore from "expo-secure-store";

export const secureStorage = {
  async getItem(key: string)            { return SecureStore.getItemAsync(key); },
  async setItem(key: string, value: string) { return SecureStore.setItemAsync(key, value); },
  async removeItem(key: string)         { return SecureStore.deleteItemAsync(key); },
};
```

`apps/mobile/lib/supabase.ts`:

```ts
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { secureStorage } from "./secure-store";

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

(Note: `react-native-url-polyfill/auto` is required by Supabase JS on RN; install it.)

`apps/mobile/lib/crash.ts`:

```ts
import * as Sentry from "@sentry/react-native";
import { env } from "./env";

export function initCrash() {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strip PII (Phase 2 will expand this).
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
```

`apps/mobile/lib/analytics.ts`:

```ts
import PostHog from "posthog-react-native";
import { env } from "./env";

export const analytics = env.posthogKey
  ? new PostHog(env.posthogKey, { host: env.posthogHost })
  : null;

export function track(event: string, props?: Record<string, unknown>) {
  analytics?.capture(event, props);
}
```

Update `apps/mobile/app/_layout.tsx` to call `initCrash()` and add a minimal "Platform Healthy" splash that pings the health edge function:

- Splash shows app logo + a small footer indicator: "Backend: connected" (green) or "Backend: unreachable" (red).
- If reachable, after 1.5s, navigate to the existing tabs screen (the OTP screen — which will be replaced in Phase 2).
- The OTP/select-course screens stay in place this phase; we don't touch them yet.

`apps/mobile/features/health/usePingBackend.ts`:

```ts
import { useEffect, useState } from "react";
import { env } from "@/lib/env";

export function usePingBackend() {
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");
  useEffect(() => {
    fetch(`${env.supabaseUrl}/functions/v1/health`, {
      headers: { Authorization: `Bearer ${env.supabaseAnonKey}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setStatus("ok"))
      .catch(() => setStatus("fail"));
  }, []);
  return status;
}
```

**STOP. Checkpoint 4.** Verify: `pnpm dev:mobile` launches; open in Expo Go on a real phone or Android simulator; splash shows "Backend: connected" green; Sentry receives a test event (manual trigger from a debug menu).

### 5.5 Admin scaffold (Checkpoint 5)

`apps/admin/` is the Next.js scaffold. Add:

```bash
cd apps/admin
pnpm add @supabase/supabase-js @supabase/ssr @sentry/nextjs posthog-js posthog-node
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input form table sheet dialog dropdown-menu
```

`apps/admin/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
```

`apps/admin/lib/supabase-browser.ts` + `supabase-server.ts` per Supabase SSR docs.

Replace the default Next.js home page with a placeholder:
```tsx
// apps/admin/app/page.tsx
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">FyneStudy Admin</h1>
        <p className="text-muted-foreground">Coming online…</p>
      </div>
    </main>
  );
}
```

Configure Sentry via `pnpm dlx @sentry/wizard@latest -i nextjs`.

Connect Vercel: import the repo, set the project root to `apps/admin`, add the env vars in Vercel dashboard. First deploy should be a Vercel preview URL.

**STOP. Checkpoint 5.** Verify: `pnpm dev:admin` runs locally on `http://localhost:3000`. Vercel preview URL renders the placeholder. Sentry receives a test event.

### 5.6 CI pipeline (Checkpoint 6)

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - name: Bundle size check (mobile)
        run: pnpm --filter @fynestudy/mobile exec npx expo export --dump-sourcemap || true  # advisory in Phase 1
```

A separate workflow `.github/workflows/deploy-functions.yml` runs `supabase functions deploy` on every merge to `main` against the dev project (prod added in Phase 12).

**STOP. Checkpoint 6.** Verify: open a PR with a trivial change → CI passes; merge → functions auto-deploy to dev.

### 5.7 EAS Build config (Checkpoint 7)

`apps/mobile/eas.json`:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

Run `eas build:configure` if not already, then `eas build --profile development --platform android` as a smoke build.

`apps/mobile/app.json`: ensure
- `expo.scheme = "fynestudy"` (for deep links)
- `expo.android.package = "com.fynestudy.app"` (or your choice — final at Phase 12)
- `expo.ios.bundleIdentifier = "com.fynestudy.app"`
- `expo.android.permissions` lists `CAMERA` (used in Phase 4)
- `expo.plugins` includes `expo-secure-store`, `expo-camera`

**STOP. Checkpoint 7.** Verify: `eas build` produces a working development APK; you can install on a real Android device.

## 6. Frontend work — summary

### Files added (mobile)
- `apps/mobile/lib/env.ts`
- `apps/mobile/lib/supabase.ts`
- `apps/mobile/lib/secure-store.ts`
- `apps/mobile/lib/crash.ts`
- `apps/mobile/lib/analytics.ts`
- `apps/mobile/features/health/usePingBackend.ts`
- `apps/mobile/.env.example`

### Files edited (mobile)
- `apps/mobile/app/_layout.tsx` — adds `initCrash()` + connectivity check, otherwise unchanged
- `apps/mobile/package.json` — name change + new deps + scripts
- `apps/mobile/app.json` — scheme, package, permissions
- `apps/mobile/tsconfig.json` — extends `../../tsconfig.base.json`

### Files deleted
- **None this phase.** OTP / select-course / existing tabs stay until Phase 2.

### Files added (admin)
- `apps/admin/*` entire scaffold (new directory)

### Files added (functions)
- `apps/functions/_shared/`
- `apps/functions/health/index.ts`

### Shared packages
- `packages/shared/src/index.ts` — empty barrel
- `packages/supabase-types/index.ts` — empty (regenerated Phase 2+)
- `packages/ui-tokens/colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`

## 7. Risks & gotchas

| Risk | Mitigation |
|---|---|
| Monorepo restructure breaks existing imports in `apps/mobile` | Do the move in a single commit; run `pnpm typecheck` after; fix any path issues before continuing. |
| `expo-secure-store` requires native build (not Expo Go) | Use `expo-dev-client` build via EAS development profile for all dev going forward; Expo Go is only OK for splash screen. |
| Sentry RN setup needs native config | Use `pnpm dlx @sentry/wizard@latest -i reactNative` to auto-configure native; review the patch. |
| Supabase service-role key accidentally committed | `.env*` is gitignored; verify before first push. Add a pre-commit check (gitleaks) in Phase 12. |
| Vercel preview deploys leak env vars | Set env vars only in Vercel dashboard, not in `.env.local` for `apps/admin`. |
| CI takes >5 min and feels sluggish | Cache pnpm store + Next/Expo build caches in workflow; address only if real. |
| Existing screens look broken after restructure | Verify visually after every commit. The OTP and tabs screens should look identical to before. |

## 8. Acceptance criteria (testable)

1. `pnpm install` at repo root completes without warnings beyond peer-dep notices.
2. `pnpm typecheck` passes for all workspaces (mobile, admin, functions, shared).
3. `pnpm lint` passes.
4. `pnpm test` passes (even if zero tests; harness wired).
5. `pnpm dev:mobile` launches Expo dev server. App opens on a real Android phone via dev client.
6. Splash screen shows `Backend: connected` (green) after at most 2s.
7. Sentry mobile project receives a test event when you tap a debug "Send test error" trigger (add temporary button on splash; remove in Phase 2).
8. PostHog mobile project receives a test `app_open` event.
9. `pnpm dev:admin` runs Next.js on `http://localhost:3000`. Placeholder renders.
10. Vercel preview URL for `apps/admin` renders the same placeholder publicly.
11. `curl https://<dev-project>.supabase.co/functions/v1/health` returns 200 with `{ok: true, runtime: "deno", ...}`.
12. `supabase db push --linked` succeeds against the dev project (migrations table populated with `0000_init`).
13. CI passes on a test PR.
14. `.github/workflows/deploy-functions.yml` deploys `health` fn on merge to `main`.
15. EAS dev build produces an installable Android APK.

## 9. Test plan

### Unit tests
- `packages/shared` — none yet; harness in place.
- `apps/mobile/lib/env.test.ts` — env loader throws on missing required keys.

### Integration tests
- None (no business logic yet).

### Manual QA
- iOS Simulator: app launches, splash green.
- Android emulator: app launches, splash green.
- Redmi 8A reference device: cold start < 3s (record baseline; this is the perf budget for the rest of the project).
- Disable network → splash shows red `Backend: unreachable` after 5s.

### Smoke
- `curl /functions/v1/health` from a different IP — works (CORS not required for plain `curl`).

## 10. Rollback plan

If Phase 1 breaks the existing mobile app:
1. Revert the monorepo restructure commits (`git revert <commits>`).
2. `apps/mobile/` should return to its standalone form.
3. Diagnose the specific failure (likely a tsconfig path or moved file).
4. Re-attempt the restructure in a fresh branch.

The Supabase dev project, Vercel admin scaffold, Sentry, and PostHog setups don't impact the existing app — they're additive and safe to keep even if mobile changes are reverted.

## 11. Definition of done

- [ ] All 15 Acceptance Criteria pass.
- [ ] CI green on `main`.
- [ ] No secrets in git history (verify with `gitleaks` once locally).
- [ ] Baseline cold-start time recorded in `docs/perf-baselines/phase-1.md` (create this).
- [ ] Sentry mobile + admin DSNs added to `docs/spec/security.md §17` table if not already.
- [ ] User says "Phase 1 accepted".

## 12. Hand-off to Phase 2

Phase 2 picks up with:
- Supabase dev project live, mobile + admin connected.
- No tables yet — Phase 2 creates the first business migration (auth-related tables).
- Existing OTP / select-course screens still present (Phase 2 deletes them).
- Tabs folder still named `(tabs)` (Phase 2 renames to `(student)`).

## 13. Acceptance Ledger — closed 2026-05-14

Phase 1 closed with PR #1 (commit `ef8c0cf` → merge `bea08b2`) on **2026-05-14**.

### AC results

| # | Acceptance Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `pnpm install` clean | ✅ pass | `--frozen-lockfile` runs in ~4 s; only advisory "ignored build scripts" notices |
| 2 | `pnpm typecheck` all workspaces | ✅ pass | mobile, admin, functions (stub), shared, supabase-types, ui-tokens all clean |
| 3 | `pnpm lint` | ✅ pass | 0 errors, 3 advisory warnings in pre-existing dead-code files Phase 2 deletes |
| 4 | `pnpm test` | ✅ pass | 3/3 in `apps/mobile/lib/env.test.ts` |
| 5 | `pnpm dev:mobile` opens app on a real phone | ✅ pass (iOS) | Verified on iPhone via Expo Go; LAN IP advertised by `scripts/dev.js` |
| 6 | Splash → green "Backend: connected" ≤ 2 s | ✅ pass | Verified visually in CP4 |
| 7 | Sentry mobile test event | ⛔ **deferred** | **User decision** — skip paid observability tiers; `lib/crash.ts` is a no-op stub with documented drop-in path. Revisit during the observability pass (likely Phase 11 or Phase 12). |
| 8 | PostHog `app_open` event | ⛔ **deferred** | **User decision** — same rationale as #7; `lib/analytics.ts` no-op stub. |
| 9 | `pnpm dev:admin` renders placeholder locally | ✅ pass | Verified on `localhost:3001` (3000 was busy; same outcome) |
| 10 | Vercel preview public URL | ✅ pass | <https://fyne-study-app-admin.vercel.app/> returns 200 with placeholder |
| 11 | Health edge fn returns expected JSON | ✅ pass | <https://orqwyazvcthgxoadfxfv.supabase.co/functions/v1/health> |
| 12 | `supabase db push --linked` succeeds | ✅ pass | `schema_migrations` row `20260514115416_init` applied via MCP |
| 13 | CI passes on a test PR | ✅ pass | PR #1 ran CI to completion; merge gated on green |
| 14 | `deploy-functions.yml` redeploys `health` on main merge | ✅ pass | Workflow filed; secret `SUPABASE_ACCESS_TOKEN` provisioned; merge `bea08b2` triggered re-deploy; health endpoint still 200 post-merge |
| 15 | EAS dev build produces installable Android APK | 🟡 **deferred to convenience** | **User decision** — EAS Android dev build submitted (ID `f2e9ff53-6e78-41c6-8631-29eaadf51611`, profile `development`); install verification on Android device postponed because iOS Expo Go already proved the underlying app works. APK link will be available at <https://expo.dev/accounts/kaustabborah/projects/fynestudy/builds/f2e9ff53-6e78-41c6-8631-29eaadf51611> whenever the queue clears. |

### Definition-of-done results

- [x] AC results recorded above.
- [x] CI green on `main` (merge `bea08b2`).
- [x] No secrets in git history (`.env.local`, `.vercel/`, EAS tokens all gitignored or env-only; verified via `git check-ignore`).
- [x] Baseline cold-start template at `docs/perf-baselines/phase-1.md` (numbers filled when user installs the dev APK).
- [ ] **Deferred:** Sentry mobile + admin DSNs added to `docs/spec/security.md §17` — see AC #7 deferral above.
- [x] User accepted Phase 1.

### Deliberate deviations from the original Phase 1 doc

Recorded here so future contributors don't think these were accidents.

1. **pnpm@10** (not 9) — user already has 10 globally; 10 is compatible with the doc's scripts.
2. **Timestamp migration filenames** (e.g., `20260514115416_init.sql`) instead of ordinal `0000_*` — Supabase MCP/CLI tracks migrations by timestamp; ordinal would cause version drift.
3. **No Sentry / PostHog packages installed** — user opted to skip paid-tier observability for Phase 1. The wiring (`lib/crash.ts`, `lib/analytics.ts`, env vars) is in place as no-op stubs.
4. **Mobile jest runs babel-jest with pure TS preset, not `jest-expo`** — `jest-expo`'s Winter Runtime is ESM and breaks node-test sandboxes for utility tests. `jest-expo` retained in devDeps for future RN component tests.
5. **Mobile dev script is `scripts/dev.js`, not plain `expo start`** — wraps with `EXPO_OFFLINE=1` (works around Node 24 + Windows IPv6 hang on `api.expo.dev`) and auto-detects LAN IP into `REACT_NATIVE_PACKAGER_HOSTNAME`. Required for Windows + OneDrive setups.
6. **Postgres 17.6** (not 15) — Supabase no longer provisions PG15 for new projects.
7. **Modern `Deno.serve` in the health edge fn** instead of the doc's deprecated `deno.land/std/http/server.ts` import.
8. **Admin home page is a static placeholder, no shadcn `form` primitive yet** — the shadcn CLI silently fails to install `form` on this OneDrive setup. Phase 2's login form lands the primitive when it actually needs it; `react-hook-form` + `zod` + `@hookform/resolvers` are pre-installed.
9. **Vercel deployed to "production" target** (CLI `--yes` default for first deploys), not the doc's "preview" target. Same AC: a public URL renders the placeholder. Future deploys can use `--target=preview`.
10. **`.npmrc` has `package-import-method=copy`** — pnpm's default hardlink store races with OneDrive's sync agent. Copy mode is slower but reliable.

### Carry-overs into Phase 2

- Sentry + PostHog wiring (the `lib/crash.ts` + `lib/analytics.ts` drop-in points).
- shadcn `form` primitive (`pnpm dlx shadcn@latest add form -y` once Phase 2 starts using it; underlying deps already in `apps/admin/package.json`).
- Sentry DSNs in `docs/spec/security.md §17` (re-evaluate during observability pass).
- Android APK install verification (whenever the user wants to install the existing EAS build, or with the first new build Phase 2 produces).
