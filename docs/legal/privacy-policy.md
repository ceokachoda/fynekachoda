# FyneStudy — Privacy Policy

> **Hosted version:** this policy is published publicly at `https://<your-admin-domain>/privacy`
> (rendered by `apps/admin/app/privacy/page.tsx`). That URL is what you paste into Play Console.
> **To change the institute name, contact email, address, or dates**, edit the `INSTITUTE` block at
> the top of that page **and** the matching values below, then redeploy. Current values are sensible
> defaults — replace them with the institute's real legal name / public contact before launch.

- **App:** FyneStudy (Android package `com.fynestudy.app`)
- **Operated by:** FyneStudy (the coaching institute, "we", "us", "the Institute")
- **Contact email:** kaustab.borah44@gmail.com
- **Effective date:** 30 May 2026
- **Last updated:** 30 May 2026

---

## 1. Who this policy is for

FyneStudy is a private app for students and teachers of FyneStudy, a coaching institute preparing students for the JEE, NEET, and CUET examinations. **The app is not open to the public and has no self-signup.** Accounts are created and issued only by the Institute's administrators. You can use FyneStudy only if the Institute has enrolled you.

Because our students include minors (people under 18, and some under 13), this policy explains in plain language what we collect, why, and how a parent or guardian can ask us to delete it. See §8 for the children-and-minors section.

## 2. What data we collect

We collect only what is needed to run the Institute's classes, attendance, assessments, and progress tracking. We do **not** ask you to enter anything beyond the categories below, and there is no advertising or tracking SDK in the app.

### 2.1 Student personal information (entered by the Institute when your account is created)

| Data | Why we hold it |
|---|---|
| Full name | Identify the student in rosters, results, and leaderboards |
| Email address | Login credential and account recovery |
| Phone number | Contact and account identification |
| Date of birth | Determine age group and batch eligibility |
| Gender | Institute records |
| Postal address | Institute records and correspondence |
| School name | Institute records |
| Education board (e.g. CBSE) | Academic context |
| Class / grade | Batch and curriculum assignment |
| Parent / guardian phone number(s) | Contact the family about the student's progress and attendance |
| Parental-consent record | Evidence that a parent/guardian consented to a minor's use of the app (see §8) |

### 2.2 Teacher personal information

| Data | Why we hold it |
|---|---|
| Full name | Identify the teacher to students and admins |
| Email address | Login credential |
| Phone number | Contact and account identification |
| Short bio | Shown to students |
| Subjects taught | Assign classes and content |

### 2.3 App activity we generate as you use the app

| Data | Why we hold it |
|---|---|
| Attendance records | Track presence in classes (marked by scanning a QR code) |
| Quiz and exam scores and answers | Grade assessments and show results |
| Topic mastery and progress | Show each student their strengths and weak areas |
| Study streaks | Motivation feature |
| Leaderboard standing and badges | Motivation feature, shown within the student's own batch |

### 2.4 Camera

The app uses your device camera **only** to scan attendance QR codes that a teacher displays in class. The camera image is processed on your device to read the code. **We do not photograph you, and we do not store, upload, or transmit any camera image.** Camera access is requested at the moment you open the attendance scanner and you can decline it in your device settings.

### 2.5 What we do NOT collect

- We do **not** collect your precise or approximate location.
- We do **not** show advertising or use any advertising or analytics tracking SDK.
- We do **not** record audio or video from your device.
- We do **not** collect contacts, SMS, call logs, or files outside the app.
- We do **not** use cookies for tracking (the app is not a website).

## 3. How we use your data

We use the data above only to:

1. Authenticate you and keep your account secure.
2. Run classes, attendance, practice quizzes, graded exams, and the study library.
3. Show you and your teachers your academic progress, results, mastery, and streaks.
4. Operate motivational features (badges and a batch-scoped leaderboard).
5. Communicate with students and their parents/guardians about progress and attendance.

We do **not** use your data for advertising, profiling for advertising, or any automated decision that produces legal effects.

## 4. Who can see your data (sharing)

- **We do not sell your personal data. Ever.**
- **We do not share your personal data with third parties for advertising or marketing.**
- Within the app, your name and progress are visible to the Institute's teachers and administrators, and your first-name/standing may appear to other students **in your own batch only** on the leaderboard. You can be identified by your batch-mates only to the extent of leaderboard standing and badges.
- We use the service providers listed in §5 purely to host and operate the app on our behalf. They process data under our instructions and do not use it for their own purposes.

## 5. Service providers (data processors)

| Provider | Role | What it processes | Where |
|---|---|---|---|
| **Supabase** | Database, authentication, file storage, realtime | All account and activity data in §2.1–§2.3 | Hosted in the `ap-south-1` (Mumbai, India) region |
| **YouTube (Google LLC)** | Live-class and recording video playback | Live classes are unlisted YouTube videos embedded in a wrapped player. Watching a video may cause YouTube to receive standard playback/device data governed by Google's own privacy policy | Google infrastructure |
| **Expo / EAS (Expo, Inc.)** | App build and over-the-air update delivery | App binaries and update bundles; does not receive your personal account data | Expo infrastructure |

We currently do **not** use any crash-reporting (e.g. Sentry) or product-analytics (e.g. PostHog) service. If we add one later, we will update this policy and the Play "Data safety" form before enabling it.

Links to processors' policies: Supabase — https://supabase.com/privacy ; Google/YouTube — https://policies.google.com/privacy ; Expo — https://expo.dev/privacy .

## 6. How we protect your data

- All traffic between the app and our servers is **encrypted in transit (HTTPS/TLS)**.
- Data is stored in Supabase (Postgres) with **row-level security (RLS)** enabled on every table holding user data, so each account can read only the records it is permitted to.
- Privileged actions run server-side through audited edge functions; the app never holds an administrative database key.
- Administrative changes are recorded in an internal audit log.

No system is perfectly secure, but we take reasonable technical and organisational measures appropriate to the sensitivity of student data.

## 7. How long we keep your data

We keep your account and activity data for as long as you are an enrolled student or teacher of the Institute, and for a reasonable period afterwards for the Institute's legitimate academic and administrative records. When data is no longer needed, or on a valid deletion request (§9), we delete or anonymise it.

## 8. Children's and minors' data

FyneStudy is used by minors. We treat children's data with extra care:

- An account for a minor is created by the Institute **only after a parent or guardian has consented**, and the app stores a record of that consent.
- We collect from minors only the information needed for their education at the Institute (§2.1). We do not require a child to disclose more than is reasonably necessary to use the app.
- We do **not** show advertising to anyone, and we do not use children's data for advertising or for building advertising profiles.
- A parent or guardian may review, correct, or request deletion of their child's data at any time by contacting the Institute (§9).

This app is designed to meet Google Play's Families policy expectations for an app whose audience includes children. If you are a parent or guardian and have any concern about your child's data, contact us at kaustab.borah44@gmail.com.

## 9. Your rights and how to request access, correction, or deletion

Because the Institute issues and manages all accounts, **requests are handled by the Institute, not inside the app.** To review, correct, export, or delete your (or your child's) personal data, email **kaustab.borah44@gmail.com** from the address on file.

Students and teachers cannot self-edit identity fields (name, email, phone, date of birth, batch, course, parent phone) in the app by design; ask the Institute to change them. We will respond to verified requests within a reasonable time and in line with applicable law.

## 10. Changes to this policy

If we change this policy, we will update the "Last updated" date above and, for material changes, notify the Institute community. Continued use of the app after an update means you accept the revised policy.

## 11. Contact us

**FyneStudy**
Email: kaustab.borah44@gmail.com
