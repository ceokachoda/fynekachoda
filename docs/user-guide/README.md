# FyneStudy — User Guide

This folder is the complete, plain-English manual for everyone who uses FyneStudy. Start with the guide for your role:

| You are… | You use… | Read this |
|---|---|---|
| Institute owner / office admin | The **web admin panel** (in a browser) | **[admin-guide.md](./admin-guide.md)** + the **[admin-workflow.md](./admin-workflow.md)** playbook |
| Teacher | The **mobile app** *or* the **web app** | **[teacher-guide.md](./teacher-guide.md)** |
| Student (or a parent) | The **mobile app** *or* the **web app** | **[student-guide.md](./student-guide.md)** |

> **Admins:** [admin-guide.md](./admin-guide.md) is the full *reference* (every screen & button);
> [admin-workflow.md](./admin-workflow.md) is the *playbook* (the exact steps for "a new student joined",
> "we're starting a batch", "a teacher left", etc.).

---

## Two ways to use FyneStudy: the app or the web

Students and teachers can use **either** of these — same login, same features, your choice:

- 📱 **Mobile app** (Android / iPhone) — install it and sign in.
- 🌐 **Web app** at **`https://fynestudy.live`** — open it in any browser; no install needed. On a phone it
  looks just like the app (bottom tabs); on a laptop the tabs become a left side-rail. You can even
  **"Add to Home screen" / Install** it so it opens like an app.

Everything in the Teacher/Student guides applies to **both** — where a step says "tap", on the web you "click".
*(If your institute is still rolling out the web version, they'll share the link when it's ready.)*

The **admin panel** is always a website (a computer browser); it is **not** the same as the student/teacher web app.

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
