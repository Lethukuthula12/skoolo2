# Server-managed session design

Stage 0 proposal, 2026-10-25. **Not implemented or deployed.** Staff limits are agreed: 30 minutes
idle/eight hours maximum. Supabase is on Free. Parent limits, resource provisioning and any paid
upgrade remain decisions. Existing browser token storage is unchanged.

## Boundary and storage

Both Wrangler configurations currently serve static assets. Shared application, staff, directory
and messaging services call Supabase directly. Private document links last 10 minutes in the
application service and 15 minutes in staff/messaging. Some policies check user IDs directly.

Add a handler to each existing Worker for `/api/*` and dedicated `/auth/*` callbacks, preserving
Angular assets and the parent's `/auth` login page. Configure server paths before SPA fallback:
[Cloudflare Worker/asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
Use an opaque random 256-bit `__Host-skoolo-session` cookie with `HttpOnly; Secure; Path=/;
SameSite=Lax`, no Domain attribute, and a new value on login/privilege escalation. Each host has
its own session. Angular receives only necessary identity/expiry data, never Supabase tokens.

Propose SQLite-backed Durable Objects for session state and serialized refresh. These are
[available on Workers Free](https://developers.cloudflare.com/durable-objects/platform/pricing/)
subject to quotas; estimate polling, heartbeat and file traffic before provisioning. Availability
does not guarantee this workload fits the free allowance. Look up records by a digest of the
cookie and encrypt Supabase tokens with authenticated encryption, binding session ID/audience
and using a versioned Worker-secret key. Define key rotation, cleanup, overlapping refresh and
restart recovery. Persist refresh transitions before success; never replay business writes.

Forward data calls with the authenticated user's JWT so RLS remains effective. Do not use
service-role credentials for normal school data/files. Fix the Supabase upstream origin and
allowlist required paths/methods/tables/RPCs/storage operations. Bound payloads, uploads and rows;
discard browser Authorization headers/upstream URLs. User IDs come from verified sessions.

## Staff expiry and direct API bypass

Check idle/absolute deadlines before every protected request or extension. Expired sessions cannot
be revived by a heartbeat. Warn before expiry and require sign-in again. Background polling,
refresh and hidden tabs do not count as activity. Propose bounded foreground activity updates
plus interactive API actions, shared across same-host tabs. Activity is not proof of human
presence: an attacker actively using a stolen session could simulate it. Absolute expiry is fixed.

Add a private server-owned registry keyed by Supabase `session_id`, with verified user, audience,
expiry and revocation. Browser roles cannot register/extend records. Only narrowly scoped server
operations maintain them; ordinary business calls retain user RLS. Gate every staff policy,
invoker view, security-definer RPC and private storage operation against this registry AND the
existing tenant/role checks. Include direct user-ID/authorship policies: permissive policies use
OR, so changing only a role helper leaves bypasses. A parent session for someone who is also staff
must not unlock staff access. Inventory all effective policies/RPCs before implementing the gate.

Define coordinated Worker/registry extension and revocation. Reject protected requests when
either authorization store is unavailable; never fall back to accepting any valid JWT. Valid but
unregistered, expired, revoked or wrong-audience JWTs obtained by direct Supabase login must fail
staff operations too. Registry metadata is private infrastructure with no browser table access.
Checking only a Worker cookie, browser timer or the existence of `auth.sessions` is insufficient.
Existing JWTs can outlive refresh revocation: see
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions).

## CSRF, callbacks, files and caches

Require exact allowed Origins and session-bound CSRF tokens on mutations, including logout,
refresh and activity updates; design login-CSRF protection before authentication too. Restrict
CORS and use JSON/non-simple requests. SameSite alone is insufficient. Retain server CAPTCHA/rate
limits and neutral account-existence responses.

Design same-device/cross-browser email callbacks around server consumption of one-use token
hashes, bound to purpose/audience and allowlisted return paths. A mail-scanner GET must not
complete login/recovery: require a deliberate confirmation POST. Existing implicit links put
tokens in fragments invisible to the server, requiring coordinated email-template/allowlist
changes and a new-link path for old links. Restrict recovery sessions to recovery until normal
authentication. Exclude credentials, callback queries and bodies from application/platform logs.

Proxy private files through authenticated same-origin routes with safe content headers; do not
expose upstream signed URLs/redirects. Previously issued links can remain valid for their TTL;
downloaded copies cannot be revoked. Auth/API/private responses must be `no-store` with CDN and
service-worker bypass. Exclude server routes from PWA navigation fallback and private file routes
from its image-extension asset rule. Public directory/badge access remains public.

## Delivery and evidence

Complete CAPTCHA activation first, then settle parent limits, store quotas, registry credential
scope, outage UX and callback migration. Prepare implementation/tests before provisioning or
changing live permissions. Cut over a complete audience in a coordinated deployment of app,
server, registry gate and email templates. Existing sessions reauthenticate. Test installed-PWA
updates and deliberately support or retire Workers hostnames.

Keep a previous working server build for rollback. Rolling back only Angular after enabling the
registry gate is incompatible. Restoring direct browser tokens is an explicit security rollback,
never an automatic outage fallback. No new infrastructure is created by this document.

Acceptance: server-clock expiry boundaries; concurrent refresh/restart and outage rejection;
CSRF/origin/cookie/redirect/proxy tests; no tokens in browser storage, caches or logs. Extend the
tenant suite with direct API bypass attempts, wrong audiences, parent/staff overlap, revoked
sessions, views/RPCs/storage. Walk through signup, joining, reset, password verification, logout,
private files, expired/reused/cross-browser links and the installed PWA. Stronger timeout and
HttpOnly guarantees remain pending until these checks pass.
