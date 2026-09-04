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
