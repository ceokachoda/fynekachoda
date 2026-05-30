# 👑 FyneStudy Admin — Owner Account Setup Guide

> **Who this is for:** the institute **Owner** — the person who runs the FyneStudy
> Admin panel (creates students/teachers, sees reports, controls everything).
> **What it does:** walks you, click-by-click, through setting up your **own** admin
> account — your **password** (on your laptop) and your **2-factor security code**
> (on your mobile) — so nobody but you can get in.
>
> You do **not** need to know anything technical. Just follow the steps in order.
>
> 🔒 **About security:** your admin account is protected by **two locks**:
> 1. **Your password** (something you know), and
> 2. **A 6-digit code from an app on your phone** (something you have) — this is
>    called **2FA** (two-factor authentication). Even if someone stole your
>    password, they still couldn't get in without your phone.

---

## 📋 Table of contents
- **Before you start — what you need**
- **How it works (the 2-minute big picture)**
- **PART A — Create the owner account** *(done by your developer / current admin)*
- **PART B — Your first login (on your laptop)**
- **PART C — Set up 2FA on your mobile** ← the important one
- **PART D — Set your own password**
- **PART E — You're in! (the dashboard)**
- **Day-to-day: how you log in from now on**
- **Using it on your phone too (optional)**
- **If something goes wrong (lost phone, wrong code, etc.)**
- **Important do's and don'ts**

---

## Before you start — what you need

| # | Thing | Why |
|---|---|---|
| 1 | A **laptop or computer** with **Google Chrome** (or Edge/Safari) | You run the admin panel in a web browser. |
| 2 | Your **mobile phone** | It will hold your 2FA codes. |
| 3 | An **authenticator app** on that phone | It generates the 6-digit codes. Free. See below. |
| 4 | Your **admin panel web address (URL)** | Your developer gives you this. Looks like `https://admin-kohl-sigma.vercel.app`. |
| 5 | Your **login email + a one-time temporary password** | Your developer gives you these once (see Part A). |
| 6 | A safe place to store **10 backup codes** | Notes app, password manager, or a printed paper kept somewhere safe. |

### Installing the authenticator app (do this now, on your phone)
Open your phone's app store and install **one** of these (any works — they're all free):
- **Google Authenticator** (simplest)
- **Microsoft Authenticator**
- **Authy** (nice if you want your codes on more than one device — see the end)

> 💡 An "authenticator app" just shows a **6-digit number that changes every 30 seconds**.
> When the admin panel asks "enter your code," you open this app and type whatever
> number it's currently showing. That's all it does.

---

## How it works (the 2-minute big picture)

There is **no public sign-up** for the admin panel. Your account is **created for you**,
once, by your developer (or the existing admin). Then **you** finish the setup yourself:

```
  [Developer creates your account]  ──►  gives you: email + one-time password
            │
            ▼
  YOU open the admin URL on your laptop and log in with that email + password
            │
            ▼
  Step 1: Set up 2FA  → scan a QR code with your phone's authenticator app
            │            → save your 10 backup codes
            ▼
  Step 2: Choose your own new password (replaces the temporary one)
            │
            ▼
  ✅ You're in. From now on: email + your password + 6-digit code from your phone.
```

You only do this full setup **once**. After that, logging in takes ~10 seconds.

---

## PART A — Create the owner account
> 👤 **This part is done by your developer or the person who currently has admin access.**
> If that's already been done and you have your email + temporary password, **skip to Part B.**

1. Log into the admin panel as the **current owner** (email + password + their 6-digit code).
2. In the **left sidebar**, click **Admins**. *(Only an owner can see this item.)*
3. Top-right, click **+ New admin**.
4. Fill the form:
   - **Full name** — the new owner's real name.
   - **Email** — the new owner's **real, working email address**. ⚠️ This matters — it's how
     the account is identified and how the owner could recover access later. Do **not** use a
     fake address.
   - **Phone** — optional.
   - **Role** — open the dropdown and choose **Owner admin** *(not "Staff admin")*.
5. Click **Create admin**.
6. A green box appears showing the new **Email** and a **one-time temporary password**, each
   with a **Copy** button. **Copy both now — the password is shown only once and never again.**
