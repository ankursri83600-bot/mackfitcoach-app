-- =============================================================================
-- MackFitCoach — complete schema, all migrations concatenated in order.
--
-- HOW TO APPLY
--   1. Open the Supabase SQL editor:
--      https://supabase.com/dashboard/project/qsahrrduyngkxhhyiebm/sql/new
--   2. Paste this entire file and press Run.
--
-- Run it here rather than through the API: it creates a trigger on auth.users,
-- which requires an owner of the auth schema.
--
-- Every statement is idempotent, so re-running this file is safe.
--
-- Verified before shipping: all of this applies cleanly to a real PostgreSQL 18
-- instance, and the payment/booking guarantees are probed by
--   npm run test:db
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 0001_init.sql
-- ─────────────────────────────────────────────────────────────────────────

-- 0001_init.sql — extensions, enums, profiles, role helpers.
-- Idempotent: safe to re-run.

-- No `create extension pgcrypto` here on purpose: the only thing we needed it
-- for is gen_random_uuid(), which has been in Postgres core since 13. Requiring
-- the extension adds a privilege dependency for nothing.

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin create type user_role as enum ('user','dietician','trainer','admin');
exception when duplicate_object then null; end $$;

do $$ begin create type gender_t as enum ('male','female');
exception when duplicate_object then null; end $$;

do $$ begin create type activity_level as enum ('sedentary','light','moderate','active','athlete');
exception when duplicate_object then null; end $$;

do $$ begin create type goal_t as enum ('fat_loss','muscle_gain','maintenance');
exception when duplicate_object then null; end $$;

do $$ begin create type diet_pref as enum ('vegan','vegetarian','non_veg');
exception when duplicate_object then null; end $$;

-- ── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ── Role helpers ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER is load-bearing: without it, every policy that reads
-- `profiles` recurses into profiles' own RLS and errors at query time.
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin','dietician','trainer')
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- ── Role-escalation guard ────────────────────────────────────────────────────
-- A trigger rather than a `with check` on the policy: comparing against
-- `(select role from profiles where id = auth.uid())` inside a profiles policy
-- re-enters the same table's RLS. Silently reverting also leaks nothing about
-- who is or isn't an admin.
create or replace function public.freeze_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists profiles_freeze_role on profiles;
create trigger profiles_freeze_role before update on profiles
  for each row execute function public.freeze_profile_role();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

drop policy if exists "read own profile or staff reads all" on profiles;
create policy "read own profile or staff reads all" on profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- 0002_intake_plans.sql
-- ─────────────────────────────────────────────────────────────────────────

-- 0002_intake_plans.sql — intake submissions and generated diet plans.

do $$ begin create type diet_request_status as enum ('submitted','plan_generated','archived');
exception when duplicate_object then null; end $$;

-- ── Intake ───────────────────────────────────────────────────────────────────
create table if not exists diet_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  -- Guests can generate a plan before signing up. The token is the bearer proof
  -- for that plan until an account claims it.
  claim_token     text,

  full_name       text,
  email           text,
  phone           text,

  age             int not null check (age between 15 and 90),
  gender          gender_t not null,
  height_cm       numeric(5,1) not null check (height_cm between 120 and 220),
  weight_kg       numeric(5,1) not null check (weight_kg between 30 and 250),
  activity        activity_level not null,
  goal            goal_t not null,
  diet_type       diet_pref not null,
  -- 0 = Monday .. 6 = Sunday, matching the engine's Weekday type (NOT getDay()).
  nonveg_days     smallint[] not null default '{}',
  exclude_tags    text[] not null default '{}',
  exclude_food_ids text[] not null default '{}',
  meals_per_day   smallint not null check (meals_per_day between 3 and 6),
  medical_notes   text,

  -- Computed once by lib/diet/metrics and stored so a plan stays auditable.
  bmi             numeric(4,1) not null,
  bmi_category    text not null,
  bmr_kcal        int not null check (bmr_kcal > 0),
  tdee_kcal       int not null check (tdee_kcal > 0),
  target_kcal     int not null check (target_kcal >= 1000),
  protein_g       int not null,
  carbs_g         int not null,
  fat_g           int not null,

  status          diet_request_status not null default 'submitted',
  created_at      timestamptz not null default now(),

  constraint diet_requests_nonveg_days_valid
    check (nonveg_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  -- A non-meat diet must not carry meat days.
  constraint diet_requests_nonveg_only_when_nonveg
    check (diet_type = 'non_veg' or cardinality(nonveg_days) = 0),
  constraint diet_requests_has_owner
    check (user_id is not null or claim_token is not null)
);

