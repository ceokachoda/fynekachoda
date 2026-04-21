# Phase 06 — Membership, Payments & Access Control

## Goal

Make "is this student allowed to access this content right now?" a first-class, centrally enforced question, and wire Razorpay for payment + auto-renewal of memberships.

## Why this phase exists

Membership gating is the monetization layer. It has to be correct at the database edge (RLS + signed URLs), not just hidden in the UI. Payment itself is lower-priority for the client demo (we can pre-mark every demo student as active), but the gating plumbing is used by every other phase, so it lands here in a coordinated way.

## Scope

### In-scope
- Plans catalog (monthly, quarterly, half-yearly, yearly, course-wise).
- Membership record per student with explicit start/expiry.
- Enforcement surface: `has_active_membership(user_id)` used by RLS + Edge Functions.
- Razorpay integration: order creation, checkout, webhook, success/failure states.
- Invoices generated from `payments` + plan info; downloadable PDF.
- Membership renewal UI with Razorpay Checkout (WebView).
- Admin manual override: mark paid/unpaid, extend expiry, waive fees.
- Expiry reminders (inserted into `notifications` table; fanout in P8).
- Grace period (7 days) where access continues but UI warns.

### Out-of-scope
- Recurring auto-debit via mandate/UPI AutoPay (complex KYC; defer to post-launch).
- Refund workflow (manual via admin + Razorpay dashboard for now).
- Proration when switching plans mid-cycle.
- Coupon codes / discount engine.

## User roles impacted
- Student: see plan status, pay/renew, download invoices.
- Admin: configure plans, override memberships, view payment history.
- Teacher: unaffected (no payment).

## Screens to build

### Student (RN)
- `/(app)/(tabs)/membership` — current plan, expiry countdown, "Renew" CTA, payment history list, invoice download.
- `/(app)/membership/plans` — plan picker.
- `/(app)/membership/checkout` — Razorpay Checkout WebView.
- `/(app)/membership/success` — success state.

### Admin (Next.js)
- `/admin/plans` — CRUD plans.
- `/admin/memberships` — list students with filter by status; override actions.
- `/admin/payments` — audit table, manual reconciliation.

## Payment provider recommendation

**Razorpay (India-focused).**

| Concern | Razorpay | Stripe India | PayU India |
|---|---|---|---|
| UPI / Netbanking coverage | ✅ | ⚠️ limited | ✅ |
| Developer experience | Excellent | Excellent | Poor |
| Webhook reliability | ✅ | ✅ | Mixed |
| INR settlement | ✅ | Requires entity in India | ✅ |
| SDKs (React Native) | ✅ official | Partial | ❌ |
| Pricing | ~2% + GST | ~2-3% | Competitive |

**Decision: Razorpay.** Use Razorpay Checkout Standard (prebuilt UI) via `react-native-razorpay` on mobile and `react-razorpay` in the admin (admin rarely initiates payments but good for manual "resend link").

## Frontend tasks

### Student membership tab
- [ ] Header card with gradient, days remaining, plan name, next renewal date.
- [ ] If expired or ≤7 days left: orange/red state + prominent Renew CTA.
- [ ] Payment history list from `payments` table.
- [ ] Tap an invoice → Edge Function returns signed URL to generated PDF.

### Checkout flow
- [ ] Plan picker → creates Razorpay order via Edge Function `create-razorpay-order`.
- [ ] Launch Razorpay Checkout SDK with order id and prefill name/email/phone.
- [ ] On success callback, call `verify-razorpay-payment` Edge Function with `{ order_id, payment_id, signature }`.
- [ ] Edge Function verifies HMAC signature, updates `payments.status='paid'`, extends/creates membership, inserts notification.
- [ ] Client waits for realtime event `memberships` row update; navigates to success screen.
- [ ] Webhook is the source of truth even if client navigates away.

### Access control UI
- [ ] Any locked content shows a lock badge + "Active membership required" microcopy with Renew CTA.
- [ ] Lock detection is centralized: `useHasAccess(contentId)` hook.

## Backend tasks

### Schema additions
```sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,     -- MONTHLY, QUARTERLY, YEARLY, PHYSICS_6M
  name text not null,
  duration_days int not null,
  amount_inr numeric(10,2) not null,
  features jsonb default '{}',
  is_active boolean not null default true
);

-- memberships already exists; confirm structure:
alter table memberships
  add column plan_id uuid references plans(id),
  add column razorpay_subscription_id text,
  add column status text not null default 'inactive'; -- active|expired|canceled|pending

alter table payments
  add column razorpay_order_id text,
  add column razorpay_payment_id text,
  add column razorpay_signature text,
  add column invoice_pdf_path text;

create index on memberships (student_id, status);
create index on payments (student_id, paid_at desc);
```

### Core helper
```sql
create or replace function has_active_membership(uid uuid)
returns boolean
language sql stable as $$
  select exists(
    select 1 from memberships
    where student_id = uid
      and status = 'active'
      and expires_at >= now() - interval '7 days'  -- 7-day grace
  );
$$;
```

This function is the single enforcement point used by RLS policies on `classes` view, `content_items` (for membership_only visibility), live token issuance, and signed URL issuance.

