# Spec: Performance & Low-End Device Rules

> Every feature must work on the bottom-tier Indian student phone. This doc is the playbook. When in doubt, simpler beats fancier.

---

## 1. Target Device & Budgets

**Reference device:** Redmi 8A class (Android 9, 2 GB RAM, Snapdragon 439 / 4×A53 1.95 GHz, 32 GB storage, 720×1520 display).

**iOS reference:** iPhone 8 (iOS 14+, 2 GB RAM, A11).

**Budgets:**

| Metric | Target |
|---|---|
| Cold app start (login → dashboard skeleton) | < 3.0s |
| Cold app start (login → dashboard fully painted) | < 5.0s |
| Warm start | < 1.0s |
| Screen-to-screen navigation (cached data) | < 200 ms |
| Pull-to-refresh response | < 1.5s |
| OTA update size | < 35 MB |
| Store install size (.aab / .ipa) | < 80 MB |
| Memory ceiling during normal use | < 250 MB |
| Memory ceiling during live class (WebView + chat) | < 350 MB |
| JS frame rate during scroll | ≥ 50 fps |
| Battery: 60-min live class watch | < 8% drain |
| Network footprint: dashboard load | < 200 KB after cache |
| Network footprint: 60-min live class | < 250 MB (YT adaptive bitrate at 360p default) |

When a PR busts a budget, that's a blocker.

## 2. Rendering Rules

### 2.1 Lists

- Anything that may exceed **20 items** uses `FlatList` / `SectionList` with:
  - `keyExtractor` set
  - `initialNumToRender = 10`
  - `maxToRenderPerBatch = 8`
  - `windowSize = 7`
  - `removeClippedSubviews = true` on Android
  - `getItemLayout` whenever item height is fixed
- No `ScrollView` with hundreds of children.
- Inline `renderItem` functions wrapped in `useCallback` to avoid re-renders.
- `React.memo` on list row components with explicit prop equality.

### 2.2 Images

- Use **`expo-image`** (not `react-native/Image`) everywhere:
  - `cachePolicy="memory-disk"`
  - Explicit `width` and `height`
  - `contentFit="cover"`
  - `transition={150}` only when in viewport
- Source images: pre-sized to display size; don't ship 2000×2000 PNGs to render at 80×80.
- Avatars: 96×96 max, JPEG quality 80, served as WebP when possible.
- Badge icons: SVG (`react-native-svg`), each < 4 KB.
- Banner images: avoided in MVP. If required, lazy-loaded below the fold.

### 2.3 Animations

- **Default duration: 200 ms.** No 500 ms transitions.
- Use Reanimated 4 worklets for any animation tied to scroll position or gestures.
- Standalone fades / slides can use Animated API (lighter for one-shot).
- **No infinite animations** on idle screens (e.g., no constantly pulsing dots on dashboard — animate only when a live class is starting).
- Respect `AccessibilityInfo.isReduceMotionEnabled`: skip transitions, use opacity 0/1 flip instead.
- Skeletons (already implemented for dashboard, classes, library): shimmer at 1000 ms cycle on mid-tier; reduced to plain grey on low-end if `isReduceMotionEnabled`.

### 2.4 Re-renders

- Co-locate state with consumers; lift only when shared.
- TanStack Query `select` to project minimal data to consumers.
- `useMemo` for expensive derived values, never for primitives.
- Avoid passing inline objects as props.
- Profile with `react-devtools-profiler` before adding `useMemo` everywhere — measure first.

## 3. Memory Management

### 3.1 WebView (Wrapped YT Player)

- **Only one WebView mounted at a time.** When the student leaves the live/recording/video screen, unmount.
- Set `mediaPlaybackRequiresUserAction={false}`, `allowsInlineMediaPlayback={true}` on iOS.
- Disable JavaScript console exposure in production builds.
- Use `react-native-youtube-iframe` `onReady` and `onChangeState` callbacks to manage memory: pause when backgrounded, destroy when navigating away.
- Inject CSS via `injectedJavaScript` to hide native YT controls (the wrapper does this; verify).

### 3.2 PDFs

- Use `react-native-pdf` with `enablePaging={true}` to avoid loading the entire document.
- Set `cache={true}`, `cacheFileNameSuffix` keyed by content_id.
- Limit zoom to 3x (default is 10x, blows memory).
- Unmount the viewer on screen blur.

### 3.3 Realtime Subscriptions

