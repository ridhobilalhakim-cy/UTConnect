# UT Connect — Live Staging State (checked 2026-10-31)

Project ref: `hqyusbyndtlfypdbmatw`  
Project name: `UTConnect Project 1`  
Region: `ap-northeast-2` (Seoul)  
Postgres: 17.11  
Project status at inspection: ACTIVE_HEALTHY

## Remote migration history

The connected staging project reported these twenty-one applied migration entries:

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
| 20261031140027 | group_materials_verified_delete_guard |
| 20261031124333 | group_workspace_workflows |
| 20261031124407 | group_invite_inbox_limit |
| 20261031133930 | group_workspace_realtime_and_invite_notifications |
| 20261031134014 | group_members_realtime |
| 20261031134443 | group_poll_realtime_touch |
| 20261031135852 | group_membership_verification_guard |
| 20261031133930 | group_workspace_realtime_and_invite_notifications |
| 20261031134014 | group_members_realtime |
| 20261031134443 | group_poll_realtime_touch |

Live introspection found the public application tables with RLS enabled, plus private NIM search and student-verification tables. PostGIS is enabled. The deployed `complete-student-registration` Edge Function was last confirmed as ACTIVE version 4 with JWT verification enabled.

## Important source-control caveat

The remote database has a full migration history. This repository retains SQL sources for the registration/location RPC, administrator and Information UT policies, group workflow RPCs, Matching & Connections, and Direct Messaging, plus a mirror of the deployed Edge Function. The SQL bodies of the first five remote migrations and the remote student_verification_workflow migration have not yet been reconstructed into a reviewed local migration chain. Do not run the included SQL migrations blindly against the existing staging project, and do not run an old initial schema dump on staging.

Next database-maintenance task: create a reviewed, reproducible schema snapshot/migration baseline that matches the live database, compare it against the remote migration history, and document a clean new-project bootstrap path.

## Existing data

Latest live introspection returned four rows in `profiles` and four rows in `user_locations`. Treat these as real staging records and do not delete them without confirming ownership with the team.

## Current frontend integration status

- Login and registration page share one Supabase client module and storage key.
- Dashboard is protected by session and profile lookup.
- Home Map, Information UT, Student Verification, Forum Diskusi, Grup Belajar, Matching/Connections, Direct Messaging, and Notifications use Supabase-backed services. Home Map stores the signed-in user's location through an owner-scoped Edge Function and returns jittered nearby-student markers only to verified students who pass the server-side search workflow.
- Group messages/materials/agenda and several other V2.2 interactions remain demo/simulated rather than live multi-user modules.
- Google OAuth provider setup has not been verified end-to-end in this audit.
- The live database uses NIM digest rather than displaying plaintext NIM. Do not expose real student NIM/location until registration and access-control tests have passed.


## Student Verification state (checked 2026-10-31)

- The remote migration history includes 20261031071140_student_verification_workflow.
- Private tables: private.student_verification_requests and private.student_verification_review_events; direct authenticated table access is not granted.
- Private Storage bucket: student-verification-evidence, 5 MB limit, PDF/JPEG/PNG only.
- Student upload is restricted to the caller's own folder and pending/rejected profiles without an outstanding request.
- Admin queue/review functions check the signed-in user and administrator role. Review decisions update profiles.verification_status and add a review event.
- Authenticated role cannot directly UPDATE profiles.verification_status.
- Latest counts: 4 profiles total; 1 verified, 3 pending, 0 rejected; 1 verification request approved; 1 approved review event; 0 requests awaiting review.
- The UI now integrates these existing services. Actual browser upload/download with real accounts still needs acceptance testing. Evidence acceptance and retention rules remain a project policy decision.


## Forum Diskusi state (checked 2026-10-31)

- Forum data uses public.forum_posts and public.forum_comments. Both tables have RLS enabled.
- SELECT and INSERT are restricted to verified users; inserts require author_id = auth.uid(). UPDATE and DELETE policies are scoped to the original author.
- Active courses are readable but the catalogue currently contains 0 active courses. The forum therefore permits general discussions without a course link.
- Latest table counts: 0 forum posts, 0 forum comments, 0 active courses.
- Latest profile counts: 1 verified, 3 pending, 0 rejected. One approved verification request and one corresponding review event exist. No forum or comment test data was inserted into Supabase.
- Profile RLS limits profile reads to the current user, so the forum UI masks other students' names instead of querying private profile data.
- The frontend forum module is covered by mocked Playwright tests; real-account browser acceptance is still outstanding.


## Grup Belajar state (checked 2026-10-31)

