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
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boxer_profiles
  add column if not exists last_seen_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Trainer links: athletes grant read-only access to trusted trainer emails
-- ---------------------------------------------------------------------------
create table if not exists public.boxer_trainer_links (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users (id) on delete cascade,
  trainer_user_id uuid references auth.users (id) on delete set null,
  trainer_email text not null,
  status text not null default 'accepted',
  created_at timestamptz not null default now(),
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxer_trainer_links_status_check check (status in ('accepted', 'revoked')),
  constraint boxer_trainer_links_email_check check (
    trainer_email = lower(btrim(trainer_email))
    and position('@' in trainer_email) > 1
  ),
  unique (athlete_user_id, trainer_email)
);

create index if not exists idx_boxer_trainer_links_trainer_email
  on public.boxer_trainer_links (trainer_email)
  where status = 'accepted';

create index if not exists idx_boxer_trainer_links_athlete
  on public.boxer_trainer_links (athlete_user_id)
  where status = 'accepted';

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

create table if not exists public.boxer_weight_log_photos (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_opponents (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boxer_fight_history (
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

drop trigger if exists tr_boxer_trainer_links_updated on public.boxer_trainer_links;
create trigger tr_boxer_trainer_links_updated
  before update on public.boxer_trainer_links
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

drop trigger if exists tr_boxer_weight_photos_updated on public.boxer_weight_log_photos;
create trigger tr_boxer_weight_photos_updated
  before update on public.boxer_weight_log_photos
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_opponents_updated on public.boxer_opponents;
create trigger tr_boxer_opponents_updated
  before update on public.boxer_opponents
  for each row execute function public.boxer_touch_updated_at();

drop trigger if exists tr_boxer_fight_history_updated on public.boxer_fight_history;
create trigger tr_boxer_fight_history_updated
  before update on public.boxer_fight_history
  for each row execute function public.boxer_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.boxer_profiles enable row level security;
alter table public.boxer_trainer_links enable row level security;
alter table public.boxer_weight_logs enable row level security;
alter table public.boxer_meals enable row level security;
alter table public.boxer_training_logs enable row level security;
alter table public.boxer_fight_goals enable row level security;
alter table public.boxer_weight_log_photos enable row level security;
alter table public.boxer_opponents enable row level security;
alter table public.boxer_fight_history enable row level security;
alter table public.boxer_hydration_logs enable row level security;
alter table public.boxer_recovery_logs enable row level security;

drop policy if exists "boxer_profiles_select_own" on public.boxer_profiles;
drop policy if exists "boxer_profiles_insert_own" on public.boxer_profiles;
drop policy if exists "boxer_profiles_update_own" on public.boxer_profiles;
drop policy if exists "boxer_trainer_links_select_related" on public.boxer_trainer_links;
drop policy if exists "boxer_trainer_links_insert_own_athlete" on public.boxer_trainer_links;
drop policy if exists "boxer_trainer_links_update_own_athlete" on public.boxer_trainer_links;
drop policy if exists "boxer_trainer_links_delete_own_athlete" on public.boxer_trainer_links;
drop policy if exists "boxer_weight_select_own" on public.boxer_weight_logs;
drop policy if exists "boxer_weight_insert_own" on public.boxer_weight_logs;
drop policy if exists "boxer_weight_update_own" on public.boxer_weight_logs;
drop policy if exists "boxer_weight_delete_own" on public.boxer_weight_logs;
drop policy if exists "boxer_meals_select_own" on public.boxer_meals;
drop policy if exists "boxer_meals_insert_own" on public.boxer_meals;
drop policy if exists "boxer_meals_update_own" on public.boxer_meals;
drop policy if exists "boxer_meals_delete_own" on public.boxer_meals;
drop policy if exists "boxer_training_select_own" on public.boxer_training_logs;
drop policy if exists "boxer_training_insert_own" on public.boxer_training_logs;
drop policy if exists "boxer_training_update_own" on public.boxer_training_logs;
drop policy if exists "boxer_training_delete_own" on public.boxer_training_logs;
drop policy if exists "boxer_fight_select_own" on public.boxer_fight_goals;
drop policy if exists "boxer_fight_insert_own" on public.boxer_fight_goals;
drop policy if exists "boxer_fight_update_own" on public.boxer_fight_goals;
drop policy if exists "boxer_fight_delete_own" on public.boxer_fight_goals;
drop policy if exists "boxer_weight_photos_select_own" on public.boxer_weight_log_photos;
drop policy if exists "boxer_weight_photos_insert_own" on public.boxer_weight_log_photos;
drop policy if exists "boxer_weight_photos_update_own" on public.boxer_weight_log_photos;
drop policy if exists "boxer_weight_photos_delete_own" on public.boxer_weight_log_photos;
drop policy if exists "boxer_opponents_select_own" on public.boxer_opponents;
drop policy if exists "boxer_opponents_insert_own" on public.boxer_opponents;
drop policy if exists "boxer_opponents_update_own" on public.boxer_opponents;
drop policy if exists "boxer_opponents_delete_own" on public.boxer_opponents;
drop policy if exists "boxer_fight_history_select_own" on public.boxer_fight_history;
drop policy if exists "boxer_fight_history_insert_own" on public.boxer_fight_history;
drop policy if exists "boxer_fight_history_update_own" on public.boxer_fight_history;
drop policy if exists "boxer_fight_history_delete_own" on public.boxer_fight_history;
drop policy if exists "boxer_hydration_select_own" on public.boxer_hydration_logs;
drop policy if exists "boxer_hydration_insert_own" on public.boxer_hydration_logs;
drop policy if exists "boxer_hydration_update_own" on public.boxer_hydration_logs;
drop policy if exists "boxer_hydration_delete_own" on public.boxer_hydration_logs;
drop policy if exists "boxer_recovery_select_own" on public.boxer_recovery_logs;
drop policy if exists "boxer_recovery_insert_own" on public.boxer_recovery_logs;
drop policy if exists "boxer_recovery_update_own" on public.boxer_recovery_logs;
drop policy if exists "boxer_recovery_delete_own" on public.boxer_recovery_logs;

create or replace function public.boxer_is_approved_trainer(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boxer_trainer_links l
    where l.athlete_user_id = target_user_id
      and l.status = 'accepted'
      and (
        l.trainer_user_id = auth.uid()
        or l.trainer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Profiles: one row per user
create policy "boxer_profiles_select_own"
  on public.boxer_profiles for select
  using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));

create policy "boxer_profiles_insert_own"
  on public.boxer_profiles for insert
  with check (auth.uid() = user_id);

create policy "boxer_profiles_update_own"
  on public.boxer_profiles for update
  using (auth.uid() = user_id);

-- Trainer links: athletes manage their grants; trainers can read links addressed to them
create policy "boxer_trainer_links_select_related"
  on public.boxer_trainer_links for select
  using (
    auth.uid() = athlete_user_id
    or auth.uid() = trainer_user_id
    or trainer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "boxer_trainer_links_insert_own_athlete"
  on public.boxer_trainer_links for insert
  with check (auth.uid() = athlete_user_id and status = 'accepted');

create policy "boxer_trainer_links_update_own_athlete"
  on public.boxer_trainer_links for update
  using (auth.uid() = athlete_user_id)
  with check (auth.uid() = athlete_user_id);

create policy "boxer_trainer_links_delete_own_athlete"
  on public.boxer_trainer_links for delete
  using (
    auth.uid() = athlete_user_id
    or auth.uid() = trainer_user_id
    or trainer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Generic log policies (repeat per table)
create policy "boxer_weight_select_own" on public.boxer_weight_logs for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_weight_insert_own" on public.boxer_weight_logs for insert with check (auth.uid() = user_id);
create policy "boxer_weight_update_own" on public.boxer_weight_logs for update using (auth.uid() = user_id);
create policy "boxer_weight_delete_own" on public.boxer_weight_logs for delete using (auth.uid() = user_id);

create policy "boxer_meals_select_own" on public.boxer_meals for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_meals_insert_own" on public.boxer_meals for insert with check (auth.uid() = user_id);
create policy "boxer_meals_update_own" on public.boxer_meals for update using (auth.uid() = user_id);
create policy "boxer_meals_delete_own" on public.boxer_meals for delete using (auth.uid() = user_id);

create policy "boxer_training_select_own" on public.boxer_training_logs for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_training_insert_own" on public.boxer_training_logs for insert with check (auth.uid() = user_id);
create policy "boxer_training_update_own" on public.boxer_training_logs for update using (auth.uid() = user_id);
create policy "boxer_training_delete_own" on public.boxer_training_logs for delete using (auth.uid() = user_id);

create policy "boxer_fight_select_own" on public.boxer_fight_goals for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_fight_insert_own" on public.boxer_fight_goals for insert with check (auth.uid() = user_id);
create policy "boxer_fight_update_own" on public.boxer_fight_goals for update using (auth.uid() = user_id);
create policy "boxer_fight_delete_own" on public.boxer_fight_goals for delete using (auth.uid() = user_id);

create policy "boxer_weight_photos_select_own" on public.boxer_weight_log_photos for select using (auth.uid() = user_id);
create policy "boxer_weight_photos_insert_own" on public.boxer_weight_log_photos for insert with check (auth.uid() = user_id);
create policy "boxer_weight_photos_update_own" on public.boxer_weight_log_photos for update using (auth.uid() = user_id);
create policy "boxer_weight_photos_delete_own" on public.boxer_weight_log_photos for delete using (auth.uid() = user_id);

create policy "boxer_opponents_select_own" on public.boxer_opponents for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_opponents_insert_own" on public.boxer_opponents for insert with check (auth.uid() = user_id);
create policy "boxer_opponents_update_own" on public.boxer_opponents for update using (auth.uid() = user_id);
create policy "boxer_opponents_delete_own" on public.boxer_opponents for delete using (auth.uid() = user_id);

create policy "boxer_fight_history_select_own" on public.boxer_fight_history for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_fight_history_insert_own" on public.boxer_fight_history for insert with check (auth.uid() = user_id);
create policy "boxer_fight_history_update_own" on public.boxer_fight_history for update using (auth.uid() = user_id);
create policy "boxer_fight_history_delete_own" on public.boxer_fight_history for delete using (auth.uid() = user_id);

create policy "boxer_hydration_select_own" on public.boxer_hydration_logs for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_hydration_insert_own" on public.boxer_hydration_logs for insert with check (auth.uid() = user_id);
create policy "boxer_hydration_update_own" on public.boxer_hydration_logs for update using (auth.uid() = user_id);
create policy "boxer_hydration_delete_own" on public.boxer_hydration_logs for delete using (auth.uid() = user_id);

create policy "boxer_recovery_select_own" on public.boxer_recovery_logs for select using (auth.uid() = user_id or public.boxer_is_approved_trainer(user_id));
create policy "boxer_recovery_insert_own" on public.boxer_recovery_logs for insert with check (auth.uid() = user_id);
create policy "boxer_recovery_update_own" on public.boxer_recovery_logs for update using (auth.uid() = user_id);
create policy "boxer_recovery_delete_own" on public.boxer_recovery_logs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Supabase Storage buckets for media uploads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('weight-photos', 'weight-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('opponent-photos', 'opponent-photos', false)
on conflict (id) do nothing;

drop policy if exists "weight_photos_select_own" on storage.objects;
drop policy if exists "weight_photos_insert_own" on storage.objects;
drop policy if exists "weight_photos_update_own" on storage.objects;
drop policy if exists "weight_photos_delete_own" on storage.objects;
drop policy if exists "opponent_photos_select_own" on storage.objects;
drop policy if exists "opponent_photos_insert_own" on storage.objects;
drop policy if exists "opponent_photos_update_own" on storage.objects;
drop policy if exists "opponent_photos_delete_own" on storage.objects;

create policy "weight_photos_select_own"
  on storage.objects for select
  using (
    bucket_id = 'weight-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "weight_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'weight-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "weight_photos_update_own"
  on storage.objects for update
  using (
    bucket_id = 'weight-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "weight_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'weight-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "opponent_photos_select_own"
  on storage.objects for select
  using (
    bucket_id = 'opponent-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "opponent_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'opponent-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "opponent_photos_update_own"
  on storage.objects for update
  using (
    bucket_id = 'opponent-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "opponent_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'opponent-photos'
    and auth.uid()::text = split_part(name, '/', 1)
  );
