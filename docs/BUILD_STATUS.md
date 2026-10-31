# Build and verification status — Information UT / Student Verification / Forum Diskusi / Grup Belajar / Matching & Connections / Direct Messaging / Notifications

Date: 2026-10-31

## Latest CI result

Latest previously confirmed GitHub Actions run #50: **SUCCESS** (pre-Grup Belajar integration)  
Commit: `ec7eacf3b136b29f4887843654cb4c41268ed7bd`  
Workflow: `Verify UT Connect build`

- Dependency install with committed `package-lock.json` — PASS.
- `npm run check` — PASS.
- `npm run build` — PASS; Vite generated the production site in `dist/`.
- Playwright Chromium installation — PASS.
- Browser E2E — **13 passed** on that commit.
- Forum create/comment flows and verified-only access checks included.
- The current repository now defines 26 Playwright tests: four Grup Belajar, five Matching/Connections, two Direct Messaging, and two Notifications scenarios were added after run #50. The 13 added tests have not yet been confirmed by a successful CI run.

Workflow run: https://github.com/ridhobilalhakim-cy/UTConnect/actions/runs/41191070350

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

The CI browser tests use mocked Supabase HTTP responses and synthetic test data. They prove source integrity, build completion, and client UI behavior under the mocked responses. They do **not** prove live Google OAuth, real email delivery, the deployed Edge Function, end-to-end browser CRUD against the production Supabase API, or successful Netlify deployment.

This environment could not independently resolve the public Netlify domain. The Netlify production deployment therefore remains an external acceptance check; do not assume a passing GitHub Actions run proves that the latest commit is already live.

## Remaining acceptance gates

1. Confirm Netlify has deployed the latest successful commit.
2. Test Google sign-in and profile completion using each team's actual account.
3. Test Information UT create/edit/publish/unpublish/delete from a real admin browser session and confirm student read visibility.
4. Define and publish the evidence acceptance and retention policy before opening Student Verification to the public.
5. Run and review CI for the new Grup Belajar, Matching/Connections, Direct Messaging, and Notifications integrations, then perform real-account group, preference, connection-request, two-party chat, and notification-trigger acceptance tests. Home-map access remains a future integration milestone.

## Source-control caveats

- The remote staging project has ten recorded migrations. The first five original SQL bodies and the student_verification_workflow SQL body still need reconstruction/review in repository source. Do not re-run them blindly against the live staging database.
- The registration Edge Function mirror in GitHub does not automatically deploy source edits to Supabase.
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


## Grup Belajar milestone — implementation added 2026-10-31

The Groups page now reads and writes through `src/services/groups.js` and the existing `public.study_groups` / `public.group_members` schema.

- Verified students can discover non-archived groups and create a group. The database trigger assigns the creator as the first active admin.
- Group creation supports a general group (no course), optional active course, online/offline mode, open/approval access, capacity (2–100), optional schedule, and optional meeting URL/area label.
- Open groups accept eligible users immediately. Approval groups create a pending membership request; active group admins/co-admins can approve or reject requests.
- The group UI shows generic member/request labels rather than other profile names because profile RLS does not expose another student's identity to the current user.
- The current active course catalogue is empty, so the UI deliberately permits general groups rather than presenting invented courses.
- Private groups can be discovered by invitees through existing RLS, but the UI for sending/managing private invitations is not included. Group chat, agenda, and material upload are also not included.

Database security update:
- Migration `20261031101336_secure_enable_group_join_workflow_rpcs` is applied to staging.
- `join_study_group` and `respond_group_join_request` now reject a caller whose `p_actor_id` differs from `auth.uid()`.
- EXECUTE is granted to `authenticated` (and service_role), revoked from `PUBLIC` and `anon`; the existing database capacity, verification, and active-admin checks remain authoritative.
- Supabase's security advisor reports a SECURITY DEFINER warning for these two RPCs because authenticated users are intentionally permitted to call these narrowly scoped functions. The functions validate the caller and do not allow direct group_members table writes.

Latest live staging counts after the migration and code changes: 0 study_groups, 0 group_members, 0 group_invites, and 0 active courses. No group test data has been inserted into Supabase. There is one verified profile and three pending profiles; verified-only group UI and database policies therefore currently restrict access to the single verified profile.

The four new group Playwright tests use mocked Supabase responses. They cover the verification gate, group creation, approval-based join request, and admin approval. They have not been counted as passing until an Actions run for the latest code confirms them. Real-user group creation and join workflows remain an acceptance test.


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
- Direct messages remain demo/simulated and are not unlocked by accepting a connection in this milestone.

Live staging counts after migration: 0 matching preferences, 0 profile-course links, 0 connections, 0 direct messages, and 0 matching search events. Four profiles exist, with one verified and three pending; all four current location records have radar visibility enabled, but only verified profiles are eligible for matching.

The repository now defines 24 Playwright scenarios in total. Five new mocked tests cover the matching gate, preference save, privacy-limited search and connection request, incoming acceptance, and incoming rejection. Two further mocked tests cover opening an accepted chat, message history, read receipts, message sending, and pending-connection gating. Run #50 is the latest previously verified passing CI result and predates these latest changes; the 11 new group/matching/chat tests are not counted as passed until a current Actions result confirms them. Real-account flows and the latest Netlify deployment are still external acceptance checks.

The Supabase security advisor intentionally flags the three new SECURITY DEFINER functions because authenticated users can execute them. Their function bodies validate the authenticated caller and constrain results/actions to that caller. The private search-event table has RLS enabled and no public table privileges. The advisor also reports leaked-password protection disabled; this is a separate Auth configuration item.


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
