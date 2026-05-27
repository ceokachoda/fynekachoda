# Phase 9 — Live Classes (YouTube wrap)

> **Status: ✅ ACCEPTED — 2026-05-27.** All code built, deployed and automated-tested; manual QA signed off on iOS + Android (§A–§F + §H) **and the §G real-OBS → unlisted-YouTube live-broadcast dry-run** (on the dev's TEMP channel "NOvA FX" `UCSa8awrJseI_8r_oZQjuvYQ`, live-enabled; 5 Vault secrets + published OAuth app provisioned 2026-05-26). A post-QA bug-hunt (2026-05-27) shipped fixes — see §15.11. At go-live, hand streaming to the client's channel: `docs/phases/phase-9-youtube-client-handover.md`. Full ledger in **§15**; click-by-click plan in `docs/phases/phase-9-manual-tests.md`.

> The most external-integration-heavy phase. Teacher schedules a live class → backend creates an Unlisted YouTube broadcast via YT Data API → teacher streams via OBS → students watch through wrapped player with watermark + custom chat + raise-hand. After class ends, the YT video is auto-saved and reused as the recording (same wrapped player + chat replay).

---

## 1. Goal

Make the institute's live teaching real. End-to-end: schedule → broadcast → join → chat → end → replay.

## 2. Prerequisites (CRITICAL — confirm BEFORE writing code)

- [ ] Institute Google account created with a dedicated YouTube channel.
- [ ] YT channel **verified** (24h hold after first verification step — start this several days before Phase 9).
- [ ] YT channel **live streaming enabled** (separate verification).
- [ ] Cloud project in Google Cloud Console with YouTube Data API v3 + OAuth 2.0 Client ID + Client Secret.
- [ ] OAuth consent screen configured (Internal or External). Refresh token obtained via one-time OAuth dance.
- [ ] Vault entries: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, `INSTITUTE_CHANNEL_ID`.
- [ ] OBS Studio (or Streamlabs) installed on the teacher's computer; basic profile configured.
- [ ] At least one test broadcast manually performed end-to-end via YT Studio to verify the channel is healthy.
- [ ] Phase 8 accepted.

If any of these prerequisites is missing, **STOP** and do them before starting Phase 9.

## 3. Scope

### In
- DB: `chat_messages`, `raise_hand_events`, `chat_bans`. (Sessions table already has `yt_broadcast_id`, `yt_video_id` columns from Phase 4.)
- Edge functions: `yt-broadcast-create`, `yt-broadcast-stop`, `yt-playback-sign` (extended from Phase 5 to include `kind=live` and `kind=recording`), `chat-delete`, `chat-ban`.
- YT OAuth refresh-token rotation helper.
- Realtime channels: `room:session:{id}` for chat; `:hands` for raise-hand; `:state` for pinned announcements + end-of-class.
- Mobile student: `(student)/live/[sessionId].tsx` rebuilt (replaces existing `app/live-session.tsx`); `(student)/recording/[sessionId].tsx`.
- Mobile teacher: `(teacher)/classes.tsx` extends with "Schedule Live Class" CTA + RTMP key viewer; `(teacher)/live-control/[sessionId].tsx`.
- Watermark overlay (from Phase 5) on every playback.
- Chat replay during recording playback.
- Pinned announcements.

### Out
- Co-hosts (D-046).
- In-class polls (D-048 deferred).
- WebRTC fallback for low-latency (D-145 deferred).
- Captions / transcripts.

## 4. Specs in play

- `docs/spec/youtube-live-stream.md` — primary.
- `docs/spec/study-materials.md` (wrapped player reuse).
- `docs/decisions.md` D-040 to D-049.

## 5. Backend work

### 5.1 Migration: chat tables (Checkpoint 1)

`supabase/migrations/0020_live_chat.sql`:

```sql
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  author_id   uuid not null references public.app_users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  is_deleted  boolean not null default false,
  deleted_by  uuid references public.app_users(id),
  deleted_at  timestamptz,
  posted_at   timestamptz not null default now()
);

create index chat_session_time_idx on public.chat_messages (session_id, posted_at) where is_deleted = false;

create table public.raise_hand_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(user_id) on delete cascade,
  raised_at   timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.chat_bans (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references public.app_users(id) on delete cascade,
  banned_at  timestamptz not null default now(),
  banned_by  uuid not null references public.app_users(id),
  primary key (session_id, user_id)
);
```

### 5.2 Migration: chat RLS + Realtime publication (Checkpoint 2)

```sql
alter table public.chat_messages enable row level security;
alter table public.raise_hand_events enable row level security;
alter table public.chat_bans enable row level security;

-- Reading: any session member (student of batch / teacher of batch / admin).
create policy cm_read on public.chat_messages for select to authenticated using (
  session_id in (select id from public.sessions s
    where s.batch_id = (select batch_id from public.students where user_id = public.current_app_user_id())
       or (public.has_role('teacher') and s.batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()))
       or public.is_admin()
  )
);

-- Insert: session member who is NOT in chat_bans for that session.
create policy cm_insert on public.chat_messages for insert to authenticated with check (
  author_id = public.current_app_user_id()
  and not exists (select 1 from public.chat_bans where session_id = chat_messages.session_id and user_id = author_id)
  and session_id in (...same scope as read...)
);

-- Soft delete: teacher of session's batch or admin.
create policy cm_delete on public.chat_messages for update to authenticated using (
  (public.has_role('teacher') and session_id in (
    select id from public.sessions s where s.batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())
  )) or public.is_admin()
) with check (is_deleted = true);

-- raise_hand: insert by student of batch; resolve by teacher of batch.
create policy rh_insert on public.raise_hand_events for insert to authenticated with check (
  student_id = public.current_app_user_id()
  and session_id in (select id from public.sessions where batch_id = (select batch_id from public.students where user_id = public.current_app_user_id()))
);
create policy rh_read on public.raise_hand_events for select to authenticated using (
  student_id = public.current_app_user_id()
  or (public.has_role('teacher') and session_id in (select id from public.sessions where batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id())))
  or public.is_admin()
);
create policy rh_resolve on public.raise_hand_events for update to authenticated using (
  public.has_role('teacher') and session_id in (select id from public.sessions where batch_id in (select batch_id from public.batch_teachers where teacher_id = public.current_app_user_id()))
);

-- chat_bans: only teacher/admin manage.
create policy cb_read on public.chat_bans for select to authenticated using (
  user_id = public.current_app_user_id()
  or public.has_role('teacher')
  or public.is_admin()
);
create policy cb_write on public.chat_bans for all to authenticated
  using (public.has_role('teacher') or public.is_admin())
  with check (public.has_role('teacher') or public.is_admin());

-- Add to realtime publication for live broadcasting
alter publication supabase_realtime add table public.chat_messages, public.raise_hand_events;
```

### 5.3 Edge fn: yt-broadcast-create (Checkpoint 3)

`apps/functions/yt-broadcast-create/index.ts`:

Input: `{ session_id }`.

Steps:
1. Verify teacher of session's batch (or admin).
2. Verify session is a live class (`is_live_class=true`) and not yet broadcast.
3. Use `_shared/yt-api.ts` to call YouTube Data API:
   - Refresh access token using `YT_REFRESH_TOKEN`.
   - `liveBroadcasts.insert` with snippet (title from session + scheduled time), status (`privacyStatus='unlisted'`, `selfDeclaredMadeForKids=false`), contentDetails (`enableAutoStart=true`, `enableAutoStop=true`, `enableDvr=true`, `recordFromStart=true`, `enableLiveChat=false`).
   - `liveStreams.insert` with title, cdn (frame rate `30fps`, ingestion type `rtmp`, resolution `720p`).
   - `liveBroadcasts.bind` to attach the stream to the broadcast.
4. Persist `yt_broadcast_id`, `yt_video_id` (the broadcast id == video id for Live), and ingest details to `sessions` (NOT exposed to client).
5. Return to caller: `{ rtmp_url, stream_key }` — the only sensitive value visible to the teacher.
6. Audit.

### 5.4 Edge fn: yt-broadcast-stop (Checkpoint 4)

`apps/functions/yt-broadcast-stop/index.ts`:

Input: `{ session_id }`.

Steps:
1. Verify caller.
2. Call YT API `liveBroadcasts.transition?broadcastStatus=complete`.
3. UPDATE `sessions.status = 'ended', ended_at = now()`.
4. Broadcast `:state` Realtime: `{event: 'ended'}`.
5. Audit.

### 5.5 Edge fn: yt-playback-sign (extended) (Checkpoint 5)

Extends the Phase 5 version to support `kind = 'live' | 'recording' | 'lesson'`.

For live: input is `{ session_id }`. Verifies caller is in batch + session.status = 'live'. Payload includes `video_id` (= broadcast id), `kind: 'live'`, watermark, exp = now+1h.

For recording: input is `{ session_id }`. Verifies session.status = 'ended' + caller in batch. Same payload with `kind: 'recording'`, exp = now+4h.

### 5.6 Edge fn: chat-delete + chat-ban (Checkpoint 6)

`chat-delete`: Input `{ message_id }`. Teacher of session's batch (or admin). Soft-delete (is_deleted=true). Realtime broadcasts the change to chat clients.

`chat-ban`: Input `{ session_id, user_id }`. Teacher of session's batch. INSERT into chat_bans. Realtime broadcasts to `:state` so banned user's input UI is disabled.

### 5.7 YT API helper module (Checkpoint 7)

`apps/functions/_shared/yt-api.ts`:

```ts
async function getAccessToken(): Promise<string> {
  // Use refresh token + client id/secret to get access token from https://oauth2.googleapis.com/token
  // Cache in-memory for ~50 min (tokens last 1h).
}

async function createBroadcast(opts: {...}): Promise<{broadcastId, videoId}> {...}
async function createStream(opts: {...}): Promise<{streamId, rtmpUrl, streamKey}> {...}
async function bindBroadcast(broadcastId, streamId): Promise<void> {...}
async function transitionBroadcast(id, to: 'testing'|'live'|'complete'): Promise<void> {...}
async function getBroadcastStatus(id): Promise<'created'|'ready'|'live'|'complete'> {...}
```

Robust error handling: 401 → retry with new token; 5xx → exponential backoff up to 3 attempts.

## 6. Frontend work

### 6.1 Mobile teacher: schedule + control (Checkpoint 8)

`apps/mobile/app/(teacher)/classes.tsx`:
- "+ Schedule Live Class" FAB.
- Form: batch (auto), subject, topic, title, starts_at, duration.
- ☑ Auto-create YouTube broadcast (defaults true).
- On save: creates session row + invokes `yt-broadcast-create`.
- Shows result modal with stream key (copy button) + RTMP URL + brief OBS setup instructions (link to docs).

`apps/mobile/app/(teacher)/live-control/[sessionId].tsx`:
- Header: "● LIVE — [title]" / "Scheduled" depending on session.status.
- Pre-live: "Stream key" + "RTMP URL" + "Test in OBS" instructions.
- Live: small preview iframe (same wrapped player so teacher sees what students see).
- Viewer count (Realtime presence on `room:session:{id}`).
- Chat panel with mod actions (delete message, ban user).
- Raise-hand queue with [resolve] [call out] buttons.
- "Pin Announcement" composer (broadcasts to `:state`).
- "End Class" red button → confirmation → `yt-broadcast-stop`.

### 6.2 Mobile student: live + recording (Checkpoint 9)

`apps/mobile/app/(student)/live/[sessionId].tsx`:
- Replaces `app/live-session.tsx` (delete the old file).
- Pre-live: lobby with countdown.
- Live: `WrappedYtPlayer` with `signedPayload` from `yt-playback-sign`.
- Watermark overlay.
- Bottom: ChatPane + RaiseHandButton.
- Pinned announcement banner (top of chat).
- On disconnect: auto-reconnect player.

`apps/mobile/app/(student)/recording/[sessionId].tsx`:
- Mounts the same wrapped player.
- `ChatReplay` component: fetches all `chat_messages` ordered by `posted_at`; re-renders in sync with player time using `posted_at - sessions.started_at`.
- Speed control: player speed change affects ChatReplay tick rate.

### 6.3 Realtime channel subscriptions (Checkpoint 10)

`features/chat/useChatChannel.ts`:
- Subscribe to `chat_messages` postgres_changes for the session.
- Maintain last 50 messages in state; older paginated on scroll.
- Unsubscribe on unmount.

`features/live/useRaiseHand.ts`:
- Subscribe to `raise_hand_events` for the session.
- For students: track own raised state.
- For teachers: maintain a queue.

`features/live/useSessionState.ts`:
- Subscribe to `:state` broadcast channel for pinned announcement + end-of-class signal.

### 6.4 Classes tab update (Checkpoint 11)

`apps/mobile/app/(student)/classes.tsx`:
- Segmented Live / Upcoming / Recorded.
- Live tab: shows session with `status='live'` in student's batch.
- Upcoming: next 7 days.
- Recorded: completed sessions with `status='ended'`.
- Each card → live or recording view.

## 7. Files changed (summary)

### Mobile — added
- `app/(student)/live/[sessionId].tsx` (replaces `live-session.tsx`)
- `app/(student)/recording/[sessionId].tsx`
- `app/(teacher)/live-control/[sessionId].tsx`
- `components/live/ChatPane.tsx`, `RaiseHandButton.tsx`, `ChatReplay.tsx`, `LobbyCountdown.tsx`, `PinnedBanner.tsx`
- `features/chat/useChatChannel.ts`, `useChatMessages.ts`
- `features/live/useLiveSession.ts`, `useRaiseHand.ts`, `useSessionState.ts`, `usePlaybackSign.ts`

### Mobile — edited
- `app/(teacher)/classes.tsx` — adds Schedule Live Class flow.
- `app/(student)/classes.tsx` — Live/Upcoming/Recorded tabs wire up to real sessions.

### Mobile — deleted
- `app/live-session.tsx` (replaced by `(student)/live/[sessionId].tsx`)

### Edge fns
- `yt-broadcast-create`, `yt-broadcast-stop`, extended `yt-playback-sign`, `chat-delete`, `chat-ban`
- `_shared/yt-api.ts`

### DB
- 2 migrations (chat tables + RLS)
- Realtime publication updated

### Vault entries
- `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, `INSTITUTE_CHANNEL_ID`

## 8. Integration & cross-cutting

- Audit: `yt_broadcast_created`, `yt_broadcast_stopped`, `chat_message_deleted`, `chat_user_banned`, `live_session_ended`.
- Telemetry: `live_class_joined`, `live_class_left`, `chat_message_posted`, `raise_hand_raised`, `raise_hand_resolved`, `recording_played`.
- The `yt-playback-sign` fn audit-logs every issuance (potential leak detection — spike in repeated calls by one user is a flag).

## 9. Risks & gotchas

| Risk | Mitigation |
|---|---|
| YT API quota (10,000 units/day) | Each broadcast create ~50 units. At 10 classes/day = 500. Plenty of headroom. Monitor in admin. |
| OAuth refresh token revoked | Admin notification on 401 from token refresh; manual re-OAuth via a setup script. |
| RTMP stream key leaks | Shown only to creating teacher in the session; never persisted on device beyond the live-control screen. |
| Stream drops mid-class | YT auto-resume; player keeps trying; show "Reconnecting…" UI. |
| YT video ID extractable via WebView dev tools | Documented and accepted; watermarks + audit on `yt-playback-sign` mitigate. |
| Realtime channel auth bypass (subscribe without permission) | Realtime checks SELECT permission on underlying `sessions` row via RLS — verified. |
| Chat spam | 500-char limit + rate-limit 5 msgs/30s per user; teacher can ban. |
| Watermark perf on WebView | Single Animated.View with translation; tested. |
| Time-sync between YT live and chat replay | Chat replay uses `sessions.started_at` as t=0; small drift acceptable. |
| Banned user can still see chat | Yes — they can read but not post. Enforcement via INSERT policy. |
| OBS configuration confuses teachers | Provide a written guide + a 2-min video in admin panel `/settings/help`. |

## 10. Acceptance criteria

1. Migrations clean. Realtime publication includes `chat_messages`.
2. Teacher schedules a live class → backend creates broadcast → modal shows stream key + RTMP URL.
3. Teacher copies key/URL into OBS → starts streaming.
4. Within ~10 seconds, the broadcast goes live on YT (verify via YT Studio).
5. Student opens the live session in mobile app → wrapped player loads → video plays → no YT branding visible.
6. Watermark visible on the player; text matches student.
7. Watermark moves to a new corner ~60s later.
8. Student types a chat message → appears in student's chat + teacher's chat panel within 1s.
9. Two students chat back and forth — both see all messages in real time.
10. Student raises hand → teacher sees in raise-hand queue → teacher resolves → student's UI clears.
11. Teacher pins an announcement → all students see banner.
12. Teacher deletes a chat message → it disappears for all students within 1s.
13. Teacher bans a student → student can read chat but Send button is disabled.
14. Teacher ends class → broadcast stops on YT → status updates → recording becomes available immediately (within YT's processing time).
15. Recording playback: same wrapped player loads the YT video; watermark visible.
16. Chat replay: messages re-render in sync as the recording plays.
17. Speed change to 1.5x: chat replay ticks faster.
18. Network drop on student during live → reconnects within 30s.
19. RLS: student of batch B cannot read live chat of batch A.
20. RLS: student of batch B cannot get a playback payload for batch A's session.
21. YT video ID does NOT appear in any client console log; only the signed payload does (note: the iframe URL does contain it, accepted).
22. Memory profile on Redmi 8A during 30-min live class: stays under 350 MB.

## 11. Test plan

### Unit
- HMAC playback payload sign/verify.
- Chat replay sync calc (given posted_at + started_at, offset is correct).
- YT API duration parser.

### Integration
- `yt-broadcast-create`: happy path with mocked YT API; error retry; non-teacher 403.
- `yt-broadcast-stop`: idempotent; error if session not live.
- `yt-playback-sign`: kind branching; access checks.

### RLS
- Cross-batch isolation for chat, raise-hand, playback.
- Banned user can read but not insert.

### Manual QA (end-to-end on real network)
- Full live class dry run: teacher streams from OBS for 10 min; 2 students join + chat.
- Teacher ends → recording immediately playable.
- Replay chat sync: pause at random points; messages match timestamps.
- Network throttling (4G simulation): video remains watchable.

### Cross-platform
- Android: WebView player works; chat input doesn't push player off-screen.
- iOS: ATS allows YT domains; inline playback works.

## 12. Rollback plan

If Phase 9 breaks:
1. Revert migrations 0020+.
2. Mobile live screens revert to "Coming soon" placeholder.
3. Existing recordings (if any) stay queryable via DB but no UI.
4. Disable `yt-broadcast-create` until fixed.

## 13. Definition of done

- [ ] All 22 AC pass.
- [ ] End-to-end live class dry run video recorded.
- [ ] YT API error retry behavior verified.
- [ ] CI green.
- [ ] User says "Phase 9 accepted".

## 14. Hand-off to Phase 10

- Live + recording infra live.
- Activity_days populated on attendance + quiz + exam + video watch; ready for streaks.
- Phase 10 adds the leaderboard composite + badges + celebration UI.

---

## 15. Acceptance ledger (CP1–CP11) — ✅ ACCEPTED 2026-05-27

> **Status: ✅ ACCEPTED — 2026-05-27.** Manual QA signed off on real devices: §A–§F + §H (visual / on-device) **and §G** (the real OBS → unlisted-YouTube live-broadcast dry-run, on the NOvA FX dev channel) all passed. A post-QA bug-hunt (2026-05-27, see §15.8) shipped 5 mobile fixes + 1 RLS migration; 3 LOW-severity edge-fn guards are staged in source and ride the Phase 12 prod edge-fn deploy.
>
> **ACCEPTED:** 2026-05-27 — §A–§H all green on iOS + Android; §G real-OBS YouTube dry-run passed. Phase 9 is done.
>
> **2026-05-22 agent re-verification.** The whole data + logic layer was re-run on the
> dev project and is green: `test:live` 9/9, `smoke:live-rls` 14/14, `smoke:live-fns`
> 34/34; 6 edge fns ACTIVE; 3 tables RLS-on + in realtime publication; 3 `private` scope
> helpers; seeded composition cross-checked (live 2 chat msgs; recording 9 rows at
> offsets 5/12/30-announcement/45/70/95/130/160/180-system, system row excluded from
> replay; 2 resolved raised hands; segmented 1/1/1); chat trigger denormalises
> author_name/role + stamps kind; policies 2/3/1; rate-limit blocks the 6th message; the
> 4 `YT_*` Vault secrets are absent → intentional 503 (D-195); advisor sweep 0 ERRORs;
> mobile gate (`typecheck`/`lint`/`jest` 53/53 + shared 17/17) green on the current
> working tree. **`phase-9-manual-tests.md` was trimmed to VISUAL / ON-DEVICE ONLY** —
> the SQL-only / automated sub-tests (old §0.5, §F3, §I) are done; results live in that
> doc's §J. Remaining for the user: §0.3 Metro restart + §A–§F + §H render/realtime/
> device, **plus §G** (the real-OBS YouTube dry-run, which needs §0.0 — a Google channel
> / OAuth / OBS, which the agent cannot do).

### 15.1 Checkpoint status
| CP | Scope | State |
|----|-------|-------|
| CP1 | `chat_messages` / `raise_hand_events` / `chat_bans` tables + RLS enabled | ✅ |
| CP2 | `private.*` scope helpers + policies + Realtime publication + rate-limit/denormalize trigger | ✅ |
| CP3 | `_shared/yt-api.ts` (OAuth refresh + broadcast/stream/bind/transition + graceful 503) | ✅ |
| CP4 | `yt-broadcast-create` (idempotent; stream key to teacher only, never persisted) | ✅ |
| CP5 | `yt-broadcast-stop` (transition→complete + status=ended + system end message) | ✅ |
| CP6 | `yt-playback-sign` extended (kind=live\|recording, session-scoped, audited) | ✅ |
| CP7 | `chat-delete` + `chat-ban` (audited soft-delete + ban/unban) | ✅ |
| CP8 | teacher Schedule-Live + `live-control/[sessionId]` + `yt-broadcast-golive` (NEW) | ✅ |
| CP9 | student `live/[sessionId]` + `recording/[sessionId]`; deleted `live-session.tsx` | ✅ |
| CP10 | `useChatChannel` + `useRaiseHand` + `useSessionState` + `usePlaybackSign` + `useLiveSession` + `chat-replay` | ✅ |
| CP11 | `(student)/classes.tsx` Live/Upcoming/Recorded segments | ✅ |

### 15.2 Migrations (3, all filed in `supabase/migrations/`)
| Version | Name | Contents |
|---|---|---|
| 20260522055933 | `live_chat` | 3 tables + indexes (one-active-hand partial unique) + RLS enabled (deny-all) |
| 20260522060118 | `live_chat_rls` | `private.can_access_session` / `is_session_teacher` / `is_session_live` (SECURITY DEFINER, search_path pinned) + `cm_read`/`cm_insert`/`rh_*`/`cb_read` policies + adds the 3 tables to `supabase_realtime` |
| 20260522060125 | `chat_message_trigger` | `private.chat_message_before_insert` (SECURITY DEFINER, EXECUTE revoked) — denormalizes author_name/role + 5-msgs/30s rate limit |

> Deviations from the §5 draft (intentional): helpers are `private.*` not `public.*`; no client `cm_delete`/`cb_write` policies (deletes/bans go through audited edge fns, D-172); no non-existent `enableLiveChat` field.

### 15.3 Edge functions (6, deployed)
`yt-broadcast-create`, `yt-broadcast-golive` (**new** — the draft had no way to flip `status='live'`), `yt-broadcast-stop`, `yt-playback-sign` (extended), `chat-delete`, `chat-ban` + shared `_shared/yt-api.ts`. Deployed via `node scripts/stage-phase9-deploy.cjs` + `npx supabase functions deploy <fn> --workdir <staged> --project-ref orqwyazvcthgxoadfxfv` (D-187). All `verify_jwt=true`.

### 15.4 Vault
No new Vault writes performed by code. The live path reads `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, `INSTITUTE_CHANNEL_ID` (+ `YT_DATA_API_KEY` for Phase-5 video metadata) at runtime via `get_vault_secret`. **✅ Provisioned 2026-05-26:** all 5 loaded + OAuth app published (permanent token), verified working on temp channel "NOvA FX"; `yt-api.ts` now returns real keys (no longer 503). Move to the client's channel via `docs/phases/phase-9-youtube-client-handover.md`.

### 15.5 Tests
| Suite | Command | Result |
|---|---|---|
| Unit (real HMAC sign/verify + YT duration + chat-replay) | `pnpm test:live` | 9 groups ✅ |
| RLS (cross-batch chat/raise-hand/playback isolation, banned-read-not-post, rate-limit) | `pnpm smoke:live-rls` | 14 ✅ |
| Edge-fn gates (auth/validation/role/assignment/status/kind for all 6 fns, full lifecycle) | `pnpm smoke:live-fns` | 34 ✅ |
| Repo typecheck | `pnpm typecheck` | ✅ (6 projects) |
| Repo lint | `pnpm lint` | ✅ |
| Mobile jest | `pnpm test` | 53/53 ✅ |

### 15.6 Advisor sweep
`get_advisors` security + performance after the DDL: **no new lints**. Only the pre-existing accepted ones — 3 dashboard `SECURITY DEFINER` WARNs (D-186) + `auth_leaked_password_protection` (Phase 1 backlog); and INFO-level fresh-unused-index / unindexed-cold-FK notes on the new tables (matches the project's accepted pattern; `private.*` helpers + the trigger are unexposed so are NOT flagged).

### 15.7 Live-YouTube verification — ✅ DONE (2026-05-27)
YT secrets were provisioned 2026-05-26 (5 Vault entries + published OAuth app on the dev "NOvA FX" channel). On 2026-05-27 the §G real-OBS dry-run was run and passed: a real *unlisted* YouTube broadcast was created from the app, OBS streamed into it, the student saw the live feed through the wrapped player with a moving watermark, chat/raise-hand/pin/delete/ban all worked over the live stream, and after End-class the saved video replayed as the recording. AC **2, 3, 4, 5, 6, 7, 14, 15** verified. **#22** (Redmi 8A 350 MB memory profile) remains a hardware carry-over to the Phase 12 perf pass. NON-live AC (1, 8–13, 16–21) were automated-tested (§15.5) and visually confirmed.

### 15.8 Decisions
**D-190..D-196** (see `docs/decisions.md`): chat-rows for pin/end (D-190); denormalize + rate-limit trigger (D-191); `yt-broadcast-golive` lifecycle fn (D-192); stream key never persisted / idempotent re-fetch (D-193); top-level WebView routes (D-194); `yt-api.ts` 503-when-unconfigured (D-195); `chat_bans` in Realtime + audited deletes/bans, `private.*` helpers (D-196).

### 15.9 Files changed (summary)
- **DB:** `supabase/migrations/2026052205…_live_chat.sql`, `…060118_live_chat_rls.sql`, `…060125_chat_message_trigger.sql`.
- **Edge fns:** `apps/functions/{yt-broadcast-create,yt-broadcast-golive,yt-broadcast-stop,chat-delete,chat-ban}/index.ts`, rewritten `yt-playback-sign/index.ts`, new `_shared/yt-api.ts`, schemas added to `_shared/schemas.ts`.
- **Mobile added:** `app/live/[sessionId].tsx`, `app/recording/[sessionId].tsx`, `app/live-control/[sessionId].tsx`; `features/chat/useChatChannel.ts`; `features/live/{useRaiseHand,useSessionState,usePlaybackSign,useLiveSession,chat-replay}.ts`; `components/live/{ChatPane,ChatComposer,RaiseHandButton,PinnedBanner,LobbyCountdown,ChatReplay}.tsx`; `components/teacher/ScheduleLiveSheet.tsx`.
- **Mobile edited:** `app/_layout.tsx` (3 routes), `app/(teacher)/classes.tsx`, `app/(student)/classes.tsx`, `components/live/WrappedYtPlayer.tsx` (+playbackRate), `features/dashboard/useStudentSchedule.ts` (+yt_video_id).
- **Mobile deleted:** `app/live-session.tsx`.
- **Scripts:** `scripts/{test-live-helpers,smoke-test-live-rls,smoke-test-live-edge-fns,seed-live-manual-test,stage-phase9-deploy}` + 4 `package.json` scripts.

### 15.10 Carry-overs (into Phase 12)
- ✅ YT secrets provisioned + verified (2026-05-26); ✅ §G OBS dry-run passed (2026-05-27). At go-live: hand streaming to the client's channel — `docs/phases/phase-9-youtube-client-handover.md` (Phase 12 prod setup).
- **Deploy the 3 staged edge-fn guards** (see §15.11) with the Phase 12 prod edge-fn deploy (CP14) + redeploy to dev in the same sweep.
- Redmi 8A cold-start + 30-min live-session memory profile (#22) — Phase 12 perf pass (CP11).
- Teacher tab bar still 8 entries (Phase 7/8 note) — Tests-tab consolidation still open.
- Optional: bundle a local KaTeX/pdf.js (Phase 5/6 carry-over), admin-side live-class monitor (out of Phase 9 scope).

### 15.11 Post-QA hardening (2026-05-27)
A deep bug-hunt (4 parallel reviews + manual verification) after sign-off. **Shipped + verified:**
- Mobile (typecheck/lint/jest 53/53 green): `useChatChannel` reloads history on Realtime re-subscribe (recovers messages missed while offline — §H2); `ScheduleLiveSheet` effective-batch default survives the async `useAssignedBatches` load.
- RLS migration `20260527101000_phase9_raise_hand_moderation` (applied + `smoke:live-rls` 14/14): `rh_insert` now excludes banned students; `rh_update` blocks students spoofing `resolved_by`.

**Staged in source, NOT yet redeployed** (LOW severity; `smoke:live-fns` can't be run now without creating real broadcasts on the live YT channel — deploy in the Phase 12 edge-fn sweep): `yt-broadcast-golive` rejects `cancelled` sessions; `yt-broadcast-stop` skips a duplicate "Class has ended." on re-stop; `_shared/yt-api.ts` splits the 401-refresh vs 5xx-backoff retry budgets.

**Assessed, intentionally not changed (not bugs):** ghost-audio-on-leave (WebView unmount stops audio; §H3 passed); lobby→live retry (polls correctly); `ended` latch (golive guards prevent a stale system marker while live).
