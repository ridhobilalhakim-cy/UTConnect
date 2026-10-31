-- Least-privilege client writes for locations, connections and direct messages.

-- Location changes must use the JWT-verified manage-my-location Edge Function,
-- which derives the owner from the session and requires explicit consent.
-- Registration continues through create_student_profile_with_location (service_role).
revoke all privileges on table public.user_locations from public, anon, authenticated;

-- Clients can request a connection only with participant IDs and the pending status.
-- Server-owned ID, timestamps and canonical pair keys are no longer client-writable.
revoke insert on table public.connections from anon, authenticated;
revoke insert (initiator_id, recipient_id, status) on table public.connections from authenticated;

create or replace function private.set_connection_pair_keys()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.initiator_id is null or new.recipient_id is null
     or new.initiator_id = new.recipient_id then
    raise exception 'Distinct connection participants are required' using errcode = '22023';
  end if;

  new.pair_low := least(new.initiator_id, new.recipient_id);
  new.pair_high := greatest(new.initiator_id, new.recipient_id);
  return new;
end
$function$;

revoke all on function private.set_connection_pair_keys() from public, anon, authenticated;

drop trigger if exists trg_connections_derive_pair_keys on public.connections;
create trigger trg_connections_derive_pair_keys
before insert or update of initiator_id, recipient_id
on public.connections
for each row execute function private.set_connection_pair_keys();

-- Backfill legacy rows before enforcing non-null canonical unique keys.
update public.connections
set pair_low = least(initiator_id, recipient_id),
    pair_high = greatest(initiator_id, recipient_id)
where pair_low is distinct from least(initiator_id, recipient_id)
   or pair_high is distinct from greatest(initiator_id, recipient_id);

alter table public.connections
  alter column pair_low set not null,
  alter column pair_high set not null;

alter table public.connections
  add constraint connections_pair_keys_match
  check (
    pair_low = least(initiator_id, recipient_id)
    and pair_high = greatest(initiator_id, recipient_id)
  );

grant insert (initiator_id, recipient_id, status)
on table public.connections to authenticated;

-- New direct messages must be unread and timestamped by the database.
-- Clients can only supply the accepted connection, sender and body.
revoke insert on table public.direct_messages from anon, authenticated;

grant insert (connection_id, sender_id, body)
on table public.direct_messages to authenticated;
