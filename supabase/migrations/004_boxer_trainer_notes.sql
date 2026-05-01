-- BOXER PRO — trainer notes and athlete comments
-- Run after 003_boxer_trainer_invite_flow.sql.

create table if not exists public.boxer_trainer_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_user_id uuid not null references auth.users (id) on delete cascade,
  trainer_user_id uuid not null references auth.users (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxer_trainer_notes_note_check check (char_length(btrim(note)) between 1 and 1200)
);

create index if not exists idx_boxer_trainer_notes_athlete
  on public.boxer_trainer_notes (athlete_user_id, created_at desc);

create index if not exists idx_boxer_trainer_notes_trainer
  on public.boxer_trainer_notes (trainer_user_id, created_at desc);

drop trigger if exists tr_boxer_trainer_notes_updated on public.boxer_trainer_notes;
create trigger tr_boxer_trainer_notes_updated
  before update on public.boxer_trainer_notes
  for each row execute function public.boxer_touch_updated_at();

alter table public.boxer_trainer_notes enable row level security;

drop policy if exists "boxer_trainer_notes_select_related" on public.boxer_trainer_notes;
drop policy if exists "boxer_trainer_notes_insert_trainer" on public.boxer_trainer_notes;
drop policy if exists "boxer_trainer_notes_update_trainer" on public.boxer_trainer_notes;
drop policy if exists "boxer_trainer_notes_delete_trainer" on public.boxer_trainer_notes;

create policy "boxer_trainer_notes_select_related"
  on public.boxer_trainer_notes for select
  using (
    auth.uid() = athlete_user_id
    or (
      auth.uid() = trainer_user_id
      and public.boxer_is_approved_trainer(athlete_user_id)
    )
  );

create policy "boxer_trainer_notes_insert_trainer"
  on public.boxer_trainer_notes for insert
  with check (
    auth.uid() = trainer_user_id
    and public.boxer_is_approved_trainer(athlete_user_id)
  );

create policy "boxer_trainer_notes_update_trainer"
  on public.boxer_trainer_notes for update
  using (
    auth.uid() = trainer_user_id
    and public.boxer_is_approved_trainer(athlete_user_id)
  )
  with check (
    auth.uid() = trainer_user_id
    and public.boxer_is_approved_trainer(athlete_user_id)
  );

create policy "boxer_trainer_notes_delete_trainer"
  on public.boxer_trainer_notes for delete
  using (
    auth.uid() = trainer_user_id
    and public.boxer_is_approved_trainer(athlete_user_id)
  );

grant select, insert, update, delete on public.boxer_trainer_notes to authenticated;
