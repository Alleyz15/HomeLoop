alter table public.profiles
  add column role text not null default 'owner';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin'));

create or replace function private.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'profile role can only be changed by the service role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.prevent_profile_role_change()
  from public, anon, authenticated, service_role;

create trigger profiles_prevent_role_change
  before update of role on public.profiles
  for each row execute function private.prevent_profile_role_change();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function private.is_admin()
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select private.is_admin()));
