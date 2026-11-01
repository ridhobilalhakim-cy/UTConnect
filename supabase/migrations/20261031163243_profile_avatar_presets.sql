create or replace function public.update_my_profile_avatar(p_avatar_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_is_preset boolean;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_is_preset := p_avatar_path = any(array[
    'preset:avatar-01',
    'preset:avatar-02',
    'preset:avatar-03',
    'preset:avatar-04'
  ]::text[]);

  if p_avatar_path is not null and not v_is_preset then
    if p_avatar_path !~ ('^' || v_actor_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
      raise exception 'Invalid avatar path' using errcode = '22023';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'profile-avatars' and o.name = p_avatar_path
    ) then
      raise exception 'Avatar file was not uploaded' using errcode = 'P0002';
    end if;
  end if;

  update public.profiles
  set avatar_path = p_avatar_path,
      updated_at = now()
  where id = v_actor_id;

  if not found then
    raise exception 'Student profile not found' using errcode = 'P0002';
  end if;

  return p_avatar_path;
end
$function$;

revoke all on function public.update_my_profile_avatar(text) from public, anon;
grant execute on function public.update_my_profile_avatar(text) to authenticated;
