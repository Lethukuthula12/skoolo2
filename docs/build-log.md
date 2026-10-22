# Skoolo — build log

Append-only. Newest at the bottom.

## 2026-10-21 — Day 1: foundation

- Repository created, decisions recorded in `docs/decisions.md`.
- Supabase project `chfebhulyqawuhjbmlhw` linked; schema, policies and seed written as migrations.
- Angular 20 workspace with `parent-app`, `school-portal` and `shared` library.

### Verified at end of day 1

- `supabase db push` applied both migrations to the remote project. Counts checked by query:
  21 schools, 15 grades, 10 grade intakes on the pilot's open 2027 period, 1 school open for
  registration, documents bucket present.
- `is_valid_sa_identity_number('8001015009087')` is true; the same number with the last digit
  changed is false.
- Anonymous REST calls: `school_directory` and `period_grade_availability` return rows;
  `school_bank_accounts` and `applications` return nothing. RLS behaves.
- `ng build parent-app` and `ng build school-portal` both compile with zero errors on Node 20.
- Not yet verified in a browser: the directory page rendering and sign-up. First thing on day 2.

### Decisions taken during the build

| Decision | Why |
|---|---|
| `@angular/build` and `ng-packagr` pinned to 20.x | The library generator pulled 21.x, which needs Node 22. |
| Shared library consumed from source via the `@skoolo/shared` path alias, not from `dist/` | No library build step during development. |
| Angular runs zoneless with signals | Smaller bundle, simpler change detection; supported in Angular 20. |
| Legacy anon JWT used as the public key rather than the new `sb_publishable_` key | Works with every Supabase client path today; swap later is a one-line change. |
| Applications are inserted as `submitted` directly (no draft status) | A place is held from the moment the form is complete, as decided; documents and payment follow on the same application row. |

### Open for tomorrow

