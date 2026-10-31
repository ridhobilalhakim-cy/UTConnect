-- Enable live group workspace updates and notify private group invite recipients.

create or replace function private.notify_group_invite_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_name text;
begin
  select group_row.name
  into v_group_name
  from public.study_groups group_row
  where group_row.id = new.group_id;

  if v_group_name is not null and new.accepted_at is null then
    insert into public.notifications(user_id, notification_type, title, body, reference_id)
    values (
      new.invited_user_id,
      'group_invite',
      'Undangan grup belajar',
      'Kamu diundang untuk bergabung ke grup "' || left(v_group_name, 100) || '".',
      new.group_id
    );
  end if;
  return new;
end
$function$;

drop trigger if exists trg_notify_group_invite_received on public.group_invites;
create trigger trg_notify_group_invite_received
after insert on public.group_invites
for each row execute function private.notify_group_invite_received();

revoke all on function private.notify_group_invite_received() from public, anon, authenticated;

do $block$
declare
  table_name text;
begin
  foreach table_name in array array['group_agenda_items','group_materials','group_invites'] loop
    if not exists (
      select 1
      from pg_publication_tables publication
      where publication.pubname = 'supabase_realtime'
        and publication.schemaname = 'public'
        and publication.tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$block$;
