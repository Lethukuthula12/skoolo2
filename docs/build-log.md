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

## 2026-10-23 — Stage 3 (part 1): report data model and write path

The secure foundation for term reports, following docs/report-card-spec.md.

- **achievement_level(mark)** and **achievement_description(level)**: the national 7-point scale,
  computed from the mark so nobody types a code.
- **academic_terms** (term dates for the report), **report_cards** (one per learner per term, with
  status draft → approved → published, days absent, teacher and principal comments) and
  **report_marks** (a mark per subject). `schools.stamp_url` for the report stamp.
- **Write path through functions only**, enforcing role and status: `ensure_term_reports` creates a
  class's draft reports and empty marks; `save_mark` and `set_report_meta` let a teacher of the
  class or an admin edit while draft; `approve_class_reports` and `publish_class_reports` are admin
  only, and publishing messages every connected parent. There are no write policies, so nothing
  bypasses these rules.
- **Read security** via `can_read_report`: a school's admins and a teacher of the class can read
  any status; a connected parent can read only once published.

Isolation suite now at 48 checks. New ones prove: the class teacher captures a mark; a teacher of
another class cannot read or write it; admin B sees nothing; a parent cannot see a draft; a teacher
cannot approve; after an admin approves and publishes, the connected parent can read the report and
its marks, and an unrelated parent still cannot.

Next in Stage 3: the mark-capture grid and approval in the portal, the report card PDF, delivery to
parents in the app, and the schedule export with pass/fail filters.

## 2026-10-23 — Stage 3 (part 2): the report screens

Portal **Reports** page (admins and teachers, for their classes): pick a class and term, create the
term's reports, and capture a mark per learner per subject in a grid, with days absent and a
teacher comment. Marks save as you type and show the national level. An admin approves (locking
the marks) and publishes (notifying connected parents). A per-learner **Report** button prints a
CAPS-style report card: school header and stamp, learner and term details, subjects with percentage,
level and description, attendance, comments, the level legend and signature lines. **Export
schedule** writes the class to Excel with marks, averages and a promotion outcome, filterable by
whether each learner meets the CAPS promotion guideline for the phase.

Parent app: each child on **My children** opens a reports page listing their published reports, each
expandable to the marks table, levels, comments and a level legend.

Verified end to end in the browser: as admin, created Grade 4 reports, captured marks (average 65.9,
outcome "Meets"), approved and published; as the connected parent, the published Term 1 report
appeared with its marks, while the report stayed invisible before publishing. The 48-check
isolation suite still passes.

Known small refinement: the parent report omits the class name because classes are staff-only under
RLS; school, term and marks all show. Stage 3 is built; the definition of done's last line is the
school capturing a real class's Term 4 marks.

## 2026-10-23 — Stage 4 (part 1): absences and messages backbone

Everything is keyed to a learner; who may see it is the school's admins, the teachers of the
learner's class, and the learner's connected parents (`can_access_learner`).

- **absence_reports**: a connected parent reports (dates, reason, optional note and a doctor's-note
  file in the private `absence-notes` bucket); the class teachers and admins are notified and can
  acknowledge, which messages the parent back. `report_absence` and `acknowledge_absence` enforce
  the roles.
- **message_threads / thread_messages**: two-way threads about a learner. `start_thread`,
  `post_message` and `message_class` (a private thread per learner in a class) are open to a staff
  member of the class or a connected parent; posting notifies the other side through the inbox.
- All reads gated by RLS to the people entitled to the learner; all writes go through the functions.

Isolation suite now at 60 checks. New ones prove: a connected parent reports an absence; an
unrelated parent cannot report or see it; the class teacher sees and acknowledges it while a teacher
of another class cannot; a teacher starts a thread, the connected parent reads and replies, and
neither an unrelated parent nor another school's admin can see it.

Next in Stage 4: the screens — report an absence and the message threads in the parent app, and the
absence queue, acknowledge, and messaging a parent or class in the portal.

## 2026-10-23 — Stage 4 (part 2): the message and absence screens

Shared `MessagingService` wraps the Stage 4 functions for both apps.

Parent app: each child on My children has **Reports**, **Messages** and **Report absence**. The
absence page takes dates, a reason, an optional note and a photo of a doctor's note, and shows past
reports with their status. The messages page is a per-child thread list with a conversation view and
a reply box, and a form to start a new message to the school.

