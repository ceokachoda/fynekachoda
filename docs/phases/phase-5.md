# Phase 5 — Study Materials Library

> Library navigation (Course → Subject → Chapter → Topic → ContentItem). Videos hosted on Unlisted YouTube + wrapped player. PDFs in Supabase Storage with per-page watermark. Teacher upload flow. Admin moderation. Progress tracking for resume.

---

## 1. Goal

Make the institute's content available end-to-end. Videos and PDFs work on low-end Android. Watermarks discourage leakage. Same playback infrastructure that Phase 9 will reuse for live classes.

## 2. Prerequisites

- [ ] Phase 4 accepted.
- [ ] Institute's YouTube channel created (a Google account dedicated to the institute; YT Studio login enabled).
- [ ] At least 1 sample video uploaded to the channel as **Unlisted** (we'll fetch its URL during Phase 5 testing).
- [ ] Decide: do videos remain on YT for Phase 5, or proxied? → **YT directly** (D-060). Phase 9 will introduce the OAuth-based broadcast creation; Phase 5 only needs the teacher to paste a YT URL.
- [ ] 2–3 sample PDFs (lecture notes) to upload during testing.

## 3. Scope

### In
- DB: `content_items`, `video_progress`, `pdf_progress`.
- RLS: content read scoped to course + batch (`batch_id IS NULL` = course-wide).
- Storage buckets created: `study-materials`, `profile-pictures`.
- Edge functions: `content-presign-upload`, `content-finalize`, `content-create-video`, `content-toggle-publish`, `content-promote-coursewide`, `yt-thumb-sign`.
- Mobile student: rebuild `(student)/library.tsx` with hierarchy navigation; add `(student)/video/[id].tsx` (wrapped YT player with watermark), `(student)/pdf/[id].tsx` (in-app reader with watermark + page memory).
- Mobile teacher: `(teacher)/content.tsx` (upload PDF / link YT video).
- Admin: `/content` (moderation, promotion, search).
- Wrapped YT player component reused later by Phase 9 live classes.
- Watermark library (`lib/watermark.ts`).
- Video & PDF progress tracking → drives "Continue Watching" in dashboard (Phase 8).

### Out
- Live class broadcasts via YT API (Phase 9).
- Search by PDF full-text content (defer).
- In-app rich-text notes (deferred, D-064).
- Offline downloads (rejected for MVP, D-133).
- Audio-only lessons.

## 4. Specs in play

- `docs/spec/study-materials.md` — primary.
- `docs/spec/performance.md §5.4, §5.5` (library + PDF perf rules).
- `docs/spec/security.md §6` (Storage signed URLs).
- `docs/decisions.md` D-060 to D-067.

## 5. Backend work

### 5.1 Migration: content_items + progress (Checkpoint 1)

`supabase/migrations/0010_content_library.sql`:

```sql
create table public.content_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('video','pdf','note')),
  title        text not null,
  topic_id     uuid not null references public.topics(id) on delete restrict,
  batch_id     uuid references public.batches(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete restrict,
  yt_video_id  text,                            -- server-only for kind='video'
  file_path    text,                            -- Storage path for kind in ('pdf','note')
  duration_sec int,
  uploaded_by  uuid not null references public.app_users(id),
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

create index content_topic_kind_idx on public.content_items (topic_id, kind);
create index content_course_batch_idx on public.content_items (course_id, batch_id);

-- Constraint: video has yt_video_id; pdf/note has file_path
alter table public.content_items add constraint content_payload_ck check (
  (kind = 'video' and yt_video_id is not null and file_path is null)
  or (kind in ('pdf','note') and file_path is not null and yt_video_id is null)
);

create table public.video_progress (
  student_id      uuid not null references public.students(user_id) on delete cascade,
  content_id      uuid not null references public.content_items(id) on delete cascade,
  position_sec    int not null default 0,
  watched_pct     numeric not null default 0,
  last_watched_at timestamptz not null default now(),
  primary key (student_id, content_id)
);

create table public.pdf_progress (
  student_id  uuid not null references public.students(user_id) on delete cascade,
  content_id  uuid not null references public.content_items(id) on delete cascade,
  last_page   int not null default 1,
  updated_at  timestamptz not null default now(),
  primary key (student_id, content_id)
);
```

### 5.2 Migration: content RLS (Checkpoint 2)

`supabase/migrations/0011_content_rls.sql`:

```sql
alter table public.content_items enable row level security;
alter table public.video_progress enable row level security;
alter table public.pdf_progress  enable row level security;

-- Student reads content in their course where batch_id IS NULL or = their batch
create policy content_student_read on public.content_items for select to authenticated
  using (
    is_published = true
    and course_id = (
      select b.course_id from public.students s
      join public.batches b on b.id = s.batch_id
      where s.user_id = public.current_app_user_id()
    )
    and (
      batch_id is null
      or batch_id = (select batch_id from public.students where user_id = public.current_app_user_id())
    )
  );

create policy content_teacher_read on public.content_items for select to authenticated
  using (
    public.has_role('teacher')
    and (
      batch_id is null
      or batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
    )
  );

create policy content_admin on public.content_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Writes go through edge fns only.

-- Progress tables: student self read/write
create policy vp_self on public.video_progress for all to authenticated
  using (student_id = public.current_app_user_id()) with check (student_id = public.current_app_user_id());

create policy pp_self on public.pdf_progress for all to authenticated
  using (student_id = public.current_app_user_id()) with check (student_id = public.current_app_user_id());
```

### 5.3 Storage buckets (Checkpoint 3)

Via Supabase dashboard or migration:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('study-materials', 'study-materials', false, 52428800, array['application/pdf','image/jpeg','image/png']),
  ('profile-pictures', 'profile-pictures', false, 5242880, array['image/jpeg','image/png','image/webp']);

-- Storage RLS: deny all direct access; signed URLs only.
create policy "deny-all-storage" on storage.objects for all to authenticated using (false);
-- (Service-role bypasses RLS for edge fn use.)
```

### 5.4 Edge fn: content-presign-upload (Checkpoint 4)

`apps/functions/content-presign-upload/index.ts`:

Input: `{ kind: 'pdf'|'note', topic_id, title, batch_id?, content_size_bytes, mime_type }`

Steps:
1. Verify teacher caller; verify topic belongs to a course they teach (via `batch_teachers` → `batches.course_id`) OR admin.
2. Validate size ≤ 50 MB; mime in allowlist.
3. Generate file path: `{course_id}/{topic_id}/{uuid}.pdf`.
4. Generate signed upload URL (`storage.from('study-materials').createSignedUploadUrl(path)`).
5. Return `{ upload_url, path, expires_at }`.

### 5.5 Edge fn: content-finalize (Checkpoint 5)

`apps/functions/content-finalize/index.ts`:

Input: `{ path, topic_id, title, kind, batch_id? }`

Steps:
1. Verify caller; same as presign.
2. Verify file actually exists at path (HEAD request to storage).
3. Insert `content_items` row.
4. Audit.
5. Return content_item.

### 5.6 Edge fn: content-create-video (Checkpoint 6)

`apps/functions/content-create-video/index.ts`:

Input: `{ yt_url_or_id, topic_id, title, batch_id? }`

Steps:
1. Verify caller.
2. Extract YT video ID via regex.
3. Call YouTube Data API `videos.list?id=...&part=snippet,status,contentDetails` with the institute's API key.
4. Verify:
   - Video exists.
   - `status.privacyStatus === 'unlisted'`.
   - `snippet.channelId === INSTITUTE_CHANNEL_ID` (Vault-stored).
5. Parse `contentDetails.duration` (ISO 8601) to seconds.
6. Insert `content_items` with `kind='video'`, `yt_video_id`, `duration_sec`, `file_path=null`.
7. Audit.
8. Return row.

(Same fn used in Phase 9 when wiring live recordings, with different inputs.)

### 5.7 Edge fn: yt-thumb-sign + yt-playback-sign (Checkpoint 7)

`apps/functions/yt-thumb-sign/index.ts`:
- Returns proxied thumbnail URL or directly the YT thumbnail URL with the video ID — to avoid leaking yt_video_id in DOM. Actually, since the wrapped player will need the ID to play, the cleanest is to issue a signed payload (next bullet) and pull the thumbnail server-side.
- For MVP simplicity, return `https://i.ytimg.com/vi/{id}/mqdefault.jpg` directly. The ID leaks via thumbnail too — accept this trade-off (already documented).

`apps/functions/yt-playback-sign/index.ts`:
- Input: `{ content_id }`
- Verify caller has access (matches RLS logic).
- Compose payload: `{ v:1, kind:'lesson', video_id, watermark_text: "{first_name} • ••{phone_last_4}", exp: now + 4h, sig }`.
- HMAC with `PLAYBACK_SIGN_SECRET_V1`.
- Return.

### 5.8 Edge fn: content-toggle-publish + content-promote-coursewide (Checkpoint 8)

Admin or owner; toggles `is_published` or sets `batch_id = NULL`. Audit.

### 5.9 Mobile lib: wrapped YT player (Checkpoint 9)

`apps/mobile/lib/yt-player.ts`:

Wraps `react-native-youtube-iframe`:
- Takes `signedPayload`.
- Verifies signature client-side (public key shipped).
- Renders iframe with: `controls=0&modestbranding=1&rel=0&disablekb=1&fs=0`.
- Mounts watermark overlay (`components/live/Watermark.tsx`).
- Calls `onProgress` every 15s with `position`, `watched_pct`.
- Unmounts cleanly on screen blur.

`components/live/Watermark.tsx`:
- Text overlay rendered via `Animated.View` with translation across 4 corners every 60s.
- Alpha 0.25 white text with dark shadow.

### 5.10 Mobile screens (Checkpoint 10)

`apps/mobile/app/(student)/library.tsx` — rebuild:
- Top: search bar.
- Subject grid (queries `subjects` for student's course).
- Tap → chapter list.
- Tap → topic list.
- Tap → content list (videos, pdfs, notes grouped).

`apps/mobile/app/(student)/video/[contentId].tsx`:
- Loads `content_items` row by id (RLS scoped).
- Calls `yt-playback-sign`.
- Mounts WrappedYtPlayer with payload.
- "Resume from X:XX?" sheet if `video_progress.position_sec > 30`.
- Speed control via player API.
- Progress updates every 15s.

`apps/mobile/app/(student)/pdf/[contentId].tsx`:
- Calls Storage `createSignedUrl(path, 3600)`.
- Mounts `react-native-pdf` with the URL.
- Watermark overlay per page via `react-native-pdf`'s `singlePage` mode + RN overlay.
- `pdf_progress.last_page` persisted on page change.

### 5.11 Teacher upload UI (Checkpoint 11)

`apps/mobile/app/(teacher)/content.tsx`:
- Picker: kind (Video / PDF / Note).
- Topic picker (cascades from teacher's batches' course).
- Title.
- Scope: "My Batch" / "Suggest to Admin (course-wide)".
- If Video: YT URL input → calls `content-create-video`.
- If PDF/Note: `DocumentPicker.getDocumentAsync` → upload via signed URL → finalize.

Progress bar during upload.

### 5.12 Admin: content moderation (Checkpoint 12)

`apps/admin/app/(dashboard)/content/page.tsx`:
- Filter by course / batch / kind / status.
- Preview inline.
- Actions: publish/unpublish, promote course-wide, delete.

## 6. Files changed (summary)

### Mobile — added
- `app/(student)/video/[contentId].tsx`
- `app/(student)/pdf/[contentId].tsx`
- `app/(teacher)/content.tsx`
- `components/library/SubjectTile.tsx`, `ChapterAccordion.tsx`, `ContentRow.tsx`
- `components/live/WrappedYtPlayer.tsx`, `Watermark.tsx`
- `lib/yt-player.ts`, `lib/pdf.ts`, `lib/watermark.ts`
- `features/library/useLibraryTree.ts`, `useContentItem.ts`, `useVideoProgress.ts`, `usePdfProgress.ts`

### Mobile — edited
- `app/(student)/library.tsx` — completely rebuilt
- `app/(student)/_layout.tsx` — keeps Library tab (no rename)

### Edge fns added
- `content-presign-upload`, `content-finalize`, `content-create-video`, `content-toggle-publish`, `content-promote-coursewide`, `yt-thumb-sign`, `yt-playback-sign`

### Storage
- Buckets `study-materials`, `profile-pictures` created with RLS deny + service-role-only.

### Admin
- `/content` page

### Shared
- `packages/shared/src/validation/contentSchemas.ts`
- `packages/shared/src/constants/content.ts` (max sizes)

## 7. Integration & cross-cutting

- Audit: `content_create_video`, `content_create_pdf`, `content_publish`, `content_unpublish`, `content_promote`, `content_delete`.
- Telemetry: `content_opened`, `video_watched_quarter` (25/50/75/100%), `pdf_page_changed`.
- HMAC: `PLAYBACK_SIGN_SECRET_V1` in Vault (alongside QR secret).
- Storage egress is the main cost driver — PostHog tracks egress per content_id.

## 8. Risks & gotchas

| Risk | Mitigation |
|---|---|
| WebView memory creep on long video sessions | Only one mounted at a time; explicit cleanup on blur; verified with profiler. |
| PDF >50 MB upload silently fails | Presign fn rejects size up front; client shows clear error. |
| YT URL on wrong channel pasted | `content-create-video` verifies channelId against `INSTITUTE_CHANNEL_ID`. |
| Watermark perf on weak GPU (PDF reader) | Use plain Text overlay per page, no animations on PDF; tested on Redmi 8A. |
| Signed URL expires mid-playback (PDF) | PDFs use 1h URL; videos use 4h. Player refreshes URL on 401 transparently. |
| YT API quota for `videos.list` calls | Cheap — 1 unit per call. 10,000/day cap. Safe. |
| RLS double-join (course_id derivation) slow | Index on `students.batch_id` + denormalized `course_id` on content_items makes query fast. |
| Teacher uploads adult content as a prank | Admin moderation queue + audit + ability to delete; institute policy is human-enforced. |

## 9. Acceptance criteria

1. Migrations clean. Storage buckets created and private.
2. Teacher uploads a 10 MB PDF via mobile → progress bar → content appears in library.
3. Teacher links a YT video URL → video appears in library.
4. Student opens library → drills Subject → Chapter → Topic → sees the new video and PDF.
5. Student plays video → wrapped player loads, no YT logo visible, watermark visible.
6. Watermark text matches "{first name} • ••{phone last 4}".
7. Watermark rotates corner every ~60s.
8. Student leaves screen, returns → "Resume from X:XX" prompt; resume works.
9. Student opens PDF → renders in-app; no system share/download menu accessible.
10. PDF has per-page watermark.
11. PDF page memory: leave at page 12, return → opens at page 12.
12. Student in batch B does NOT see content batch_id-scoped to batch A.
13. Admin promotes a batch-scoped content to course-wide → student in batch B sees it now.
14. Admin unpublishes content → student no longer sees it (RLS).
15. Wrong-channel YT URL rejected with clear error.
16. >50 MB PDF upload rejected with clear error.
17. Video watch ≥50% inserts `activity_days` row (drives streak in Phase 8).
18. Cold start budget still under 3s.
19. Memory profile during 30-min video playback stays under 350 MB.
20. CI green; RLS tests added for content visibility.

## 10. Test plan

### Unit
- Watermark text formatter (handles missing phone).
- YT URL parser (multiple URL formats).
- ISO 8601 duration parser.

### Integration
- `content-create-video`: valid YT, wrong channel, public video rejected, deleted video rejected.
- `content-presign-upload`: size + mime checks; non-teacher rejected.
- `content-finalize`: rejects if file missing at path.

### RLS
- Content visibility: batch A student vs batch B student vs course-wide.
- Teacher can read course-wide and their batch's content.

### Manual QA (real device)
- Redmi 8A: video plays at 360p without stutter on 4G; battery drain 60-min < 8%.
- iPhone 8: same.
- PDF reader: pinch zoom doesn't crash; page turn smooth.
- Long-session: watch 30 min video, switch screens, return — no memory leak (verify with profiler).

### Cross-platform
- Android: webview cookies don't leak across sessions.
- iOS: ATS allows Supabase + YT domains; no warnings.

## 11. Rollback plan

If Phase 5 breaks:
1. Revert migrations 0010, 0011.
2. Storage buckets stay; orphaned objects acceptable.
3. Mobile library reverts to "Coming soon" placeholder.

## 12. Definition of done

- [ ] All 20 AC pass.
- [ ] Watermark perf verified on reference device.
- [ ] Memory ceiling not exceeded.
- [ ] CI green.
- [ ] User says "Phase 5 accepted".

## 13. Hand-off to Phase 6

- `content_items` populated.
- WrappedYtPlayer ready for reuse by live + quiz "Related video" links.
- Phase 6 builds the question bank + practice quizzes; the "related video" link in solution view points to `content_items`.

## 14. Acceptance ledger — Phase 5 (2026-05-18)

All 12 checkpoints (CP1–CP12) green; CP13 wraps tests + advisor sweep + ledger.
DB: 5 new migrations applied. Edge fns: 7 deployed.  Mobile: 3 new screens + 5 components/libs + 4 feature hooks. Admin: 1 new dashboard page + server-action set.

### Checkpoints

| CP  | Subject | Outcome | Where |
|-----|---------|---------|-------|
| CP1 | `content_items` + `video_progress` + `pdf_progress` migration | ✅ applied | `supabase/migrations/20260518090000_content_library.sql` |
| CP2 | RLS for content + progress | ✅ applied; uses `private.*` helpers (D-146) | `supabase/migrations/20260518090500_content_rls.sql` |
| CP3 | Storage buckets + lockdown policy | ✅ applied; `study-materials` (50 MB / pdf+image) + `profile-pictures` (5 MB / image); deny-all on `storage.objects` | `supabase/migrations/20260518091000_storage_content_buckets.sql` |
| CP4 | `content-presign-upload` edge fn | ✅ deployed; size/mime check, teacher-batch scope check, returns signed upload URL+token | `apps/functions/content-presign-upload/index.ts` |
| CP5 | `content-finalize` edge fn | ✅ deployed; HEAD-by-list verify; audits `content_create_pdf`/`note` | `apps/functions/content-finalize/index.ts` |
| CP6 | `content-create-video` edge fn | ✅ deployed; YT URL parser (6 formats); calls Data API when `YT_DATA_API_KEY` Vault key is present; rejects non-Unlisted / non-institute / >3h; idempotent on `yt_video_id` | `apps/functions/content-create-video/index.ts` |
| CP7 | `yt-playback-sign` + `yt-thumb-sign` | ✅ deployed; 4-h HMAC envelope; watermark text server-issued; new `PLAYBACK_SIGN_SECRET_V1` Vault secret; new `public.get_vault_secret(name)` accessor | `apps/functions/yt-playback-sign/index.ts`, `yt-thumb-sign/index.ts`, `supabase/migrations/20260518091500_playback_secret_accessor.sql` |
| CP8 | `content-toggle-publish` + `content-promote-coursewide` | ✅ deployed; admin-only; audits `content_publish/unpublish/promote/unpromote` | `apps/functions/content-toggle-publish/index.ts`, `content-promote-coursewide/index.ts` |
| CP9 | `WrappedYtPlayer` + `Watermark` + `PdfWatermark` + libs | ✅ wired; single WebView, autoplay on mount, pauses on blur; watermark rotates 5 positions every 60 s on player; 3×4 rotated grid on PDF | `apps/mobile/components/live/WrappedYtPlayer.tsx`, `Watermark.tsx`, `PdfWatermark.tsx`, `lib/yt-player.ts`, `lib/pdf.ts`, `lib/watermark.ts` |
| CP10 | Student library rebuilt + video + PDF screens | ✅ wired; library is 4-level navigation with search; video calls `yt-playback-sign` with Resume-from-X:XX sheet; PDF uses WebView + pdf.js with page memory and viewport watermark | `apps/mobile/app/(student)/library.tsx`, `app/video/[contentId].tsx`, `app/pdf/[contentId].tsx`, `apps/mobile/features/library/*` |
| CP11 | Teacher upload UI | ✅ wired; cascading pickers (course→subject→chapter→topic), batch-scope or course-wide, YT URL OR DocumentPicker→signed-upload PUT (XHR with progress)→finalize | `apps/mobile/app/(teacher)/content.tsx`, `features/library/useTeacherCurriculum.ts` |
| CP12 | Admin /content moderation | ✅ wired; filter by course/batch/kind/status/title-search, CSV export, publish toggle, promote/un-promote, delete | `apps/admin/app/(dashboard)/content/page.tsx`, `content-client.tsx`, `actions.ts` |
| CP13 | Tests + RLS smoke + advisor sweep + ledger | ✅ done | this entry |

### Migrations applied (5 new)

| Timestamp | Name | Purpose |
|-----------|------|---------|
| 20260518090000 | `content_library` | tables + indexes + payload check |
| 20260518090500 | `content_rls` | 9 policies across 3 tables |
| 20260518091000 | `storage_content_buckets` | 2 buckets + deny-all `storage.objects` policy |
| 20260518091500 | `playback_secret_accessor` | service-role-only `public.get_vault_secret(name)` RPC |
| 20260518092000 | `content_updated_at_search_path` | advisor 0011 sweep — explicit `search_path` on new trigger fn |

### Edge functions deployed (7 new)

`content-presign-upload`, `content-finalize`, `content-create-video`,
`yt-playback-sign`, `yt-thumb-sign`, `content-toggle-publish`,
`content-promote-coursewide`. All deployed via Supabase CLI 2.99 (`functions deploy --use-api`) against project `orqwyazvcthgxoadfxfv`. `verify_jwt = true` on all 7.

### Vault secrets

- `PLAYBACK_SIGN_SECRET_V1` — 48 random hex bytes, used by `yt-playback-sign`. Same rotation pattern as `QR_TOKEN_SECRET_V1`.
- `YT_DATA_API_KEY` (and `INSTITUTE_CHANNEL_ID`) — **not yet provisioned**. The `content-create-video` fn falls back to accept-without-verify when absent (Phase 5 dev mode). Provisioning is on the Phase 9 ops checklist.

### Tests + smokes

- `pnpm test:content` — pure-TS unit smoke covering YouTube URL parser (10 cases), ISO 8601 duration (6 cases), watermark formatter (4 cases), playback HMAC roundtrip (5 cases). **25/25 green.**
- `pnpm smoke:content-rls` — end-to-end RLS smoke creates an ephemeral course + 2 batches + student A/B + teacher T1 + 4 content rows, then exercises 7 scenarios across PostgREST: batch-A student sees A+coursewide only; batch-B student sees B+coursewide only; teacher T1 sees A+coursewide only; anon sees 0; student insert blocked; student writes own progress; student spoof for another student blocked. **7/7 green.**
- `pnpm test --filter @fynestudy/mobile` — 6 suites / 53 tests including the new `lib/watermark.test.ts`. **53/53 green.**
- `pnpm typecheck` — every workspace package green.
- `pnpm lint` — every workspace package green.

### Advisor sweep

| Lint | Status |
|------|--------|
| `function_search_path_mutable` on `_content_items_updated_at` | **FIXED** via migration 20260518092000. |
| `auth_leaked_password_protection` | Carry-over from Phase 1 backlog. Toggled in Supabase Auth settings — not a code change. |
| `auth_rls_initplan` on `app_users.app_users_self_read` | Carry-over from Phase 2/3 backlog (D-146 chain). Re-wrapping `auth.uid()` as `(select auth.uid())` is a Phase-7 polish. |
| `unindexed_foreign_keys` (3 new for Phase 5: `content_items.batch_id`, `video_progress.content_id`, `pdf_progress.content_id`) | INFO. Reads are always through PK + parent FK; query plans favour the existing composite indexes. Tracked. |
| `unused_index` (4 new: `content_course_batch_idx`, `content_course_published_idx`, `content_uploaded_by_idx`, `video_progress_recent_idx`, `pdf_progress_recent_idx`) | Brand-new tables with zero traffic. Will flip to "used" as soon as the admin dashboard runs filters and the dashboard pulls the Continue Watching feed in Phase 8. |
| `multiple_permissive_policies` on `content_items`, `video_progress`, `pdf_progress` | Intentional. Same role-segmented pattern documented for Phase 3 (D-152 reasoning). No fix planned. |

### Hard-learned lessons / new decisions

- **D-166 (2026-05-18):** All `public.*` SECURITY DEFINER trigger fns ship with `set search_path = public, pg_temp` from day one. Caught by advisor 0011 on `_content_items_updated_at`; sweep migration 20260518092000 fixes it. **How to apply:** new triggers added in Phase 6+ should already have `search_path` set.
- **D-167 (2026-05-18):** The `pnpm install` patch for `react-native-css-interop@0.2.3` is fragile — its hunk header counts must exactly match (`@@ -A,B +C,D @@`). When pnpm rejects with `ERR_PNPM_INVALID_PATCH`, count by hand: original lines = ctx + removed = B; new lines = ctx + added = D. **Why:** Phase 4 D-161 introduced the patch. Phase 5 broke it once; corrected. **How to apply:** when editing any patch in `patches/`, re-count hunk header before committing.
- **D-168 (2026-05-18):** Mobile uses a `<WebView>`+`pdf.js` reader instead of `react-native-pdf` because the spec needs to work in Expo Go and on EAS dev clients without native module rebuilds. pdf.js is loaded from `cdnjs.cloudflare.com` — bundling locally is a Phase 9 hardening item. **Why:** `react-native-pdf` needs a custom dev client; Phase 5 ships first to the user's existing Expo Go. **How to apply:** the existing low-end-device rule "one WebView at a time" still holds — the PDF reader screen never coexists with `WrappedYtPlayer`.
- **D-169 (2026-05-18):** `video/[contentId].tsx` and `pdf/[contentId].tsx` live at `app/video/` and `app/pdf/` (TOP-level), not inside the `(student)` tab group — mirrors Phase 4 D-157 (roster outside `(teacher)` tabs). **Why:** keeps the player full-screen without the tab bar pushing the watermark or wasting vertical space. **How to apply:** any future fullscreen reader/player goes at top level.
- **D-170 (2026-05-18):** Supabase CLI deploy can't read `supabase/config.toml` if it contains keys from older CLI versions (`refresh_token_rotation_enabled`). Phase 5 worked around it by deploying from a temp workdir (`/tmp/sb-deploy`) with a minimal `config.toml`. **How to apply:** when the CLI gets upgraded across projects, audit `config.toml` against the latest schema before running `functions deploy`. The workaround is a temp-workdir + minimal config — do NOT mutate the real `config.toml` (it's the source of truth for Phase 1 setup).

### Files changed (summary)

**Mobile — added:** `app/video/[contentId].tsx`, `app/pdf/[contentId].tsx`, `components/live/WrappedYtPlayer.tsx`, `components/live/Watermark.tsx`, `components/live/PdfWatermark.tsx`, `lib/yt-player.ts`, `lib/pdf.ts`, `lib/watermark.ts`, `lib/watermark.test.ts`, `features/library/{useLibraryTree,useContentItem,useVideoProgress,usePdfProgress,useTeacherCurriculum}.ts`

**Mobile — edited:** `app/(student)/library.tsx` (full rebuild), `app/(teacher)/content.tsx` (full rebuild), `app/_layout.tsx` (added `video/[contentId]` and `pdf/[contentId]` to Stack), `package.json` (added `expo-document-picker`, `expo-file-system`, `expo-screen-capture`, `react-native-webview`, `react-native-youtube-iframe`)

**Edge fns — added:** `apps/functions/{content-presign-upload,content-finalize,content-create-video,yt-playback-sign,yt-thumb-sign,content-toggle-publish,content-promote-coursewide}/index.ts`

**Shared — added/edited:** `apps/functions/_shared/{playback,youtube,watermark}.ts` (new), `_shared/schemas.ts` (+9 schemas), `_shared/vault.ts` (+`getPlaybackSecrets`, prefer `get_vault_secret` RPC)

**Migrations — added:** `20260518090000_content_library.sql`, `20260518090500_content_rls.sql`, `20260518091000_storage_content_buckets.sql`, `20260518091500_playback_secret_accessor.sql`, `20260518092000_content_updated_at_search_path.sql`

**Admin — added:** `apps/admin/app/(dashboard)/content/{page,content-client,actions}.tsx`

**Admin — edited:** `apps/admin/app/(dashboard)/layout.tsx` (+Content nav item)

**Scripts — added:** `scripts/test-content-helpers.ts`, `scripts/smoke-test-content-rls.ts`. New npm scripts `test:content`, `smoke:content-rls` in root `package.json`.

**Patches — regenerated:** `patches/react-native-css-interop@0.2.3.patch` (corrected hunk header counts).

### Phase 5 carry-overs into Phase 6

- All §10 manual QA on real low-end device (Redmi 8A) — user-directed manual session.
- `YT_DATA_API_KEY` + `INSTITUTE_CHANNEL_ID` Vault provisioning (Phase 9 ops).
- Bundle pdf.js locally instead of CDN (Phase 9 hardening).
- Sentry + PostHog wiring (long-running Phase 1 carry-over).
- `auth_leaked_password_protection` toggle (long-running Phase 1 carry-over).
- `auth_rls_initplan` on `app_users` (Phase 2/3 carry-over).

### Phase 5 status: **CODE-COMPLETE — manual QA in progress, PR pending**

Work sits uncommitted on `phase-4` branch; user will direct the consolidated PR.

---

### Post-ledger audit (2026-05-18, same day, "ultrathink" pass)

A full A-to-Z verification surfaced two real bugs that the original
ledger didn't catch. Both are now fixed and re-verified by automated tests.

**Bug B1 — Student PDF signed URL was blocked by deny-all storage RLS.**
- Root cause: `supabase.storage.from(...).createSignedUrl(...)` requires
  SELECT on `storage.objects`. The deny-all `deny_all_content_objects`
  policy (migration `20260518091000`) denies that for all
  authenticated/anon callers — so the mobile PDF reader could never get
  a signed URL despite the user being able to see the row in
  `content_items`.
- Fix: new edge fn `content-pdf-sign` (`apps/functions/content-pdf-sign/index.ts`).
  Performs the RLS check via the user-client read of `content_items`,
  then service-roles the `createSignedUrl` call. Mirrors the
  `yt-playback-sign` access-control pattern.
- Mobile change: `apps/mobile/lib/pdf.ts → createSignedPdfUrl(contentId)`
  now invokes the edge fn (passes content_id, not file_path). The
  `pdf/[contentId].tsx` screen calls it with `item.id`.
- Verified: `pnpm smoke:content-fns` includes 3 assertions (200 happy,
  400 on video, signed URL actually serves the bytes via GET).

**Bug B2 — Admin "Delete content" bypassed `audit_log`.**
- Root cause: the original `deleteContentAction` server action called
  `supabase.from('content_items').delete()` directly against the admin's
  user-client. RLS allowed it (via `content_admin_all`) but no audit
  row was written. Violates CLAUDE.md hard rule: "Every admin write
  produces an `audit_log` row".
- Fix: new edge fn `content-delete` (`apps/functions/content-delete/index.ts`).
  Snapshots the row, deletes via service role, writes a
  `content_delete` audit entry. Admin action calls it via `callEdgeFn`.
- Verified: `pnpm smoke:content-fns` includes assertion that an
  `audit_log` row with `action='content_delete'` is written after the
  call returns 200.

**Subtle bug — `pdfJsViewerHtml` URL escaping.**
- Original used `replace(/"/g, "&quot;")` to escape the URL into a JS
  string literal inside an HTML `<script>` tag. HTML-encoding doesn't
  decode inside `<script>` content, so quotes in the URL (rare but
  possible) would have broken the JS. Swapped to
  `JSON.stringify(signedUrl)` which produces a valid JS string literal
  for any input.

**Total Phase 5 edge fns: 9** (up from 7):
1. content-presign-upload
2. content-finalize
3. content-create-video
4. yt-playback-sign
5. yt-thumb-sign
6. content-toggle-publish
7. content-promote-coursewide
8. **content-pdf-sign** (NEW — audit-pass fix B1)
9. **content-delete** (NEW — audit-pass fix B2)

**New decisions from the audit pass:**

- **D-171 (2026-05-18):** PDF signed-URL issuance MUST go through an edge
  fn — `createSignedUrl` from the mobile client is incompatible with
  the deny-all `storage.objects` policy. Pattern: user-client reads the
  parent table (RLS check), service-role creates the signed URL.
  Mirrors `yt-playback-sign`. **How to apply:** any future Storage
  download from mobile uses this 2-step pattern.

- **D-172 (2026-05-18):** Admin server actions that mutate via PostgREST
  (not via an existing edge fn) MUST be routed through an edge fn so
  `audit_log` captures before/after. `content-delete` is the
  reference pattern. **How to apply:** any future admin Delete /
  metadata-patch button gets its own minimal edge fn.

**Manual test plan written:** `docs/phases/phase-5-manual-tests.md`.
Covers admin /content moderation (§A — 11 steps), teacher upload UI
(§B — 13 steps), student library navigation including cross-batch RLS
visual checks (§C — 7 steps), wrapped YT player with watermark
verification (§D — 7 steps), in-app PDF reader with watermark and
page memory (§E — 6 steps), SQL sanity (§F), and performance +
cross-platform (§G). Each step is click-by-click with exact expected
output. New `pnpm seed:content-manual-test` script seeds the fixtures.

**Additional automated test:** `pnpm smoke:content-fns` —
**30 assertions** covering every Phase 5 edge fn end-to-end via HTTP
including:
- All 9 fns happy/sad paths.
- `audit_log` write verification for `content_delete`, `content_publish`,
  `content_unpublish`, `content_promote`, `content_unpromote` — with
  explicit before/after JSON comparison.
- `yt-playback-sign` watermark text equals `formatWatermark(full_name,
  phone)` byte-for-byte for the test student.
- `content-pdf-sign` signed URL actually serves the underlying PDF bytes
  (GET round-trip).

**Re-verified after bug fixes + smoke extension:**
- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm test --filter @fynestudy/mobile` — 53/53 ✅
- `pnpm test:content` — 25/25 ✅
- `pnpm smoke:content-rls` — 7/7 ✅
- `pnpm smoke:content-fns` — 30/30 ✅
- Supabase security advisor sweep — only Phase-1 backlog item remains ✅

**Manual test plan trimmed.** `docs/phases/phase-5-manual-tests.md`
now contains ONLY items that require human eyes or a real device:
visual UI rendering (admin browser + mobile), watermark on-screen
visibility + 60 s rotation animation, real iframe video playback +
audio, PDF rendering inside the WebView, native DocumentPicker, screenshot
blocking on Android, cold-start budget on a real low-end device, iOS
parity, long-session memory check, airplane-mode recovery. Every
functional behavior (RLS, audit, signed URLs, schema validation, etc.)
was lifted into the automated smoke and removed from the manual list.

---

### Manual QA pass — 2026-05-19 (iOS Expo Go on iPhone)

Per `docs/phases/phase-5-manual-tests.md` §I report:

| Section | Result |
|---|---|
| §A admin /content moderation (A1–A7 reported, A8–A11 covered) | ✅ ok |
| §B teacher mobile upload UI (B1–B9) | ✅ ok |
| §C student mobile library nav (C1–C7) | ✅ ok |
| §D wrapped YT player + watermark (D1–D7) | ✅ ok (D6 per spec caveat) |
| §E student PDF reader + watermark (E1–E6) | ✅ ok |
| §G1 Redmi 8A cold-start | ⏸ deferred — hardware blocker (Phase 6 carry) |
| §G2 iOS parity | ✅ implicitly — D + E run on iOS |
| §G3 long-session memory check | ⏸ deferred (Phase 6 carry, optional) |
| §G4 airplane-mode recovery | ⏸ deferred (Phase 6 carry, optional) |
| §H agent auto-verified items | ✅ automated smokes green (see above) |

### Post-QA bug-fix patches (2026-05-19)

Six defects surfaced during manual QA and were patched on the
`phase-4` working branch before declaring Phase 5 done. Each is a
one-file change; no migrations, no edge fn redeploys.

| # | Symptom | File | Root cause | Fix |
|---|---------|------|------------|-----|
| 1 | Admin `/content` Next.js hydration mismatch error on the created-at column | `apps/admin/app/(dashboard)/content/content-client.tsx:316` | `new Date(...).toLocaleString()` with no locale → server (en-US, Node) and client (en-IN, browser) produced different strings inside a Client Component | Pin to `toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })` so SSR + client agree |
| 2 | Student library: tapping Physics crashed with `Maximum update depth exceeded` cascading from `Invariant Violation: Changing numColumns on the fly is not supported` | `apps/mobile/app/(student)/library.tsx` | React reused a single FlatList instance across the four ternary branches (same component type in same position); `numColumns` mutated 2→1 on the live instance | Stable `key={view}` per FlatList — each branch remounts cleanly |
| 3 | Student video screen crashed with `RNCWebView` view-config getter undefined | `apps/mobile/metro.config.js` | (a) `react-native-webview` resolved via its `"react-native": "src/index.ts"` field → un-transformed `codegenNativeComponent('RNCWebView')` reached the runtime; (b) `react-native` subpath imports (`react-native/Libraries/NativeComponent/NativeComponentRegistry`) dodged the existing SINGLETON dedup → registration written to one Map, lookup read from the other | (a) Pin `react-native-webview` → `lib/index.js` (pre-codegen-transformed); (b) extend dedup to subpath matches via `isSingletonRequest(moduleName)` |
| 4 | Library catalog stale after admin promote/unpublish; required app reboot to see changes | `apps/mobile/app/(student)/library.tsx`, `apps/mobile/features/library/useLibraryTree.ts` | Hook only fetched on mount; tab navigator keeps Library mounted across other-tab focus; `refresh` wrapper was a fresh closure each render (first attempt at `useFocusEffect` looped) | `useFocusEffect(() => void refresh())` in screen + `useCallback`-wrap the combined `refreshBoth` in the hook for stable identity |
| 5 | Resume sheet (D5) never appeared even with saved progress visible on screen | `apps/mobile/app/video/[contentId].tsx:74` | Trigger threshold `position_sec > 30` too strict — progress saves every 15 s, so realistic playback often saved at 26–28 s and missed the window | Threshold lowered to `> 10` |
| 6 | PDF reader: pinch-zoom always centred on top-left, AND after zooming, panning was blocked | `apps/mobile/lib/pdf.ts` + `apps/mobile/app/pdf/[contentId].tsx:157` | (a) `#v { position:absolute; inset:0; overflow:auto }` wrapper made the visual viewport zoom origin compute from layout (0,0) instead of pinch midpoint; (b) `<WebView scrollEnabled={false} />` mapped to iOS `scrollView.isScrollEnabled=NO`, which disables the post-zoom pan gesture (pinch and pan are separate recognizers on WKWebView) | (a) Drop the inner-scroll wrapper, body scrolls (window scroll listener for page-change detection, `position:fixed` for spinner/err); (b) Remove `scrollEnabled={false}` |

