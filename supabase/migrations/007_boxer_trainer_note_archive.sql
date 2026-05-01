-- BOXER PRO — athlete-side archive for trainer note notifications
-- Keeps guidance history without permanently deleting trainer comments.

alter table public.boxer_trainer_notes
  add column if not exists archived_by_athlete_at timestamptz;

create index if not exists idx_boxer_trainer_notes_athlete_active
  on public.boxer_trainer_notes (athlete_user_id, created_at desc)
  where archived_by_athlete_at is null;

create or replace function public.boxer_archive_trainer_note(note_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  update public.boxer_trainer_notes
  set archived_by_athlete_at = coalesce(archived_by_athlete_at, now())
  where id = note_id
    and athlete_user_id = auth.uid();

  return found;
end;
$$;

grant execute on function public.boxer_archive_trainer_note(uuid) to authenticated;
