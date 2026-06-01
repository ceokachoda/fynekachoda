# Offline-Class Scheduling + Attendance — Manual Test Plan

> Click-by-click verification for the **named offline class + date/time scheduling**
> feature (decision **D-205**), plus a full re-check that the **whole attendance
> section** (QR + manual, web + mobile + admin) still works end-to-end.
>
> Go slowly. Tick each `[ ]` only when the **Expected** line actually happens on
> screen. If anything differs, write down the section number + what you saw and
> stop.

---

## What is already proven automatically (you do NOT need to test these)

These passed before this plan was written — listed so you know what's covered:

- **Backend is LIVE** on `fynestudy-dev`: the `sessions.title` column + length
  check are applied and SQL-verified; the `session-create-ad-hoc` edge function
  is deployed with the title logic.
- **Constraint:** a valid class name round-trips; a name longer than 120 chars
  is rejected by the database.
- **Code gates:** web `typecheck / lint / test (207) / build` ✅, admin
  `typecheck / lint / build` ✅, mobile `typecheck / lint (0 errors) / test (57)` ✅.
- **Advisors:** 0 ERROR-level security/performance lints from the migration.

This plan is the **human-eye** part: real browser, real phone, two-device QR race.

---

## 0. One-time setup

### 0.1 Where to test

The **backend is already live**, so you only need the updated **web** and **mobile**
client code running. Two options:

| Surface | If clients are deployed | If not yet deployed (test locally) |
|---|---|---|
| **Web** | open the live site `https://fynestudy.live` | run `pnpm --filter @fynestudy/web dev` → open `http://localhost:3000` |
| **Mobile** | install the latest `preview` APK | run `pnpm dev:mobile -- --clear` and open in Expo Go / dev build |
| **Admin** | `https://fyne-study-app-admin.vercel.app/` | `pnpm --filter @fynestudy/admin dev` → `http://localhost:3000` |

> ⚠️ If you test the web app **locally**, log in over `http://localhost:3000`
> (CORS is already whitelisted for localhost). The data you create is **real**
> (dev DB = prod DB), so use the test accounts below, not real student data.

### 0.2 Test accounts

Run the seed once to get a teacher, two students, and a batch they share:

```
pnpm seed:manual-test
```

Write down what it prints:

- **Teacher** email + password ……………………………………
- **Student 1** email + password ……………………………………
- **Student 2** email + password ……………………………………
- **Batch** name ……………………………………

Admin (for §H): use the owner admin already in the dev DB
(`owner@fynestudy.example.com` + your TOTP).

### 0.3 Two devices help

For the QR test (§C / §G-QR) you need the **teacher on one screen** (camera) and
a **student on another** (showing the QR). A laptop + a phone is ideal. If you
only have one device, you can still do everything **except** live QR scanning —
use the **manual roster** path instead, which is the whole point of this feature.

---

# PART 1 — WEB

## A. Teacher creates a NAMED offline class (the core new flow)

1. [ ] Log in as the **Teacher**. In the bottom/side nav open **Classes**
       (URL ends `/classes`).
2. [ ] Bottom-right you see **two round buttons**: a **red** one (Radio icon =
       *Schedule live class*) and a **blue** one (`+` = *New offline class*).
3. [ ] Tap the **blue `+`**. A sheet titled **"New offline class"** slides up.
4. [ ] **Expected — the sheet has all of these fields:**
       - **Class name** (text box, placeholder like *"Chemistry — Mole concept revision"*)
       - **Batch** (defaults to your first assigned batch)
       - **Date** + **Start time** pickers (side by side)
       - **Duration** chips: 30 / 45 / 60 / 90 min
       - a **"Class window"** summary line showing the time range in IST
       - **Create class** button (greyed out at first)
5. [ ] Leave the name **empty** and try to tap **Create class**.
       **Expected:** the button stays **disabled** — you cannot create a nameless class.
6. [ ] Type a class name, e.g. **`Physics — Rotational Motion doubt class`**.
       **Expected:** the **Create class** button becomes enabled (blue).
7. [ ] Leave **Date = today**, pick a **Start time a few minutes from now**,
       Duration **60 min**, confirm the **Batch** is the seeded batch.
8. [ ] Tap **Create class**.
       **Expected:** the sheet closes and you land on the **Roster** screen
       (URL `/roster/<id>`).
