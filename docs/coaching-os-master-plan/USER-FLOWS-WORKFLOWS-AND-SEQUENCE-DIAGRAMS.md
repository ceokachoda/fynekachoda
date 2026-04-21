# User Flows, Workflows & Sequence Diagrams

This document depicts the critical flows end-to-end. Each one is tied back to a phase in the master plan and is the shared reference when a reviewer asks "how does X actually work?".

## 1. Student login

```mermaid
sequenceDiagram
    actor S as Student
    participant App as RN App
    participant SB as Supabase Auth
    participant OTP as MSG91

    S->>App: Enter phone
    App->>SB: signInWithOtp({phone})
    SB->>OTP: send SMS
    OTP-->>S: SMS with OTP
    S->>App: Enter OTP
    App->>SB: verifyOtp({phone, token})
    SB-->>App: session (access + refresh)
    App->>App: persist in SecureStore
    App->>SB: select * from profiles (self)
    SB-->>App: profile row (via RLS)
    App->>App: router.replace('/(app)/(tabs)/home')
```

## 2. QR attendance (end-to-end)

```mermaid
sequenceDiagram
    actor S as Student
    actor T as Staff/Teacher
    participant SApp as Student App
    participant TApp as Scanner App
    participant EF as Edge Fn
    participant PG as Postgres

    rect rgb(240,240,240)
      note over SApp: On login (once)
      SApp->>EF: issue-qr-token
      EF->>PG: upsert qr_secrets
      EF-->>SApp: { secret }
      SApp->>SApp: SecureStore.set(secret)
    end

    loop every 15s while QR screen is open
      SApp->>SApp: sign JWT (sub, jti, iat, exp=iat+20) with secret
      SApp->>SApp: render QR
    end

    T->>TApp: open scanner + pick class
    T->>SApp: scan QR
    TApp->>EF: consume-qr-token { token, class_id }
    EF->>PG: SELECT qr_secrets where student_id = jwt.sub
    EF->>EF: verify signature + exp + clock skew
    EF->>PG: SELECT 1 from qr_jti_cache where jti = ?
    EF->>EF: check enrollment + class_window
    EF->>PG: INSERT attendance, INSERT qr_jti_cache
    EF->>PG: INSERT notifications(attendance.marked)
    EF-->>TApp: { student, class }
    TApp->>T: show green toast + name
    PG-->>SApp: realtime UPDATE on attendance
    SApp->>S: "Attendance marked for Physics, 10:03 AM"
```

Failure paths shown in `PHASE-03` §Error cases.

## 3. Live class join

```mermaid
sequenceDiagram
    actor S as Student
    participant App
    participant EF as Edge Fn
    participant HMS as 100ms

    App->>App: user taps "Join Live"
    App->>EF: issue-100ms-token { classId }
    EF->>EF: check auth + role + enrollment + membership + class window
    EF->>HMS: generate subscriber token for room_id
    HMS-->>EF: JWT token
    EF-->>App: { token, room_id, role }
    App->>HMS: HMSSDK.join(token)
    HMS-->>App: room joined, video track
    App->>App: render teacher video tile + chat
    App->>EF: (after 60s presence) attendance auto-mark (internal call)
    EF->>PG: INSERT attendance(method='live')
```

## 4. Class end + recording availability

```mermaid
sequenceDiagram
    actor T as Teacher
    participant TApp as Teacher App
    participant EF as Edge Fn
    participant HMS as 100ms
    participant Bunny
    participant PG

    T->>TApp: tap "End class"
    TApp->>EF: finalize-class { classId }
    EF->>HMS: endRoom(room_id)
    EF->>PG: UPDATE classes SET status='ended', UPDATE class_rooms SET recording_status='processing'

    HMS->>EF: webhook beam.recording.success { url, room_id }
    EF->>EF: verify HMAC
    EF->>HMS: GET recording file (server-side pull)
    EF->>Bunny: POST library/upload
    Bunny-->>EF: { video_id, status: 'processing' }
    Bunny->>EF: webhook video.ready { video_id }
    EF->>PG: INSERT content_items(type='recording', video_asset_id, batch_id)
    EF->>PG: UPDATE class_rooms SET recording_status='ready'
    EF->>PG: INSERT notifications(category='recording.ready') for all enrolled students
    PG-->>Students: realtime update on content_items + notifications
```

## 5. Recorded-class playback

