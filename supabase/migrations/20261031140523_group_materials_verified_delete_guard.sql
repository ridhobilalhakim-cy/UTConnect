-- Require current verified active membership even when the uploader deletes their own group file.

drop policy if exists group_materials_delete_uploader_or_admin on public.group_materials;
create policy group_materials_delete_uploader_or_admin
on public.group_materials
for delete
to authenticated
using (
  private.is_current_user_active_group_member(group_id)
  and (
    uploaded_by = auth.uid()
    or private.is_current_user_group_admin(group_id)
  )
);

drop policy if exists "Delete Materi 1sjhba6_0" on storage.objects;
create policy "Delete Materi 1sjhba6_0"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'group-materials'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.is_current_user_active_group_member(((storage.foldername(name))[1])::uuid)
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or private.is_current_user_group_admin(((storage.foldername(name))[1])::uuid)
  )
);
