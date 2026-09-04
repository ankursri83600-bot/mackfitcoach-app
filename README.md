# MackFitCoach

Gym diet and body-transformation coaching site. Generates a personalised 7-day
Indian diet chart from a visitor's own numbers, sells coaching plans through
Razorpay, and books 1-to-1 sessions with a WhatsApp handoff.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase · Razorpay

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3100
```

The site runs with **no credentials at all**. Auth, payments and booking each
degrade to a clearly-labelled notice, and the diet engine works fully offline.

```bash
npm run build && npm start   # production
npm test                     # diet engine suite (49 tests)
npx tsc --noEmit             # type check
```

## Enabling the backend

Copy `.env.local.example` to `.env.local` and fill it in.

### 1. Supabase

Apply the migrations **in order** in the Supabase SQL editor (or via
`supabase db push`):

| File | What it adds |
| --- | --- |
| `0001_init.sql` | enums, `profiles`, role helpers, role-escalation guard |
| `0002_intake_plans.sql` | `diet_requests`, `diet_plans`, guest-claim RPC |
| `0003_orders_razorpay.sql` | `orders`, `payment_events`, `entitlements`, settlement RPCs |
| `0004_coaches_bookings.sql` | coaches, availability, `bookings`, `book_slot` |
| `0005_transformations.sql` | gallery table + storage buckets |

Run them in the SQL editor rather than through PostgREST: `0001` creates a
trigger on `auth.users`, which needs an owner of the auth schema.

Then seed the coaches:

```bash
npm run seed:coaches
```

To make yourself an admin, run this once in the SQL editor:

```sql
update profiles set role = 'admin' where id = '<your-auth-user-id>';
```

### 2. Razorpay

Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `NEXT_PUBLIC_RAZORPAY_KEY_ID`
(the same value as the key id). Then create a webhook in the Razorpay dashboard:

- URL: `https://your-domain/api/razorpay/webhook`
- Secret: whatever you set as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.created`

For local testing, tunnel the webhook (`cloudflared tunnel --url http://localhost:3100`).
Any tunnel that rewrites the request body will break signature verification.

---

## How the money path works

The client only ever sends a **tier slug**. Everything else is server-decided.

1. `POST /api/razorpay/create-order` — resolves the price from
   `src/lib/data/content.ts` (any client-supplied amount is never even read),
   creates the Razorpay order, and inserts a `created` order row.
2. Razorpay Checkout opens in the browser.
3. `POST /api/razorpay/verify` — verifies the HMAC, then **re-fetches the payment
   from Razorpay** because the browser's amount is not trustworthy. This is a UX
   fast-path only.
4. `POST /api/razorpay/webhook` — the **source of truth**. Reads the raw body
   before parsing (re-serialising would break the digest), is idempotent via a
   `payment_events` ledger, and returns `200` even for permanently-refused events
   so Razorpay does not retry something that can never succeed.

`mark_order_paid` is idempotent and **refuses to settle on an amount or currency
mismatch**, parking the order in `mismatch` for the admin to reconcile. A refund
revokes the entitlement, so a refunded customer does not keep the plan.

## Entitlements and the paywall

`src/lib/entitlements.ts` is the single place access is decided, and it answers
two separate questions: *may this caller see the plan at all* (owner, matching
guest claim token, or staff) and *may they see days 2–7* (a live `full_plan`
entitlement, or staff). The plan page, the print route and the PDF route all call
it, so the paywall cannot drift between them — a downloadable file is not a
loophole.

Without Razorpay configured, `?unlocked=1` acts as a demo unlock. It is ignored
entirely once payments are live.

## The diet engine

`src/lib/diet/` is pure TypeScript — no React, no network, no `Math.random`, no
`Date.now`. The same intake always produces a byte-identical plan, which matters
because plans are persisted and re-rendered after payment.

- BMI on both WHO and Asian-Indian scales (overweight from 23, which is what
  applies here), BMR via Mifflin-St Jeor, TDEE, goal-adjusted target.
- **Hard calorie floors** (1200 kcal female / 1500 male). When the floor binds,
  the plan says so rather than shipping a starvation target.
- Vegan excludes dairy and eggs; non-veg puts meat on *only* the weekdays the
  user picked, and every other day is built from the vegetarian pool.
- Where a target cannot be met from the available food, the plan emits a warning
  instead of quietly falling short.

`npm test` covers determinism, allergen exclusion, veg-day purity, portion
bounds, calorie convergence and the food table's internal consistency.

## Booking

Availability is declarative (weekday + window); slots are derived; only bookings
are materialised. The double-booking guard is a **partial unique index** on
`(coach_id, slot_date, slot_start)` — the insert *is* the check, so there is no
check-then-insert race. Two concurrent requests cannot both win; the loser gets
`23505`, which the route maps to `409`.

Coach phone numbers live in a separate `coach_contacts` table because RLS is
row-level, not column-level: a public `coaches.phone` column would expose every
coach's mobile to anyone holding the anon key. The number is read server-side and
only ever leaves as part of a `wa.me` link, for a booking the caller owns.

## Brand assets

```bash
npm run brand          # regenerate from the source logo
npm run placeholders   # regenerate sample images
```

`scripts/build-brand-assets.mjs` cuts the badge out of its black square with a
flood fill from the border, guarded by a radius so the fill cannot leak into the
artwork's interior blacks, then emits every size plus favicon, PWA icons and the
OG card.

## Known gaps

- The transformations gallery ships **labelled sample figures**, not real
  clients. The RLS policy requires both `is_published` and `consent_on_file`, so
  real photos cannot go live until consent is recorded.
- `src/lib/rate-limit.ts` is per-instance. Move it to Postgres or Upstash before
  running more than one server.
- The `transformations` storage bucket is public, so an unpublished draft is
  reachable by object key. Uploads use random UUID keys; switch to signed URLs if
  drafts must be truly private.
- Admin has read + status actions and publish/unpublish. Full CRUD for coaches
  and transformations is still done in the Supabase table editor.
