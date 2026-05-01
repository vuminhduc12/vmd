-- BOXER PRO — show trainer display names on athlete notifications
-- Use after 004/005 if those migrations were already applied before this change.

alter table public.boxer_trainer_notes
  add column if not exists trainer_display_name text not null default 'トレーナー';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boxer_trainer_notes_trainer_name_check'
  ) then
    alter table public.boxer_trainer_notes
      add constraint boxer_trainer_notes_trainer_name_check
      check (char_length(btrim(trainer_display_name)) between 1 and 80);
  end if;
end $$;

update public.boxer_trainer_notes n
set trainer_display_name = left(
  coalesce(nullif(btrim(p.settings ->> 'athleteName'), ''), n.trainer_display_name, 'トレーナー'),
  80
)
from public.boxer_profiles p
where p.user_id = n.trainer_user_id
  and (n.trainer_display_name is null or n.trainer_display_name = 'トレーナー');

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
  trainer_name text;
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

  select btrim(coalesce(p.settings ->> 'athleteName', ''))
    into trainer_name
  from public.boxer_profiles p
  where p.user_id = auth.uid();

  trainer_name := coalesce(nullif(trainer_name, ''), lower(coalesce(auth.jwt() ->> 'email', 'トレーナー')));
  trainer_name := left(trainer_name, 80);

  insert into public.boxer_trainer_notes (athlete_user_id, trainer_user_id, trainer_display_name, note)
  values (target_athlete_user_id, auth.uid(), trainer_name, cleaned_note)
  returning * into inserted_note;

  return inserted_note;
end;
$$;

grant execute on function public.boxer_create_trainer_note(uuid, text) to authenticated;
