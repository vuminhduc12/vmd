-- BOXER PRO — trainer invite lifecycle
-- Run after 002_boxer_roles.sql.
--
-- Invites now start as pending. Trainers must accept before RLS grants
-- read-only athlete access.

alter table public.boxer_trainer_links
  drop constraint if exists boxer_trainer_links_status_check;

alter table public.boxer_trainer_links
  add constraint boxer_trainer_links_status_check
  check (status in ('pending', 'accepted', 'revoked'));

alter table public.boxer_trainer_links
  alter column status set default 'pending',
  alter column accepted_at drop not null,
  alter column accepted_at drop default;

create index if not exists idx_boxer_trainer_links_pending_email
  on public.boxer_trainer_links (trainer_email)
  where status = 'pending';

drop policy if exists "boxer_trainer_links_insert_own_athlete" on public.boxer_trainer_links;
create policy "boxer_trainer_links_insert_own_athlete"
  on public.boxer_trainer_links for insert
  with check (
    auth.uid() = athlete_user_id
    and status = 'pending'
  );

create or replace function public.boxer_accept_trainer_invite(link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.boxer_trainer_links
  set
    trainer_user_id = auth.uid(),
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = link_id
    and status = 'pending'
    and trainer_email = lower(coalesce(auth.jwt() ->> 'email', ''));

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

create or replace function public.boxer_revoke_trainer_invite(link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.boxer_trainer_links
  set
    status = 'revoked',
    updated_at = now()
  where id = link_id
    and status in ('pending', 'accepted')
    and (
      athlete_user_id = auth.uid()
      or trainer_user_id = auth.uid()
      or trainer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function public.boxer_accept_trainer_invite(uuid) to authenticated;
grant execute on function public.boxer_revoke_trainer_invite(uuid) to authenticated;