7. Send those two pieces (email + temporary password) to the owner through a **private** channel
   (in person, or a private message — not a public group). The owner then does Parts B–E.

> 🧹 **Handover note:** there's a demo owner account (`owner@fynestudy.example.com`) used for
> testing. Its email is a fake placeholder that can't receive mail. Once the **real** owner account
> above works, ask your developer to **retire the demo owner** so only real accounts remain.

---

## PART B — Your first login (on your laptop)

1. Open **Google Chrome** on your laptop.
2. In the address bar, type your **admin panel URL** (the one your developer gave you, e.g.
   `https://admin-kohl-sigma.vercel.app`) and press **Enter**.
3. You'll see a page titled **"FyneStudy Admin · Sign in"** with an **Email** box and a
   **Password** box.
4. Type the **email** and the **one-time temporary password** you were given.
5. Click **Sign in**.

✅ **What you should see next:** the panel takes you to a **"Set up two-factor authentication"**
screen (a page with a **QR code** on it). That's expected — continue to **Part C**.

> ⏳ The first sign-in can take a few seconds. Wait — don't click repeatedly.
> ❌ If you see **"Invalid email or password,"** re-type carefully (passwords are
> case-sensitive — capital and small letters matter). Still stuck? Ask your developer
> to reset your temporary password.

---

## PART C — Set up 2FA on your mobile  ⭐ (the important step)

You're now on the **"Set up two-factor authentication"** screen on your laptop. It shows a
**QR code** (a black-and-white square) and a 6-digit-code box.

Keep your **laptop screen** in front of you and pick up your **phone**.

1. **On your phone, open the authenticator app** you installed (Google Authenticator, etc.).
2. Tap the **"+"** / **"Add"** / **"Scan a QR code"** button in that app.
   - In **Google Authenticator**: tap the **+** (bottom-right) → **Scan a QR code**.
   - In **Microsoft Authenticator**: tap **+** → **Other account** → it opens the camera.
   - In **Authy**: tap **Add Account** → **Scan QR Code**.
3. Point your phone's camera at the **QR code on your laptop screen**. It scans instantly.
4. Your app now shows a new entry called **"FyneStudy Admin"** with a **6-digit number** under it
   that **changes every 30 seconds**.
