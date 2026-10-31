-- Keep private messages restricted to active, verified, mutually unblocked connections.
drop policy if exists direct_messages_read_accepted_connection on public.direct_messages;
create policy direct_messages_read_accepted_connection
on public.direct_messages
for select
to authenticated
using (
  (select private.is_current_user_verified())
  and exists (
    select 1
    from public.connections c
    where c.id = direct_messages.connection_id
      and c.status = 'accepted'::public.connection_status
      and (
        c.initiator_id = (select auth.uid())
        or c.recipient_id = (select auth.uid())
      )
      and private.is_verified_user(
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
      and not private.is_blocked_between(
        (select auth.uid()),
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
  )
);

drop policy if exists direct_messages_insert_as_sender on public.direct_messages;
create policy direct_messages_insert_as_sender
on public.direct_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and (select private.is_current_user_verified())
  and exists (
    select 1
    from public.connections c
    where c.id = direct_messages.connection_id
      and c.status = 'accepted'::public.connection_status
      and (
        c.initiator_id = (select auth.uid())
        or c.recipient_id = (select auth.uid())
      )
      and private.is_verified_user(
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
      and not private.is_blocked_between(
        (select auth.uid()),
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
  )
);

drop policy if exists direct_messages_update_read_at on public.direct_messages;
create policy direct_messages_update_read_at
on public.direct_messages
for update
to authenticated
using (
  (select private.is_current_user_verified())
  and sender_id <> (select auth.uid())
  and read_at is null
  and exists (
    select 1
    from public.connections c
    where c.id = direct_messages.connection_id
      and c.status = 'accepted'::public.connection_status
      and (
        c.initiator_id = (select auth.uid())
        or c.recipient_id = (select auth.uid())
      )
      and private.is_verified_user(
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
      and not private.is_blocked_between(
        (select auth.uid()),
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
  )
)
with check (
  (select private.is_current_user_verified())
  and sender_id <> (select auth.uid())
  and read_at is not null
  and exists (
    select 1
    from public.connections c
    where c.id = direct_messages.connection_id
      and c.status = 'accepted'::public.connection_status
      and (
        c.initiator_id = (select auth.uid())
        or c.recipient_id = (select auth.uid())
      )
      and private.is_verified_user(
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
      and not private.is_blocked_between(
        (select auth.uid()),
        case
          when c.initiator_id = (select auth.uid()) then c.recipient_id
          else c.initiator_id
        end
      )
  )
);

-- Column-level permission: recipients can mark messages as read, but cannot edit content.
revoke update on table public.direct_messages from authenticated;
grant update (read_at) on table public.direct_messages to authenticated;
