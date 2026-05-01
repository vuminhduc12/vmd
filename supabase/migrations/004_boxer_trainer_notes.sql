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

create or replace function public.boxer_create_trainer_note(
  target_athlete_user_id uuid,
  note_text text
)
returns public.boxer_trainer_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_note public.boxer_trainer_notes;
  cleaned_note text := btrim(coalesce(note_text, ''));
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  if target_athlete_user_id is null then
    raise exception '選手が選択されていません';
  end if;

  if char_length(cleaned_note) < 1 or char_length(cleaned_note) > 1200 then
    raise exception 'コメントは1文字以上1200文字以内で入力してください';
  end if;

  if not public.boxer_is_approved_trainer(target_athlete_user_id) then
    raise exception 'この選手へのコメント権限がありません';
  end if;

  insert into public.boxer_trainer_notes (athlete_user_id, trainer_user_id, note)
  values (target_athlete_user_id, auth.uid(), cleaned_note)
  returning * into inserted_note;

  return inserted_note;
end;
$$;

create or replace function public.boxer_delete_trainer_note(note_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_note public.boxer_trainer_notes;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select * into target_note
  from public.boxer_trainer_notes
  where id = note_id;

  if target_note.id is null then
    return false;
  end if;

  if target_note.trainer_user_id <> auth.uid()
     or not public.boxer_is_approved_trainer(target_note.athlete_user_id) then
    raise exception 'このコメントを削除する権限がありません';
  end if;

  delete from public.boxer_trainer_notes
  where id = note_id
    and trainer_user_id = auth.uid();

  return true;
end;
$$;

grant execute on function public.boxer_create_trainer_note(uuid, text) to authenticated;
grant execute on function public.boxer_delete_trainer_note(uuid) to authenticated;
