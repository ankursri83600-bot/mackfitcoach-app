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
