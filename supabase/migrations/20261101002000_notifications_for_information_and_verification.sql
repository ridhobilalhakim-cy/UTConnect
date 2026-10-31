-- Add owner-scoped notifications for student verification decisions and newly
-- published Information UT items. Existing RLS and Realtime configuration remains
-- the authority for delivery and read receipts.

create or replace function private.notify_student_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.verification_status is not distinct from old.verification_status then
    return new;
  end if;

  if new.verification_status = 'verified'::public.student_verification_status then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      new.id,
      'student_verification',
      'Verifikasi mahasiswa disetujui',
      'Status mahasiswa UT kamu telah disetujui. Fitur komunitas yang memerlukan verifikasi kini dapat digunakan.',
      new.id
    );
  elsif new.verification_status = 'rejected'::public.student_verification_status then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      new.id,
      'student_verification',
      'Verifikasi mahasiswa perlu diperbaiki',
      'Permohonan verifikasi belum disetujui. Buka halaman Verifikasi Mahasiswa untuk membaca catatan administrator dan mengirim bukti ulang.',
      new.id
    );
  end if;

  return new;
end
$function$;

revoke all on function private.notify_student_verification_decision() from public, anon, authenticated;

drop trigger if exists trg_notify_student_verification_decision on public.profiles;
create trigger trg_notify_student_verification_decision
after update of verification_status on public.profiles
for each row execute function private.notify_student_verification_decision();


create or replace function private.notify_information_post_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not new.is_published then
    return new;
  end if;

  -- Notify once when a draft is first published; do not create duplicates for edits.
  if tg_op = 'UPDATE' and old.is_published then
    return new;
  end if;

  insert into public.notifications(user_id, notification_type, title, body, reference_id)
  select
    recipient.id,
    'information_post',
    'Informasi UT baru',
    left('Informasi baru: ' || new.title, 500),
    new.id
  from public.profiles recipient
  where (new.author_id is null or recipient.id <> new.author_id)
    and (
      new.audience = 'public'::public.info_audience
      or recipient.verification_status = 'verified'::public.student_verification_status
    );

  return new;
end
$function$;

revoke all on function private.notify_information_post_published() from public, anon, authenticated;

drop trigger if exists trg_notify_information_post_published on public.information_posts;
create trigger trg_notify_information_post_published
after insert or update of is_published on public.information_posts
for each row execute function private.notify_information_post_published();
