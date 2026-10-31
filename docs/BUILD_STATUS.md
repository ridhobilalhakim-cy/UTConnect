# Build and verification status — UT Connect web app integrations

Date: 2026-10-31

## Latest CI result

Latest confirmed successful GitHub Actions run for the complete Group workspace: **run #171** on 2026-10-31.

Commit: `3fb584e089c87c552f805842974b5fb3be9aa813`

- Dependency installation with committed lockfile — PASS.
- `npm run check` — PASS.
- `npm run build` — PASS; Vite generated the production site in `dist/`.
- Playwright Chromium installation — PASS.
- Browser end-to-end suite — **35 passed, 0 failed**.

Workflow run: https://github.com/ridhobilalhakim-cy/UTConnect/actions/runs/41208606720

These browser tests use mocked Supabase/Storage HTTP responses and synthetic fixtures. They verify the UI wiring and production bundle but do not establish real two-account Realtime, real Storage access, OAuth/email delivery, or deployment to Netlify. Documentation/migration-history cleanup commits were pushed after run #171; the newest PR-head CI run is tracked separately in GitHub Actions.

## Information UT milestone

The Information UT page now uses the Supabase `public.information_posts` table rather than a hardcoded sample array.

Administrator actions available in the UI:
- Create an information post.
- Edit an existing post.
- Publish a draft or unpublish an existing post.
- Delete a post.
- Select category, audience, and optional HTTP(S) source URL.

Student feed behavior:
- Students can read published posts allowed by the database audience policy.
- Drafts are visible to administrators only.
- The management button is hidden for non-admin accounts.
- The production table currently has zero information posts; no sample posts have been inserted.

The 13 mocked Playwright tests cover auth UI/session behavior, admin Information UT CRUD/publication, student read-only visibility, Student Verification upload/review, and Forum Diskusi verified-only access, post creation, and comments. They verify client-side behavior but do not substitute for a real-browser test against live Supabase.

## Supabase role and RLS verification

- Three administrator assignments are present in `private.app_user_roles`.
- `public.is_current_user_admin()` returned `true` for an assigned admin and `false` for a non-admin student profile.
- An authenticated admin insert into `information_posts` passed RLS.
- An authenticated non-admin student insert was rejected by RLS.
- The admin insert acceptance test was rolled back; the live Information UT table remains empty.
- Administrator privilege does not change `profiles.verification_status`.

At the last database check:
- 3 administrator roles exist.
- 4 student profiles exist; 1 is `verified` and 3 are `pending`.
- 0 profiles are `rejected`.
- One of the four profiles is verified; administrator roles remain separate from student verification status.

## What this does and does not prove

The CI browser tests use mocked Supabase HTTP responses and synthetic test data. They prove source integrity, production bundle construction, and client UI behavior under mocked responses. They do **not** prove live Google OAuth, real email delivery, cross-account Realtime, live location privacy behavior between separate accounts, end-to-end CRUD against the production Supabase API, or successful Netlify deployment.

This environment could not independently resolve the public Netlify domain. The Netlify production deployment therefore remains an external acceptance check; do not assume a passing GitHub Actions run proves that the latest commit is already live.

## Remaining acceptance gates

1. Confirm Netlify has deployed the latest successful commit; CI success alone does not prove the public site has updated.
2. Complete two-account Home Map acceptance with synthetic verified staging accounts: explicit consent, own-location access, radar opt-in/out, jittered markers, hidden-viewer search, and NIM lookup.
3. Complete real-account group, preference, connection-request, two-party chat, notification-trigger, and Realtime acceptance checks.
4. Test Google sign-in, profile completion, live Information UT admin CRUD, and student read visibility in real browser sessions.
5. Define and publish the Student Verification evidence acceptance and retention policy before opening that workflow publicly.
6. Configure explicit allowed-origin CORS values for the deployed app domain on the new Edge Functions before public release.

## Source-control caveats