```mermaid
sequenceDiagram
    actor S as Student
    participant App
    participant EF as Edge Fn
    participant Bunny

    S->>App: tap recording
    App->>EF: sign-bunny-url { content_id }
    EF->>PG: SELECT content with RLS (visibility + membership check)
    EF->>EF: compute Bunny token URL (ttl=3600)
    EF-->>App: { url, expires_at }
    App->>Bunny: HLS manifest request with signed URL
    Bunny-->>App: adaptive HLS segments
    App->>EF: update-watch-position every 10s
    EF->>PG: upsert watch_positions
```

## 6. Study material upload & access

```mermaid
sequenceDiagram
    actor T as Teacher (web panel)
    participant Panel as Admin Panel
    participant EF as Edge Fn
    participant SBS as Supabase Storage
    participant PG

    T->>Panel: drag PDF + metadata
    Panel->>EF: upload-material-url { path, type }
    EF->>SBS: create signed upload URL
    EF-->>Panel: { upload_url, path }
    Panel->>SBS: PUT file to signed URL
    Panel->>EF: finalize-material { path, meta }
    EF->>PG: INSERT content_items (status='processing' if needs thumb else 'ready')
    EF->>EF: (async) generate-thumbnail
    EF->>SBS: upload thumb to 'thumbs/'
    EF->>PG: UPDATE content_items.thumbnail_path, status='ready'
    EF->>PG: INSERT notifications(category='material.new') for batch students

    rect rgb(240,240,240)
      note over S: Student access
      actor S as Student
      S->>App: tap material
      App->>EF: request-material-url { content_id }
      EF->>PG: SELECT content with RLS
      EF->>SBS: create 10-min signed read URL
      EF-->>App: { url }
      App->>SBS: GET PDF
      App->>App: render PDF (with watermark)
    end
```

## 7. Membership payment and activation

```mermaid
sequenceDiagram
    actor S as Student
    participant App
    participant EF as Edge Fn
    participant Razor as Razorpay
    participant PG

    S->>App: tap Renew → pick plan
    App->>EF: create-razorpay-order { planId }
    EF->>PG: INSERT payments(status='pending')
    EF->>Razor: orders.create(amount, receipt)
    Razor-->>EF: { order_id }
    EF->>PG: UPDATE payments.razorpay_order_id
    EF-->>App: { order_id, key_id, amount }

    App->>Razor: RazorpayCheckout.open(order_id)
    Razor->>S: UPI / card / netbanking flow
    Razor-->>App: success { payment_id, signature }
    App->>EF: verify-razorpay-payment { order_id, payment_id, signature }
    EF->>EF: HMAC verify
    EF->>PG: UPDATE payments.status='paid', paid_at
    EF->>PG: upsert memberships (extend expires_at)
    EF->>PG: INSERT notifications(payment.success, membership.activated)
    EF-->>App: { membership }

    Razor->>EF: webhook payment.captured (safety net)
    EF->>PG: (idempotent no-op if already paid)

    EF->>EF: async generate-invoice-pdf
    EF->>SBS: upload invoice to invoices/
    EF->>PG: UPDATE payments.invoice_pdf_path
```

## 8. Teacher clip creation

```mermaid
sequenceDiagram
    actor T as Teacher
    participant TApp as Teacher App
    participant EF as Edge Fn
    participant Bunny
    participant PG

    T->>TApp: open recording, scrub, mark in/out
    T->>TApp: enter title + visibility + submit
    TApp->>EF: create-clip { source_content_id, in, out, meta }
    EF->>PG: INSERT content_items(type='clip', status='processing', parent_content_id)
    EF->>Bunny: POST clip API with source video_id + in + out
    Bunny-->>EF: { new_video_id }
    EF->>PG: UPDATE content_items.video_asset_id = new_video_id
    Bunny->>EF: webhook clip.ready { video_id }
    EF->>PG: UPDATE content_items.status='ready'
    EF->>PG: INSERT notifications(material.new) for batch students
```

## 9. Admin adds a student

```mermaid
sequenceDiagram
    actor A as Admin
    participant Web as Admin Panel
    participant Supa as Supabase Admin API
    participant PG

    A->>Web: /admin/students → Add
    Web->>Supa: auth.admin.createUser({ phone, email? })
    Supa-->>Web: user_id
    Web->>PG: INSERT profiles(id=user_id, full_name, role='student', batch_id)
    Web->>PG: INSERT enrollments(student_id, batch_id)
    Web->>PG: UPDATE memberships on student_id (if plan attached at creation)
    Web->>MSG91: (optional) send welcome SMS with install link
    PG->>Web: row visible in list
```

## 10. Admin moderation of teacher upload

