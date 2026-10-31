create table if not exists private.match_search_events (
  id bigint generated always as identity primary key,
  searcher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.match_search_events enable row level security;
revoke all on table private.match_search_events from public, anon, authenticated;
create index if not exists match_search_events_actor_created_idx
  on private.match_search_events(searcher_id, created_at desc);

create or replace function public.find_matching_students(p_radius_m integer default 3000)
returns table (
  student_id uuid,
  initials text,
  program text,
  approx_distance_m integer,
  course_names text[],
  topic_tags text[],
  interests text[],
  study_times text[]
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
    select n.student_id, n.initials, n.program, n.approx_distance_m
    from public.find_nearby_students(v_actor_id, p_radius_m, null::text) n
  )
  select
    n.student_id,
    n.initials,
    n.program,
    n.approx_distance_m,
    coalesce(courses.course_names, array[]::text[]),
    coalesce(mp.topic_tags, array[]::text[]),
    coalesce(mp.interests, array[]::text[]),
    coalesce(mp.study_times, array[]::text[])
  from nearby n
  left join public.matching_preferences mp on mp.user_id = n.student_id
  left join lateral (
    select array_agg(c.course_name order by c.course_name) as course_names
    from public.profile_courses pc
    join public.courses c on c.id = pc.course_id and c.is_active = true
    where pc.user_id = n.student_id
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
  is_incoming boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    case when c.initiator_id = v_actor_id then c.recipient_id else c.initiator_id end,
    upper(
      left(split_part(p.full_name, ' ', 1), 1) ||
      left(coalesce(nullif(split_part(p.full_name, ' ', 2), ''), split_part(p.full_name, ' ', 1)), 1)
    ),
    p.program,
    c.status,
    c.created_at,
    c.recipient_id = v_actor_id
  from public.connections c
  join public.profiles p
    on p.id = case when c.initiator_id = v_actor_id then c.recipient_id else c.initiator_id end
  where (c.initiator_id = v_actor_id or c.recipient_id = v_actor_id)
    and not private.is_blocked_between(v_actor_id, p.id)
  order by c.created_at desc
  limit 100;
end
$function$;

create or replace function public.respond_connection_request(
  p_connection_id uuid,
  p_accept boolean
)
returns public.connection_status
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_connection public.connections%rowtype;
  v_status public.connection_status;
begin
  if v_actor_id is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;
  if p_connection_id is null or p_accept is null then
    raise exception 'Invalid connection decision';
  end if;
  if not private.is_verified_user(v_actor_id) then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  select * into v_connection
  from public.connections c
  where c.id = p_connection_id
    and c.recipient_id = v_actor_id
    and c.status = 'pending'::public.connection_status
  for update;

  if not found then
    raise exception 'Incoming connection request not found';
  end if;
  if not private.is_verified_user(v_connection.initiator_id) then
    raise exception 'Requester is not a verified student';
  end if;
  if private.is_blocked_between(v_actor_id, v_connection.initiator_id) then
    raise exception 'Connection is not available';
  end if;

  v_status := case
    when p_accept then 'accepted'::public.connection_status
    else 'rejected'::public.connection_status
  end;

  update public.connections
    set status = v_status,
        updated_at = now()
    where id = v_connection.id;

  return v_status;
end
$function$;

revoke all on function public.find_matching_students(integer) from public, anon;
grant execute on function public.find_matching_students(integer) to authenticated, service_role;

revoke all on function public.get_my_connection_summaries() from public, anon;
grant execute on function public.get_my_connection_summaries() to authenticated, service_role;

revoke all on function public.respond_connection_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_connection_request(uuid, boolean) to authenticated, service_role;

grant insert on table public.connections to authenticated;
