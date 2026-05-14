# Spec: Study Materials (Library)

Browsable library of video lessons, PDFs, and notes organized by **Course → Subject → Chapter → Topic**. Videos are Unlisted YouTube (same wrap as live classes). PDFs live in Supabase Storage. Both in-app only — no downloads.

---

## 1. Goals

- Drill from course down to a specific topic in three taps.
- Watch videos through the same wrapped YT player students already know from live classes.
- Read PDFs in-app with bookmark / page memory.
- Teachers upload material targeted to a batch (default) or promoted course-wide by admin.
- Content scoping enforced by RLS.

## 2. Non-Goals (MVP)

- Offline downloads.
- In-app rich-text notes (notes are uploaded PDFs).
- AI summaries / "explain this section".
- Highlighting / annotation.
- Per-student notes attached to content.
- Audio-only lessons.

## 3. Hierarchy

```
Course (JEE Main / JEE Adv / NEET UG / CUET UG)
└── Subject (Physics / Chemistry / Biology / Mathematics …)
    └── Chapter (Kinematics, Thermodynamics, Vectors, …)
        └── Topic (Projectile Motion, Heat Engines, …)
            └── Content Item
                ├── Video (yt_video_id)
                ├── PDF   (file_path → Supabase Storage)
                ├── Note  (file_path → Supabase Storage; PDF or image)
                └── Quiz  (link to quizzes table)
```

Each content item has `topic_id` (required), `batch_id` (optional — null = course-wide), `course_id` (denormalized for fast filtering).

## 4. Visibility & Scoping

Default: when a teacher uploads a content item, `batch_id = teacher's batch`. Only that batch's students see it.

Admins (or owner) can **promote** a content item: set `batch_id = NULL`. Now every student in the same `course_id` sees it.

RLS:

```sql
create policy "content_student_read" on public.content_items
  for select to authenticated
  using (
    is_published = true
    AND (
      course_id = (
        select b.course_id from public.students s
        join public.batches b on b.id = s.batch_id
        where s.user_id = public.current_app_user_id()
      )
      AND (
        batch_id IS NULL
        OR batch_id = (select batch_id from public.students where user_id = public.current_app_user_id())
      )
    )
  );
```

Teachers read everything in batches they teach + course-wide. Admins read all.

## 5. Browse UI

`(student)/library.tsx`:

```
┌──────────────────────────────────────┐
│  Library                             │
│  [Search content…]                   │
├──────────────────────────────────────┤
│  Subjects                            │
│   ┌──────┐  ┌──────┐  ┌──────┐       │
│   │ Phys │  │ Chem │  │ Bio  │       │
│   └──────┘  └──────┘  └──────┘       │
└──────────────────────────────────────┘
```

Tap Physics →

```
┌──────────────────────────────────────┐
│ ◀ Physics                            │
│  ▾ Mechanics                         │
│     ▸ Vectors          12 items      │
│     ▸ Kinematics       18 items      │
│     ▸ Newton's Laws    14 items      │
│  ▸ Thermodynamics                    │
│  ▸ Optics                            │
└──────────────────────────────────────┘
```

Tap Kinematics →

```
┌──────────────────────────────────────┐
│ ◀ Kinematics                         │
│                                      │
│  Projectile Motion                   │
│   ▶ Video: Intro (12:30)             │
│   ▶ Video: Worked Examples (18:42)   │
│   📄 PDF: Lecture Notes              │
│   📝 PDF: Practice Sheet             │
│   📊 Quiz: Quick 15  (best 92%)      │
│                                      │
│  Relative Motion                     │
│   ▶ Video: 1D Relative (15:00)       │
│   ...                                │
└──────────────────────────────────────┘
```

## 6. Search

- Top search bar searches across content titles (`ILIKE %query%`) within the student's accessible scope (RLS-filtered).
- Future: full-text on PDF contents using Supabase pgvector — deferred.

## 7. Video Player

Same wrapped YT player as live classes (`components/live/WrappedYtPlayer`).

`(student)/video/[contentId].tsx`:

```
┌──────────────────────────────────────┐
│ ◀ Intro to Projectile Motion         │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  [Wrapped player]              │  │
│  │  Watermark: "Aarav • ••56"     │  │
│  └────────────────────────────────┘  │
│                                      │
│  [⚙ Speed 1x ▾]  [⏯ Pause]           │
│                                      │
│  Description (if any)                │
│                                      │
│  Resume from 4:32 last time? [Resume]│
└──────────────────────────────────────┘
```

Features:
- Speed controls 0.5x / 1x / 1.25x / 1.5x / 2x (via YT iframe API).
- Auto-resume from `video_progress.position_sec` if returning.
- Watermarked overlay (server-issued).
- Picture-in-picture (Android only, opt-in).

### 7.1 Progress tracking

A `video_progress` table:

```sql
create table public.video_progress (
  student_id uuid not null references public.students(user_id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  position_sec int not null default 0,
  watched_pct  numeric not null default 0,
  last_watched_at timestamptz not null default now(),
  primary key (student_id, content_id)
);
```

Client posts updates every 15 seconds while playing (debounced). Server-side, `watched_pct >= 50%` triggers an `activity_days` insert (counts toward streak).

## 8. PDF Reader

`(student)/pdf/[contentId].tsx` using `react-native-pdf`:

```
┌──────────────────────────────────────┐
│ ◀ Lecture Notes — Kinematics    7/24 │
├──────────────────────────────────────┤
│                                      │
│   [PDF page rendered]                │
│                                      │
├──────────────────────────────────────┤
│  ◀ Prev    [Go to page…]    Next ▶   │
└──────────────────────────────────────┘
```

