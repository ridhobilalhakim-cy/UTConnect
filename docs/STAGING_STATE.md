# UT Connect — Live Staging State (checked 2026-10-31)

Project ref: `hqyusbyndtlfypdbmatw`  
Project name: `UTConnect Project 1`  
Region: `ap-northeast-2` (Seoul)  
Postgres: 17.11  
Project status at inspection: ACTIVE_HEALTHY

## Remote migration history

The connected staging project reported these six applied migration entries:

| Version | Name |
|---|---|
| 20261030180231 | enable_postgis_and_lock_down_defaults |
| 20261030180715 | utconnect_core_schema_v1 |
| 20261030181025 | utconnect_policy_performance_fix_v1 |
| 20261030181115 | utconnect_private_search_and_realtime_setup_v1 |
| 20261030181323 | utconnect_group_material_path_constraint_v1 |
| 20261030232434 | student_registration_profile_location_rpc_v1 |

Live introspection found 19 public application tables with RLS enabled, plus the private NIM search event table. PostGIS is enabled. The deployed `complete-student-registration` Edge Function was last confirmed as ACTIVE version 4 with JWT verification enabled.

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
