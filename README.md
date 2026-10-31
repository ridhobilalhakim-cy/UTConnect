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

## Current implementation status

1. Login/register and the protected dashboard use one shared Supabase client and persistent browser session.
2. The administrator role is stored in the non-exposed `private.app_user_roles` table. Three team accounts have been assigned the `admin` role; role lookup is performed server-side and normal users cannot edit role assignments.
3. **Information UT is connected to Supabase.** The feed is loaded from `public.information_posts`; the three administrator accounts can create, edit, publish, unpublish, and delete posts. Students can read published posts according to the database audience rules. Drafts are visible to admins only.
4. The Information UT page has database-backed categories, audience selection, source links, and draft/published states. The feed currently contains zero posts; no sample content has been seeded into the live database.
5. Matching, chat, forum, groups, student map markers, and notifications remain prototypes/simulated and must not be described as operational.
6. Seven remote migrations are recorded for the staging project. The first five SQL bodies still need to be reconstructed and reviewed in source control; the registration and admin migrations are retained in `supabase/migrations/`. See `docs/STAGING_STATE.md` and `supabase/migrations/REMOTE_MIGRATIONS.md`.
7. The local execution environment cannot resolve external DNS, but the GitHub-hosted CI runner successfully installed dependencies from the committed lockfile and built the production site.

## Verification and next acceptance gate

GitHub Actions run #21 passed on 2026-10-31 (commit `5c45899`): source checks, Vite production build, Chromium installation, and all seven mocked Playwright tests. The browser suite includes admin and student Information UT flows, including create, edit, unpublish, republish, and delete.

The live Supabase database was separately checked with authenticated SQL role contexts: an assigned administrator resolves as admin and can insert an information post; a non-admin student profile resolves as non-admin and its insert is rejected by RLS. The test insert was rolled back, leaving the Information UT feed empty.

The next acceptance gate is to verify the current GitHub commit has deployed to the Netlify HTTPS site, then test with the team's actual Google accounts. These browser tests mock Supabase and do not prove live Google OAuth, full live CRUD through the browser, email delivery, or the deployed registration Edge Function. The deployment status could not be independently confirmed from this environment.

Student verification remains separate from administrator access. At the last database check, the three administrator roles existed, but one of those accounts had not completed its student profile; all three existing student profiles were still `pending`, and none was `verified`. Do not mark a student verified solely because they used Google login.

## Browser E2E tests

The project includes Playwright tests for the authentication interface and Information UT client flows. They use mocked Supabase HTTP responses and synthetic test records; they do not create accounts or read/write the live Supabase project.

```bash
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

The seven tests cover login/register separation, guest access protection, email login/session restoration/logout, forgot-password, password recovery/update, administrator Information UT CRUD/publication flows, and student public-feed visibility with admin controls hidden. Google OAuth, real email delivery, the deployed Edge Function, the Netlify production deployment, and live Supabase RLS are verified separately rather than inferred from mocked tests.