- **Always unsubscribe** on screen unmount: pattern is
  ```ts
  useEffect(() => {
    const ch = supabase.channel(...).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deps]);
  ```
- Chat: keep last **50 messages** in memory; older fetched on scroll-to-top with pagination.
- Presence channels (live class viewer count): leave on unmount.

### 3.4 Cache budgets

- TanStack Query: `gcTime = 1000 * 60 * 10` (10 min) by default.
- Image cache: `expo-image` defaults are fine; periodically `clearMemoryCache()` on `lowMemory` warning.
- AsyncStorage: ≤ 1 MB total; only non-sensitive metadata (last-seen counters, course IDs).

## 4. Network Strategy

### 4.1 Initial paint first

- Dashboard renders skeleton from cached server snapshot **before** firing any fetch.
- Then issues fetches in parallel via `useQueries` (see `spec/student-dashboard.md §5`).
- Re-renders happen as each query resolves, not in a single waterfall.

### 4.2 Optimistic updates

- Quiz/exam option select → write goes via Supabase upsert, UI updates instantly, retry on failure.
- Attendance correction → instant pill flip, with rollback toast on server error.

### 4.3 Prefetch

- Hover/preview cards: `queryClient.prefetchQuery` on press-down (Android) / hover-equivalent.
- Class entering "about to live": prefetch playback config 60 seconds before scheduled_start.

### 4.4 Compression

- All edge functions return gzip-compressed JSON (Supabase handles automatically).
- PDFs are not gzip'd (already compressed); Storage serves directly.
- Images served as WebP when client supports it (`expo-image` handles content negotiation).

### 4.5 Retries

- TanStack Query default retry × 3 with exponential backoff.
- Exempt: exam-submit (idempotent; we retry until success or window close).

### 4.6 Offline behavior

- Show last-cached data with a yellow "offline" banner.
- Mutations that can't reach the server: queued in a transient store and surfaced as "Pending — will retry when online".
- No service worker / true offline mode for MVP.

## 5. Per-Screen Performance Rules

### 5.1 Dashboard

- Single SQL function `student_dashboard(student_id)` returns a JSON blob with all cards in one round trip when warm.
- Skeleton renders first (already implemented).
- No animations except subtle skeleton shimmer + streak flame.
- Realtime subscriptions limited to: `sessions` (status changes) + `attendance` (own student_id).

### 5.2 Live Class

- WebView + Realtime chat must coexist within the 350 MB ceiling.
- Watermark overlay: a single `Animated.View` with one position animation per minute (not per frame).
- Chat virtualization at 50 messages; older lazy-loaded.
- Disable raise-hand presence broadcast batching beyond what Realtime gives by default.
- On backgrounded app: WebView pauses; Realtime stays subscribed only if app returns within 30s.

### 5.3 Exam

- **No Reanimated**, no charts, no images outside question content.
- Plain `View` + `Text` layout.
- Auto-save debounced 500 ms.
- Server-time sync: every 60 s via small HTTP GET; timer interpolates between syncs.
- Tab-switch handler is fire-and-forget — never blocks the UI.
- Question grid (30 cells): rendered as a static `View` matrix, not a `FlatList`.

### 5.4 Library

- Hierarchy navigation: each level fetches only that level's children. No bulk load.
- Search results capped at 50 with pagination.
- Video thumbnails fetched from YT's `i.ytimg.com/vi/{video_id}/mqdefault.jpg` (low-res) — but routed through our edge fn to avoid leaking video IDs on the wire (`yt-thumb-sign`).

### 5.5 PDF Reader

- One page rendered at a time (paging mode).
- Watermark overlay is a single `Text` per page, not animated.
- Pinch-to-zoom rate-limited to 30 events/sec.

### 5.6 Leaderboard

