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

  if not found then
    raise exception 'Group not found or archived';
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

  if v_count >= v_group.capacity then
    raise exception 'Group is full';
  end if;

  v_status := case
    when v_group.access_type = 'approval'::public.group_access_type
      then 'pending'::public.group_member_status
    else 'active'::public.group_member_status
  end;

  insert into public.group_members(group_id, user_id, role, status, joined_at)
  values (
    p_group_id,
    p_actor_id,
    'member'::public.group_member_role,
    v_status,
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

  if p_user_id is null or p_accept is null then
    raise exception 'Invalid join request decision';
  end if;

  select * into v_group
  from public.study_groups g
  where g.id = p_group_id
  for update;

  if not found then
    raise exception 'Group not found';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_actor_id
      and gm.role in (
        'admin'::public.group_member_role,
        'co_admin'::public.group_member_role
      )
      and gm.status = 'active'::public.group_member_status
  ) then
    raise exception 'Group admin permission required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.group_members gm
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

    if v_count >= v_group.capacity then
      raise exception 'Group is full';
    end if;

    v_status := 'active'::public.group_member_status;
  else
    v_status := 'rejected'::public.group_member_status;
  end if;

  update public.group_members
  set status = v_status,
      joined_at = case when p_accept then now() else null end
  where group_id = p_group_id and user_id = p_user_id;

  return v_status;
end
$function$;

revoke all on function public.join_study_group(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_study_group(uuid, uuid) to authenticated, service_role;

revoke all on function public.respond_group_join_request(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_group_join_request(uuid, uuid, uuid, boolean) to authenticated, service_role;