5. **Back on your laptop**, type that **6-digit number** into the **"6-digit code"** box.
   *(If the number changes while you're typing, just type the new one — you have 30 seconds.)*
6. Click **Verify and continue**.

> 📷 **Can't scan the QR code?** On the laptop screen click **"Can't scan? Show the secret to
> enter manually."** It shows a long code. In your authenticator app choose **"Enter a setup
> key / manually,"** type any account name (e.g. "FyneStudy"), paste that secret, and save.

### Now: save your 10 backup codes (don't skip this!)
After you verify, the laptop shows a box titled **"2FA enabled"** with **10 backup recovery codes**
(they look like `a3f9k-2m8qz`).

- These are your **emergency way in if you ever lose your phone.**
- Click **Copy all**, then **paste them somewhere safe**: a password manager, a private note, or
  print them and keep the paper somewhere only you can find.
- Each code works **once**. (If you ever use them up or re-set 2FA, you'll get 10 new ones.)
- Tick the box **"I have saved these recovery codes somewhere safe."**
- Click **Continue to dashboard**.

> ⚠️ **Why this really matters:** these backup codes are the **only self-service way** to get back
> in if your phone is lost, broken, or reset. If you skip saving them and later lose your phone,
> you'll have to contact your developer to reset your 2FA. **Save them now.**

---

## PART D — Set your own password

Right after 2FA, the panel sends you to a **"Change password"** screen (because you logged in with
a temporary password and must now choose your own).

1. Type a **new password** of your choice. It must be:
   - at least **10 characters**,
   - contain at least **one CAPITAL letter**, **one small letter**, and **one number**,
   - have **no spaces**, and
   - **not** be the same as your email.
   - 💡 Example of a strong one: `Sunrise-Physics-2026` (use your own — don't reuse this).
2. Type it **again** in the confirm box to make sure they match.
3. Click **Save / Change password**.

✅ This new password is now **yours**. The temporary password no longer works.

---

## PART E — You're in! (the dashboard)

You now land on the **Overview** page — the main dashboard with metric cards
(Students, Teachers, Batches, Courses, etc.).

- Look at the **bottom-left of the sidebar**: it shows **your name, your email, and "Owner admin."**
  That confirms you're logged in as the owner. 🎉

You're fully set up. **You won't have to do Parts C and D ever again.**

---

## Day-to-day: how you log in from now on

Every time you want to use the admin panel:

1. Open the **admin URL** in Chrome.
2. Enter your **email** + **your password** → **Sign in**.
3. At **"Confirm it's you,"** open your **authenticator app** on your phone and type the
   **current 6-digit code** → **Continue**.
4. You're on the dashboard.

That's it — about 10 seconds. To leave, use **Sign out** at the bottom of the sidebar
(always sign out on a shared/public computer).

---

## Using it on your phone too (optional)

The admin panel is a **website**, so you *can* also open the admin URL in your phone's browser
and log in the same way (email + password + 6-digit code). It works, but it's designed for a
**bigger screen** — for real work (creating accounts, reading reports) a **laptop is much more
comfortable**.

> 📱 **Don't confuse the two apps:** the **student/teacher mobile app** (the one students install)
> is *not* the admin panel. As the owner, **you use the admin website**, not the student app.

### Want your 2FA codes on more than one device?
If you'd like your 6-digit codes available on **both** your phone and, say, a tablet or your
laptop, use an authenticator that **syncs across devices** — **Authy** or **Microsoft
Authenticator** (with cloud backup) or **1Password** all do this. Set that up in the app itself;
the FyneStudy side doesn't change. *(Google Authenticator also now supports syncing if you turn
it on in the app.)*

---

## If something goes wrong

| Problem | What to do |
|---|---|
| **"Invalid email or password"** | Re-type carefully — capital/small letters matter. If it still fails, ask your developer to reset your temporary password. |
| **The 6-digit code says "That code didn't work"** | The number changes every 30 seconds — wait for a fresh one and type that. Also make sure your **phone's clock is set to automatic** (a wrong clock makes codes fail). |
| **Lost / broke / reset your phone** | On the "Confirm it's you" screen, click **"Lost your authenticator? Use a recovery code"** and type one of your **10 backup codes**. You'll then be asked to **set up 2FA again** (scan a fresh QR with your new phone) and you'll get 10 new backup codes. |
| **Lost your phone AND your backup codes** | Contact your developer — they can safely clear your 2FA so your next login starts a fresh setup. |
| **Page won't go past the login / keeps asking for a code** | That's the 2FA gate doing its job — you must enter a valid 6-digit code (or a backup code) to continue. |
| **Forgot your password (after setup)** | Ask your developer to reset it; you'll get a new temporary password and set a fresh one on next login. |

---

## Important do's and don'ts

**Do**
- ✅ Use a **real email** for your owner account.
- ✅ **Save your 10 backup codes** somewhere safe the moment you see them.
- ✅ Keep your phone's **date/time set to automatic** (so codes stay in sync).
- ✅ **Sign out** when using a shared or public computer.

**Don't**
- ❌ Don't share your password or your phone's codes with anyone.
- ❌ Don't delete the "FyneStudy Admin" entry from your authenticator app (you'd lock yourself out — you'd then need a backup code).
- ❌ Don't ignore the backup-codes step. It's your safety net.

---

### Quick reference card (print this)

```
ADMIN PANEL URL:  ____________________________________________

MY LOGIN EMAIL:   ____________________________________________

FIRST-TIME SETUP (once):
  1. Open URL → sign in with email + temporary password
  2. Scan the QR code with my phone's authenticator app
  3. Type the 6-digit code → Verify
  4. SAVE the 10 backup codes  ⟵ don't skip
  5. Set my own new password
  6. Done → dashboard

EVERY DAY AFTER:
  Open URL → email + my password → 6-digit code from phone → in.

BACKUP CODES STORED AT:  _____________________________________
```

---

*This guide describes setup for the **FyneStudy Admin panel**. It contains no passwords — you
choose your own during setup. Keep your email, password, and backup codes private.*
