# Build and verification status — Phase 0.5 / Phase 04

Date: 2026-10-31

## Latest CI result

GitHub Actions run #21: **SUCCESS**  
Commit: `5c45899b1afd5843fb7b4fae596f0da08eb7d3de`  
Workflow: `Verify UT Connect build`

- Dependency install with committed `package-lock.json` — PASS.
- `npm run check` — PASS.
- `npm run build` — PASS; Vite generated the production site in `dist/`.
- Playwright Chromium installation — PASS.
- Browser E2E — **7 passed**.
- CI artifact `utconnect-build-21` uploaded successfully.

Workflow run: https://github.com/ridhobilalhakim-cy/UTConnect/actions/runs/41178754676

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

The seven mocked Playwright tests cover auth UI/session behavior, admin Information UT create/edit/unpublish/republish/delete, and student read-only visibility. They verify client-side behavior but do not substitute for a real-browser test against live Supabase.

## Supabase role and RLS verification

- Three administrator assignments are present in `private.app_user_roles`.
- `public.is_current_user_admin()` returned `true` for an assigned admin and `false` for a non-admin student profile.
- An authenticated admin insert into `information_posts` passed RLS.
- An authenticated non-admin student insert was rejected by RLS.
- The admin insert acceptance test was rolled back; the live Information UT table remains empty.
- Administrator privilege does not change `profiles.verification_status`.

At the last database check:
- 3 administrator roles exist.
- 3 student profiles exist; all 3 are `pending`.
- 0 profiles are `verified`.
- One of the three administrator accounts has not completed its student profile and must finish registration before accessing the dashboard.

## What this does and does not prove

The CI browser tests use mocked Supabase HTTP responses and synthetic test data. They prove source integrity, build completion, and client UI behavior under the mocked responses. They do **not** prove live Google OAuth, real email delivery, the deployed Edge Function, end-to-end browser CRUD against the production Supabase API, or successful Netlify deployment.

This environment could not independently resolve the public Netlify domain. The Netlify production deployment therefore remains an external acceptance check; do not assume a passing GitHub Actions run proves that the latest commit is already live.

## Remaining acceptance gates

1. Confirm Netlify has deployed the latest successful commit.
2. Test Google sign-in and profile completion using each team's actual account.
3. Test Information UT create/edit/publish/unpublish/delete from a real admin browser session and confirm student read visibility.
4. Agree on a privacy-conscious, independently verifiable student evidence process before enabling any admin action that changes a student's status to `verified`.
5. Integrate and test Forum, Groups, Matching/Connections, Chat, notifications, and map access one service at a time.

## Source-control caveats

- The remote staging project has seven recorded migrations. The first five original SQL bodies still need reconstruction/review in repository source. Do not re-run them blindly against the live staging database.
- The registration Edge Function mirror in GitHub does not automatically deploy source edits to Supabase.
- Never put the Supabase service-role key, secret keys, or NIM HMAC secret in browser code or public GitHub files.
