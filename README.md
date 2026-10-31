# UT Connect — Main Codebase (Phase 0 + 0.5 + 04 readiness)

This is the official consolidated source tree for the current UT Connect staging application. It combines the approved Clean Academic Premium UI, separate login/registration entry page, protected dashboard page, one shared Supabase client/session configuration, and the current registration Edge Function source mirror.

## What this codebase is

- One Vite multi-page web application, not unrelated HTML files.
- `index.html` is the login/registration entry route.
- `app.html` is the protected main dashboard.
- Both pages use `src/lib/supabase.js`, the same Supabase project and the same browser auth storage key.
- The host builds the source into static files. End users and teammates who only use the website do not install Python, Node, or developer tools.

## Current integration truth

- `src/auth/main.js`: email/password, Google OAuth entry, password reset, registration profile form, map pin selection, and session restore.
- `src/app/main.js`: protected route, session and profile check, profile header hydration, logout.
- `src/app/dashboard.js`: existing V2.2 dashboard UI interactions remain **DEMO/SIMULATED** until each feature is replaced by backend service modules. Do not present them as live multi-user capabilities.
- `src/lib/supabase.js`: the single browser client and storage key shared by both pages. Only the Supabase publishable key belongs here.
- `supabase/functions/complete-student-registration/index.ts`: source mirror of deployed function v4; editing the repository file does not automatically deploy the function to Supabase.

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
- Precise location is stored server-side. Do not expose it in client queries. User consent and a separate server-controlled visibility policy must be tested before live map rollout.

## Phase 0 findings

1. Prior pages duplicated Supabase configuration and dynamic CDN bootstrapping. The consolidated source puts auth configuration in one module.
2. Login/register and dashboard now use one codebase and a shared client/session configuration.
3. Dashboard data, map markers, matching, chat, forum, groups, information feed, and notifications remain simulated. They are intentionally not described as complete.
4. The remote database has six applied migrations, but the first five SQL bodies have not yet been reconstructed into local source control. See `docs/STAGING_STATE.md` and `supabase/migrations/REMOTE_MIGRATIONS.md`.
5. Package installation is still blocked in this execution environment: DNS cannot resolve `registry.npmjs.org`. No lockfile or production bundle was generated here. The remote build bootstrap is documented in `docs/PHASE05_DEPENDENCY_BUILD_GATE.md`.

## Verification and next acceptance gate

GitHub Actions run #4 passed on 2026-10-31 (commit `4b58e41`): lockfile-based dependency install, source checks, Vite production build, Chromium install, and all five mocked Playwright auth tests. The next gate is Netlify staging deployment, followed by real Supabase auth tests (signup, Google OAuth, profile completion, redirect, reload/session restoration, protected route, and logout) using two separate test accounts. Only after the Auth acceptance gate passes should feature modules begin connecting to the backend.

## Browser E2E tests

The project includes Playwright tests for the authentication interface and session lifecycle. They use mocked Supabase HTTP responses and synthetic student data; they do not create accounts or read records in the live Supabase project.

```bash
npm install
npx playwright install chromium
npm run build
npm run test:e2e
```

The tests cover separate login/register views, guest access protection for `app.html`, email login, session persistence after reload, logout, the generic forgot-password response, and password recovery/update. Google OAuth, real email delivery, the deployed Edge Function, and live Supabase RLS are not covered by these mocked browser tests and must be verified separately in staging.
