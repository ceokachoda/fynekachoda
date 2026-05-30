# FyneStudy Admin — Operations Workflow (How to Run the Institute)

> **What this is:** a **scenario-by-scenario playbook** for running the institute from the admin panel —
> "a new student joined, what do I click?", "we're starting a new batch", "a teacher left", and so on.
>
> **How it differs from the [Admin Guide](./admin-guide.md):** the Admin Guide is the *reference manual*
> (every screen and button explained). **This doc is the *recipe book*** — the exact order of steps for each
> real-life task. When a step needs more detail, it points you to the matching Admin Guide section (e.g. *“§4.6”*).
>
> 👉 New to the panel? Read [Admin Guide §1–§3](./admin-guide.md) once first (login, 2FA, the menu), then use this doc for daily work.

---

## Table of contents

- [0. The mental model — who creates what](#0-the-mental-model--who-creates-what)
- [Workflow A — First-time institute setup (do once, in order)](#workflow-a--first-time-institute-setup-do-once-in-order)
- [Workflow B — Onboard ONE new student](#workflow-b--onboard-one-new-student)
- [Workflow C — Onboard MANY students at once (start of term)](#workflow-c--onboard-many-students-at-once-start-of-term)
- [Workflow D — Onboard a new teacher](#workflow-d--onboard-a-new-teacher)
- [Workflow E — Open a new batch](#workflow-e--open-a-new-batch)
- [Workflow F — Add a new course + its curriculum](#workflow-f--add-a-new-course--its-curriculum)
- [Workflow G — Add another admin / hand over to the real owner](#workflow-g--add-another-admin--hand-over-to-the-real-owner)
- [Workflow H — Everyday & weekly operations (the cadence)](#workflow-h--everyday--weekly-operations-the-cadence)
- [Workflow I — Exceptions & student/teacher lifecycle](#workflow-i--exceptions--studentteacher-lifecycle)
- [Who does what — admin vs teacher vs student](#who-does-what--admin-vs-teacher-vs-student)
- [Golden rules (read before you start)](#golden-rules-read-before-you-start)

---

## 0. The mental model — who creates what

FyneStudy has **no self-signup**. The **admin (you) creates every account** and sets up the structure;
**teachers** then create the teaching content; **students** consume it. Three things to internalise:

**1. The dependency chain.** You can't create things in any order — each depends on the one before it:

```
   COURSE  ──►  CURRICULUM        ──►  BATCH  ──►  SCHEDULE   ──►  TEACHER  ──►  STUDENT
 (e.g. JEE)   (subjects→chapters     (a class    (weekly class    (assigned    (assigned to
              →topics)                group)      time slots)       to batch)    the batch)
```

A **student** needs a **batch**; a **batch** needs a **course**. So a brand-new institute is built
**left-to-right** (Workflow A). Day-to-day, you mostly just add students and teachers to structure
that already exists.

**2. The division of labour.** A common confusion: *“why can’t I create a quiz in the admin panel?”*
Because **teachers build the actual teaching content in their app** — quizzes, exams, questions, videos,
PDFs, live classes, offline scores. **You (admin) set up the structure and moderate** — courses, batches,
accounts, publishing/hiding content, releasing exam results, corrections, and the audit trail. Full table at
the [end of this doc](#who-does-what--admin-vs-teacher-vs-student).

**3. Every account starts the same way.** When you create a student/teacher/admin, the system shows a
**one-time temporary password** (shown **once** — copy it immediately). You hand it over privately; the
person is **forced to change it** on first login. Admins additionally set up **2FA** on first login.

> Where to log in: admin panel at **`https://fyne-study-app-admin.vercel.app/`** (a computer browser).
> Students/teachers use the **mobile app** or the **web app** (`https://fynestudy.live`) — never the admin panel.

---

## Workflow A — First-time institute setup (do once, in order)

**When:** the very first time, on a brand-new (empty) institute. Follow it **top to bottom** — each step
unlocks the next.

| # | Step | Where (menu → action) | Result / verify | Detail |
|---|---|---|---|---|
| 1 | **Log in & secure your admin account** | Sign in → set up 2FA → save 10 recovery codes → set your password | You reach **Overview**; bottom-left shows your name + role | Admin Guide §2 |
| 2 | **Create your first course** | **Courses → + New course** (Code `JEE_MAIN`, Name `JEE Main`) | Opens the course page; status **Active** | §4.1 |
| 3 | **Build the curriculum** | Course → **Curriculum** tab → add **Subjects → Chapters → Topics** | Tree shows e.g. Physics ▸ Mechanics ▸ Kinematics | §5.1 |
| 4 | **Create your first batch** | **Batches → + New batch** (pick the course, name it, start date, capacity) | Opens the batch detail page | §4.2 |
| 5 | **Add the weekly schedule to the batch** | Batch detail → **Schedule** → add rows (Day, Start, End, Subject) | Rows appear; these auto-generate dated attendance sessions | §4.3 |
| 6 | **Create your teacher(s)** | **Teachers → + New teacher** → copy the one-time password | "Teacher created" dialog with email + temp password | §4.4 |
| 7 | **Assign the teacher to the batch** | Teacher profile → **+ Assign batch** (or Batch → **Teachers → Assign**) | Teacher now sees that batch in their app | §4.5 |
| 8 | **Create your students** | **Students → + New student** (assign the batch) — or bulk-import (Workflow C) | "Student created" dialog with email + temp password | §4.6 |
| 9 | **Hand out logins** | Give each person their email + one-time password (privately) | They log in, change password, and start using the app | — |

✅ **Done when:** a teacher can log into their app and see the batch + roster, and a student can log in and
see Home. After this, you rarely repeat steps 2–3; you mostly do Workflows B–E.

> **Reuse what's there:** your production database may already ship with one starter course
> ("General Program") and one batch ("Batch A"). If so, you can skip straight to adding teachers/students,
> or rename them to your real programme/batch first (Courses → Overview → edit; Batches → edit).

---

## Workflow B — Onboard ONE new student

**When:** a single student enrols mid-term.

1. **Pre-check:** the student's **batch already exists** (if not, do [Workflow E](#workflow-e--open-a-new-batch) first).
2. **Students → + New student.**
3. Fill the form (only **Full name**, **Email**, and **Batch** are required; the rest — DOB, gender, phone,
   address, school/board/class, parent phones, consent — are optional but good for records). *The course is
   derived from the batch — you don't pick it separately.* → see Admin Guide §4.6 for every field.
4. Click **Create student** → the **"Student created"** dialog shows the **email + one-time temp password**.
5. **Copy the password now** (shown once) and give both to the student privately.
6. The student logs in → is forced to set their own password → lands on Home.

**Verify:** the new student appears in **Students** with an amber **"Pending PW change"** badge until they
finish first login (then it turns green/**Active**). Use the **Pending PW change** filter to chase anyone who
hasn't logged in yet.

> Lost the temp password before sharing it? Open the student → **Reset password** to generate a fresh one
> ([Workflow I](#workflow-i--exceptions--studentteacher-lifecycle)).

---

## Workflow C — Onboard MANY students at once (start of term)

**When:** enrolling a whole batch from a list/spreadsheet. Far faster than one-by-one.

> **One import file = one batch, up to 100 students.** Larger intakes → split into multiple files (one per batch).

1. **Pre-check:** the target **batch exists and is Active**.
2. **Students → Import CSV** (top-right). You land on **"Bulk import students"**.
3. **Step 1 — pick the target batch** everyone in this file will join.
4. **Step 2 — Download template** (`students-template.csv`). Open it in Excel/Sheets.
5. Fill **one row per student.** Required columns: **`full_name`**, **`email`** (unique). Optional: `phone`,
   `dob` (`YYYY-MM-DD`), `gender` (`male/female/other/prefer_not`), `address`, `school_name`, `board`,
   `current_class`, `parent_phone_1`, `parent_phone_2`, `parent_consent_method` (`verbal/written/form`).
6. **Upload** the filled file → review the **preview**: green **"N valid"**, red **"N skipped"** with a reason
   (missing name / invalid email / duplicate email). Fix skipped rows in the sheet and re-upload if needed.
7. Click **Import N students** → wait (up to ~1 min; keep the tab open).
8. On **"Import complete"**, click **Download credentials (CSV)** (`email,temp_password`) — **shown once.**
   Distribute these to students. Any failed rows are listed with reasons.

**Verify:** the new students appear in **Students**; the import shows in the **Audit log**.
Detail: Admin Guide §5.3.

---

## Workflow D — Onboard a new teacher

**When:** a new teacher joins, or you're assigning an existing teacher to more batches.

1. **Teachers → + New teacher.** Required: **Full name**, **Email**. Optional: phone, subjects (free text,
   comma-separated), bio. → **Create teacher**.
2. Copy the **one-time password** from the "Teacher created" dialog; hand it over privately.
3. **Assign batches** so the teacher can actually see students. Two equivalent ways:
   - Teacher profile → **Assigned batches → + Assign batch** → pick a batch → **Assign**, **or**
   - Batch detail → **Teachers** section → choose the teacher → **Assign**.
   - A teacher can be in **several** batches; repeat to add more. **Unassign** removes one.
4. Teacher logs in (mobile or web), changes password, and sees their assigned batches + rosters.

**Verify:** the assignment shows on the teacher's profile **and** in the batch's Teachers list.
**Note:** teachers have **no** Suspend/Reset buttons in the panel — those live on **student** pages only.
Detail: Admin Guide §4.4–§4.5.

---

## Workflow E — Open a new batch

**When:** a new section/term starts (e.g. "NEET 2027 Evening").

1. **Pre-check:** the **course** for this batch exists (else do [Workflow F](#workflow-f--add-a-new-course--its-curriculum)).
2. **Batches → + New batch** → pick **Course**, set **Name**, **Starts on** (+ optional **Ends on**), **Capacity** (default 80) → **Create batch**.
3. On the batch detail page:
   - **Schedule** → add the weekly class rows (Day / Start / End / Subject) — these create the attendance sessions.
   - **Teachers** → assign one or more teachers ([Workflow D](#workflow-d--onboard-a-new-teacher) step 3).
   - **Students** → enrol students ([Workflow B](#workflow-b--onboard-one-new-student) / [C](#workflow-c--onboard-many-students-at-once-start-of-term)), or **Transfer** existing ones in.
4. Leave **Active** while in use.

**Retiring a batch:** set **Status → Inactive** (keeps all history). Only **delete** a batch if nothing
references it — otherwise transfer students out first or just mark it Inactive. Detail: Admin Guide §4.2–§4.3.

---

## Workflow F — Add a new course + its curriculum

**When:** you launch a new programme (e.g. CUET) that doesn't exist yet.

1. **Courses → + New course** → **Code** in `UPPER_SNAKE_CASE` (e.g. `CUET_2027`), **Name**, optional description → **Create course**.
2. On the course page → **Curriculum** tab → build the tree **top-down**:
   - **+ Subject** (e.g. Physics) → expand ▸ → **+ Chapter** (e.g. Mechanics) → expand ▸ → **+ Topic** (e.g. Kinematics).
   - Use the **#sort order** number to control display order; **rename** by clicking a name; **delete** cascades to everything beneath (you'll be warned).
3. Now you can create **batches** under this course ([Workflow E](#workflow-e--open-a-new-batch)).

> The curriculum powers quizzes, the question bank, study materials, and schedule subjects — set it up before
> teachers start adding content. Detail: Admin Guide §5.1–§5.2.

---

## Workflow G — Add another admin / hand over to the real owner

**When:** you need more office staff with panel access, or you're handing the institute to its real owner.
**Owner-only** — the **Admins** menu appears only for owner admins.

1. **Admins → + New admin** → Full name, Email, **Role**:
   - **Staff admin** — day-to-day ops (students, teachers, batches, content, attendance, assessments, audit).
   - **Owner admin** — everything, **plus** managing admins. Grant sparingly.
2. Copy the one-time password; hand it over privately.
3. The new admin logs in → **sets up their own 2FA on their own phone** → saves their own recovery codes →
   sets their own password (Admin Guide §2). *(For a full client/owner walkthrough see
   [`../owner-account-setup.md`](../owner-account-setup.md).)*

**Handover to the institute's real owner:** create a new **Owner admin** with the institute's **real email**,
have them complete first-login setup, confirm they're in — then ask your developer to retire the demo owner
(`owner@fynestudy.example.com`). Detail: Admin Guide §8.1.

---

## Workflow H — Everyday & weekly operations (the cadence)

Once set up, running the institute is a light, repeating rhythm. Suggested cadence:

| How often | Task | Where | Why |
|---|---|---|---|
| **Daily** | Glance at **Overview** + **Recent activity** | Overview | Spot anything unusual at a glance |
| **Daily** | Chase first logins | Students → **Pending PW change** filter | New accounts that haven't been used yet |
| **As content arrives** | **Publish / unpublish** teacher-uploaded videos & PDFs; promote course-wide if appropriate | Content | Control what students see (§6.1) |
| **As quizzes arrive** | Publish good practice quizzes; unpublish/delete bad ones | Quizzes | Moderation (§6.2) |
| **Around exams** | Publish exams; **Force release** results when the teacher's ready (or to push early) | Exams | Students see scores only when released (§6.3) |
| **Weekly** | Review **attendance**; correct wrong marks with a reason; export CSV for records | Attendance | Accurate records (§7) |
| **Weekly** | Review **Offline scores** teachers entered; delete mistakes | Offline scores | Clean data (§6.5) |
| **As needed** | Tidy the **Question bank** — archive retired questions | Question bank | Keep quiz-building clean (§6.4) |
| **Anytime** | Answer "who changed what?" | **Audit log** → filter → Details | Accountability (§8.2) |

> Remember: **teachers create**, **you moderate**. You won't author quizzes/exams/content here.

---

## Workflow I — Exceptions & student/teacher lifecycle

Quick recipes for the situations that come up. All are audited.

| Situation | Do this | Where | Notes |
|---|---|---|---|
| **Forgot password** (student) | **Reset password** → copy new temp password → share | Students → student → **Reset password** | They must change it next login. Teachers/admins: see below. |
| **Forgot password** (teacher) | No reset button in panel — the teacher uses **Forgot password?** on the app login, **or** ask your developer | App login / dev | Teachers self-recover via the email reset link |
| **Student leaves / misbehaves** | **Suspend** (optional reason) → they're signed out within ~1 hour and can't log back in | Students → student → **Suspend** | Reversible: **Reactivate** |
| **Student moves batch/section** | **Transfer batch** → pick target + reason (3+ chars) | Students → student → Identity → **Transfer batch** (or Batch → Students → Transfer) | Past attendance & scores stay attached |
| **Wrong attendance mark** | Click the cell → set new status + reason → **Save correction** | Attendance → load batch → click P/L/A cell | Only marked cells (not grey **—**) are correctable (§7.3) |
| **Show exam results now** | **Force release** | Exams → row → **Force release** | Use **Un-release** to hide again (admin-only) |
| **Bad exam question / answer key** | The **teacher regrades** in their app (with reason) | Teacher app | Regrade shows in the Audit log; you only publish/release here |
| **Identity field wrong** (name/email/phone/DOB) | Edit is admin-controlled; correct it via the student/teacher record | Students/Teachers | Students/teachers **can't** self-edit these by design |
| **Admin lost their 2FA phone** | They use a **recovery code** on the 2FA screen (re-enrolls fresh), **or** ask your developer to clear it | App / dev | Keep recovery codes safe (§2.4) |
| **End of term** | Set finished batches **Inactive** (not deleted) — keeps history | Batches → batch → Inactive | Re-activate or open a new batch next term |

Detail: Admin Guide §5.5–§5.7 (suspend/reset/transfer), §6.3 (release), §7.3 (correction), §8 (admins/audit).

---

## Who does what — admin vs teacher vs student

| Feature | 🧑‍💼 Admin (panel) | 👩‍🏫 Teacher (app/web) | 🎓 Student (app/web) |
|---|---|---|---|
| **Accounts** | Creates students, teachers, admins; suspend/reset/transfer | — | Changes own password only |
| **Courses & curriculum** | Creates & edits | Uses (picks topics) | Browses |
| **Batches & schedule** | Creates, schedules, assigns teachers, manages roster | Sees assigned batches | Belongs to one batch |
| **Attendance** | Reads matrix, corrects, exports | **Scans QR / marks roster** | **Shows QR** to be marked |
| **Study content (video/PDF)** | Publishes / unpublishes / scopes / deletes | **Uploads** | Watches / reads |
| **Practice quizzes** | Publishes / unpublishes / deletes | **Builds** | Takes (and retakes) |
| **Graded exams** | Publishes, **releases results**, deletes | **Builds**, **regrades**, releases | Takes (once) |
| **Question bank** | Archives / deletes | **Writes questions** | — |
| **Offline (paper) scores** | Views / deletes / exports | **Enters** | Sees own |
| **Live classes** | — (no admin role) | **Schedules & runs** (OBS) | Joins, chats, raises hand |
| **Leaderboard / badges / mastery / streaks** | — | Sees batch analytics | Sees own progress |
| **Audit log** | Reads everything | — | — |

---

## Golden rules (read before you start)

- **Order matters at setup:** Course → Curriculum → Batch → Schedule → Teacher → Student.
- **No self-signup, ever.** You issue every account; the person changes the password on first login.
- **Temp passwords show once.** Copy & hand over immediately; if lost, just **Reset password**.
- **Teachers create, you moderate.** Quizzes, exams, questions, content, offline scores, regrades happen in
  the teacher app — the panel publishes, releases, scopes, corrects, and removes.
- **Prefer Inactive over Delete** for batches/courses (preserves history; deletes are blocked when records reference them).
- **Archive questions** rather than delete once they're used in a quiz.
- **Guard admin 2FA recovery codes** — losing both phone and codes means a developer has to rescue the account.
- **Everything privileged is in the Audit log** with before/after values — your accountability record.

---

*Companion docs: [Admin Guide](./admin-guide.md) (full reference) · [Teacher Guide](./teacher-guide.md) ·
[Student Guide](./student-guide.md) · [Owner account setup](../owner-account-setup.md) ·
[Play Store upload guide](../play-store-upload-guide.md).*
