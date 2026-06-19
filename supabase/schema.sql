-- Tandem — database schema, Row-Level Security, and Realtime setup.
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
--
-- BEFORE running, lock the project down to just the two of you:
--   Dashboard → Authentication → Providers → Email: keep enabled.
--   Dashboard → Authentication → Sign In / Up → DISABLE "Allow new users to sign up".
--   Then Dashboard → Authentication → Users → "Add user" / "Invite" for each of
--   the two email addresses. With open sign-ups off, any authenticated user is,
--   by construction, one of those two people — which is what the policies below
--   rely on (they grant read access to every authenticated user).

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per person, keyed to their auth account.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- The *definitions* of checklist entries (the recurring habits + one-off tasks).
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  title      text not null check (length(trim(title)) > 0),
  kind       text not null default 'daily' check (kind in ('daily', 'oneoff')),
  active     boolean not null default true,
  shared     boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Each individual check-off. A daily item is "done" for a given day iff a row
-- exists here for (item_id, for_date). Unchecking deletes the row. Old rows stay
-- and become the history that powers streaks — the daily "reset" is implicit in
-- for_date, so there is no scheduled job.
create table if not exists public.completions (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  for_date     date not null,
  completed_at timestamptz not null default now(),
  note         text
);

create index if not exists items_owner_active_idx
  on public.items (owner_id, active, sort_order);

create index if not exists completions_owner_date_idx
  on public.completions (owner_id, for_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration for installs created before "together checks" + notes existed.
-- create-table-if-not-exists won't add columns to an existing table, so add them
-- explicitly. All guarded, so the whole script stays safely re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.items       add column if not exists shared boolean not null default false;
alter table public.completions add column if not exists note text;

-- Move from one-completion-per-(item, day) to one-per-(item, owner, day) so BOTH
-- people can sign off the same together check on the same day. Drop the old
-- auto-named key if a prior version created it, then ensure the new one exists.
alter table public.completions drop constraint if exists completions_item_id_for_date_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'completions_item_owner_for_date_key'
  ) then
    alter table public.completions
      add constraint completions_item_owner_for_date_key unique (item_id, owner_id, for_date);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create a profile when a new auth user is added.
-- security definer lets this one trusted function insert past RLS; the pinned
-- search_path prevents a hijacked-schema attack on a definer function.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: create profiles for any users that already existed before the trigger
-- was in place (e.g. if you added the two users before running this script). This
-- makes setup order-independent and the script safe to re-run.
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
--   Read  → any authenticated user (i.e. either of you) sees everything.
--   Write → only the owner of a row may change it.
-- This is what makes accountability honest: you can watch, not tamper.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.items       enable row level security;
alter table public.completions enable row level security;

-- Postgres has no "create policy if not exists", so each policy is dropped first
-- to keep this whole script safely re-runnable.

-- profiles ---------------------------------------------------------------------
drop policy if exists "profiles: read all (authenticated)" on public.profiles;
create policy "profiles: read all (authenticated)"
  on public.profiles for select
  to authenticated using (true);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- items ------------------------------------------------------------------------
drop policy if exists "items: read all (authenticated)" on public.items;
create policy "items: read all (authenticated)"
  on public.items for select
  to authenticated using (true);

drop policy if exists "items: insert own" on public.items;
create policy "items: insert own"
  on public.items for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Shared (together) items are jointly managed: either person may rename/reorder or
-- delete them. The update `with check (… or shared)` keeps the row shared, so a
-- non-creator can edit but cannot un-share or move it into their own solo list.
drop policy if exists "items: update own" on public.items;
create policy "items: update own"
  on public.items for update
  to authenticated
  using (owner_id = auth.uid() or shared)
  with check (owner_id = auth.uid() or shared);

drop policy if exists "items: delete own" on public.items;
create policy "items: delete own"
  on public.items for delete
  to authenticated
  using (owner_id = auth.uid() or shared);

-- completions ------------------------------------------------------------------
drop policy if exists "completions: read all (authenticated)" on public.completions;
create policy "completions: read all (authenticated)"
  on public.completions for select
  to authenticated using (true);

-- Insert guard does BOTH checks: the row is stamped with your id AND the item it
-- points at is either yours OR a shared (together) item. The "or shared" clause is
-- the ONLY new write capability these features add — it lets you sign off a together
-- check your partner created, and nothing else. It still blocks occupying someone
-- else's solo (item, date) slot.
drop policy if exists "completions: insert own item" on public.completions;
create policy "completions: insert own item"
  on public.completions for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and item_id in (
      select id from public.items
      where owner_id = auth.uid() or shared
    )
  );

drop policy if exists "completions: update own" on public.completions;
create policy "completions: update own"
  on public.completions for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "completions: delete own" on public.completions;
create policy "completions: delete own"
  on public.completions for delete
  to authenticated
  using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: broadcast item + completion changes so both clients update live.
-- (Postgres emits change events on these tables; Supabase streams them over a
--  WebSocket to every subscribed client.) Guarded so re-runs don't error.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'completions'
  ) then
    alter publication supabase_realtime add table public.completions;
  end if;
end $$;
