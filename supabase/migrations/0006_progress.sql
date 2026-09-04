-- =============================================================================
-- 0006 — weight logs.
--
-- Backs the progress tracker on the dashboard. Deliberately narrow: one row is
-- one weigh-in, and everything the UI shows (trend, rate, projection) is
-- derived on read rather than stored, so a corrected entry cannot leave a
-- stale rollup behind.
--
-- Idempotent, like every migration here — safe to re-run.
-- =============================================================================

create table if not exists weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- The DAY of the weigh-in, not the instant. A user weighing themselves at
  -- 06:00 and again at 06:05 has not made two data points, and a timestamptz
  -- here would silently let them.
  logged_on  date not null default (now() at time zone 'Asia/Kolkata')::date,
  weight_kg  numeric(5,1) not null check (weight_kg between 20 and 400),
  -- Optional context. Kept free-text: structured mood/energy enums get
  -- abandoned within a fortnight and then mean nothing.
  note       text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),

  -- One weigh-in per day. An upsert on this constraint is what makes
  -- "correcting today's number" work without a delete-then-insert race.
  unique (user_id, logged_on)
);

create index if not exists weight_logs_user_date_idx
  on weight_logs (user_id, logged_on desc);

alter table weight_logs enable row level security;

-- A weigh-in is among the more personal things this app stores. Only the owner
-- may read or write it — NOT staff, unlike bookings or orders. A coach who
-- needs the number can ask for it; a blanket staff read policy here would mean
-- every trainer can browse every client's body weight over time.
drop policy if exists "weight_logs_select_own" on weight_logs;
create policy "weight_logs_select_own" on weight_logs
  for select using (auth.uid() = user_id);

drop policy if exists "weight_logs_insert_own" on weight_logs;
create policy "weight_logs_insert_own" on weight_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "weight_logs_update_own" on weight_logs;
create policy "weight_logs_update_own" on weight_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weight_logs_delete_own" on weight_logs;
create policy "weight_logs_delete_own" on weight_logs
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Meal swaps.
--
-- A swap is stored as an OVERRIDE, never as a rewritten plan. `diet_plans`
-- holds the engine's deterministic output and re-rendering it must always
-- reproduce the same thing; if a swap edited that JSON, the plan would stop
-- matching its own seed and the determinism the whole engine is built on would
-- be quietly gone. The renderer applies overrides on top at display time.
-- =============================================================================

create table if not exists plan_meal_swaps (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references diet_plans(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- Which item to replace: day index (1-based, as displayed), meal slot, and
  -- the food that was originally there.
  day_index    smallint not null check (day_index between 1 and 7),
  slot_id      text not null,
  from_food_id text not null,
  to_food_id   text not null,
  created_at   timestamptz not null default now(),

  -- One override per item. Swapping twice replaces, it does not stack.
  unique (plan_id, day_index, slot_id, from_food_id)
);

create index if not exists plan_meal_swaps_plan_idx
  on plan_meal_swaps (plan_id);

alter table plan_meal_swaps enable row level security;

-- Owner-only, and the plan must actually be theirs. Checking `user_id` alone
-- would let a caller attach a swap to someone else's plan by supplying that
-- plan's id, which would then render inside the owner's chart.
drop policy if exists "plan_meal_swaps_select_own" on plan_meal_swaps;
create policy "plan_meal_swaps_select_own" on plan_meal_swaps
  for select using (auth.uid() = user_id);

drop policy if exists "plan_meal_swaps_write_own" on plan_meal_swaps;
create policy "plan_meal_swaps_write_own" on plan_meal_swaps
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from diet_plans p
      where p.id = plan_meal_swaps.plan_id
        and p.user_id = auth.uid()
    )
  );