- Pilot school's real town, contacts, fee, capacities and bank details (expected from the school).
- Supabase Auth: built-in email sending is rate-limited to a handful per hour, so sign-up
  confirmation emails need a custom SMTP provider (for example Resend's free tier) before parents
  use it. Alternative: disable email confirmation for the pilot via `supabase config push`.
- Hosting account for the two web apps (Vercel or Netlify, free tier, connected to GitHub).

## 2026-10-21 — Day 2: parent application flow

Built and verified in the browser against the live Supabase project, on a phone-sized viewport:

- Sign-up creates the auth user and profile; the guard returns the parent to the school they tapped.
- Three-step application: learner (grade dropdown from live availability, SA ID validated client
  and server side, date of birth and gender prefilled from the ID), address and optional transport
  question, review with POPIA consent. Submit created the learner and application, the trigger
  generated reference `ENR-E5D24T`, wrote the status history row, posted the "Application received"
  inbox message, and Grade 00 dropped from 20 to 19 places.
- Documents: three required uploads landed in the private bucket under the application's folder
  and were recorded; the Continue button unlocks only when all three exist.
- Payment: fee, reference and bank details from the `get_payment_instructions` RPC; "I have paid"
  moved the application to `marked_paid` and the page switched to the waiting state.
- My applications and Messages pages render the application and the trigger-written message.

### Decisions taken during the build

| Decision | Why |
|---|---|
| Email confirmation switched off for the pilot (`supabase config push`) | Supabase's built-in mailer is rate-limited to a few emails an hour, and sign-up had to work for the walkthrough. Revisit with a custom SMTP provider before public launch. |
| Password minimum raised to 8 | Matches the form's helper text. |
| Required documents: birth certificate, parent ID, proof of address. Latest report and immunisation card optional. | What the pilot school asks for at the gate today. The list is a constant in `models.ts`. |
| Documents are uploaded after the application row exists | The application id is the storage folder, which is what the RLS policies key on. |

### Testing note

The Ionic router keeps the previous page mounted for back navigation, so any browser automation
must scope selectors to the active page (`app-apply-page ion-button…`), or it hits hidden
elements on the page underneath.

### Test data in the live project

Parent `skoolo.pilot.parent1@outlook.com`, learner Sipho Pilot, application `ENR-E5D24T`. Delete
before the school's real parents start, or keep as the demo account.

### Open for day 3

School portal: staff sign-in, applications queue, application detail with documents, confirm
payment, change status, enrolment period and grade capacity settings, bank details.

## 2026-10-21 — Day 3: school portal

Built and verified in the browser, signed in as the pilot school's staff account:

- Staff sign-in, guard that requires a linked school, shell with navigation.
- Applications queue with counts (all, to review, payments to confirm, accepted, waitlisted),
  search, status and payment filters.
- Application detail: learner, parent contact (name, phone, email), address and transport, documents
  opened through 15-minute signed URLs (verified the staff storage policy serves the file), status
  history, confirm payment with an internal note, status changes with a message to the parent, and
  free-form messages to the parent.
- Confirming the test payment moved the application to Accepted and Payment confirmed, wrote the
  history row with the note, and the parent's inbox received both "Application accepted" and
  "Welcome to Newborn Christian School". Verified in the parent app and in the database.
- Enrolment settings: period list, period form (name, year, status, fee, dates, instructions), grade
  table with offered, open, capacity, places taken and places left.
- School profile and bank account forms.

### Capacity rule verified end to end

Set Grade 00 capacity to 1 in the portal (1 place already taken). The parent app's grade dropdown
showed "Grade 00 (Preschool) (full)" disabled, and a forced insert from the parent's session was
rejected by the database trigger with hint `GRADE_FULL`. Capacity restored to 20.

### Decisions and fixes

| Item | Detail |
|---|---|
| `profiles.email` added | Staff need to contact parents. Kept in step by auth triggers on insert and email change. |
| `school_application_counts` RPC | Server-side counts per status and payment state; the list page currently derives counts client-side and the RPC is there for the dashboard once volumes grow. |
| Portal forms bound to objects held in signals | Zoneless change detection does not re-render when a plain field is assigned after an `await`. The bank details form showed empty until the object was replaced through a signal. Pattern recorded in CLAUDE.md terms: anything loaded asynchronously and shown in a template lives in a signal. |
| Allowed status transitions duplicated in `badges.ts` | The database is the authority; the client copy only decides which options to show. |

### Test data in the live project

Staff account `skoolo.pilot.admin@outlook.com` (Nomsa Dlamini) linked to Newborn Christian School.

### Open for day 4

Deploy both apps (Vercel or Netlify from GitHub), PWA manifest and icons for the parent app,
production builds, and the real school details once they arrive.

## 2026-10-22 — Day 4: PWA and deployment readiness

- Parent app is a progressive web app: `@angular/pwa` service worker (production only,
  `registerWhenStable:30000`), branded manifest (`Skoolo`, standalone, en-ZA), eight maskable icons
  and a favicon rendered from the brand mark, Apple home-screen tags in `index.html`.
- Production builds pass for both apps. Parent app initial bundle 1.31 MB raw / 257 kB
  transferred; portal 488 kB / 124 kB. Budgets unchanged.
- Verified on a local static server of the production build: service worker reaches `activated`,
  `manifest.webmanifest` and `ngsw.json` served, deep links such as `/auth` return `index.html`,
  and the directory loads all 21 schools from Supabase.
- Hosting configuration committed: `vercel.json` (SPA rewrite, no-cache for service-worker files)
  and `_redirects` in each app's `public/` folder for Netlify. Step-by-step instructions in
  `docs/deploy.md`, including the Supabase redirect URL update after the first deploy.
- GitHub Actions workflow builds both apps on every push and pull request.

### Not done yet

- The actual deploy. It needs a Vercel or Netlify account connected to the GitHub repository; the
  two-project setup is in `docs/deploy.md` and takes about ten minutes in the Vercel UI.
- After the first deploy: set `site_url` and `additional_redirect_urls` in `supabase/config.toml`
  to the live URLs and run `npx supabase config push`.
- Real school details, fee, capacities and bank account, to be entered in the portal.

## 2026-10-22 — Day 5 (morning): the school's details and three requests from the admin

Details gathered at the school and entered directly in the live database (not in migrations):
display name Newborn Christian Primary School, tagline, Olakeni Area, Mbazwana, KwaZulu-Natal,
two phone numbers, legal entity Newborn Christian Academy (Pty) Ltd with company, NPO and tax
references, Capitec Business account, once-off enrolment fee R520, payment instructions allowing
cash at the office and two working days for confirmation. Grade structure 00, 0, RR, R, 1–7.
The 2027 period is **draft** because the school said enrolment is closed right now; the admin
opens it from Enrolment settings when ready. Capacities are blank until the admin sets them.

Built in response to what the admin asked for:

| Request | Built |
|---|---|
| Grade 0 as a level of its own | `G0` added between Grade 00 and Grade RR; grade order renumbered. |
| Parent info and ID on the application | Step 2 now opens with the applying parent or guardian: full name and phone prefilled from the account, relationship, ID or passport number (Luhn-checked when 13 digits). Stored per application and shown on the portal's application page. |
| Staff register with name, surname, class, ID, address, phone | `staff_members` table with RLS, and a Staff register page in the portal: list, search, add, edit, remove. Logins stay separate; this is the record of everyone who works at the school. |
| Legal identity of the school | `legal_name`, `company_registration`, `npo_registration`, `tax_reference`, `secondary_phone` on `schools`, editable under School profile. Second phone shows in the parent app. |

Verified in the browser: portal Staff register page and form; parent app step 2 with the new
fields and Grade 0 in the dropdown (period opened for two minutes, then set back to draft).

### Notes

- School fees (monthly, termly or yearly) are outside the pilot. Only the once-off enrolment fee
  is collected through the app.
- The dev server for the parent app served a stale bundle after a transient type error during
  type regeneration; a restart fixed it. If a change does not show up, restart `ng serve` before
  debugging the code.
- Still unconfirmed with the school: whether "Grade 0" is a level distinct from Grade R (built as
  distinct), and the exact account holder name on the Capitec account (entered as the legal name).

### Still to collect

Names, emails and cellphones of the principal, admin clerk and teachers who will sign in, so real
logins can replace the test staff account. The school badge image.

## 2026-10-22 — Day 5 (afternoon): self-service for schools

Prompted by the admin: nothing about a school's setup may depend on Skoolo's developer. Built and
verified end to end in the browser:

| Flow | How it works now |
|---|---|
| **Put a school on Skoolo** | `/register-school`: a principal creates a login and either claims an unclaimed school from the seeded directory or registers a new one. They become its first admin. The school is `is_claimed` but not `is_verified`; the portal shows a banner and parents cannot apply until Skoolo verifies it. Verification is one SQL update and is the only manual step left, by design. |
| **Staff logins** | Admin adds a person to the staff register, clicks *Create invite*, and gets an 8-character code plus a link and a WhatsApp share button. The person opens `/join?code=…`, creates a login with the invited email, and is linked to the school with the chosen role. No email sending, so the Supabase mailer limit does not apply. Codes expire after 14 days and are single-use; the email must match. |
| **Roles** | `admin` (principal, clerk): everything. `staff` (teachers): applications read-only. Enforced in RLS and in the payment and status RPCs; the portal hides what the role cannot do. |
| **Badge** | Upload on School profile into the public `school-badges` bucket; the parent app shows it immediately. |
| **Staff documents** | Per staff member: ID copy, qualifications, contract, police clearance, SACE, CV. Private `staff-documents` bucket, admins only, opened through signed links. |
| **Access list** | Who can sign in, with role, and remove access. Open invites with copy and cancel. |

Verified: admin created a staff record and invite; a new teacher redeemed the code and landed in the
portal seeing only Applications; a new principal registered "Skoolo Test Academy" and saw the
verification banner and full admin navigation; badge upload served publicly. All test rows,
files and users removed afterwards.

### Fix found during testing

`loadSchools` read every `school_staff` row the policy allowed, which for a teacher includes
colleagues' rows, so a teacher briefly appeared to be an admin. It now filters to the signed-in
user. Logic that decides permissions must never rely on RLS alone to narrow a result set.

### Operating note for Skoolo

To verify a newly registered school after checking it is real:

```sql
update public.schools set is_verified = true where slug = '<school-slug>';
```

## 2026-10-22 — Deployed

Both apps are live on Cloudflare Workers with static assets, deploying from `main` on every push:

- Parent app: <https://skoolo-app.lethufzikhali.workers.dev>
- School portal: <https://skoolo-schools.lethufzikhali.workers.dev>

Verified from outside: both serve the app, deep links such as `/auth` and `/sign-in` return the
app, the manifest and `ngsw.json` are served with `no-cache`. Supabase `site_url` and
`additional_redirect_urls` now point at the live addresses (plus localhost for development).

What it took to get there, for the next time:

- Cloudflare's "Create" flow now makes a **Worker** by default, not a Pages project. The repo
  carries `wrangler.jsonc` (parent app) and `wrangler.portal.jsonc` (portal) so the default deploy
  command works.
- Root `package.json` scripts install the web dependencies before building, so no root directory
  setting is needed on the host.
- Current Wrangler needs Node 22; `.node-version` pins it. Angular 20 is fine on 22.
- Workers' `single-page-application` handling replaces `_redirects`; a catch-all `_redirects`
  file is rejected as a redirect loop.

## 2026-10-22 — Stage 0: automated cross-school isolation tests

`npm run test:rls` (`scripts/test-rls.mjs` → `supabase/tests/tenant_isolation.sql`) builds two
schools against the linked project, each with an admin, a teacher and a parent with a learner and
an application, acting as the `authenticated` role with per-user JWT claims so RLS and the
SECURITY DEFINER functions run exactly as for a real request. It asserts 20 checks and rolls
everything back by raising a sentinel exception at the end.

Checks: admin B cannot read A's applications, learners, documents, staff register, invites or bank
account, nor update A's application nor confirm its payment; parent B cannot see parent A's
learner; teacher A can read the school's applications but cannot confirm payment or change status;
a full grade rejects a second application (`GRADE_FULL`); an illegal status transition is rejected
(`INVALID_TRANSITION`); an invite is refused for the wrong email, accepted once, then refused as
used, and an expired invite is refused; admin A and parent A can read their own applications.

Verified three ways: it passes clean (20/20); re-running leaves no rows (`Isolation School%`
schools and `%@test.skoolo` users both 0), confirming the rollback; and it bites — weakening the
`staff see school applications` policy to `using (true)`, inside a rolled-back transaction, flips
exactly the "admin B sees A's applications" check to failure while leaving the live policy intact.

How it works, for the next person: the whole test is one `DO` block. It seeds `auth.users` as the
privileged role first (the trigger creates profiles), then `set local role authenticated` once and
switches user with `set_config('request.jwt.claims', …, true)` per step. `supabase db query -f`
runs the file as one transaction; the closing `RAISE` both reports the result and rolls back.

Not done in Stage 0 yet: password reset (blocked on a domain and an email provider), running this
test in CI (needs Supabase secrets in GitHub Actions), and the phone testing and loose ends.

## 2026-10-22 — Enrolment restricted to administrators; two standing rules

Migration `20261022000500_enrolment_is_admin_only.sql` moves every application-adjacent read from
`is_school_staff` to `is_school_admin`: applications, status history, documents, applicant
profiles and learners, staff-sent messages, and the application-files storage policy. Teachers
(role `staff`) now have no enrolment access. The portal guards the applications routes with a new
`adminGuard` and lands teachers on a placeholder `HomePage`; the Applications nav item is
admin-only. Verified: admin still sees the applications queue and full nav; a teacher lands on
Home. The isolation test was flipped accordingly and now asserts a teacher sees zero applications
and zero applicant learners; it passes at 21 checks.

Two rules added to the skill and CLAUDE.md (decisions 28-30):
1. Never build on a school's data. The admin captures and edits every school-specific detail;
   our questions are to understand the system, never to seed or hardcode their data.
2. Least privilege, and surface decisions. A role sees only what its job needs; teachers have no
   enrolment access. Unspecified product behaviour is asked or flagged, never invented and buried.

Roadmap pruned of questions that only ask the school for their own data.

## 2026-10-22 — Hardening tenant and role separation

Audited the live database: all 15 public tables have RLS enabled with policies, all 18 SECURITY
DEFINER functions pin `search_path`, both views are `security_invoker`. Two gaps closed by
migration `20261022000600_tighten_separation.sql`:

- `school_application_counts` moved from `is_school_staff` to `is_school_admin`, so a teacher
  cannot pull even aggregate application counts.
- Grade availability counted applications under the caller's own row security, so anonymous
  visitors saw every grade as available and parents saw wrong counts. The count now comes from a
  SECURITY DEFINER function `period_grade_taken` that returns only a number, so availability is
  accurate and identical for everyone and never leaks a row. Verified: an anonymous REST call now
  reports the true places taken.

Added a regression guard, `supabase/tests/rls_coverage.sql`, run by `npm run test:rls`: it fails
if any public base table has RLS disabled, any SECURITY DEFINER function lacks a pinned
search_path, or any public view is not security_invoker. Proven to bite: disabling RLS on a table
inside a rolled-back transaction fails the guard, and RLS is restored by the rollback.

So the guarantee against a separation regression is now two tests that must pass before release:
one proves isolation on real data, the other proves the catalog shape that makes isolation
possible. A new table that forgets RLS, or a view that forgets security_invoker, fails the build.

## 2026-10-22 — Grade range confirmed to Grade 12

Checked in response to "add classes to Grade 12 for a big school": the `grades` lookup already
holds G00, G0, GRR, GR and G1–G12, and no code caps the range. Enrolment settings shows every
grade within a school's own lowest–highest range (`highest ?? 99`), and the school profile grade
dropdowns list all grades, so a high school sets its highest grade to Grade 12 and opens Grades
8–12 with no change. Nothing added. Recorded the one real gap for high schools in
`docs/report-card-spec.md`: FET (Grades 10–12) subject sets and NSC promotion rules are not yet
specified and are only needed when a high school captures marks (Stages 3 and 7).

## 2026-10-22 — Stage 0: password reset flow

Built the forgot-password / reset-password flow on both apps. `AuthService` gained
`requestPasswordReset` (sends `resetPasswordForEmail` with a redirect to `/reset-password`),
`updatePassword`, and an `isPasswordRecovery` signal set from the `PASSWORD_RECOVERY` auth event.
The portal and the parent app each have a request page (email in, neutral "check your email"
confirmation that does not reveal whether the address exists) and a reset page that accepts a new
password while a recovery session is present, then signs out and sends the user to sign in. A
"Forgot password?" link sits on both sign-in screens. Supabase `additional_redirect_urls` widened
to wildcard paths under the live and local origins and pushed.

Verified the mechanic end to end against the auth API without relying on email: signed in as the
test admin, changed the password, signed in with the new password, changed it back, signed in
again; the `recover` request returns 200 (accepted). Both apps build; both pages render in the
portal.

**Pending (blocked on a domain):** the reset email only delivers once a domain and an email
provider (Resend free tier) are wired into Supabase SMTP. Until then the flow is complete but the
link does not arrive. Re-enabling sign-up confirmation waits on the same email setup.

## 2026-10-22 — Demo accounts and the teacher's place in the portal

Kept demo data for testing rather than deleting it, and documented the logins in
`docs/demo-accounts.md`: a parent (with a completed application), an administrator, and a new
teacher account (`skoolo.pilot.teacher@outlook.com`) linked to Newborn as `staff`.

Confirmed the teacher's experience answers "what happens to the teacher": teachers and admins share
the one school portal; a teacher signs in and lands on the Home placeholder with only a Home nav
item and no enrolment access (verified: `isAdmin` false, nav `['Home']`). There is no separate
teacher app; their tools (class register, marks, timetable, messages) appear in the portal as
later stages land. The demo accounts are disposable and must be removed before real users.

## 2026-10-23 — Stage 1 (part 1): the register data model

The secure foundation for learners, classes and subjects, set up by the school's admin. Two
migrations:

- **subjects** per school and grade (with a language level for languages); **classes** per year
  and grade with a class teacher; **class_subject_teachers** for the subject-teaching grades;
  **learner_guardians** for a learner's contacts. The **learners** table now doubles as the
  school register: `parent_id` is nullable, `school_id`, `current_class_id`, `admission_number`
  and `years_in_phase` added, the identity rule relaxed from "exactly one" to "not both" so young
  learners without an ID can be imported, and `learners_has_owner` keeps every learner tied to a
  parent or a school.
- **Teaching model as a school setting:** `schools.subject_teaching_from_grade` (default Grade 4).
  Below it one class teacher; at and above it, subject teachers via `class_subject_teachers`.
- **Row security:** admins manage their school's subjects, classes, assignments, register learners
  and guardians; any staff may read the class and subject lists; a teacher sees a register learner
  only through `teaches_class` (class teacher or subject teacher of that learner's class); parents
  keep access to their own learners and guardians. Helpers `class_school_id`, `learner_school_id`,
  `learner_parent_id`, `teaches_class`, all SECURITY DEFINER with pinned search_path.
- **seed_default_subjects(school)**: offers the CAPS subjects for each grade in the school's range
  (admin-only, idempotent); the admin edits them after. FET grades 10–12 are left for the admin.
- **enrol_application(application, class)**: places an accepted applicant's learner into the
  register and a class and marks the application accepted.

Tests: `npm run test:rls` now at 28 isolation checks plus the coverage guard. New checks prove a
second school's admin sees none of school A's classes, subjects, register learners or guardians;
the class teacher sees a learner in their class; a teacher of a different class in the same school
does not; and a teacher of another school sees no register learners.

Next in Stage 1: the admin screens (subjects setup, classes and teacher assignment, learner import
from Excel, learner CRUD, class-list export) and the teacher's class view.

## 2026-10-23 — Stage 1 (part 2): the admin screens

Two portal pages, administrators only.

- **Classes and subjects** (`/classes`): a Subjects tab with "Add CAPS defaults" (calls
  `seed_default_subjects`) and per-grade add/edit/delete; a Classes tab to create classes for a
  chosen year with a class teacher, and, for the subject-teaching grades, assign a teacher to each
  subject. Verified: seeding added 51 CAPS subjects across Grades 00–7; a Grade 4 class was created,
  recognised as subject-teaching, and a subject teacher assigned.
- **Learners** (`/learners`): pick a class to see its roster, add and edit learners with guardians,
  move a learner between classes, and import a class from Excel or CSV with a validated preview
  (missing names, invalid ID numbers and dual ID/passport are flagged before import). Export the
  roster to Excel and print a class list. Verified: a learner was added, a CSV of four imported two
  and rejected the bad rows.

Dependency: `xlsx` (SheetJS 0.18.5) for reading and writing Excel, allowed as a CommonJS dependency
in the portal build.

Bug found and fixed in testing: Excel/CSV auto-parsing read `12/04/2015` as US month-first and
shifted the timezone, turning 12 April into December. CSV files are now parsed directly so dates
stay day-first (South African), and Excel date cells are formatted from local parts. Re-verified:
`12/04/2015` now reads as 2015-04-12.

Test artifacts (a sample class, subjects and learners) were removed from the pilot school afterward,
so its register starts clean for the real admin. The enrolment application is untouched.

Still in Stage 1: the teacher's own class view, replacing today's Home placeholder, so a teacher
sees the classes they teach and their learners.

## 2026-10-23 — Stage 1 (part 3): the teacher's class view

A teacher cannot read the staff register, so `public.my_classes()` (SECURITY DEFINER, filtered to
`auth.uid()`) returns the classes they teach, as class teacher or subject teacher, with nothing
from any other user or school. The portal Home page became the teacher's dashboard: it lists their
classes with a class-teacher / subject-teacher badge and learner count, and opening a class shows a
read-only roster (name, date of birth, age, gender). Guardians stay admin-only.

Verified end to end: signed in as the teacher, Home showed their Grade 4 A class flagged as class
teacher with 2 learners, the roster listed them, and the nav held only Home. The isolation test
grew to 31 checks, including that `my_classes()` returns the class teacher's own class, nothing for
a teacher with no class, and none of another school's classes.

A small demo was kept so the teacher login shows something: a Grade 4 A class at the pilot school
with the teacher assigned and two learners. Remove it before real use if preferred.

Stage 1 is built and verified across admin and teacher roles. It meets the definition of done
except the last line, a real person using it: the admin importing the school's actual learners.

## 2026-10-23 — Stage 2: connecting parents to their children (screens)

Parent app: a **My children** page (reached from the directory header, the account page, and
`/children`) lists the parent's connected children with school, grade and class, and a **Connect a
child** form to redeem a family code with an optional relationship. `ApplicationService.myChildren`
and `redeemFamilyCode` call the Stage 2 functions.

Portal: the **Learners** page now has a **Family codes** button (generates a code for every learner
in the class), and each row shows the code, a **Share** button that opens a prefilled WhatsApp
message with the code and the parent-app link, and how many parent accounts are connected.

Verified end to end in the browser: as admin, generated codes for the demo class; as the parent,
redeemed one and the child (Ayanda, Newborn, Grade 4 A) appeared under My children alongside the
parent's applicant child (Sipho). The database shows the guardian link with the parent's account
and relationship. Applicant parents are connected automatically through the learner's parent_id, so
they need no code.

Isolation suite stands at 38 checks (the Stage 2 backbone commit). Stage 2 meets the definition of
done except the last line: ten real families connected, which is for the school to do.
