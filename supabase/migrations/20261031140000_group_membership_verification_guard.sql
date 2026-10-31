-- A group membership only grants access while the account remains verified.
-- This closes stale access if an administrator later changes a profile's verification status.

create or replace function private.is_current_user_active_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_verified_user(auth.uid())
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'::public.group_member_status
    )
$function$;

create or replace function private.is_current_user_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_verified_user(auth.uid())
    and exists (
      select 1
      from public.group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'::public.group_member_status
        and gm.role in (
          'admin'::public.group_member_role,
          'co_admin'::public.group_member_role
        )
    )
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

  if not found then
    raise exception 'Group not found';
  end if;

  if not private.is_current_user_group_admin(p_group_id) then
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

  select item.group_id, item.poll_options
  into v_group_id, v_options
  from public.group_agenda_items item
  where item.id = p_item_id
    and item.item_type = 'poll'::public.group_agenda_type;

  if v_group_id is null then
    raise exception 'Poll not found';
  end if;

  if not private.is_current_user_active_group_member(v_group_id) then
    raise exception 'Active verified group membership required' using errcode = '42501';
  end if;

  if jsonb_typeof(v_options) <> 'array' then
    raise exception 'Poll options are invalid';
  end if;

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

  select item.group_id, item.poll_options
  into v_group_id, v_options
  from public.group_agenda_items item
  where item.id = p_item_id
    and item.item_type = 'poll'::public.group_agenda_type
  for update;

  if v_group_id is null then
    raise exception 'Poll not found';
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
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  if not private.is_verified_user(p_actor_id) then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;
  if p_pin is null then
    raise exception 'Pin state is required';
  end if;

  select message.group_id into v_group_id
  from public.group_messages message
  where message.id = p_message_id;

  if v_group_id is null then
    raise exception 'Message not found';
  end if;

  if not private.is_current_user_group_admin(v_group_id) then
    raise exception 'Active verified group admin permission required' using errcode = '42501';
  end if;

  update public.group_messages
  set pinned_at = case when p_pin then now() else null end,
      pinned_by = case when p_pin then p_actor_id else null end
  where id = p_message_id;
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
  v_is_manager boolean;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;

  select * into v_invite
  from public.group_invites invite
  where invite.id = p_invite_id
  for update;

  if not found or v_invite.accepted_at is not null then
    raise exception 'Pending invitation not found';
  end if;

  v_is_manager := private.is_current_user_group_admin(v_invite.group_id);

  if v_invite.invited_user_id <> p_actor_id and not v_is_manager then
    raise exception 'Invitation owner or verified group admin permission required' using errcode = '42501';
  end if;

  delete from public.group_invites where id = p_invite_id;
end;
$function$;

revoke all on function public.respond_group_join_request(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_group_join_request(uuid, uuid, uuid, boolean) to authenticated, service_role;

revoke all on function public.get_group_agenda_poll_results(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_group_agenda_poll_results(uuid, uuid) to authenticated, service_role;

revoke all on function public.cast_group_agenda_vote(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cast_group_agenda_vote(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.list_my_group_invites(uuid) from public, anon, authenticated;
grant execute on function public.list_my_group_invites(uuid) to authenticated, service_role;

revoke all on function public.set_group_message_pin(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_group_message_pin(uuid, uuid, boolean) to authenticated, service_role;

revoke all on function public.cancel_group_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_group_invite(uuid, uuid) to authenticated, service_role;
