-- Audit hardening: verified connection summaries, clear Information UT read policy,
-- optimize group-material RLS auth lookup, and cover foreign-key indexes.

-- A user's old connection rows must not keep a non-verified account visible
-- in the Matching/Connections UI.
create or replace function public.get_my_connection_summaries()
returns table (
  connection_id uuid,
  other_student_id uuid,
  initials text,
  program text,
  status public.connection_status,
  created_at timestamp with time zone,
  is_incoming boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;

  if not private.is_current_user_verified() then
    raise exception 'Verified student account required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    case
      when c.initiator_id = v_actor_id then c.recipient_id
      else c.initiator_id
    end,
    upper(
      left(split_part(p.full_name, ' ', 1), 1) ||
      left(
        coalesce(
          nullif(split_part(p.full_name, ' ', 2), ''),
          split_part(p.full_name, ' ', 1)
        ),
        1
      )
    ),
    p.program,
    c.status,
    c.created_at,
    c.recipient_id = v_actor_id
  from public.connections c
  join public.profiles p
    on p.id = case
      when c.initiator_id = v_actor_id then c.recipient_id
      else c.initiator_id
    end
  where (c.initiator_id = v_actor_id or c.recipient_id = v_actor_id)
    and private.is_verified_user(p.id)
    and not private.is_blocked_between(v_actor_id, p.id)
  order by c.created_at desc
  limit 100;
end
$function$;

-- Replace two overlapping authenticated SELECT policies with their logical OR.
-- Anonymous readers continue using information_posts_public_read.
drop policy if exists information_posts_admin_read on public.information_posts;
drop policy if exists information_posts_students_read on public.information_posts;

create policy information_posts_read_authorized
on public.information_posts
for select
to authenticated
using (
  private.is_current_user_admin()
  or (
    is_published = true
    and (
      audience = 'public'::public.info_audience
      or private.is_current_user_verified()
    )
  )
);

-- Avoid evaluating auth.uid() for each candidate row during material deletion.
drop policy if exists group_materials_delete_uploader_or_admin on public.group_materials;

create policy group_materials_delete_uploader_or_admin
on public.group_materials
for delete
to authenticated
using (
  private.is_current_user_active_group_member(group_id)
  and (
    uploaded_by = (select auth.uid())
    or private.is_current_user_group_admin(group_id)
  )
);

-- Cover all four unindexed foreign keys reported by Supabase's performance advisor.
create index if not exists student_verification_requests_reviewed_by_idx
  on private.student_verification_requests(reviewed_by)
  where reviewed_by is not null;

create index if not exists student_verification_review_events_reviewer_id_idx
  on private.student_verification_review_events(reviewer_id);

create index if not exists student_verification_review_events_user_id_idx
  on private.student_verification_review_events(user_id);

create index if not exists group_agenda_votes_user_id_idx
  on public.group_agenda_votes(user_id);
