-- Group workspace: secure poll voting, invitations and message pinning.
-- Group messages/materials/agenda retain their existing RLS boundaries.

create table if not exists public.group_agenda_votes (
  agenda_item_id uuid not null references public.group_agenda_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  selected_option text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agenda_item_id, user_id),
  constraint group_agenda_votes_option_length check (
    char_length(trim(selected_option)) between 1 and 100
  )
);

create index if not exists group_agenda_votes_item_idx
  on public.group_agenda_votes(agenda_item_id, selected_option);

alter table public.group_agenda_votes enable row level security;
revoke all on table public.group_agenda_votes from public, anon, authenticated;
grant all on table public.group_agenda_votes to service_role;

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

  select item.group_id, item.poll_options
  into v_group_id, v_options
  from public.group_agenda_items item
  where item.id = p_item_id
    and item.item_type = 'poll'::public.group_agenda_type;

  if v_group_id is null then
    raise exception 'Poll not found';
  end if;

  if not exists (
    select 1 from public.group_members member
    where member.group_id = v_group_id
      and member.user_id = p_actor_id
      and member.status = 'active'::public.group_member_status
  ) then
    raise exception 'Active group membership required' using errcode = '42501';
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

  if not exists (
    select 1 from public.group_members member
    where member.group_id = v_group_id
      and member.user_id = p_actor_id
      and member.status = 'active'::public.group_member_status
  ) then
    raise exception 'Active group membership required' using errcode = '42501';
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
  from public.study_groups group_row
  where group_row.id = p_group_id
    and group_row.is_archived = false
    and group_row.access_type = 'private'::public.group_access_type
  for update;

  if not found then
    raise exception 'Active private group not found';
  end if;

  if not exists (
    select 1 from public.group_members member
    where member.group_id = p_group_id
      and member.user_id = p_actor_id
      and member.status = 'active'::public.group_member_status
      and member.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
  ) then
    raise exception 'Active group admin permission required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.group_members member
    where member.group_id = p_group_id
      and member.user_id = p_invited_user_id
      and member.status in ('active'::public.group_member_status, 'pending'::public.group_member_status)
  ) then
    raise exception 'Student is already a member or has a pending request';
  end if;

  select count(*)::integer into v_active_count
  from public.group_members member
  where member.group_id = p_group_id
    and member.status = 'active'::public.group_member_status;

  if v_active_count >= v_group.capacity then
    raise exception 'Group is full';
  end if;

  insert into public.group_invites(group_id, invited_user_id, invited_by, accepted_at)
  values (p_group_id, p_invited_user_id, p_actor_id, null)
  on conflict (group_id, invited_user_id) do update
    set invited_by = excluded.invited_by,
        accepted_at = null
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

  select exists (
    select 1 from public.group_members member
    where member.group_id = v_invite.group_id
      and member.user_id = p_actor_id
      and member.status = 'active'::public.group_member_status
      and member.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
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
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
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

  if not exists (
    select 1 from public.group_members member
    where member.group_id = v_group_id
      and member.user_id = p_actor_id
      and member.status = 'active'::public.group_member_status
      and member.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
  ) then
    raise exception 'Active group admin permission required' using errcode = '42501';
  end if;

  update public.group_messages
  set pinned_at = case when p_pin then now() else null end,
      pinned_by = case when p_pin then p_actor_id else null end
  where id = p_message_id;
end;
$function$;

revoke all on function public.get_group_agenda_poll_results(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_group_agenda_poll_results(uuid, uuid) to authenticated, service_role;

revoke all on function public.cast_group_agenda_vote(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cast_group_agenda_vote(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.create_group_invite(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_group_invite(uuid, uuid, uuid) to authenticated, service_role;

revoke all on function public.cancel_group_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_group_invite(uuid, uuid) to authenticated, service_role;

revoke all on function public.set_group_message_pin(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_group_message_pin(uuid, uuid, boolean) to authenticated, service_role;
