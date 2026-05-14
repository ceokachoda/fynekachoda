# Spec: Live Classes (YouTube wrap)

Live classes use **Unlisted YouTube broadcasts** wrapped inside the app via `react-native-youtube-iframe`. Students experience it as a native in-app live class — no external link, no YouTube branding, custom chat, raise-hand, watermark. The same wrapped player replays the auto-saved recording afterward.

---

## 1. Goals

- Teacher schedules a class → backend creates an Unlisted YT broadcast → teacher streams via OBS to the supplied ingest URL.
- Students join from inside the app; YT URL/video ID never appears in the UX.
- Chat + raise-hand handled via Supabase Realtime (we don't use YT chat).
- After class ends, the YT video is auto-saved and serves as the recording — same wrapped player.
- Chat replays in sync during recording playback.
- Watermark with student name + last-4-digits of phone overlays the player.

## 2. Non-Goals (MVP)

- True low-latency 2-way classes (no SFU).
- In-app teacher screen-share (teacher uses OBS / Streamlabs which captures whatever they want).
- Co-hosted teachers.
- Webinar mode with attendee video.
- In-class polls.
- Closed captions / live transcripts.

## 3. Why YouTube (Trade-offs Acknowledged)

| Benefit | Cost |
|---|---|
| Free, infinite scale | ~10–20s latency |
| India CDN, mature | No teacher screen-share inside our app (acceptable — teacher uses their own broadcasting setup) |
| Auto-recording | YT video ID is theoretically extractable via debug tools from a wrapped iframe |
| No SFU bill | We don't get YT analytics — we instrument our own |

The leakage point — the YT video ID is in the iframe URL inside the WebView — is mitigated, not eliminated:
- Broadcasts are **Unlisted**, not Public. They don't appear in search.
- Watermarks on every playback identify the leaker.
- Rotated broadcasts per class — old links die after class ends.
- All `yt-playback-sign` calls are audited; spike of repeated requests by one user flags review.

This is recorded explicitly so future-us is honest about it.

## 4. Lifecycle

```
1. Teacher creates a Live Session (or admin schedules one):
   sessions row { is_live_class=true, scheduled_start, scheduled_end }
              ↓
2. `yt-broadcast-create` edge fn:
   - Calls YT Data API: liveBroadcasts.insert (status='ready', privacy='unlisted', chat disabled)
   - Creates liveStreams resource (RTMP ingest)
   - Returns { rtmp_url, stream_key, yt_broadcast_id, yt_video_id } to teacher
              ↓
3. Teacher copies RTMP url+key into OBS/Streamlabs → goes live.
              ↓
4. YT broadcast becomes 'live'. We poll status (or use YT push notifications).
   sessions.status = 'live', sessions.started_at = now()
              ↓
5. Students see "Join Live" CTA on dashboard / classes tab.
   When student joins, mobile calls `yt-playback-sign` to get the signed payload.
   Wrapped player loads the YT video inside iframe.
              ↓
6. Chat + raise-hand via Realtime channel `room:session:{id}`.
              ↓
7. Teacher ends stream → sessions.status = 'ended', sessions.ended_at = now()
   YT auto-saves the broadcast as a regular video (still Unlisted).
              ↓
8. Recording becomes available immediately. Same player + same chat replay
   are exposed via `(student)/recording/[sessionId].tsx`.
```

## 5. Scheduling UI (Teacher)

`(teacher)/classes.tsx → + → Schedule Live Class`:

```
┌──────────────────────────────────────┐
│ Schedule Live Class                  │
│ Batch:    [NEET 2027 Morning ▾]      │
│ Subject:  [Physics ▾]                │
│ Topic:    [Kinematics ▾] (optional)  │
│ Title:    [Projectile Motion intro]  │
│ Starts:   [Thu 16 May 09:00 IST]     │
│ Duration: [90 min]                   │
│                                      │
│ ☑ Auto-create YouTube broadcast      │
│                                      │
│   [Save & Get Stream Key]            │
└──────────────────────────────────────┘
```

On save:
- `sessions` row inserted (`is_live_class = true`, `status = scheduled`).
- `yt-broadcast-create` fires.
- Teacher screen shows:
  ```
  Stream key: ✱✱✱✱✱✱✱✱✱✱  [copy]
  RTMP URL:   rtmp://a.rtmp.youtube.com/live2
  ```
- Teacher copies these into OBS (one-time setup, then reusable per class via "OBS profile").
- Teacher hits "Go Live" in OBS at class time.

## 6. Going Live (Teacher Control Screen)

`(teacher)/live-control/[sessionId].tsx`:

```
┌──────────────────────────────────────┐
│ ●  LIVE — Projectile Motion intro    │
│                                      │
│   ⊡ Preview (low-latency preview     │
│        iframe — teacher only)        │
│                                      │
│  Viewers: 26                         │
│  Chat:                               │
│   priya: sir, slide 5 plz            │
│   aarav: 🔥                          │
│        [Pin message]  [Delete]       │
│                                      │
│  Raise hands queue:                  │
│   👋 Rohit   [resolved] [call out]   │
│                                      │
│  [Pin Announcement]                  │
│  [End Class]                         │
└──────────────────────────────────────┘
```

- Preview shows the same wrapped player so teacher sees what students see (good for sanity).
- Viewer count from Realtime presence on `room:session:{id}`.
- Chat moderation: delete messages, ban from current class.
- Raise-hand queue: tap "call out" → drops a system message in chat ("@Rohit your question please") + clears the raise.
- Pin announcement: a banner that all students see above the chat ("Solution for Q4 will be after this section").
- End Class → `yt-broadcast-stop` edge fn → ends YT broadcast → flips session.status → triggers parent-report nothing (parent reports are weekly, not per-class).

## 7. Student Live View

`(student)/live/[sessionId].tsx`:

```
┌──────────────────────────────────────┐
│  ● LIVE  Projectile Motion intro     │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │   [Wrapped YT player iframe]   │  │
│  │   Watermark: "Aarav S • ••56"  │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  Pinned: "Solution after this part"  │
├──────────────────────────────────────┤
│  Chat                                │
│   priya: sir, slide 5 plz            │
│   aarav: 🔥                          │
│   [Type a message…] [😊] [✋ Raise]   │
└──────────────────────────────────────┘
```

Components:
- `WrappedYtPlayer` — loads the iframe with `controls=0`, `modestbranding=1`, `rel=0`, `disablekb=1`. Renders semi-transparent watermark overlay.
- `ChatPane` — subscribes to `room:session:{id}` Realtime channel; posts messages via Supabase insert into `chat_messages`.
- `RaiseHandButton` — toggles a `raise_hand_events` row + broadcasts on `:hands` channel.
- "Pinned" strip at the top.

Lobby behavior:
- If student opens the room before teacher is live: shows a countdown card "Live in 5 min".
- Once live, player auto-plays.

## 8. Watermark

Implemented client-side using an `<Animated.View>` over the player:
- Text: `{full_name} • ••••{phone_last_4}` (or `••0000` if phone missing).
- Alpha 0.25, font-size 12, white text with 1px dark shadow.
- Position rotates every 60 seconds across 4 corners + center bottom to prevent crop-based defeat.
- Z-index above the iframe.
- Server-issued via `yt-playback-sign` payload; client doesn't compute it (so user can't trivially remove via app patching).

