# UT Connect — Main Codebase

This is the official consolidated source tree for the current UT Connect staging application. It combines the approved Clean Academic Premium UI, separate login/registration entry page, protected dashboard page, one shared Supabase client/session configuration, and the current registration Edge Function source mirror (deployed version 5).

## What this codebase is

- One Vite multi-page web application, not unrelated HTML files.
- `index.html` is the login/registration entry route.
- `app.html` is the protected main dashboard.
- Both pages use `src/lib/supabase.js`, the same Supabase project and the same browser auth storage key.
- The host builds the source into static files. End users and teammates who only use the website do not install Python, Node, or developer tools.

## Current integration truth

- `src/auth/main.js`: email/password, Google OAuth entry, password reset, registration profile form, map pin selection, and session restore.
- `src/app/main.js`: protected route, session and profile check, profile header hydration, logout.
- `src/app/dashboard.js` and `src/app/group-workspace.js`: Home Map, Information UT, Student Verification, Forum Diskusi, Grup Belajar (chat, materials, agenda/polls, admin member review and private invites), Matching/Connections, Direct Messaging, and Notifications use Supabase-backed services. Remaining simulated V2.2 interactions are tracked separately in the build status.
- `src/lib/supabase.js`: the single browser client and storage key shared by both pages. Only the Supabase publishable key belongs here.
- `supabase/functions/complete-student-registration/index.ts`: source mirror of deployed function v4.\n- `supabase/functions/manage-my-location/index.ts` and `nearby-students/index.ts`: owner-scoped location and privacy-preserving nearby-search Edge Functions; staging versions are active with JWT verification.\n- `supabase/functions/manage-group-invites/index.ts`: authenticated private-group invitation Edge Function; staging v1 is active with JWT verification.

## Developer environment (not required by website visitors)

- Node.js 22.12+ and npm are needed only when developing/building source code.
- `package-lock.json` is committed to the repository. CI validates dependency installation with `npm ci`; keep the lockfile committed whenever dependencies change.
- `npm run dev` starts the local Vite development server.
- `npm run build` creates static output in `dist/`.
- `npm run preview` previews the built site.
- `npm run check` checks page structure, local import resolution, declared package dependencies, the shared Supabase client, auth-recovery wiring, and JavaScript/test syntax.
- `npm run test:e2e` runs the mocked Playwright browser tests after a successful build.

## Deployment without installing tools on each teammate's computer

Recommended: push this repository to GitHub, then connect the repository to Netlify. Netlify runs the build command remotely (`npm ci && npm run build`) and publishes `dist/`, using the committed lockfile. Team members and judges only open the final HTTPS URL. They do not install Node, Python, or anything else.

Do **not** drag this source folder into Netlify Drop as though it were a prebuilt website. If using manual drag-and-drop, upload only the generated `dist/` folder after a successful build.

After deployment, set Supabase Auth Site URL and Redirect URLs to the actual HTTPS domain. Add the actual domain in Google Cloud OAuth Authorized JavaScript origins. The Google OAuth Authorized redirect URI remains the Supabase callback URL shown in the Supabase Google provider settings.

## Auth assumptions and security

- The client uses the project's publishable key only. Never place service-role or secret keys in `src/`, `.env`, or the static bundle.
- Supabase Auth session uses a stable shared storage key and browser `localStorage`; signing in is per browser/device.
- Email signup only returns an immediate session when Supabase Auth Email Confirmations are disabled. That is acceptable only for controlled staging; it does not prove the email belongs to the person.
- Google OAuth must be explicitly configured in Google Cloud and Supabase Auth Provider. It cannot work before provider setup.
- Student verification is separate. Newly registered profiles remain `pending`; email/Google identity does not verify UT student status.
- The current 9-digit NIM check is inherited from the prototype and must be verified with official UT requirements before public release.
- Exact location is stored server-side and returned only to its owner through the authenticated location Edge Function. Other students receive jittered map pins, initials, program, and rounded distance only. Radar visibility is explicit and separate from the ability to search nearby peers. Real two-account location acceptance is still required before public rollout.

## Current implementation status

