# Phase 05 — Study Materials & Clip System

## Goal

Give students a real library: upload, browse, preview, and (for PDFs) download study materials; plus let teachers cut "clips" from recordings and publish them as standalone short videos for revision.

## Why this phase exists

The library is a daily-use surface for students, and clips are a strong differentiation point over WhatsApp-group delivery. Materials land first because they're trivially demoable; clips land second because they leverage the Phase 4 recording pipeline.

## Scope

### In-scope
- Upload materials (PDF/image/doc/link) via admin/teacher panel with batch + course + subject taxonomy.
- Student library browser: tabs for Materials / Clips, filterable by subject + batch + type, searchable by title.
- PDF inline preview with zoom & pagination.
- Image preview with pinch-zoom.
- PDF/file download to device (with DRM caveats).
- Teacher clip-marker: while viewing a recording (in teacher app), mark start/end timestamps, title, description → server clips the recording.
- Clip playback uses the same Bunny HLS player from Phase 4.
- Visibility rules: `public` (any authenticated user), `batch` (specific batch), `course` (specific course), `enrolled_only`, `membership_only`.

### Out-of-scope
- Video download for offline.
- Collaborative notes / annotations on PDFs.
- Assignment submissions (future).
- AI-generated clip suggestions (future).

## User roles impacted
- Student: browse, preview, download (where allowed).
- Teacher: upload, clip from recordings.
- Admin: full CRUD + moderation.

## Screens to build
### Student (RN)
- `/(app)/library` — tabs (Materials, Clips, Recent) with filter bar.
- `/(app)/library/[id]` — detail view: PDF inline reader, image viewer, or clip player.
- `/(app)/library/search` — search results.

### Teacher (RN)
- `/(teacher)/uploads/new` — upload wizard: pick file → set metadata → visibility → publish.
- `/(teacher)/recordings/[id]/clip` — timeline scrubber with in/out markers, preview, save clip.

### Admin (Next.js) — built here, polished in P7
- `/admin/content` — table view, filters, bulk actions.
- `/admin/content/new` — upload.
- `/admin/content/[id]` — edit.

## Frontend tasks

### Library browser
- [ ] Filters: subject (chips), batch (if admin/teacher has multi-batch access), content type, date range.
- [ ] Sort: most recent, most viewed.
- [ ] Pagination: cursor-based infinite scroll via FlashList.
- [ ] Thumbnails: Bunny-generated thumbs for video; first-page render for PDFs (done server-side at upload time).
- [ ] Offline: last 50 items cached via TanStack Query persister; downloads use `expo-file-system`.

### PDF reader
- [ ] `react-native-pdf` — supports HTTPS + local file.
- [ ] Toolbar: zoom, page jump, outline, share.
- [ ] Watermark: student's name + phone as diagonal low-opacity overlay to discourage redistribution.

### Clip creator (teacher)
- [ ] Horizontal timeline scrubber over the recording's HLS stream.
- [ ] Two draggable handles for in/out; live preview of selection.
- [ ] Title, description, visibility metadata form.
- [ ] Submit → POST `create-clip` with `{ source_content_id, in_seconds, out_seconds, title, ... }`.
- [ ] Status toast: "Your clip is being processed" → realtime flip to "Clip ready".

## Backend tasks

### Schema
```sql
alter table content_items
  add column visibility_rule text not null default 'enrolled_only',
  add column parent_content_id uuid references content_items(id) on delete set null,
  add column clip_in_seconds int,
  add column clip_out_seconds int,
  add column thumbnail_path text,
  add column status text not null default 'ready'; -- uploading|processing|ready|failed|deleted

create index on content_items (batch_id, type, created_at desc);
create index on content_items (course_id, type, created_at desc);
```

### Storage
- Supabase Storage bucket: `materials` (private, signed URL access).
- Bunny Stream Library: `clips`.
- Thumbnails stored in Supabase Storage bucket `thumbs` (public with cache control).

### Edge Functions
- `upload-material-url` — returns a signed upload URL for Supabase Storage; caller provides target path + metadata.
- `finalize-material` — called by client after upload completes; creates `content_items` row; if PDF, triggers a `generate-thumbnail` async job.
- `generate-thumbnail` — pg_cron picked up; uses PDF.js (Deno) or a small Cloudflare Worker to render page 1 → PNG → upload to `thumbs`.
- `create-clip` — teacher/admin only; calls Bunny Stream Clipping API with `source_video_id + in + out`; creates a new video asset; on webhook, writes new `content_items` row.
- `clip-ready-webhook` — Bunny callback, flips `status` to `ready`, notifies enrolled students.
- `request-material-url` — student-authenticated; returns signed URL for a material if visibility rules allow.