### New decisions from manual QA — D-173, D-174

- **D-173 (2026-05-19) — YT iframe player on mobile cannot deliver "zero
  visible chrome + autoplay-with-audio" simultaneously.** With
  `controls=0` the iframe refuses to programmatically autoplay (it uses
  the visible play button as a user-gesture proxy). An opaque tap-overlay
  to "block visible chrome from being tappable" also blocks the very tap
  that grants the autoplay-audio user gesture, so even tap-to-play breaks
  the audio path. Spec §D6 explicitly accepts "small YouTube logo still
  shows", so keep `controls=1` and the modestbranding/rel/iv_load_policy
  trim. If a stricter chrome-free reader is needed later it must be a
  full tap-to-play screen with our own play button — a real screen
  rewrite, not a prop flip. **How to apply:** when wrapping YT in any
  future phase (Phase 9 live classes), do NOT switch `controls` to 0
  without delivering a custom play-gesture surface and verifying audio.

- **D-174 (2026-05-19) — In-WebView PDF readers must use BODY-level
  scroll, NOT an inner `overflow:auto` wrapper, AND must leave the
  WebView's `scrollEnabled` at its default `true` on iOS.** The inner
  wrapper breaks the WebView's visual viewport zoom origin (always
  jumps to top-left); `scrollEnabled={false}` disables the iOS
  UIScrollView's pan gesture, which is the SAME gesture that handles
  pan-after-zoom (pinch and pan are separate recognizers). Either change
  alone visibly breaks PDF UX. **How to apply:** any future in-app
  WebView reader (e.g. Phase 9 bundled local pdf.js, Phase 10 graded
  PDFs) follows the body-scroll pattern and leaves WebView scroll on.

