-- Bug fixes and missing UI data contracts: profile avatars, forum author identity,
-- dedicated accepted-connection inbox, and group activity notifications.
-- Existing forum / messaging RLS remains the authorization boundary.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.update_my_profile_avatar(p_avatar_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_avatar_path is not null then
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

create or replace function public.get_forum_author_profiles(p_user_ids uuid[])
returns table (user_id uuid, full_name text, avatar_path text)
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
  if p_user_ids is null or cardinality(p_user_ids) > 100 then
    raise exception 'Invalid author list' using errcode = '22023';
  end if;

  return query
  select p.id, p.full_name, p.avatar_path
  from public.profiles p
  where p.id = any(p_user_ids)
    and p.verification_status = 'verified'::public.student_verification_status
    and (
      exists (select 1 from public.forum_posts fp where fp.author_id = p.id)
      or exists (select 1 from public.forum_comments fc where fc.author_id = p.id)
    )
  order by p.full_name;
end
$function$;

revoke all on function public.get_forum_author_profiles(uuid[]) from public, anon;
grant execute on function public.get_forum_author_profiles(uuid[]) to authenticated;

create or replace function public.get_my_chat_rooms()
returns table (
  connection_id uuid,
  other_user_id uuid,
  other_full_name text,
  avatar_path text,
  program text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
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
      where unread.connection_id = c.id
        and unread.sender_id <> v_actor_id
        and unread.read_at is null
    )
  from public.connections c
  join public.profiles other_profile
    on other_profile.id = case
      when c.initiator_id = v_actor_id then c.recipient_id
      else c.initiator_id
    end
  left join lateral (
    select dm.body, dm.created_at
    from public.direct_messages dm
    where dm.connection_id = c.id
    order by dm.created_at desc
    limit 1
  ) latest_message on true
  where (c.initiator_id = v_actor_id or c.recipient_id = v_actor_id)
    and c.status = 'accepted'::public.connection_status
    and other_profile.verification_status = 'verified'::public.student_verification_status
    and not private.is_blocked_between(v_actor_id, other_profile.id)
  order by coalesce(latest_message.created_at, c.updated_at, c.created_at) desc
  limit 100;
end
$function$;

revoke all on function public.get_my_chat_rooms() from public, anon;
grant execute on function public.get_my_chat_rooms() to authenticated;

create or replace function private.notify_group_message_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sender_name text;
begin
  select p.full_name into v_sender_name
  from public.profiles p where p.id = new.sender_id;

  insert into public.notifications(user_id, notification_type, title, body, reference_id)
  select gm.user_id,
    'group_message',
    'Pesan baru di grup',
    left(coalesce(v_sender_name, 'Anggota grup') || ' mengirim pesan di ' || sg.name, 500),
    new.group_id
  from public.group_members gm
  join public.profiles recipient on recipient.id = gm.user_id
  join public.study_groups sg on sg.id = new.group_id
  where gm.group_id = new.group_id
    and gm.status = 'active'
    and gm.user_id <> new.sender_id
    and recipient.verification_status = 'verified'::public.student_verification_status;

  return new;
end
$function$;

create or replace function private.notify_group_material_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sender_name text;
  v_group_name text;
begin
  select p.full_name into v_sender_name
  from public.profiles p where p.id = new.uploaded_by;
  select g.name into v_group_name
  from public.study_groups g where g.id = new.group_id;

  insert into public.notifications(user_id, notification_type, title, body, reference_id)
  select gm.user_id,
    'group_material',
    'Materi baru di grup',
    left(coalesce(v_sender_name, 'Anggota grup') || ' membagikan ' || new.title || ' di ' || coalesce(v_group_name, 'grup belajar'), 500),
    new.group_id
  from public.group_members gm
  join public.profiles recipient on recipient.id = gm.user_id
  where gm.group_id = new.group_id
    and gm.status = 'active'
    and gm.user_id <> new.uploaded_by
    and recipient.verification_status = 'verified'::public.student_verification_status;

  return new;
end
$function$;

create or replace function private.notify_group_agenda_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sender_name text;
  v_group_name text;
begin
  select p.full_name into v_sender_name
  from public.profiles p where p.id = new.created_by;
  select g.name into v_group_name
  from public.study_groups g where g.id = new.group_id;

  insert into public.notifications(user_id, notification_type, title, body, reference_id)
  select gm.user_id,
    'group_agenda',
    'Agenda baru di grup',
    left(coalesce(v_sender_name, 'Anggota grup') || ' menambahkan ' || new.title || ' di ' || coalesce(v_group_name, 'grup belajar'), 500),
    new.group_id
  from public.group_members gm
  join public.profiles recipient on recipient.id = gm.user_id
  where gm.group_id = new.group_id
    and gm.status = 'active'
    and gm.user_id <> new.created_by
    and recipient.verification_status = 'verified'::public.student_verification_status;

  return new;
end
$function$;

revoke all on function private.notify_group_message_received() from public, anon, authenticated;
revoke all on function private.notify_group_material_received() from public, anon, authenticated;
revoke all on function private.notify_group_agenda_received() from public, anon, authenticated;

drop trigger if exists trg_notify_group_message_received on public.group_messages;
create trigger trg_notify_group_message_received
after insert on public.group_messages
for each row execute function private.notify_group_message_received();

drop trigger if exists trg_notify_group_material_received on public.group_materials;
create trigger trg_notify_group_material_received
after insert on public.group_materials
for each row execute function private.notify_group_material_received();

drop trigger if exists trg_notify_group_agenda_received on public.group_agenda_items;
create trigger trg_notify_group_agenda_received
after insert on public.group_agenda_items
for each row execute function private.notify_group_agenda_received();
