# Phase 0.5 — Dependency and Build Gate / Grup Belajar

Date: 2026-10-31

## Outcome

**PASSED in GitHub Actions run #50.**

The local execution environment has no reliable external DNS access, but the GitHub-hosted runner installed dependencies successfully from the committed lockfile and completed the full production build and browser test suite.

## Latest verified CI run

- Workflow: `Verify UT Connect build`
- Run: https://github.com/ridhobilalhakim-cy/UTConnect/actions/runs/41191070350
- Commit: `ec7eacf3b136b29f4887843654cb4c41268ed7bd`
- Lockfile-based dependency install — PASS.
- `npm run check` — PASS.
- `npm run build` — PASS.
- Playwright Chromium installation — PASS.
- Browser E2E — **13 passed**.
- CI build/test artifact uploaded — PASS.

## Scope boundary

The run verifies source checks, the Vite production build, and mocked browser tests for auth/session behavior, Information UT, Student Verification, and Forum Diskusi client flows. It does not verify real Google OAuth, real email delivery, deployed Edge Function behavior, the Netlify production deployment, or all live Supabase browser operations.

The Information UT module is connected to Supabase and has admin CRUD/publication controls. Student Verification is also wired to the existing private Supabase workflow: evidence upload, own-status display, admin queue, private evidence download, and approve/reject actions. Forum Diskusi is connected to the existing public forum tables for verified-only discussions and comments. Database role checks and RLS were separately exercised using authenticated SQL contexts: an assigned admin can insert; a real non-admin student profile cannot insert. The test insert was rolled back, so the production information table remains empty.

## Current verification boundary after Groups changes

Run #50 remains the latest passing CI result independently confirmed in this repository record. Since then, Grup Belajar code and four mocked Playwright scenarios have been added; the current test file contains 17 tests. The outcome for the latest commit is not marked PASS here because a run-specific result could not be independently retrieved during this update. Do not count the four group tests as passing until a corresponding GitHub Actions run is green.

Verify that Netlify deployed the latest successful GitHub commit. Then run real-account acceptance tests for Google OAuth, student profile completion, administrator Information UT CRUD, student read visibility, group creation/join, and admin membership review. Do not infer deployment or live Google OAuth success solely from a passing CI run.


## Student Verification acceptance boundary

The 13 browser tests include mocked evidence upload and pending state, admin approval, rejection reason validation, and verified-only forum access/post/comment flows. They do not validate real Storage objects or RPC calls with a real browser identity.

Live database inspection confirmed the private evidence bucket, owner-only upload policy, admin-only read policy, admin-gated review RPC, and the absence of authenticated UPDATE privilege on profiles.verification_status. At the last check four profiles existed: one verified and three pending. The private verification tables contain one approved request and one approved review event, with no requests awaiting review.

The evidence examples in the UI are manual review guidance. There is no official UT API integration. Before public launch, define the acceptable proof of active UT enrollment and an evidence retention/deletion period. CI run #33 passed after the filename-sanitization fix.


## Forum Diskusi acceptance boundary

Run #50 includes mocked tests for the verified-only forum gate, verified-student post creation, loading a discussion thread, and adding a comment. It does not verify live posts/comments across separate real accounts.

Live database inspection confirmed RLS policies on forum_posts and forum_comments: read/write is limited to verified accounts; insert ownership is checked against auth.uid(); updates and deletes are limited to the original author. The current live forum_posts and forum_comments counts are both zero, and the active courses catalogue is empty. No test content was inserted.

Other students' profile names remain hidden by the existing profiles RLS policy. The Forum UI displays a generic student label for other authors and the signed-in user's own name for their posts/comments.


## Grup Belajar acceptance boundary — implementation added 2026-10-31

The group UI now reads and writes through `src/services/groups.js` and the existing Supabase group schema.

- Group discovery and creation are shown only for verified students. The live RLS policies independently enforce verified-only discovery and `created_by = auth.uid()` on insertion.
- The database trigger assigns the group creator as its first active admin.
- Open groups accept eligible users directly. Approval-based groups create a pending membership request; active group admins/co-admins can approve or reject it.
- Membership changes are performed through `join_study_group` and `respond_group_join_request`. Both functions now validate that their actor parameter equals `auth.uid()`; execute is granted to authenticated/service_role and revoked from PUBLIC/anon.
- Group member names are not exposed in the UI because the current profile RLS policy only permits reading one's own profile.
- The current active course catalogue and all group tables are empty. The form therefore permits general groups; no demo rows were seeded in the live Supabase project.
- Private invitation management, group chat, agenda, and material uploads are not included in this milestone.

Four mocked E2E tests were added for the unverified gate, group creation, approval-based join request, and group admin approval. They increase the repository test definition count from 13 to 17. The four new tests must not be reported as passing until a latest-commit Actions result confirms them. Real-account Supabase operations and Netlify deployment are separate acceptance checks.