Portal: an **Absences** page lists reported absences (pending first), opens any attached note, and
acknowledges with one click, which messages the parent. A **Messages** page lists conversations,
shows a thread with reply, and has "Message a class" that opens a private thread per family.

Verified end to end: as the parent, reported Ayanda's absence (10–12 Feb, Illness); as the admin,
it appeared in the Absences queue and was acknowledged; the parent's inbox received "Absence noted
for Ayanda Dlamini". That is Stage 4's definition of done. The thread path is covered by the
60-check isolation suite (teacher starts, parent reads and replies, others shut out).

## 2026-10-23 — Stage 5 (part 1): school fees backbone

Fees are administrators and parents only; teachers never see them, and nothing about fees blocks a
report card.

- **fee_structures**: an annual fee per grade per year, with an optional upfront discount and the
  number of months/terms for the plans. **learner_fee_accounts**: one per learner per year, with a
  chosen plan (monthly, term, year), the total due and a unique `FEE-` reference. **fee_payments**:
  each payment with method (EFT or cash), reference, date and a status of recorded → confirmed.
- **fee_account_balances** view (security_invoker): due minus confirmed payments, correct for the
  admin (school totals) and the parent (their child) without leaking.
- Write path through functions: `set_fee_structure`, `ensure_fee_account` and
  `ensure_fee_accounts_for_class` (total computed from the grade's fee and plan; the yearly plan
  applies the discount), `record_fee_payment` (the clerk) and `confirm_fee_payment` (the principal),
  which messages the parent the new balance.
- RLS: admins manage; a connected parent reads their child's account and payments; teachers and
  other schools see nothing.

Isolation suite now at 68 checks. New ones prove: a payment of R5 000 against a R12 000 account
leaves a R7 000 balance that the parent also sees; a teacher sees no fee accounts and cannot record
a payment; another school's admin and an unrelated parent see nothing.

Next in Stage 5: the screens — fee setup and payments in the portal (record, confirm, arrears
export), and the statement and balance in the parent app.

## Stage 5 screens — fee setup, payments, arrears, parent statement

The portal **Fees** page (admin only): a Fee setup tab to set each grade's annual fee and upfront
discount for a year, and an Accounts & payments tab to create accounts for a class on a plan, record
EFT or cash payments, confirm them, filter to accounts in arrears and export the arrears list to
Excel. The parent app gains a **Fees** button per child opening a statement: balance owing, the plan,
the bank details and unique reference to pay by EFT, and the payment history with each payment's
status. A parent reads the bank details through `fee_payment_instructions` (a SECURITY DEFINER RPC),
since the bank columns are otherwise admin-only.

Verified end to end against the pilot data: admin set the Grade 4 fee (R12 000, 5% upfront), created
two accounts, recorded and confirmed a R1 200 payment; the balance dropped to R10 800; the connected
parent's statement showed R10 800 owing, reference FEE-MAYW5J, the school's Capitec details and the
confirmed R1 200. Schema unchanged since the backbone's 68-check isolation pass, so this increment is
frontend plus the one read-only RPC.

## Stage 6 backbone — timetables and calendars with RLS

Three school-owned tables. **school_periods**: the school day as an ordered list of periods and
breaks, set by the admin. **timetable_lessons**: one class+subject taught by one teacher in one
(weekday, period) slot; two unique constraints make clashes impossible — a class holds one lesson
per slot, a teacher teaches one lesson per slot. **calendar_items**: a teacher's dated items (test,
assignment, outing, event), with the school derived from the owning staff member by a trigger that
also keeps any class/subject link inside that school.

Write path: teachers place and remove their own lessons through `place_lesson` (validates they teach
the class — class teacher below the subject-teaching grade, assigned subject teacher at and above it
— that the subject fits the grade, and that the period is not a break; the unique constraints refuse
a clash with a TEACHER_BUSY / CLASS_BUSY hint) and `remove_lesson`. `my_timetable(year)` returns the
signed-in teacher's week. Admins oversee the whole school's timetable directly.

