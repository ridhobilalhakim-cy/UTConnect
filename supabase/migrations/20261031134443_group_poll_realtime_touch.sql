-- Notify group agenda subscribers when a poll vote changes.
create or replace function private.touch_group_agenda_item_after_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.group_agenda_items
  set updated_at = now()
  where id = coalesce(new.agenda_item_id, old.agenda_item_id);
  return coalesce(new, old);
end
$function$;

drop trigger if exists trg_group_agenda_touch_after_vote on public.group_agenda_votes;
create trigger trg_group_agenda_touch_after_vote
after insert or update or delete on public.group_agenda_votes
for each row execute function private.touch_group_agenda_item_after_vote();

revoke all on function private.touch_group_agenda_item_after_vote() from public, anon, authenticated;
