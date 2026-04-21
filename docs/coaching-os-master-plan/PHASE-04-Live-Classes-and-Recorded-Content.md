# Phase 04 — Live Classes & Recorded Content

## Goal

Ship in-app live classes + automatic recording + recorded playback. Students can join, see/hear the teacher with low latency, interact via chat; teachers can host from the teacher app; recordings appear in the student library within minutes of class end.

## Why this phase exists

Live + recordings are the highest-visibility MVP features. Done well, they sell the product in 30 seconds. Done poorly, the client demo fails. This phase also sets the video/streaming stack we depend on for clips (P5).

## Recommended architecture (live & recording)

### Live: 100ms.live (SFU, hosted)
Chosen after this comparison:

| Service | Pros | Cons |
|---|---|---|
| **100ms.live** | India POPs (Mumbai), React Native SDK, hosted recording to S3/our bucket, priced per-minute-per-participant (~₹0.6–1/min), good default UI | Vendor lock-in on live layer |
| LiveKit Cloud | Open-source backend, great DX, global | Less India presence; slightly higher latency from India |
| Agora | Excellent quality, huge scale | Pricing opaque at small scale; heavier SDK |
| Jitsi self-host | "Free" | Ops burden, scaling burden — not worth it at MVP |
| Custom WebRTC | Full control | Not feasible; months of work |

**Decision: 100ms.live for MVP.** Migration path to LiveKit Cloud later is realistic because we abstract the provider behind an `ILiveProvider` interface and our schema stores a generic `room_id` and `recording_asset_id`, not provider-specific keys.

### Recording: 100ms cloud recording → Bunny Stream transcoding
1. When a class starts, 100ms begins recording to our configured destination (S3 bucket or 100ms-managed storage).
2. On `beam.recording.success` webhook → Edge Function pulls the MP4, uploads to **Bunny Stream** library via API.
3. Bunny transcodes to HLS (multi-bitrate) and produces a `video_id` + signed-playback URLs.
4. Edge Function inserts a `content_items` row of type `recording` with `video_asset_id` = Bunny video id, links it to the class.
5. Push notification fires: "Recording available — Physics".

### Playback: Bunny Stream HLS with signed tokens
- Each playback URL is signed with a TTL (1 hour) specific to the student, scoped by their user id (Bunny supports token auth).
- RN player uses `react-native-video` with HLS, adaptive bitrate, and resume-at-position.

## Scope

### In-scope
- Teacher can start a scheduled class; room is created on demand.
- Student with active membership sees "Join Live" CTA when class is live.
- Live classroom UI: teacher's video + audio, students in audio-only by default with mute, chat panel, raise-hand, leave.
- Server-side recording auto-starts with the class.
- Recording pipeline to Bunny Stream + content_items insertion.
- Student recording list + player with seek/speed/resume.
- Access control: membership + enrollment checked before joining and before signing playback URL.
- Realtime class status updates (`scheduled` → `live` → `ended`).

### Out-of-scope
- Screen sharing beyond teacher (no student screen share at MVP).
- Breakout rooms.
- Whiteboard integration (deferred).
- Download of recordings (disabled by design to protect content).
- Clips — Phase 5.
- Live class chat moderation tools (basic profanity filter only).

## User roles impacted
- Student: join live, watch recordings.
- Teacher: host live, stop class, review recording.
- Admin: moderate via P7 tools.

## Screens to build
- `/(app)/classes/[id]` — class detail; shows Join Live button or Play Recording depending on state.
- `/(app)/live/[classId]` — live classroom (RN screen with 100ms RN SDK).
- `/(app)/recordings/[contentId]` — player screen.
- `/(teacher)/live/[classId]` — host controls (mute all, end class).

## Frontend tasks

### Live classroom (student)
- [ ] Pre-join screen: camera/mic permission, "Joining…" with network check.
- [ ] Connect via 100ms RN SDK using a JWT minted server-side (Edge Function `create-100ms-room-token`).
- [ ] Subscribe to teacher's video tile, render full-bleed with rounded corners and teacher name overlay.
- [ ] Audio: students muted by default; raise-hand via peer metadata.
- [ ] Chat panel: bottom-sheet, emoji + text, backed by 100ms chat API.
- [ ] Active speaker indicator (for voice-only students).
- [ ] Leave button → navigates back with confirm dialog.
- [ ] Connection-quality badge; show reconnection banner when dropped.
- [ ] Record attendance for live participants automatically (insert `attendance` row with `method='live'` on successful join + 60s of presence).

