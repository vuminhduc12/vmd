-- BOXER PRO — first-class user roles
-- Run after 001_boxer_pro_schema.sql.
--
-- This migration adds a small role table used as the product-facing
-- permission source. Existing owner CRUD and trainer RLS remain unchanged.

create table if not exists public.boxer_user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role),
  constraint boxer_user_roles_role_check check (role in ('admin', 'athlete', 'trainer'))
);

create index if not exists idx_boxer_user_roles_role
  on public.boxer_user_roles (role);

drop trigger if exists tr_boxer_user_roles_updated on public.boxer_user_roles;
create trigger tr_boxer_user_roles_updated
  before update on public.boxer_user_roles
  for each row execute function public.boxer_touch_updated_at();

alter table public.boxer_user_roles enable row level security;

drop policy if exists "boxer_user_roles_select_own" on public.boxer_user_roles;

create policy "boxer_user_roles_select_own"
  on public.boxer_user_roles for select
  using (auth.uid() = user_id);

create or replace function public.boxer_current_user_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boxer_user_roles r
    where r.user_id = auth.uid()
      and r.role = required_role
  );
$$;

create or replace function public.boxer_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.boxer_current_user_has_role('admin');
$$;

grant select on public.boxer_user_roles to authenticated;
grant execute on function public.boxer_current_user_has_role(text) to authenticated;
grant execute on function public.boxer_is_admin() to authenticated;

-- Example manual role assignment, run with service role / SQL editor as needed:
-- insert into public.boxer_user_roles (user_id, role)
-- values ('00000000-0000-0000-0000-000000000000', 'admin')
-- on conflict (user_id, role) do nothing;
