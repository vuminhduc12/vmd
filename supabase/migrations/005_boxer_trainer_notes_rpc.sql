-- BOXER PRO — trainer notes RPC helpers
-- Use this after 004_boxer_trainer_notes.sql. This is intentionally separate
-- so projects that already ran the first 004 can still receive the save/delete RPCs.

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
