# Play Store listing assets — ready to upload

All files verified against Google Play specs (PNG, correct dimensions, well under
size limits). Captured 2026-06-12 from the real FyneStudy app UI with demo data;
the demo data has since been fully removed from the database.

## Where each file goes (Play Console → Grow users → Store presence → Store listings)

| Console field | File(s) | Spec it meets |
|---|---|---|
| App icon | `icon-512.png` | 512×512 PNG, < 1 MB |
| Feature graphic | `feature-graphic.png` | 1024×500 PNG, < 15 MB |
| Phone screenshots | all 8 in `phone/` | 1080×1920 (9:16), < 8 MB each, ≥4 at 1080px+ → promo-eligible |
| 7-inch tablet screenshots | all 8 in `tablet-7/` | 1080×1920 (9:16), sides within 320–3840 px |
| 10-inch tablet screenshots | all 8 in `tablet-10/` | 1440×2560 (9:16), sides within 1080–7680 px |
| Chromebook / Android XR | leave empty | optional — not required to save |
| Video | leave empty | optional |

Upload order = file name order (01 → 09). The numbering puts the strongest
screens first: dashboard, classes, attendance QR, quiz attempt, exam, library,
leaderboard, profile.

`_extra/` holds a 9th screenshot (quiz intro screen) per device size in case you
want to swap one out — Google allows a maximum of 8 per device type.

## What the screenshots show

| # | Screen | What's visible |
|---|---|---|
| 01 | Student dashboard | greeting, 7-day streak flame, next-class card, attendance/mastery/rank stats, today's schedule |
| 02 | My Classes | upcoming class + exam with "Results pending" |
| 03 | Attendance | live rotating QR + today's classes + history (89% rings) |
| 05 | Quiz attempt | timed question with options, flag/clear, navigation |
| 06 | Graded exam | locked exam UI with server timer |
| 07 | Library | Subjects → Chapters → Topics tree |
| 08 | Leaderboard | batch ranks with medals + composite scores |
| 09 | Profile | profile tab with batch/course, locked identity fields |

All names shown (Aarav Sharma, Ananya Gupta, …) were temporary demo accounts,
deleted after capture. No real student data appears anywhere.

## How they were made (if you ever need to regenerate)

The web app (`apps/web`, full visual parity with mobile) was run locally and
captured headless via Playwright + system Edge at exact device resolutions
(phone 360×640 @3x, 7" 720×1280 @1.5x, 10" 720×1280 @2x). Demo data came from
the repo's own `pnpm seed:*-manual-test` scripts, renamed to realistic names,
then deleted row-by-row against a saved ID manifest. Icon + feature graphic are
generated from `brand/fynestudy-logo-master.png`.
