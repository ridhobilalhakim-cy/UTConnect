-- Verified-student NIM lookup without location/radius. NIM HMAC never reaches browser.
create or replace function public.find_verified_student_by_nim(p_viewer_id uuid, p_nim_digest text)
returns table(student_id uuid, initials text, program text)
language plpgsql security definer set search_path = ''
as $function$
declare v_search_count_minute integer; v_search_count_hour integer;
begin
  if p_viewer_id is null then raise exception 'Authenticated viewer is required' using errcode = '22023'; end if;
  if p_nim_digest is null or p_nim_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid NIM digest' using errcode = '22023'; end if;
  if not private.is_verified_user(p_viewer_id) then raise exception 'Verified student account required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('utconnect-nim:' || p_viewer_id::text, 0));
  delete from private.nim_search_events where searcher_id = p_viewer_id and created_at < now() - interval '1 hour';
  insert into private.nim_search_events(searcher_id) values (p_viewer_id);
  select count(*)::integer into v_search_count_minute from private.nim_search_events where searcher_id = p_viewer_id and created_at >= now() - interval '1 minute';
  select count(*)::integer into v_search_count_hour from private.nim_search_events where searcher_id = p_viewer_id and created_at >= now() - interval '1 hour';
  if v_search_count_minute > 5 or v_search_count_hour > 30 then raise exception 'NIM search rate limit exceeded' using errcode = 'P0001'; end if;
  return query
  select p.id,
    upper(left(split_part(p.full_name, ' ', 1), 1)
      || left(coalesce(nullif(split_part(p.full_name, ' ', 2), ''), split_part(p.full_name, ' ', 1)), 1)),
    p.program
  from public.profiles p
  where p.nim_digest = p_nim_digest and p.id <> p_viewer_id
    and p.verification_status = 'verified'::public.student_verification_status
    and not private.is_blocked_between(p_viewer_id, p.id)
  limit 1;
end
$function$;
revoke all on function public.find_verified_student_by_nim(uuid, text) from public, anon, authenticated;
grant execute on function public.find_verified_student_by_nim(uuid, text) to service_role;

do $publication$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='connections') then
    alter publication supabase_realtime add table public.connections;
  end if;
end
$publication$;
alter table public.direct_messages replica identity full;
alter table public.connections replica identity full;
alter table public.notifications replica identity full;
