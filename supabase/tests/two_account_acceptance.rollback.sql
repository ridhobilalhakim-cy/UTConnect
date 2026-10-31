-- UTConnect two-account Supabase staging acceptance test.
-- SAFE BY DESIGN: creates synthetic auth/profile rows inside one transaction
-- and ends with ROLLBACK. Never remove the final ROLLBACK.
-- Validates database/RLS/RPC behavior with synthetic JWT subjects; it does not
-- validate real browser Auth sessions or WebSocket/Realtime transport.

begin;

do $setup$
declare
  v_a uuid := '9e000001-1111-4111-8111-000000000001';
  v_b uuid := '9e000002-2222-4222-8222-000000000002';
  v_c uuid := '9e000003-3333-4333-8333-000000000003';
begin
  if exists (select 1 from auth.users where id in (v_a,v_b,v_c))
     or exists (select 1 from auth.users where email in (
       'utconnect-e2e-a@example.invalid',
       'utconnect-e2e-b@example.invalid',
       'utconnect-e2e-c@example.invalid'
     )) then
    raise exception 'Synthetic acceptance-test identity already exists; refusing to reuse it';
  end if;

  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_a, 'authenticated', 'authenticated', 'utconnect-e2e-a@example.invalid', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"UTConnect E2E A"}'::jsonb, now(), now()),
    (v_b, 'authenticated', 'authenticated', 'utconnect-e2e-b@example.invalid', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"UTConnect E2E B"}'::jsonb, now(), now()),
    (v_c, 'authenticated', 'authenticated', 'utconnect-e2e-c@example.invalid', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"UTConnect E2E C"}'::jsonb, now(), now());

  insert into public.profiles (
    id, full_name, nim_digest, faculty, program, semester, verification_status
  ) values
    (v_a, 'UTConnect E2E A', md5('utconnect-e2e-a-1') || md5('utconnect-e2e-a-2'),
     'Fakultas Sains dan Teknologi (FST)', 'Sistem Informasi', 1, 'verified'),
    (v_b, 'UTConnect E2E B', md5('utconnect-e2e-b-1') || md5('utconnect-e2e-b-2'),
     'Fakultas Sains dan Teknologi (FST)', 'Sistem Informasi', 2, 'verified'),
    (v_c, 'UTConnect E2E C', md5('utconnect-e2e-c-1') || md5('utconnect-e2e-c-2'),
     'Fakultas Sains dan Teknologi (FST)', 'Sistem Informasi', 1, 'pending');
end
$setup$;

set local role authenticated;

do $test$
declare
  v_a uuid := '9e000001-1111-4111-8111-000000000001';
  v_b uuid := '9e000002-2222-4222-8222-000000000002';
  v_c uuid := '9e000003-3333-4333-8333-000000000003';
  v_connection_id uuid;
  v_group_id uuid;
  v_direct_message_id uuid;
  v_group_message_id uuid;
  v_connection_status public.connection_status;
  v_member_status public.group_member_status;
  v_count bigint;
  v_read_at timestamptz;
