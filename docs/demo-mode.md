# UTConnect Demo Mode

## Current status

Demo Mode is implemented on the isolated feature branch `feat/utconnect-demo-mode` and reviewed through draft PR #5. It is **not a live deployment**.

Do not merge, deploy, or apply the demo migration to either existing UTConnect Supabase project. The branch is only a source-code implementation until a separate Supabase project and a separate hosting project are provisioned.

The first five baseline migration bodies are missing from this repository and do not appear in the Git history of the current, base, or main branches. Do not reconstruct them by guessing from their names. For a separate Demo project, use the reviewed squashed-baseline procedure in [demo-mode-baseline-recovery.md](./demo-mode-baseline-recovery.md). That procedure snapshots the current staging schema for the demo-only migration chain; it does not recreate the original historical migration sequence, and it has **not yet been executed**.

## Isolation model

- Each visitor uses Supabase Anonymous Sign-In. The server writes the trusted `utconnect_demo_role` and `utconnect_demo_session` values to `auth.users.raw_app_meta_data`.
- Demo eligibility is not taken from editable `user_metadata`, profile text, or a browser-supplied `is_demo` value.
- Each profile and activity row receives server-owned `is_demo` and `demo_session_id` markers. Restrictive RLS policies and explicit checks inside SECURITY DEFINER RPCs prevent cross-session access.
- Demo bot profiles remain `verification_status = pending`. A database trigger also forces demo profile status to `pending`; demo access is not represented as real UT student verification.
- Bot replies and seeded content are marked `[SIMULASI DEMO]` and carry a visible DEMO label.
- Map positions are synthetic points near the UT Pondok Cabe campus area. They are not visitor or student home locations.
- The demo visitor session lasts eight hours. Expired sessions lose access, but expired session rows and Auth bot users are **not automatically purged** yet. Use the in-app Reset control while the session is active, or arrange a reviewed cleanup procedure before public use.

## Provisioning requirements

1. Provision a **new, dedicated Supabase project** for Demo Mode. Do not reuse the Netlify/shared staging project, the current Cloudflare Pages Preview project, or the current Cloudflare Pages Production project.
2. Create and verify a demo-only squashed baseline by following [demo-mode-baseline-recovery.md](./demo-mode-baseline-recovery.md). The baseline and `20261101110000_utconnect_demo_mode_isolation.sql` must be the only migrations in that demo workspace's active migration directory. Do not replay the old incremental migrations on top of the current-state baseline.
3. Enable Anonymous Sign-Ins in the dedicated project's Supabase Auth settings. The normal login/register flows can remain available, but the Demo Mode button itself uses Anonymous Sign-In.
4. Deploy `supabase/functions/demo-mode/index.ts` and the updated `supabase/functions/nearby-students/index.ts` to the dedicated project with JWT verification enabled. Set `UTCONNECT_DEMO_MODE=true` for the dedicated project's Edge Function environment so Nearby can read the demo marker; leave it unset on normal UTConnect projects. Set the exact browser origin in the Edge Function secret `DEMO_ALLOWED_ORIGIN` (scheme + host, no path). The function uses the project's server-side Auth/API variables and a server-only service-role/secret key. Never put a service-role or `sb_secret_` key in a Vite/browser variable.
5. Create a separate hosting project for the demo build. Set these build variables there:
   - `VITE_SUPABASE_URL`: the dedicated demo project's URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: that project's publishable key.
   - `VITE_UTCONNECT_DEMO_MODE`: `true`.
   - `VITE_UTCONNECT_DEMO_PROJECT_REF`: the exact project reference in `VITE_SUPABASE_URL`.
6. Ensure `DEMO_ALLOWED_ORIGIN` exactly matches that separate hosting project's origin. The client fails closed when the demo flag is missing, the project reference does not match, or either known existing UTConnect project reference is selected.
7. Run the regular CI checks, then perform live multi-session tests against the new project: two visitors must not read or mutate each other's data; real non-demo accounts must not see demo rows; all bot and visitor verification statuses must remain pending; group capacities, approval, private invites, file access, messages, polling, notifications, Realtime, reset, and expiry must work as intended.

## Demo content

A seeded visitor receives six fictional bot profiles, synthetic map points, matching preferences, an accepted chat connection, an incoming connection request, one Forum discussion with a simulated reply, five groups (open, nearly full, full, approval, and private/invited), group messages, Agenda items, a poll, and a sample PDF material.

The login-page selector currently controls the focus label displayed in the demo banner; the seed remains comprehensive so the other features are still available during one continuous presentation.

## Validation limits

The GitHub workflow runs source checks, Deno type-checking, a production Vite build, and Playwright browser tests. The current E2E test checks that the demo entry remains hidden in a normal build. These checks do not prove live Supabase RLS, Auth, Storage, Realtime, multi-session isolation, or bot behavior. Those require a separate project and live testing.

No migration or Edge Function from this branch should be deployed to a shared or production environment.