### Test-data hygiene note (not a code decision)

The `pnpm seed:content-manual-test` script is re-runnable but does NOT
clean up prior runs — each invocation creates a new `p5-stu-1-<ts>@…`
account, a new "P5 Batch A <ts>" batch, a new course, and a fresh
subject/chapter/topic tree. During this QA two seed runs existed
side-by-side; a teacher upload made under one seed's UI picker was
invisible to the student logged in under the other seed (correct RLS,
wrong fixture). Future manual-QA passes should either (a) re-run the
seed and use the freshly printed credentials end-to-end, or (b) add a
flag to the seed script that wipes prior `p5-*` rows before reseeding.

### Phase 5 status: **✅ ACCEPTED — 2026-05-19**

CP1–CP13 green; audit pass shipped 2 extra edge fns; 6 manual-QA
patches landed; D-166…D-174 memorialised. Work sits uncommitted on
the `phase-4` working branch awaiting the consolidated PR. Carry-overs
into Phase 6:

- §G1 cold-start measurement on Redmi 8A (hardware).
- §G3 long-session memory + §G4 airplane-mode (optional spot-checks).
- `YT_DATA_API_KEY` + `INSTITUTE_CHANNEL_ID` Vault provisioning (Phase 9 ops).
- Bundle pdf.js locally instead of CDN (Phase 9 hardening).
- `auth_leaked_password_protection` toggle (long-running Phase 1 backlog).
- `auth_rls_initplan` on `app_users` (Phase 2/3 polish).
- Seed-script cleanup flag (test hygiene; see note above).
- True zero-chrome video reader, if/when product wants it (see D-173).
