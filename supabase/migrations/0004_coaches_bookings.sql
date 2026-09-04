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