### Live host (teacher)
- [ ] Mic/cam toggle, mute-all, end class, peer list with hand-raised indicators.
- [ ] "Start class" button only enabled 10 min before scheduled time → `classes.status='live'`.
- [ ] "End class" button triggers 100ms `endRoom` + Edge Function `finalize-class` which stops recording and flips `classes.status='ended'`.

### Recording player
- [ ] `react-native-video` with ExoPlayer on Android, AVPlayer on iOS.
- [ ] Controls: play/pause, seek bar with thumbnail previews (Bunny provides sprite sheets), speed (0.75/1/1.25/1.5/2), quality selector (auto by default).
- [ ] Resume from last position: local + synced to `watch_positions(user_id, content_id, seconds)`.
- [ ] Chromecast/AirPlay: out-of-scope for MVP but reserve space in UI.
- [ ] Prevent screen recording on Android where supported (`setFlags(SECURE)`) — accept iOS limitation.

## Backend tasks

### Schema
```sql
create table class_rooms (
  class_id uuid primary key references classes(id) on delete cascade,
  provider text not null default '100ms',
  provider_room_id text not null,
  recording_status text not null default 'not_started', -- not_started|recording|processing|ready|failed
  started_at timestamptz,
  ended_at timestamptz,
  recording_raw_url text,
  recording_asset_id text  -- bunny video id
);

create table watch_positions (
  user_id uuid references profiles(id) on delete cascade,
  content_id uuid references content_items(id) on delete cascade,
  seconds int not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create table live_participants (
  class_id uuid references classes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds int,
  primary key (class_id, user_id, joined_at)
);
```

### Edge Functions
- `create-100ms-room` — teacher/admin only; creates (idempotent) 100ms room for a class, stores `provider_room_id`.
- `issue-100ms-token` — role-aware: student joins as `subscriber` role; teacher as `host`. Enforces: enrolled + active membership + class window.
- `finalize-class` — ends 100ms room, sets status, waits for recording webhook.
- `recording-webhook` — receives 100ms `beam.recording.success`, downloads MP4, uploads to Bunny, creates `content_items` row, fires push notification.
- `sign-bunny-url` — student-authenticated; returns short-TTL signed URL for a given `content_id` after permission check.
- `update-watch-position` — debounced upsert called by player every 10s.

### 100ms configuration
- Roles: `host`, `co-host`, `subscriber`.
- Default publish: only host publishes video/audio; subscribers publish nothing unless permitted (raise-hand flow).
- Recording: room-level recording enabled, beam destination = our S3 (Supabase Storage bucket `class-recordings-raw`) or 100ms-managed if simpler for MVP.

### Bunny Stream
- One Stream Library for recordings, one for clips (P5).
- Token auth enabled on libraries.
- Retention: keep indefinitely; cold storage strategy in `DATABASE-SCHEMA-AND-STORAGE-PLAN.md`.

### Notifications (enqueue only; fanout in P8)
- `classes.status` → `live` triggers insert into `notifications` for all enrolled students.
- `content_items` insert of type `recording` triggers insert into `notifications` for all enrolled students.

## Database / data model needs
Additions above, plus soft-delete columns on `content_items`.

## APIs / services needed
See `API-DESIGN-AND-SERVICE-BOUNDARIES.md` §Classes & Media.

## Third-party integrations
- **100ms.live** — live video (SFU + recording).
- **Bunny Stream** — video CDN + transcoding + signed playback.

## Recommended libraries
| Purpose | Package |
|---|---|
| 100ms RN | `@100mslive/react-native-room-kit` or `@100mslive/react-native-hms` (raw SDK for custom UI) |
| Video player | `react-native-video` (ExoPlayer on Android) |
| HLS utilities | (built into player) |
| Network status | `@react-native-community/netinfo` |