RLS: admins manage everything; a teacher reads only their own lessons and keeps only their own
calendar items; another school and other teachers see nothing. Because the staff register is
admin-only, the teacher-ownership check is a SECURITY DEFINER helper (`is_my_staff_member`), not an
inline subquery a teacher could not run. Isolation suite now at 84 checks, proving a teacher cannot
place a lesson for a class they do not teach, a clash is refused, a break cannot hold a lesson, and
neither another teacher nor another school sees a lesson or calendar item.

Next in Stage 6: the screens — the admin day-structure setup, the teacher's weekly timetable grid
(place and remove lessons, print, export to .ics) and calendar, and the admin's per-teacher and
per-class timetable views.

## Stage 6 screens — timetable and calendar in the portal

One role-aware **Timetable** page. The admin gets three tabs: Day structure (add and remove the
day's periods and breaks), By class and By teacher (read-only week grids for oversight). A teacher
gets an Add-a-lesson form and their own week grid: they pick a day, a teaching period, one of their
classes and a subject, and place the lesson; each placed slot has a remove ×. The subject list
mirrors the server rule — below the school's subject-teaching grade the class teacher may place any
of the grade's subjects, at and above it only the subjects they are assigned — so the form never
offers a lesson the database would refuse. Buttons export the week to a phone calendar (.ics, weekly
recurring events) and print. A separate **Calendar** page lets a teacher add dated items (test,
assignment, outing, event) linked to a class and subject, and remove their own; the admin sees the
school's. Both are added to the portal nav for admins and teachers, and a SECURITY DEFINER
`my_staff_member` helper lets a teacher resolve their own staff id to add a calendar item without
reading the admin-only staff register.

Verified end to end on the pilot data as both roles: the admin set up a four-period day; the teacher
(Thandeka) placed a Mathematics lesson, was refused a clashing slot ("you already teach a lesson in
that slot"), placed a second lesson, exported a valid two-event .ics and removed a lesson; the
calendar accepted a test dated 12 Feb 2027; and the admin's By class and By teacher grids showed the
remaining lesson with the teacher and class names. Both apps build clean.

One fix made while building: the teacher's subject list first offered every grade subject whenever
they were the class teacher, but at a subject-teaching grade the server only allows assigned
subjects; the client now applies the same grade-threshold rule.

## Stage 7 backbone — assessment detail with weighted roll-up

Two school-owned tables with RLS. **assessments**: one piece of work for a class, subject and term
(test, assignment, project, exam, other) with a maximum score and a weight. **assessment_scores**:
a learner's score on an assessment, or absent. Skoolo computes the term mark as the weighted average,
as a percentage, of the assessments a learner actually sat — `computed_subject_term_mark` — and
`recompute_report_mark` writes it into the learner's draft Stage 3 report (creating the report and
mark row if needed, never touching an approved or published one). So the term mark is calculated from
captured assessments and flows into the existing approval and publishing unchanged.

Write path: `save_assessment`, `delete_assessment` and `save_assessment_score` (teachers of the class
and the school's admins only; a score over the maximum is refused; changing a weight or removing an
assessment recomputes every learner via `recalculate_subject_term`). Assessment detail is staff-only
— a teacher of the class or an admin — so parents never see raw scores, only the term mark through
the published report.

Policy: Grades R-3 are 100% school-based assessment; Grades 4-6 are 75% SBA and 25% end-of-year
examination (NPPPR 8(2)/15(2)). Here that split is expressed through the weights a teacher gives each
assessment (an exam weighted at a quarter of the total), which is how a term mark is computed by hand;
the policy will be shown as guidance in the screens. A structured per-phase weighting engine is a
later refinement, flagged in the migration.

Isolation suite now at 95 checks. New ones prove the definition of done — two weighted assessments
(15/20 and 40/50 at weights 1 and 3) produce a term mark of exactly 78.75 in the draft report — plus
that a teacher of another class, another school and a connected parent see no assessments or scores,
and that a score over the maximum is refused.

Next in Stage 7: the screens — a capture grid per class, subject and term (assessments as columns,
learners as rows), the live calculated term mark, and per-assessment and per-subject analysis,
exportable.

## Stage 7 screens — assessment capture grid and analysis export

An **Assessments** page in the portal, for teachers and admins. Pick a class, subject and term; add
assessments (each a title, kind, maximum and weight) shown as chips that select back into the form to
edit; capture a score per learner in a grid; the term mark column is the live weighted average with
its achievement level, computed exactly as the server does. A score over the maximum is refused both
in the grid and by the database. Export analysis writes an Excel workbook with three sheets: the
scores, per-assessment statistics (count, average, lowest and highest percent) and the per-subject
term-mark distribution by level.

Verified end to end as the admin on the pilot class: two weighted Mathematics assessments (15/20 at
weight 1 and 40/50 at weight 3) gave a live term mark of 78.75 (Level 6), a second learner 90
(Level 7), a score over the maximum was refused, and the analysis workbook exported with its three
sheets. The roll-up was confirmed on an unpublished term — capturing a Term 2 Mathematics score of 78
created a draft Term 2 report with that mark, editable — while the already-published Term 1 reports
stayed locked and untouched, which is the intended behaviour. Both apps build clean.

Stage 7 complete to the backbone-and-screens line; the live-on-a-phone and real-use steps of the
definition of done remain.

## Portal reskin, Phase 1 — design foundation

Began a visual refresh of the school portal, adapting a dashboard aesthetic (soft rounded cards,
Poppins, an indigo primary with a coral accent) rebuilt in our own tokens — not copied from any
template. All of it themes from the one central stylesheet (`school-portal/src/styles.scss`), so the
whole portal restyled at once: a Skoolo-tuned indigo brand (#3a41c4) with a coral accent (#fb7d5b),
deep-indigo headings (#303972), a faint-lavender background, 18px cards with a soft diffuse shadow,
and Poppins loaded from Google Fonts. The shared primitives were upgraded (rounder buttons with a
tinted shadow, a new .btn-accent and .badge-accent, a softer table treatment, and icon-ready stat
tiles that still stack correctly without an icon via :has()). Verified in the browser: Poppins
active, brand and active-nav pill indigo, cards at 18px, no console errors. Shell reskin, a new
dashboard home and parent-app alignment follow in later phases.

## Portal reskin, Phase 2 — the shell

Reskinned the portal shell. The sidebar is now a data-driven icon nav: each item has an inline line
icon (Feather, MIT) beside its label, the active item is a filled indigo pill with a soft shadow, and
hover is the soft-brand tint. Added a slim sticky top bar that carries the signed-in person (name,
role and an initials avatar) and the Sign out button, moved out of the sidebar. On a phone the sidebar
becomes a horizontal scrolling icon strip (icon over label, each item sized to its label so nothing
overlaps) and the top bar compacts. Verified at desktop and 375px with no console errors; a clean
production build. Next: a dashboard home (Phase 3) and parent-app alignment (Phase 4).

## Portal reskin, Phase 3 — admin dashboard home

Gave administrators a real landing page instead of dropping straight into Applications. The new
Dashboard (first item in the admin nav, home icon) shows four icon stat tiles — Learners, Staff,
Applications and money owed in fees — each a coloured chip linking to its section, and three widgets:
recent applications with status badges, learners in arrears with balances, and upcoming calendar
items. All of it reads from existing services (applications, learners, staff register, fee balances,
calendar), so no backend changed. The signed-in landing now routes admins to /dashboard; teachers are
still sent to their home by the admin guard. Verified with the pilot data (2 learners, 2 staff, 1
application, R22 800 owed) and a clean build.

## Portal reskin, Phase 2b — Akademi frame (dark sidebar + brand header)

Took the portal frame closer to the reference. A full-width brand-indigo header now spans the top,
carrying the Skoolo wordmark, the live page title (derived from the route) and the profile (name,
role, initials avatar and a translucent Sign out). Below it the sidebar is a dark navy panel with
light nav text, an indigo active pill and the icon nav. On a phone the header compacts (page title
hidden) and the sidebar becomes a dark horizontal icon strip; the stat tiles go single-column so
large values (fees owed) are never clipped. Also enlarged the stat-tile icon to a filled colour
circle with a white glyph (fixing the earlier value/label run-together). Verified desktop and mobile,
no console errors, clean build.

## Per-school theme customizer

Each school's admin can now theme their own portal, like a dashboard template's style picker, and
their staff see the result — self-service and multi-tenant. A floating settings gear (bottom-right,
spinning, admin-only) opens a "Pick your style" panel with swatches for the primary colour, the
header bar and the sidebar; picking previews live and Save persists it. The theme is stored in a new
jsonb `theme` column on the school row, so the existing RLS applies unchanged: an admin writes only
their own school's theme, staff read it, no school sees another's. A ThemeService applies the colours
as CSS variables on :root (deriving the brand shades, and flipping the sidebar text light or dark by
the sidebar's luminance so a white sidebar still reads), caches the last theme in localStorage to
avoid a flash on reload, and re-applies whenever the signed-in school changes. Dark/light background
mode is left as a later addition. Verified: live preview, Save, persistence across reload (from the
database and cache), reset to default, and the gear hidden from teachers; both apps build clean.

## Theme customizer — light/dark background mode

Added a Light/Dark background toggle to the per-school theme customizer. Dark mode darkens the content
area (background, cards, text, borders, shadows) via the ThemeService overriding the surface and text
tokens on :root and setting color-scheme:dark for native controls; light mode removes the overrides so
the stylesheet's defaults apply. To make it clean rather than patchy, the handful of hardcoded light
surfaces across the portal (inputs, outline buttons, chips, detail rows, sticky cells, the break
stripe, the customizer drawer) were tokenised onto --card or a new --surface-2. The mode is stored
with the rest of the theme on the school row, so the same RLS and per-school scoping apply. Verified:
toggling to dark restyles every page, Save persists it (dark survived a reload from the database), and
reset returns to the light default; both apps build clean. The pilot school is left on the light
default.

## Shell layout fix — full-height sidebar

The sidebar used position:sticky, which a browser clips on tall pages (e.g. Enrolment) once the page
scrolls — the dark panel ended partway down with empty space below and the nav scrolled oddly. Replaced
it with the standard dashboard frame: the shell is a fixed 100vh column, the header and sidebar stay
put, and only the content area scrolls. On phones it reverts to normal page flow (a fixed 100vh frame
fights the mobile URL bar). Verified on the tall Enrolment page (sidebar fills full height, header
fixed, content scrolls) and on mobile.

## Shared school calendar (replaces the teacher-only calendar)

Reworked the calendar into one shared school calendar, decided with the developer: any staff member
(admin, principal or teacher) adds events and all staff see them; connected parents see the ones
marked visible to parents. Data model: calendar_items gains created_by (+ denormalised created_by_name
so the author shows without reading profiles) and parent_visible; staff_member_id is now optional (an
admin has no staff row). New RLS: staff read and add the whole school calendar, the author or any admin
edits/deletes, and connected parents read parent-visible events for their child's school (via a new
parent_at_school helper). The fill trigger stamps the author and keeps class/subject links in-school.

Portal: the calendar page is now a month grid — click a day to open a panel with that day's events and
an add form (title, kind, time, optional class, "visible to parents", notes); events show as chips on
the grid with the author, and the author or an admin can edit/delete. Parent app: a "School calendar"
screen (reached from My children) lists upcoming parent-visible events grouped by date, with the school
name. Isolation suite updated to the shared model (now 98 checks): staff add/see all, an admin posts a
staff-only event, another teacher sees both, a connected parent sees the parent-visible one but not the
staff-only one, and another school and an unrelated parent see nothing. Verified end to end: added
events in the portal month grid; the connected parent saw the parent-visible ones. Both apps build clean.

## Daily attendance register

Added a daily attendance register — the class's own affirmative record of who was present, separate
from the parent-reported absences of Stage 4. One record per learner per day (present / absent / late)
in attendance_records, with school_id and the marker stamped by a trigger that also keeps the learner
inside the class. RLS reuses can_edit_class_reports, so the class's teachers and the school's admins
take and read the register and nobody else sees it (staff-only for now; parent-facing attendance
summaries are a sensible follow-up). Isolation suite now at 104 checks: the class teacher marks a
learner, a learner not in the class is refused, and a teacher of another class, another school and a
connected parent all see nothing.

Portal: an Attendance page (admin + teacher nav) with a class and date picker; every learner starts
present and the teacher flips the exceptions with present/absent/late segments; live counts, "mark all
present", save, and an Excel export of the day's register. Verified end to end: marked a learner absent
and another late, saved, and the register reloaded with the same marks. Builds clean.
