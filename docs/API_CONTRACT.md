# UT Connect — Initial API Contract

This contract describes the first integration boundary. It is not a claim that all endpoints have been deployed.

## Browser configuration

Only these values belong in the browser build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the Supabase client with the active user's session. Normal table requests must be constrained by RLS. The browser must never use a secret key.

## Authentication and profile lifecycle

| Operation | Method | Access | Expected behavior |
|---|---|---|---|
| Create account | Supabase Auth sign-up / OTP | Guest | Creates an Auth identity; does not yet prove UT student status. |
| Create student profile | Protected registration Edge Function (to build) | Authenticated | Validates fields, HMACs NIM in memory, inserts profile as `pending`. |
| Read own profile | `profiles` select | Authenticated owner | Only the current user's profile fields. NIM digest is not selected. |
| Update own profile | `profiles` update | Authenticated owner | Only editable profile columns; verification state cannot be changed by user. |
| Student review | Admin workflow (to build) | Authorized moderator only | Changes pending/rejected/verified state after approved validation. |

## Nearby map and NIM lookup

**Implemented starter:** `POST /functions/v1/nearby-students`

Headers:

```http
Authorization: Bearer <user-access-token>
apikey: <publishable-key>
Content-Type: application/json
```

Request body:

```json
{
  "radius": 3000,
  "nim": "049123456"
}
```

`nim` is optional. Supported radius values are exactly `1000`, `3000`, or `5000` metres. The function derives the viewer ID from the validated JWT, HMACs NIM in memory, calls the server-only PostGIS RPC, and returns at most 10 candidates.

Response shape:

```json
{
  "radius": 3000,
  "results": [
    {
      "student_id": "00000000-0000-0000-0000-000000000000",
      "initials": "AB",
      "program": "Sistem Informasi",
      "approx_distance_m": 500,
      "marker_lat": -6.9,
      "marker_lng": 107.6
    }
  ],
  "privacy": "Koordinat asli dan NIM lengkap tidak dikirim ke browser."
}
```

The UUID above is a shape example only, not a real account. Do not use the sample values as real locations. The true coordinates remain on the server. The returned marker coordinates are jittered for map rendering and must never be reused for routing, address lookup, or other precise location functions.

**Important:** the SQL rate-limit guard is a starter control, not a complete anti-abuse system. Add edge-level rate limits, monitoring, abuse alerts, and tests before public launch.

## Matching and direct messaging

| Operation | Method | Access | Expected behavior |
|---|---|---|---|
| Save matching preferences | `matching_preferences` upsert | Owner | Stores topics, interests, and time slots. |
| Select courses | `profile_courses` insert/delete | Owner | Stores courses selected by the student. |
| Generate match candidates | Matching Edge Function (to build) | Verified student | Scores overlapping courses/topics/interests/time; returns only permitted preview fields. |
| Request connection | RPC `request_connection(p_recipient_id)` | Verified student | Creates one pending request; duplicate/reversed pair is rejected. |
| Respond to request | RPC `respond_connection(p_connection_id, p_accept)` | Recipient only | Accepts or rejects pending request. |
| Read direct messages | `direct_messages` select | Accepted connection participants | Only accepted connection members can read. |
| Send direct message | `direct_messages` insert | Accepted connection participants | Sender must equal current user. |

## Study groups

| Operation | Method | Access | Expected behavior |
|---|---|---|---|
| Create group | `study_groups` insert | Verified student | Capacity 2–100; trigger adds creator as admin. |
| Discover groups | `study_groups` select | Verified student | Private groups hidden except to members/invitees. |
| Join open group | RPC `join_study_group(group_id)` | Verified student | Membership becomes active if capacity allows. |
| Request approval | Same RPC | Verified student | Membership becomes pending. |
| Join private group | Same RPC + invite | Invited verified student | Requires a valid invite. |
| Approve/reject request | RPC `respond_group_join_request(group_id, user_id, accept)` | Group admin/co-admin | Enforces capacity under a row lock. |
| Invite to private group | RPC `invite_to_private_group(group_id, user_id)` | Group admin/co-admin | Creates or refreshes invitation. |
| Group chat | `group_messages` select/insert | Active members | Reply and mention fields are stored; pin mutation endpoint still needs implementation. |
| Agenda | `group_agenda_items` | Active members | Supports schedule, target, task, poll, note. |
| Materials | `group_materials` metadata | Active members | Actual Storage bucket and object policies still need setup. |

## Forum and Informasi UT

- `forum_posts` and `forum_comments` are available to verified students only.
- `information_posts` has two audiences: `public` and `verified_students`.
- Guest-accessible published categories are restricted by constraint to `competition`, `job`, `seminar`, and `tips`.
- New student submissions default to `verified_students` and `is_published = false`; a moderator publishing flow still needs to be built.

## Error handling contract

Frontend should map server errors to user-friendly Indonesian messages, but must not infer hidden account existence. For NIM search, show a generic message such as “NIM tidak ditemukan dalam radius aktif” whether the NIM is unknown, outside the radius, hidden from radar, or not eligible to appear.
