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

The coordinates above are examples only, not real student records or places. The Home Map response intentionally omits student IDs. Marker coordinates are jittered by PostGIS for visual display only; they must never be used for routing, address lookup, or precision navigation. Exact coordinates are read by the location owner only through the owner-scoped Edge Function. Students whose show_in_radar preference is off are excluded as candidates, but they may still search from their own saved location.

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

## Study groups and collaborative workspace

All group discovery and workspace features are for verified students. Group tables enforce RLS. The browser must not bypass RLS with service-role credentials.

| Operation | Method | Access | Expected behavior |
|---|---|---|---|
| Create group | `study_groups` insert | Verified student | Capacity 2–100; trigger adds creator as active admin. |
| Discover groups | `study_groups` select | Verified student | Private groups are hidden except to active members and invitees. |
| Join open group | RPC `join_study_group` | Verified student | Membership becomes active if capacity permits. |
| Request approval | Same RPC | Verified student | Membership becomes pending. |
| Accept private invitation | Same RPC + pending invite | Invited verified student | Requires valid invite; marks invite accepted and membership active. |
| Approve/reject request | RPC `respond_group_join_request` | Active group admin/co-admin | Enforces actor and capacity. |
| Group chat | `group_messages` select/insert | Active member | Message body max 5,000 characters; same-group replies and active-member mentions are checked by trigger. |
| Pin/unpin message | RPC `set_group_message_pin` | Active group admin/co-admin | Checks `auth.uid() = p_actor_id` and role before updating pin state. |
| Read materials | `group_materials` select + Storage signed URL | Active member | Bucket is private; signed download URLs expire after 10 minutes. |
| Upload material | Storage object upload + `group_materials` insert | Active member | Path is `{group_id}/{uploader_id}/{file_id}.{ext}`; max size 50 MiB; only PDF, DOC/DOCX, PPTX, XLSX, JPG, PNG. |
| Delete material | `group_materials` delete + Storage object delete | Uploader or active admin/co-admin | Table and object policies enforce ownership/admin access. |
| Agenda | `group_agenda_items` select/insert/update/delete | Active member | Types: schedule, target, task, poll, note. Updates/deletes are limited to creator or admin/co-admin. |
| Poll results | RPC `get_group_agenda_poll_results` | Active member | Returns option labels and aggregate counts, not voter identities. |
| Cast poll vote | RPC `cast_group_agenda_vote` | Active member | One vote per member per poll; repeat vote changes that member's choice. |
| Invite to private group | Edge Function `manage-group-invites` action `invite_by_nim` | Active private-group admin/co-admin | Accepts a nine-digit NIM in the authenticated POST body; server HMACs NIM, resolves verified profile and returns no invitee UUID. Five lookup attempts per minute per inviter. |
| Cancel invitation | Edge Function `manage-group-invites` action `cancel` | Invitee or active private-group admin/co-admin | Removes a pending invite through an actor-checked RPC. |
| List own invitations | RPC `list_my_group_invites` | Verified signed-in user | Returns invitations addressed to the current user only. |

### Group invitation Edge Function

`POST /functions/v1/manage-group-invites` requires a valid Supabase access token. The user ID is derived from `auth.getUser(access_token)`; no browser-supplied actor ID is accepted.

Invite request:

```json
{
  "action": "invite_by_nim",
  "group_id": "GROUP_UUID",
  "nim": "049123456"
}
```

The function validates the group UUID and nine-digit NIM, applies the authenticated invite-search limit, HMACs the NIM using the server-side `NIM_HMAC_SECRET`, resolves only a verified profile, then calls `create_group_invite` through the authenticated user context. The Edge Function never returns the invitee UUID or NIM digest.

Cancel request:

```json
{
  "action": "cancel",
  "invite_id": "INVITE_UUID"
}
```

Invitation insert triggers a notification of type `group_invite` to the invitee. The notification reference is the group ID; the recipient sees the invitation in the Groups inbox.

### Realtime and privacy

The `supabase_realtime` publication includes `group_messages`, `group_materials`, `group_agenda_items`, `group_invites`, and `group_members`. Subscriptions are filtered by group ID and remain subject to table RLS. Poll vote changes update the parent agenda row so active subscribers can reload aggregate counts. Notification Realtime remains filtered by the signed-in user's own ID.

The `group-materials` Storage bucket is private. The frontend never constructs public object URLs; it requests short-lived signed URLs after a successful RLS-protected metadata read. Poll votes are stored in `group_agenda_votes`, which has RLS enabled and no direct authenticated table writes; actor-checked RPCs are the only user-facing interface.

## Forum and Informasi UT

- `forum_posts` and `forum_comments` are available to verified students only.
- `information_posts` has two audiences: `public` and `verified_students`.
- Guest-accessible published categories are restricted by constraint to `competition`, `job`, `seminar`, and `tips`.
- New student submissions default to `verified_students` and `is_published = false`; a moderator publishing flow still needs to be built.

## Error handling contract

Frontend should map server errors to user-friendly Indonesian messages, but must not infer hidden account existence. For NIM search, show a generic message such as “NIM tidak ditemukan dalam radius aktif” whether the NIM is unknown, outside the radius, hidden from radar, or not eligible to appear.
