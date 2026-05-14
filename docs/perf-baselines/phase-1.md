# Phase 1 — Performance Baselines

Recorded at the end of Phase 1 against the **dev build APK** running on a real Android device. These are the numbers every subsequent phase must hold to (or improve) per `docs/spec/performance.md`.

## Reference device

| Field | Value |
|---|---|
| Device | _(fill in: e.g., Redmi Note 12 5G)_ |
| Android version | _(fill in)_ |
| RAM | _(fill in)_ |
| Wi-Fi | _(fill in: e.g., 5 GHz, 50 Mbps down)_ |

> The MVP perf budget is keyed to **Redmi 8A class** (Android 9, 2 GB RAM, Snapdragon 439) per `decisions.md D-124`. If the baseline device is more powerful, multiply cold-start by 1.5× when comparing to the budget.

## Measurements

| Metric | Phase 1 build | Budget (D-124 / `spec/performance.md`) | Method |
|---|---|---|---|
| Cold start → splash visible | _ms_ | ≤ 3000 ms | Stopwatch from tap → "FyneStudy" logo visible |
| Splash → "Backend: connected" pill | _ms_ | n/a (Phase 1 only) | Stopwatch from logo → green pill flips |
| Splash hides → first screen interactive | _ms_ | n/a (Phase 1 only) | Stopwatch from green pill → OTP screen accepts input |
| Total cold start (tap → interactive) | _ms_ | ≤ 3000 ms (under load) | Sum of above |
| Bundle size (APK on-device) | _MB_ | ≤ 35 MB OTA | `adb shell pm path com.fynestudy.app` then size of base.apk |

## Methodology

1. Install the EAS development APK on the reference device.
2. Connect to Wi-Fi (same network the Supabase URL resolves on).
3. Force-stop the app: `adb shell am force-stop com.fynestudy.app` (or Settings → Force Stop).
4. Launch with stopwatch ready.
5. Record three measurements; take the median.

## Notes

- Phase 1's splash overlay enforces a `MIN_SPLASH_MS = 1500` floor in `app/_layout.tsx`. Cold-start measurements should be interpreted with this in mind — actual JS/native startup may be faster; the splash is held for at least 1.5 s for UX consistency.
- This baseline becomes the canonical comparison point for every later phase. Phase 2's auth wiring adds work to splash → first screen path; Phase 3+ feature work shouldn't regress cold start past 3 s.
- If the reference device cold-starts in over 5 s, file an issue against `spec/performance.md` and review bundle composition before continuing past Phase 1 acceptance.
