-- UTConnect Demo Mode isolation.
-- APPLY ONLY to a dedicated Supabase demo database after its baseline schema is reconstructed.
-- Never apply this migration to the shared UTConnect project used by Netlify/staging.
-- Demo eligibility is derived from server-owned auth.users.raw_app_meta_data, never user_metadata.

alter table public.profiles
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.user_locations
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.matching_preferences
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.connections
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.direct_messages
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.study_groups
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.group_members
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.group_invites
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.group_messages
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.group_agenda_items
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.group_materials
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.group_agenda_votes
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

alter table public.notifications
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_session_id uuid;

create table if not exists private.demo_sessions (
  id uuid primary key,
  visitor_user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'expired', 'resetting')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  reset_at timestamptz
);
alter table private.demo_sessions enable row level security;
revoke all on table private.demo_sessions from public, anon, authenticated;
grant all on table private.demo_sessions to service_role;

create table if not exists private.demo_bot_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references private.demo_sessions(id) on delete cascade,
  event_key text not null,
  created_at timestamptz not null default now(),
  unique(session_id, event_key)
);
alter table private.demo_bot_events enable row level security;
revoke all on table private.demo_bot_events from public, anon, authenticated;
grant all on table private.demo_bot_events to service_role;

create or replace function private.demo_session_for_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select s.id
  from auth.users u
  join private.demo_sessions s
    on s.id = case
      when coalesce(u.raw_app_meta_data ->> 'utconnect_demo_session', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (u.raw_app_meta_data ->> 'utconnect_demo_session')::uuid
      else null
    end
  where u.id = p_user_id
    and u.raw_app_meta_data ->> 'utconnect_demo_role' in ('visitor', 'bot')
    and s.status = 'active'
    and s.expires_at > now()
  limit 1
$function$;

create or replace function private.is_demo_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.demo_session_for_user(p_user_id) is not null
$function$;

create or replace function private.can_access_demo_scope(
  p_is_demo boolean,
  p_demo_session_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_session uuid;
begin
  if v_actor is null then
    return false;
  end if;

  v_session := private.demo_session_for_user(v_actor);
  if v_session is not null then
    return coalesce(p_is_demo, false) and p_demo_session_id = v_session;
  end if;

  return coalesce(p_is_demo, false) = false and p_demo_session_id is null;
end
$function$;

create or replace function private.same_demo_session(
  p_left_user_id uuid,
  p_right_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_left uuid := private.demo_session_for_user(p_left_user_id);
  v_right uuid := private.demo_session_for_user(p_right_user_id);
begin
  if v_left is null and v_right is null then return true; end if;
  return v_left is not null and v_left = v_right;
end
$function$;

create or replace function private.is_verified_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_demo_user(p_user_id)
    or exists (
      select 1 from public.profiles p
      where p.id = p_user_id
        and p.verification_status = 'verified'::public.student_verification_status
    )
$function$;

create or replace function private.is_current_user_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_verified_user(auth.uid())
$function$;

create or replace function private.sync_demo_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_json jsonb := to_jsonb(new);
  v_user_id uuid;
  v_other_user_id uuid;
  v_group_id uuid;
  v_connection_id uuid;
  v_agenda_item_id uuid;
  v_is_demo boolean := false;
  v_session_id uuid;
  v_other_session_id uuid;
  v_group_demo boolean;
  v_group_session uuid;
  v_connection_demo boolean;
  v_connection_session uuid;
begin
  if tg_table_name = 'profiles' then
    v_user_id := (v_json ->> 'id')::uuid;
    v_is_demo := private.is_demo_user(v_user_id);
    v_session_id := private.demo_session_for_user(v_user_id);

  elsif tg_table_name in ('user_locations', 'matching_preferences', 'notifications') then
    v_user_id := (v_json ->> 'user_id')::uuid;
    v_is_demo := private.is_demo_user(v_user_id);
    v_session_id := private.demo_session_for_user(v_user_id);

  elsif tg_table_name = 'study_groups' then
    v_user_id := (v_json ->> 'created_by')::uuid;
    v_is_demo := private.is_demo_user(v_user_id);
    v_session_id := private.demo_session_for_user(v_user_id);

  elsif tg_table_name = 'connections' then
    v_user_id := (v_json ->> 'initiator_id')::uuid;
    v_other_user_id := (v_json ->> 'recipient_id')::uuid;
    v_session_id := private.demo_session_for_user(v_user_id);
    v_other_session_id := private.demo_session_for_user(v_other_user_id);
    if (v_session_id is null) <> (v_other_session_id is null)
      or (v_session_id is not null and v_session_id <> v_other_session_id) then
      raise exception 'A demo account can connect only inside its own demo session'
        using errcode = '42501';
    end if;
    v_is_demo := v_session_id is not null;

  elsif tg_table_name = 'direct_messages' then
    v_connection_id := (v_json ->> 'connection_id')::uuid;
    v_user_id := (v_json ->> 'sender_id')::uuid;
    select c.is_demo, c.demo_session_id, c.initiator_id, c.recipient_id
      into v_connection_demo, v_connection_session, v_other_user_id, v_group_id
    from public.connections c where c.id = v_connection_id;
    if not found or v_user_id not in (v_other_user_id, v_group_id) then
      raise exception 'Message sender is not a connection participant' using errcode = '42501';
    end if;
    if v_connection_demo and private.demo_session_for_user(v_user_id) <> v_connection_session then
      raise exception 'Demo message session mismatch' using errcode = '42501';
    end if;
    if not v_connection_demo and private.is_demo_user(v_user_id) then
      raise exception 'Demo account cannot message a non-demo connection' using errcode = '42501';
    end if;
    v_is_demo := v_connection_demo;
    v_session_id := v_connection_session;

  elsif tg_table_name in (
    'group_members', 'group_invites', 'group_messages',
    'group_agenda_items', 'group_materials'
  ) then
    v_group_id := (v_json ->> 'group_id')::uuid;
    if tg_table_name = 'group_members' then
      v_user_id := (v_json ->> 'user_id')::uuid;
    elsif tg_table_name = 'group_invites' then
      v_user_id := (v_json ->> 'invited_user_id')::uuid;
      v_other_user_id := (v_json ->> 'invited_by')::uuid;
    elsif tg_table_name = 'group_messages' then
      v_user_id := (v_json ->> 'sender_id')::uuid;
    elsif tg_table_name = 'group_agenda_items' then
      v_user_id := (v_json ->> 'created_by')::uuid;
    else
      v_user_id := (v_json ->> 'uploaded_by')::uuid;
    end if;

    select g.is_demo, g.demo_session_id
      into v_group_demo, v_group_session
    from public.study_groups g where g.id = v_group_id;
    if not found then raise exception 'Demo group does not exist'; end if;

    v_session_id := private.demo_session_for_user(v_user_id);
    if v_group_demo <> (v_session_id is not null)
      or (v_group_demo and v_session_id <> v_group_session) then
      raise exception 'Group activity is outside the account demo session'
        using errcode = '42501';
    end if;
    if tg_table_name = 'group_invites' and v_other_user_id is not null
      and private.demo_session_for_user(v_other_user_id) is distinct from v_group_session then
      raise exception 'Invitation sender is outside the group demo session'
        using errcode = '42501';
    end if;
    v_is_demo := v_group_demo;
    v_session_id := v_group_session;

  elsif tg_table_name = 'group_agenda_votes' then
    v_agenda_item_id := (v_json ->> 'agenda_item_id')::uuid;
    v_user_id := (v_json ->> 'user_id')::uuid;
    select g.is_demo, g.demo_session_id
      into v_group_demo, v_group_session
    from public.group_agenda_items a
    join public.study_groups g on g.id = a.group_id
    where a.id = v_agenda_item_id;
    if not found then raise exception 'Agenda item does not exist'; end if;
    v_session_id := private.demo_session_for_user(v_user_id);
    if v_group_demo <> (v_session_id is not null)
      or (v_group_demo and v_session_id <> v_group_session) then
      raise exception 'Poll vote is outside the account demo session'
        using errcode = '42501';
    end if;
    v_is_demo := v_group_demo;
    v_session_id := v_group_session;

  else
    raise exception 'Unsupported demo scope trigger table: %', tg_table_name;
  end if;

  v_json := jsonb_set(v_json, '{is_demo}', to_jsonb(v_is_demo), true);
  v_json := jsonb_set(
    v_json,
    '{demo_session_id}',
    coalesce(to_jsonb(v_session_id), 'null'::jsonb),
    true
  );
  return jsonb_populate_record(new, v_json);
end
$function$;

create trigger profiles_demo_scope
before insert or update on public.profiles
for each row execute function private.sync_demo_scope();
create trigger user_locations_demo_scope
before insert or update on public.user_locations
for each row execute function private.sync_demo_scope();
create trigger matching_preferences_demo_scope
before insert or update on public.matching_preferences
for each row execute function private.sync_demo_scope();
create trigger connections_demo_scope
before insert or update on public.connections
for each row execute function private.sync_demo_scope();
create trigger direct_messages_demo_scope
before insert or update on public.direct_messages
for each row execute function private.sync_demo_scope();
create trigger study_groups_demo_scope
before insert or update on public.study_groups
for each row execute function private.sync_demo_scope();
create trigger group_members_demo_scope
before insert or update on public.group_members
for each row execute function private.sync_demo_scope();
create trigger group_invites_demo_scope
before insert or update on public.group_invites
for each row execute function private.sync_demo_scope();
create trigger group_messages_demo_scope
before insert or update on public.group_messages
for each row execute function private.sync_demo_scope();
create trigger group_agenda_items_demo_scope
before insert or update on public.group_agenda_items
for each row execute function private.sync_demo_scope();
create trigger group_materials_demo_scope
before insert or update on public.group_materials
for each row execute function private.sync_demo_scope();
create trigger group_agenda_votes_demo_scope
before insert or update on public.group_agenda_votes
for each row execute function private.sync_demo_scope();
create trigger notifications_demo_scope
before insert or update on public.notifications
for each row execute function private.sync_demo_scope();

-- Expose only self-owned profile rows to the authenticated browser role.
-- The existing profiles_select_self policy remains the row boundary.
grant select on table public.profiles to authenticated;

-- Prevent direct manipulation of server-owned demo markers.
revoke update (is_demo, demo_session_id) on public.profiles from authenticated;
revoke update (is_demo, demo_session_id) on public.user_locations from authenticated;
revoke update (is_demo, demo_session_id) on public.matching_preferences from authenticated;
revoke update (is_demo, demo_session_id) on public.connections from authenticated;
revoke update (is_demo, demo_session_id) on public.direct_messages from authenticated;
revoke update (is_demo, demo_session_id) on public.study_groups from authenticated;
revoke update (is_demo, demo_session_id) on public.group_members from authenticated;
revoke update (is_demo, demo_session_id) on public.group_invites from authenticated;
revoke update (is_demo, demo_session_id) on public.group_messages from authenticated;
revoke update (is_demo, demo_session_id) on public.group_agenda_items from authenticated;
revoke update (is_demo, demo_session_id) on public.group_materials from authenticated;
revoke update (is_demo, demo_session_id) on public.group_agenda_votes from authenticated;
revoke update (is_demo, demo_session_id) on public.notifications from authenticated;

-- Restrictive policies stop the existing permissive feature policies from crossing demo sessions.
create policy demo_scope_guard on public.profiles as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.user_locations as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.matching_preferences as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.connections as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.direct_messages as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.study_groups as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.group_members as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.group_invites as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.group_messages as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.group_agenda_items as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.group_materials as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.group_agenda_votes as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

create policy demo_scope_guard on public.notifications as restrictive
for all to authenticated
using (private.can_access_demo_scope(is_demo, demo_session_id))
with check (private.can_access_demo_scope(is_demo, demo_session_id));

grant execute on function private.demo_session_for_user(uuid) to authenticated;
grant execute on function private.is_demo_user(uuid) to authenticated;
grant execute on function private.can_access_demo_scope(boolean, uuid) to authenticated;
grant execute on function private.same_demo_session(uuid, uuid) to authenticated;

-- Nearby search keeps the original radius, distance rounding, jitter, radar consent, and NIM rules.
drop function if exists public.find_matching_students(integer);
drop function if exists public.find_nearby_students(uuid, integer, text);

create function public.find_nearby_students(
  p_viewer_id uuid,
  p_radius_m integer,
  p_nim_digest text default null
)
returns table (
  student_id uuid,
  initials text,
  program text,
  approx_distance_m integer,
  marker_lat double precision,
  marker_lng double precision,
  is_demo boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_viewer_id is null then raise exception 'Viewer is required'; end if;
  if p_radius_m not in (1000, 3000, 5000) then raise exception 'Radius must be 1000, 3000, or 5000 meters'; end if;
  if not private.is_verified_user(p_viewer_id) then return; end if;

  if p_nim_digest is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_viewer_id::text, 0));
    insert into private.nim_search_events(searcher_id) values(p_viewer_id);
    if (select count(*) from private.nim_search_events e
        where e.searcher_id=p_viewer_id and e.created_at>now()-interval '1 minute')>5 then
      raise exception 'NIM search rate limit exceeded';
    end if;
  end if;

  return query
  with viewer as (
    select ul.location from public.user_locations ul
    where ul.user_id=p_viewer_id
  ), candidates as (
    select p.id,p.full_name,p.program,p.is_demo,ul.location,
      v.location as viewer_location,
      extensions.st_distance(ul.location,v.location) as exact_distance,
      decode(md5(p_viewer_id::text||':'||p.id::text||':'||current_date::text),'hex') as jitter
    from public.profiles p
    join public.user_locations ul on ul.user_id=p.id
    cross join viewer v
    where p.id<>p_viewer_id
      and private.is_verified_user(p.id)
      and private.same_demo_session(p_viewer_id,p.id)
      and ul.show_in_radar=true
      and extensions.st_dwithin(ul.location,v.location,p_radius_m)
      and (p_nim_digest is null or p.nim_digest=p_nim_digest)
      and not private.is_blocked_between(p_viewer_id,p.id)
  ), jittered as (
    select c.*,
      extensions.st_project(c.location,
        (100+(get_byte(c.jitter,0)%151))::double precision,
        ((get_byte(c.jitter,1)*256+get_byte(c.jitter,2))::double precision/65535.0)*2.0*pi()
      ) as raw_marker,
      extensions.st_azimuth(c.viewer_location,c.location) as target_bearing
    from candidates c
  ), bounded as (
    select j.*,
      case when extensions.st_dwithin(j.raw_marker,j.viewer_location,p_radius_m)
        then j.raw_marker
        else extensions.st_project(j.viewer_location,greatest(0.0,p_radius_m-100.0),j.target_bearing)
      end as marker
    from jittered j
  )
  select b.id,
    upper(left(split_part(b.full_name,' ',1),1)||left(coalesce(nullif(split_part(b.full_name,' ',2),''),split_part(b.full_name,' ',1)),1)),
    b.program,
    case when b.exact_distance<1000 then greatest(100,round(b.exact_distance/100.0)*100)::integer
      else greatest(500,round(b.exact_distance/500.0)*500)::integer end,
    extensions.st_y(b.marker::extensions.geometry),
    extensions.st_x(b.marker::extensions.geometry),
    b.is_demo
  from bounded b order by b.exact_distance asc limit 10;
end
$function$;

create function public.find_matching_students(p_radius_m integer default 3000)
returns table (
  student_id uuid,
  initials text,
  program text,
  approx_distance_m integer,
  course_names text[],
  topic_tags text[],
  interests text[],
  study_times text[],
  is_demo boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_search_count integer;
begin
  if v_actor_id is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;
  if p_radius_m is null or p_radius_m not in (1000, 3000, 5000) then
    raise exception 'Radius must be 1000, 3000, or 5000 meters';
  end if;
  if not private.is_current_user_verified() then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text, 42));
  delete from private.match_search_events e
    where e.searcher_id = v_actor_id
      and e.created_at < now() - interval '30 days';

  select count(*) into v_search_count
    from private.match_search_events e
    where e.searcher_id = v_actor_id
      and e.created_at > now() - interval '10 minutes';

  if v_search_count >= 30 then
    raise exception 'Matching search rate limit exceeded' using errcode = '54000';
  end if;

  insert into private.match_search_events(searcher_id) values(v_actor_id);

  return query
  with nearby as (
    select n.student_id,n.initials,n.program,n.approx_distance_m,n.is_demo
    from public.find_nearby_students(v_actor_id,p_radius_m,null::text) n
  )
  select
    n.student_id,
    n.initials,
    n.program,
    n.approx_distance_m,
    coalesce(courses.course_names,array[]::text[]),
    coalesce(mp.topic_tags,array[]::text[]),
    coalesce(mp.interests,array[]::text[]),
    coalesce(mp.study_times,array[]::text[]),
    n.is_demo
  from nearby n
  left join public.matching_preferences mp on mp.user_id=n.student_id
  left join lateral (
    select array_agg(c.course_name order by c.course_name) as course_names
    from public.profile_courses pc
    join public.courses c on c.id=pc.course_id and c.is_active=true
    where pc.user_id=n.student_id
  ) courses on true
  order by n.approx_distance_m asc
  limit 10;
end
$function$;

create or replace function public.get_my_connection_summaries()
returns table (
  connection_id uuid,
  other_student_id uuid,
  initials text,
  program text,
  status public.connection_status,
  created_at timestamptz,
  is_incoming boolean,
  is_demo boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not private.is_current_user_verified() then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    case when c.initiator_id=v_actor_id then c.recipient_id else c.initiator_id end,
    upper(left(split_part(p.full_name,' ',1),1)||left(coalesce(nullif(split_part(p.full_name,' ',2),''),split_part(p.full_name,' ',1)),1)),
    p.program,
    c.status,
    c.created_at,
    c.recipient_id=v_actor_id,
    p.is_demo
  from public.connections c
  join public.profiles p on p.id=case when c.initiator_id=v_actor_id then c.recipient_id else c.initiator_id end
  where (c.initiator_id=v_actor_id or c.recipient_id=v_actor_id)
    and private.is_verified_user(p.id)
    and private.same_demo_session(v_actor_id,p.id)
    and not private.is_blocked_between(v_actor_id,p.id)
  order by c.created_at desc
  limit 100;
end
$function$;

drop function if exists public.get_my_chat_rooms();
create function public.get_my_chat_rooms()
returns table (
  connection_id uuid,
  other_user_id uuid,
  other_full_name text,
  avatar_path text,
  program text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  is_demo boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not private.is_current_user_verified() then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    other_profile.id,
    other_profile.full_name,
    other_profile.avatar_path,
    other_profile.program,
    latest_message.body,
    latest_message.created_at,
    (
      select count(*)::bigint
      from public.direct_messages unread
      where unread.connection_id=c.id
        and unread.sender_id<>v_actor_id
        and unread.read_at is null
    ),
    other_profile.is_demo
  from public.connections c
  join public.profiles other_profile
    on other_profile.id=case when c.initiator_id=v_actor_id then c.recipient_id else c.initiator_id end
  left join lateral (
    select dm.body,dm.created_at
    from public.direct_messages dm
    where dm.connection_id=c.id
    order by dm.created_at desc limit 1
  ) latest_message on true
  where (c.initiator_id=v_actor_id or c.recipient_id=v_actor_id)
    and c.status='accepted'::public.connection_status
    and private.is_verified_user(other_profile.id)
    and private.same_demo_session(v_actor_id,other_profile.id)
    and not private.is_blocked_between(v_actor_id,other_profile.id)
  order by coalesce(latest_message.created_at,c.updated_at,c.created_at) desc
  limit 100;
end
$function$;

revoke all on function public.find_nearby_students(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.find_nearby_students(uuid,integer,text) to service_role;

revoke all on function public.find_matching_students(integer) from public, anon;
grant execute on function public.find_matching_students(integer) to authenticated, service_role;

revoke all on function public.get_my_connection_summaries() from public, anon;
grant execute on function public.get_my_connection_summaries() to authenticated, service_role;

revoke all on function public.get_my_chat_rooms() from public, anon;
grant execute on function public.get_my_chat_rooms() to authenticated, service_role;

-- Realtime payloads remain filtered by RLS and now carry an explicit, immutable demo marker.


-- Server-only helpers for the demo-mode Edge Function.
-- These routines are never callable by anon/authenticated browser requests.
create or replace function public.demo_create_session(p_visitor_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_metadata jsonb;
begin
  if p_visitor_user_id is null then
    raise exception 'Demo visitor is required' using errcode = '22023';
  end if;

  select u.raw_app_meta_data into v_metadata
  from auth.users u
  where u.id = p_visitor_user_id
    and u.is_anonymous = true
  for update;

  if not found then
    raise exception 'Only an anonymous demo visitor session can be bootstrapped'
      using errcode = '42501';
  end if;

  select s.id into v_session_id
  from private.demo_sessions s
  where s.visitor_user_id = p_visitor_user_id
  for update;

  if v_session_id is null then
    v_session_id := gen_random_uuid();
    insert into private.demo_sessions(id, visitor_user_id, status, expires_at)
    values (v_session_id, p_visitor_user_id, 'active', now() + interval '8 hours');
  else
    update private.demo_sessions
    set status = 'active',
        expires_at = now() + interval '8 hours',
        reset_at = now()
    where id = v_session_id;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(v_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'utconnect_demo_role', 'visitor',
        'utconnect_demo_session', v_session_id::text
      ),
      updated_at = now()
  where id = p_visitor_user_id;

  return v_session_id;
end
$function$;

create or replace function public.demo_get_session(p_visitor_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select private.demo_session_for_user(p_visitor_user_id)
$function$;

create or replace function public.demo_claim_bot_event(
  p_session_id uuid,
  p_event_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_session_id is null or p_event_key is null
    or char_length(p_event_key) not between 1 and 180 then
    raise exception 'Demo event key is invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from private.demo_sessions s
    where s.id = p_session_id and s.status = 'active' and s.expires_at > now()
  ) then
    raise exception 'Demo session has expired' using errcode = '42501';
  end if;

  insert into private.demo_bot_events(session_id, event_key)
  values (p_session_id, p_event_key)
  on conflict (session_id, event_key) do nothing;

  return found;
end
$function$;

create or replace function public.demo_add_bot_member(
  p_session_id uuid,
  p_group_id uuid,
  p_bot_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group public.study_groups%rowtype;
  v_count integer;
begin
  select * into v_group
  from public.study_groups g
  where g.id = p_group_id
    and g.is_demo = true
    and g.demo_session_id = p_session_id
    and not g.is_archived
  for update;

  if not found then raise exception 'Demo group not found'; end if;
  if private.demo_session_for_user(p_bot_user_id) is distinct from p_session_id then
    raise exception 'Bot is outside this demo session' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.status = 'active'::public.group_member_status;

  if v_count >= v_group.capacity then
    raise exception 'Group is full' using errcode = '23514';
  end if;

  insert into public.group_members(group_id, user_id, role, status, joined_at)
  values (
    p_group_id,
    p_bot_user_id,
    'member'::public.group_member_role,
    'active'::public.group_member_status,
    now()
  )
  on conflict (group_id, user_id) do update
    set status = 'active'::public.group_member_status,
        joined_at = now(),
        updated_at = now();

  return true;
end
$function$;

create or replace function public.demo_approve_join_request(
  p_session_id uuid,
  p_group_id uuid,
  p_bot_admin_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group public.study_groups%rowtype;
  v_count integer;
begin
  select * into v_group
  from public.study_groups g
  where g.id = p_group_id
    and g.is_demo = true
    and g.demo_session_id = p_session_id
    and not g.is_archived
  for update;

  if not found then raise exception 'Demo group not found'; end if;
  if private.demo_session_for_user(p_bot_admin_id) is distinct from p_session_id
    or private.demo_session_for_user(p_user_id) is distinct from p_session_id then
    raise exception 'Demo approval users are outside the group session'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_bot_admin_id
      and gm.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
      and gm.status = 'active'::public.group_member_status
  ) then
    raise exception 'Demo approval actor is not a group administrator'
      using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.status = 'active'::public.group_member_status;

  if v_count >= v_group.capacity then
    raise exception 'Group is full' using errcode = '23514';
  end if;

  update public.group_members gm
  set status = 'active'::public.group_member_status,
      joined_at = now(),
      updated_at = now()
  where gm.group_id = p_group_id
    and gm.user_id = p_user_id
    and gm.status = 'pending'::public.group_member_status;

  if not found then raise exception 'Pending demo join request not found'; end if;
  return true;
end
$function$;

revoke all on function public.demo_create_session(uuid) from public, anon, authenticated;
revoke all on function public.demo_get_session(uuid) from public, anon, authenticated;
revoke all on function public.demo_claim_bot_event(uuid, text) from public, anon, authenticated;
revoke all on function public.demo_add_bot_member(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.demo_approve_join_request(uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.demo_create_session(uuid) to service_role;
grant execute on function public.demo_get_session(uuid) to service_role;
grant execute on function public.demo_claim_bot_event(uuid, text) to service_role;
grant execute on function public.demo_add_bot_member(uuid, uuid, uuid) to service_role;
grant execute on function public.demo_approve_join_request(uuid, uuid, uuid, uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-materials',
  'group-materials',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]::text[]
)
on conflict (id) do nothing;


-- Harden SECURITY DEFINER group workflows against cross-demo-session access.
-- RLS restrictive policies do not protect calls that deliberately run as the function owner,
-- so the session boundary must also be checked inside these RPCs.
create or replace function public.join_study_group(p_actor_id uuid, p_group_id uuid)
returns public.group_member_status
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group public.study_groups%rowtype;
  v_existing public.group_members%rowtype;
  v_status public.group_member_status;
  v_count integer;
  v_invite_id uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified student account required';
  end if;

  select * into v_group
  from public.study_groups g
  where g.id = p_group_id and not g.is_archived
  for update;
  if not found then raise exception 'Group not found or archived'; end if;

  if not private.same_demo_session(p_actor_id, v_group.created_by) then
    raise exception 'Group belongs to a different demo session' using errcode = '42501';
  end if;

  select * into v_existing
  from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id = p_actor_id;
  if found and v_existing.status in (
    'active'::public.group_member_status,
    'pending'::public.group_member_status
  ) then
    return v_existing.status;
  end if;

  if v_group.access_type = 'private'::public.group_access_type then
    select gi.id into v_invite_id
    from public.group_invites gi
    where gi.group_id = p_group_id
      and gi.invited_user_id = p_actor_id
      and gi.accepted_at is null
    for update;
    if v_invite_id is null then
      raise exception 'Private group invitation required';
    end if;
  end if;

  select count(*) into v_count
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.status = 'active'::public.group_member_status;
  if v_count >= v_group.capacity then raise exception 'Group is full'; end if;

  v_status := case
    when v_group.access_type = 'approval'::public.group_access_type
      then 'pending'::public.group_member_status
    else 'active'::public.group_member_status
  end;

  insert into public.group_members(group_id, user_id, role, status, joined_at)
  values (
    p_group_id, p_actor_id, 'member'::public.group_member_role, v_status,
    case when v_status = 'active'::public.group_member_status then now() else null end
  )
  on conflict(group_id, user_id) do update
    set role = 'member'::public.group_member_role,
        status = excluded.status,
        joined_at = excluded.joined_at,
        updated_at = now();

  if v_invite_id is not null then
    update public.group_invites set accepted_at = now() where id = v_invite_id;
  end if;
  return v_status;
end
$function$;

create or replace function public.respond_group_join_request(
  p_actor_id uuid,
  p_group_id uuid,
  p_user_id uuid,
  p_accept boolean
)
returns public.group_member_status
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group public.study_groups%rowtype;
  v_count integer;
  v_status public.group_member_status;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified group admin account required' using errcode = '42501';
  end if;
  if p_user_id is null or p_accept is null then
    raise exception 'Invalid join request decision';
  end if;

  select * into v_group
  from public.study_groups g
  where g.id = p_group_id
  for update;
  if not found then raise exception 'Group not found'; end if;

  if not private.same_demo_session(p_actor_id, v_group.created_by)
    or not private.same_demo_session(p_user_id, v_group.created_by) then
    raise exception 'Group request belongs to a different demo session' using errcode = '42501';
  end if;

  if not private.is_current_user_group_admin(p_group_id) then
    raise exception 'Group admin permission required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.status = 'pending'::public.group_member_status
    for update
  ) then
    raise exception 'Join request not found';
  end if;

  if p_accept then
    select count(*) into v_count
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.status = 'active'::public.group_member_status;
    if v_count >= v_group.capacity then raise exception 'Group is full'; end if;
    v_status := 'active'::public.group_member_status;
  else
    v_status := 'rejected'::public.group_member_status;
  end if;

  update public.group_members
  set status = v_status,
      joined_at = case when p_accept then now() else null end,
      updated_at = now()
  where group_id = p_group_id and user_id = p_user_id;
  return v_status;
end;
$function$;

create or replace function public.get_group_agenda_poll_results(
  p_actor_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_group_creator uuid;
  v_options jsonb;
  v_results jsonb;
  v_total bigint;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  select item.group_id, item.poll_options, group_row.created_by
  into v_group_id, v_options, v_group_creator
  from public.group_agenda_items item
  join public.study_groups group_row on group_row.id = item.group_id
  where item.id = p_item_id
    and item.item_type = 'poll'::public.group_agenda_type;

  if v_group_id is null then raise exception 'Poll not found'; end if;
  if not private.same_demo_session(p_actor_id, v_group_creator) then
    raise exception 'Poll belongs to a different demo session' using errcode = '42501';
  end if;
  if not private.is_current_user_active_group_member(v_group_id) then
    raise exception 'Active verified group membership required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_options) <> 'array' then raise exception 'Poll options are invalid'; end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object('option', options.value, 'votes', coalesce(counts.vote_count, 0))
      order by options.ordinality
    ), '[]'::jsonb),
    coalesce(sum(coalesce(counts.vote_count, 0)), 0)::bigint
  into v_results, v_total
  from jsonb_array_elements_text(v_options) with ordinality as options(value, ordinality)
  left join (
    select vote.selected_option, count(*)::bigint as vote_count
    from public.group_agenda_votes vote
    where vote.agenda_item_id = p_item_id
    group by vote.selected_option
  ) counts on counts.selected_option = options.value;

  return jsonb_build_object('options', v_results, 'total_votes', v_total);
end;
$function$;

create or replace function public.cast_group_agenda_vote(
  p_actor_id uuid,
  p_item_id uuid,
  p_option text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_group_creator uuid;
  v_options jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;
  if p_option is null or char_length(trim(p_option)) not between 1 and 100 then
    raise exception 'Poll option is invalid';
  end if;

  select item.group_id, item.poll_options, group_row.created_by
  into v_group_id, v_options, v_group_creator
  from public.group_agenda_items item
  join public.study_groups group_row on group_row.id = item.group_id
  where item.id = p_item_id
    and item.item_type = 'poll'::public.group_agenda_type
  for update of item;

  if v_group_id is null then raise exception 'Poll not found'; end if;
  if not private.same_demo_session(p_actor_id, v_group_creator) then
    raise exception 'Poll belongs to a different demo session' using errcode = '42501';
  end if;
  if not private.is_current_user_active_group_member(v_group_id) then
    raise exception 'Active verified group membership required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_options) <> 'array' or not (v_options @> jsonb_build_array(trim(p_option))) then
    raise exception 'Option is not available in this poll';
  end if;

  insert into public.group_agenda_votes(agenda_item_id, user_id, selected_option)
  values (p_item_id, p_actor_id, trim(p_option))
  on conflict (agenda_item_id, user_id) do update
    set selected_option = excluded.selected_option,
        updated_at = now();
  return public.get_group_agenda_poll_results(p_actor_id, p_item_id);
end;
$function$;

create or replace function public.create_group_invite(
  p_actor_id uuid,
  p_group_id uuid,
  p_invited_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group public.study_groups%rowtype;
  v_invite_id uuid;
  v_active_count integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if p_invited_user_id is null or p_invited_user_id = p_actor_id then
    raise exception 'A different verified student must be invited';
  end if;
  if not private.is_verified_user(p_actor_id) or not private.is_verified_user(p_invited_user_id) then
    raise exception 'Both accounts must be verified students' using errcode = '42501';
  end if;

  select * into v_group
  from public.study_groups g
  where g.id = p_group_id
    and g.is_archived = false
    and g.access_type = 'private'::public.group_access_type
  for update;
  if not found then raise exception 'Active private group not found'; end if;

  if not private.same_demo_session(p_actor_id, v_group.created_by)
    or not private.same_demo_session(p_invited_user_id, v_group.created_by) then
    raise exception 'Invitation target belongs to a different demo session' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_actor_id
      and gm.status = 'active'::public.group_member_status
      and gm.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
  ) then
    raise exception 'Active group admin permission required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_invited_user_id
      and gm.status in ('active'::public.group_member_status, 'pending'::public.group_member_status)
  ) then
    raise exception 'Student is already a member or has a pending request';
  end if;

  select count(*)::integer into v_active_count
  from public.group_members gm
  where gm.group_id = p_group_id and gm.status = 'active'::public.group_member_status;
  if v_active_count >= v_group.capacity then raise exception 'Group is full'; end if;

  insert into public.group_invites(group_id, invited_user_id, invited_by, accepted_at)
  values (p_group_id, p_invited_user_id, p_actor_id, null)
  on conflict (group_id, invited_user_id) do update
    set invited_by = excluded.invited_by, accepted_at = null
  returning id into v_invite_id;
  return v_invite_id;
end;
$function$;

create or replace function public.cancel_group_invite(
  p_actor_id uuid,
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invite public.group_invites%rowtype;
  v_group_creator uuid;
  v_is_manager boolean;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;

  select * into v_invite
  from public.group_invites gi
  where gi.id = p_invite_id
  for update;
  if not found or v_invite.accepted_at is not null then
    raise exception 'Pending invitation not found';
  end if;

  select g.created_by into v_group_creator
  from public.study_groups g where g.id = v_invite.group_id;
  if v_group_creator is null
    or not private.same_demo_session(p_actor_id, v_group_creator)
    or not private.same_demo_session(v_invite.invited_user_id, v_group_creator) then
    raise exception 'Invitation belongs to a different demo session' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.group_members gm
    where gm.group_id = v_invite.group_id
      and gm.user_id = p_actor_id
      and gm.status = 'active'::public.group_member_status
      and gm.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
  ) into v_is_manager;
  if v_invite.invited_user_id <> p_actor_id and not v_is_manager then
    raise exception 'Invitation owner or group admin permission required' using errcode = '42501';
  end if;

  delete from public.group_invites where id = p_invite_id;
end;
$function$;

create or replace function public.set_group_message_pin(
  p_actor_id uuid,
  p_message_id uuid,
  p_pin boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_group_creator uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if p_pin is null then raise exception 'Pin state is required'; end if;

  select message.group_id, group_row.created_by
  into v_group_id, v_group_creator
  from public.group_messages message
  join public.study_groups group_row on group_row.id = message.group_id
  where message.id = p_message_id;
  if v_group_id is null then raise exception 'Message not found'; end if;
  if not private.same_demo_session(p_actor_id, v_group_creator) then
    raise exception 'Message belongs to a different demo session' using errcode = '42501';
  end if;

  if not private.is_current_user_group_admin(v_group_id) then
    raise exception 'Active group admin permission required' using errcode = '42501';
  end if;

  update public.group_messages
  set pinned_at = case when p_pin then now() else null end,
      pinned_by = case when p_pin then p_actor_id else null end
  where id = p_message_id;
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
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  return query
  select gi.id, g.id, g.name, g.description, gi.created_at
  from public.group_invites gi
  join public.study_groups g on g.id = gi.group_id
  where gi.invited_user_id = p_actor_id
    and gi.accepted_at is null
    and not g.is_archived
    and private.same_demo_session(p_actor_id, g.created_by)
  order by gi.created_at desc
  limit 50;
end;
$function$;


-- Expired demo identities must never be treated as ordinary non-demo accounts.
create or replace function private.same_demo_session(
  p_left_user_id uuid,
  p_right_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_left uuid := private.demo_session_for_user(p_left_user_id);
  v_right uuid := private.demo_session_for_user(p_right_user_id);
  v_left_is_demo boolean := false;
  v_right_is_demo boolean := false;
begin
  select coalesce(
    u.raw_app_meta_data ->> 'utconnect_demo_role' in ('visitor', 'bot'),
    false
  ) into v_left_is_demo
  from auth.users u
  where u.id = p_left_user_id;

  select coalesce(
    u.raw_app_meta_data ->> 'utconnect_demo_role' in ('visitor', 'bot'),
    false
  ) into v_right_is_demo
  from auth.users u
  where u.id = p_right_user_id;

  if v_left_is_demo or v_right_is_demo then
    return v_left is not null and v_left = v_right;
  end if;

  return true;
end
$function$;


-- Preserve immutable demo identity markers after expiry, while access checks still require an active session.
create or replace function private.demo_identity_session_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when u.raw_app_meta_data ->> 'utconnect_demo_role' in ('visitor', 'bot')
      and coalesce(u.raw_app_meta_data ->> 'utconnect_demo_session', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (u.raw_app_meta_data ->> 'utconnect_demo_session')::uuid
    else null
  end
  from auth.users u
  where u.id = p_user_id
$function$;

create or replace function private.sync_demo_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_json jsonb := to_jsonb(new);
  v_user_id uuid;
  v_other_user_id uuid;
  v_group_id uuid;
  v_connection_id uuid;
  v_agenda_item_id uuid;
  v_is_demo boolean := false;
  v_session_id uuid;
  v_other_session_id uuid;
  v_group_demo boolean;
  v_group_session uuid;
  v_connection_demo boolean;
  v_connection_session uuid;
begin
  if tg_table_name = 'profiles' then
    v_user_id := (v_json ->> 'id')::uuid;
    v_session_id := private.demo_identity_session_id(v_user_id);

  elsif tg_table_name in ('user_locations', 'matching_preferences', 'notifications') then
    v_user_id := (v_json ->> 'user_id')::uuid;
    v_session_id := private.demo_identity_session_id(v_user_id);

  elsif tg_table_name = 'study_groups' then
    v_user_id := (v_json ->> 'created_by')::uuid;
    v_session_id := private.demo_identity_session_id(v_user_id);

  elsif tg_table_name = 'connections' then
    v_user_id := (v_json ->> 'initiator_id')::uuid;
    v_other_user_id := (v_json ->> 'recipient_id')::uuid;
    v_session_id := private.demo_identity_session_id(v_user_id);
    v_other_session_id := private.demo_identity_session_id(v_other_user_id);
    if (v_session_id is null) <> (v_other_session_id is null)
      or (v_session_id is not null and v_session_id is distinct from v_other_session_id) then
      raise exception 'A demo account can connect only inside its own demo session'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'direct_messages' then
    v_connection_id := (v_json ->> 'connection_id')::uuid;
    v_user_id := (v_json ->> 'sender_id')::uuid;
    select c.is_demo, c.demo_session_id, c.initiator_id, c.recipient_id
      into v_connection_demo, v_connection_session, v_other_user_id, v_group_id
    from public.connections c where c.id = v_connection_id;
    if not found or v_user_id not in (v_other_user_id, v_group_id) then
      raise exception 'Message sender is not a connection participant' using errcode = '42501';
    end if;
    v_session_id := private.demo_identity_session_id(v_user_id);
    if v_connection_demo and v_session_id is distinct from v_connection_session then
      raise exception 'Demo message session mismatch' using errcode = '42501';
    end if;
    if not v_connection_demo and v_session_id is not null then
      raise exception 'Demo account cannot message a non-demo connection' using errcode = '42501';
    end if;
    v_is_demo := v_connection_demo;
    v_session_id := v_connection_session;

  elsif tg_table_name in (
    'group_members', 'group_invites', 'group_messages',
    'group_agenda_items', 'group_materials'
  ) then
    v_group_id := (v_json ->> 'group_id')::uuid;
    if tg_table_name = 'group_members' then
      v_user_id := (v_json ->> 'user_id')::uuid;
    elsif tg_table_name = 'group_invites' then
      v_user_id := (v_json ->> 'invited_user_id')::uuid;
      v_other_user_id := (v_json ->> 'invited_by')::uuid;
    elsif tg_table_name = 'group_messages' then
      v_user_id := (v_json ->> 'sender_id')::uuid;
    elsif tg_table_name = 'group_agenda_items' then
      v_user_id := (v_json ->> 'created_by')::uuid;
    else
      v_user_id := (v_json ->> 'uploaded_by')::uuid;
    end if;

    select g.is_demo, g.demo_session_id
      into v_group_demo, v_group_session
    from public.study_groups g where g.id = v_group_id;
    if not found then raise exception 'Demo group does not exist'; end if;

    v_session_id := private.demo_identity_session_id(v_user_id);
    if v_group_demo <> (v_session_id is not null)
      or (v_group_demo and v_session_id is distinct from v_group_session) then
      raise exception 'Group activity is outside the account demo session'
        using errcode = '42501';
    end if;
    if tg_table_name = 'group_invites' and v_other_user_id is not null
      and private.demo_identity_session_id(v_other_user_id) is distinct from v_group_session then
      raise exception 'Invitation sender is outside the group demo session'
        using errcode = '42501';
    end if;
    v_is_demo := v_group_demo;
    v_session_id := v_group_session;

  elsif tg_table_name = 'group_agenda_votes' then
    v_agenda_item_id := (v_json ->> 'agenda_item_id')::uuid;
    v_user_id := (v_json ->> 'user_id')::uuid;
    select g.is_demo, g.demo_session_id
      into v_group_demo, v_group_session
    from public.group_agenda_items a
    join public.study_groups g on g.id = a.group_id
    where a.id = v_agenda_item_id;
    if not found then raise exception 'Agenda item does not exist'; end if;

    v_session_id := private.demo_identity_session_id(v_user_id);
    if v_group_demo <> (v_session_id is not null)
      or (v_group_demo and v_session_id is distinct from v_group_session) then
      raise exception 'Poll vote is outside the account demo session'
        using errcode = '42501';
    end if;
    v_is_demo := v_group_demo;
    v_session_id := v_group_session;

  else
    raise exception 'Unsupported demo scope trigger table: %', tg_table_name;
  end if;

  if tg_table_name in ('profiles', 'user_locations', 'matching_preferences', 'notifications', 'study_groups', 'connections') then
    v_is_demo := v_session_id is not null;
  end if;

  v_json := jsonb_set(v_json, '{is_demo}', to_jsonb(v_is_demo), true);
  v_json := jsonb_set(
    v_json,
    '{demo_session_id}',
    coalesce(to_jsonb(v_session_id), 'null'::jsonb),
    true
  );
  return jsonb_populate_record(new, v_json);
end
$function$;