## 9. Chat

### 9.1 Channels

- `room:session:{id}` — primary chat. Broadcast events on insert/update/delete.
- `room:session:{id}:hands` — raise-hand events.
- `room:session:{id}:state` — pinned announcement updates, end-of-class signal.
- `room:session:{id}:roster` — teacher-only, for live attendance count (overlaps with attendance spec).

### 9.2 Permissions

- Students in the session's batch can join chat. Teacher of batch + admin can join + moderate.
- Chat opens 15 min before `scheduled_start`, closes 30 min after `scheduled_end`.
- Banned users (from `chat_bans`) cannot post; they can still see the player.

### 9.3 Persistence

- Every message persisted to `chat_messages`. Realtime broadcast piggybacks on Postgres `INSERT` events.
- Deletion: soft (`is_deleted = true`); UI hides deleted but admin can see in audit if needed.

### 9.4 Replay (during recording playback)

- `recording/[sessionId].tsx` mounts the same player with the session's `yt_video_id`.
- Chat replay component reads `chat_messages` filtered by session, ordered by `posted_at`.
- Renders messages in sync with player time: `posted_at - sessions.started_at` = playback offset.
- Speed changes (1x → 1.5x) also speed chat replay proportionally.

## 10. Raise Hand

Student taps ✋:
- Inserts `raise_hand_events { session_id, student_id, raised_at }`.
- Broadcast on `:hands` channel.
- Teacher sees queue.
- Teacher can `[resolve]` (clears) or `[call out]` (system chat msg + auto-resolve).
- Student sees their raise reflected as a small indicator ("✋ raised") until resolved.

## 11. Recording

