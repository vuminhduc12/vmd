-- BOXER PRO — Supabase schema + RLS
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- Prerequisites:
-- 1. Create a Supabase project.
-- 2. Authentication → Providers → Google: enable, add Web client ID/secret from Google Cloud Console.
-- 3. Authentication → URL Configuration: add Site URL (e.g. https://your-worker.workers.dev)
--    and Redirect URLs including the same + http://localhost:* for local dev.

-- ---------------------------------------------------------------------------
-- Profiles (app settings JSON mirrors localStorage boxerpro.settings)
-- ---------------------------------------------------------------------------
create table if not exists public.boxer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Log tables: one row per record; full fields stored in payload jsonb
-- ---------------------------------------------------------------------------
create table if not exists public.boxer_weight_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_meals (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_training_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_fight_goals (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_hydration_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_recovery_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.boxer_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_boxer_profiles_updated on public.boxer_profiles;
create trigger tr_boxer_profiles_updated
  before update on public.boxer_profiles
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_weight_updated on public.boxer_weight_logs;
create trigger tr_boxer_weight_updated
  before update on public.boxer_weight_logs
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_meals_updated on public.boxer_meals;
create trigger tr_boxer_meals_updated
  before update on public.boxer_meals
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_training_updated on public.boxer_training_logs;
create trigger tr_boxer_training_updated
  before update on public.boxer_training_logs
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_fight_updated on public.boxer_fight_goals;
create trigger tr_boxer_fight_updated
  before update on public.boxer_fight_goals
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_hydration_updated on public.boxer_hydration_logs;
create trigger tr_boxer_hydration_updated
  before update on public.boxer_hydration_logs
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_recovery_updated on public.boxer_recovery_logs;
create trigger tr_boxer_recovery_updated
  before update on public.boxer_recovery_logs
  for each row execute function public.boxer_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.boxer_profiles enable row level security;
alter table public.boxer_weight_logs enable row level security;
alter table public.boxer_meals enable row level security;
alter table public.boxer_training_logs enable row level security;
alter table public.boxer_fight_goals enable row level security;
alter table public.boxer_hydration_logs enable row level security;
alter table public.boxer_recovery_logs enable row level security;

-- Profiles: one row per user
create policy "boxer_profiles_select_own"
  on public.boxer_profiles for select
  using (auth.uid() = user_id);

create policy "boxer_profiles_insert_own"
  on public.boxer_profiles for insert
  with check (auth.uid() = user_id);

create policy "boxer_profiles_update_own"
  on public.boxer_profiles for update
  using (auth.uid() = user_id);

-- Generic log policies (repeat per table)
create policy "boxer_weight_select_own" on public.boxer_weight_logs for select using (auth.uid() = user_id);
create policy "boxer_weight_insert_own" on public.boxer_weight_logs for insert with check (auth.uid() = user_id);
create policy "boxer_weight_update_own" on public.boxer_weight_logs for update using (auth.uid() = user_id);
create policy "boxer_weight_delete_own" on public.boxer_weight_logs for delete using (auth.uid() = user_id);

create policy "boxer_meals_select_own" on public.boxer_meals for select using (auth.uid() = user_id);
create policy "boxer_meals_insert_own" on public.boxer_meals for insert with check (auth.uid() = user_id);
create policy "boxer_meals_update_own" on public.boxer_meals for update using (auth.uid() = user_id);
create policy "boxer_meals_delete_own" on public.boxer_meals for delete using (auth.uid() = user_id);

create policy "boxer_training_select_own" on public.boxer_training_logs for select using (auth.uid() = user_id);
create policy "boxer_training_insert_own" on public.boxer_training_logs for insert with check (auth.uid() = user_id);
create policy "boxer_training_update_own" on public.boxer_training_logs for update using (auth.uid() = user_id);
create policy "boxer_training_delete_own" on public.boxer_training_logs for delete using (auth.uid() = user_id);

create policy "boxer_fight_select_own" on public.boxer_fight_goals for select using (auth.uid() = user_id);
create policy "boxer_fight_insert_own" on public.boxer_fight_goals for insert with check (auth.uid() = user_id);
create policy "boxer_fight_update_own" on public.boxer_fight_goals for update using (auth.uid() = user_id);
create policy "boxer_fight_delete_own" on public.boxer_fight_goals for delete using (auth.uid() = user_id);

create policy "boxer_hydration_select_own" on public.boxer_hydration_logs for select using (auth.uid() = user_id);
create policy "boxer_hydration_insert_own" on public.boxer_hydration_logs for insert with check (auth.uid() = user_id);
create policy "boxer_hydration_update_own" on public.boxer_hydration_logs for update using (auth.uid() = user_id);
create policy "boxer_hydration_delete_own" on public.boxer_hydration_logs for delete using (auth.uid() = user_id);

create policy "boxer_recovery_select_own" on public.boxer_recovery_logs for select using (auth.uid() = user_id);
create policy "boxer_recovery_insert_own" on public.boxer_recovery_logs for insert with check (auth.uid() = user_id);
create policy "boxer_recovery_update_own" on public.boxer_recovery_logs for update using (auth.uid() = user_id);
create policy "boxer_recovery_delete_own" on public.boxer_recovery_logs for delete using (auth.uid() = user_id);
