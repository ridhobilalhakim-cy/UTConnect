-- Private group invitations: inbox RPC and per-admin NIM lookup throttling.
create table if not exists private.group_invite_search_events (
  event_id bigint generated always as identity primary key,
  searcher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists group_invite_search_events_actor_created_idx
  on private.group_invite_search_events(searcher_id, created_at desc);

alter table private.group_invite_search_events enable row level security;
revoke all on table private.group_invite_search_events from public, anon, authenticated;
grant all on table private.group_invite_search_events to service_role;

create or replace function public.consume_group_invite_search_limit(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('group-invite:' || p_actor_id::text, 0));

  delete from private.group_invite_search_events
  where searcher_id = p_actor_id
    and created_at < now() - interval '1 hour';

  insert into private.group_invite_search_events(searcher_id)
  values (p_actor_id);

  select count(*)::integer into v_count
  from private.group_invite_search_events
  where searcher_id = p_actor_id
    and created_at >= now() - interval '1 minute';

  if v_count > 5 then
    raise exception 'GROUP_INVITE_RATE_LIMIT' using errcode = 'P0001';
  end if;
end;
$function$;

create or replace function public.list_my_group_invites(p_actor_id uuid)
returns table (
  invite_id uuid,
  group_id uuid,
  group_name text,
  group_description text,
  invited_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;

  return query
  select invite.id, group_row.id, group_row.name, group_row.description, invite.created_at
  from public.group_invites invite
  join public.study_groups group_row on group_row.id = invite.group_id
  where invite.invited_user_id = p_actor_id
    and invite.accepted_at is null
    and group_row.is_archived = false
  order by invite.created_at desc
  limit 50;
end;
$function$;

revoke all on function public.consume_group_invite_search_limit(uuid) from public, anon, authenticated;
grant execute on function public.consume_group_invite_search_limit(uuid) to authenticated, service_role;

revoke all on function public.list_my_group_invites(uuid) from public, anon, authenticated;
grant execute on function public.list_my_group_invites(uuid) to authenticated, service_role;
