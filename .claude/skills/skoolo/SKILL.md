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
2. `docs/roadmap.md` — the stages, their order, which one is current, and what "done" means for each.
3. `docs/build-log.md` — what exists, what was verified, what is still open.
4. `CLAUDE.md` — standing engineering rules.

## How we work: one stage at a time

The school's wish list is long and every item is reasonable. We still build exactly one stage of
`docs/roadmap.md` at a time, and we only start the next when the current one is done. Bugs in
something already shipped come before any new work. A half-finished feature at a school is worse
than a missing one: staff lose trust in the whole system.

**Before building a stage**

- The stage's "done when" line in the roadmap is agreed with the school, in plain words about what
  a person can do.
- Its open questions in the roadmap are answered, or the assumption is written next to them.
- Mark it **In progress** in the roadmap status table.

**Definition of done.** A stage is done only when every line holds:

1. **Data is the school's.** Every new table has `school_id`, RLS, and policies in the same
   migration. Storage paths start with the school id.
2. **Automated proof.** The new tables and RPCs are added to the cross-school database test
   script, and the whole script passes: a second school cannot read or change any of it, and each
   role can do exactly what it should and nothing more.
3. **Walked through by hand** in the browser as every affected role (admin, staff, parent),
   including at least one failure path, at phone width (375 px, no sideways scroll) and desktop.
4. **Deployed and checked live** on the real addresses, on a real phone.
5. **Used at the school.** A real person did the real task with it. Their feedback is fixed or
   written into the roadmap.
6. **Written down.** `docs/build-log.md` entry with what was verified, roadmap status set to
   **Done**, decisions added to `docs/decisions.md`, and "What exists" below updated.

If a stage turns out too big to finish in about a week, split it in the roadmap rather than ship
half of it.

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
   the minimum, keep sensitive documents private and admin-only. Schools teach in two ways:
   one class teacher for everything in the younger grades, subject teachers in the older ones.
   Where the line falls is a school setting (Grade 4 at the pilot school), never a constant.
   Report cards follow the National Protocol for Assessment and the NPPPR
   (`docs/report-card-spec.md`), and a report is never withheld for any reason, unpaid fees
   included.

7. **Boring and working beats clever.** Solo developer, pilot already live. Prefer a migration
   and a plain Angular page over a new abstraction. No feature flags, no "for later" scaffolding.

8. **Never build on a school's data.** Each school's admin captures and edits every
   school-specific detail in the system: profile, badge, bank account, grades, classes, subjects,
   learners, fees, staff. Questions we ask a school are to understand the system we are building,
   never to seed, hardcode or special-case their data. The pilot school's details were a one-time
   bootstrap and its admin owns them now.

9. **Least privilege, and surface decisions.** A role sees only what its job needs. Teachers have
   no enrolment access at all: applications, applicants, their documents and the payment queue are
   administrators only. When who-sees-what or any product behaviour is unspecified, ask or flag it
   in one line; never invent an access rule or a product decision and bury it in code.

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
  applications queue and detail (administrators only; teachers land on a placeholder home),
  confirm payment (sends welcome message), status changes with messages, enrolment periods and
  per-grade capacity, school profile with badge and legal details,
  bank account, staff register with documents, invites and access list, role-based navigation,
  verification banner.
- **Database**: migrations under `supabase/migrations/`, every rule above, buckets
  `application-documents` (private), `staff-documents` (private), `school-badges` (public).
- **Hosting**: Cloudflare Workers with static assets, redeploying from `main` on every push.
  Parent app <https://app.skoolo.co.za>, portal <https://schools.skoolo.co.za>.
  The owner confirmed both custom addresses load; the original Workers addresses remain enabled.
  See `docs/deploy.md`.
- **Tests**: `npm run test:rls` runs two files against the linked project and rolls back.
  `tenant_isolation.sql` builds two schools and proves cross-school isolation and role enforcement
  (112 checks). `rls_coverage.sql` fails if any public table loses RLS, any SECURITY DEFINER
  function loses its pinned search_path, or any view stops being security_invoker. Extend the
  isolation test with every new school-owned table or RPC; the coverage guard catches the rest.
- **Authentication email**: Resend has verified `auth.skoolo.co.za`; the owner configured custom
  SMTP and the custom-domain auth URLs in Supabase, then confirmed both apps' reset email,
  same-app return, password change and subsequent sign-in flows. Email confirmation is enabled;
  the owner also confirmed the new parent signup/email-confirmation flow worked. Portal school
  registration reached the signed-in details form and saved a school/admin membership; workspace
  navigation then failed on a lazy module. The owner confirmed the workspace opens in a new tab.
  Recovery is implemented but its new panel still needs a live check.
  Staff joining, reused/expired links and mobile/cross-browser checks remain open. SMTP credentials
  are stored in Supabase, never in the repo.
- **Not yet**: CI wiring for the RLS test; remaining authentication rollout checks above.

## Routine operations

- Verify a school after checking it is real:
  `update public.schools set is_verified = true where slug = '<slug>';`
- Regenerate types after a migration: `npm run gen:types` in `web/`.
- Run ad-hoc SQL: `npx supabase db query --linked "<sql>"` (one statement per call).
- Run the isolation tests: `npm run test:rls`.
- If a change does not appear in the browser, restart `ng serve` before debugging the code.

## What comes next

The order is in `docs/roadmap.md` and is not re-decided at the start of each session. In short:
Stage 0 makes what exists solid, then learners, classes and subjects, connecting parents, term
reports generated from marks, home-school messages, school fees, teacher timetables and calendars,
and assessment detail.

Outside the roadmap for now: a Skoolo super-admin screen for verifying schools (one SQL statement
until then), card or instant EFT payments, app store builds.
