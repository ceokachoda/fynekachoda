# 📱 Mobile video + live-class test guide (2026-06-07)

This guide is **click-by-click** for verifying the new mobile video behaviour that
now matches the web app: **horizontal (landscape) viewing with the chat beside
the video, a fullscreen button, a hardened overlay that can never bounce you to
YouTube, and low-end-friendly playback.** No coding needed — just tap along.

> Run on a **real phone** (ideally a low-end Android, Redmi 8A class) AND an
> iPhone if you have one — the rules below behave the same on both.

---

## 0. Start the app

1. In the terminal, type: `pnpm dev:mobile` and press Enter.
   - If you want a clean start: `pnpm dev:mobile -- --clear`.
2. Open **Expo Go** (or your dev build) and load the app.
3. Log in as a **student** for §1–§4, and as a **teacher** for §5–§7.

> ⚠️ For the *most realistic* test, use the **preview APK** (not the dev client)
> — the dev client is always a bit slower. The dev client is fine for checking
> that everything *works*, just not for judging smoothness.

---

## 1. Live class — PORTRAIT (hold phone upright)

1. As a **student**, open a class that is **Live now** (teacher must have tapped
   *Go Live* — see §5).
2. ✅ You should see the video at the **top**, and the **chat below it**.
3. Tap the **play button in the middle** of the video (this starts the sound).
4. ✅ After it starts, **tap the video once**: a small **LIVE** badge (red) shows
   top-left, and a **mute** 🔊 button + a **fullscreen** ⛶ button show top-right.
5. ✅ Wait ~3 seconds without touching: those buttons **fade away** on their own
   (clean view). Tap again → they come back.
6. Type a message in the chat box at the bottom and send it. ✅ It appears.

---

## 2. Live class — LANDSCAPE (turn phone sideways) ⭐ the main new thing

1. While watching the live class, **rotate your phone to landscape**.
2. ✅ The video moves to the **left**, and the **chat is now beside it on the
   right** — you can watch AND read/See the chat at the same time.
3. ✅ The chat still updates live; you can still send a message and raise your
   hand from the right column.
4. Rotate back to portrait → ✅ it returns to video-on-top, chat-below.

---

## 3. Fullscreen button (video only, no chat)

1. In the live class, tap the video once to show the buttons, then tap the
   **fullscreen** ⛶ button (top-right).
2. ✅ The phone **locks to landscape** and the video fills the **whole screen**
   (chat hidden) — like Netflix/YouTube fullscreen.
3. Tap the video, then tap the **minimise** ⛶ button.
4. ✅ It exits fullscreen. If you're still holding the phone sideways you go back
   to **video + chat side-by-side**; if upright, back to portrait.

---

## 4. 🔒 The important one — you must NEVER land on YouTube

Try hard to "escape" to the YouTube app/website. None of these should work:

1. Tap the video **many times, fast**, in every corner and the middle.
2. Try a **long-press** on the video.
3. Try **pinch-to-zoom** on the video.
4. Before the video starts, tap around the edges.

✅ **Expected:** You always stay inside the FyneStudy app. The YouTube app /
Safari / Chrome must **never** open, and you must never see a "Watch on YouTube"
page or the YouTube logo become tappable. (Your name watermark keeps drifting
across the video the whole time.)

---

## 5. Teacher — go live + moderate (chat AND hands together)

1. Log in as a **teacher**. Go to **Classes → Schedule live class** (or open one
   you already scheduled), then open **Live control**.
2. Copy the server + key into OBS if doing a real stream, then tap **Go Live**.
3. ✅ Once live, you see the preview at top with a red **LIVE** badge.
4. Have a student (or second phone) **raise their hand** and **send messages**.
5. ✅ **New:** there are **no more "Chat / Hands" tabs.** Raised hands appear in a
   yellow strip **above** the chat, and the **chat is always visible below** —
   both at once. Tap **Resolve** on a hand → it disappears from the strip.
6. Long-press a student's message → ✅ you can **Delete** or **Mute** them.
7. Tap **Pin an announcement** → type → **Pin** → ✅ students see it pinned.

---

## 6. Schedule a class — clear conflict message

1. As a teacher, schedule a live (or offline) class for a batch + time.
2. Now try to schedule **another** class for the **same batch at the same start
   time**.
3. ✅ You should see a **clear** message: *"There's already a class for this batch
   at that time. Pick a different start time."* (not a vague error).

---

## 7. Recordings & library videos (also landscape-aware)

1. As a student, open a **recording** of a finished class.
   - Portrait: ✅ video on top, play/seek/speed controls below, chat replay under.
   - Landscape: ✅ video **left**, chat replay **right** (side-by-side).
   - ✅ Fullscreen ⛶ button works the same as §3.
2. Open a **library video** (Library → tap a video).
   - ✅ Plays with on-video controls; fullscreen ⛶ button works; the resume
     prompt still appears if you watched part of it before.

---

## ✅ Pass criteria (tick all)

- [ ] Live class shows **video + chat side-by-side in landscape** (§2)
- [ ] Fullscreen button gives **video-only**, minimise returns (§3)
- [ ] **Impossible** to get redirected to YouTube, by any tap/long-press/zoom (§4)
- [ ] Mute + LIVE badge + auto-hiding controls work (§1)
- [ ] Teacher sees **chat + raised hands at the same time** (§5)
- [ ] Duplicate-time scheduling shows the **clear conflict message** (§6)
- [ ] Recording + library video work in both orientations (§7)
- [ ] On a low-end phone, rotating does **not** reload/re-buffer the video
      (it keeps playing through the rotation)

> If anything fails, note the screen + what you did + what happened, and send it
> over — the fix will be precise.