- The group schema already existed in staging: `public.study_groups`, `public.group_members`, `public.group_invites`, `public.group_messages`, `public.group_agenda_items`, and `public.group_materials`. RLS is enabled on these tables.
- Verified students can discover eligible groups, create groups, join open groups, request approval, and receive admin decisions. The creator becomes the initial active admin through the existing database trigger.
- The Group workspace is now integrated in the dashboard with tabs for **Chat grup**, **Materi**, **Agenda**, and (for private groups) **Undangan**. Group admins additionally see the **Anggota** tab to approve/reject pending join requests. The old details-only modal is replaced by this workspace.
- Chat reads/sends through `group_messages`. Active group membership is required by RLS; admin pin/unpin uses `set_group_message_pin`, which checks `auth.uid() = p_actor_id` and active admin/co-admin membership.
- Group materials use the existing private `group-materials` bucket (50 MB limit; PDF, DOC, DOCX, PPTX, XLSX, JPG, PNG). Metadata is written to `group_materials`; active members can receive short-lived signed download URLs. Upload/read/delete remain protected by Storage and table RLS policies.
- Agenda supports `schedule`, `target`, `task`, `poll`, and `note`. Active members can create agenda entries. Creator/admin RLS policies govern update/delete. Poll choices are validated to 2–6 unique options; votes are stored in `group_agenda_votes` with one vote per user and aggregate-only results are returned through actor-checked RPCs.
- Private invitation flow uses JWT-verified Edge Function `manage-group-invites` v1. The server validates the session, HMACs submitted NIM, resolves only verified profiles, and calls actor-checked invitation RPCs. The invitee UUID is not returned to the browser. Admin NIM lookup is limited to five per minute. Invitees see an owner-scoped invitation inbox and can accept or decline.
- Private invitations create a database notification of type `group_invite`. The dashboard notification opens the Groups page where the invitee can respond.
- Realtime publication includes `group_messages`, `group_materials`, `group_agenda_items`, `group_invites`, `group_members`, and `notifications`. Realtime callbacks are scoped by group ID and remain subject to each table's RLS SELECT policy. Poll vote changes touch the agenda row so aggregate counts refresh for other active members.
- Security migrations applied: `20261031124333_group_workspace_workflows`, `20261031124407_group_invite_inbox_limit`, `20261031133930_group_workspace_realtime_and_invite_notifications`, `20261031134014_group_members_realtime`, and `20261031134443_group_poll_realtime_touch`. The RPCs are SECURITY DEFINER but validate the signed-in actor; no direct authenticated writes to `group_members` or poll vote table are granted.
- Migration `20261031135852_group_membership_verification_guard` updates the central RLS membership/admin helpers to require the account to remain currently verified; group contents and admin actions stop working if verification is revoked. It also hardens membership decisions, poll RPCs, invite inbox, and message pinning.
- Migration `20261031140027_group_materials_verified_delete_guard` also requires current verified active group membership to delete a material, including for its uploader. Admin/co-admin deletion remains scoped to active verified group admins.\n- The Storage bucket remains private with a 50 MiB file limit and three Storage policies. The current group schema has no active course rows, so users can create general groups.
- Live staging counts remain 0 study groups, 0 group members, 0 group invites, and 0 active courses. No group test records were retained in Supabase.
- The repository now defines 35 Playwright scenarios, including five group workspace tests for chat/pin, material upload, poll creation/voting, private invite by NIM, and invite acceptance. They use mocked Supabase/Storage responses; CI for the latest PR commit is still pending. Mocked browser tests do not replace live two-account acceptance.
- Outstanding real-account checks: two verified synthetic accounts to verify cross-account chat, signed file access, poll Realtime updates, invite notification delivery, member approval and private-invite acceptance. Netlify production deployment is still unconfirmed.

## Matching & Connections state (checked 2026-10-31)

- The new migration 20261031102733_secure_matching_and_connection_workflows is applied to staging.
- public.find_matching_students requires an authenticated, verified caller and supports only 1,000, 3,000, or 5,000 metres. It wraps the existing find_nearby_students RPC, which filters verified candidates to users with show_in_radar = true, excludes self and mutual blocks, and returns a jittered approximate distance. The new wrapper does not return marker coordinates.
- The wrapper returns at most ten rows with candidate ID for connection addressing, initials, program, approximate distance, active course names, topic tags, interests, and study times. Full names and NIM digests are not returned.
- private.match_search_events is a private RLS-enabled table with no authenticated/anon privileges. The matching RPC rate-limits each user to 30 search requests per 10 minutes.
- matching_preferences and profile_courses retain their existing owner-only RLS policies. Authenticated users can only read and modify their own preferences/course links.
- The existing connections_insert_request policy requires the signed-in verified sender, a different verified recipient, pending status, and no block. The migration grants authenticated INSERT only; direct UPDATE remains unavailable.
- get_my_connection_summaries exposes only a user's own connection rows and the other participant's initials/program. respond_connection_request verifies the signed-in user is the recipient of a pending request and re-checks both verification states and mutual block status before changing the result.
- The three new SECURITY DEFINER RPCs are intentionally callable by authenticated users. Supabase security advisors report these as warnings; they use the current session identity and return or modify only caller-authorized data.
- Accepted connections now expose a Direct Messaging action. The database migration requires both participants to remain verified, requires an accepted connection, excludes mutual blocks, and permits authenticated users to update only the `read_at` column.
- The existing `public.direct_messages` table is part of `supabase_realtime`. The browser fetches recent messages, sends messages, marks incoming messages as read, and subscribes to changes filtered by the active connection. Manual reload is available as a fallback.
- Live staging remains at 0 connections and 0 direct messages, with only one verified profile. Real two-party chat and Realtime acceptance therefore remains untested until a second verified account is available.


