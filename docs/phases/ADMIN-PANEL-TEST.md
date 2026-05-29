# FyneStudy — Admin Web Panel Test (complete beginner guide)

> **What this is.** A full, click-by-click check that the **admin web panel** (the institute's
> control room, used in a **browser** on a computer) works before you launch. Tick each `[ ]`.
>
> **Time:** ≈ 25–40 minutes.
>
> 🔒 **Passwords:** this file is on **public GitHub**, so it has **no real passwords**. Your **owner
> login** is in the private file **`CREDENTIALS.local.md` → §1** in your project root. Open it when asked.
>
> **The admin panel is for admins only** — students/teachers use the phone app. There is **no
> self-signup**: every account is created here by an admin.

---

## §0 — Open the admin panel + what you need

**You need:** a computer with **Chrome**, your **owner login** (`CREDENTIALS.local.md §1`), and an
**authenticator app** on your phone (Google Authenticator / Authy).

**Open it — pick one:**
- **Hosted (normal):** open the **Vercel admin URL** from `CREDENTIALS.local.md §1`
  (e.g. `https://admin-kohl-sigma.vercel.app`) in Chrome.
- **Local (on your computer):** in PowerShell run **`pnpm dev:admin`**, then open
  **`http://localhost:3000`**.

✅ You should land on a **"FyneStudy Admin · Sign in"** screen.

---

## §1 — Login + Two-Factor (2FA)

### `[ ]` AT1 — Wrong password is rejected
1. Type the owner email and a **wrong** password → click **Sign in**.
**Expected:** A red banner **"Invalid email or password."** You stay on the login page.

### `[ ]` AT2 — Correct login → 2FA
1. Type the correct owner email + password (`CREDENTIALS.local.md §1`) → **Sign in**.
2. **If 2FA is already set up:** you reach **"Confirm it's you"** → open your authenticator app →
   type the current **6-digit code** → **Continue**.
   - *(Try a wrong/old code first → red **"That code didn't work. Try again."** — then the right one.)*
3. **If this is the very first time (no 2FA yet):** you reach an **enroll** page →
   - Open your authenticator app → **scan the QR code** on screen (or tap "Can't scan? Show the
     secret" and type the secret in).
   - Type the 6-digit code it shows → **Verify and continue**.
   - You're shown **10 recovery codes** → click **Copy all** and save them somewhere safe → tick
     **"I have saved these…"** → **Continue to dashboard**.

**Expected:** You **cannot** reach the dashboard without a valid 6-digit code. After it, you land on
the **Overview** page, and the bottom-left of the sidebar shows your name, email, and **"Owner admin"**.
**Gotcha:** Lost your authenticator? On the verify screen click **"Lost your authenticator? Use a
recovery code"**, enter one of your saved codes → it resets 2FA so you can enroll a fresh one. (Or
tell me "clear owner 2FA".)

---

## §2 — Overview (the home dashboard)

### `[ ]` AT3 — Live metrics + recent activity
1. You're on **Overview** (sidebar item 1, the "/" page).
**Expected:** **8 metric cards** with real numbers — top row: **Students, Teachers, Active batches,
Courses**; bottom row: **Published quizzes, Published exams, Study materials, Upcoming sessions**.
Below, a **"Recent activity"** panel lists the latest changes (e.g. "… created an account"). Each
card is clickable and jumps to its section.

---

## §3 — Students (create, view, suspend, reset, transfer, import)

### `[ ]` AT4 — Browse + filter the student list
1. Sidebar → **Students**.
2. Try the **search box** (type a name) and the status tabs **All / Active / Suspended / Pending PW change**.
**Expected:** The table (Name, Email, Phone, Class, Status, Created) filters as you type/click.

### `[ ]` AT5 — Create a student (this makes the account you use in the phone test T2)
1. Top-right → **+ New student**.
2. Fill **Full name** (e.g. `ZZ Test Student`), **Email** (a throwaway you control, e.g.
   `zz.test.student@example.com`), and pick a **Batch** (required — the course is derived from it).
   *(Other fields optional.)*
3. Click **Create student**.

**Expected:** A dialog **"Student created"** shows the **Email** + a **one-time temporary password**
with **Copy** buttons. **Copy the password now** (you need it for the phone test **T2**). The new
student appears in the list with an amber **"Pending PW change"** badge.
**Gotcha:** The temp password is shown **once**. If you lose it, open the student → **Reset password**
to make a new one.