- The remote staging project has twenty-one recorded migrations. The first five original SQL bodies and the student_verification_workflow SQL body still need reconstruction/review in repository source. Do not re-run them blindly against the live staging database.
- Edge Function source edits in GitHub do not automatically deploy to Supabase. The Home Map functions were explicitly deployed to staging; the registration Edge Function remains a separately deployed source mirror.
- Never put the Supabase service-role key, secret keys, or NIM HMAC secret in browser code or public GitHub files.


## Student Verification milestone

The dashboard now contains a Student Verification page backed by the existing remote workflow (student_verification_workflow migration).

Student experience:
- View their own verification status and most recent review note.
- Upload one PDF, JPG, or PNG document (maximum 5 MB) to the private student-verification-evidence bucket.
- Submit the uploaded object through the authenticated submit_student_verification RPC.
- See the pending state while the request awaits review.
- Resubmit evidence after a rejection.

Administrator experience:
- Read the review queue through an admin-only RPC.
- Download private evidence for inspection.
- Approve or reject a request. Rejection requires a reason of at least five characters.
- Each decision updates the student profile status and writes a review event to the private audit table.

Security observations from live Supabase inspection:
- The evidence bucket is private, limited to 5 MB, and configured for PDF/JPEG/PNG.
- Storage policies restrict upload to the authenticated owner's folder; admin access is required to read evidence.
- The private request and review tables have RLS enabled and no direct authenticated table grants. Access is through functions that check the current user and administrator role.
- authenticated does not have UPDATE privilege on profiles.verification_status; a student cannot directly mark themselves verified.
- Login identity is not treated as proof of UT enrollment.

Important limitations:
- The UI suggests current-semester registration/KRS as evidence examples, with KTM as supporting evidence. This is manual review guidance, not an official automatic verification. No official UT API or registrar integration is present.
- The team still needs a written evidence acceptance and retention policy, including how long submitted identity documents are kept and when they are deleted.
- Playwright tests mock Supabase RPC and Storage. Actual end-to-end upload, secure download, and review with real accounts are not yet browser-verified.
- No real student request or status has been changed during implementation.

At the latest live database check:
- 4 profiles exist: 1 verified and 3 pending.
- 1 verification request has status approved.
- 1 approved review event is recorded.
- 0 requests are awaiting review.


## Forum Diskusi milestone

The Forum page is now connected to the existing public.forum_posts and public.forum_comments tables through src/services/forum.js.

Student experience:
- Verified students can browse the latest 50 discussions.
- They can create a post with a title (3–140 characters), body (up to 5,000 characters), and post type: need_help, can_help, or discussion.
- An optional active course can be attached. The current active course catalogue is empty, so discussions can still be posted as general discussions.
- Students can open a thread, read comments, add comments (up to 3,000 characters), and delete their own posts/comments.
- Pending/rejected students see a verification gate and cannot access the forum UI.

Security boundary:
- Live RLS policies on forum_posts and forum_comments restrict SELECT and INSERT to verified users and enforce author_id = auth.uid() for inserts.
- UPDATE/DELETE policies scope post/comment changes to the original author.
- The UI receives the signed-in user's own name from the profile already loaded for the session. Other students' profile names are masked because profiles RLS does not permit reading another user's profile record.
- Existing RLS remains authoritative; the UI gate is supplementary and cannot grant access by itself.

Live database counts at the latest check: 0 forum posts, 0 forum comments, and 0 active courses. One of four profiles is verified; three are pending. The private verification tables contain one approved request and one approved review event. No live forum test records were inserted.

The 13 Playwright tests use mocked Supabase HTTP routes and synthetic data. They prove client-side flows but do not prove live posting/commenting across real accounts. Real-browser acceptance against Supabase and confirmation of the Netlify deployment are still required.


## Grup Belajar milestone — live workspace integrated 2026-10-31

The Groups page now opens a live workspace through `src/app/group-workspace.js` and `src/services/groups.js`.

