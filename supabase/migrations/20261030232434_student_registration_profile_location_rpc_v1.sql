create or replace function public.create_student_profile_with_location(
  p_user_id uuid,
  p_full_name text,
  p_nim_digest text,
  p_faculty text,
  p_program text,
  p_semester smallint,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then raise exception 'Authenticated user is required' using errcode='22023'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'Auth user not found' using errcode='23503'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then raise exception 'Valid map location is required' using errcode='22023'; end if;
  if p_nim_digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid NIM digest' using errcode='22023'; end if;
  insert into public.profiles(id,full_name,nim_digest,faculty,program,semester,verification_status)
  values(p_user_id,trim(p_full_name),p_nim_digest,trim(p_faculty),trim(p_program),p_semester,'pending'::public.student_verification_status);
  insert into public.user_locations(user_id,location,show_in_radar,consented_at,updated_at)
  values(p_user_id,extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography,true,now(),now());
end;
$$;
revoke all on function public.create_student_profile_with_location(uuid,text,text,text,text,smallint,double precision,double precision) from public,anon,authenticated;
grant execute on function public.create_student_profile_with_location(uuid,text,text,text,text,smallint,double precision,double precision) to service_role;