1. Login/register and the protected dashboard use one shared Supabase client and persistent browser session.
2. The administrator role is stored in the non-exposed `private.app_user_roles` table. Three team accounts have been assigned the `admin` role; role lookup is performed server-side and normal users cannot edit role assignments.
3. **Information UT is connected to Supabase.** The feed is loaded from `public.information_posts`; the three administrator accounts can create, edit, publish, unpublish, and delete posts. Students can read published posts according to the database audience rules. Drafts are visible to admins only.
4. The Information UT page has database-backed categories, audience selection, source links, and draft/published states. One published Information UT row was present during live staging inspection on 2026-11-01. No sample post was seeded by implementation; live counts may change through administrator activity.
5. **Student Verification is connected to the existing Supabase workflow.** Students can upload one PDF/JPG/PNG file (maximum 5 MB) to a private Storage bucket, view their own review status, and resubmit after rejection. Only administrators can read the review queue and private evidence, then approve or reject with a reason. Database review functions update profiles.verification_status and record review events.
6. Evidence guidance in the UI names current-semester registration/KRS documents as examples; administrators must manually inspect the evidence. Google/email login and self-entered profile details are not proof of UT student status. UT Connect has not integrated with an official UT verification API, and an evidence acceptance/retention policy still needs to be agreed before open public launch.
7. **Forum Diskusi is connected to Supabase.** Verified students can read recent posts, create a discussion, open comment threads, add comments, and delete their own posts/comments. Database RLS restricts reading and writing to verified students and limits deletion to the content owner. Students who are not verified see a verification gate. Other students' profile names are intentionally masked because profile RLS does not expose other users' identity fields. The active course catalogue is currently empty, so new discussions can be posted as general discussions.
8. **Grup Belajar has a live collaborative workspace.** Verified students can create and join groups, request/approve membership, use group chat with Realtime, pin messages as admin/co-admin, upload/download private materials, create schedules/targets/tasks/notes and polls, and cast one poll vote per member. Admins can invite verified students to private groups by NIM; invitees receive an in-app notification and can accept/decline from their inbox. Group membership, agenda, materials, messages and invitations are protected by RLS/actor-checked RPCs; Storage remains private.
9. **Matching & Connections is connected to Supabase.** Verified students can save their own topic, interest, study-time, and active-course preferences; search up to ten nearby verified students within 1/3/5 km; send connection requests; and accept/reject incoming requests. Matching only returns initials, program, rounded distance, and learning tags—not full names, NIMs, or coordinates. The server filters by radar consent, verification, and mutual block status and rate-limits matching searches.
10. **Direct Messaging is connected to Supabase.** Verified students can open a private conversation only after a connection is accepted, load recent messages, send messages (up to 5,000 characters), and mark incoming messages as read. Realtime listens only to the active connection's message rows; manual refresh is available as a fallback. Database policies require both participants to remain verified, the connection to remain accepted, and no mutual block. Authenticated users can update only `read_at`, not message contents or sender identity.
11. **Notifications are connected to Supabase.** The header bell shows an unread count and a recent-notification panel. Database triggers create notifications for connection requests/decisions, direct messages, comments on the user's own forum posts, group join requests/decisions, private-group invitations, group messages/materials/agenda items, student-verification decisions, and first publication of Information UT posts. Students can mark one or all as read; Realtime is filtered to the signed-in user's notification rows. RLS restricts each user to their own notifications; browser clients cannot create notifications or modify notification content/ownership.
13. Twenty-eight remote migrations are recorded for staging, including Home Map, Group workspace security/realtime workflows, verified-membership access, and private material deletion guards. The first five SQL bodies and the remote student_verification_workflow SQL body still need to be reconstructed and reviewed in source control; later feature migration sources are retained in supabase/migrations/. See docs/STAGING_STATE.md and supabase/migrations/REMOTE_MIGRATIONS.md.
14. The local execution environment cannot resolve external DNS, but the GitHub-hosted CI runner successfully installed dependencies from the committed lockfile and built the production site.

## Verification and next acceptance gate

Latest confirmed PR-head GitHub Actions run is **#230** on commit `9b6e02fca72bdcc232d94771847fcaa80aae8776`: source checks, Vite production build, and all 43 Playwright tests passed. Workflow: https://github.com/ridhobilalhakim-cy/UTConnect/actions/runs/41226183647. Browser tests mock Supabase/Storage and do not replace two-account live acceptance.