```mermaid
sequenceDiagram
    actor A as Admin
    participant Web
    participant EF as Edge Fn
    participant PG

    Note over PG: Teacher uploaded content_items(status='ready', approved_by IS NULL)
    A->>Web: /admin/content → filter by pending
    Web->>PG: SELECT content_items where approved_by is null and created_by.role='teacher'
    A->>Web: tap approve
    Web->>PG: UPDATE content_items SET approved_by = admin_id
    Web->>EF: (optional) send-announcement to batch students about new content
```

## 11. Push notification reminder pipeline

```mermaid
sequenceDiagram
    participant Cron as pg_cron (every minute)
    participant EF as Edge Fn: class-reminders
    participant PG
    participant Fanout as Edge Fn: expo-push-fanout
    participant Expo
    participant Device

    Cron->>EF: invoke
    EF->>PG: SELECT classes where scheduled_at between now+14m and now+15m
    EF->>PG: for each class → INSERT notifications for enrolled students
    Cron->>Fanout: invoke every 30s
    Fanout->>PG: SELECT notifications where sent_at is null LIMIT 500 FOR UPDATE SKIP LOCKED
    Fanout->>PG: JOIN device_tokens active
    Fanout->>Expo: POST /send (batched)
    Expo-->>Fanout: tickets
    Fanout->>PG: UPDATE notifications.sent_at, expo_ticket_id
    Expo->>Device: push via FCM/APNs
    Device->>App: tap → deep link → screen
    App->>PG: update notifications.read_at
```

## 12. Teacher starts a live class

```mermaid
sequenceDiagram
    actor T as Teacher
    participant TApp as Teacher App
    participant EF as Edge Fn
    participant HMS as 100ms
    participant PG

    T->>TApp: tap "Start class" (only enabled ≤10 min before scheduled_at)
    TApp->>EF: create-100ms-room { classId }
    EF->>EF: idempotency: exists class_rooms row? else:
    EF->>HMS: create room (name = class_id)
    EF->>PG: INSERT class_rooms(provider_room_id)
    EF->>EF: start recording via 100ms beam
    EF->>PG: UPDATE classes SET status='live'; UPDATE class_rooms SET recording_status='recording'
    EF->>PG: INSERT notifications(category='class.live.started') for batch students
    EF-->>TApp: { room_id, host_token }
    TApp->>HMS: join as host
    PG-->>Students: realtime classes UPDATE → dashboard flips to "Live now"
```

## 13. Student opens QR while offline

```mermaid
sequenceDiagram
    actor S as Student
    participant App
    participant SS as SecureStore

    S->>App: open QR screen
    App->>SS: getSecret(student_id)
    alt cached
      SS-->>App: secret
      App->>App: sign JWT locally; render QR
      Note over App: Works offline; scanner still needs network
    else missing
      App->>EF: issue-qr-token (requires network)
      Note over App: If offline AND no cached secret → show "Connect to internet once"
    end
```

## 14. Membership expiry flip

```mermaid
sequenceDiagram
    participant Cron as pg_cron (daily 02:00 IST)
    participant EF as Edge Fn: enforce-expiry
    participant PG

    Cron->>EF: invoke
    EF->>PG: UPDATE memberships SET status='expired' WHERE status='active' AND expires_at < now() - interval '7 days'
    EF->>PG: INSERT notifications(membership.expired) for flipped users
    EF->>PG: schedule notifications(membership.expiring.7d/3d/1d) for upcoming
```

## 15. End-to-end demo day walkthrough

```mermaid
flowchart LR
  A[Open app] --> B[Login with OTP]
  B --> C[Dashboard shows live class]
  C --> D1[Tap Join Live]
  D1 --> D2[Live room + chat]
  D2 --> D3[Leave]
  C --> E1[Tap My QR]
  E1 --> E2[Staff scans → green check]
  C --> F1[Open Recordings]
  F1 --> F2[Play yesterday's class]
  C --> G1[Open Library]
  G1 --> G2[View PDF]
  C --> H1[Profile → Membership]
  H1 --> H2[See plan + renew]
```

## 16. Error handling flow (generic)

```mermaid
flowchart TD
  A[User action] --> B{Network?}
  B -- No --> B1[Show offline banner + retry]
  B -- Yes --> C[Call API]
  C --> D{Response}
  D -- 401 --> D1[Force logout + go to phone]
  D -- 403 --> D2[Show "Access denied"]
  D -- 422 --> D3[Show business error code message]
  D -- 429 --> D4[Show "Too many attempts, try in 60s"]
  D -- 5xx --> D5[Sentry capture + show retry toast]
  D -- 200 --> E[Update cache / navigate]
```