### Visibility enforcement (RLS + Edge Function)
```sql
-- Helper: does this user see this content?
create function content_visible(content_items, uuid) returns boolean ...
-- Encodes rules: public | batch | course | enrolled_only | membership_only
-- Used in SELECT policies on content_items.
```

Signed URL issuance is gated by the same function — RLS alone isn't enough once the URL leaves Supabase.

## Database / data model needs
Additions above. `content_items` already exists from Phase 1.

## APIs / services needed
- Supabase Storage (uploads).
- Bunny Stream Clipping API.
- Edge Functions listed above.

## Third-party integrations
- **Bunny Stream** clipping.
- Optional: **PDF.js** (Deno) for thumbnail generation.

## Recommended libraries
| Purpose | Package |
|---|---|
| PDF reader | `react-native-pdf` |
| Image zoom | `react-native-image-zoom-viewer` or `expo-image` + `react-native-gesture-handler` |
| File picker (upload) | `expo-document-picker`, `expo-image-picker` |
| File download | `expo-file-system` |
| Search | Postgres full-text via generated column; frontend uses `useDebouncedValue` |

## Edge cases
- Corrupted PDF upload → `generate-thumbnail` fails → `status='failed'` → admin sees red badge in P7.
- Very large PDF (>50MB) → client-side size check rejects; recommend splitting.
- Student tries to preview a material they don't have access to → UI never shows the item (RLS filters), and direct URL access is rejected by `request-material-url`.
- Clip start > end or range beyond source duration → validated server-side.
- Source recording deleted after clip exists → we set `parent_content_id` null but keep the clip (Bunny asset is independent).

## Risks
| Risk | Mitigation |
|---|---|
| PDF piracy | Watermark each preview with student phone number; downloads only with watermark; accept this is not DRM. |
| Storage bloat | Lifecycle rule: deleted content_items remain in Storage for 30 days (soft delete), then purged by pg_cron. |
| Bunny clipping API latency | UI shows processing state; don't block upload flow. |

## Dependencies on earlier phases
- Phase 1 (schema, storage).
- Phase 4 (recordings exist, Bunny integration live) for clips.
- Phase 2 (library tab shell) for browsing.

## Acceptance criteria
- [ ] Admin can upload a PDF via web panel and it appears in the student library within 1 minute with a thumbnail.
- [ ] Student can open the PDF inline with zoom, swipe pages, and see their own name watermarked.
- [ ] Student without matching visibility doesn't see the item in the list and gets 403 if they guess the URL.
- [ ] Teacher can open a recording in teacher app and mark a 30-second clip; clip appears in student library within 5 minutes.
- [ ] Download button saves PDF to device with proper filename.
- [ ] Search returns PDF by title + description tokens.

## Definition of done
- All acceptance criteria.
- Unit tests on visibility function for every rule.
- E2E test uploading one of each content type.
- Storage usage dashboard in admin (list top 20 largest items) — minimal version ok; full in P7.

## Suggested folder / module breakdown

```
apps/mobile/src/features/library/
├── screens/
│   ├── LibraryScreen.tsx
│   ├── MaterialDetailScreen.tsx
│   ├── ClipPlayerScreen.tsx
│   └── SearchScreen.tsx
├── components/
│   ├── ContentCard.tsx
│   ├── FilterBar.tsx
│   └── PdfReader.tsx
├── hooks/
│   ├── useContentList.ts
│   ├── useContentItem.ts
│   └── useDownload.ts
└── api.ts

apps/mobile/src/features/clips/
├── screens/ClipCreatorScreen.tsx
├── components/TimelineScrubber.tsx
└── api.ts

supabase/functions/
├── upload-material-url/
├── finalize-material/
├── generate-thumbnail/
├── request-material-url/
├── create-clip/
└── clip-ready-webhook/
```

## Suggested order of implementation

1. Schema additions + visibility helper function + RLS tests.
2. `upload-material-url` + `finalize-material` + `request-material-url` Edge Functions.
3. Admin web upload form (minimal) + generate-thumbnail worker.
4. Student library browser + FilterBar.
5. PDF reader + watermark.
6. Image viewer.
7. Clip creator (teacher) + `create-clip` Edge Function.
8. `clip-ready-webhook`.
9. Search (Postgres FTS generated columns).
10. E2E pass.