- **Chat grup:** reads and sends `public.group_messages` for active members. Admin/co-admin pin/unpin uses actor-checked RPC `set_group_message_pin`. Realtime refreshes message history.
- **Materi:** uploads to the existing private `group-materials` bucket (50 MiB limit; PDF, DOC/DOCX, PPTX, XLSX, JPG, PNG), records metadata in `public.group_materials`, and generates 10-minute signed download URLs for active members. Uploader or active group admin/co-admin can delete, provided the caller remains a verified active member.
- **Agenda:** supports schedule, target, task, poll and note. Active members can create; creator/admin permissions govern updates/deletes. Polls have 2–6 unique options and one vote per member. Vote rows are private and only aggregate totals/options are returned.
- **Anggota:** admins/co-admins can approve or reject pending join requests. Other profile identities remain masked; decisions use the authenticated membership RPC.
- **Undangan privat:** admins/co-admins can invite verified students by nine-digit NIM. NIM is HMACed in an Edge Function and resolved server-side; invitee UUID is not returned to the browser. Invitees see an owner-scoped inbox and can accept or decline.
- Private group invitations create a `group_invite` notification and route the recipient to Groups.
- Realtime includes messages, materials, agenda, invitations and membership status; all events remain subject to RLS SELECT policies.
- Course catalogue is currently empty, so creating general groups remains supported.

Security changes applied to staging:
- `20261031101336_secure_enable_group_join_workflow_rpcs` retains actor checks for join and membership decisions.
- `20261031124333_group_workspace_workflows` adds private poll voting, actor-checked invitations, cancellation and actor-bound message pinning.
- `20261031124407_group_invite_inbox_limit` adds a private invite inbox and five-per-minute NIM lookup limit.
- `20261031133930_group_workspace_realtime_and_invite_notifications`, `20261031134014_group_members_realtime`, and `20261031134443_group_poll_realtime_touch` add RLS-filtered Realtime updates and invite notifications.
- `20261031135852_group_membership_verification_guard` requires current verification for active-member/admin access and the protected membership, poll, invite-inbox and pin RPCs.
- `20261031140523_group_materials_verified_delete_guard` requires current verified active membership for material metadata and Storage deletion, including when the caller uploaded the file.
- Edge Function `manage-group-invites` v1 is ACTIVE with JWT verification. The `group-materials` bucket remains private; `group_agenda_votes` has RLS enabled and user access only through actor-checked RPCs.

Live staging counts remain 0 study_groups, 0 group_members, 0 group_invites, and 0 active courses. No group test records were retained.

The repository defines 35 mocked Playwright scenarios. Run #171 passed all 35 tests, including the five Group workspace scenarios for chat/pinning, private material upload, poll creation/voting, private invitation by NIM, and invite acceptance. Later changes clean up migration-history and status documentation; the latest PR-head CI run remains the merge gate. Real two-account group chat, Storage access, invitation notification, poll Realtime and membership approval remain external acceptance checks.


## Matching & Connections milestone — implementation added 2026-10-31

The Matching page now uses src/services/matching.js and the existing matching_preferences, profile_courses, user_locations, and connections schema.

Student experience:
- Verified students can save their own learning topics, interests, preferred study times, and selected active courses.
- Matching search supports radii of 1 km, 3 km, and 5 km, with at most ten results.
- Candidate cards display initials, study program, approximate distance, active course names, topics, interests, and study times.
- Students can send connection requests. Recipients can accept or reject incoming requests; request status is reflected in the connection panel.
- Matching remains unavailable to unverified profiles. The page does not reveal full names, NIM digests, or exact coordinates.

Database and privacy boundary:
- Existing find_nearby_students logic filters candidates to verified profiles with radar visibility enabled and excludes mutually blocked users. Its jittered marker coordinates are not returned by the new Matching RPC.
- find_matching_students requires auth.uid(), verified status, a radius of 1/3/5 km, and limits requests to 30 per user per 10 minutes using the private match_search_events table.
- get_my_connection_summaries returns connection rows involving only the signed-in user and exposes only the other party's initials/program.
- Authenticated can INSERT but not UPDATE public.connections. The INSERT RLS policy enforces verified sender/recipient, pending status, distinct users, and no block.
- The respond_connection_request SECURITY DEFINER RPC permits only the recipient of a pending request to accept/reject it; it re-checks verification and block status.
- The active course catalogue currently has zero courses. Topic, interest, and study-time preferences still work; course selection will become available after the catalogue is populated.
- Direct Messaging is integrated through src/services/chat.js and public.direct_messages; chat is available only after both users accept a connection and remain verified.

