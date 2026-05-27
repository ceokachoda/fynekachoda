# FyneStudy — User Guide

This folder is the complete, plain-English manual for everyone who uses FyneStudy. Start with the guide for your role:

| You are… | You use… | Read this |
|---|---|---|
| Institute owner / office admin | The **web admin panel** (in a browser) | **[admin-guide.md](./admin-guide.md)** |
| Teacher | The **mobile app** | **[teacher-guide.md](./teacher-guide.md)** |
| Student (or a parent) | The **mobile app** | **[student-guide.md](./student-guide.md)** |

---

## The one rule that explains everything

**There is no self-signup.** The institute's admin creates every account — students, teachers, and other admins — and hands out the login. If the institute hasn't enrolled you, you cannot sign in. This keeps the platform private and safe (many of our students are minors).

## First login — the same for everyone

1. The admin gives you your **email** and a **temporary password**.
2. Open the app (mobile) or the admin website (browser) and tap/click **Log in**.
3. You'll immediately be asked to **set a new password** (a first-login security step). Choose a strong one: **10+ characters, with upper- and lower-case letters and a number**, no spaces, and not the same as your email.
4. You're in. Next time you'll log in with your new password.

## What you can and can't change yourself

Your **name, email, phone, date of birth, batch, and course are set by the institute** — for accurate records and child-safety, you can't edit these inside the app. Need one changed? Ask the office. You **can** change your **password** any time.

## Roles at a glance

| Role | Logs in via | Can do |
|---|---|---|
| **Owner admin** | Web panel (with 2FA) | Everything, including managing other admins |
| **Staff admin** | Web panel (with 2FA) | Day-to-day operations: students, batches, content, attendance, assessments |
| **Teacher** | Mobile app | Classes, attendance scanning, quizzes, exams, content, batch analytics |
| **Student** | Mobile app | Classes, library, attendance, quizzes, exams, leaderboard, progress |

## Getting help

- **Forgot password / can't log in / locked out** → contact the institute office. (Admins additionally have 2FA recovery codes saved during setup.)
- **A settings row says "coming in a future update"** → that's expected in this first release; it isn't broken.

---

### For the developer / owner (not end-user docs)
- Publish the mobile app to the Play Store → [`../play-store-upload-guide.md`](../play-store-upload-guide.md)
- Deploy the admin panel to Vercel → [`../vercel-admin-deploy.md`](../vercel-admin-deploy.md)
- Full pre-launch QA checklist → [`../phases/phase-12-manual-tests.md`](../phases/phase-12-manual-tests.md)

*This guide reflects the FyneStudy v1.0 release.*
