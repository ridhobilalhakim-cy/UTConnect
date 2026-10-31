# Phase 0.5 — Dependency and Build Gate

Date: 2026-10-31

## Outcome

**PASSED in GitHub Actions run #33.**

The local execution environment has no reliable external DNS access, but the GitHub-hosted runner installed dependencies successfully from the committed lockfile and completed the full production build and browser test suite.

## Latest verified CI run

- Workflow: `Verify UT Connect build`
- Run: https://github.com/ridhobilalhakim-cy/UTConnect/actions/runs/41182270518
- Commit: `f90411793c213c91a31ad80a212f38316b4319cf`
- Lockfile-based dependency install — PASS.
- `npm run check` — PASS.
- `npm run build` — PASS.
- Playwright Chromium installation — PASS.
- Browser E2E — **10 passed**.
- CI build/test artifact uploaded — PASS.

## Scope boundary

The run verifies source checks, the Vite production build, and mocked browser tests for auth/session behavior, Information UT, and Student Verification client flows. It does not verify real Google OAuth, real email delivery, deployed Edge Function behavior, the Netlify production deployment, or all live Supabase browser operations.

The Information UT module is connected to Supabase and has admin CRUD/publication controls. Student Verification is also wired to the existing private Supabase workflow: evidence upload, own-status display, admin queue, private evidence download, and approve/reject actions. Database role checks and RLS were separately exercised using authenticated SQL contexts: an assigned admin can insert; a real non-admin student profile cannot insert. The test insert was rolled back, so the production information table remains empty.

## Next step

Verify that Netlify deployed the latest successful GitHub commit. Then run real-account acceptance tests for Google OAuth, student profile completion, administrator Information UT CRUD, and student read visibility. Do not infer deployment or live Google OAuth success solely from a passing CI run.


## Student Verification acceptance boundary

The ten browser tests include mocked evidence upload and pending state, admin approval, and rejection reason validation. They do not validate real Storage objects or RPC calls with a real browser identity.

Live database inspection confirmed the private evidence bucket, owner-only upload policy, admin-only read policy, admin-gated review RPC, and the absence of authenticated UPDATE privilege on profiles.verification_status. At the last check all three profiles remained pending, with no submitted requests or review events.

The evidence examples in the UI are manual review guidance. There is no official UT API integration. Before public launch, define the acceptable proof of active UT enrollment and an evidence retention/deletion period. CI run #33 passed after the filename-sanitization fix.