### `[ ]` AT6 — Student detail + Suspend / Reactivate / Reset password
1. Click your `ZZ Test Student` to open their **detail** page (tabs: Identity / Activity / Audit).
2. Note that identity fields are **read-only** (admin is the source of truth).
3. Top-right → **Suspend** → optionally type a reason → confirm **Suspend**.
4. The status flips to **Suspended**; now click **Reactivate**.
5. Click **Reset password** → confirm → a **new temp password** is shown (copy it).

**Expected:** Suspend → "Suspended" badge; Reactivate → "Active"; Reset → a fresh one-time password
+ the student will be forced to change it next login. *(Each of these appears in the Audit log — see §11.)*

### `[ ]` AT7 — Transfer batch *(only if you have 2+ active batches)*
1. On the student detail, **Academic** card → **Transfer batch** → pick a target batch → type a
   **reason (3+ characters)** → **Transfer**.
**Expected:** The student's batch updates (and it's audited).

### `[ ]` AT8 — Bulk import students from CSV
1. Sidebar → Students → **Import CSV** (top-right) → you're on `/students/import`.
2. **Step 1:** pick a **target batch**.
3. **Step 2:** click **Download template**, open it, add 1–2 throwaway rows (required columns:
   `full_name`, `email`) → save → **upload** the file.
4. Review the **preview** (it shows valid/skipped rows) → click **Import N students**.
5. On the result, click **Download credentials (CSV)** (columns `email,temp_password`).

**Expected:** "Import complete · X created"; the credentials CSV downloads (shown once); any bad rows
are listed with a reason (e.g. "Email already in use"). The new students appear in the list + Audit.

---

## §4 — Teachers

### `[ ]` AT9 — Create a teacher + assign a batch
1. Sidebar → **Teachers** → **+ New teacher** → fill **Full name** + **Email** (Subjects optional) →
   **Create teacher** → copy the one-time password.
2. Open the new teacher → **Assigned batches** card → **+ Assign batch** → pick a batch → **Assign**.
3. *(Optional)* click **Unassign** to remove it.

**Expected:** Teacher created (with one-time creds); the batch assignment shows on their detail page.
**Note:** teachers have **no** Suspend/Reset buttons here — those live only on student pages.

---

## §5 — Admins  *(Owner only)*

### `[ ]` AT10 — Owner can manage admins
1. Confirm the sidebar shows an **"Admins"** item (4th) — *this only appears for the owner.*
2. Open it → **+ New admin** → fill Full name + Email, pick **Role** (Staff admin / Owner admin) →
   **Create admin** → copy the one-time password.

**Expected:** The new admin appears in the table with its role badge. *(A staff_admin would NOT see
this page at all.)*
**Tip for handover:** before giving the system to the institute, create a **real owner** here with
the institute's real email, then remove the demo `owner@fynestudy.example.com`.

---

## §6 — Batches

