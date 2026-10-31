-- Admin role foundation for UT Connect.
-- Individual initial admin assignments are provisioned separately so user identifiers
-- are not stored in the public source repository.

create table if not exists private.app_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  granted_at timestamptz not null default now(),
  constraint app_user_roles_role_check check (role in ('admin'))
);

alter table private.app_user_roles enable row level security;

-- Role assignments must never be writable or readable through the public Data API.
revoke all on table private.app_user_roles from public, anon, authenticated;

create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.app_user_roles as role_assignment
    where role_assignment.user_id = (select auth.uid())
      and role_assignment.role = 'admin'
  );
$$;

revoke all on function private.is_current_user_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_current_user_admin() to authenticated;

-- Narrow, authenticated-only RPC used by the dashboard to display admin controls.
-- The underlying role lookup remains in the non-exposed private schema.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_current_user_admin();
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

-- Information UT is curated by the admin team. Students can read published items
-- according to the existing audience rules, but cannot publish directly.
drop policy if exists information_posts_insert_verified
  on public.information_posts;

create policy information_posts_admin_read
  on public.information_posts
  for select
  to authenticated
  using (private.is_current_user_admin());

create policy information_posts_admin_insert
  on public.information_posts
  for insert
  to authenticated
  with check (
    private.is_current_user_admin()
    and author_id = (select auth.uid())
  );

create policy information_posts_admin_update
  on public.information_posts
  for update
  to authenticated
  using (private.is_current_user_admin())
  with check (private.is_current_user_admin());

create policy information_posts_admin_delete
  on public.information_posts
  for delete
  to authenticated
  using (private.is_current_user_admin());

grant insert, update, delete on public.information_posts to authenticated;
