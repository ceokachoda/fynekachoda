# Frontend Architecture — React Native (Student + Teacher App)

Everything in this document applies to the React Native app in `apps/mobile/`. The Next.js admin app is covered in `PHASE-07`.

## 1. Recommended React Native setup

**Expo SDK 52+ (managed workflow) with Dev Clients and EAS.** TypeScript. Expo Router (file-based).

### Why Expo (and why not bare RN)

| Need | Expo managed + dev client | Bare RN |
|---|---|---|
| QR scan / camera | `expo-camera` one line | `react-native-vision-camera`, configured manually |
| Push | `expo-notifications` works | Wire FCM + APNs manually |
| OTA updates | `eas update` built-in | Fold in CodePush or roll-your-own |
| Over-the-air builds | EAS Build | Fastlane, certificates by hand |
| Native module escape hatch | Dev client unlocks anything | Same capability, no Expo benefits |
| Time-to-first-demo build | Hours | Days |
| Team ramp-up | Low | Medium |

Expo has no meaningful downside for this product. Dev clients give us access to 100ms, LiveKit, or any other native SDK whenever we need it.

### Core versions (as of 2026-04)
- Expo SDK 52+
- React Native 0.77+
- TypeScript 5.4+
- New Architecture enabled (Fabric + TurboModules) — RN 0.76+ stable.

## 2. Why RN for student + teacher, and Next.js for admin

- Student and teacher are phone-first workflows: camera, notifications, single-hand use.
- Admin is spreadsheet-first: tables, multi-select, uploads, bulk actions. This is a keyboard+mouse workflow.

Building the admin in RN + `react-native-web` gives lower quality at higher engineering cost than Next.js + shadcn/ui. We therefore draw the boundary at "phone = RN, desk = Next.js" and accept the slight duplication.

## 3. State management

| Kind of state | Where |
|---|---|
| Server state (remote data) | **TanStack Query** |
| Auth / current session | **Supabase client + AuthProvider** wrapping Query |
| Ephemeral UI state (drawer open, form draft) | Local component state, `useState`/`useReducer` |
| App-wide but non-server state (theme, role, feature flags) | **Zustand** store |
| Cross-screen form state | `react-hook-form` |

No Redux. No MobX. Zustand only for the 3–5 global slices we actually need.

### TanStack Query conventions
- One `queryKey` hierarchy per feature: `['classes','today',studentId]`.
- `staleTime` explicit per query (see table in each phase doc).
- Mutations invalidate keys deterministically; no blanket `invalidate()`.
- Persist cache to AsyncStorage with `@tanstack/query-async-storage-persister`; 24-hour cache lifetime.
- Realtime subscriptions update the cache directly via `setQueryData`.

## 4. API / data fetching strategy

### Layers
1. `lib/supabase.ts` — singleton client with `expo-secure-store` adapter.
2. `features/<name>/api.ts` — typed functions returning Promises (using generated Supabase types).
3. `features/<name>/queries.ts` — TanStack Query hooks wrapping the API calls.
4. Components consume hooks; no direct Supabase calls from components.

### Realtime
- Subscribe centrally per feature (e.g., `useClassesRealtime(batchId)`).
- Channel teardown on unmount.
- Combine with Query cache: realtime events trigger `setQueryData` or `invalidate`.

### Retries and errors
- Network retries: Query built-in, capped at 2.
- Auth failures: global error handler in `QueryClient` logs user out on persistent 401.
- Error UI: `ErrorState` component with retry button; root-level `ErrorBoundary` reports to Sentry.

## 5. Navigation structure

**Expo Router (file-based).** Stack + bottom tabs + modal routes.

```
app/
├── _layout.tsx                  # SessionGate + ThemeProvider + QueryClientProvider
├── (auth)/
│   ├── _layout.tsx              # redirects to (app) if already signed in
│   ├── phone.tsx
│   └── otp.tsx
├── (onboarding)/
│   ├── _layout.tsx              # first-run only
│   └── welcome.tsx
├── (app)/
│   ├── _layout.tsx              # redirects to (auth) if no session; role split
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── home.tsx             # /home
│   │   ├── classes.tsx
│   │   ├── library.tsx
│   │   ├── membership.tsx
│   │   └── profile.tsx
│   ├── classes/[id].tsx
│   ├── live/[classId].tsx       # full-screen live room
│   ├── recordings/[id].tsx
│   ├── library/[id].tsx
│   ├── attendance/
│   │   ├── qr.tsx
│   │   └── history.tsx
│   ├── notifications/index.tsx
│   ├── membership/
│   │   ├── plans.tsx
│   │   ├── checkout.tsx
│   │   └── success.tsx
│   └── announcements/[id].tsx
└── (teacher)/                   # teacher-only routes, mounted when role='teacher|admin'
    ├── _layout.tsx              # role gate
    ├── scanner.tsx
    ├── live/[classId].tsx       # teacher host screen
    ├── classes/[id]/attendance.tsx
    ├── recordings/[id]/clip.tsx
    └── uploads/new.tsx
```

