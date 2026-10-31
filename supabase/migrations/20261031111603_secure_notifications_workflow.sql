-- Notifications are generated only by trusted database triggers.
-- Authenticated users may read their own records and update only read_at.

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  and read_at is null
)
with check (
  user_id = (select auth.uid())
  and read_at is not null
);

revoke insert, delete, update on table public.notifications from authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create or replace function private.notify_connection_request_created()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'pending'::public.connection_status then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      new.recipient_id,
      'connection_request',
      'Permintaan koneksi baru',
      'Seseorang mengirim permintaan koneksi. Buka Matching untuk meninjau.',
      new.id
    );
  end if;
  return new;
end
$function$;

create or replace function private.notify_connection_decision()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.status = 'pending'::public.connection_status
     and new.status in ('accepted'::public.connection_status, 'rejected'::public.connection_status) then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      new.initiator_id,
      case when new.status = 'accepted'::public.connection_status then 'connection_accepted' else 'connection_rejected' end,
      case when new.status = 'accepted'::public.connection_status then 'Permintaan koneksi diterima' else 'Permintaan koneksi ditolak' end,
      case when new.status = 'accepted'::public.connection_status then 'Permintaan koneksimu telah diterima. Kamu sekarang dapat memulai chat.' else 'Permintaan koneksimu tidak diterima.' end,
      new.id
    );
  end if;
  return new;
end
$function$;

create or replace function private.notify_direct_message_received()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_recipient_id uuid;
begin
  select
    case
      when c.initiator_id = new.sender_id then c.recipient_id
      when c.recipient_id = new.sender_id then c.initiator_id
      else null
    end
  into v_recipient_id
  from public.connections c
  where c.id = new.connection_id
    and c.status = 'accepted'::public.connection_status;

  if v_recipient_id is not null and v_recipient_id <> new.sender_id then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      v_recipient_id,
      'direct_message',
      'Pesan baru',
      'Kamu menerima pesan baru dari koneksimu.',
      new.connection_id
    );
  end if;
  return new;
end
$function$;

create or replace function private.notify_forum_comment_received()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_post_author_id uuid;
  v_post_title text;
begin
  select p.author_id, p.title
  into v_post_author_id, v_post_title
  from public.forum_posts p
  where p.id = new.post_id;

  if v_post_author_id is not null and v_post_author_id <> new.author_id then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      v_post_author_id,
      'forum_comment',
      'Diskusimu mendapat tanggapan',
      'Ada tanggapan baru pada diskusi "' || left(v_post_title, 120) || '".',
      new.post_id
    );
  end if;
  return new;
end
$function$;

create or replace function private.notify_group_join_request_received()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_group_name text;
begin
  if new.status <> 'pending'::public.group_member_status then
    return new;
  end if;

  select g.name into v_group_name
  from public.study_groups g
  where g.id = new.group_id;

  if v_group_name is not null then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    select
      gm.user_id,
      'group_join_request',
      'Permohonan bergabung ke grup',
      'Ada mahasiswa yang meminta bergabung ke grup "' || left(v_group_name, 100) || '".',
      new.group_id
    from public.group_members gm
    where gm.group_id = new.group_id
      and gm.status = 'active'::public.group_member_status
      and gm.role in ('admin'::public.group_member_role, 'co_admin'::public.group_member_role)
      and gm.user_id <> new.user_id;
  end if;
  return new;
end
$function$;

create or replace function private.notify_group_join_decision()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_group_name text;
begin
  if old.status = 'pending'::public.group_member_status
     and new.status in ('active'::public.group_member_status, 'rejected'::public.group_member_status) then
    select g.name into v_group_name
    from public.study_groups g
    where g.id = new.group_id;

    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      new.user_id,
      case when new.status = 'active'::public.group_member_status then 'group_join_approved' else 'group_join_rejected' end,
      case when new.status = 'active'::public.group_member_status then 'Permohonan grup disetujui' else 'Permohonan grup ditolak' end,
      case when new.status = 'active'::public.group_member_status
        then 'Permohonan bergabung ke grup "' || left(coalesce(v_group_name, 'belajar'), 100) || '" telah disetujui.'
        else 'Permohonan bergabung ke grup "' || left(coalesce(v_group_name, 'belajar'), 100) || '" tidak disetujui.'
      end,
      new.group_id
    );
  end if;
  return new;
end
$function$;

drop trigger if exists trg_notify_connection_request on public.connections;
create trigger trg_notify_connection_request
after insert on public.connections
for each row execute function private.notify_connection_request_created();

drop trigger if exists trg_notify_connection_decision on public.connections;
create trigger trg_notify_connection_decision
after update of status on public.connections
for each row execute function private.notify_connection_decision();

drop trigger if exists trg_notify_direct_message on public.direct_messages;
create trigger trg_notify_direct_message
after insert on public.direct_messages
for each row execute function private.notify_direct_message_received();

drop trigger if exists trg_notify_forum_comment on public.forum_comments;
create trigger trg_notify_forum_comment
after insert on public.forum_comments
for each row execute function private.notify_forum_comment_received();

drop trigger if exists trg_notify_group_join_request on public.group_members;
create trigger trg_notify_group_join_request
after insert on public.group_members
for each row execute function private.notify_group_join_request_received();

drop trigger if exists trg_notify_group_join_decision on public.group_members;
create trigger trg_notify_group_join_decision
after update of status on public.group_members
for each row execute function private.notify_group_join_decision();

revoke all on function private.notify_connection_request_created() from public, anon, authenticated;
revoke all on function private.notify_connection_decision() from public, anon, authenticated;
revoke all on function private.notify_direct_message_received() from public, anon, authenticated;
revoke all on function private.notify_forum_comment_received() from public, anon, authenticated;
revoke all on function private.notify_group_join_request_received() from public, anon, authenticated;
revoke all on function private.notify_group_join_decision() from public, anon, authenticated;

do $block$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$block$;