After teacher ends:
- YT video resource is automatically the recording (Unlisted, same `yt_video_id`).
- `sessions.status = 'ended'`, `ended_at = now()`.
- Recording immediately listed under `(student)/classes.tsx > Recorded` for the batch.
- Same wrapped player; chat replay enabled.
- Visibility: limited to the original batch (RLS).

## 12. `yt-playback-sign` Payload

Signed by server, consumed by wrapped player:

```json
{
  "v": 1,
  "kind": "live" | "recording",
  "video_id": "<yt_video_id>",
  "watermark": "Aarav S • ••56",
  "exp": <unix>,
  "session_id": "<uuid>",
  "sig": "<hmac>"
}
```

Player verifies signature on load. Refresh on `exp` boundary (every 4h for recordings, every 1h for live).

## 13. Telemetry

- `live_class_joined` `{ session_id }`
- `live_class_left` `{ session_id, duration_sec }`
- `chat_message_posted`
- `chat_message_deleted` (mod)
- `raise_hand_raised`
- `raise_hand_resolved`
- `recording_played` `{ session_id, completed_pct }`

## 14. Security Considerations

- YT broadcast is Unlisted, chat disabled on YT side, embeds restricted to our app's WebView host where possible.
- Watermark is server-issued; not editable client-side.
- All access goes through `yt-playback-sign` which audits every issuance.
- Chat moderation actions audited.
- Edge fn `yt-broadcast-create` calls YT Data API with refresh-token credentials stored in Supabase Vault. The mobile client never has access to YT API keys.
- Stream key shown only to the creating teacher — never persisted in plaintext on device beyond the live-control screen.

## 15. Edge Cases

| Case | Behavior |
|---|---|
| Teacher's stream drops, restarts in OBS within 5 min | YT broadcast remains, students see "Buffering…" then resumes. |
| Teacher ends class but YT video processing still ongoing | Recording shows "Processing…" state for students until ready. |
| Student joins recording before processing done | Sees the processing state with retry; can also leave and return. |
| Network drops on student side during live | Player auto-reconnects on regain. Chat resumes from missed messages. |
| Hostile user opens dev tools and extracts YT URL | Identified via watermark; flagged via audit on `yt-playback-sign` frequency. |
| Multiple devices on one account | Both display the watermark with same identity; chat shows last device active. |

## 16. Data Model Touchpoints

- `sessions` — `is_live_class`, `yt_broadcast_id`, `yt_video_id`, `status`
- `chat_messages`, `raise_hand_events`, `chat_bans`
- `audit_log`

## 17. Edge Function Map

| Function | Caller | Action |
|---|---|---|
| `yt-broadcast-create` | Teacher/admin | Create Unlisted broadcast + return stream key |
| `yt-broadcast-stop` | Teacher | End broadcast, persist final state |
| `yt-playback-sign` | Student/teacher | Issue signed playback payload |
| `chat-delete` | Teacher/admin | Soft-delete a message |
| `chat-ban` | Teacher | Add user to `chat_bans` for this session |

## 18. UI / Screens

| Screen | Path |
|---|---|
| Live (student) | `app/(student)/live/[sessionId].tsx` |
| Recording (student) | `app/(student)/recording/[sessionId].tsx` |
| Live control (teacher) | `app/(teacher)/live-control/[sessionId].tsx` |
| Schedule modal | `app/(teacher)/classes.tsx?sheet=schedule-live` |

## 18A. One-time OAuth refresh-token setup (do BEFORE Phase 9)

Detailed steps live in `docs/external-setup-timeline.md §8`. Summary:

1. Google Cloud Console → enable YouTube Data API v3 → configure OAuth consent screen with scopes `youtube` + `youtube.force-ssl`.
2. Create OAuth Client ID (Web application, redirect URI = `https://developers.google.com/oauthplayground`).
3. Use the OAuth Playground signed in as the institute's Google account → authorize the YT scopes → exchange for tokens → capture the `refresh_token`.
4. Store in Supabase Vault: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, `INSTITUTE_CHANNEL_ID`.
5. Verify with a one-shot curl: refresh the token, then call `videos.list?id=<known_id>&part=snippet` — should return JSON.

If the refresh token is ever revoked (admin password change, 6 months unused, user revokes app in their Google security settings), repeat steps 3–4.

## 19. Open Items

- WebRTC fallback for very-low-latency Q&A — out of MVP; revisit if students complain about 10–20s delay.
- Push notifications "Class is starting now" — out of MVP; users currently rely on schedule + email.
- Caption / transcript — defer (would require a separate ASR service).
