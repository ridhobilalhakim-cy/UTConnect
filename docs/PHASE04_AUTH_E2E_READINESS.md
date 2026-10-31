# Phase 04 — Authentication E2E Readiness

Date: 2026-10-31

## Work completed

- Added an explicit password-recovery view to the login page.
- The forgot-password email now returns to `/?mode=recovery`.
- Recovery callback events and restored recovery sessions display the reset form instead of routing the user into the dashboard.
- New passwords require at least eight characters and an exact confirmation match.
- A successful password update signs out the recovery session and returns the browser to login with a success message.
- Added Playwright browser tests using synthetic fixtures and intercepted Supabase HTTP responses.
- Extended the source preflight to syntax-check test files and verify key password-recovery hooks exist.
- Added the browser E2E test step to GitHub Actions after the production build.

## Browser test coverage

1. Login and registration are separate views.
2. Guest users cannot remain on `/app.html`.
3. Email login opens the protected dashboard.
4. The session survives a reload.
5. Logout clears the session.
6. Forgot-password response is generic and avoids account enumeration.
7. Password recovery validates matching passwords and calls the update endpoint.

## Verification status in this environment

- `node scripts/check-source.mjs` — PASS.
- `node --check` for authentication module, Playwright config, and browser tests — PASS.
- Playwright browser execution — NOT RUN. This environment does not currently have project npm dependencies installed, and npm registry DNS was previously unavailable.
- Vite production build — NOT RUN for the same dependency-installation blocker.
- Live Supabase email recovery and Google OAuth — NOT TESTED.

The GitHub Actions workflow installs dependencies, builds the site, installs Chromium, and runs `npm run test:e2e` in a network-enabled runner. It bootstraps a lockfile only when none exists; the first successful CI artifact must be used to commit the generated `package-lock.json`, then rerun CI to verify reproducible `npm ci`.

## Security and staging boundaries

- The Playwright tests use `example.test` synthetic identity and mock all Supabase endpoints they exercise.
- Do not use real NIM or real residential coordinates as test data.
- Google OAuth needs the deployed app origin in Supabase Auth redirect allow-list and the Google OAuth client configuration.
- Real email recovery must be tested from a controlled test mailbox against the deployed staging origin.
- The nine-digit NIM form constraint is still an assumption pending confirmation against current official UT NIM rules.
- Profile creation still starts with verification status `pending`; email/Google login is not proof of UT student status.

## Gate to close Phase 04

Do not mark Auth E2E complete until: production build succeeds in CI, the five automated browser tests pass there, a real staging email recovery link is exercised successfully, Google OAuth is tested with an approved redirect origin, and manual login/session/logout checks pass against the Seoul staging Supabase project.
