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

## Home Map, location management, and NIM lookup

The Home Map is connected to two authenticated Edge Functions. The browser never calls the PostGIS search RPC or reads another student's exact location.

### Owner location endpoint

POST /functions/v1/manage-my-location with a validated Supabase access token.

| action | Additional fields | Behavior |
|---|---|---|
| get | none | Returns only the signed-in user's saved latitude/longitude, radar preference, and consent timestamp. |
| save | lat, lng, consent: true, show_in_radar | Validates coordinates and explicit consent, then creates or updates the caller's own location. |
| visibility | show_in_radar, and consent: true when enabling | Changes only the caller's radar visibility. Disabling visibility does not prevent the user from browsing other opted-in students. |

The Edge Function derives the user ID from the authenticated session. A caller-supplied user ID is never accepted. The exact location response is owner-only and includes Cache-Control: no-store.

### Nearby student search

POST /functions/v1/nearby-students with a validated access token.

Request body:

```json
{
  "radius": 3000,
  "nim": "049123456"
}
```

The nim field is optional and, when present, must contain exactly nine digits. Supported radius values are exactly 1000, 3000, or 5000 metres.

The Edge Function:
1. Validates the JWT and derives the viewer ID from the authenticated session.
2. Requires profiles.verification_status = 'verified'.
3. Applies a server-side general-search limit of 30 requests per minute. NIM lookups additionally use the existing database limit of five per minute.
4. HMACs the submitted NIM in memory using NIM_HMAC_SECRET; plaintext NIM is not written to a table, URL, browser storage, or response.
5. Calls the service-role-only PostGIS function find_nearby_students.
6. Returns at most ten results with initials, program, rounded distance, and jittered marker coordinates.

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

The UUID and coordinates above are examples only, not real student records or places. Marker coordinates are jittered by PostGIS for visual display only; they must never be used for routing, address lookup, or precision navigation. Exact coordinates are read by the location owner only through the owner-scoped Edge Function. Students whose show_in_radar preference is off are excluded as candidates, but they may still search from their own saved location.

Both functions return Cache-Control: no-store. The Home Map does not render synthetic student profiles or guessed markers.

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
