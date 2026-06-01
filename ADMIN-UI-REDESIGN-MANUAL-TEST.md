# Admin Panel — UI Redesign Manual Test

**Date:** 2026-06-01
**Scope:** Visual / UX redesign of `apps/admin` only. **No logic, data, routes, or page layout changed** — so every existing feature must still behave exactly as before. This checklist is about how things *look* and that nothing *broke*.

> **🟢 SHIPPED & LIVE in production (2026-06-01)** — pushed via `main` (commit `978c4e8`) → Vercel. Confirmed: `fyne-study-app-admin.vercel.app` serves the new `/brand/fyne-mark.png`. Verify the latest deploy is green in the Vercel dashboard, then run this checklist against either local or production.

**Local URL:** http://localhost:3000  (dev server is running)
**Production:** https://fyne-study-app-admin.vercel.app
**Sign-in:** /login

> **Before you start:** open the site, then press **Ctrl + Shift + R** (hard refresh) once. This clears old cached styles so you see the new design, not a stale copy.
>
> Mark each box: ✅ pass · ❌ fail (write what looked wrong) · ⏭️ skipped.

---

## 0) Sign-in page  →  http://localhost:3000/login

| # | Do this | You should see | Result |
|---|---------|----------------|--------|
| 0.1 | Open `/login` | The blue **FyneStudy shield logo** + the word **fynestudy** centered at the top (not plain text "FyneStudy Admin") | [ ] |
| 0.2 | Look at the background | A soft **blue glow** at the top-center and a faint indigo glow bottom-right, over a light gray page | [ ] |
| 0.3 | Look at the card | A white card with **rounded corners** and a soft **drop shadow** (raised off the page) | [ ] |
| 0.4 | Look at the Email + Password fields | Both fields are a **comfortable height** (not cramped) | [ ] |
| 0.5 | Look at the "Sign in" button | **Royal-blue** button, full width, with a subtle shadow | [ ] |
| 0.6 | Click into the Email field | A **blue focus ring/glow** appears around the field | [ ] |
| 0.7 | Click the eye icon in Password | Toggles show/hide; icon sits neatly inside the field | [ ] |
| 0.8 | Look at the browser tab | The tab **favicon is the blue shield** (may need a refresh to update) | [ ] |
| 0.9 | Overall text | Letters look crisp/modern (Geist font), not the plain default system font | [ ] |

---

## 1) Access-denied page  →  http://localhost:3000/forbidden

| # | Do this | You should see | Result |
|---|---------|----------------|--------|
| 1.1 | Open `/forbidden` directly | Shield logo at top, branded gradient background, a raised rounded card reading **"Access denied"**, and a blue **"Use a different account"** link | [ ] |

---

## 2) Sign in, then the Sidebar (shows on every page)