- Single view query at 60s `staleTime`.
- No live updates (rolling rank doesn't need realtime).
- Avatar lazy-loaded with `expo-image` priority="low".

## 6. Bundle Size Discipline

### 6.1 Audit gate

CI step `pnpm size-check`:
- Runs `npx expo export` for the production target.
- Compares bundle size against last known good.
- Blocks PR if delta > 200 KB without justification.

### 6.2 Heavy dependencies (avoid or justify)

- `moment` → use `date-fns` (tree-shakeable) or native Intl.
- `lodash` whole import → import per-method (`import debounce from 'lodash/debounce'`).
- Multiple icon libraries → `lucide-react-native` only.
- Multiple charting libs → none in mobile MVP (admin uses Recharts).
- Multiple PDF libs → `react-native-pdf` only.

### 6.3 Tree shaking

- All `packages/*` are ESM with `"sideEffects": false`.
- Imports use named imports, never `import * as Foo`.

### 6.4 Hermes

- Hermes engine enabled (default in Expo SDK 54).
- Static initialization minimized (no module-level expensive computation).

## 7. Build-time Optimizations

- Babel plugin to strip `console.*` in production: `transform-remove-console`.
- Sentry source-map upload only in production builds, not dev.
- Inline requires (already default in Metro): defer module loads until first use.
- ProGuard / R8 enabled for Android release builds (default in EAS).
- Asset compression: PNGs run through `imagemin` in CI.

## 8. Profiling & Monitoring

### 8.1 Local

- Flipper Performance plugin
- React DevTools Profiler
- Android Studio Profiler (CPU, memory) for native concerns
- Xcode Instruments (Memory Graph, Time Profiler) for iOS concerns

### 8.2 In-app metrics

- PostHog events for navigation timing:
  - `nav_start` → `nav_end` per route
  - `query_resolved` per major query with duration
- Sentry performance tracing on key transactions: login flow, exam submission, live class join.

### 8.3 Regression watch

- Sentry alerts when:
  - p95 transaction duration regresses > 30% week-over-week
  - JS error rate exceeds 0.5% of sessions
  - Cold start (custom event) p95 > 4.0s

## 9. Battery & Data

- Disable haptics on Android low-power mode.
- Pause auto-fetch / Realtime when battery < 15%.
- Live class default to 360p; user can bump to 480p / 720p manually (settings to expose later).
- PDF prefetch never runs on mobile data unless user opts in (Settings → "Use mobile data for downloads").

## 10. Accessibility (cross-cutting)

- All interactive elements have `accessibilityRole` + `accessibilityLabel`.
- Touch targets ≥ 44×44.
- Contrast ratio ≥ 4.5:1 for text on background.
- Screen reader announcements for status changes (attendance marked, badge earned, exam submitted).
- Reduced motion respected (see §2.3).

## 11. Internationalization (Future-Proofing)

- All user-visible strings live in `apps/mobile/lang/en.ts` (single file for MVP).
- No string concatenation for sentences; use ICU-style templates.
- Date/time formatting via `Intl.DateTimeFormat` with explicit locale.
- This avoids future rework when Hindi / regional ships.

## 12. Edge-Case Performance

| Case | Mitigation |
|---|---|
| Student opens app in a 4-hour exam window | Cap concurrent state subscriptions; pause Realtime if not on live screen |
| 600 students all open dashboard at 8 AM | Cache + CDN; Supabase pgBouncer handles ~5000 req/min comfortably |
| Teacher scans 30 students in 2 minutes | `attendance-qr-verify` is fast; sequential calls fine |
| Live class with 250 viewers + 100 chat msgs/min | Realtime channel handles; client virtualizes display |
| Library upload of 50 MB PDF on weak 3G | Resumable upload via Storage; progress bar; retry on disconnect |
| 600 weekly parent reports on Sunday | Edge fn processes in batches of 25, 4 concurrent renders, total run ~3–5 minutes |

## 13. Anti-Patterns to Watch For

- Multiple WebViews mounted simultaneously.
- Realtime subscriptions that never unsubscribe.
- `console.log` in hot paths (strip in CI but watch in PR review).
- Re-rendering large lists on every keystroke.
- Inline `() => {}` props on memoized children.
- Importing whole `lodash` / `moment`.
- Spawning timers without clearing them.
- `await` chains that should be `Promise.all`.

## 14. Performance Review Checklist (Per Feature)

When merging a feature that touches a perf-sensitive area:

- [ ] List virtualization confirmed (>20 items)
- [ ] WebView lifecycle clean
- [ ] Realtime unsubscribes verified
- [ ] No new heavy dependencies
- [ ] Animations respect reduce-motion
- [ ] Skeleton loader present for slow paths
- [ ] Cold-start time measured (no regression)
- [ ] Memory profile run on reference device
- [ ] Bundle size delta < 200 KB

## 15. Open Items

- Establish baseline metrics on Redmi 8A before backend wiring begins; archive in `docs/perf-baselines/`.
- Consider Hermes bundle splitting for student vs teacher feature sets (defer until bundle > 60 MB).
- Evaluate `react-native-skia` for any custom drawing (charts, heatmaps) — only adopt if Recharts/SVG is too slow.
