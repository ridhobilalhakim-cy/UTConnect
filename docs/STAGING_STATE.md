# UT Connect — Live Staging State (checked 2026-10-31)

Project ref: `hqyusbyndtlfypdbmatw`  
Project name: `UTConnect Project 1`  
Region: `ap-northeast-2` (Seoul)  
Postgres: 17.11  
Project status at inspection: ACTIVE_HEALTHY

## Remote migration history

The connected staging project reported these nine applied migration entries:

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

Live introspection found the public application tables with RLS enabled, plus private NIM search and student-verification tables. PostGIS is enabled. The deployed `complete-student-registration` Edge Function was last confirmed as ACTIVE version 4 with JWT verification enabled.

## Important source-control caveat

The remote database has a full migration history, but this repository currently contains only the registration/location RPC migration source plus a mirror of the deployed Edge Function. The SQL bodies of the first five remote migrations have not yet been reconstructed into a reviewed local migration chain. Do not run the included SQL migration blindly against the existing staging project, and do not run an old initial schema dump on staging.

Next database-maintenance task: create a reviewed, reproducible schema snapshot/migration baseline that matches the live database, compare it against the remote migration history, and document a clean new-project bootstrap path.

## Existing data

Latest live introspection returned four rows in `profiles` and four rows in `user_locations`. Treat these as real staging records and do not delete them without confirming ownership with the team.

## Current frontend integration status

- Login and registration page share one Supabase client module and storage key.
- Dashboard is protected by session and profile lookup.
- Information UT, Student Verification, Forum Diskusi, and Grup Belajar now call Supabase service modules. The forum supports verified-only posts and comments. Groups support verified-only discovery/creation, joining, approval requests, and admin review.
- Matching, chat, group messages/materials/agenda, map markers, and notifications remain demo/simulated rather than live multi-user modules.
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

- The group schema already existed in staging: `public.study_groups`, `public.group_members`, `public.group_invites`, `public.group_messages`, `public.group_agenda_items`, and `public.group_materials`. All group tables inspected in this audit have RLS enabled.
- `study_groups` SELECT is limited to verified students and hides private groups from users who are neither active members nor invitees. INSERT requires a verified caller and `created_by = auth.uid()`. Group update/delete policies require an active admin/co-admin.
- `group_members` has authenticated SELECT only; direct INSERT/UPDATE/DELETE is not granted to authenticated. Membership creation and approval are done through the database RPCs.
- Trigger `trg_add_group_creator_as_admin` automatically inserts the creator as an active admin when a group is created.
- Migration `20261031101336_secure_enable_group_join_workflow_rpcs` is applied. It hardens `join_study_group` and `respond_group_join_request` with `auth.uid() = p_actor_id` validation and grants EXECUTE to authenticated/service_role while revoking PUBLIC/anon.
- Supabase advisors intentionally report a SECURITY DEFINER execution warning for these two RPCs because signed-in verified students need to call them. The actor check, group verification/capacity logic, and admin-role check remain in the function bodies; this warning is not evidence that anonymous callers can execute them.
- Access modes are `open`, `approval`, and `private`; modes are `online` and `offline`; member statuses are `pending`, `active`, `rejected`, and `left`. The first two access modes are available in group creation UI; private invite management is not yet included.
- Active course count is 0, so users may create general groups without associating a course.
- Live counts after implementation: 0 study groups, 0 group members, 0 group invites, and 0 active courses. No test rows were created in the live database.
- Four new Playwright test scenarios were added for unverified gating, verified group creation, approval-based join requests, and admin approval. The current repository defines 17 tests total; these four are not marked passing until CI confirms the latest commit.
- Real-account group creation/join/approval and current Netlify deployment remain external acceptance tests.
