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

The matching RPC SQL source is retained as `20261030232434_student_registration_profile_location_rpc_v1.sql`, but the file name timestamp is a local artifact name and not the remote migration version. Treat the remote migration history above as authoritative for the existing staging project.


The admin role schema and Information UT row-level policies are retained as `20261031150000_add_admin_roles_and_information_post_management.sql`. The initial three administrator assignments were provisioned directly in the private role table after confirming the corresponding Auth users; individual user identifiers are intentionally not committed to this public repository.


The student_verification_workflow migration is confirmed in the remote migration history. Its SQL source body has not yet been reconstructed into the repository; the live database was introspected and the frontend now calls the existing public RPC wrappers. Do not reapply a reconstructed SQL body to the existing staging project without a deliberate migration-drift review.


The group workflow RPC migration hardens `join_study_group` and `respond_group_join_request`: each verifies that its actor parameter matches `auth.uid()`. EXECUTE is granted to `authenticated` for these two verified-student operations and revoked from `PUBLIC` and `anon`; table writes remain mediated by the SECURITY DEFINER functions and existing RLS rules.


The Matching & Connections migration adds private search-event logging and guarded public RPCs for nearby matching, per-user connection summaries, and recipient-only request decisions. It grants INSERT (not UPDATE) on public.connections to authenticated; the existing RLS insert policy remains the authorization boundary. Matching results omit full names and precise coordinates; the service checks auth.uid() and student verification. See 20261031102733_secure_matching_and_connection_workflows.sql.

The Direct Messaging security migration is retained as `20261031104922_secure_direct_message_read_receipts.sql`. It restricts direct-message SELECT/INSERT to participants of an accepted connection who both remain verified and are not mutually blocked. Authenticated users receive only column-level UPDATE permission on `read_at`; message body and sender identity are not updateable by the browser role.

The Notifications migration is retained as `20261031111603_secure_notifications_workflow.sql`. It installs private trigger functions that create per-user notifications for connection requests/decisions, direct messages, forum comments on a user's own post, and group join requests/decisions. Authenticated users may read their own notifications and update only `read_at`; direct INSERT/DELETE and edits to notification content/ownership are not granted. The notifications table is added to `supabase_realtime`, with row ownership still enforced by RLS.


The Home Map migration 20261031121632 is retained as `20261031121632_home_map_location_workflow.sql`. It adds owner-scoped location management RPCs and a private per-user nearby-search rate-limit table. The follow-up 20261031121933 migration is retained as `20261031121933_home_map_hidden_viewer_search.sql`; it allows a student who has hidden their own radar pin to browse opted-in nearby students without making that student discoverable as a candidate. Location and nearby-search RPC execution is restricted to service_role and is mediated by the JWT-verified manage-my-location and nearby-students Edge Functions.
