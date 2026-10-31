# Build and verification status — Information UT / Student Verification / Forum Diskusi / Grup Belajar

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
- The current repository now defines 17 Playwright tests; four new Grup Belajar scenarios were added after run #50 and their CI outcome is not yet confirmed.

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
5. Run and review CI for the new Grup Belajar integration, then perform real-account group creation/join/admin-approval acceptance tests. Matching/Connections, Chat, notifications, and map access remain future integration milestones.

## Source-control caveats

- The remote staging project has nine recorded migrations. The first five original SQL bodies and the student_verification_workflow SQL body still need reconstruction/review in repository source. Do not re-run them blindly against the live staging database.
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