Sign in with your admin account (you may be asked for your 2FA code — that's normal). Once you land on the dashboard:

| # | Do this | You should see | Result |
|---|---------|----------------|--------|
| 2.1 | Look at the top-left of the sidebar | The **shield logo + "fynestudy"**, with **"ADMIN PANEL"** in small caps underneath | [ ] |
| 2.2 | Look at the nav items | Each item (Overview, Students, Teachers, …) now has a small **icon** to its left | [ ] |
| 2.3 | Note the current page | The active item is highlighted **blue** with a small **blue bar on its left edge** | [ ] |
| 2.4 | Hover over a different item | It gets a light gray background; the icon darkens slightly | [ ] |
| 2.5 | Click a few nav items | The blue highlight + left bar **moves to the page you're on** each time | [ ] |
| 2.6 | Look at the bottom of the sidebar | A **circular avatar with your initials** (blue→indigo gradient), your name + email, a small **role pill** ("Owner admin" / "Staff admin"), and a **"Sign out"** button with a door/exit icon | [ ] |
| 2.7 | Open a long page (e.g. **Audit log** or **Students**) and scroll down | The **sidebar stays in place** (sticky) while the content scrolls | [ ] |
| 2.8 | Watch the very top of the screen when you click a nav link | A thin **blue loading bar** sweeps across the top | [ ] |

---

## 3) Overview page  →  http://localhost:3000/  (the "Overview" item)

| # | Do this | You should see | Result |
|---|---------|----------------|--------|
| 3.1 | Look at the 8 stat cards | Two rows of cards; the big numbers are **blue** (top row) and **violet** (bottom row) | [ ] |
| 3.2 | Hover one stat card | It **lifts slightly**, gains a **shadow**, and the border turns light **blue** | [ ] |
| 3.3 | Look at the numbers | Digits are evenly spaced (tabular) and crisp | [ ] |
| 3.4 | Look at "Recent activity" | A card with a clean header and a row per event | [ ] |
| 3.5 | Hover an activity row | The row gets a faint highlight | [ ] |
| 3.6 | The "View audit log →" link | It's **blue**; hovering underlines it | [ ] |

---

## 4) Buttons, tables & menus  →  http://localhost:3000/students

| # | Do this | You should see | Result |
|---|---------|----------------|--------|
| 4.1 | Find "+ New student" | A **blue** filled button with a subtle shadow; hover makes it slightly darker | [ ] |
| 4.2 | Find "Import CSV" | An **outline** (white/bordered) button next to it | [ ] |
| 4.3 | Use the search box / status filter | Field shows a **blue focus ring** when clicked; filtering still works | [ ] |
| 4.4 | Look at the students table | Status pills are still colored (green = Active, amber = Pending, red = Suspended); rows highlight on hover | [ ] |
| 4.5 | Open a row-action menu (e.g. a student's "⋯" / action dropdown, where one exists) | The hovered menu item shows **blue text on a faint blue background** | [ ] |

---

## 5) Click-through of every section (nothing broken)

Visit each and confirm the page **loads with content** (no blank page, no error). The active sidebar highlight should follow you.

- [ ] Overview · `/`
- [ ] Students · `/students`
- [ ] Teachers · `/teachers`
- [ ] Admins · `/admins` *(owner only)*
- [ ] Batches · `/batches`  → open one batch
- [ ] Courses · `/courses`  → open one course
- [ ] Attendance · `/attendance`
- [ ] Content · `/content`
- [ ] Quizzes · `/quizzes`
- [ ] Exams · `/exams`
- [ ] Offline scores · `/offline-scores`
- [ ] Question bank · `/questions`
- [ ] Audit log · `/audit`

---

## 6) Functionality still works (regression spot-check)

These confirm I didn't break behaviour while restyling.

| # | Do this | Expected | Result |
|---|---------|----------|--------|
| 6.1 | Open "+ New student" form | Form opens, fields editable, validation works as before | [ ] |
| 6.2 | Open a dialog/sheet somewhere (e.g. "New batch", "Assign batch") | It opens, looks clean, and closes with the X / Close | [ ] |
| 6.3 | Use a filter or search | Results update correctly | [ ] |
| 6.4 | Click **Sign out** | You're signed out and returned to `/login` | [ ] |
| 6.5 | Press **F12 → Console** tab while clicking around | **No red errors** appear | [ ] |

---

## 7) Responsive / mobile (NEW — phones, tablets, all screen sizes)

**How to test on a computer:** press **F12** to open DevTools, then click the **device toolbar** icon (📱, top-left of the panel, or **Ctrl+Shift+M**). Pick "iPhone SE", "iPhone 14 Pro", "iPad", "Galaxy S20", or drag the edge to any width. Or just **resize the browser window** narrow → wide.

| # | Width / device | You should see | Result |
|---|----------------|----------------|--------|
| 7.1 | **Phone (≤ ~760px)** | The left sidebar is **hidden**; instead there's a **top bar** with the logo on the left and a **☰ hamburger** button on the right | [ ] |
| 7.2 | Tap the **☰ hamburger** | The sidebar **slides in from the left** as a drawer, with a dark dimmed background behind it | [ ] |
| 7.3 | In the open drawer | Same nav (icons + active highlight) + your account footer + Sign out — all present | [ ] |
| 7.4 | Tap a nav item in the drawer | It navigates **and the drawer closes by itself** | [ ] |
| 7.5 | Tap the **✕** or the dark area outside the drawer | The drawer closes | [ ] |
| 7.6 | On a list page (e.g. Students) on a phone | Page heading and buttons **stack vertically** (don't overflow); the table can be **swiped left/right** to see all columns (nothing is cut off the screen) | [ ] |
| 7.7 | Whole page on a phone | **No sideways scrolling of the entire page** — only tables scroll sideways inside their own box | [ ] |
| 7.8 | **Tablet (~760–1024px)** | Sidebar reappears on the left; content fills the rest | [ ] |
| 7.9 | **Desktop (≥ ~1024px)** | Looks exactly like before (240px sidebar + content) — unchanged | [ ] |
| 7.10 | Rotate the phone / resize slowly | Layout adapts smoothly with no broken/overlapping pieces at any width | [ ] |
| 7.11 | Scroll a long page (e.g. Audit) | Scrollbar is **thin and rounded** (not the chunky default); page doesn't "jump" sideways when scrollbar appears | [ ] |

> The breakpoint is **768px** (Tailwind `md`). At/above it = desktop sidebar; below it = mobile top bar + drawer.

---

## 7b) Loading / page-transition animation (NEW)

| # | Do this | You should see | Result |
|---|---------|----------------|--------|
| 7b.1 | Click between nav items a few times | Each new page's content **fades and slides up gently** as it appears (not a hard snap) | [ ] |
| 7b.2 | Watch the very top while a page loads | The thin **blue progress bar** sweeps across | [ ] |
| 7b.3 | **See the skeleton:** open **F12 → Network tab → throttling dropdown → "Slow 3G"**, then click a list page (e.g. Audit, Students) | A **shimmering grey placeholder** (stacked bars with a light sweep moving across) shows while it loads, then real content flows in | [ ] |
| 7b.4 | Turn throttling back to "No throttling" and click around fast | **No flickering/flashing** of the placeholder on quick loads — it only appears if a load actually takes a moment | [ ] |

> The placeholder is intentionally hidden for ~0.18s so fast loads don't flash it (that flash was the old "jittery" feeling).

---

## 8) Things that would mean SOMETHING IS WRONG (report these)

- ❌ Logo missing / shows a broken-image icon.
- ❌ Buttons/links are black/gray instead of blue.
- ❌ Text suddenly looks like a different/uglier font or shifts oddly.
- ❌ Any page is blank, throws an error, or won't load.
- ❌ Sidebar nav, sign-out, search, filters, or forms stop working.
- ❌ Layout collapses, columns overlap, or content overflows the screen.
- ❌ On a phone: no hamburger menu, OR the drawer won't open/close, OR the whole page scrolls sideways.

---

## Result summary

| Section | Pass? | Notes |
|---------|-------|-------|
| 0 · Sign-in | | |
| 1 · Forbidden | | |
| 2 · Sidebar | | |
| 3 · Overview | | |
| 4 · Buttons/tables/menus | | |
| 5 · All sections load | | |
| 7 · Responsive / mobile | | |
| 6 · Functionality | | |

**Overall:** ☐ Looks good, ship it  ·  ☐ Needs changes (listed above)

---

### How to stop the dev server when done
Tell me "stop the server", or press **Ctrl + C** in the terminal that's running it.
