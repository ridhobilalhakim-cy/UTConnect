# Build and verification status — Phase 0.5

Date: 2026-10-31

## Passed

- Both HTML entry pages parse.
- No duplicate HTML IDs were found.
- Both pages have one Vite module entry and no remaining inline JavaScript.
- Supabase client initialization is centralized in `src/lib/supabase.js`.
- Both pages share the same Supabase browser auth storage key.
- `npm run check` passes, including local import resolution and declared package dependency checks.
- JavaScript syntax checks pass for all 4 files under `src/`.
- Vite config and source-check script pass Node syntax checks.
- The source ZIP passes archive integrity testing.

## Not yet verified

- `npm install` / `npm ci`: package installation could not complete in this environment. A direct DNS check for `registry.npmjs.org` returned `Could not resolve host`; no `package-lock.json` was generated. Do not fabricate a lockfile.
- `npm run build`: attempted but cannot run because Vite is not installed (`vite: not found`); dependencies could not be installed.
- Browser runtime and responsive visual checks: not run against the Vite build.
- Auth end-to-end (email signup, Google OAuth, profile completion, login, refresh, logout): not run during this consolidation.
- Backend live feature integrations: still pending; dashboard feature logic is explicitly demo/simulated.

See `docs/PHASE05_DEPENDENCY_BUILD_GATE.md` for the full run log and handoff steps.

## CI bootstrap added

- `.github/workflows/verify-build.yml` now runs on pushes to `main` / `master`, pull requests, and manual dispatch.
- The workflow installs dependencies in GitHub Actions. If no lockfile exists yet, it creates one there, runs `npm ci`, executes source checks and the Vite build, then uploads both `dist/` and `package-lock.json` as a downloadable artifact.
- The generated lockfile must be committed back to the repository after the first successful run so subsequent builds remain reproducible. The workflow has been authored but cannot be executed until the source is pushed to GitHub.

## Required before staging deployment

1. Push this source folder to a GitHub repository.
2. Run the `Verify UT Connect build` GitHub Actions workflow and confirm it passes. Download the artifact and commit its generated `package-lock.json` back into the repository.
3. Run the workflow again to confirm the committed lockfile works with `npm ci`.
4. Connect the GitHub repository to Netlify and deploy the `dist/` output to a new staging URL.
5. Add the staging URL to Supabase Auth redirect allow-list and Google OAuth origins/redirect setup.
6. Execute the Auth acceptance tests with two test accounts.

## Phase 04 auth recovery and browser-test readiness (2026-10-31)

- Added a dedicated password recovery view and `PASSWORD_RECOVERY` event handling.
- Added Playwright 1.64.1 as a pinned development dependency and five mocked Supabase browser E2E scenarios.
- Extended GitHub Actions to install Chromium and run the browser tests after the Vite build.
- Source checks and `node --check` pass for the auth module, Playwright config, tests, and checker.
- Playwright execution and Vite build remain unverified in this environment because dependencies are not installed; npm registry DNS was unavailable at the previous install attempt. No successful CI run or production artifact is claimed.
