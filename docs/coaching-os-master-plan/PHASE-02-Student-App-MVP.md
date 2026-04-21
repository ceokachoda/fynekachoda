# Phase 02 — Student App MVP

## Goal

Ship the polished student-facing shell: onboarding, dashboard, class schedule, profile, navigation, theme, and empty-state versions of every major tab. By the end of this phase the student journey **looks** production-ready even though attendance/live/recording/payments plug in later.

## Why this phase exists

The client demo is won or lost on the student UI. This phase is the visible product. Every later phase plugs features into shells built here, so the shells must be deliberate, not throwaway.

## Scope

### In-scope
- Full navigation tree with bottom tabs + stack navigators.
- Onboarding + OTP login polished (animations, error states).
- Student dashboard with today's schedule, membership status strip, announcements feed, quick actions.
- Classes tab with Live / Recorded / Upcoming sub-tabs (empty states if no data).
- Library tab with categories (empty states).
- Membership tab (read-only view of current plan, expiry countdown).
- Profile & Settings: name, phone, batch, logout, app version, open-source licenses.
- Theme system (light + dark), typography scale, spacing tokens.
- Loading / error / empty / skeleton states for every screen.
- Offline-aware top banner (NetInfo).
- Push notification token registration on login (fanout comes in P8).
- Splash branding.

### Out-of-scope
- QR attendance screen's real QR (placeholder here, real token in P3).
- Actual live class room (P4).
- Actual recording player (P4 adds the player; this phase lists recordings only).
- Payments / Razorpay (P6).
- Notification fanout backend (P8).

## User roles impacted
Students (90% of this phase). Teachers see the same app with role gating: we wire the role switch here so Phase 7 can light up the teacher UX.

## Screens to build

| # | Route | Screen |
|---|---|---|
| 1 | `/(auth)/phone` | Phone entry with country code picker |
| 2 | `/(auth)/otp` | OTP verification with resend timer |
| 3 | `/(onboarding)/welcome` | First-time tour (3 slides, skippable) |
| 4 | `/(app)/(tabs)/home` | Dashboard |
| 5 | `/(app)/(tabs)/classes` | Classes list with segmented control |
| 6 | `/(app)/classes/[id]` | Class detail (info + join/recording CTAs wired to P4 stubs) |
| 7 | `/(app)/(tabs)/library` | Materials & clips browser |
| 8 | `/(app)/library/[id]` | Material detail (PDF preview placeholder, P5) |
| 9 | `/(app)/(tabs)/membership` | Membership status & history |
| 10 | `/(app)/(tabs)/profile` | Profile & settings |
| 11 | `/(app)/attendance/qr` | QR display (placeholder in P2, real in P3) |
| 12 | `/(app)/notifications` | Notification inbox |
| 13 | `/(app)/announcements/[id]` | Announcement detail |

## Frontend tasks

### Navigation
- Bottom tab bar with 5 tabs: Home, Classes, Library, Membership, Profile.
- A floating action button (FAB) on Home for "My QR" → `/(app)/attendance/qr`.
- Stack navigators inside each tab for detail screens.

### Dashboard composition
- Top: greeting with student first name + batch chip.
- Membership strip: gradient card, days remaining, renew CTA (navigates to Membership tab).
- "Today" section: horizontal card list of today's classes, each card showing subject, time, teacher, and live/scheduled/ended pill.
- "Recent Recordings" horizontal list (max 5, query ordered by `classes.ended_at desc`).
- "New Materials" horizontal list.
- "Announcements" vertical feed at the bottom.

### Data fetching
- `useClassesToday(studentId)` — TanStack Query, 60s stale.
- `useRecentRecordings(studentId)` — 5-minute stale.
- `useRecentMaterials(studentId)` — 5-minute stale.
- `useAnnouncements()` — 10-minute stale, paginated.
- Realtime subscription on `classes` filtered by batch to flip cards live→ended without refresh.

### Theme
- Colors as design tokens in `theme/tokens.ts`: `brand`, `surface`, `muted`, `success`, `warning`, `danger`.
- Typography via `@expo-google-fonts/inter` with fluid scale (11/13/15/17/20/24/32).
- Dark mode supported by NativeWind class strategy (`dark:`).
- Motion: standardized easings and durations in `theme/motion.ts`.

### Components to build (reusable)
- `Screen` (safe area + status bar + background).
- `Card`, `ListItem`, `Avatar`, `Badge`, `Pill`, `ProgressRing`, `Skeleton`, `EmptyState`, `ErrorState`.
- `ClassCard`, `MaterialCard`, `RecordingCard`.
- `Segmented`, `SearchBar`, `BottomSheet` (from `@gorhom/bottom-sheet`).
- `Button` variants: primary, secondary, ghost, destructive.
- `Toast` (from `burnt` or `sonner-native`).