### Guards
- `(app)/_layout.tsx` checks session + role; redirects.
- Teacher routes double-check role in their own layout.

## 6. Auth / session handling

- `AuthProvider` subscribes to Supabase `onAuthStateChange`.
- Tokens persisted in `expo-secure-store`.
- Background refresh handled by the Supabase client.
- On session expiry, kick to `/(auth)/phone`.
- Deep links (from push notifications, email, etc.) route post-auth via `expo-router`'s initial URL handling.

## 7. Offline caching

### What we cache
- Query results (via AsyncStorage persister) — 24h, read-through on cold start.
- User profile, batch, plan — "near permanent" (invalidate on explicit refresh).
- Downloaded PDFs in `FileSystem.documentDirectory/materials/`.

### What we don't cache
- Video (streamed always).
- Live class state.
- Attendance tokens (must be fresh).

### Offline indicators
- NetInfo-driven banner at top of every screen.
- Stale data marked with a subtle "last updated at …" when offline.

## 8. Media playback

- `react-native-video` (ExoPlayer on Android, AVPlayer on iOS) via Expo config plugin.
- HLS adaptive bitrate (Bunny provides).
- Thumbnail previews (sprite sheet from Bunny).
- Full-screen toggle with device orientation unlock.
- Background audio disabled (education videos are foreground-only).
- Screen record blocking on Android via `setFlags(FLAG_SECURE)` when viewing gated content (accept iOS limitation).
- Position save every 10s to `watch_positions` via debounced mutation.

## 9. QR rendering / scanning

### Render (student)
- `react-native-qrcode-svg` with error-correction `H`.
- Wrap in a bright white card with rounded corners; boost device brightness with `expo-brightness` while screen is visible.

### Scan (scanner mode, teacher)
- `expo-camera`'s `CameraView` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`.
- Debounce: ignore same value within 2s to handle camera framerate.

## 10. Notification handling

- `expo-notifications` for presentation + tap handlers.
- Register token on app start (after login); store via `register_device_token` RPC.
- Deep-linking mapping:
  - `class.reminder.15m` → `/classes/[id]`
  - `class.live.started` → `/classes/[id]` (shows Join Live)
  - `recording.ready` → `/recordings/[id]`
  - `material.new` → `/library/[id]`
  - `payment.success` → `/(app)/(tabs)/membership`
  - `announcement.published` → `/announcements/[id]`
- Foreground: show as banner (not intrusive).
- Background: standard system delivery.

## 11. App folder structure

```
apps/mobile/
├── app/                         # Expo Router tree (see §5)
├── src/
│   ├── components/              # design system
│   │   ├── ui/                  # Screen, Button, Card, ...
│   │   ├── data/                # ClassCard, MaterialCard, ...
│   │   └── feedback/            # Toast, Skeleton, EmptyState
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── classes/
│   │   ├── live/
│   │   ├── recordings/
│   │   ├── library/
│   │   ├── clips/
│   │   ├── attendance/
│   │   ├── membership/
│   │   ├── notifications/
│   │   └── profile/
│   ├── hooks/                   # cross-feature hooks (useDebounce, useNetStatus)
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── analytics.ts
│   │   ├── sentry.ts
│   │   ├── push.ts
│   │   └── live/                # ILiveProvider + hms-provider.ts
│   ├── providers/
│   │   ├── QueryProvider.tsx
│   │   ├── AuthProvider.tsx
│   │   └── ThemeProvider.tsx
│   ├── stores/                  # Zustand
│   └── theme/
│       ├── tokens.ts
│       ├── motion.ts
│       └── typography.ts
├── assets/
├── app.config.ts
├── eas.json
└── metro.config.js
```

Each `features/<name>/` folder contains:
```
features/<name>/
├── screens/
├── components/
├── hooks/
├── queries.ts
├── api.ts
└── types.ts
```

## 12. UI architecture

- All primitives live in `components/ui/`. Features compose these; features never define their own base `Button`.
- Theme tokens are the single source of truth (colors, radii, spacing, font sizes).
- NativeWind for static layout; `StyleSheet.create` for animated / perf-sensitive paths (avoid runtime class compilation inside `useAnimatedStyle`).
- Every list over ~20 items uses `@shopify/flash-list`.
- Every screen uses `<Screen>` wrapper handling safe-area, status bar, background, keyboard avoidance.

### Design tokens (tokens.ts)
```ts
export const colors = {
  brand: { 50:'#F0F8FF', 500:'#2563EB', 700:'#1D4ED8' },
  surface: { DEFAULT: '#FFFFFF', muted: '#F5F7FA' },
  text: { DEFAULT: '#0B1220', muted: '#6B7280' },
  success: '#16A34A', warning: '#EAB308', danger: '#DC2626',
};
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
```

## 13. Suggested libraries

