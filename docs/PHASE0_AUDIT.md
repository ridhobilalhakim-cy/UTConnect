# Phase 0 — Codebase Consolidation Audit

## What was consolidated

1. The login/registration HTML and dashboard HTML now belong to one Vite multi-page application.
2. The Supabase browser client configuration and auth storage key are centralized in `src/lib/supabase.js`.
3. Auth page logic moved to `src/auth/main.js`.
4. Dashboard session/profile guard moved to `src/app/main.js`.
5. Existing V2.2 dashboard UI interactions moved to `src/app/dashboard.js`.
6. Inline CSS was extracted to `src/styles/auth.css` and `src/styles/app.css`.
7. The existing logo, manifest, and security headers are in `public/`.
8. Netlify build configuration was added; the host can build from the repository so end users do not install Python or Node.

## Confirmed static checks

- HTML parses for both entry pages.
- No duplicate HTML IDs in either page.
- No inline JavaScript remains in either HTML page; each has one Vite module entry.
- The original inline JavaScript blocks passed `node --check` before extraction.
- Consolidated JS modules pass `node --check` after extraction.

## Known unfinished areas

- Production bundle was not built in this environment because package installation could not reach npm registry before timeout.
- Browser end-to-end tests were not run.
- Google OAuth and email signup remain unverified against real browser flows.
- Dashboard core features remain simulated and must be replaced with Supabase services.
- The full migration chain needs to be mirrored and reviewed in source control.

## Next acceptance gate

Run dependency installation/build in a network-enabled environment, deploy to a staging URL, then test sign-up, login, Google OAuth, profile completion, redirect, reload/session restoration, protected route, and logout using two test accounts.
