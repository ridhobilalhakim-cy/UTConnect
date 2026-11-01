# UTConnect Demo Mode — deployment and test guide

## Current implementation status

The Demo Mode source is maintained on branch `feat/utconnect-demo-mode`. It is **not enabled on the currently deployed UTConnect site** and has not been deployed or executed against a database.

A dedicated Supabase project is a hard requirement. The current Cloudflare Pages project `utconnect` has both Preview and Production environment variables pointed at the shared project `hqyusbyndtlfypdbmatw`, which is also used by the previous Netlify deployment. The other existing Supabase project `lguqtplssimkwwyzmwzz` is not a demo database and must not be repurposed.

The Supabase organization currently has a Free plan and has reached its two-active-project limit. A separate project could not be provisioned, and Supabase database branching was unavailable on that plan. Do not work around this by pausing, deleting, or reconfiguring either existing project.

## Isolation topology

Create a **new, dedicated Supabase project** for the demo. Do not restore production backups or copy real student data into it. Apply the reviewed UTConnect baseline schema and its required Storage policies first, then apply:

`supabase/migrations/20261101110000_utconnect_demo_mode_isolation.sql`

The baseline schema must be reconstructed before using this migration. The current repository's `supabase/migrations/REMOTE_MIGRATIONS.md` explicitly records missing early migration bodies and migration-history drift. Do not replay the remote migration list blindly or assume this Demo Mode migration can bootstrap an empty project by itself.

Deploy the new Edge Function `demo-mode` with JWT verification **enabled**. Configure the following server-side settings on the demo project only:

- `DEMO_ALLOWED_ORIGIN`: exact stable origin of the separate demo website, e.g. `https://utconnect-demo.pages.dev`
- `SUPABASE_SECRET_KEYS` or `SUPABASE_SERVICE_ROLE_KEY`: server-side secret for Auth Admin and database seeding. Never expose this in Vite variables or browser code.
- The publishable/anonymous key required by the function runtime as `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`.

Enable Supabase anonymous sign-in on the **demo project only**. The bootstrap function checks `auth.users.is_anonymous`, assigns a trusted role through server-side `app_metadata`, and creates a demo session. A browser-supplied `user_metadata` flag is never used for authorization.

Create a new Cloudflare Pages project, such as `utconnect-demo`, connected to the demo branch/repository. Use the same build command as UTConnect. Set only on that new Pages project:

- `VITE_SUPABASE_URL`: URL of the dedicated demo Supabase project
- `VITE_SUPABASE_PUBLISHABLE_KEY`: its publishable key
- `VITE_UTCONNECT_DEMO_MODE=true`
- `VITE_UTCONNECT_DEMO_PROJECT_REF`: exact project reference from that URL

Do not add the Demo Mode flag or demo database URL to the existing `utconnect` Pages project. Do not change Netlify, DNS, Site URL, or the shared Supabase project.

## Demo accounts and seed behavior

The seeder is implemented as the server-side `demo-mode` Edge Function action `bootstrap`, not as a browser-side SQL seed. It creates six fictional identities with reserved `.invalid` email addresses and random, undisclosed passwords:

| Key | Display name | Study programme |
|---|---|---|
| A | Demo A | Sistem Informasi |
| B | Demo B | Manajemen |
| C | Demo C | Akuntansi |
| D | Demo D | Ilmu Komunikasi |
| E | Demo E | Pendidikan Bahasa Inggris |
| F | Demo F | Sains Data |

Every bot profile keeps `verification_status = pending`; it is not represented as an officially verified UT student. Its `is_demo` and `demo_session_id` markers are written by server-side triggers from trusted Auth `app_metadata`. NIM digests are random synthetic sentinels, not actual nine-digit NIMs. Demo UI disables NIM lookup and GPS selection; bots use synthetic points around the public UT Pondok Cabe campus area only.

A visitor session seeds an accepted private-chat connection, an incoming connection request, and five groups:

- Open group with multiple places.
- Nearly full group (3 of 4 active places).
- Full group (3 of 3 active places).
- Approval-required group.
- Private group with an invitation addressed to the current visitor.

The open group also has synthetic chat messages, schedule/task agenda entries, an actual poll with pre-seeded votes, and a synthetic PDF stored in the private group-materials bucket. Matching preferences and synthetic map locations are prepared for the visitor and bots.

## Interaction behavior

The visitor's connection request to a bot triggers a server-validated acceptance and a clearly labeled `[SIMULASI DEMO]` reply. An accepted bot chat replies to visitor messages. Group creation/join/message/poll actions similarly trigger session-scoped bot responses. Approval-required group join requests are approved by the bot administrator through a server-only helper that checks group membership and capacity.

The UI labels bot profiles, candidates, map pins, connections, group messages, materials, agenda and notifications with DEMO indicators. Polling continues to use the existing Agenda poll workflow.

Group membership still uses the normal `join_study_group` RPC and its row lock/capacity validation. The demo layer does not bypass the "Group is full" response.

## Reset and expiry

The reset button invokes the server-side `reset` action. It validates the visitor's trusted demo role and active session, removes only records whose server-owned `demo_session_id` belongs to that visitor, removes demo-only Storage objects and bot Auth users, then re-seeds the current visitor session. The visitor session is retained. Demo sessions expire after eight hours.

Do not create a public SQL endpoint or expose database secrets. The Edge Function validates JWT identity, app metadata, profile marker, session state and exact allowed Origin before acting.

## Acceptance tests required before a live demo

1. Verify bootstrap creates one visitor and exactly six bot profiles in the demo database, all visibly marked DEMO with pending student verification.
2. Verify Matching shows all six bots with program, topics, interests and study times; ordinary verified candidates are isolated to their own database/session.
3. Verify synthetic map markers appear and no browser GPS or real NIM search is used in Demo Mode.
4. Send a connection request to a bot and verify the connection becomes accepted with a labeled bot reply.
5. Send a chat message and verify a labeled bot response; use a second visitor session and confirm it cannot see the first session's bots or conversations.
6. Test open, approval and private groups. Confirm approval and invitation acceptance through existing RPCs.
7. Attempt to join the full group and verify the database RPC rejects it.
8. Verify group chat, materials, agenda and poll votes appear in the workspace.
9. Verify reset clears only the current demo session and does not remove any visitor or data in a second demo session.
10. Verify a normal production-style account on a separate test environment can still register, verify, use real NIM lookup, match, connect, chat and manage groups under the original workflows.
11. Inspect RLS, function grants, Storage policies, Auth users and table counts after the exercise. Run Supabase Security and Performance Advisors.
12. Run the complete GitHub CI build and Playwright E2E suite. A passing mock E2E run is not proof of live Auth, Storage, RLS or Realtime behavior.

## Current limitations

- The isolated Supabase project is not yet provisioned due the current organization's Free-plan project limit.
- A fresh baseline migration set is not yet fully reconstructable from repository source; the remote history note records missing migration bodies. This must be resolved before applying the Demo Mode migration to a new project.
- The Demo Mode Edge Function, migration, seed workflow and browser changes are committed as source, but have not yet been deployed or exercised against a dedicated database.
- The demo-only Cloudflare Pages project and environment variables have not been created.
- No claim is made that live bot replies, multi-session isolation, real Storage uploads, private invitations or reset are already acceptance-tested.

**Never enable `VITE_UTCONNECT_DEMO_MODE=true` until the new Supabase project, baseline schema, Demo Mode migration, Edge Function, secrets, Auth anonymous sign-in and separate Pages project are all ready.** The client guard deliberately fails closed if the configured project reference is absent, mismatched, or matches either existing UTConnect project.