Features:
- Loads from a 1-hour signed Storage URL.
- Page memory: `pdf_progress(student_id, content_id, last_page)` table; resumes on return.
- Pinch-to-zoom.
- No download, no share, no print (we hide native share affordances; cannot fully prevent OS-level screenshots — acceptable risk for MVP).

### Watermark — implementation detail

We do **not** modify the PDF bitmap or re-render per page (those approaches multiply storage per student or fight `react-native-pdf`'s rendering pipeline).

Instead: a **viewport-level overlay** — a single absolutely-positioned `<View>` sibling to the `<Pdf>` component, covering the visible area, with:
- Rotated text "{first_name} • ••{phone_last_4}" at 45°
- Repeated in a 3×4 grid across the viewport (so any crop still shows ≥1 occurrence)
- Alpha 0.20, white text with 1px dark shadow
- `pointerEvents="none"` so it doesn't block touches
- Re-rendered only when the watermark string or viewport size changes (cheap)

This is page-agnostic — watermark always covers what's on screen regardless of which page is displayed.

## 9. Upload (Teacher)

`(teacher)/content.tsx`:

```
┌──────────────────────────────────────┐
│ Upload Content                       │
│ Kind:  ◉ Video  ◯ PDF  ◯ Note        │
│ Topic: [Projectile Motion ▾]         │
│ Title: [Intro to Projectile Motion]  │
│ Scope: ◉ My Batch  ◯ Suggest        │
│                                      │
│ ── if Video ──                       │
│  YouTube URL: [_______________]      │
│  (must be Unlisted on our channel)   │
│                                      │
│ ── if PDF/Note ──                    │
│  [Pick file]   (max 50 MB)           │
│                                      │
│   [Upload]                           │
└──────────────────────────────────────┘
```

Video flow:
- Teacher uploads to the institute's YouTube channel (Unlisted), pastes the URL.
- Edge fn `content-create-video` validates the URL belongs to our channel (via YT Data API) and extracts `yt_video_id` + duration.
- `content_items` row created.

PDF/Note flow:
- Teacher selects file (≤50 MB).
- App requests a signed upload URL from `content-presign-upload` edge fn.
- App PUTs directly to Supabase Storage.
- App calls `content-finalize` with `file_path` → row created.

Admin moderation:
- If teacher chose "Suggest" (course-wide promotion), `content_items.is_published = false` until admin approves.
- Admin panel `content` page lists pending items.

## 10. Note on YouTube as Video Host

Same trade-offs as live classes. The video is Unlisted, watermarked at playback, URL not exposed in normal UX. A determined adversary with debug access can extract the `yt_video_id` — mitigated, not eliminated. Acceptable for MVP.

## 11. Telemetry

- `library_subject_opened` `{ subject_id }`
- `library_chapter_opened` `{ chapter_id }`
- `content_opened` `{ content_id, kind }`
- `video_watched_quarter` `{ content_id, pct }` (fires at 25/50/75/100%)
- `pdf_page_changed` `{ content_id, page }`

## 12. Security Considerations

- Storage buckets private. Signed URLs short-lived.
- PDF and video URLs never logged or exposed in client console.
- RLS enforces course + batch scope on every content read.
- Watermark applied at playback for both videos (in YT iframe overlay) and PDFs (per-page render overlay).
- Search results are RLS-filtered — students can't enumerate other batches' content via partial title matches.
- Upload size and MIME type validated server-side at presign time.

## 13. Edge Cases

| Case | Behavior |
|---|---|
| Student opens video while offline | Loading spinner → timeout → "Connection required for video." |
| PDF >50 MB upload | Presign fn rejects; UI shows "File too large." |
| Teacher pastes a YT URL not on our channel | `content-create-video` rejects; "Video must be uploaded to the institute channel." |
| Video gets DMCA-struck on YT | `yt-playback-sign` fails on next load; admin alerted. |
| Topic deleted while content references it | FK on `content_items.topic_id` is `on delete restrict` — admin must move content first. |

## 14. Data Model Touchpoints

- `courses`, `subjects`, `chapters`, `topics`, `content_items`
- `video_progress`, `pdf_progress`
- Storage buckets: `study-materials`

## 15. Edge Function Map

| Function | Caller | Action |
|---|---|---|
| `content-presign-upload` | Teacher | Validate kind/size, issue Storage upload URL |
| `content-finalize` | Teacher | Persist `content_items` row after upload completes |
| `content-create-video` | Teacher | Validate YT URL on our channel, persist `content_items` |
| `content-toggle-publish` | Admin | Approve / unpublish |
| `content-promote-coursewide` | Admin | Set `batch_id = NULL` |

## 16. UI / Screens

| Screen | Path |
|---|---|
| Library landing | `app/(student)/library.tsx` |
| Subject view | `app/(student)/library.tsx?subject=...` |
| Chapter view | `app/(student)/library.tsx?chapter=...` |
| Video player | `app/(student)/video/[contentId].tsx` |
| PDF reader | `app/(student)/pdf/[contentId].tsx` |
| Upload (teacher) | `app/(teacher)/content.tsx` |
| Admin content moderation | `apps/admin/app/(dashboard)/content/page.tsx` |

## 17. Open Items

- In-app rich-text notes — phase 2.
- Highlighting / annotation on PDF — phase 2+.
- Search by full-text PDF content — phase 3.
- Offline download — explicitly deferred; would require DRM consideration.
