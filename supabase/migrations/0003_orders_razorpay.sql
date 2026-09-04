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
