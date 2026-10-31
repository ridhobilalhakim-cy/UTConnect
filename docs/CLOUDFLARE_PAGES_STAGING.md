# Cloudflare Pages — UTConnect Staging

Last reviewed: 2026-11-01

UTConnect is a static multi-page Vite site. Vite builds both `index.html` (authentication) and `app.html` (dashboard) into `dist/`.

## Create a separate staging Pages project

Create a **new Cloudflare Pages project** named `utconnect-staging` and connect the GitHub repository:

- Repository: `ridhobilalhakim-cy/UTConnect`
- Pages project name: `utconnect-staging`
- Production branch for this separate staging Pages project: `fix/20261031-student-bug-report`
- Root directory: repository root (`/`)
- Build command: `npm ci && npm run check && npm run build`
- Build output directory: `dist`
- Build environment variable: `NODE_VERSION=22.16.0`

The feature branch is intentionally the production branch **of this separate staging Pages project only**. It is not the public website's production branch. This lets the staging Pages project publish the tested fix branch at a stable `pages.dev` hostname without changing the current Netlify production deployment. Other branches can be configured as preview branches in Pages Branch control.

The repository now contains `wrangler.toml` with the Pages output directory and compatibility date. This is a static Pages app; no Cloudflare Worker/Pages Function backend has been added.

## Build environment variables

In Pages → Settings → Environment variables, configure both the Production and Preview environments of this staging-only Pages project:

| Variable | Value |
|---|---|
| `NODE_VERSION` | `22.16.0` |
| `VITE_SUPABASE_URL` | `https://hqyusbyndtlfypdbmatw.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Copy the existing `VITE_SUPABASE_PUBLISHABLE_KEY` value from `.env.example` |

Both Pages environments for this project should point only to the existing **staging Supabase project**. Do not point this Pages project at a production database.

The Supabase publishable key is designed for browser use. Never use `service_role`, `sb_secret_`, database passwords, NIM HMAC secrets, OAuth client secrets, or other server secrets. Values with the `VITE_` prefix are embedded in the browser build and must be treated as public.

## Supabase Auth redirect configuration

After Pages creates the stable staging hostname, update the staging Supabase project under Authentication → URL Configuration:

- Site URL: the exact stable staging URL, for example `https://utconnect-staging.pages.dev`.
- Additional Redirect URLs: the exact stable URL with `/**`.
- If preview deployments will be used, add a narrowly scoped pattern for this project only, for example `https://*.utconnect-staging.pages.dev/**`, after confirming the exact hostname pattern Cloudflare generates.

Do not add broad wildcards for unrelated domains. Do not change the existing production project's Site URL as part of staging setup.

If Google OAuth is enabled, register the exact application callback URI with Google. The Supabase application redirect destination and the OAuth provider's callback URI are separate settings.

## Security headers

`public/_headers` carries the security headers already configured in `netlify.toml`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=()`

A Content Security Policy has not been added because the app uses Supabase, map tiles, Google OAuth and external font/icon assets. Build a complete resource allowlist and test a policy in report-only mode before enforcing it.

## Acceptance checklist after Cloudflare access is connected

1. Confirm the Pages deployment reports the intended commit SHA.
2. Open both `/` and `/app.html`; check the browser console/network panel for missing assets, auth redirects and CORS errors.
3. Test email/password login, logout, session restore and password recovery using dedicated synthetic staging accounts.
4. Test Google OAuth only after the exact callback and post-login redirect URLs are registered.
5. Repeat the two-account test with two dedicated synthetic users: connection request/acceptance, private chat, read receipt, group join/approval, group chat and owner-scoped notifications.
6. Confirm a pending/non-member account cannot read private messages or group content.
7. Inspect the built assets to ensure no server secret is present.
8. Keep production DNS, custom domains and the current Netlify production deployment unchanged during staging acceptance.

## What is not done by this repository change

This configuration and runbook do not create the Cloudflare account/project, connect GitHub to Cloudflare, set dashboard environment variables, change Supabase Auth URLs, register OAuth callback URLs, alter DNS, or deploy production. Those actions require an authenticated Cloudflare dashboard session and project access.