### Platform-specific
- Android: tuned ripple, status bar color per screen.
- iOS: haptic feedback on primary CTAs via `expo-haptics`.

## Backend tasks

All reads go through Supabase views or direct table selects with RLS. No new Edge Functions.

- [ ] Create views:
  - `v_student_today_classes` — classes for student's batch today.
  - `v_student_recent_recordings` — recording content_items for student's batch, last 30 days.
  - `v_student_recent_materials` — pdf/doc/image content_items for student's batch, last 30 days.
- [ ] Policies on views inherit from base tables via SECURITY INVOKER.
- [ ] RPC `register_device_token(token text, platform text)` inserts/updates `device_tokens`.

## Database / data model needs

Uses schema from Phase 1. Adds:
- Optional: `announcements` table (id, title, body, batch_id nullable for global, created_by, created_at, published_at, image_url).

## APIs / services needed
Supabase only. See `API-DESIGN-AND-SERVICE-BOUNDARIES.md` for exact contracts.

## Recommended libraries
| Purpose | Package |
|---|---|
| Icons | `lucide-react-native` |
| Images | `expo-image` (caches, blurhash) |
| Haptics | `expo-haptics` |
| Network status | `@react-native-community/netinfo` |
| Bottom sheet | `@gorhom/bottom-sheet` |
| Toasts | `burnt` |
| Skeleton | `react-content-loader/native` or custom with Reanimated |
| Lists | `@shopify/flash-list` for long lists |

## Edge cases
- Student has no batch assigned yet → show "Waiting for admin to assign your batch" card.
- Student membership expired → show grayed content cards with a lock overlay, tap opens Membership tab.
- No network on cold start → render cached data from AsyncStorage (TanStack Query persister).
- RTL / Hindi fonts: ensure Inter + Noto Sans Devanagari loaded; layout direction remains LTR (RTL not required).
- User changes phone in settings → blocked, direct to "Contact admin".

## Risks
| Risk | Mitigation |
|---|---|
| FlashList + NativeWind perf regressions | Stick to pure StyleSheet on hot paths, NativeWind on static layout. |
| OTP provider delays | Add 30s resend timer + backup channel (email) for demo accounts. |
| Dashboard over-fetching | Use views, set staleTime explicitly, enable Query persister. |

## Dependencies on earlier phases
- Phase 1 complete (auth, schema, types, CI).

## Acceptance criteria
- [ ] Seeded student can log in, complete 3-slide onboarding (or skip), land on dashboard.
- [ ] Dashboard shows today's classes, recent recordings, new materials, announcements from seeded data.
- [ ] Tapping a class opens class detail.
- [ ] All 5 tabs render with empty/filled states.
- [ ] Pull-to-refresh works everywhere.
- [ ] Offline banner appears when network drops.
- [ ] Design review passed against Figma (or documented visual specs).
- [ ] Cold start to dashboard <2.5s on a 4 GB Android test device.

## Definition of done
- All criteria above.
- Storybook (or a RN-compatible equivalent like `@storybook/react-native`) configured for base components.
- Accessibility pass: all tappable elements have `accessibilityLabel` and hit area >= 44×44.
- Sentry has zero unhandled crashes after a 10-minute smoke test.

## Suggested folder / module breakdown

```
apps/mobile/src/
├── features/
│   ├── auth/
│   │   ├── screens/PhoneScreen.tsx
│   │   ├── screens/OtpScreen.tsx
│   │   └── api.ts
│   ├── dashboard/
│   │   ├── screens/HomeScreen.tsx
│   │   ├── components/MembershipStrip.tsx
│   │   ├── components/TodayClasses.tsx
│   │   └── queries.ts
│   ├── classes/
│   ├── library/
│   ├── membership/
│   ├── profile/
│   └── attendance/
├── components/           # generic design system
├── theme/
├── providers/
├── hooks/
└── lib/
```

## Suggested order of implementation

1. Theme tokens, typography, base components (Screen, Button, Card, Badge, Skeleton, EmptyState).
2. Navigation scaffolding: tabs + stacks + guards.
3. Auth polish (animations, keyboard handling, resend timer, error states).
4. Dashboard shell with static data.
5. Wire real queries to Supabase views; implement realtime subscription for classes.
6. Classes tab + detail screen stubs.
7. Library tab + detail stubs.
8. Membership tab (read-only).
9. Profile + settings.
10. Notifications inbox screen.
11. Offline banner + TanStack Query persister.
12. Device token registration on login.
13. Demo-pass: run through journeys 4.1–4.5 from Phase 00 end-to-end.