Latest data counts: 0 matching preference rows, 0 profile-course links, 0 connection records, 0 direct messages, and 0 matching search events. There are four profiles (one verified and three pending), four radar-opt-in location rows, and zero active courses. No matching preferences, connections, or search events were created as test data.

## Notifications state (checked 2026-10-31)

- Migration `20261031111603_secure_notifications_workflow` is applied to staging and its SQL source is retained in `supabase/migrations/`.
- Six private SECURITY DEFINER trigger functions generate notifications for: incoming connection requests; accepted/rejected connection decisions; direct messages; comments on a user's own forum post; new group join requests to active group admins/co-admins; and approval/rejection of a group join request.
- `public.notifications` is included in `supabase_realtime`. The browser subscribes only to rows filtered by the current `user_id`; the table's RLS policy permits SELECT only when `user_id = auth.uid()`.
- Authenticated users cannot INSERT or DELETE notifications and cannot edit title/body/owner. They have column-level UPDATE on `read_at` only, with an RLS check that restricts updates to their own unread notifications.
- The dashboard bell displays an unread count, lists recent notifications, marks one or all as read, and routes direct-message, forum-comment, connection, and group notifications to the relevant feature.
- A temporary SQL transaction verified all six trigger events using synthetic profiles, a connection, message, forum post/comment, and group join. Authenticated receiver/owner contexts saw only their own notification rows; read_at updates worked while attempts to insert or change title were not granted. The transaction ended with ROLLBACK.
- Latest real staging counts remain 0 notifications, 0 connections, 0 direct messages, 0 forum posts/comments, and 0 groups/members. No test data was retained. Two mocked Playwright tests were added; CI has not yet confirmed them.

## Direct Messaging state (checked 2026-10-31)

- Migration `20261031104922_secure_direct_message_read_receipts` is applied to staging and its SQL source is retained in `supabase/migrations/`.
- `public.direct_messages` has RLS enabled and uses the existing `connections` relation. SELECT and INSERT require the current user to be verified, the other participant to remain verified, an accepted connection, and no mutual block.
- Read receipts are restricted to recipient-side updates of previously unread messages. Authenticated has column-level UPDATE on `read_at` only; table-wide UPDATE, `body`, and `sender_id` updates remain unavailable.
- The table is included in the `supabase_realtime` publication. The browser subscribes to INSERT/UPDATE events for the active connection and removes the channel when the chat dialog closes. A manual refresh path remains available if Realtime disconnects.
- The chat action appears only on accepted connection rows. The UI loads the latest 60 messages, displays initials/program rather than full identity, escapes message content, supports up to 5,000 characters, and marks unread incoming messages as read.
- Live verification: one temporary SQL transaction created a synthetic accepted connection/message, switched to an authenticated recipient context, successfully updated `read_at`, then changed the connection to pending and confirmed the messages were no longer visible. The transaction ended with ROLLBACK; no synthetic record or profile status change remains.
- Latest real counts remain 0 connections and 0 direct messages; there is one verified profile and three pending profiles. Two mocked browser tests were added, but CI has not yet confirmed them. Real two-account chat and Realtime testing is still required.

## Home Map state (checked 2026-10-31)

- Remote migrations 20261031121632_home_map_location_workflow and 20261031121933_home_map_hidden_viewer_search are applied; their SQL sources are retained in supabase/migrations/.
- Edge Function manage-my-location v1 and nearby-students v2 are ACTIVE with JWT verification enabled. The source and Deno import maps are retained under supabase/functions/.
- Database functions get_my_location, save_my_location, set_my_location_visibility, consume_nearby_search_limit, and find_nearby_students have EXECUTE grants only for service_role; direct authenticated/anon execution is revoked.
- The user_locations table has RLS enabled with a self-row policy. The frontend uses the Edge Function boundary; it does not query another student's exact coordinate.
- The owner-only location endpoint derives the owner ID from the validated session and returns exact location only to that owner. The nearby endpoint requires a verified profile, limits radius to 1/3/5 km, enforces a 30-search/minute server limit, and applies the existing five-per-minute NIM search limit.
- NIM is HMACed in the Edge Function using the server-side NIM_HMAC_SECRET. Nearby results are capped at ten and contain initials, program, rounded distance, and jittered marker coordinates. Students who opt out of radar visibility are excluded as candidates but can still browse nearby students.
- Both Edge Functions set Cache-Control: no-store. The Home Map UI includes explicit location consent, GPS refresh, confirmed manual map-point selection, radar visibility, and radius selection. The old fabricated student/NIM list and fixed Bandung center have been removed.
- Latest mocked browser verification: GitHub Actions run #119, all 30 Playwright tests passed. This does not replace live acceptance with two verified synthetic accounts. The current staging database still has only one verified profile and no nearby test cohort; no live location rows or real student records were inserted or altered during this feature work.
- Before public release, configure explicit CORS origin allowlists for the actual app domain and complete two-account location privacy tests. Netlify deployment status and production URL are still unconfirmed.
