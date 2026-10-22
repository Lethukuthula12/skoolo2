---
name: skoolo
description: Ground rules for building Skoolo, the multi-tenant enrolment platform for South African private schools. Use at the start of any Skoolo work session, before designing a feature, adding a table, or changing who can do what.
---

# Skoolo — how we build

Skoolo is **one platform for every private school in South Africa**. Newborn Christian Primary
School is the first tenant, not the product. Every decision is made as if a hundred schools were
already using it, because the whole point is that they will.

Read these before building, in this order:

1. `docs/decisions.md` — what was agreed and why. The source of truth for scope.
2. `docs/build-log.md` — what exists, what was verified, what is still open.
3. `CLAUDE.md` — standing engineering rules.

## The principles

1. **Multi-tenant by default.** Every row that belongs to a school carries `school_id`. Row-level
   security scopes every read and write to the caller's schools. There is no "the school" in code,
   only "the current school". No per-school branches, forks or special cases in business logic.
   What differs between schools is data: profile, badge, fee, grades, capacities, staff.

2. **Self-service, never the developer.** A principal puts their school on Skoolo themselves
   (`/register-school`, claim or create). The admin invites staff with a code, uploads the badge,
   sets the fee, opens enrolment, decides grades and capacities, keeps the staff register and its
   documents. If a feature needs a developer to run SQL for each school, it is not finished.
   The one deliberate exception is **verifying** a newly registered school, which Skoolo does
   once per school because it protects parents from paying a fake school.

3. **Rules live in the database.** Grade capacity, one application per learner per school per
   year, allowed status transitions, who may confirm a payment or change a status, who may see a
   document: all enforced in PostgreSQL (constraints, triggers, `security definer` functions,
   RLS). The client reflects the rules; it never is the rule. Logic that decides permissions must
   never rely on RLS alone to narrow a result set; filter explicitly for the signed-in user.

4. **Roles are data-driven.** `admin` (principal, clerk) changes things; `staff` (teachers) reads.
   Check `is_school_admin()` / `is_school_staff()` in SQL and `staff.isAdmin()` in the portal.
   Never hard-code a person, an email or a school id in application code.

5. **The parent only ever pays the school.** Bank details belong to the school, the reference is
   unique per application, Skoolo never holds money.

6. **South African context first.** CAPS grades (00, 0, RR, R, 1–12), ZAR, SA ID numbers with
   Luhn checks and a passport fallback, POPIA: say why each personal field is collected, collect
   the minimum, keep sensitive documents private and admin-only.

7. **Boring and working beats clever.** Solo developer, pilot already live. Prefer a migration
   and a plain Angular page over a new abstraction. No feature flags, no "for later" scaffolding.

## Before you add anything, ask

- Which school owns this data? Where is `school_id` and the RLS policy?
- Can the school's own admin do this without Skoolo? If not, what would make it so?
- Is the rule enforced in the database, or only drawn in the UI?
- Does it work for a school with 30 learners and one with 3 000? For a school in Mbazwana on a
  phone and one in Sandton on a laptop?
- Will a second school's data ever be visible through this query, view, bucket path or RPC?

## What exists (keep this list honest)

- **Parent app** (Ionic, PWA): directory and search, school panel, sign-up, three-step
  application with guardian details and live grade availability, documents, EFT payment screen
  with unique reference, mark paid, My applications, inbox.
- **School portal** (Angular): sign-in, join by invite code, register or claim a school,
  applications queue and detail, confirm payment (sends welcome message), status changes with
  messages, enrolment periods and per-grade capacity, school profile with badge and legal details,
  bank account, staff register with documents, invites and access list, role-based navigation,
  verification banner.
- **Database**: migrations under `supabase/migrations/`, every rule above, buckets
  `application-documents` (private), `staff-documents` (private), `school-badges` (public).

## Routine operations

- Verify a school after checking it is real:
  `update public.schools set is_verified = true where slug = '<slug>';`
- Regenerate types after a migration: `npm run gen:types` in `web/`.
- Run ad-hoc SQL: `npx supabase db query --linked "<sql>"` (one statement per call).
- If a change does not appear in the browser, restart `ng serve` before debugging the code.

## Still manual or missing (candidates for next work)

- A Skoolo super-admin screen for verifying schools and seeing all tenants.
- Email delivery through a real SMTP provider before public launch (sign-up confirmation is
  currently off for the pilot).
- Card or instant EFT payments through a provider, still paying the school directly.
- School fees beyond the once-off enrolment fee are out of scope.