9. [ ] **Expected — the Roster header shows YOUR class name**
       (`Physics — Rotational Motion doubt class`), the batch name with a small
       **"· ad-hoc"** tag, and the time range you picked.
10. [ ] Go **back** to **Classes**. In the **Today** tab, **Expected:** the new
       class appears as a row showing **your class name** (not just "Class"),
       a **Scan** button and a **Roster** button, and `0 / N marked`.

✅ **What to report:** the name you typed is shown on both the Roster header and
the Classes list, and a nameless class can't be created.

---

## B. Teacher takes attendance MANUALLY (roster — no QR needed)

Use the class you just made (open its **Roster**).

1. [ ] **Expected:** a list of the batch's students, each with **P / L / A**
       pills, and four counters at top (Present / Late / Absent / Pending).
2. [ ] Tap **P** on Student 1. **Expected:** the pill turns green, Present count
       becomes 1, Pending drops by 1 (saves immediately).
3. [ ] Tap **L** on Student 2. **Expected:** marked Late.
4. [ ] Tap the **green P** on Student 1 **again**. **Expected:** a confirm dialog
       *"Un-mark this student?"* → confirm → Student 1 returns to unmarked.
5. [ ] Tap **All Present** (top button) → confirm. **Expected:** every **unmarked**
       student becomes Present; students already marked (Student 2 = Late) are
       **left unchanged**.
6. [ ] **Correction:** on a marked student, tap a **different** status pill
       (e.g. tap **A** on a Present student). **Expected:** a *"Change status…"*
       dialog asks for a **reason** (preset chips + free text); pick a reason,
       save. **Expected:** status changes and the dialog closes.
7. [ ] Pull-to-refresh / reload the page. **Expected:** all marks **persist**.

✅ **What to report:** P/L/A, un-mark, All-Present bulk, and correction-with-reason
all work and persist. This is the path your client uses when there's no QR.

---

## C. Teacher takes attendance by QR (two devices)

1. [ ] On a **second device**, log in as **Student 1**, open **Attendance**.
2. [ ] **Expected:** because the class window is open, a **QR code** is shown,
       and above/below it your **class name** appears (e.g.
       *"Physics — Rotational Motion doubt class · 10:45"*).
3. [ ] On the **teacher** device, from the class row tap **Scan** (or open `/scan`).
       Tap **Start camera**, allow the camera.
4. [ ] **Expected — the "Scanning for" banner shows YOUR class name** + time + batch.
5. [ ] Point the camera at Student 1's QR. **Expected:** a green toast
       *"✔ … Present"* (or Late if outside the 10-min band).
6. [ ] Open the **Roster** again. **Expected:** Student 1 now shows **Present**
       with method = QR; the count went up. (If you already marked them in §B,
       you'll instead get *"Already marked"* — that's correct replay protection.)

✅ **What to report:** QR scan marks the student and the scanner shows the class name.

---

## D. Student sees the NAMED class everywhere

Stay logged in as **Student 1**.

1. [ ] **Attendance** screen → **Today's classes** list. **Expected:** the row
       shows **your class name** + time + a status badge (Present/Late/Open…).
2. [ ] **My history** section. **Expected:** the class you were marked in appears
       with **your class name** (not "Class") and the right status.
