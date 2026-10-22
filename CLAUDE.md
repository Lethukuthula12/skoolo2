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
- Commit at the end of every working session and push to `origin/main`. This machine is temporary.
- When a requirement is ambiguous, state the assumption in one line and keep going.
- Append decisions and completed milestones to `docs/build-log.md`.