| Purpose | Package | Why |
|---|---|---|
| Routing | `expo-router` | File-based, deep links, type-safe |
| Styling | `nativewind` | Tailwind DX, no runtime cost |
| Animations | `react-native-reanimated` 3, `moti` | Smooth on Android, declarative |
| Gestures | `react-native-gesture-handler` | Standard |
| Icons | `lucide-react-native` | Clean, tree-shakable |
| Images | `expo-image` | Caching + blurhash |
| Lists | `@shopify/flash-list` | Perf for long lists |
| Bottom sheet | `@gorhom/bottom-sheet` | The good one |
| Forms | `react-hook-form` + `zod` | Minimal re-renders, shared schemas |
| Query | `@tanstack/react-query` | Server state |
| Store | `zustand` | Tiny, no ceremony |
| Supabase | `@supabase/supabase-js` | Backend |
| Secure storage | `expo-secure-store` | Keychain/Keystore |
| Camera / QR scan | `expo-camera` | Permissions + scan |
| QR render | `react-native-qrcode-svg` | Stable, SVG |
| JWT sign/verify | `react-native-pure-jwt` | QR tokens |
| Video | `react-native-video` | HLS, mature |
| PDF | `react-native-pdf` | Standard |
| Live video | `@100mslive/react-native-hms` | 100ms SDK |
| Push | `expo-notifications` | FCM/APNs abstraction |
| Analytics | `posthog-react-native` | Events + funnels |
| Errors | `@sentry/react-native` | Crashes + perf |
| Haptics | `expo-haptics` | Feel |
| Brightness | `expo-brightness` | QR screen |
| Net info | `@react-native-community/netinfo` | Offline banner |
| Calendar | `react-native-calendars` | Attendance heatmap |
| Razorpay | `react-native-razorpay` | Payments |
| Toasts | `burnt` | Native iOS HUDs + Android snackbars |

## 14. Performance considerations for low-end Android

- Test on a real 4 GB Android (e.g., Redmi 10).
- Cold start budget: <2.5s to interactive dashboard. Fail the build in CI if bundle size grows >15%.
- Hermes engine enabled (default in recent Expo).
- Lazy-load heavy screens (`expo-router` does this; double-check live + player routes).
- Defer non-critical work until after first paint (analytics flush, image prefetch).
- Compress images via `expo-image` transforms (Bunny CDN can also serve pre-sized thumbs).
- Avoid inline styles in hot render paths; memoize.
- FlashList everywhere long.
- Don't over-animate: 60fps is the floor; Reanimated on UI thread.
- Flipper/Perf monitor in dev; Sentry performance transactions in prod on key screens.

## 15. Styling strategy

- NativeWind for 90% of layouts.
- `StyleSheet.create` in animated components.
- Shared tokens referenced via `theme/tokens.ts` (NativeWind reads them via a custom plugin).
- Dark mode through NativeWind class strategy; respect system preference by default, allow override in Profile.
- No inline hex colors outside `tokens.ts`.

## 16. Error handling

- Top-level `ErrorBoundary` renders a friendly error screen and reports to Sentry.
- Every async operation in a mutation has a user-facing toast on failure with a clear next step.
- Critical operations (payment, attendance) surface the backend error code as a human-readable message.
- No alerts (`Alert.alert`) for expected errors; use toasts or inline error states.

## 17. Analytics / event tracking

- `lib/analytics.ts` exports `track(name, props)` that:
  - Augments with `role`, `batch_id`, `app_version`, `platform`.
  - Sends to PostHog.
  - No-ops if user opted out of analytics.
- Sampled events (e.g., `dashboard_viewed`) at 20% to save volume.
- Identify user on login; reset on logout.

## 18. Over-the-air updates

- EAS Update configured; branch per environment (`dev`, `staging`, `prod`).
- Every main merge triggers a staging OTA.
- Prod OTAs gated on manual approval from GitHub Actions.
- Release names match Sentry release tags so crashes can be traced to the exact OTA.

## 19. App config (app.config.ts)

- Dynamic config reading env for bundle ids (`com.fynestudy.live.dev` vs `.prod`).
- Plugins: `expo-notifications`, `expo-camera`, `expo-secure-store`, `expo-screen-capture`, `@100mslive/react-native-hms/expo-plugin`.
- Icons, splash, adaptive icons, status bar style.

## 20. Accessibility

- All actionable elements have `accessibilityLabel` and `accessibilityRole`.
- Hit areas ≥ 44×44.
- Respect system font scaling up to 130%.
- Color contrast AA minimum on all text over backgrounds.
- Reduce motion: honor `AccessibilityInfo.isReduceMotionEnabled()` to cut decorative animations.

## 21. Internationalization (light)

- Strings externalized in `src/i18n/en.json` and `hi.json`.
- `i18n-js` or `react-intl`; lazy-load language on demand.
- Default English; add Hindi at launch; accept Hinglish in UX copy where natural.