3. [ ] Open **My Classes** (`/classes`). **Expected:** under **Upcoming** (or
       **Live** if it's live) the class shows **your class name**.

✅ **What to report:** the class name the teacher typed is visible to the student
on Attendance (QR label + today list + history) and My Classes.

---

## E. Schedule an offline class for a FUTURE day

1. [ ] As **Teacher**, **Classes → blue `+`** again. Name it
       **`Maths — Tomorrow revision`**.
2. [ ] Change the **Date** to **tomorrow**, pick any **Start time**, Create.
3. [ ] Open **Classes → Upcoming** tab. **Expected:** the class appears there
       with tomorrow's date and your name.
4. [ ] As **Student 1**, **My Classes → Upcoming**. **Expected:** the named class
       is listed for tomorrow.
5. [ ] (Optional) As Student 1 open **Attendance** today. **Expected:** tomorrow's
       class is **not** shown / has **no QR yet** (the scan window opens 15 min
       before its start) — this is correct.

✅ **What to report:** you can schedule a class ahead of time, and it shows on the
right day for both teacher and student.

---

## F. (Optional) Live class also has a name

1. [ ] As Teacher, **Classes → red Radio FAB** → sheet titled
       **"Schedule live class"**. **Expected:** it also requires a **Class name**
       + date/time. Name it, Create → you land on **Live control**.
2. [ ] **Expected:** the Live-control header shows **your class name**.
   *(You don't need to actually go live to pass this — just confirm the name.)*

---

# PART 2 — MOBILE (Android / iOS)

> Do the same flows on the phone. Button names match the web. If you changed
> branches, do a **clean Metro restart** first (Ctrl+C, force-quit Expo Go,
> `pnpm dev:mobile -- --clear`).

## G. Mobile teacher + student

1. [ ] **Teacher → Classes tab.** Bottom-right: **red FAB** (Schedule live class)
       and **blue FAB** (New ad-hoc class).
2. [ ] Tap **blue FAB** → sheet **"New offline class"** with **Class name**,
       **Batch**, **Starts** (tap it → a **"Pick start date + time"** modal with
       a horizontal day strip + a 15-min time grid → **Use this time**),
       **Duration** chips.
3. [ ] Empty name → **Create class** is **greyed out**. Type a name → it enables.
4. [ ] Pick today + a near time → **Create class**. **Expected:** you land on the
       **Roster**; the header shows **your class name** + "· ad-hoc".
5. [ ] **Manual marking:** tap P/L/A pills, **All Present / All Absent**,
       tap a pill again to **un-mark**, **long-press** a row to correct with a
       reason. **Expected:** all work + persist (pull to refresh).
6. [ ] **QR (2 devices):** Teacher **Scan** tab → the **"Scanning for"** label
       shows your class name → scan Student 1's QR → green success.
7. [ ] **Student** (phone or 2nd device): **Attendance** shows the **QR labelled
       with your class name**; **Today's classes** + **My history** show the name;
       **Classes** tab shows it under Upcoming/Live.

✅ **What to report:** mobile create-with-name + date/time picker + manual + QR all
work, and the name shows on every teacher + student screen.

---

# PART 3 — ADMIN

## H. Attendance matrix shows the class name

1. [ ] Log in to the **Admin** panel → **Attendance** (`/attendance`).
2. [ ] Set **From/To** to cover today, pick the seeded **Batch**, tap **Apply**.
3. [ ] **Expected:** the matrix columns are dated and the small grey sub-label
       under each date shows **your class name** (e.g.
       *Physics — Rotational Motion doubt class*), with **"· ad-hoc"** on the
       ones you created.
4. [ ] Click any marked **cell** (P/L/A). **Expected:** the correction dialog
       title/description includes **your class name**.
5. [ ] Tap **Export CSV**. Open the file. **Expected:** each session column header
       reads `<date> — <your class name> (ad-hoc)`.

✅ **What to report:** the admin matrix, correction dialog, and CSV all show the
teacher's class name.

---

# PART 4 — Edge cases / sanity

## I. Quick checks

1. [ ] **Name length:** in any create sheet, the **Class name** box stops at
       **120 characters** (can't type more).
2. [ ] **Recurring classes still fine:** open a normal **timetabled** class
       (not ad-hoc) on Classes/Roster. **Expected:** it still shows its **subject
       name** (these have no custom title — that's correct).
3. [ ] **No "must be live":** the offline class you made is **not** a live class,
       yet you could take attendance (manual + QR) the whole time. ✅
4. [ ] **Reload safety:** hard-refresh (Ctrl+Shift+R on web) any screen above —
       names and marks remain.

---

## Results

| Section | Pass? | Notes (what you saw if it failed) |
|---|---|---|
| A. Web — create named offline class |  |  |
| B. Web — manual roster attendance |  |  |
| C. Web — QR attendance |  |  |
| D. Web — student sees the name |  |  |
| E. Web — future scheduling |  |  |
| F. Web — live class name (optional) |  |  |
| G. Mobile — teacher + student |  |  |
| H. Admin — matrix / CSV / correction |  |  |
| I. Edge cases |  |  |

**Overall:** ☐ All pass ☐ Issues found (list section numbers above)

---

### Notes for the tester
- The class **name** is the teacher's free text; if a teacher somehow leaves it
  blank (e.g. an older app build), it safely falls back to the subject, then to
  the word **"Class"** — so nothing ever looks broken.
- The **dashboard "Up next" card** and the **dashboard "today" list** still label
  classes by subject/"Class" for now (a known deferred follow-up, D-205) — that's
  expected and not a bug. Every **other** student/teacher surface shows the name.
