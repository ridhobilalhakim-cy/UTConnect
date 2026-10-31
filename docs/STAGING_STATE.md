# UT Connect — Live Staging State (checked 2026-10-31)

Project ref: `hqyusbyndtlfypdbmatw`  
Project name: `UTConnect Project 1`  
Region: `ap-northeast-2` (Seoul)  
Postgres: 17.11  
Project status at inspection: ACTIVE_HEALTHY

## Remote migration history

The connected staging project reported these eight applied migration entries:

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

Live introspection found the public application tables with RLS enabled, plus private NIM search and student-verification tables. PostGIS is enabled. The deployed `complete-student-registration` Edge Function was last confirmed as ACTIVE version 4 with JWT verification enabled.

## Important source-control caveat

The remote database has a full migration history, but this repository currently contains only the registration/location RPC migration source plus a mirror of the deployed Edge Function. The SQL bodies of the first five remote migrations have not yet been reconstructed into a reviewed local migration chain. Do not run the included SQL migration blindly against the existing staging project, and do not run an old initial schema dump on staging.

Next database-maintenance task: create a reviewed, reproducible schema snapshot/migration baseline that matches the live database, compare it against the remote migration history, and document a clean new-project bootstrap path.

## Existing data

The live introspection returned one row in `profiles` and one in `user_locations` at the time of inspection. These may be test records. Do not delete them without confirming ownership with the team.

## Current frontend integration status

- Login and registration page share one Supabase client module and storage key.
- Dashboard is protected by session and profile lookup.
- Dashboard interaction code is still a demonstration shell; live data integrations are pending.
- Google OAuth provider setup has not been verified end-to-end in this audit.
- Do not use real student NIM/location until registration and access-control tests have passed.


## Student Verification state (checked 2026-10-31)

- The remote migration history includes 20261031071140_student_verification_workflow.
- Private tables: private.student_verification_requests and private.student_verification_review_events; direct authenticated table access is not granted.
- Private Storage bucket: student-verification-evidence, 5 MB limit, PDF/JPEG/PNG only.
- Student upload is restricted to the caller's own folder and pending/rejected profiles without an outstanding request.
- Admin queue/review functions check the signed-in user and administrator role. Review decisions update profiles.verification_status and add a review event.
- Authenticated role cannot directly UPDATE profiles.verification_status.
- Counts at inspection: 3 profiles pending, 0 verified, 0 rejected; 0 submitted verification requests; 0 review events.
- The UI now integrates these existing services. Actual browser upload/download with real accounts still needs acceptance testing. Evidence acceptance and retention rules remain a project policy decision.
