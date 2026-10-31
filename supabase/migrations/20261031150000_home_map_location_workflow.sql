-- Home Map: owner-scoped location management and server-side nearby search limits.
-- Exact coordinates are returned only by the owner-only Edge Function.
create table if not exists private.nearby_search_events (
  event_id bigint generated always as identity primary key,
  searcher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists nearby_search_events_searcher_created_idx
  on private.nearby_search_events (searcher_id, created_at desc);

alter table private.nearby_search_events enable row level security;
revoke all on table private.nearby_search_events from public, anon, authenticated;

create or replace function public.get_my_location(p_user_id uuid)
returns table (
  latitude double precision,
  longitude double precision,
  show_in_radar boolean,
  consented_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    extensions.st_y(ul.location::extensions.geometry),
    extensions.st_x(ul.location::extensions.geometry),
    ul.show_in_radar,
    ul.consented_at
  from public.user_locations ul
  where ul.user_id = p_user_id
  limit 1;
$function$;

create or replace function public.save_my_location(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_consent boolean,
  p_show_in_radar boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_user_id
  ) then
    raise exception 'Authenticated user is required' using errcode = '22023';
  end if;

  if p_consent is distinct from true then
    raise exception 'Explicit location consent is required' using errcode = '22023';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Valid map coordinates are required' using errcode = '22023';
  end if;

  if p_show_in_radar is null then
    raise exception 'Radar visibility must be specified' using errcode = '22023';
  end if;

  insert into public.user_locations (
    user_id, location, show_in_radar, consented_at, updated_at
  )
  values (
    p_user_id,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    p_show_in_radar,
    case when p_show_in_radar then now() else null end,
    now()
  )
  on conflict (user_id) do update
    set location = excluded.location,
        show_in_radar = excluded.show_in_radar,
        consented_at = excluded.consented_at,
        updated_at = now();
end;
$function$;

create or replace function public.set_my_location_visibility(
  p_user_id uuid,
  p_show_in_radar boolean,
  p_consent boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null then
    raise exception 'Authenticated user is required' using errcode = '22023';
  end if;

  if p_show_in_radar is null then
    raise exception 'Radar visibility must be specified' using errcode = '22023';
  end if;

  if p_show_in_radar and p_consent is distinct from true then
    raise exception 'Explicit radar consent is required' using errcode = '22023';
  end if;

  update public.user_locations
  set show_in_radar = p_show_in_radar,
      consented_at = case when p_show_in_radar then now() else null end,
      updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception 'Location must be saved before radar visibility can be changed' using errcode = 'P0002';
  end if;

  return p_show_in_radar;
end;
$function$;

create or replace function public.consume_nearby_search_limit(p_viewer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recent_searches integer;
begin
  if p_viewer_id is null or not exists (
    select 1 from auth.users u where u.id = p_viewer_id
  ) then
    raise exception 'Authenticated viewer is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('utconnect-nearby:' || p_viewer_id::text, 0)
  );

  delete from private.nearby_search_events
  where searcher_id = p_viewer_id
    and created_at < now() - interval '1 hour';

  insert into private.nearby_search_events (searcher_id)
  values (p_viewer_id);

  select count(*)::integer
  into recent_searches
  from private.nearby_search_events
  where searcher_id = p_viewer_id
    and created_at >= now() - interval '1 minute';

  if recent_searches > 30 then
    raise exception 'NEARBY_RATE_LIMIT' using errcode = 'P0001';
  end if;
end;
$function$;

revoke all on function public.get_my_location(uuid) from public, anon, authenticated;
revoke all on function public.save_my_location(uuid, double precision, double precision, boolean, boolean) from public, anon, authenticated;
revoke all on function public.set_my_location_visibility(uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.consume_nearby_search_limit(uuid) from public, anon, authenticated;

grant execute on function public.get_my_location(uuid) to service_role;
grant execute on function public.save_my_location(uuid, double precision, double precision, boolean, boolean) to service_role;
grant execute on function public.set_my_location_visibility(uuid, boolean, boolean) to service_role;
grant execute on function public.consume_nearby_search_limit(uuid) to service_role;