Live staging counts after migration: 0 matching preferences, 0 profile-course links, 0 connections, 0 direct messages, and 0 matching search events. Four profiles exist, with one verified and three pending; all four current location records have radar visibility enabled, but only verified profiles are eligible for matching.

The repository now defines 35 Playwright scenarios in total. Run #119 passed all 30 tests that existed at that point, including Matching, Direct Messaging, Notifications, and Home Map integration scenarios. The five Group workspace scenarios were added afterwards and still require confirmation on the current PR head. Home Map tests use mocked Edge Function responses; live multi-account location and privacy behavior remains an external acceptance check.

The Supabase security advisor previously flagged the Matching-related SECURITY DEFINER functions because authenticated users can execute them; their function bodies validate the authenticated caller and constrain results/actions to that caller. The Home Map location and search RPCs are separately restricted to service_role and are called only through JWT-verified Edge Functions. The private search-event tables have RLS enabled and no public table privileges. The advisor also reports leaked-password protection disabled; this is a separate Auth configuration item.


## Direct Messaging milestone — implementation added 2026-10-31

The accepted-connection Chat action now uses `src/services/chat.js` and the existing `public.direct_messages` table.

- Verified students can open a conversation only when the matching connection summary has status `accepted`. Pending, rejected, blocked, and unverified states do not expose the Chat action.
- The client loads the latest 60 messages, displays only the other student's initials/program, sends messages up to 5,000 characters, and marks incoming unread messages as read. Message content is escaped before insertion into the page.
- Supabase Realtime is already enabled for `public.direct_messages`; the client subscribes to INSERT/UPDATE events filtered by the active connection and removes the channel when the chat dialog closes. A manual refresh is available as fallback.

Database security update:
- Migration `20261031104922_secure_direct_message_read_receipts` is applied to staging and recorded in `supabase/migrations/REMOTE_MIGRATIONS.md`.
- SELECT/INSERT policies require the current user and other participant to remain verified, the connection to be accepted, and no mutual block.
- Authenticated has column-level UPDATE on `read_at` only. Table-wide UPDATE and UPDATE on `body` / `sender_id` remain unavailable.
- A temporary SQL transaction verified that an accepted recipient context can read a message and update its read receipt, while a pending connection exposes zero messages. The test transaction was rolled back.

The two new Playwright scenarios mock Supabase responses and Realtime. They are not counted as passing until a current GitHub Actions run confirms the full 24-test suite. Live staging currently has zero connection records and zero direct messages, and only one verified student profile; real two-account conversation and Realtime acceptance therefore remains outstanding.


## Notifications milestone — implementation added 2026-10-31

The dashboard notification bell now reads from `public.notifications` through `src/services/notifications.js`.

- The header displays the unread count and opens a recent-notifications panel. Users can mark one notification or all notifications as read.
- Notification selection routes the user to Matching/Connections, the relevant direct-message conversation, a forum thread, or group details/request management as appropriate.
- The client subscribes to Realtime changes filtered by the signed-in user's ID. The database RLS policy independently restricts reads to the owner.

Database update:
- Migration `20261031111603_secure_notifications_workflow` is applied and recorded in `supabase/migrations/REMOTE_MIGRATIONS.md`.
- Six private trigger functions create notifications for connection requests, connection decisions, direct messages, comments on the current user's post, group join requests sent to active admins/co-admins, and group join decisions.
- Authenticated users cannot insert/delete notification rows or modify their content/owner. They have column-level UPDATE on `read_at` only, and the RLS policy permits updating only their own unread notifications.
- `public.notifications` is added to `supabase_realtime`; change events are scoped by a per-user subscription filter and RLS.