create index if not exists diet_requests_user_idx on diet_requests (user_id, created_at desc);
create unique index if not exists diet_requests_claim_token_idx
  on diet_requests (claim_token) where claim_token is not null;

-- ── Plans ────────────────────────────────────────────────────────────────────
-- The full plan is stored as JSONB rather than normalised into day/meal tables.
-- It is generated deterministically from the intake row and is only ever read
-- whole, so splitting it across three tables would add joins and RLS surface
-- for no benefit. Day-level gating is enforced in the API layer, which slices
-- the JSON before it ever reaches an unentitled client.
create table if not exists diet_plans (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references diet_requests(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  claim_token      text,
  engine_version   text not null,
  seed             bigint not null,
  plan_json        jsonb not null,
  coach_notes      text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists diet_plans_request_idx on diet_plans (request_id);
create index if not exists diet_plans_user_idx on diet_plans (user_id, created_at desc);
create unique index if not exists diet_plans_one_active
  on diet_plans (request_id) where is_active;
create unique index if not exists diet_plans_claim_token_idx
  on diet_plans (claim_token) where claim_token is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table diet_requests enable row level security;
alter table diet_plans enable row level security;

-- Guest rows are readable only via the server (service role), which checks the
-- claim token. There is deliberately no anon SELECT policy: a bare anon key must
-- not be able to enumerate other people's health data.
drop policy if exists "own requests" on diet_requests;
create policy "own requests" on diet_requests
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "staff update requests" on diet_requests;
create policy "staff update requests" on diet_requests
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "own plans" on diet_plans;
create policy "own plans" on diet_plans
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "staff write plans" on diet_plans;
create policy "staff write plans" on diet_plans
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Claim a guest plan on sign-up ────────────────────────────────────────────
create or replace function public.claim_diet_request(
  p_user_id uuid,
  p_claim_token text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_request_id uuid;
begin
  update diet_requests
     set user_id = p_user_id, claim_token = null
   where claim_token = p_claim_token and user_id is null
   returning id into v_request_id;

  if v_request_id is null then
    return null;
  end if;

  update diet_plans
     set user_id = p_user_id, claim_token = null
   where request_id = v_request_id;

  return v_request_id;
end; $$;

revoke all on function public.claim_diet_request(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_diet_request(uuid, text) to service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- 0003_orders_razorpay.sql
-- ─────────────────────────────────────────────────────────────────────────

-- 0003_orders_razorpay.sql — orders, webhook ledger, entitlements.
-- All money is integer paise. Never rupees, never floats.

do $$ begin create type order_status as enum
  ('created','attempted','paid','failed','refunded','cancelled','mismatch');
exception when duplicate_object then null; end $$;

do $$ begin create type entitlement_scope as enum ('full_plan','consult','trainer');
exception when duplicate_object then null; end $$;

create table if not exists orders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete set null,
  diet_request_id      uuid references diet_requests(id) on delete set null,
  email                text not null,
  phone                text,
  tier_slug            text not null,
  -- Snapshot so the record survives a later catalogue edit.
  tier_name_snapshot   text not null,
  amount_paise         int not null check (amount_paise > 0),
  currency             text not null default 'INR' check (currency = 'INR'),
  status               order_status not null default 'created',
  razorpay_order_id    text,
  razorpay_payment_id  text,
  -- Set when a capture disagrees with what we asked for; surfaced in /admin.
  reconciliation_error text,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists orders_rzp_order_idx
  on orders (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists orders_rzp_payment_idx
  on orders (razorpay_payment_id) where razorpay_payment_id is not null;
create index if not exists orders_user_idx on orders (user_id, created_at desc);
create index if not exists orders_status_idx on orders (status, created_at desc);

-- Webhook idempotency ledger plus a full audit trail of what Razorpay told us.
create table if not exists payment_events (
  id                  uuid primary key default gen_random_uuid(),
  razorpay_event_id   text not null,
  event               text not null,
  order_id            uuid references orders(id) on delete set null,
  payload             jsonb not null,
  handled             boolean not null default false,
  handler_error       text,
  created_at          timestamptz not null default now()
);
create unique index if not exists payment_events_event_id_idx
  on payment_events (razorpay_event_id);

create table if not exists entitlements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  diet_request_id uuid references diet_requests(id) on delete set null,
  tier_slug       text not null,
  scope           entitlement_scope not null,
  consults_total  int not null default 0,
  consults_used   int not null default 0,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (order_id, scope),
  check (consults_used <= consults_total)
);
create index if not exists entitlements_user_idx
  on entitlements (user_id, scope) where revoked_at is null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table orders enable row level security;
alter table payment_events enable row level security;
alter table entitlements enable row level security;

drop policy if exists "own orders" on orders;
create policy "own orders" on orders
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "own entitlements" on entitlements;
create policy "own entitlements" on entitlements
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "admins read events" on payment_events;
create policy "admins read events" on payment_events
  for select using (public.is_admin());
-- No insert/update policies anywhere: every write goes through a service-role RPC.

-- ── Entitlement check ────────────────────────────────────────────────────────
create or replace function public.has_full_plan_access(p_request_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from entitlements e
    where e.scope = 'full_plan'
      and e.user_id = auth.uid()
      and (e.diet_request_id is null or e.diet_request_id = p_request_id)
      and e.revoked_at is null
      and (e.expires_at is null or e.expires_at > now())
  );
$$;
grant execute on function public.has_full_plan_access(uuid) to authenticated;

-- ── Create a pending order ───────────────────────────────────────────────────
create or replace function public.create_order_record(
  p_user_id           uuid,
  p_email             text,
  p_phone             text,
  p_tier_slug         text,
  p_tier_name         text,
  p_amount_paise      int,
  p_razorpay_order_id text,
  p_diet_request_id   uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid();
begin
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'invalid amount';
  end if;

  -- A request may only be attached to an order by its own owner.
  if p_diet_request_id is not null and p_user_id is not null
     and not exists (select 1 from diet_requests r
                     where r.id = p_diet_request_id and r.user_id = p_user_id) then
    raise exception 'diet request does not belong to purchaser';
  end if;

  insert into orders (id, user_id, diet_request_id, email, phone, tier_slug,
                      tier_name_snapshot, amount_paise, currency, status,
                      razorpay_order_id)
  values (v_id, p_user_id, p_diet_request_id, lower(trim(p_email)), p_phone,
          p_tier_slug, p_tier_name, p_amount_paise, 'INR', 'created',
          p_razorpay_order_id);
  return v_id;
end; $$;

-- ── Settle a payment ─────────────────────────────────────────────────────────
-- Idempotent, and refuses to settle on an amount or currency mismatch. Both
-- /verify and the webhook call this, so whichever lands first wins and the
-- second is a no-op.
--
-- Returns the order id on success and NULL on a refused mismatch.
--
-- It deliberately does NOT raise on a mismatch: RAISE rolls back the whole
-- function, which would undo the very UPDATE that parks the order in
-- 'mismatch' for reconciliation. Verified: with RAISE, a mismatched order
-- stayed 'created' and never appeared in the admin queue. A mismatch is an
-- expected business outcome, so it is returned, not thrown.
create or replace function public.mark_order_paid(
  p_razorpay_order_id   text,
  p_razorpay_payment_id text,
  p_amount_paise        int,
  p_currency            text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order    orders%rowtype;
  v_weeks    int;
  v_consults int;
  v_trainer  boolean;
begin
  -- Lock the row: verify and webhook can arrive concurrently.
  select * into v_order from orders
   where razorpay_order_id = p_razorpay_order_id for update;

  if not found then
    raise exception 'no order for razorpay order %', p_razorpay_order_id;
  end if;

  if v_order.status = 'paid' then
    return v_order.id;
  end if;

  if v_order.amount_paise <> p_amount_paise then
    update orders set status = 'mismatch',
      reconciliation_error = format('captured %s paise, expected %s paise',
                                    p_amount_paise, v_order.amount_paise),
      razorpay_payment_id = coalesce(razorpay_payment_id, p_razorpay_payment_id),
      updated_at = now()
    where id = v_order.id;
    return null;
  end if;

  if upper(coalesce(p_currency,'INR')) <> upper(v_order.currency) then
    update orders set status = 'mismatch',
      reconciliation_error = format('captured currency %s, expected %s',
                                    p_currency, v_order.currency),
      razorpay_payment_id = coalesce(razorpay_payment_id, p_razorpay_payment_id),
      updated_at = now()
    where id = v_order.id;
    return null;
  end if;

  update orders
     set status = 'paid',
         razorpay_payment_id = p_razorpay_payment_id,
         reconciliation_error = null,
         paid_at = now(), updated_at = now()
   where id = v_order.id;

  -- Tier -> entitlement mapping lives here so a paid order can never end up
  -- entitlement-less. Keep in sync with src/lib/data/content.ts.
  v_weeks    := case v_order.tier_slug when 'starter' then 2  when 'pro' then 6 else 16 end;
  v_consults := case v_order.tier_slug when 'starter' then 0  when 'pro' then 2 else 4 end;
  v_trainer  := v_order.tier_slug = 'elite';

  insert into entitlements (user_id, order_id, diet_request_id, tier_slug, scope,
                            consults_total, expires_at)
  values (v_order.user_id, v_order.id, v_order.diet_request_id, v_order.tier_slug,
          'full_plan', 0, now() + make_interval(weeks => v_weeks))
  on conflict (order_id, scope) do nothing;

  if v_consults > 0 then
    insert into entitlements (user_id, order_id, diet_request_id, tier_slug, scope,
                              consults_total, expires_at)
    values (v_order.user_id, v_order.id, v_order.diet_request_id, v_order.tier_slug,
            'consult', v_consults, now() + make_interval(weeks => v_weeks))
    on conflict (order_id, scope) do nothing;
  end if;

  if v_trainer then
    insert into entitlements (user_id, order_id, diet_request_id, tier_slug, scope,
                              consults_total, expires_at)
    values (v_order.user_id, v_order.id, v_order.diet_request_id, v_order.tier_slug,
            'trainer', 4, now() + make_interval(weeks => v_weeks))
    on conflict (order_id, scope) do nothing;
  end if;

  return v_order.id;
end; $$;

create or replace function public.mark_order_failed(
  p_razorpay_order_id text,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders
     set status = case when status = 'paid' then status else 'failed' end,
         reconciliation_error = p_reason,
         updated_at = now()
   where razorpay_order_id = p_razorpay_order_id;
end; $$;

-- A refunded customer must not keep the plan.
create or replace function public.mark_order_refunded(
  p_razorpay_payment_id text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_order_id uuid;
begin
  update orders set status = 'refunded', updated_at = now()
   where razorpay_payment_id = p_razorpay_payment_id
   returning id into v_order_id;

  if v_order_id is not null then
    update entitlements set revoked_at = now()
     where order_id = v_order_id and revoked_at is null;
  end if;
end; $$;

-- Returns true only when the event row was newly inserted; false means we have
-- already processed this delivery and the caller should skip it.
create or replace function public.record_payment_event(
  p_razorpay_event_id text,
  p_event             text,
  p_payload           jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_inserted boolean := false;
begin
  insert into payment_events (razorpay_event_id, event, payload)
  values (p_razorpay_event_id, p_event, p_payload)
  on conflict (razorpay_event_id) do nothing;

  -- FOUND is a PL/pgSQL special variable, so it must be ASSIGNED, not selected.
  -- `select found into v_inserted` looks plausible but raises
  -- `column "found" does not exist`, which would fail every single webhook
  -- delivery — and since the webhook is the source of truth for payments,
  -- nothing would ever settle.
  v_inserted := FOUND;
  return v_inserted;
end; $$;

-- ── Grants: server-side only ─────────────────────────────────────────────────
revoke all on function public.create_order_record(uuid,text,text,text,text,int,text,uuid) from public, anon, authenticated;
grant execute on function public.create_order_record(uuid,text,text,text,text,int,text,uuid) to service_role;

revoke all on function public.mark_order_paid(text,text,int,text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text,text,int,text) to service_role;

revoke all on function public.mark_order_failed(text,text) from public, anon, authenticated;
grant execute on function public.mark_order_failed(text,text) to service_role;

revoke all on function public.mark_order_refunded(text) from public, anon, authenticated;
grant execute on function public.mark_order_refunded(text) to service_role;

revoke all on function public.record_payment_event(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_payment_event(text,text,jsonb) to service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- 0004_coaches_bookings.sql
-- ─────────────────────────────────────────────────────────────────────────

-- 0004_coaches_bookings.sql — coaches, availability, bookings.

do $$ begin create type coach_kind as enum ('dietician','trainer');
exception when duplicate_object then null; end $$;

do $$ begin create type booking_status as enum ('requested','confirmed','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type booking_mode as enum ('whatsapp','phone','video');
exception when duplicate_object then null; end $$;

create table if not exists coaches (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  profile_id   uuid references profiles(id) on delete set null,
  name         text not null,
  kind         coach_kind not null,
  headline     text,
  bio          text,
  specialties  text[] not null default '{}',
  photo_path   text,
  timezone     text not null default 'Asia/Kolkata',
  slot_minutes int not null default 30 check (slot_minutes in (15,30,45,60)),
  -- Minimum notice before a slot can be booked.
  lead_time_minutes int not null default 120,
  max_days_ahead int not null default 30,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- Phone numbers live in their OWN table, not on `coaches`.
-- RLS is row-level, not column-level: a publicly-readable coaches.phone would
-- expose every coach's mobile number to any holder of the anon key.
create table if not exists coach_contacts (
  coach_id   uuid primary key references coaches(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email      text,
  updated_at timestamptz not null default now()
);

create table if not exists coach_availability (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references coaches(id) on delete cascade,
  -- 0 = Monday .. 6 = Sunday, matching the engine convention.
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time),
  unique (coach_id, weekday, start_time)
);

create table if not exists coach_time_off (
  id        uuid primary key default gen_random_uuid(),
  coach_id  uuid not null references coaches(id) on delete cascade,
  from_date date not null,
  to_date   date not null,
  reason    text,
  check (to_date >= from_date)
);

create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  coach_id         uuid not null references coaches(id) on delete restrict,
  entitlement_id   uuid references entitlements(id) on delete set null,
  diet_request_id  uuid references diet_requests(id) on delete set null,
  slot_date        date not null,
  slot_start       time not null,
  slot_end         time not null,
  -- Maintained by a trigger, not a generated column: the timezone cast is only
  -- STABLE (and references another table), and generated columns require
  -- IMMUTABLE, so `generated always as` fails at CREATE TABLE.
  slot_start_at    timestamptz,
  mode             booking_mode not null default 'whatsapp',
  status           booking_status not null default 'requested',
  name             text not null,
  email            text not null,
  phone            text not null,
  topic            text,
  preferred_time   text,
  confirmed_at     timestamptz,
  cancelled_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (slot_end > slot_start)
);

-- ***** THE DOUBLE-BOOKING GUARD *****
-- One live booking per coach per slot. Cancelled rows drop out of the index, so
-- cancelling frees the slot. This is atomic at the storage layer: two concurrent
-- inserts cannot both win, and the loser raises SQLSTATE 23505, which the route
-- handler maps to HTTP 409. There is no check-then-insert race because there is
-- no check — the insert IS the check.
create unique index if not exists bookings_coach_slot_unique
  on bookings (coach_id, slot_date, slot_start)
  where status in ('requested','confirmed','completed');

create index if not exists bookings_coach_date_idx on bookings (coach_id, slot_date);
create index if not exists bookings_status_idx on bookings (status, slot_start_at);
create index if not exists bookings_user_idx on bookings (user_id, created_at desc);

create or replace function public.bookings_set_start_at() returns trigger
language plpgsql set search_path = public as $$
declare v_tz text;
begin
  select timezone into v_tz from coaches where id = new.coach_id;
  new.slot_start_at := (new.slot_date + new.slot_start) at time zone coalesce(v_tz, 'Asia/Kolkata');
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists bookings_start_at on bookings;
create trigger bookings_start_at before insert or update on bookings
  for each row execute function public.bookings_set_start_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table coaches enable row level security;
alter table coach_contacts enable row level security;
alter table coach_availability enable row level security;
alter table coach_time_off enable row level security;
alter table bookings enable row level security;

drop policy if exists "public reads active coaches" on coaches;
create policy "public reads active coaches" on coaches
  for select using (is_active or public.is_staff());

drop policy if exists "admins write coaches" on coaches;
create policy "admins write coaches" on coaches
  for all using (public.is_admin()) with check (public.is_admin());

-- Staff only. Never public.
drop policy if exists "staff only contacts" on coach_contacts;
create policy "staff only contacts" on coach_contacts
  for select using (public.is_staff());

drop policy if exists "admins write contacts" on coach_contacts;
create policy "admins write contacts" on coach_contacts
  for all using (public.is_admin()) with check (public.is_admin());

-- Availability is public: it leaks the shape of the schedule but never who
-- booked what, since bookings rows stay private.
drop policy if exists "public reads availability" on coach_availability;
create policy "public reads availability" on coach_availability for select using (true);

drop policy if exists "staff write availability" on coach_availability;
create policy "staff write availability" on coach_availability
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "public reads time off" on coach_time_off;
create policy "public reads time off" on coach_time_off for select using (true);

drop policy if exists "staff write time off" on coach_time_off;
create policy "staff write time off" on coach_time_off
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "own bookings" on bookings;
create policy "own bookings" on bookings
  for select using (
    user_id = auth.uid()
    or public.is_staff()
    or exists (select 1 from coaches c where c.id = coach_id and c.profile_id = auth.uid())
  );

drop policy if exists "staff update bookings" on bookings;
create policy "staff update bookings" on bookings
  for update using (public.is_staff()) with check (public.is_staff());

-- ── Booking RPC ──────────────────────────────────────────────────────────────
-- Re-derives every constraint server-side. A client cannot POST 03:00 on a
-- Sunday just because it controls the form.
create or replace function public.book_slot(
  p_user_id         uuid,
  p_coach_id        uuid,
  p_slot_date       date,
  p_slot_start      time,
  p_mode            booking_mode,
  p_name            text,
  p_email           text,
  p_phone           text,
  p_topic           text,
  p_preferred_time  text,
  p_diet_request_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_coach    coaches%rowtype;
  v_end      time;
  v_start_at timestamptz;
  v_id       uuid := gen_random_uuid();
  v_ent      uuid;
begin
  select * into v_coach from coaches where id = p_coach_id and is_active;
  if not found then raise exception 'coach_unavailable'; end if;

  v_end := p_slot_start + make_interval(mins => v_coach.slot_minutes);
  v_start_at := (p_slot_date + p_slot_start) at time zone v_coach.timezone;

  -- 1. Inside published availability for that weekday (Mon=0 convention).
  if not exists (
    select 1 from coach_availability a
    where a.coach_id = p_coach_id
      and a.weekday = ((extract(dow from p_slot_date)::int + 6) % 7)
      and p_slot_start >= a.start_time and v_end <= a.end_time
  ) then raise exception 'slot_outside_availability'; end if;

  -- 2. On the coach's slot grid, so arbitrary times are rejected.
  if not exists (
    select 1 from coach_availability a
    where a.coach_id = p_coach_id
      and a.weekday = ((extract(dow from p_slot_date)::int + 6) % 7)
      and mod(extract(epoch from (p_slot_start - a.start_time))::int,
              v_coach.slot_minutes * 60) = 0
  ) then raise exception 'slot_off_grid'; end if;

  -- 3. Not during time off.
  if exists (select 1 from coach_time_off t
             where t.coach_id = p_coach_id
               and p_slot_date between t.from_date and t.to_date)
  then raise exception 'coach_on_leave'; end if;

  -- 4. Lead time and booking horizon.
  if v_start_at < now() + make_interval(mins => v_coach.lead_time_minutes)
  then raise exception 'slot_too_soon'; end if;
  if p_slot_date > (current_date + v_coach.max_days_ahead)
  then raise exception 'slot_too_far'; end if;

  -- 5. Consume a consult entitlement when the user has one. Not required to
  --    request a booking, but recorded when available.
  if p_user_id is not null then
    select id into v_ent from entitlements
     where user_id = p_user_id
       and scope = (case v_coach.kind when 'trainer' then 'trainer' else 'consult' end)::entitlement_scope
       and revoked_at is null
       and (expires_at is null or expires_at > now())
       and consults_used < consults_total
     order by expires_at nulls last
     limit 1 for update;
  end if;

  insert into bookings (id, user_id, coach_id, entitlement_id, diet_request_id,
                        slot_date, slot_start, slot_end, mode, status,
                        name, email, phone, topic, preferred_time)
  values (v_id, p_user_id, p_coach_id, v_ent, p_diet_request_id,
          p_slot_date, p_slot_start, v_end, p_mode, 'requested',
          p_name, lower(trim(p_email)), p_phone, p_topic, p_preferred_time);
  -- A unique-index violation (23505) propagates to the caller as 409.

  if v_ent is not null then
    update entitlements set consults_used = consults_used + 1 where id = v_ent;
  end if;

  return v_id;
end; $$;

create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status     booking_status,
  p_reason     text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_ent uuid;
begin
  if not public.is_staff() then
    raise exception 'not_authorised';
  end if;

  update bookings
     set status = p_status,
         confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
         cancelled_reason = case when p_status = 'cancelled' then p_reason else cancelled_reason end,
         updated_at = now()
   where id = p_booking_id
   returning entitlement_id into v_ent;

  -- Cancelling refunds the consult back to the entitlement.
  if p_status = 'cancelled' and v_ent is not null then
    update entitlements
       set consults_used = greatest(0, consults_used - 1)
     where id = v_ent;
  end if;
end; $$;

revoke all on function public.book_slot(uuid,uuid,date,time,booking_mode,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.book_slot(uuid,uuid,date,time,booking_mode,text,text,text,text,text,uuid) to service_role;
grant execute on function public.set_booking_status(uuid,booking_status,text) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- 0005_transformations.sql
-- ─────────────────────────────────────────────────────────────────────────

-- 0005_transformations.sql — before/after gallery and its storage buckets.

create table if not exists transformations (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  client_name     text not null,
  -- Prefer this publicly. "Rahul S." rather than a full legal name.
  display_name    text,
  goal            goal_t not null,
  weeks           int not null check (weeks > 0),
  start_weight_kg numeric(5,1),
  end_weight_kg   numeric(5,1),
  weight_change_kg numeric(5,1)
    generated always as (end_weight_kg - start_weight_kg) stored,
  before_path     text not null,
  after_path      text not null,
  testimonial     text,
  coach_id        uuid references coaches(id) on delete set null,
  -- Publishing a real client's body photos without written consent is not
  -- something the schema should make easy, so the read policy requires it.
  consent_on_file boolean not null default false,
  is_published    boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists transformations_published_idx
  on transformations (is_published, sort_order);

alter table transformations enable row level security;

drop policy if exists "public reads published with consent" on transformations;
create policy "public reads published with consent" on transformations
  for select using ((is_published and consent_on_file) or public.is_staff());

drop policy if exists "admins write transformations" on transformations;
create policy "admins write transformations" on transformations
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Storage ──────────────────────────────────────────────────────────────────
-- NOTE: a public bucket serves objects by key regardless of the row's
-- is_published flag, so an unpublished draft is reachable by anyone who knows
-- (or guesses) the key. Uploads therefore use a random UUID prefix and are never
-- overwritten. If drafts must be truly private, switch to a private bucket and
-- mint signed URLs after an is_staff() check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transformations','transformations', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-photos','coach-photos', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads brand images" on storage.objects;
create policy "public reads brand images" on storage.objects
  for select using (bucket_id in ('transformations','coach-photos'));

drop policy if exists "admins manage brand images" on storage.objects;
create policy "admins manage brand images" on storage.objects
  for all
  using (bucket_id in ('transformations','coach-photos') and public.is_admin())
  with check (bucket_id in ('transformations','coach-photos') and public.is_admin());

notify pgrst, 'reload schema';
