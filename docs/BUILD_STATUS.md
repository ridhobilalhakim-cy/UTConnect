# Build and verification status — Phase 0.5 / Phase 04

Date: 2026-10-31

## Passed locally in GitHub Actions

GitHub Actions run #4: **SUCCESS**  
Commit: `4b58e41eddfeef15f3882f892918b1facf394438`  
Workflow: `Verify UT Connect build`

- `package-lock.json` exists in the repository and dependency installation completed successfully.
- `npm run check` — PASS.
- `npm run build` — PASS; Vite generated the production site in `dist/`.
- Playwright Chromium setup — PASS.
- Browser E2E — **5 passed**:
  1. Login and registration are separate views.
  2. Guest cannot open the protected dashboard.
  3. Email login restores session and logout clears it.
  4. Forgot-password sends a non-enumerating recovery request.
  5. Password recovery validates confirmation and updates the password.
- CI artifact `utconnect-build-4` was uploaded successfully.

## What this does and does not prove

These Playwright tests use mocked Supabase HTTP responses and synthetic student data. They verify client-side UI/auth flow behavior and a successful production build. They do **not** prove live Supabase Auth, actual email delivery, Google OAuth, deployed Edge Function behavior, production RLS, or real multi-user dashboard features.

## Remaining before public staging

1. Connect GitHub repository `ridhobilalhakim-cy/UTConnect` to Netlify.
2. Use build command `npm ci && npm run build` and publish directory `dist` (also specified by `netlify.toml`).
3. Add the actual HTTPS staging domain to Supabase Auth Site URL and Redirect URLs.
4. Configure Google OAuth origins/redirects in Google Cloud and Supabase.
5. Test signup, profile completion, login, session restore, protected route, logout, Google OAuth, and password recovery with test accounts.
6. Keep multi-user feature claims on hold until each dashboard service is integrated and tested against live Supabase.

## Backend/source-control caveats

- The deployed registration Edge Function is mirrored in this repository; repository edits do not automatically deploy it to Supabase.
- The first five remote SQL migration bodies still need to be reconstructed and reviewed in source control. Do not blindly rerun SQL migrations on the existing staging project.