begin
  -- A sends a connection request to B.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  if auth.uid() is distinct from v_a then
    raise exception 'JWT subject simulation failed for account A';
  end if;

  insert into public.connections(initiator_id, recipient_id)
  values (v_a, v_b)
  returning id into v_connection_id;

  -- B accepts the request.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_b,'role','authenticated','aud','authenticated')::text, true);
  v_connection_status := public.respond_connection_request(v_connection_id, true);
  if v_connection_status <> 'accepted'::public.connection_status then
    raise exception 'Connection request did not become accepted';
  end if;

  -- Both users have their own dedicated chat room.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.get_my_chat_rooms();
  if v_count <> 1 then raise exception 'Account A chat inbox expected 1 room, got %',v_count; end if;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_b,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.get_my_chat_rooms();
  if v_count <> 1 then raise exception 'Account B chat inbox expected 1 room, got %',v_count; end if;

  -- A sends a direct message; B reads it and updates only read_at.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  insert into public.direct_messages(connection_id, sender_id, body)
  values (v_connection_id, v_a, 'Pesan uji sintetis dua akun.')
  returning id into v_direct_message_id;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_b,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.direct_messages
  where id = v_direct_message_id and body = 'Pesan uji sintetis dua akun.';
  if v_count <> 1 then raise exception 'Account B could not read A direct message'; end if;

  update public.direct_messages
  set read_at = now()
  where id = v_direct_message_id and sender_id <> v_b and read_at is null;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  select read_at into v_read_at from public.direct_messages where id = v_direct_message_id;
  if v_read_at is null then raise exception 'Direct-message read receipt was not persisted'; end if;

  -- A creates an approval-based group; the DB trigger assigns creator admin membership.
  insert into public.study_groups (
    created_by, name, description, mode, capacity, access_type, online_url
  ) values (
    v_a, 'UTConnect E2E Group', 'Temporary two-account acceptance test',
    'online', 10, 'approval', 'https://meet.example.invalid/utconnect-e2e'
  )
  returning id into v_group_id;

  select count(*) into v_count from public.group_members
  where group_id = v_group_id and user_id = v_a
    and role = 'admin'::public.group_member_role
    and status = 'active'::public.group_member_status;
  if v_count <> 1 then raise exception 'Group creator was not automatically added as active admin'; end if;

  -- B requests membership; A approves it.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_b,'role','authenticated','aud','authenticated')::text, true);
  v_member_status := public.join_study_group(v_b, v_group_id);
  if v_member_status <> 'pending'::public.group_member_status then
    raise exception 'Approval-based group request expected pending, got %',v_member_status;
  end if;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  v_member_status := public.respond_group_join_request(v_a, v_group_id, v_b, true);
  if v_member_status <> 'active'::public.group_member_status then
    raise exception 'Group admin could not approve the second member';
  end if;

  -- B sends a group message; A reads it as an active fellow member.
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_b,'role','authenticated','aud','authenticated')::text, true);
  insert into public.group_messages(group_id, sender_id, body)
  values (v_group_id, v_b, 'Pesan grup uji sintetis.')
  returning id into v_group_message_id;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.group_messages
  where id = v_group_message_id and body = 'Pesan grup uji sintetis.';
  if v_count <> 1 then raise exception 'Account A could not read B group message'; end if;

  -- Pending/non-member C cannot read private content or write to the group.
  perform set_config('request.jwt.claim.sub', v_c::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_c,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.direct_messages where connection_id = v_connection_id;
  if v_count <> 0 then raise exception 'Pending account C can read a private direct message'; end if;
  select count(*) into v_count from public.group_messages where group_id = v_group_id;
  if v_count <> 0 then raise exception 'Non-member account C can read a private group message'; end if;

  begin
    insert into public.group_messages(group_id, sender_id, body)
    values (v_group_id, v_c, 'Pesan yang seharusnya ditolak.');
    raise exception 'Non-member account C unexpectedly inserted a group message';
  exception when insufficient_privilege then
    null;
  end;

  -- Notifications are visible to their owner only.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_a,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.notifications where user_id = v_a;
  if v_count < 2 then raise exception 'Account A expected connection/group notifications, got %',v_count; end if;
  select count(*) into v_count from public.notifications where user_id = v_b;
  if v_count <> 0 then raise exception 'Account A can read account B notifications'; end if;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_b,'role','authenticated','aud','authenticated')::text, true);
  select count(*) into v_count from public.notifications where user_id = v_b;
  if v_count < 2 then raise exception 'Account B expected connection/chat/group notifications, got %',v_count; end if;
  select count(*) into v_count from public.notifications where user_id = v_a;
  if v_count <> 0 then raise exception 'Account B can read account A notifications'; end if;
end
$test$;

rollback;
