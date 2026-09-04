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
