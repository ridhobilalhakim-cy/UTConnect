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


-- The edit RPC enforces the same official UT S1 catalogue as the registration Edge Function.
create or replace function private.is_valid_ut_program(p_faculty text, p_program text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select case p_faculty
    when 'Fakultas Ekonomi dan Bisnis (FEB)' then p_program = any(array[
      'Manajemen','Ekonomi Pembangunan','Ekonomi Syariah','Akuntansi',
      'Akuntansi Keuangan Publik','Pariwisata','Kewirausahaan'
    ]::text[])
    when 'Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik (FHISIP)' then p_program = any(array[
      'Ilmu Administrasi Publik','Administrasi Bisnis','Hukum','Ilmu Pemerintahan',
      'Ilmu Komunikasi','Perpustakaan dan Sains Informasi','Sosiologi','Sastra Inggris','Perpajakan'
    ]::text[])
    when 'Fakultas Keguruan dan Ilmu Pendidikan (FKIP)' then p_program = any(array[
      'Pendidikan Bahasa dan Sastra Indonesia','Pendidikan Bahasa Inggris','Pendidikan Biologi',
      'Pendidikan Fisika','Pendidikan Kimia','Pendidikan Matematika','Pendidikan Ekonomi',
      'Pendidikan Pancasila dan Kewarganegaraan','Teknologi Pendidikan',
      'Pendidikan Guru Sekolah Dasar (PGSD)',
      'Pendidikan Guru Pendidikan Anak Usia Dini (PGPAUD)','Pendidikan Agama Islam (PAI)'
    ]::text[])
    when 'Fakultas Sains dan Teknologi (FST)' then p_program = any(array[
      'Statistika','Matematika','Biologi','Teknologi Pangan','Agribisnis',
      'Perencanaan Wilayah dan Kota','Sistem Informasi','Sains Data'
    ]::text[])
    else false
  end;
$function$;

create or replace function public.update_my_student_profile(
  p_full_name text,
  p_faculty text,
  p_program text,
  p_semester smallint,
  p_bio text,
  p_acknowledge_verification_reset boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current public.profiles%rowtype;
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_faculty text := btrim(coalesce(p_faculty, ''));
  v_program text := btrim(coalesce(p_program, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_identity_changed boolean;
  v_next_status public.student_verification_status;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(v_full_name) not between 2 and 100 then
    raise exception 'Nama lengkap harus berisi 2–100 karakter' using errcode = '22023';
  end if;
  if not private.is_valid_ut_program(v_faculty, v_program) then
    raise exception 'Program studi tidak sesuai dengan katalog resmi UT' using errcode = '22023';
  end if;
  if p_semester is null or p_semester not between 1 and 16 then
    raise exception 'Semester harus berada pada rentang 1–16' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 280 then
    raise exception 'Bio maksimal 280 karakter' using errcode = '22023';
  end if;

  select * into v_current
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Student profile not found' using errcode = 'P0002';
  end if;

  v_identity_changed :=
    v_full_name is distinct from v_current.full_name
    or v_faculty is distinct from v_current.faculty
    or v_program is distinct from v_current.program
    or p_semester is distinct from v_current.semester;

  if v_current.verification_status = 'verified'::public.student_verification_status
    and v_identity_changed
    and coalesce(p_acknowledge_verification_reset, false) is not true
  then
    raise exception 'Perubahan data akademik akan mengembalikan status verifikasi menjadi pending. Konfirmasi terlebih dahulu.' using errcode = '22023';
  end if;

  v_next_status := case
    when v_current.verification_status = 'verified'::public.student_verification_status
      and v_identity_changed then 'pending'::public.student_verification_status
    else v_current.verification_status
  end;

  update public.profiles
  set full_name = v_full_name,
      faculty = v_faculty,
      program = v_program,
      semester = p_semester,
      bio = v_bio,
      verification_status = v_next_status
  where id = v_user_id
  returning * into v_current;

  return jsonb_build_object(
    'id', v_current.id,
    'full_name', v_current.full_name,
    'faculty', v_current.faculty,
    'program', v_current.program,
    'semester', v_current.semester,
    'bio', v_current.bio,
    'avatar_path', v_current.avatar_path,
    'verification_status', v_current.verification_status,
    'updated_at', v_current.updated_at,
    'identity_changed', v_identity_changed
  );
end
$function$;

revoke all on function private.is_valid_ut_program(text, text) from public, anon, authenticated;
revoke all on function public.update_my_student_profile(text, text, text, smallint, text, boolean) from public, anon;
grant execute on function public.update_my_student_profile(text, text, text, smallint, text, boolean) to authenticated;