Verification:
- Temporary database transactions verified that all six event types create notifications and that authenticated users see only their own rows. A read receipt update succeeded; direct insert and title update privileges were absent. All synthetic database changes were rolled back.
- Two mocked Playwright tests cover opening a direct-message notification and marking all notifications read. The current suite defines 26 tests; the two new scenarios are not counted as passing until a current CI run confirms them.
- Live staging has zero stored notification records, zero connection/message/forum/group test data, one verified student and three pending students. Real cross-account notification and Realtime behavior remains an acceptance test after a second verified test account is available.

## Home Map milestone — integrated 2026-10-31

The Home Map is now connected through src/services/home-map.js to two authenticated Edge Functions:

- manage-my-location: reads only the signed-in user's own exact location, validates explicit consent, saves GPS/manual coordinates, and updates radar visibility.
- nearby-students: requires a verified student profile, validates 1/3/5 km radius, HMACs an optional NIM in the Edge Function, enforces server-side rate limits, and returns no more than ten jittered markers with initials, program, and rounded distance.

Database functions for exact location and nearby search are executable only by service_role. The user_locations table has RLS enabled and a self-row policy. A student who hides their radar marker can still search for other students; their own profile is excluded from candidate results.

Supabase staging has applied migrations 20261031121632_home_map_location_workflow and 20261031121933_home_map_hidden_viewer_search. Edge Functions manage-my-location v1 and nearby-students v2 are ACTIVE with JWT verification enabled. Exact location responses and nearby results use Cache-Control: no-store.

The dashboard removed its static Bandung center, fabricated student profiles, dummy NIMs, and simulated markers. Students can refresh GPS, choose a map point with confirmation, set radar visibility, select 1/3/5 km, and search a nine-digit NIM. NIM is sent in the authenticated POST body and is not placed in the URL or browser storage.

Outstanding acceptance gates: use two verified synthetic staging accounts to confirm location consent, radar visibility, approximate marker privacy, server-side NIM lookup, and the hidden-viewer search behavior. The current staging project has only one verified profile, so multi-account map behavior has not yet been exercised against live data. Configure a strict CORS origin allowlist before public release. Netlify deployment is not inferred from CI success.


 
## Group workspace milestone — integrated 2026-10-31

The former group details modal is now a tabbed workspace for Chat grup, Materi, Agenda, and (for private groups) Undangan. Admins/co-admins have an Anggota tab for pending membership decisions.

Backend features: RLS-protected group messages with admin pinning; private Storage materials with 50 MiB limit and signed URLs; agenda schedule/target/task/note/poll items; private per-member poll voting with aggregate-only result RPCs; private-group invites by server-side NIM lookup; invitee inbox accept/decline; group invitation notifications; and RLS-filtered Realtime for messages, materials, agenda, invites and membership changes.

The seven Group workspace security/realtime migrations and `manage-group-invites` Edge Function are applied/deployed in staging. No test accounts or group content have been written to live staging. The PR currently defines 35 mocked Playwright scenarios; the CI result must be rechecked for the latest PR head before merge. See `docs/STAGING_STATE.md`, `docs/API_CONTRACT.md`, and `supabase/migrations/REMOTE_MIGRATIONS.md`.


## Reported user bug fixes — 2026-10-31

PR #4 (`fix/20261031-student-bug-report`) adds the following UI and backend integrations: UT S1 faculty/programme registration selectors with server-side validation; corrected administrator role presentation; forum author identity and reply lookups; a dedicated accepted-connection chat inbox; persisted profile editing and avatar upload; and notifications for group chat/material/agenda inserts. The staging migration and registration Edge Function v5 are applied/deployed.

CI run #186 for this PR has passed source checks and the production Vite build; its Playwright end-to-end step was still running at the time of this update. Do not treat this as a merge or production release until the full run passes and the PR is merged. Preview and live two-account acceptance remain separate checks.
