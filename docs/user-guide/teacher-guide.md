# FyneStudy — Teacher Guide (Mobile App)

Welcome! This guide walks you through everything you can do as a **teacher** in the FyneStudy mobile app — from your very first login to running a full live class. It's written for non-technical users: every step says exactly which tab to open, which button to tap, and what happens next.

> **Related guides:** [Student Guide](./student-guide.md) · [Admin Guide](./admin-guide.md)

**How this guide is organised:**

1. [Intro — how teacher accounts work + installing the app](#1-intro)
2. [Getting started — first login & a tour of Home](#2-getting-started)
3. [BASIC — attendance, your batches, your profile](#3-basic)
4. [INTERMEDIATE — schedule a class, upload material, build a quiz, enter offline scores](#4-intermediate)
5. [ADVANCED — graded exams, live classes, results & analytics, manual roster](#5-advanced)
6. [Cheat-sheet & practical tips](#6-cheat-sheet--practical-tips)

---

## 1. Intro

### How teacher accounts work

FyneStudy has **no sign-up button**. You do not create your own account. Instead:

1. Your institute **admin creates your account** and assigns you to one or more **batches** (a batch belongs to a course like JEE or NEET).
2. The system **emails you** a temporary password.
3. You install the app, log in with that temporary password, and the app immediately asks you to **set your own password**.

You **cannot change** your own name, email, phone, or which batches you teach from inside the app. Those are managed by your admin — if any of them is wrong, tap **Contact admin** on your Profile tab (see [§3.3](#33-your-profile-tab)).

### Installing the app

| Situation | What to do |
|---|---|
| App is published | Search **"FyneStudy"** on the **Google Play Store** (Android) or **App Store** (iPhone), install, and open it. |
| You were sent an internal-test link | Tap the install link your institute sent you (it opens the Play Store internal-test page or a TestFlight invite on iPhone), accept the test, then install. |
| You only have an Expo Go link | Open the link in the **Expo Go** app if your institute is still testing. Your admin will tell you if this applies. |

The app works on both **iPhone and Android**. When you first open it, you'll see the **Welcome / Sign in to FyneStudy** screen.

---

## 2. Getting started

### 2.1 First login

1. Open the app. You'll see the login screen with the heading **"Welcome to FyneStudy"**.
2. In the **Email** box, type the email address your admin used for your account.
3. In the **Password** box, type the **temporary password** from the email.
4. Tap the blue **Sign in** button.
   - If the email or password is wrong, a red error message appears under the boxes. Double-check both. Forgotten it already? Tap **Forgot password?** above the button to get a reset link by email.

> The small note at the bottom — *"Admin-issued accounts only"* — is just a reminder that accounts come from your institute.

### 2.2 Set your own password (first time only)

The very first time you log in, the app shows **"Choose a new password"**. This is required — you can't continue until you do it.

1. In **New password**, type a password that follows these rules:
   - At least **10 characters**
   - Includes an **uppercase** letter, a **lowercase** letter, and a **digit**
   - **No spaces**
   - Must **not** be the same as your email
2. Type the same password again in **Confirm new password**.
3. Tap **Save and continue**.

You'll land on your **Home** dashboard. From now on you log in with this new password.

> Want to change your password again later? Profile tab → **Change password** (see [§3.3](#33-your-profile-tab)).

### 2.3 A tour of the Home dashboard

After login you're on the **Home** tab. From top to bottom you'll see:

| Section | What it shows |
|---|---|
| **Hi, [your name]** | A greeting with today's date. |
| **Next** (blue card) | Your next class — subject, batch, and start time. It has a **Take Attendance** button that jumps to the Scan tab. Shows only when you have an upcoming or live class. |
| **Pending** | Things waiting for your action (for example, exams whose results you haven't released yet). |
| **Today's classes** | A list of every class you teach today, with times. Tap one to go to the Scan tab. A red **Live** badge marks a class that's streaming now. |
| **Quick actions** | Three shortcut tiles: **Scan QR**, **New exam**, and **Upload**. |
| **My batches** | A card for each batch you teach, showing the course code, student count, and next session. Tap a batch card to open its **analytics** (attendance, mastery, at-risk students — see [§5.4](#54-read-your-batch-analytics)). |

**Pull down** anywhere on Home to refresh it.

### 2.4 The bottom tab bar

At the bottom of the screen are **8 tabs**. This is your main menu — here's what each one does and where it's covered in this guide:

| Tab | Icon | What it's for | Section |
|---|---|---|---|
| **Home** | House | Your dashboard | [§2.3](#23-a-tour-of-the-home-dashboard) |
| **Scan** | QR code | Take attendance by scanning student QR codes | [§3.1](#31-take-attendance-by-scanning) |
| **Classes** | Video | Your schedule; schedule live classes & ad-hoc classes | [§4.1](#41-schedule-a-class) |
| **Library** | Open book | Upload videos & PDFs for students | [§4.2](#42-upload-study-material) |
| **Quizzes** | Checklist | Create & manage practice quizzes | [§4.3](#43-build-a-practice-quiz) |
| **Exams** | Clipboard | Create graded exams; release results; offline scores | [§5.1](#51-build-a-graded-exam) |
| **Batch** | People | (Opened from a batch card) batch analytics | [§5.4](#54-read-your-batch-analytics) |
| **Profile** | Person | Your details, change password, sign out | [§3.3](#33-your-profile-tab) |

> If Home says **"No batches assigned yet"**, your admin hasn't added you to a batch. Almost every feature needs a batch, so ask your admin to assign you first.

---

## 3. BASIC

Start here. These are the everyday things you'll do most.

### 3.1 Take attendance by scanning

Each student's app shows a **QR code that changes every 30 seconds**. You scan it to mark them present. The server checks the code is fresh and belongs to the right class, so attendance can't be faked.

1. Tap the **Scan** tab. The camera opens full-screen.
   - **First time:** the app asks for **camera permission** — tap **Allow camera**. If you accidentally denied it, you'll see an "Camera access needed" screen with an **Open Settings** button; tap it, enable the camera for FyneStudy, and come back.
2. At the top is a dark bar that says **"Scanning for"** followed by a class name. This is the class attendance will be recorded against.
   - The app auto-picks your nearest live or upcoming class.
   - To change it, **tap that bar** — a list drops down. Tap the correct class. (Only today's and upcoming classes appear; past classes aren't scannable here.)
3. Point the camera at a student's QR code, centring it in the square.
4. The result pops up instantly:
   - **Green** "✔ [Student name] — Marked present" (or "Marked late") = success. A little buzz confirms it.
   - **Red** with a reason if it didn't work — common ones below.
5. Just keep pointing at the next student's screen — no need to tap between scans.

**What the red messages mean:**

| Red message | Meaning | What to do |
|---|---|---|
| **Already marked** | This student was already scanned for this class. | Move on — they're counted. |
| **QR expired** | The code was older than 30 seconds. | Ask them to refresh their screen and show the new code. |
| **Wrong class** | The code is for a different class than the one selected. | Check the "Scanning for" bar is set to the right class. |
| **Invalid QR** | The code isn't a valid FyneStudy attendance code. | Make sure you're scanning a student's attendance screen, not something else. |
| **Slow down** | You scanned too many codes too fast. | Pause a second, then continue. |
| **Pick a session** | No class is selected. | Tap the top bar and choose a class first. |

> **Open roster** (button at the bottom) jumps to the full student list for this class, where you can see who's marked and fix mistakes by hand. See [§5.5](#55-mark-a-roster-by-hand).

### 3.2 View your batches & students

- On **Home**, scroll to **My batches**. Each card shows the course, how many students, and the next scheduled session.
- Tap a batch card to open **Batch analytics**. The detailed analytics (attendance heatmap, topic mastery, at-risk students) are explained in [§5.4](#54-read-your-batch-analytics) — but even at a glance the top of that screen shows the batch name, course, and roster size.

> To see and edit who's marked present/absent for one specific class, open that class's **Roster** instead (from the Scan screen or the Classes tab) — see [§5.5](#55-mark-a-roster-by-hand).

### 3.3 Your Profile tab

Tap the **Profile** tab to see:

- Your **name**, the **TEACHER** badge, and your **email**. These are **read-only** — a note reminds you to contact admin to change any of them.
- **Contact admin** — opens your email app with the institute admin's address pre-filled. Use this for name/email/batch changes or any support.
- **Change password** — opens the password screen so you can pick a new password any time. (Same rules as [§2.2](#22-set-your-own-password-first-time-only).)
- **Sign out** (red button) — logs you out and returns to the login screen.

---

## 4. INTERMEDIATE

Once attendance feels easy, these are the tools you'll use to actually teach.

### 4.1 Schedule a class

The **Classes** tab is your timetable. At the top, three segments — **Today / Upcoming / Past** — let you switch which classes you see (the number beside each is the count). Each class row shows the subject, batch, date/time, and how many students are marked, plus quick buttons.

There are **two floating round buttons** at the bottom-right:

| Button | Colour / icon | Creates |
|---|---|---|
| Upper button | **Red**, broadcast (radio) icon | A **live class** (streams over YouTube) |
| Lower button | **Blue**, plus (+) icon | A normal **ad-hoc class** (in-person, no stream) |

#### Schedule an ordinary (ad-hoc) class

1. Tap the **blue + button**.
2. The **"New ad-hoc class"** sheet slides up.
3. **Batch** — tap to pick which batch this class is for (it pre-selects your first batch).
4. **Duration** — tap 30, 45, 60, or 90 minutes.
5. The sheet shows the **start time** (the next 15-minute mark, in IST) and end time.
6. Tap **Create class**. The app opens that class's **Roster** so you can start marking attendance.

#### Schedule a live (streaming) class

1. Tap the **red broadcast button**.
2. The **"Schedule live class"** sheet slides up (it notes that it streams over YouTube).
3. Pick the **Batch** and **Duration** just like above.
4. Tap **Set up live class**. The app opens the **Live control** screen, where you'll get your streaming details.

Running the live class end-to-end (OBS, going live, chat) is covered in [§5.2](#52-run-a-live-class-end-to-end).

> **Buttons on each class row:** a **Scan** button (for ordinary classes) jumps to the scanner; **Go live / Live control** (for live classes) opens the live screen; **Roster** opens the attendance list. The status pill on the right reads **Scheduled / Live / Ended / Cancelled**.

### 4.2 Upload study material

The **Library** tab (open-book icon) is where you add learning content — a YouTube video link **or** a PDF — for your students.

1. Tap the **Library** tab. The screen is titled **"Upload Content"**.
2. At the top, choose the **Kind**: **Video**, **PDF**, or **Note**.
3. Choose where it belongs by tapping each picker in order:
   - **Course** (only appears if you teach more than one) → **Subject** → **Chapter** → **Topic**.
   - You must pick down to a **Topic** — each picker unlocks the next.
4. Choose the **Scope**:
   - **My Batch** — pick one of your batches; only that batch sees it.
   - **Suggest course-wide** — proposes it for everyone on the course; **your admin reviews and approves** before students see it.
5. Type a **Title** (required) and an optional **Description**.
6. Add the content itself:
   - **For a Video:** paste the **YouTube URL** in the box. (The institute keeps lesson videos **Unlisted** on its channel.)
   - **For a PDF / Note:** tap **Pick a PDF**, choose the file (**max 50 MB**). The file name and size appear once chosen.
7. Tap **Upload**.
   - A progress bar shows while a PDF uploads.
   - A confirmation pops up — **"Video linked successfully"** or **"Content added to library"** — and the form clears, ready for the next item.

> **Tip:** Students find your material in their **Library** by drilling down Subject → Chapter → Topic, so picking the right topic matters.

### 4.3 Build a practice quiz

Quizzes are low-stakes practice (students can retake them). Build them from the **Quizzes** tab.

1. Tap the **Quizzes** tab. You'll see your existing quizzes (each shows question count, duration, and **Published** or **Draft**). Tap an existing one to edit it.
2. To make a new one, tap the blue **New** button (top-right). The **"New Quiz"** builder opens.
3. **Title** — name it (e.g. *"Vectors — Quick 15"*).
4. **Scope** — pick the **Subject → Chapter → Topic** (and **Course** if you teach several). Then optionally pick a **Batch** — leave it as **Course-wide** to let everyone on the course take it, or pick one batch to restrict it.
5. **Timing & Marking** — set:
   - **Duration (min)** — how long students get.
   - **Correct / Wrong / Skip** — marks for each (e.g. +4, −1, 0).
6. **Randomization** — toggle **Randomize question order** and **Randomize option order** on or off.
7. **Add questions** — two ways:
   - **New question** — opens an editor (you must pick a topic first):
     1. **Prompt** — type the question. You can use Markdown and math, e.g. `$\theta$` for symbols.
     2. **Difficulty** — tap EASY / MEDIUM / HARD (optional).
     3. **Options** — type each answer choice. **Tap the square to the left of the correct option** so it turns green with a check. (Only one option can be correct.) Fill in at least two options.
     4. **Explanation** — optionally explain why the answer is correct (students see this after).
     5. **Related content** — optionally link a published video/PDF on this topic.
     6. Tap **Save**. The question is added to your list.
   - **From bank** — opens the **Question Bank** for this topic. Search, tap questions to select them (a blue check appears), then tap **Add (N)** to pull them in.
8. **Reorder or remove** questions using the up/down arrows and the trash icon next to each.
9. Save:
   - **Save Draft** — keeps it hidden from students while you keep working.
   - **Publish** — makes it live for students (you need at least one question).

> A green **"Quiz published"** or **"Draft saved"** confirmation appears, and you return to the quiz list.

### 4.4 Enter offline test scores

For paper tests taken in class, you can record scores so they appear in the app alongside everything else.

1. Tap the **Exams** tab, then the **Offline** button (top-left, pencil icon).
2. The **"Offline Test Scores"** screen opens.
3. Fill in the header:
   - **Batch** — pick the batch (this loads its student roster below).
   - **Test name** — e.g. *"Weekly Test 12"*.
   - **Date** — tap to pick the test date (defaults to today).
   - **Max score** — the total marks (e.g. 100).
   - **Subject** (optional) — pick if relevant.
4. The **roster** appears. For each student, type their score in the box on the right (out of the max you set).
   - If a student already has a saved score for this test, it shows underneath in green as **"Previous: …"**.
5. Tap **Save All** at the bottom. A confirmation tells you how many scores were saved/updated.

> You don't have to enter every student at once — only the ones you fill in are saved, and you can come back and add more later (re-pick the same batch + test name + date).

---

## 5. ADVANCED

The full toolkit: timed graded exams, live streaming, results & analytics, and hand-correcting attendance.

### 5.1 Build a graded exam

Exams are **server-timed, locked-down** tests — students get a countdown enforced by the server, tab-switching is logged, and you control when results are shown. Build them from the **Exams** tab.

1. Tap the **Exams** tab. Existing exams are listed with a status: **Draft / Scheduled / Live now / Closed / Released**, plus question and attempt counts.
2. Tap the blue **New** button (top-right). The **"New Exam"** builder opens.
3. **Basics:**
   - **Title** — e.g. *"Unit Test 4 — Mechanics"*.
   - **Batch** — tap to choose which batch sits the exam.
   - **Starts** — tap to pick the **date and time** (15-minute slots, IST; up to 30 days ahead). The exam becomes available to students at this time.
   - **Duration** — tap a preset (15–180 minutes).
4. **Marking & options:**
   - **+ Correct / − Wrong / Skip** — marks per answer.
   - **Randomize question order** and **Randomize option order** toggles.
   - **Result release** — tap to choose:
     - **Manual** — you release results later (recommended; lets you regrade first).
     - **Instant** — each student sees their score the moment they submit.
5. **Questions** — tap **Add from Question Bank**, search, and tap questions to add them. (Need a brand-new question? Tap **+ New Question (via quiz builder)** — it opens the quiz question editor; create the question there, then come back and add it from the bank.) Reorder with ↑/↓ and remove with the trash icon.
6. Save:
   - **Save Draft** — keep editing privately.
   - **Publish** — schedule it for the batch (needs at least one question).

> You can edit a published exam, but do final edits **well before the start time**. The builder warns you; major last-minute changes need admin help.

### 5.2 Run a live class end-to-end

A FyneStudy live class is a private YouTube stream shown **inside the app**, with the app's own chat, raise-hand, and watermark. You stream the actual video from a **laptop running OBS Studio** (a free program) — your phone is the control panel.

> **One-time setup:** OBS and the institute's YouTube connection are set up once (your admin handles the YouTube side). The full first-time setup is documented separately for your admin. This section assumes that's done and you just want to teach.

**The two roles:** your **phone** (the app) creates and controls the broadcast; your **laptop** (OBS) sends the actual picture and sound. They're connected by a one-time **Server address + Stream key** that the app gives you per class.

#### Step A — Create the class

1. **Classes** tab → tap the **red broadcast button** → pick batch + duration → **Set up live class**.
2. You land on the **Live control** screen with the header **"Setup"**.

#### Step B — Get your streaming details

On the Setup screen you'll see a **Stream setup** card with:

- **Server (RTMP URL)** — e.g. `rtmp://a.rtmp.youtube.com/live2`, with a **Copy** button.
- **Stream key** — a long secret string, with a **Copy** button.
- A **Copy Server + Key** button that copies both together (labelled).

To get these onto your laptop: tap **Copy Server + Key**, then **paste it into a message to yourself** (WhatsApp "Message yourself", Telegram Saved Messages, or email) and open that message **on your laptop**.

> Keep your stream key private — don't post it in a group chat.
>
> If the card instead shows an amber **"YouTube isn't configured yet"** note, the institute's YouTube connection isn't set up. You can still tap **Go Live** to test chat/raise-hand/moderation with students, but no video will stream until your admin completes the YouTube setup.

#### Step C — Start streaming from OBS (on the laptop)

1. Open **OBS Studio** → **Settings → Stream**.
2. **Service:** choose **Custom…**.
3. **Server:** paste the **Server (RTMP URL)** from the app.
4. **Stream Key:** paste the **Stream key** → **OK**.
5. Click **Start Streaming** (bottom-right). The bar turns green when OBS is sending video to YouTube.

#### Step D — Go live in the app

Back on your phone's **Live control** (Setup) screen, tap the red **Go Live** button.

- The header flips to **"● Live now"**.
- The **Chat** and **Hands** tabs and the **End class** button appear.
- The class now shows up in your students' **Live** section, and they can join.

#### Step E — Teach & moderate

While live, the Live control screen gives you:

- A **video preview** at the top, and a **viewer count** (people icon) in the header.
- **Chat** tab — messages from students. To pin an important note for everyone, tap **Pin an announcement**, type it, and tap **Pin**. To send a normal message, type in the box at the bottom and send.
- **Moderate a message** — **long-press** any chat message → a menu lets you **Delete message** or **Mute [student] for this class** (and **Unmute** later).
- **Hands** tab — students who tapped "raise hand" appear in a queue in order. When you've taken a student's question, tap **Resolve** to clear them.

#### Step F — End the class (order matters)

1. **In the app:** tap the red **End class** → confirm. This finalises the YouTube broadcast and turns the class into a **recording** students can watch later.
2. **In OBS:** click **Stop Streaming**.

> Always tap **End class in the app first** — that's the clean path that saves the recording and updates everything. Students will find the saved class under **Recorded** in their app.

### 5.3 View exam results, release them & regrade

After students sit an exam, open its results board.

1. **Exams** tab → tap an exam → on its card tap **Results · Locked** (or **Results · Released**). The **results board** opens.
2. The top card summarises: how many attempts, how many submitted, and whether results are **released** or **NOT released**.

#### Release results to students

- If results aren't released yet, tap **Release Results to Students**.
- Confirm in the pop-up. Students can then see their scores **and** the solutions.

> Releasing can't be undone by you (only an admin can un-release), so regrade first if you suspect a bad question.

#### Read the roster

Each submitted student shows their **score**, percentage, and a breakdown (✓ correct / ✗ wrong / skipped). A red or amber **tab×N** flag means the student switched away from the exam N times — worth a look if it's high.

#### Regrade a question

If a question had a wrong answer key or a typo:

1. Under **Question analysis**, each question shows the **% who got it right**. Tap **Regrade** on the problem question.
2. Choose an **action**:
   - **Change correct option** — pick the new correct answer (the previous one is marked **PREV**).
   - **Mark no correct** — everyone gets the *skip* marks for that question.
   - **Mark all correct** — everyone gets full marks for that question.
3. Type a short **Reason** (required — it's saved to the audit log).
4. Tap **Apply Regrade**. Every submitted attempt is re-scored, and a confirmation shows how many were updated.

### 5.4 Read your batch analytics

From **Home → My batches**, tap a batch card. The **Batch analytics** screen has three tabs (it opens on **Risk**):

| Tab | What it shows |
|---|---|
| **Risk** | Students who are **at risk** (low overall performance). Check in with these students first. The tab shows a count, e.g. *Risk (3)*. |
| **Mastery** | **Topic-mastery bars** — how well the batch has mastered each topic, so you can see what to re-teach. |
| **Attendance** | An **attendance heatmap** — a coloured calendar grid showing attendance over recent days. |

Pull down to refresh.

### 5.5 Mark a roster by hand

The **Roster** is the full attendance list for one class. Use it to fix scans or mark students who couldn't scan. Open it from the **Scan** screen's **Open roster** button, or from a class row's **Roster** button on the **Classes** tab.

At the top you'll see counts — **Present / Late / Absent / Pending** — and two bulk buttons.

**Marking one student** — each student row has three pills: **P** (present), **L** (late), **A** (absent):

| You tap… | …when the student is | Result |
|---|---|---|
| A pill (P/L/A) | **Unmarked** | Marks them with that status immediately. |
| The **same** pill again | Already that status | Asks to **un-mark** them (back to unmarked). |
| A **different** pill | Already marked something else | Opens the **change-status** sheet (you must give a reason). |
| **Long-press** the row | Already marked | Opens the change-status sheet to correct it. |

**The change-status sheet:** pick the new status (Present/Late/Absent), tap a quick **reason** chip (or type your own — at least 3 characters), and tap **Save**. The reason is kept in the audit log.

**Bulk-mark everyone left:**

- **All Present** — marks every *unmarked* student present.
- **All Absent** — marks every *unmarked* student absent.
- Both ask you to confirm and **never change** students who are already marked.

---

## 6. Cheat-sheet & practical tips

### Quick reference — where everything lives

| I want to… | Go to | Then |
|---|---|---|
| Take attendance | **Scan** tab | Pick the class at the top, point at QR codes |
| Fix attendance by hand | **Roster** (Scan → Open roster, or Classes → Roster) | Tap pills / long-press a row |
| See my batches & students | **Home → My batches** | Tap a batch card for analytics |
| Schedule a normal class | **Classes** tab → blue **+** | Pick batch + duration → Create class |
| Schedule a live class | **Classes** tab → red broadcast | Pick batch + duration → Set up live class |
| Run / control a live class | **Classes** → the class → **Go live / Live control** | OBS on laptop, then **Go Live** |
| Upload a video or PDF | **Library** tab | Pick kind → topic → scope → Upload |
| Make a practice quiz | **Quizzes** tab → **New** | Topic + questions → Publish |
| Make a graded exam | **Exams** tab → **New** | Batch + start time + questions → Publish |
| Enter paper-test scores | **Exams** tab → **Offline** | Batch + test + per-student scores → Save All |
| Release / regrade exam results | **Exams** → exam → **Results** | Release, or Regrade a question |
| See at-risk students & mastery | **Home → batch card** | Risk / Mastery / Attendance tabs |
| Change my password | **Profile** → Change password | Enter a new password |
| Ask admin for help | **Profile** → Contact admin | Sends an email |

### Practical tips

- **Keep the app updated.** Install updates from the Play Store / App Store when offered — they include fixes and new features.
- **Only one video plays at a time.** When you leave a live class or video screen, the player stops. Don't expect a stream to keep playing in the background.
- **Attendance QR codes expire every 30 seconds** — if a scan says "expired", just ask the student to show the refreshed code.
- **The server is the timekeeper for exams.** A student's device clock doesn't matter — the countdown and the deadline are enforced by the server, so don't worry about phones being "a few minutes off".
- **Pick the right Topic** when uploading content or building quizzes — that's how students find it in their Library.
- **Use Manual result release** for important exams so you can regrade a bad question *before* students see scores. Once released, only an admin can take it back.
- **For live classes, end the class in the app first**, then stop OBS — that saves the recording cleanly.
- **You can't edit your own name, email, or batches.** Use **Profile → Contact admin** for those.
- **If Home is empty** ("No batches assigned yet"), you haven't been added to a batch — contact your admin.
- **Test on the device students use.** If something looks odd, pull down to refresh the screen first — most lists refresh on a pull-down.

---

*Questions this guide can't answer? Tap **Profile → Contact admin** in the app, or see the [Student Guide](./student-guide.md) and [Admin Guide](./admin-guide.md).*
