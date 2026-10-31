-- Hidden students may browse nearby students from their own saved location.
-- show_in_radar controls whether a student is discoverable as a candidate, not whether they can browse.
create or replace function public.find_nearby_students(
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
  marker_lng double precision
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_viewer_id is null then
    raise exception 'Viewer is required';
  end if;
  if p_radius_m not in (1000, 3000, 5000) then
    raise exception 'Radius must be 1000, 3000, or 5000 meters';
  end if;
  if not private.is_verified_user(p_viewer_id) then
    return;
  end if;

  if p_nim_digest is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_viewer_id::text, 0));
    insert into private.nim_search_events(searcher_id) values(p_viewer_id);
    if (
      select count(*)
      from private.nim_search_events e
      where e.searcher_id = p_viewer_id
        and e.created_at > now() - interval '1 minute'
    ) > 5 then
      raise exception 'NIM search rate limit exceeded';
    end if;
  end if;

  return query
  with viewer as (
    select ul.location
    from public.user_locations ul
    where ul.user_id = p_viewer_id
  ),
  candidates as (
    select
      p.id,
      p.full_name,
      p.program,
      ul.location,
      v.location as viewer_location,
      extensions.st_distance(ul.location, v.location) as exact_distance,
      decode(md5(p_viewer_id::text || ':' || p.id::text || ':' || current_date::text), 'hex') as jitter
    from public.profiles p
    join public.user_locations ul on ul.user_id = p.id
    cross join viewer v
    where p.id <> p_viewer_id
      and p.verification_status = 'verified'::public.student_verification_status
      and ul.show_in_radar = true
      and extensions.st_dwithin(ul.location, v.location, p_radius_m)
      and (p_nim_digest is null or p.nim_digest = p_nim_digest)
      and not private.is_blocked_between(p_viewer_id, p.id)
  ),
  jittered as (
    select
      c.*,
      extensions.st_project(
        c.location,
        (100 + (get_byte(c.jitter, 0) % 151))::double precision,
        ((get_byte(c.jitter, 1) * 256 + get_byte(c.jitter, 2))::double precision / 65535.0) * 2.0 * pi()
      ) as raw_marker,
      extensions.st_azimuth(c.viewer_location, c.location) as target_bearing
    from candidates c
  ),
  bounded as (
    select
      j.*,
      case
        when extensions.st_dwithin(j.raw_marker, j.viewer_location, p_radius_m)
          then j.raw_marker
        else extensions.st_project(j.viewer_location, greatest(0.0, p_radius_m - 100.0), j.target_bearing)
      end as marker
    from jittered j
  )
  select
    b.id,
    upper(
      left(split_part(b.full_name, ' ', 1), 1)
      || left(coalesce(nullif(split_part(b.full_name, ' ', 2), ''), split_part(b.full_name, ' ', 1)), 1)
    ),
    b.program,
    case
      when b.exact_distance < 1000 then greatest(100, round(b.exact_distance / 100.0) * 100)::integer
      else greatest(500, round(b.exact_distance / 500.0) * 500)::integer
    end,
    extensions.st_y(b.marker::extensions.geometry),
    extensions.st_x(b.marker::extensions.geometry)
  from bounded b
  order by b.exact_distance asc
  limit 10;
end
$function$;

revoke all on function public.find_nearby_students(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.find_nearby_students(uuid, integer, text) to service_role;
