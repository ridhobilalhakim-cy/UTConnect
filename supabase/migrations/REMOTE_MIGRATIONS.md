# Remote migration history — staging

These migrations have been applied on Supabase project `hqyusbyndtlfypdbmatw` (Seoul region). The first five SQL bodies still need to be reconstructed and reviewed for source control. Do not re-run anything from this file; it is a record only.

| Version | Name |
|---|---|
| 20261030180231 | enable_postgis_and_lock_down_defaults |
| 20261030180715 | utconnect_core_schema_v1 |
| 20261030181025 | utconnect_policy_performance_fix_v1 |
| 20261030181115 | utconnect_private_search_and_realtime_setup_v1 |
| 20261030181323 | utconnect_group_material_path_constraint_v1 |
| 20261030232434 | student_registration_profile_location_rpc_v1 |
| 20261031052849 | add_admin_roles_and_information_post_management |
| 20261031071140 | student_verification_workflow |
| 20261031101336 | secure_enable_group_join_workflow_rpcs |
| 20261031102733 | secure_matching_and_connection_workflows |
| 20261031104922 | secure_direct_message_read_receipts |
| 20261031111603 | secure_notifications_workflow |
| 20261031121632 | home_map_location_workflow |
| 20261031121933 | home_map_hidden_viewer_search |
| 20261031124333 | group_workspace_workflows |
| 20261031124407 | group_invite_inbox_limit |
| 20261031133930 | group_workspace_realtime_and_invite_notifications |
| 20261031134014 | group_members_realtime |
| 20261031134443 | group_poll_realtime_touch |
| 20261031135852 | group_membership_verification_guard |
| 20261031140523 | group_materials_verified_delete_guard |

The matching RPC SQL source is retained as `20261030232434_student_registration_profile_location_rpc_v1.sql`, but the file name timestamp is a local artifact name and not the remote migration version. Treat the remote migration history above as authoritative for the existing staging project.


The admin role schema and Information UT row-level policies are retained as `20261031150000_add_admin_roles_and_information_post_management.sql`. The initial three administrator assignments were provisioned directly in the private role table after confirming the corresponding Auth users; individual user identifiers are intentionally not committed to this public repository.


The student_verification_workflow migration is confirmed in the remote migration history. Its SQL source body has not yet been reconstructed into the repository; the live database was introspected and the frontend now calls the existing public RPC wrappers. Do not reapply a reconstructed SQL body to the existing staging project without a deliberate migration-drift review.


The group workflow RPC migration hardens `join_study_group` and `respond_group_join_request`: each verifies that its actor parameter matches `auth.uid()`. EXECUTE is granted to `authenticated` for these two verified-student operations and revoked from `PUBLIC` and `anon`; table writes remain mediated by the SECURITY DEFINER functions and existing RLS rules.


The Matching & Connections migration adds private search-event logging and guarded public RPCs for nearby matching, per-user connection summaries, and recipient-only request decisions. It grants INSERT (not UPDATE) on public.connections to authenticated; the existing RLS insert policy remains the authorization boundary. Matching results omit full names and precise coordinates; the service checks auth.uid() and student verification. See 20261031102733_secure_matching_and_connection_workflows.sql.

The Direct Messaging security migration is retained as `20261031104922_secure_direct_message_read_receipts.sql`. It restricts direct-message SELECT/INSERT to participants of an accepted connection who both remain verified and are not mutually blocked. Authenticated users receive only column-level UPDATE permission on `read_at`; message body and sender identity are not updateable by the browser role.

The Notifications migration is retained as `20261031111603_secure_notifications_workflow.sql`. It installs private trigger functions that create per-user notifications for connection requests/decisions, direct messages, forum comments on a user's own post, and group join requests/decisions. Authenticated users may read their own notifications and update only `read_at`; direct INSERT/DELETE and edits to notification content/ownership are not granted. The notifications table is added to `supabase_realtime`, with row ownership still enforced by RLS.


The Home Map migration 20261031121632 is retained as `20261031121632_home_map_location_workflow.sql`. It adds owner-scoped location management RPCs and a private per-user nearby-search rate-limit table. The follow-up 20261031121933 migration is retained as `20261031121933_home_map_hidden_viewer_search.sql`; it allows a student who has hidden their own radar pin to browse opted-in nearby students without making that student discoverable as a candidate. Location and nearby-search RPC execution is restricted to service_role and is mediated by the JWT-verified manage-my-location and nearby-students Edge Functions.


The Group workspace migration set is retained in these source files:
- `20261031124333_group_workspace_workflows.sql`: private one-vote-per-member poll storage/RPCs, server-validated private invitations, owner/admin cancellation, and actor-bound group-message pinning.
- `20261031124407_group_invite_inbox_limit.sql`: private per-admin invitation lookup throttling and an invitee-only inbox RPC.
- `20261031133930_group_workspace_realtime_and_invite_notifications.sql`: group invite notification trigger and Realtime publication for agenda, materials, and invitations.
- `20261031134014_group_members_realtime.sql`: RLS-filtered membership update publication.
- `20261031134443_group_poll_realtime_touch.sql`: updates the agenda row after poll votes so other group members receive refreshed aggregate poll results.

The `manage-group-invites` Edge Function is deployed as version 1 with JWT verification. It HMACs NIM on the server, resolves only verified profiles, creates/cancels invitations through actor-checked RPCs, and returns no invitee UUID to the browser. The private `group-materials` Storage bucket remains non-public; active group membership and the existing object policies govern upload/read/delete, and the client uses short-lived signed download URLs.


The final Group membership verification guard is retained as `20261031135852_group_membership_verification_guard.sql`. It makes active-member and admin helper checks require the current account to remain a verified student, and hardens the membership decision, poll, invitation inbox, pin, and invitation-cancellation RPCs so previously active membership does not preserve access after verification is revoked.


The `20261031140523_group_materials_verified_delete_guard.sql` migration further tightens material deletion: both the metadata row and Storage object deletion now require current verified active group membership, even when the caller uploaded the file. Active group admins/co-admins may still delete any material in their group.


## Bug-fix migration — 2026-10-31

- `20261031162034_bugfix_forum_chat_profile_avatars_group_notifications.sql` was applied to the connected staging project as remote version `20261031162034`.
- Adds public-read, owner-write profile avatar storage (5 MiB, JPEG/PNG/WebP), `update_my_profile_avatar`, privacy-scoped `get_forum_author_profiles`, and verified accepted-connection `get_my_chat_rooms`.
- Replaces `update_my_student_profile` with the official UT S1 faculty/programme validation, preserving its explicit acknowledgement requirement before verified identity changes reset verification to pending.
- Adds group activity notifications for newly inserted group messages, materials, and agenda items. The new notification types route back to the group workspace.
- `complete-student-registration` Edge Function is deployed as version 5 with JWT verification enabled and the same UT S1 faculty/programme validation.

- `20261031163243_profile_avatar_presets.sql`: permits only the four bundled preset avatar identifiers in the owner-scoped avatar RPC; uploaded photos still require a caller-owned Storage object.
