# FyneStudy Admin Panel — Complete User Guide

> A friendly, step-by-step manual for the people who **run** the institute: the owner and the office/operations staff. No coding knowledge needed. Read it top-to-bottom the first time; after that, jump to the **Common tasks cheat-sheet** at the end.

**Companion guides:**
- 📋 **Quick playbook** — the step-by-step recipes for common tasks (new student, new batch, new teacher, a teacher leaves…): [`./admin-workflow.md`](./admin-workflow.md).
- Teachers use the mobile app **or** the web app — see [`./teacher-guide.md`](./teacher-guide.md).
- Students use the mobile app **or** the web app — see [`./student-guide.md`](./student-guide.md).
- Publishing the mobile app to the Play Store — see [`../play-store-upload-guide.md`](../play-store-upload-guide.md).

---

## Table of contents

1. [What the admin panel is](#1-what-the-admin-panel-is)
2. [Getting started — first login & two-factor setup](#2-getting-started--first-login--two-factor-setup)
3. [Dashboard tour — the menu and the Overview numbers](#3-dashboard-tour--the-menu-and-the-overview-numbers)
4. [Basic tasks — create your first accounts](#4-basic-tasks--create-your-first-accounts)
5. [Intermediate — curriculum, bulk import, account management](#5-intermediate--curriculum-bulk-import-account-management)
6. [Content & assessments — library, quizzes, exams, scores](#6-content--assessments--library-quizzes-exams-scores)
7. [Attendance — reading and correcting the matrix](#7-attendance--reading-and-correcting-the-matrix)
8. [Advanced / owner-only — managing admins & the audit log](#8-advanced--owner-only--managing-admins--the-audit-log)
9. [Common tasks cheat-sheet & tips](#9-common-tasks-cheat-sheet--tips)

---

## 1. What the admin panel is

The **FyneStudy Admin Panel** is the website where the institute is run from a computer's web browser. From here you create student and teacher accounts, build the course curriculum, organise batches, watch attendance, moderate study materials, publish quizzes and exams, and review a full history of who changed what.

The mobile app is for **students and teachers only**. The admin panel is for **office staff and the owner only**.

### The two admin roles

There are exactly two kinds of admin account.

| Role | Can do | Cannot do |
|---|---|---|
| **Staff admin** | All day-to-day operations: create/manage students, teachers, courses, batches, attendance, content, quizzes, exams, offline scores, and view the audit log. | Manage other admin accounts; institute-level settings. |
| **Owner admin** | Everything a staff admin can do, **plus** create and view admin accounts (the **Admins** menu). | — |

You can tell which role you are: look at the bottom-left of the screen, under your name. It says either **Owner admin** or **Staff admin**.

### The golden rule: the admin creates every account

There is **no self-signup** anywhere in FyneStudy. Students and teachers can never register themselves. **You** (the office) create every account here in the panel. The system generates an initial password that you hand to the person; they are forced to change it the first time they log in.

This means: a student can only use the app after you have (1) created at least one **course**, (2) created a **batch** under that course, and (3) created the **student** and assigned them to the batch. Section 4 walks through this in the right order.

---

## 2. Getting started — first login & two-factor setup

### 2.1 Opening the panel

Open a web browser (Google Chrome, Microsoft Edge, Safari, or Firefox) on a laptop or desktop computer and go to your institute's admin address.

- **Current address:** `https://fyne-study-app-admin.vercel.app/`
- **Future custom address (optional):** if you later point a subdomain at it (e.g. `admin.fynestudy.live`), bookmark that instead.

> ⚠️ **Don't confuse it with the student/teacher web app.** `https://fynestudy.live` is the **students &
> teachers** web app — *not* the admin panel. As an admin you always use the **admin** address above.
>
> Tip: Bookmark the page so you don't have to type it each time.

You'll land on the **Sign in** screen titled "FyneStudy Admin". Underneath the form it reminds you: *"Admin accounts are issued by the institute owner. No self-signup."*

### 2.2 Your first login

The owner (or whoever set up your account) will have given you two things: an **email** and a **temporary password**.

1. In the **Email** box, type your admin email.
2. In the **Password** box, type the temporary password.
3. Click **Sign in**. The button shows "Signing in…" while it works.

If the email or password is wrong, a red message appears. Double-check for typos (passwords are case-sensitive and any trailing space matters).

After a successful sign-in, you are guided through a short, one-time setup funnel: **two-factor → save recovery codes → change password**. You must complete it before you can use the panel.

### 2.3 Setting up two-factor authentication (2FA)

Every admin account is **required** to use two-factor authentication. This means that, on top of your password, you also enter a 6-digit code from an app on your phone each time you sign in. It protects student data even if your password leaks.

You'll see a page titled **"Confirm it's you"** style setup with three numbered steps and a QR code:

1. **Install an authenticator app** on your phone if you don't already have one. Any of these work:
   - Google Authenticator
   - Authy
   - 1Password
   (Get them free from your phone's App Store / Play Store.)
2. **Scan the QR code** shown on the screen using that app. The app will add an entry called something like "FyneStudy".
   - Can't scan it? Click **"Can't scan? Show the secret to enter manually"** to reveal a text code you can type into the app instead.
3. **Enter the 6-digit code** the app now shows for FyneStudy into the **6-digit code** box, and click **Verify and continue**.

A yellow note warns you that you'll get recovery codes next — keep reading.

### 2.4 Saving your 10 recovery codes (very important)

After you verify, the screen shows a green **"2FA enabled."** banner and a grid of **10 recovery codes** (they look like `XXXXX-XXXXX`).

These codes are your **only** way back into your account if you ever lose your phone or the authenticator app. Each code works **once**.

1. Click **Copy all** to copy every code, then paste them somewhere safe:
   - a password manager (best), or
   - a printed sheet locked in the office, or
   - a secure note.
2. Tick the checkbox: *"I have saved these recovery codes somewhere safe."* This enables the button.
3. Click **Continue to dashboard**.

> **The codes are shown only once and are never stored where they can be re-displayed.** If you lose them and your phone, you'll need the owner to reset your account. Treat them like cash.

### 2.5 Choosing your own password

Next you reach **"Choose a new password"**. Your admin-issued temporary password has to be replaced before you can do anything else.

1. Type a new password in **New password**. The rules are:
   - at least **10 characters**,
   - including an **upper-case** letter, a **lower-case** letter, and a **digit**,
   - no spaces,
   - it cannot be the same as your email.
2. Re-type it in **Confirm new password** (they must match).
3. Click **Save and continue**.

You're now in. You'll see the **Overview** dashboard.

### 2.6 Logging in on later days

From now on, every sign-in is three quick steps:
1. Enter email + your (new) password, click **Sign in**.
2. On **"Confirm it's you"**, type the current 6-digit code from your authenticator app, click **Continue**.
3. You land on the Overview.

> Lost your authenticator? On the "Confirm it's you" page click **"Lost your authenticator? Use a recovery code"**, enter one of your saved codes, and click **Use recovery code**. Using a code **resets your 2FA**, so the system will immediately ask you to set up the authenticator again (scan a fresh QR, save 10 fresh codes).

### 2.7 Signing out

Click **Sign out** at the bottom-left of any page (under your name and role).

---

## 3. Dashboard tour — the menu and the Overview numbers

### 3.1 The layout

Every page has the same shape:
- A **left sidebar** (the menu) that's always there.
- A **main area** on the right that changes with the page you pick.
- Your **name, email, role, and the Sign out button** at the very bottom-left.

### 3.2 The menu (left sidebar)

This is the complete feature list. (The **Admins** item only appears if you are an owner admin.)

| Menu item | What it's for |
|---|---|
| **Overview** | The home dashboard: live counts + recent activity. |
| **Students** | Create, search, and manage every student account. |
| **Teachers** | Create and manage teachers; assign them to batches. |
| **Admins** *(owner only)* | Create and view other admin accounts. |
| **Batches** | Create batches (a group of students in one course) and set their schedule, teachers, and roster. |
| **Courses** | Create programmes (e.g. JEE Main) and build their curriculum (subjects → chapters → topics). |
| **Attendance** | Per-batch attendance grid; correct any cell; export to CSV. |
| **Content** | Moderate study materials (videos, PDFs, notes) uploaded by teachers. |
| **Quizzes** | Moderate practice quizzes; publish/unpublish; delete. |
| **Exams** | Moderate graded exams; publish; release results; delete. |
| **Offline scores** | View paper-test scores teachers entered; delete bad rows; export. |
| **Question bank** | Review every teacher-written multiple-choice question; archive or delete. |
| **Audit log** | The complete history of every privileged change, with before/after detail. |

To open any section, just click its name.

### 3.3 The Overview dashboard

The **Overview** page is "a live snapshot of your institute". It shows **8 number cards** in two rows. Each card is clickable — clicking it jumps to the matching section.

| Card | What the number counts |
|---|---|
| **Students** | Total enrolled student accounts. |
| **Teachers** | Total teacher accounts. |
| **Active batches** | Batches currently marked active. |
| **Courses** | Programmes you've created. |
| **Published quizzes** | Quizzes that are live for students right now. |
| **Published exams** | Exams that are live for students right now. |
| **Study materials** | Published content items (videos & notes) students can see. |
| **Upcoming sessions** | Class sessions scheduled in the future. |

Below the cards is **Recent activity** — the latest 8 changes anyone made (e.g. "staff admin created an account · app_users"), each with a time stamp in IST. Click **View audit log →** to see the full history (Section 8.2).

---

## 4. Basic tasks — create your first accounts

> **Do these in order the first time.** A student needs a batch; a batch needs a course. So: **Course → Batch → Teacher → Student**, then assign the teacher to the batch.

### 4.1 Create a course

A **course** is a programme of study, e.g. "JEE Main" or "NEET 2027".

1. Click **Courses** in the menu, then click **+ New course** (top-right).
2. A dialog opens. Fill in:
   - **Code** — a short internal identifier in `UPPER_SNAKE_CASE` (capitals + underscores), 2–30 characters. Example: `JEE_MAIN`.
   - **Name** — the human-friendly label, e.g. `JEE Main`.
   - **Description** *(optional)* — a one-line note.
3. Click **Create course**.

The dialog closes and you're taken straight to the new course's page. The course starts **Active**. You'll add subjects/chapters/topics to it later (Section 5.1).

### 4.2 Create a batch

A **batch** is one group of students studying one course together (e.g. "NEET 2027 Morning"). A batch belongs to **exactly one** course; each student's course is derived automatically from their batch.

1. Click **Batches**, then **+ New batch**.
2. In the dialog, fill in:
   - **Course** — pick the course this batch belongs to (you must have created at least one first).
   - **Name** — e.g. `NEET 2027 Morning`.
   - **Starts on** — pick a start date (click the date field for a calendar).
   - **Ends on** *(optional)* — leave blank if open-ended.
   - **Capacity** — maximum number of seats. Defaults to **80**.
3. Click **Create batch**. You're taken to the batch's detail page.

On the **batch detail page** you can later:
- Edit **Batch details** (name, capacity, dates, Active/Inactive) and click **Save changes**.
- Add **Teachers** (Section 4.5).
- Add the **Schedule** — recurring class slots (Section 5, used to auto-generate attendance sessions).
- See the **Students** roster.

> **Active vs Inactive:** Set a batch to **Inactive** to retire it without deleting (its history stays). You can only **delete** a batch if no students or schedule rows reference it — otherwise the delete is blocked and you should transfer students out or just mark it Inactive.

### 4.3 Add a class schedule to a batch (so attendance sessions appear)

On the batch detail page, the **Schedule** section lets you add the weekly recurring class slots. The system uses these to create the dated "sessions" that attendance is taken against.

1. Scroll to the **Schedule** section.
2. In the add-row form at the bottom, choose:
   - **Day** — Mon/Tue/…/Sun.
   - **Start** and **End** — the class times (click for a time picker).
   - **Subject (optional)** — pick a subject of this course (these come from the curriculum — Section 5.1).
3. Click **Add row**. It appears in the table above; click **Remove** on any row to delete it.

### 4.4 Create a teacher

1. Click **Teachers**, then **+ New teacher**.
2. Fill in:
   - **Full name** *(required)*.
   - **Email** *(required)* — used as their login and to send credentials.
   - **Phone** *(optional)*.
   - **Subjects** *(optional)* — comma-separated, e.g. `Physics, Chemistry` (free text, up to 20).
   - **Bio** *(optional)*.
3. Click **Create teacher**.

A **"Teacher created"** dialog appears showing the **Email** and an **Initial password**. The password is shown **only once**.
- Click **Copy** next to each value.
- Hand these credentials to the teacher securely (in person or via a private channel). They'll be forced to change the password on first login.
- Click **"I've shared this. Open profile →"** to go to the teacher's profile.

### 4.5 Assign a teacher to a batch

A teacher only sees a batch's students once you assign them to that batch. A teacher can be in **several** batches.

**Option A — from the teacher's profile:**
1. Open **Teachers** → click the teacher's name.
2. In the **Assigned batches** card, click **+ Assign batch**.
3. Pick a **Batch** and click **Assign**. A green "Assigned. Close to refresh." message confirms it; click **Close**.
4. To remove one, click **Unassign** next to a batch and confirm.

**Option B — from the batch's page:**
1. Open **Batches** → click the batch name.
2. In the **Teachers** section, pick a teacher in the **Assign teacher** dropdown and click **Assign**.
3. Click **Unassign** beside any teacher to remove them.

### 4.6 Create a student (every field explained)

1. Click **Students**, then **+ New student** (top-right).
2. Fill in the form. It's grouped into four sections:

**Identity**
| Field | Required? | Notes |
|---|---|---|
| **Full name** | Yes | The student's legal/display name. |
| **Date of birth** | No | Type as `YYYY-MM-DD` (e.g. `2008-04-15`). |
| **Gender** | No | Male / Female / Other / Prefer not to say. |

**Contact**
| Field | Required? | Notes |
|---|---|---|
| **Email** | Yes | The student's login; also receives the welcome email. |
| **Phone** | No | e.g. `+91 98765 43210`. |
| **Address** | No | Postal address. |

**Academic**
| Field | Required? | Notes |
|---|---|---|
| **School** | No | School name. |
| **Board** | No | e.g. CBSE / ICSE / State. |
| **Class** | No | e.g. `11` or `12`. |
| **Batch** | **Yes** | Pick the batch. *The course is derived from the batch — you don't pick it separately.* If the dropdown says "No active batches — create one first", go make a batch (Section 4.2). |

**Parents**
| Field | Required? | Notes |
|---|---|---|
| **Parent phone (primary)** | No | Main guardian contact. |
| **Parent phone (secondary)** | No | Backup contact. |
| **Parent consent captured via** | No | Verbal / Written / Admission form. Choosing one records that you obtained parent consent at admission (a data-protection / DPDP attestation). |

3. Click **Create student**.

A **"Student created"** dialog shows the **Email** and the one-time **Initial password**. Just like with teachers:
- Click **Copy** for each.
- Share them privately with the student. They'll change the password on first login.
- Click **"I've shared this. Open profile →"**.

> **Identity fields are locked after creation.** Students cannot change their own name, email, phone, date of birth, batch, or course in the app — they must ask the office. You can transfer a student between batches (Section 5.6), but other identity edits are by design read-only to keep the office as the single source of truth.

---

## 5. Intermediate — curriculum, bulk import, account management

### 5.1 Build the curriculum (Subjects → Chapters → Topics)

Every course has a curriculum tree: **Subjects**, each with **Chapters**, each with **Topics**. This tree powers quizzes, the question bank, study materials, and schedule subjects, so it's worth setting up early.

1. Click **Courses** → click the course name.
2. Click the **Curriculum** tab (next to **Overview**). It shows "Curriculum (N subjects)".
3. The tree reads **Subject → Chapter → Topic**, and you edit it inline. **Deleting an item cascades to everything beneath it** (deleting a subject removes its chapters and their topics).

**Add a subject:** in the dashed **+ Subject** row at the bottom, type a name (e.g. `Physics`), set a **sort order** number (lower numbers show first), and click **Add subject**.

**Add a chapter:** click the **▸** arrow on a subject to expand it, then use its **+ Chapter** row (e.g. `Mechanics`) and click **Add chapter**.

**Add a topic:** expand a chapter with **▸**, use its **+ Topic** row (e.g. `Kinematics`), click **Add topic**.

**Rename / reorder:** click any item's name to reveal an edit box. Change the **name** and/or the **#sort order** number, then click **Save** (or **Cancel**).

**Delete:** click **Delete** on the item, read the cascade warning, then click **Yes, delete** (or **Cancel**).

> The little number after each name (e.g. `#0`) is its sort order — change it to control display order without renaming.

### 5.2 Editing a course's overview (rename / deactivate / delete)

On the course page's **Overview** tab you can edit the **Name**, **Description**, and **Status** (Active / Inactive), then click **Save changes**. To remove a course entirely, click **Delete course** and confirm — but note that a course with batches still attached cannot be deleted (the system blocks it), and deleting cascades to all its subjects/chapters/topics.

### 5.3 Bulk-import many students from a CSV file

When you're onboarding a whole batch at once, importing a spreadsheet is far faster than adding students one by one.

> You need at least one **active batch** first. Every student in one import file goes into the **same** batch.

**Step 1 — Open the importer.**
Click **Students**, then the **Import CSV** button (top-right, next to "+ New student"). You land on **"Bulk import students"**.

**Step 2 — Pick the target batch.**
Under **"1 · Choose the target batch"**, select the batch all these students will join.

**Step 3 — Get and fill the template.**
Under **"2 · Upload the CSV"**, click **Download template**. This saves a file called `students-template.csv` with the correct column headers. Open it in Excel or Google Sheets and fill one row per student.

The columns are:

| Column | Required? | Format / allowed values |
|---|---|---|
| `full_name` | **Yes** | At least 2 characters. |
| `email` | **Yes** | A valid email; must be unique within the file. |
| `phone` | No | Free text, e.g. `+91…`. |
| `dob` | No | `YYYY-MM-DD`. |
| `gender` | No | `male` / `female` / `other` / `prefer_not`. |
| `address` | No | Free text. |
| `school_name` | No | Free text. |
| `board` | No | e.g. CBSE/ICSE/State. |
| `current_class` | No | e.g. `11`/`12`. |
| `parent_phone_1` | No | Free text. |
| `parent_phone_2` | No | Free text. |
| `parent_consent_method` | No | `verbal` / `written` / `form`. |

Only `full_name` and `email` are mandatory. **Up to 100 students per file.**

**Step 4 — Upload and review the preview.**
Click the file selector and choose your filled CSV. The screen immediately shows a **preview** so you can check before anything is created:
- A green **"N valid"** pill and (if any) a red **"N skipped"** pill.
- A table listing every row with its **Line** number, **Name**, **Email**, and a **Status**:
  - **Ready** (green) — will be imported.
  - A red reason — will be skipped. Reasons are: *Name is missing*, *Invalid email*, or *Duplicate email in file*.
- If more than 100 rows are valid, a note warns that only the first 100 will be imported.

Fix any skipped rows in your spreadsheet and re-upload if you want them included.

**Step 5 — Run the import.**
Click the **Import N students** button. It creates the accounts one by one and can take up to a minute — a note says *"Keep this tab open."*

**Step 6 — Download the credentials.**
When it finishes you'll see **"Import complete"** with a summary (`X created · Y failed · Z attempted`). If any were created:
- Click **Download credentials (CSV)**. This saves `new-student-credentials.csv` containing each new student's **email** and **temp_password**.
- **Distribute these now** — the temporary passwords are shown only once. Each student changes theirs at first login.
- Any **Failed rows** are listed with a reason.
- Click **Import another file** to start over.

### 5.4 Find a student & read their profile

1. Click **Students**. The list shows Name, Email, Phone, Class, **Status**, and Created date.
2. **Search** by name or email using the search box, and/or filter by status using the tabs: **All / Active / Suspended / Pending PW change**.
   - **Active** (green) — normal.
   - **Pending PW change** (amber) — created but hasn't done their first-login password change yet.
   - **Suspended** (red) — account is blocked.
3. Click a student's **name** to open their profile. It has three tabs:
   - **Identity** — Personal, Academic (with the **Transfer batch** button), Parents, and Account cards.
   - **Activity** — attendance/quiz/exam history (lights up as the student uses the app).
   - **Audit** — every privileged change made to this account.

### 5.5 Suspend or reactivate an account

Suspending blocks a person from logging in and signs them out everywhere shortly after.

1. Open the student's profile (**Students** → click the name). *(The same buttons exist on teacher profiles via the panel; suspension is performed from the student detail action bar.)*
2. Top-right, click **Suspend**.
3. In the dialog, optionally type a **Reason**, then click **Suspend**. A warning explains they'll be signed out on their next background refresh and can't log back in until reactivated.
4. To undo, open the profile again and click **Reactivate**.

> A suspended account shows a red **Suspended** pill (with the reason, if you gave one).

### 5.6 Reset a person's password

If someone forgets their password, generate a new temporary one for them.

1. Open the student's profile.
2. Top-right, click **Reset password**.
3. In the dialog, click **Reset password**. A new temporary password is generated and their existing sessions are signed out.
4. The new password appears — click **Copy**, share it with the person, then click **Done**. They'll be required to change it at next login.

### 5.7 Transfer a student to a different batch

1. Open the student's profile → **Identity** tab.
2. In the **Academic** card, click **Transfer batch** (it's disabled if there are no other active batches).
3. In the dialog:
   - Pick the **Target batch**.
   - Type a **Reason** (at least 3 characters), e.g. "schedule clash".
4. Click **Transfer**. Past attendance and scores stay attached to the student. (You can also do this from a batch's **Students** section using the **Transfer** button per row.)

> Every transfer is recorded in the audit log with your reason.

---

## 6. Content & assessments — library, quizzes, exams, scores

A useful mental model: **teachers create the actual content in the mobile app** (they upload videos/PDFs, write questions, build quizzes and exams, enter offline scores). The admin panel is where **you moderate and control** that content — publish it, hide it, fix scope, release exam results, and delete bad entries. Every action you take here is recorded in the audit log.

### 6.1 Moderate the content library

Click **Content** ("Content library"). Each row is one study item (a **video**, **PDF**, or **note**) with its title, scope, uploader, status, and curriculum location.

**Filter** with the controls at the top: **Course**, **Batch** (including a special "Course-wide (no batch)" option), **Kind** (Video/PDF/Note), **Status** (Published/Unpublished), and a **Search** box (type a title and press Enter). **Export CSV** downloads the current list.

Per-row actions:
- **Publish / Unpublish** — make the item visible to students, or hide it again. ("Pending" = not yet published.)
- **Promote course-wide** — if an item is scoped to one batch, this makes it available to the whole course. For a course-wide item, expand **"Scope to batch…"** and pick a batch to narrow it back down.
- **Delete** — permanently removes the item from the library (confirm in the popup). *Note: the underlying stored file isn't purged — it becomes orphaned.*

### 6.2 Publish or unpublish a practice quiz

Click **Quizzes**. Each row shows the quiz title, scope (course/batch), topic/chapter, marks scheme (`+correct / wrong / skip`), question count · attempt count, and **Status** (Published / Draft).

- **Filter** by Course, Batch, Status (Published/Draft) and **Search** by title (press Enter). **Export CSV** is available.
- **Publish / Unpublish** — toggles whether students can see and attempt the quiz.
- **Delete** — permanently removes the quiz **and all its attempts and answers** (confirm in the popup; this can't be undone).

> Quizzes themselves are **built by teachers in the mobile app**. Your job here is moderation: publish good ones, unpublish or delete bad ones.

### 6.3 Manage graded exams (publish & release results)

Click **Exams**. Each row shows title, batch · course, **Starts (IST)** + duration + release mode, marks scheme, question count · submitted/total attempts, and a live **Status** badge:

| Badge | Meaning |
|---|---|
| **Draft** | Not published yet — students can't see it. |
| **Scheduled** | Published, but the start time hasn't arrived. |
| **Live** | The exam window is currently open. |
| **Closed** | The window has ended but results aren't released. |
| **Released** | Results are visible to students. |

Filter by Course, Batch, **Status** (Draft/Scheduled/Live/Closed/Released), and Search; **Export CSV** is available.

Per-row actions:
- **Publish / Unpublish** — make the exam available to its batch (or pull it back).
- **Force release / Un-release** — show results to students now (used for "manual" release exams, or to push results early), or hide them again.
- **Delete** — permanently removes the exam and **all its attempts**. Before deletion, the attempts are snapshotted into the audit log. Confirm in the popup; this can't be undone.

> **Regrading an exam** (re-scoring after fixing an answer key) is done by the **teacher in the mobile app**, not in this panel. The admin panel here covers publishing, releasing/un-releasing results, and deletion. Any regrade still appears in the **Audit log**.

### 6.4 Review the question bank

Click **Question bank**. This lists every multiple-choice question teachers have authored, with its prompt, topic location, **difficulty**, option count (and how many are correct), how many quizzes use it, and **Status** (Active / Archived).

Filter by Course, Difficulty (Easy/Medium/Hard), Status (Active/Archived), and Search (prompt text). **Export CSV** is available.

Per-row actions:
- **Archive / Unarchive** — hide a question from future quiz-building without deleting it (recommended for questions already used somewhere).
- **Delete** — permanently removes the question, its options, and solution. *This is disabled for any question already used in a quiz* — archive it instead.

### 6.5 View and clean up offline (paper-test) scores

Click **Offline scores**. These are paper-test marks **entered by teachers in the mobile app**. Each row shows the test name + date, batch · course, subject, student, **score/max**, and who entered it + when (IST).

- Filter by **Batch** and **Search** by test name; **Export CSV** downloads the list.
- **Delete** — remove a bad row (confirm in the popup). The audit log keeps a snapshot.

> Entering offline scores happens in the teacher app — the panel is for viewing across batches, exporting, and removing mistakes.

---

## 7. Attendance — reading and correcting the matrix

Click **Attendance**. This is a per-batch grid ("matrix") of students (rows) against class sessions (columns).

### 7.1 Load a batch's attendance

In the filter bar:
1. Pick a date range with **From** and **To** (defaults to the last 7 days).
2. Choose a **Batch**.
3. Click **Apply**.

The matrix loads. Each session column shows the date/time (IST), the subject (or "Class"), and an "· ad-hoc" tag for one-off sessions.

### 7.2 Read the cells

Each cell is a coloured letter:

| Letter | Colour | Meaning |
|---|---|---|
| **P** | Green | Present |
| **L** | Amber | Late |
| **A** | Red | Absent |
| **—** | Grey | No record (unmarked — can't be corrected) |

Hover over a marked cell to see its status, how it was recorded (`qr` / `manual` / `correction`), and the exact time.

### 7.3 Correct a cell (with a reason)

1. **Click a marked cell** (P/L/A). A **"Correct attendance"** dialog opens, naming the student, the session, and the current status.
2. Under **New status**, click **PRESENT**, **LATE**, or **ABSENT**.
3. Under **Reason**, click a preset chip (**Late entry confirmed**, **QR scan failed**, **Teacher error**, **Other**) **or** type your own. A reason of at least **3 characters** is required.
4. Click **Save correction**. The grid refreshes with the new value.

> You can only correct cells that already have a record. Grey **—** cells (a student with no attendance row for that session) aren't clickable here.

### 7.4 Export attendance to CSV

With a batch loaded, click **Export CSV** in the filter bar. It downloads a file named like `attendance_<Batch>_<from>_to_<to>.csv` — one row per student, one column per session, with the status in each cell. (The button is disabled until a batch with sessions and students is loaded.)

---

## 8. Advanced / owner-only — managing admins & the audit log

### 8.1 Managing admins (owner admins only)

> The **Admins** menu item only shows for **owner admins**. Staff admins can't see or use it.

Click **Admins** to see every admin account, with Name, Email, Phone, **Role** (Owner admin / Staff admin), Status, and Created date. Your own row is tagged **"You"**.

**To create a new admin:**
1. Click **+ New admin**.
2. Fill in:
   - **Full name** *(required)*.
   - **Email** *(required)*.
   - **Phone** *(optional)*.
   - **Role** — **Staff admin** (day-to-day ops) or **Owner admin** (can also manage admins + institute settings). Defaults to Staff admin.
3. Click **Create admin**.

A green **"Admin created"** panel shows the **Email**, the one-time **Temp password**, and the **Role**. Click **Copy** on each, share them securely, and click **Done**. The new admin must change the password at first login and set up their own 2FA (Section 2).

> Choose **owner admin** sparingly — only people you trust to manage other admins should have it.

### 8.2 Reading the audit log

Click **Audit log**. This is the complete, tamper-evident history of every privileged change — *who* did *what*, *when*, and the *before/after* values. The header shows the total number of events recorded.

**Filter** with the controls at the top, then click **Apply** (or **Clear** to reset):

| Filter | Use |
|---|---|
| **Actor role** | Who did it: owner admin / staff admin / teacher / student. |
| **Action** | Type the action name, e.g. `create_user`, `suspend_user`, `correct_attendance`. |
| **Entity table** | The data area touched, e.g. `app_users`, `attendance`, `exams`. |
| **From** / **To** | Date range. |

The table lists **When** (IST), **Actor** (name + role), **Action**, and **Entity**. Long lists are paged — use **← Prev** / **Next →** at the bottom.

**See full detail of one event:**
1. Click **Details** on any row.
2. A dialog shows metadata (Actor, Role, When, Entity ID, IP address, User agent) and two side-by-side panels:
   - **Before** (red text) — what the data looked like beforehand.
   - **After** (green text) — what it became.
3. Close the dialog when done.

**Export:** click **Export page (CSV)** to download the **currently shown page** of events as `audit-<date>.csv`. (Each export covers one page — change pages and export again for more.)

> The audit log is your accountability record. If anyone asks "who changed this student's batch?" or "when was this exam's result released?", this is where you find the answer.

---

## 9. Common tasks cheat-sheet & tips

### 9.1 Where do I go to…?

| I want to… | Go to | Then |
|---|---|---|
| Create a programme (JEE/NEET) | **Courses** | **+ New course** |
| Build subjects/chapters/topics | **Courses** → a course → **Curriculum** tab | Use the **+ Subject / + Chapter / + Topic** rows |
| Create a student group | **Batches** | **+ New batch** |
| Set weekly class times | **Batches** → a batch → **Schedule** | **Add row** |
| Add one student | **Students** | **+ New student** |
| Add many students at once | **Students** → **Import CSV** | Download template → fill → upload → import |
| Add a teacher | **Teachers** | **+ New teacher** |
| Let a teacher see a batch | **Teachers** → teacher → **+ Assign batch** *(or Batches → batch → Teachers)* | **Assign** |
| Reset a forgotten password | **Students** → student | **Reset password** |
| Block someone temporarily | **Students** → student | **Suspend** (undo with **Reactivate**) |
| Move a student to another batch | **Students** → student → **Identity** | **Transfer batch** |
| Make a video/PDF visible | **Content** | **Publish** on the row |
| Make a quiz live | **Quizzes** | **Publish** on the row |
| Show exam results to students | **Exams** | **Force release** on the row |
| Fix a wrong attendance mark | **Attendance** → load batch → click the cell | Set status + reason → **Save correction** |
| See who changed something | **Audit log** | Filter → **Details** |
| Create another office login | **Admins** *(owner only)* | **+ New admin** |

### 9.2 Practical tips

- **Set up in the right order.** Course → Curriculum → Batch (+ Schedule) → Teacher → Student. A student can't be created without a batch, and a batch can't exist without a course.
- **Initial passwords are shown once.** Whenever you create a student/teacher/admin or reset a password, copy the temporary password immediately and hand it over. You can't see it again — if it's lost, just reset the password.
- **Use "Pending PW change" to chase first logins.** On the Students list, the **Pending PW change** filter shows everyone who hasn't completed their first login yet.
- **Prefer Inactive over Delete.** For batches and courses you're retiring, set **Status → Inactive** rather than deleting, so history is preserved and deletes don't get blocked by linked records.
- **Archive questions instead of deleting** once they've been used in a quiz (the panel will block the delete anyway).
- **Teachers do the creating; you do the moderating.** Quizzes, exams, questions, study materials, offline scores, and exam regrades are authored/performed in the mobile app. The panel publishes, releases, scopes, and removes.
- **Guard your 2FA recovery codes.** Losing both your phone and your codes means an owner has to rescue your account. Store the 10 codes in a password manager.
- **The audit log answers "who/what/when".** Every privileged change is there with before/after values — use it for accountability and troubleshooting.
- **One import file = one batch, max 100 students.** Split larger intakes into multiple files, one per batch.

---

*Need the mobile-app side? See the [Teacher guide](./teacher-guide.md) and [Student guide](./student-guide.md). Launching the app? See the [Play Store upload guide](../play-store-upload-guide.md).*