The live Supabase database was separately checked with authenticated SQL role contexts: an assigned administrator resolves as admin and can insert an Information UT post; a non-admin student profile resolves as non-admin and its insert is rejected by RLS. The test insert was rolled back. A separate staging inspection on 2026-11-01 found one published Information UT row already present.

The next acceptance gate is real-account acceptance for Home Map and Group workspace using two verified synthetic staging accounts, two-party connections/chat/notifications, and final Netlify deployment verification. Playwright tests mock Supabase/Storage; they do not prove live OAuth/email, cross-account Realtime, real Storage access, or the deployed Netlify URL. Staging currently has only one verified profile, so a second verified synthetic account is required before live cross-account acceptance. The Edge Functions currently allow wildcard CORS; configure explicit app-origin allowlists before public release.

Student verification remains separate from administrator access. At the latest database check, four profiles existed: one was verified and three were pending. The private verification tables contain one approved request and one corresponding approved review event. Forum Diskusi currently has zero posts/comments. One pre-existing published Information UT row was observed; no test content was left behind by the implementation or rollback-only tests. Administrators should compare uploaded evidence with the student's profile details and confirm current UT student status before approving.

## Browser E2E tests

The project includes Playwright tests for authentication, Information UT, Student Verification, Forum Diskusi, Grup Belajar, Matching/Connections, Direct Messaging, Notifications, and Home Map client flows. They use mocked Supabase HTTP responses, mocked Storage, and synthetic test records; they do not create accounts or read/write the live Supabase project.

