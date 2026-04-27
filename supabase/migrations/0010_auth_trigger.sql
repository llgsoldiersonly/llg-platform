-- 0010_auth_trigger.sql
-- Auto-create a profiles row whenever auth.users gets a new entry.
-- Without this, signed-up users have no profile → is_agency_staff() returns
-- false → middleware routes them through the client portal but RBAC checks
-- silently fail because there's no row to read.
--
-- The role defaults to 'client_user'. To grant staff access, update
-- auth.users.raw_app_meta_data->'role' to 'agency_staff' or 'super_admin'
-- before signup, OR update profiles.role directly after the user exists.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_app_meta_data->>'role', 'client_user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: any existing auth.users without a profiles row (e.g. nathan.u
-- who signed up during Phase 1 testing before this trigger existed).
insert into profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.email),
  coalesce(u.raw_app_meta_data->>'role', 'client_user')
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;
