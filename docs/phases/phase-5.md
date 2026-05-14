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
