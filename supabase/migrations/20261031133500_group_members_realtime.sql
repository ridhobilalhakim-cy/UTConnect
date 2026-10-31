-- Enable RLS-filtered Realtime updates for group membership status.
do $block$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
end
$block$;
