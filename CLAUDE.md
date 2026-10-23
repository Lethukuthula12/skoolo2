# Skoolo — project rules

Read `docs/decisions.md` first. It is the source of truth for scope and the reasons behind it.
Invoke the `skoolo` skill (`/skoolo`) at the start of a work session; it holds the principles and
the current state of the system.

## Multi-tenancy and self-service (non-negotiable)
- Skoolo serves every private school in South Africa. The pilot school is the first tenant, never
  a special case. No per-school logic, ids, emails or names in code; schools differ only in data.
- Every school-owned table has `school_id` and RLS. Every new query, view, RPC and storage path is
  checked against the question: can a second school's data leak through this?
- Schools set themselves up. If a feature needs the developer to run SQL per school, it is not
  done. The single exception is verifying a newly registered school (`is_verified`).
- Permissions are roles in data (`admin`, `staff`) checked with `is_school_admin()` /
  `is_school_staff()` in SQL and `staff.isAdmin()` in the portal. Never rely on RLS alone to
  narrow a result set when deciding what a user may do; filter for the signed-in user explicitly.

## Never build on a school's data
- Each school's admin captures and edits every school-specific detail in the system. Questions to a
  school are to understand what to build, never to seed, hardcode or special-case their data.
- Least privilege: a role sees only what its job needs. Teachers have no enrolment access.
- When product behaviour or who-sees-what is unspecified, ask or flag it in one line. Never invent
  an access rule or a product decision and bury it in code.

## Constraints
- Solo developer, pilot deadline measured in days. Prefer the boring, working solution. No
  speculative abstractions, no feature flags, no "for later" scaffolding.
- Stack is fixed: Supabase, Angular 20, Ionic 8, Capacitor. Node on this machine is 20.x, so do
  not upgrade Angular past 20 or Ionic past 8 without checking Node first.
- `C:\Dev\Skoolo` (the old .NET project) is reference only. Five rules were lifted from it and are
  listed in `docs/decisions.md`. Do not open it for anything else.

## Database
- Every schema change is a migration file under `supabase/migrations/`, applied with
  `npx supabase db push`. The dashboard is read-only for us.
- Every table that belongs to a school has a `school_id` column and row-level security enabled,
  with policies written in the same migration that creates the table.
- Business rules that must hold (grade capacity, one application per learner per school per year,
  status transitions) are enforced in PostgreSQL with constraints, triggers or SECURITY DEFINER
  functions, never only in the client.
- After any migration, regenerate types: `npm run gen:types` in `web/`.
- Add any new school-owned table or RPC to `supabase/tests/tenant_isolation.sql`.
  Run the full RLS suite when required by the change-specific release checks below.

## Verification and release checks
- Choose checks from the complete diff being released, not just the latest commit.
- Styling, layout, copy, navigation and client error-handling changes that preserve data access
  and permission rules require a passing production build of each affected app and relevant
  functional checks. They do not require a fresh `npm run test:rls` run.
- Changes to schema, migrations, RLS, storage permissions, views, RPCs, triggers, constraints,
  authentication, role checks, tenant selection or query scoping require the full
  `npm run test:rls` suite to pass before release. Extend the tests for changed access rules.
  A connection failure is not a passing result for these changes.
- Documentation-only changes need a diff review; builds and database tests are not required.
- For UI changes, check affected screens and interactions in the browser when access is available.
  If browser tooling is blocked, record the unverified screens in `docs/build-log.md` and report
  the limitation. This does not block a UI release whose required checks pass. Do not claim
  visual verification or mark a roadmap stage accepted without its actual acceptance checks.
- An unavailable check outside the change's scope (network, credentials or tool access) does not
  block otherwise authorised work or release. Record it and continue without asking for repeat
  approval. Actual test failures relevant to the change must be fixed; do not relabel them as
  infrastructure problems. These rules do not override platform permissions or security controls.

## Angular
- Standalone components, signals, typed reactive forms, lazy-loaded feature routes.
- Shared code (Supabase client, generated database types, auth session, domain models) lives in
  `web/projects/shared`. Apps never import from each other.
- Kebab-case filenames, PascalCase classes. Suffixes `*.component.ts`, `*.service.ts`, `*.model.ts`,
  `*.guard.ts`. No `Helper`, `Util`, `Manager`, `Data`, `Info`, `Common`, `Misc` names.

## Secrets
- Supabase anon key and URL live in `web/src/environments/`. They are public by design.
- The service role key, database password and any provider secrets are never committed. They live
  in the OS credential store (Supabase CLI) or hosting provider settings.

## Working style
- One roadmap stage at a time (`docs/roadmap.md`). Do not start the next stage until the current one
  meets the definition of done in the `skoolo` skill. Bugs in shipped work come before new work.
- Commit at the end of every working session and push to `origin/main`. This machine is temporary.
- When a requirement is ambiguous, state the assumption in one line and keep going.
- Append decisions and completed milestones to `docs/build-log.md`.
