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

The matching RPC SQL source is retained as `20261030232434_student_registration_profile_location_rpc_v1.sql`, but the file name timestamp is a local artifact name and not the remote migration version. Treat the remote migration history above as authoritative for the existing staging project.


The admin role schema and Information UT row-level policies are retained as `20261031150000_add_admin_roles_and_information_post_management.sql`. The initial three administrator assignments were provisioned directly in the private role table after confirming the corresponding Auth users; individual user identifiers are intentionally not committed to this public repository.