```bash
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

The repository now defines 43 Playwright scenarios covering login/register, session/recovery, Information UT, Student Verification, Forum Diskusi, Grup Belajar, Matching/Connections, Direct Messaging, Notifications, and Home Map. PR-head run #230 passed all 43 scenarios, including group chat/pinning, private materials, agenda polls, private invitations, profile/avatar workflows, administrator role display, and routing of chat, Information UT and verification notifications. Google OAuth, real email delivery, live cross-account Edge Function behavior, production deployment and live two-account Storage/Realtime are separate acceptance checks; they are not inferred from mocked tests.


## Notifications state (checked 2026-10-31)

- The remote migration `20261031111603_secure_notifications_workflow` is applied; its SQL source is retained in `supabase/migrations/`.
- Six private trigger functions generate notifications for new connection requests, connection accept/reject decisions, direct messages, comments on the user's own forum post, group join requests to active admins/co-admins, and group join decisions.
- The dashboard bell displays an unread count and recent notifications. Users can mark one notification or all notifications as read. Notification actions route to Matching, a direct chat, a forum thread, or group details/request management.
- `public.notifications` is included in `supabase_realtime`; the browser subscription filters by the signed-in user's ID. RLS allows SELECT only for the row owner.
- Authenticated users cannot directly insert/delete notification rows or edit their title/body/user_id. They have column-level UPDATE only for `read_at`, with a policy that permits updating only their own unread notifications.
- A rolled-back SQL transaction verified all six event trigger types and owner-scoped read/update behavior. No test records were retained. The staging notifications table currently contains zero rows; two mocked Playwright scenarios were added but their CI outcome is unconfirmed. Cross-account and live Realtime acceptance still requires real verified test accounts.

## Direct Messaging state (checked 2026-10-31)

- The remote migration `20261031104922_secure_direct_message_read_receipts` is applied. It hardens the existing `public.direct_messages` policies so both participants must remain verified, the connection must be accepted, and neither participant may block the other.
- Authenticated students retain SELECT and INSERT. They receive column-level UPDATE only on `read_at`; they do not receive UPDATE on the table, `body`, or `sender_id`.
- `public.direct_messages` is already part of the `supabase_realtime` publication. The browser subscribes to INSERT/UPDATE events filtered to the active connection, removes the channel when the dialog closes, and offers manual refresh if Realtime disconnects.
- The Chat action appears only for accepted connections. The client loads the most recent 60 messages, escapes message text, sends messages up to 5,000 characters, and marks incoming unread messages as read.
- Latest staging count remains 0 connections and 0 direct messages. There is only one verified profile, so live two-account chat and Realtime acceptance has not yet been performed. Two new mocked Playwright scenarios have been added; their CI result remains unconfirmed.

## Matching & Connections state (checked 2026-10-31)

- The guarded find_matching_students RPC uses the existing nearby-student search logic and returns at most ten verified students within 1/3/5 km who opted in to radar visibility and are not blocked with the viewer.
- The client receives only student ID for connection addressing, initials, program, rounded approximate distance, active course labels, topic tags, interests, and study times. It does not receive full names, NIM digests, latitude, or longitude.
- Searches are limited to 30 per authenticated student per 10 minutes. Private request events are stored in private.match_search_events, which has RLS enabled and no authenticated/anon table privileges.
- Matching preferences (topic_tags, interests, study_times) and course links are read/written through existing RLS policies scoped to the signed-in owner.
- Authenticated users have INSERT but not UPDATE privilege on public.connections. The existing insert RLS policy checks verified sender, verified recipient, pending status, distinct users, and mutual-block rules.
- Incoming request summaries expose only initials and program. The respond_connection_request RPC checks that the current user is the recipient, both parties remain verified, the request is pending, and neither party blocks the other before accepting/rejecting.
- Accepted connections now expose the integrated Direct Messaging action; chat history and messages use the existing RLS-protected direct_messages table.

Latest live counts after the migration: 0 matching preferences, 0 profile-course links, 0 connection records, 0 direct messages, and 0 matching search events. Four profiles and four radar-opt-in location records exist; one profile is verified and three are pending. The active course catalogue remains empty, so students can save topic, interest, and study-time preferences while course-selection options remain unavailable. No live user preferences or connection records were created during implementation.

Supabase security advisors report intentional SECURITY DEFINER execution warnings for the three narrowly scoped matching/connection RPCs, because verified signed-in students need to call them. Each function uses auth.uid() and/or the signed-in caller's own connection records, and the matching RPC returns no precise location or full name. Supabase also reports the existing leaked-password protection setting as disabled; enabling it remains an Auth configuration task. The private match-search table also appears as an informational RLS-enabled/no-policy finding because all access is intentionally restricted to the owning database function.


## UT programme compatibility update (2026-11-01)

The registration and profile editors provide linked dropdowns for the 36 S1 programmes across FEB, FHISIP, FKIP and FST. Legacy programme labels are normalized in the browser and by the database profile-edit RPC. The applied staging migration is `20261031173449_normalize_legacy_ut_programme_aliases`; it preserves verification when a legacy label is only being normalized to its canonical equivalent. The course catalogue remains a separate `public.courses` dataset and is currently empty, so forum discussions can be posted as general discussions until an official course catalogue is loaded.


Notification coverage now includes student-verification approval/rejection and newly published Information UT posts. The dashboard routes these notifications to the matching page. The database trigger for Information UT only sends on first publication, avoiding duplicate notifications when an existing published post is edited. See `supabase/migrations/20261031174525_notifications_for_information_and_verification.sql`.


## Release validation update (2026-11-01)

- PR #4 remains open and unmerged. Latest head: `9b6e02fca72bdcc232d94771847fcaa80aae8776`.
- GitHub Actions run #230 passed source checks, production build and all 43 Playwright tests.
- Netlify Deploy Preview for that exact commit is ready at `https://deploy-preview-4--cheery-puffpuff-ca0a08.netlify.app`.
- Netlify production deployment remains paused due to the operational-credit notice; the existing published site remains live. No production deploy was performed.
- Migration `20261031174525_notifications_for_information_and_verification` adds notifications for verification decisions and first publication of Information UT posts.
- Mocked Playwright tests are not proof of real OAuth/email delivery, two-account Realtime or cross-account Storage permissions. Those checks remain required before production.


## Staging handoff

Cloudflare Pages staging preparation is documented in [docs/CLOUDFLARE_PAGES_STAGING.md](docs/CLOUDFLARE_PAGES_STAGING.md). The repository includes `wrangler.toml`, Cloudflare Pages headers, and a rollback-only two-account Supabase acceptance script at [supabase/tests/two_account_acceptance.rollback.sql](supabase/tests/two_account_acceptance.rollback.sql).

The database-level two-account acceptance flow passed in a transaction that was rolled back. This does not prove real browser Auth sessions, WebSocket Realtime, OAuth/email, or private Storage access. Cloudflare project creation and GitHub authorization have not been completed; the existing Netlify production deployment remains unchanged.