## Edge cases
- Student joins a class that ends while they're connecting → server returns `CLASS_ENDED`, client navigates to recording if available else class detail.
- Teacher loses network mid-class → 100ms auto-reconnects; if teacher disconnects for >5 min, Edge Function `finalize-class` triggers and class is ended.
- Recording fails at 100ms side → mark `class_rooms.recording_status='failed'`; admin sees red badge in P7 and can retry manually.
- Bunny transcode slow → we insert content_items in `status='processing'`, UI shows "Recording will be ready soon" with a realtime-subscription flip to "ready".
- Active membership expires mid-class → let them finish current live session; next join is blocked.
- Very low bandwidth student → 100ms audio-only mode kicks in below 150kbps.

## Risks
| Risk | Mitigation |
|---|---|
| 100ms minute costs at scale | Budget: avg 1 class × 30 students × 60 min/day ≈ 1,800 participant-minutes → ~₹1,800/day worst case. Acceptable for MVP; move to reserved capacity plan at scale. |
| Recording pipeline breaks silently | Health check Edge Function runs on pg_cron; alerts Slack if any class >10 min old has `recording_status in ('recording','processing')` for over 1 hour. |
| Signed URL leak | Short TTL (1 hr), rotating; if we detect many plays from same URL, we can rotate Bunny library token. |
| Mobile memory pressure with video + chat | Unload chat when in fullscreen; cap bitrate ladder on low-end Android. |

## Dependencies on earlier phases
- Phase 1 (schema, Edge Functions, auth).
- Phase 2 (student shell with classes tab).
- Phase 6's `has_active_membership()` function — but that function itself can land here as a stub returning `true` until Phase 6 enforces it.

## Acceptance criteria
- [ ] Teacher schedules class via admin panel (or SQL for this phase), starts it from teacher app; `classes.status` flips to `live`.
- [ ] Student dashboard shows "Live now" card and Join Live CTA.
- [ ] Student joins live in <3s on 4G; p95 latency <500ms.
- [ ] Chat messages appear within 1s.
- [ ] Teacher ends class; `classes.status='ended'`.
- [ ] Within 10 minutes of class end, recording appears in Recordings list.
- [ ] Student plays recording with adaptive bitrate; resume works across app restarts.
- [ ] Playback URL expires 1 hour after minting; replay requires refresh.
- [ ] Membership-expired student is blocked from joining live with clear CTA to renew.

## Definition of done
- All acceptance criteria met on a real 4G Android device.
- Recording pipeline has an end-to-end automated test (mock 100ms webhook → Bunny mock → content_items row).
- Observability: 100ms dashboard, Bunny dashboard, Sentry tags include `class_id` and `provider_room_id`.
- Provider abstraction: swapping 100ms for LiveKit requires only replacing `lib/live/provider.ts`.

## Suggested folder / module breakdown

```
apps/mobile/src/features/live/
├── screens/
│   ├── PreJoinScreen.tsx
│   ├── LiveRoomScreen.tsx
│   └── TeacherHostScreen.tsx
├── components/
│   ├── VideoTile.tsx
│   ├── ChatPanel.tsx
│   ├── ConnectionBadge.tsx
│   └── ParticipantsList.tsx
├── hooks/
│   ├── useLiveRoom.ts
│   ├── useRoomToken.ts
│   └── useChat.ts
├── provider/
│   └── hms-provider.ts              # ILiveProvider impl
└── api.ts

apps/mobile/src/features/recordings/
├── screens/RecordingPlayerScreen.tsx
├── components/PlayerControls.tsx
├── hooks/useSignedPlayback.ts
└── hooks/useWatchPosition.ts

supabase/functions/
├── create-100ms-room/
├── issue-100ms-token/
├── finalize-class/
├── recording-webhook/
├── sign-bunny-url/
└── update-watch-position/
```

## Suggested order of implementation

1. Schema + RLS for `class_rooms`, `watch_positions`, `live_participants`.
2. `create-100ms-room` + `issue-100ms-token` Edge Functions with strong access-control tests.
3. Teacher pre-join and host screen → can create and end a room in dev.
4. Student pre-join and live room screen → can join teacher's room.
5. Basic chat wiring.
6. `finalize-class` + recording webhook path; integrate Bunny upload.
7. Bunny signed URL issuer.
8. Recording player screen; hook up watch-position save.
9. Access control checks (enrollment + membership stub).
10. End-to-end test: schedule → start → join → end → recording visible → playback.
11. Load test with 20 simulated participants; tune quality ladder on low-end Android.