### Edge Functions
- `create-razorpay-order` — student-authenticated; creates Razorpay order, inserts `payments(status='pending')`.
- `verify-razorpay-payment` — verifies signature; updates payment; extends membership transactionally; inserts notification; returns new membership.
- `razorpay-webhook` — secondary safety net; handles `payment.captured`, `payment.failed`, `subscription.charged` (future).
- `generate-invoice-pdf` — on payment success; renders HTML → PDF (via an external service like APITemplate.io or a small Chromium-based Cloudflare Worker); uploads to `invoices` bucket.
- `send-expiry-reminders` — pg_cron daily; for memberships expiring in 7/3/1 days, insert notifications.
- `enforce-expiry` — pg_cron daily; flip memberships past expiry+grace to `expired`.

### Transactional membership extension
On successful payment, renew semantics:
- If current membership `expires_at >= now()`: new `expires_at = current expires_at + plan.duration_days`.
- If expired: new `expires_at = now() + plan.duration_days`.
- Upsert the same `memberships` row (stable per student) with `status='active'`.

## Database / data model needs
See above. `plans` new; `payments` + `memberships` extended.

## APIs / services needed
See `API-DESIGN-AND-SERVICE-BOUNDARIES.md` §Payments.

## Third-party integrations
- **Razorpay** — orders, checkout, webhooks.
- **APITemplate.io** or self-hosted Chromium for PDF invoice rendering (optional; MVP can ship text-only invoice).

## Recommended libraries
| Purpose | Package |
|---|---|
| Checkout (RN) | `react-native-razorpay` |
| Checkout (Web) | `react-razorpay` |
| Signature verify (Edge) | Deno `std/crypto` HMAC-SHA256 |

## Edge cases
- Double-tap "Pay" → idempotent Razorpay order: use local `payments.id` as receipt. Retry safe.
- Webhook arrives before client verify call (and vice versa) → handle via row locking; whichever finalizes first wins; the other is a no-op.
- Payment success but network dies before client sees it → user reopens app; realtime `memberships` subscription surfaces the fresh status.
- Student pays then contests → admin marks membership `status='canceled'` manually.
- Membership expired at midnight but student is mid-live-class → grace-period check lets them finish; new joins fail.
- Time zone bug → all timestamps `timestamptz`, display in IST, compute in UTC.

## Risks
| Risk | Mitigation |
|---|---|
| Race between webhook and client verify | Both paths idempotent; use `insert ... on conflict do nothing`. |
| Incorrect signature verification (classic vulnerability) | Use official Razorpay algo; unit test with known Razorpay sample payloads; log all verification failures. |
| User pays for "expired" plan (plan archived) | Plans have `is_active`; client only shows active; backend rejects inactive plan in `create-razorpay-order`. |

## Dependencies on earlier phases
- Phase 1 (schema).
- Phases 4 and 5 (content to gate).

## Acceptance criteria
- [ ] Seeded student with no active membership is blocked from joining live class and from fetching membership-only materials.
- [ ] Student taps Renew, completes Razorpay test-mode checkout, and membership becomes active within 3s.
- [ ] Webhook-only path (simulate network loss on client) still activates membership.
- [ ] Admin can manually extend/override membership.
- [ ] Expired memberships flip to `expired` after the daily cron runs.
- [ ] Invoice PDF downloads and shows plan, amount, dates, student name.

## Definition of done
- All acceptance criteria.
- Unit tests cover signature verification success + 3 failure modes.
- Load test: 50 concurrent payment verifications complete <2s p95.
- Finance sanity: every paid payment has exactly one membership change and one notification.
- Documentation for admin: "How to reconcile failed payments" runbook.

## Suggested folder / module breakdown

```
apps/mobile/src/features/membership/
├── screens/
│   ├── MembershipScreen.tsx
│   ├── PlansScreen.tsx
│   ├── CheckoutScreen.tsx
│   └── SuccessScreen.tsx
├── components/
│   ├── MembershipCard.tsx
│   ├── PlanCard.tsx
│   └── LockOverlay.tsx
├── hooks/
│   ├── useMembership.ts
│   ├── usePlans.ts
│   └── useCheckout.ts
└── api.ts

apps/admin/app/(panel)/memberships/
apps/admin/app/(panel)/plans/
apps/admin/app/(panel)/payments/

supabase/functions/
├── create-razorpay-order/
├── verify-razorpay-payment/
├── razorpay-webhook/
├── generate-invoice-pdf/
├── send-expiry-reminders/
└── enforce-expiry/
```

## Suggested order of implementation

1. Schema: `plans`, membership/payment extensions; `has_active_membership()`; seed 3 plans.
2. Apply RLS updates so `membership_only` content and live tokens check the helper.
3. Admin plans CRUD.
4. `create-razorpay-order` + test with Razorpay test keys.
5. Student plan picker + checkout launch.
6. `verify-razorpay-payment` + transactional membership extension.
7. `razorpay-webhook` safety net + idempotency tests.
8. Expiry reminders + daily enforcement cron.
9. Admin manual override UI.
10. Invoice PDF generator (optional for demo).
11. Lock overlays in student app on gated content.
12. E2E: expired student → pay → access restored within one session.
