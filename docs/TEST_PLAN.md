# UT Connect — Phase 03 Security & Integration Test Plan

## Automated browser authentication tests (Phase 04 readiness)

Run after a successful Vite build with `npm run test:e2e`. The Playwright tests in `tests/auth.spec.js` use intercepted Supabase Auth/PostgREST HTTP calls and synthetic fixtures. They are intended to test browser wiring and navigation without touching live student accounts.

- [ ] Login and registration are separate views and navigation works.
- [ ] Guest access to `/app.html` redirects to the login page.
- [ ] Email login opens the authenticated dashboard and hydrates the returned profile.
- [ ] Session remains available after a page reload.
- [ ] Logout clears the session and returns to login.
- [ ] Forgot-password request shows a generic message that does not reveal whether an email exists.
- [ ] Recovery view validates password length and confirmation before calling update.
- [ ] Successful password update closes the session and returns the user to login.

**Important boundary:** these tests mock Supabase. Passing them does not prove Google OAuth configuration, real email delivery, Edge Function behavior, database RLS, location privacy, or production readiness. Those require separate staging tests with controlled synthetic accounts.

Run these checks in **staging** using synthetic accounts only. Do not use real student NIM or residential coordinates as test fixtures.

## Accounts

- Guest/anonymous browser.
- Verified test student A.
- Verified test student B.
- Verified test student C (unconnected / not a group member).
- Pending-verification test student P.
- Moderator/admin test identity managed outside normal student self-service.

## Access-control matrix

| Test | Expected result |
|---|---|
| Guest reads public Info UT rows in `competition`, `job`, `seminar`, `tips` | Allowed only when `is_published = true` and `audience = public`. |
| Guest reads forum posts, profiles, exact locations, group messages | Denied. |
| Pending student reads verified-only forum / map | Denied or empty; must not be presented as verified. |
| Student A reads own profile and own exact location | Allowed. |
| Student A reads Student B's `profiles` row or exact location | Denied. |
| Student A reads nearby endpoint | Only initials, program, rounded distance, jittered marker; max 10. |
| Nearby endpoint called with radius other than 1000/3000/5000 | HTTP 400. |
| Nearby NIM search repeated more than five times in one minute | HTTP 429 / generic localized rate-limit message. |
| Search for a NIM outside active radius | Generic not-found-in-active-radius state; no indication the account exists elsewhere. |
| NIM appears in frontend logs, URL, localStorage, or analytics | Must not happen. |
| Student A creates a connection request to B | Pending row created. |
| Student A attempts to accept their own request | Denied. |
| Student C attempts to read A-B DM | Denied. |
| A-B connection is pending/rejected; either attempts to send/read DM | Denied. |
| B accepts A's request | Status becomes accepted. |
| A and B send messages | Both accepted participants can read; C cannot. |
| Verified student creates group with capacity 1 or 101 | Denied by database constraint. |
| Open group at capacity receives another join request | Denied as full. |
| Approval group receives a join request | Membership remains pending; group messages are unavailable. |
| Non-admin attempts to approve/reject a join request | Denied. |
| Private group join without invite | Denied. |
| Active group member sends group message | Allowed. |
| Non-member reads group message, agenda, or material metadata | Denied. |
| Guest sees public job/competition/seminar/tips | Allowed if published. |
| Guest sees UKM/HIMA/academic-only information | Denied. |
| Student submits new Informasi UT content | Stored unpublished and audience defaults to verified students. |
| Student attempts to self-publish / change audience / mark verified | Denied by missing column privileges or RLS. |

## Browser and deployment checks

- [ ] `SUPABASE_SECRET_KEYS` is not present in built frontend assets.
- [ ] `NIM_HMAC_SECRET` is not present in built frontend assets.
- [ ] `VITE_*` variables contain only URL and publishable key.
- [ ] CORS allows only the configured app origin in staging/production.
- [ ] Realtime channels are private and authorization is tested with A, B, and C.
- [ ] Group Storage bucket is private; non-member cannot download a file by guessing its path.
- [ ] Location endpoint response uses `Cache-Control: no-store`.
- [ ] Rate-limit tests include concurrent requests and account rotation attempts.
- [ ] Database backup and restore are tested before production.

## Known implementation gaps after this foundation

- Registration Edge Function and authorized UT verification workflow.
- Secure save/update-location Edge Function.
- Matching candidate-scoring Edge Function.
- Group pin/unpin and leave-group RPCs.
- Private Storage bucket and object policies.
- Moderation workflow for Informasi UT publishing.
- Realtime channel authorization policies and subscription integration.
- Automated SQL tests (pgTAP / `supabase test db`) and end-to-end browser tests.

Do not mark Phase 03 production-ready until the gaps above that are required by the shipped feature set are implemented and tested.