### `[ ]` AT11 — Create + edit a batch (with schedule + roster)
1. Sidebar → **Batches** → **+ New batch** → pick a **Course**, type a **Name**, set **Starts on**
   (and capacity) → **Create batch** (it opens the new batch's detail).
2. On the detail: change **Capacity** → **Save changes**.
3. **Teachers** section → assign a teacher.
4. **Schedule** section → add a row (Day, Start, End, optional Subject) → **Add row** → then **Remove** it.
5. **Students** section → confirm enrolled students show; each has a **Transfer** button.

**Expected:** Everything saves; the schedule row adds/removes; the roster lists students. *(Delete a
batch only works if nothing references it — otherwise use the Inactive status toggle.)*

---

## §7 — Courses & Curriculum

### `[ ]` AT12 — Create a course + build its curriculum tree
1. Sidebar → **Courses** → **+ New course** → **Code** (UPPER_SNAKE_CASE, e.g. `ZZ_TEST`) + **Name**
   → **Create course** (opens detail).
2. Open the **Curriculum** tab → **+ Subject** → add a subject → expand it → **+ Chapter** → add a
   chapter → expand → **+ Topic** → add a topic.
3. **Rename** a node (edit name → Save). **Delete** a node (it warns it cascades → **Yes, delete**).

**Expected:** The Subject → Chapter → Topic tree builds, renames, and deletes (with a cascade warning).

---

## §8 — Attendance

### `[ ]` AT13 — Attendance matrix + correction + CSV
1. Sidebar → **Attendance**. Set a **From**/**To** date range, pick a **Batch**, click **Apply**.
2. A grid shows students (rows) × sessions (columns) with **P / L / A / —** cells.
3. Click a marked cell → a **"Correct attendance"** dialog → pick a **New status** + a **reason**
   (3+ chars) → **Save correction**.
4. Click **Export CSV**.

**Expected:** The matrix renders; the correction saves and the cell updates; a CSV downloads
(timestamps in IST). The correction appears in the Audit log.

---

## §9 — Content (study materials)

### `[ ]` AT14 — Publish / promote / delete content
1. Sidebar → **Content**. Use the filters (Course / Batch / Kind / Status / Search).
2. On a **ZZ Test** (or test) item, click **Unpublish** then **Publish** → the badge flips.
3. *(Optional)* on a batch item, click **Promote course-wide** (or "Scope to batch…" to undo).
4. *(Optional, on a test item only)* **Delete** → confirm **"Delete content?"**.

**Expected:** Publish toggles flip; promote changes the scope chip; delete removes the row. All
audited. **Don't unpublish/delete real content.**

---

## §10 — Quizzes · Question bank · Exams · Offline scores  *(view & moderate)*
> Note: you **cannot author** quizzes/questions/exams here — those are built in the teacher app.
> The admin panel only **moderates** (publish/archive/release/delete).

### `[ ]` AT15 — Quizzes + Questions
1. Sidebar → **Quizzes** → on a test quiz, click **Unpublish/Publish** (badge flips). *(Delete only a
   test quiz: "Delete permanently".)*
2. Sidebar → **Question bank** → try **Archive/Unarchive** a question. Note **Delete is disabled** for
   a question that's used by a quiz (tooltip "archive instead").

### `[ ]` AT16 — Exams + Offline scores
1. Sidebar → **Exams** → on a test exam, try **Publish/Unpublish** and **Force release / Un-release**
   results (this is the admin override for releasing exam scores).
2. Sidebar → **Offline scores** → confirm teacher-entered paper scores list; you can **Delete** a bad
   row (view/delete only — no add form here).

**Expected:** Each action works and is audited.

---

## §11 — Audit log (the compliance trail)

### `[ ]` AT17 — Every action you did is recorded with before/after
1. Sidebar → **Audit log** (last item). A newest-first table: When · Actor (name + role) · Action · Entity.
2. Use the filters: set **Action** = `create_user` → **Apply** → find the student/teacher you created.
3. Click **Details** on a row.
4. Click **Export page (CSV)**.

**Expected:** Your create/suspend/reset/correct/publish actions all appear. The **Details** dialog
shows a metadata grid (Actor, Role, When, IP) and **two JSON panels — "Before" (red) and "After"
(green)**. A create shows Before = empty. The CSV downloads.
**Gotcha (critical):** If any create/suspend/correct/publish you did leaves **no** audit row, that's
a launch blocker — every privileged change must be logged.

---

## §12 — Sign out + suspended lockout

### `[ ]` AT18 — Sign out
1. Sidebar footer → **Sign out** → you return to Login.
2. Press the browser **Back** button → it must **not** restore the dashboard.

### `[ ]` AT19 — A suspended user is locked out
1. Log back in (owner + 2FA) → Students → suspend a **ZZ Test** student.
2. On the **phone**, try to log in as that suspended student (or, if already in, pull-to-refresh).
**Expected:** The suspended student cannot use the app — login is refused / they're routed to a
"suspended · contact your institute" state. Reactivate them afterward.

---

# Go / No-Go (admin panel)
Ship only if all are green:
- `[ ]` AT2 Owner can't get in without a valid 2FA code
- `[ ]` AT5 Create a student → one-time temp password shown
- `[ ]` AT6 Suspend / Reactivate / Reset password work
- `[ ]` AT9 Create a teacher + assign a batch
- `[ ]` AT13 Attendance correction saves + CSV
- `[ ]` AT17 Every action appears in the Audit log with before/after
- `[ ]` AT18 Sign out really ends the session

---

# Cleanup (after testing)
- **Suspend** every `ZZ Test` account you created (there's no in-panel delete for accounts — leaving
  them suspended is the safe state). Delete any `ZZ Test` course/batch/content you made.
- Or tell me **"wipe the admin test data"** and I'll clean it up safely.
- **Never** suspend the real owner or real institute data.
