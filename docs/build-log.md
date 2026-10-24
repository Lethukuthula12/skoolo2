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

## Notice board

Added school-wide announcements, separate from the one-to-one messages of Stage 4. A notices table
holds a title, body, audience ('all' / 'staff' / 'parents') and a pinned flag, with the author stamped
by a trigger. RLS: the school's admins post and manage notices; staff read the everyone/staff ones;
connected parents read the everyone/parents ones (reusing the parent_at_school helper). Isolation suite
now at 111 checks — an admin posts, a teacher sees the everyone and staff notices but cannot post, a
connected parent sees the everyone notice but not the staff-only one, and another school and an
unrelated parent see nothing.

Portal: a Notices page (admin + teacher nav). Admins get a post/edit form (title, body, audience, pin);
everyone sees the list, pinned first, with the author and date; admins can pin/unpin, edit and delete.
Parent app: a Notices screen (reached from My children) listing the school's parent-facing notices,
pinned first. Verified: posted a pinned "everyone" notice in the portal and it appeared; the parent
read path is proven by the isolation suite and the page builds clean (a live parent screenshot was
blocked by a preview auth-guard timing quirk, not a code issue). Both apps build clean.

## Parent attendance view

Closed the attendance loop to families: a connected parent can now read their own child's daily
attendance (read-only; staff still own the register). Added an is_my_child helper and a single RLS
select policy on attendance_records for the learner's parent or linked guardian; the staff-only write
path is unchanged. Isolation suite now at 112 checks — the connected parent reads their child's record,
and an unrelated parent cannot. Parent app: a per-child Attendance screen (reached from My children)
showing the attendance rate, present/late/absent totals and the recent days with status badges.
Verified end to end: a learner marked absent in the portal register showed in the parent's summary
(0% rate, 1 absent, the right date). Both apps build clean.

## Parent app: land on the children, and match the portal styling

Two parent-app improvements. (1) A signed-in parent now lands on their own children and actions, not
the public school directory: a parentHomeGuard redirects a signed-in visitor from the directory to
/children, the children page became the home (account, inbox, notices and calendar in the header,
plus a "Find a school to apply" link), and the directory stays reachable at /schools for applying to
another school. (2) The parent app's theme now matches the portal — Poppins, the indigo primary
(#3a41c4) with a coral secondary, the lavender background and deep-indigo headings, and the softer
18px cards — by aligning the Ionic variables and loading Poppins. Verified: a signed-in parent is
redirected to My children in Poppins/indigo, and /schools still lists schools without a redirect loop.
Both apps build clean.

## Parent app: wear the school's brand, and richer child cards

Two parent-app improvements answering the developer's feedback. (1) A school that customises its portal
theme now also recolours its parents' app: a SchoolThemeService reads the parent's school primary colour
(ApplicationService.mySchoolTheme, from the school row the parent can already read) and applies it to the
app's Ionic --ion-color-primary with computed shade/tint, cached to avoid a flash. If a parent has
children at more than one school it uses the first; light/dark and header/sidebar don't map to the mobile
app, so only the brand colour carries across. (2) Each child card on the home now shows at-a-glance
details — an attendance percentage and the fees owed (or "Fees up to date") — from a lightweight
childSummary (fee balance + attendance counts), on top of the existing actions. Verified: with the pilot
school's theme set to coral, the parent app rendered coral throughout, and Ayanda's card showed "0%
present" and "R 10 800 owing" (matching the register and fee balance). Builds clean.

## 2026-10-23 — Parent app design pass

User chose the parent app as the starting point for the design rework, using the supplied Akademi
and EduDash references for hierarchy, spacing and component treatment. This pass keeps the existing
parent workflows and adapts the visual direction to a phone interface.

- Added persistent Home / Applications / Inbox / Account navigation, with safe-area spacing and an
  active state. Password recovery keeps its focused layout.
- Rebuilt the family home with a greeting, calendar and noticeboard shortcuts, clearer child cards,
  attendance and fee summaries, grouped Reports / Messages actions, and a report-absence link.
  A reusable child-card component keeps the repeated card markup and styles together. A compact
  section previews real school notices and upcoming dates; loading, empty and failed requests have
  distinct states. Family-code entry is expandable.
- Added a shared light page foundation: white headers, muted page backgrounds, consistent typography,
  restrained borders, form spacing and button treatments. Refined account/sign-in, school directory,
  application cards, inbox and calendar. Moved directory status badges under the school name to leave
  room for long names on phones. Fee banking details now wrap in a two-column grid.
- Preserved school accent colours with calculated contrasting button text and readable link colours.
  A late theme request cannot restore the previous school's colour after sign-out. Connecting a child
  refreshes branding. Removed the viewport restriction that prevented browser zoom.
- Corrected the applications empty-state school-directory link; refreshed home, applications and
  inbox when Ionic re-enters a retained page. Summary query errors are propagated instead of appearing
  as missing attendance or fee records. Sign-up confirmation feedback remains visible after switching
  back to the sign-in form. No schema or access-rule changes.

Verification: final `npm run build:parent` passed in production mode without warnings (network access
was needed for the existing Google Fonts import). A temporary Angular-injection harness exercised the
actual SchoolThemeService: seven accent colours meet 4.5:1 button contrast and 5:1 link contrast; invalid
colours fall back correctly; a delayed request cannot undo sign-out reset. `git diff --check` passed.
The first `npm run test:rls` run passed all 112 tenant-isolation checks, then the coverage guard failed
to connect with `DbConfigLoginRoleNetworkError / TransportError`. A retry also failed at connection.

Not released: CLAUDE.md requires a passing full RLS suite before release. The source is saved locally;
push to main (which triggers deployment) is held until the required test can complete. Browser access
to the local preview was denied by this session's origin policy, so rendered phone/desktop layouts,
navigation, touch interactions and live deployment are not yet visually verified. No claim of visual
parity or real-device acceptance is made for this pass.

## 2026-10-23 — Scope release checks to the changes

At the user's request, replaced the blanket RLS-before-every-release rule in CLAUDE.md with explicit
checks for UI maintenance, database/access-control work and documentation. Updated the matching
roadmap wording and recorded the decision. Unavailable checks outside the change's scope are
reported rather than blocking authorised work; required checks and relevant assertion failures still
block release. Browser/tool permission restrictions remain in force.

This supersedes the release hold recorded for the parent design pass above: its complete source diff
changes presentation, navigation and client error handling, not queries, database schema or access
rules. The final production build and theme checks already passed; no application source changed in
this documentation update, so those checks need not be repeated. The Supabase coverage connection
error and pending visual verification remain recorded limitations, not passing checks.

## 2026-10-23 — Push each completed change

In response to the production-push approval question, the user instructed that every change must
be pushed. Updated CLAUDE.md and the decisions log to require committing and pushing each completed
logical change, with standing approval for the configured deployment. This authorises publishing
the saved parent redesign and release-rule changes after disclosure of the outstanding visual
verification and Supabase coverage connection error. The previously recorded successful production
build remains applicable; this turn changes documentation only.

## 2026-10-23 — Portal navigation and visual foundation

- Replaced the flat navigation with expandable school-work sections, preserving the existing admin
  and teacher link sets. Added a mobile navigation drawer, account menu, and calendar/notices shortcuts.
- Moved school appearance into the header and replaced the continuously spinning gear with a native
  dialog drawer. Drawers use modal keyboard handling, Escape, backdrop dismissal and reduced-motion
  styles. Theme-save errors now appear in the drawer.
- Refined page/card spacing, headings, controls, table headings, status colours, focus indicators,
  empty states and loading placeholders. Defaults use an indigo sidebar and light header; saved
  school colours remain respected. Corrected dark report fields and contrast for theme-dependent
  buttons, message bubbles, navigation and attendance states.

Verification: development and production portal builds passed. Production reports warnings for the
525.04 kB initial bundle (500 kB warning threshold) and 5.02 kB shell stylesheet (4 kB warning threshold);
error budgets were not exceeded or changed. `node web/scripts/check-portal-presentation.mjs` passed
against the actual ThemeService: 13 accents in both modes, header/sidebar contrast, dark report input
contrast, invalid values, preview cancellation and cached school branding. `git diff --check` passed.
No schema, query scope or permission rules changed; a fresh database suite is outside this UI release.

Browser tooling denied the reference and local/deployed portal origins under its security policy.
Desktop/mobile layout, drawer motion, keyboard interactions and live deployment remain visually
unverified. These are recorded limitations, not passing acceptance checks.

## 2026-10-23 — Portal registers and learner editing

- Added labelled search/sort controls and shared client-side pagination to Learners, Applications,
  Fees and Staff. Filter and page-size changes return to page one; shrinking results clamp the page.
  Existing query scopes are unchanged. Class export/print/family-code actions still use the full
  selected class, and arrears export still includes all arrears. Fee sorting no longer mutates the
  source accounts array. Register names now use keyboard-accessible buttons.
- Moved learner editing into the modal drawer with persistent Save/Close actions and guardian loading
  feedback. Kept the existing fields and save/delete flows. Delayed guardian and payment-history
  requests cannot replace the currently opened different person's details; load failures are visible.
- Grouped secondary class actions into a menu, added useful empty-state actions, and strengthened the
  dashboard's summary strip and calendar layout. Dashboard loading failures show a retry action
  instead of apparently valid zero totals.
- Extracted the navigation reused by desktop/mobile into its own component, resolving the shell
  stylesheet warning without changing budgets. Preserved admin/teacher links and route restrictions.

Verification: final `npm run build:portal` passed. The initial bundle is 526.05 kB, above its 500 kB
warning threshold but below the error budget; there are no component stylesheet budget warnings.
`node web/scripts/check-portal-presentation.mjs` passed the theme checks and actual pagination logic
checks for page boundaries, partial last pages, deletion, filter/page-size reset, invalid page inputs,
empty results and immutable source records. `git diff --check` passed. Changes remain presentation
and client error handling; no database/access-control changes require a fresh RLS suite.

Rendered desktop/mobile layouts, native dialog focus restoration/animation, form submission and
live deployment remain unverified because browser access is blocked by the origin policy. Production
compilation checks the Angular templates but does not substitute for those interaction checks.

## 2026-10-23 — Akademi visual and motion pass across both apps

The user clarified that the goal is Akademi's clean visual treatment and smooth interactions across
the portal and parent app. Reviewed the supplied screenshots and decoded frames from the supplied
Akademi recording; local analysis media and the temporary decoder stay in ignored .angular files.

- Unified the cool page canvas, quieter white panels, spacing, navy headings, circular identity
  markers and purple/coral/yellow accents. Learner, application and staff rows now include initials;
  parent child cards use circular avatars and a restrained colour strip inspired by the reference.
- Added animated desktop sidebar collapse, softer active navigation backgrounds, page entry fades,
  menu transitions, consistent press/hover feedback and shared motion timings. Parent navigation uses
  an animated active-tab indicator and an Ionic page transition that also handles restored pages.
  Connect-child and school-details panels animate on entry/exit. Reduced-motion preferences remove
  movement in CSS and the Ionic transition. No delays or animation dependencies were added.
- Added application-status bars and a fee-payment ring to the portal dashboard, using its existing
  loaded data. Empty datasets show explanations instead of sample charts. Long fee totals can wrap.
- Simplified parent home panels, removed redundant decorative copy, and replaced its initial loading
  spinner block with a card-shaped skeleton. Preserved existing requests, roles and save flows.

Verification: final production builds passed for both apps. Parent build has no warnings; portal
retains an initial-bundle warning (528.09 kB against 500 kB), with no component stylesheet warnings.
The portal presentation checks pass, including selected-sidebar contrast across the supplied theme
colours. The parent motion check exercises the actual Ionic animation builder for forward/back,
cached outgoing pages, first entry and reduced motion. Ionic's CSS fallback uses a 1 ms completion
tick for a requested zero-duration transition; reduced-mode keyframes contain no fade or movement.
`git diff --check` passed. No database or access-control changes were made.

Browser origin policy still blocks rendered desktop/mobile verification and live deployment checks.
The recording frames establish the reference, but the build and animation-configuration checks do
not prove pixel equivalence, perceived smoothness, focus behaviour or real-device acceptance.


## 2026-10-24 — Saved school theme shared with the parent app

- Parent appearance now reads all four saved settings from the existing school-theme query:
  primary accent, header colour, sidebar colour (bottom navigation in the app), and light/dark mode.
  Portal and app use the same theme validation/defaults and colour calculations. No migration,
  access rule, tenant-selection rule or query scope changed.
- Added visible-app refresh every 30 seconds, focus/resume refresh and home pull-to-refresh.
  Background tabs do not request themes, concurrent lifecycle refreshes are deduplicated, and
  sign-out cleans up timers/listeners and invalidates delayed responses. Offline errors preserve
  the last theme. The full theme is cached, with migration from the old primary-only cache.
- Replaced fixed light surfaces and muted text across parent home, directory, forms, messages,
  fees, attendance, reports, calendar and inbox with theme tokens. Toolbar controls and navigation
  text follow their own backgrounds. Light/dark palettes include readable buttons, message text,
  status labels and Ionic surfaces. Moved the themed loading skeleton into shared parent styles
  to keep the home component within its existing stylesheet budget.
- Updated School appearance to explain the shared settings and save timing. Unsaved previews
  remain local; controls cannot change the pending theme during save. Reset still requires Save
  to publish. The current first-returned-linked-learner school lookup remains unchanged; no
  preferred-school selector or deterministic multi-school ordering is introduced.

Verification: both production builds passed. The final parent build has no warnings; portal retains
its existing 528.09 kB initial bundle warning against the 500 kB threshold. Budgets were not changed.
`node web/scripts/check-school-theme-sync.mjs` passes against the actual services with a mock
transport: all four fields save/read, legacy/invalid/missing themes, 19 palettes in light/dark mode,
text contrast, preview isolation, full cache restore, blocked storage, offline retention, stale
requests, sign-out reset, foreground polling/resume, deduplication and cleanup. Existing portal
presentation/pagination and parent motion checks pass. `git diff --check` passes. No fresh RLS suite
is required for this presentation change, whose existing queries and permissions are preserved.

Browser origin policy still prevents rendered and live end-to-end verification. Portal Save ->
parent refresh on separate real sessions/devices, toolbar/navigation colours, light/dark Ionic
controls and all affected parent screens still need a visual walkthrough. Automated service and
contrast checks are not a claim of real-device acceptance or successful deployment verification.


## 2026-10-24 — Matching school and parent login design

- Replaced the plain school sign-in card and parent sign-in introduction with a shared welcome
  layout: an indigo panel, original decorative campus SVG, coral/yellow accents, clear audience
  labels and a separate form area. The illustration uses short entry motion with reduced-motion
  support. It contains no school records, sample metrics or external image dependencies.
- Desktop uses two columns; tablet/phone layouts use a compact illustrated header and a single
  form column, with safe-area padding and 16px phone inputs. Parent account creation uses the same
  design. Existing signed-in account shortcuts and sign-out remain in the parent account screen.
- Both apps now use matching native form controls with persistent labels, autofill hints,
  Show/Hide password buttons, visible focus states, loading labels and announced errors. Parent
  mode switches hide the password again. Controls retain their original reactive forms and
  validators. Password reset, staff invitations, school registration and school-directory links
  remain available. Form surfaces and colours use each app's existing theme tokens; the welcome
  illustration and panel use Skoolo's own identity before a school is selected.
- Authentication methods, account creation/confirmation, return URLs, school membership loading,
  route guards, database queries and access rules were not changed. This is presentation work;
  it does not require a fresh RLS suite under the change-specific release rules.

Verification: both production builds passed. Parent has no warnings (1.33 MB initial); portal has
its existing initial-bundle warning (now 532.71 kB against the 500 kB warning threshold). No stylesheet
budget warnings or budget changes. `node web/scripts/check-auth-forms.mjs` checks actual controllers
with mock services and parses the Angular templates for control bindings, labels, autofill, help
associations and non-submitting password buttons. It passes validation, failed sign-in, return URL,
parent email-confirmation, sign-out, signup-link mode and no-school routing cases. Ionic view metadata
is stubbed in this Node check; actual templates/Ionic integration are compiled by the production
builds. Existing school-theme sync, portal presentation/pagination and parent motion checks pass.
`git diff --check` passed.

Browser policy still blocks rendered/live verification. Both login pages, parent account creation,
mobile keyboard scrolling/autofill, keyboard focus, password visibility controls, error presentation
and animation appearance need a real-device visual walkthrough. These checks do not establish
successful live deployment or school acceptance, and no roadmap stage was marked accepted.

## 2026-10-24 — Authentication preparation for skoolo.co.za

- The user selected `skoolo.co.za` from HOSTAFRICA. Prepared the documented rollout for
  `app.skoolo.co.za` (parents) and `schools.skoolo.co.za` (schools), Cloudflare DNS/custom domains,
  and a verified Resend sender with Supabase SMTP. Corrected the old Pages URL examples in the
  deployment guide. Domain purchase status is awaiting confirmation; public DNS did not resolve
  at the time of inspection. No nameservers, DNS records, Worker routes, live Supabase settings
  or SMTP credentials were changed. Email confirmation is not enabled by this commit.
- Signup now passes an explicit confirmation destination on the current app's origin. The portal
  waits for confirmation before redeeming an invitation. It retains the invite code in the open
  form; an email opened elsewhere asks for the original code. No invite codes, passwords or
  school details are added to confirmation URLs or stored as onboarding drafts.
- School registration now creates/confirms the administrator's login before collecting school
  details. This avoids losing a school form when an email link opens a new tab. Authenticated
  users can then create or claim a school through the existing RPCs. Accounts with no membership
  can sign in back to `/join` or `/register-school`; other protected destinations still use the
  no-school page and existing route guards. Database roles, queries and RLS are unchanged.
- Both reset pages now show completion before checking the signed-out recovery state, fixing
  the false expired-link message after success. Submissions require a ready valid session and
  form. Added the missing parent RouterLink imports so the reset sign-in and request Back buttons
  navigate. Signup also remains compatible with the current confirmation-disabled configuration.

Verification: both production builds passed; parent has no warnings (1.33 MB initial), portal
retains its existing initial-bundle warning (532.75 kB against 500 kB). The portal's initial
TypeScript return-path failure was fixed before the successful build. Auth controller/template
checks pass for confirmation destinations, deferred invitation/school writes, confirmed and
immediate-session onboarding, no-school routing, signup failure, reset failure/mismatch/expiry,
and the signed-out success screen. The real shared auth service is exercised with a mock Supabase
client to check redirect forwarding. `npm run test:rls` passed all 112 isolation checks and the
coverage guard; no database changes were made. `git diff --check` passed.

Browser origin policy still prevents rendered/live verification. The changed school signup/join
flow and both reset screens need real-browser/device walkthroughs. DNS, TLS, actual email delivery,
email link consumption and live signup confirmation remain unverified. The deployment guide lists
the remaining steps; Stage 0 is not marked accepted.

## 2026-10-24 — Domain ownership confirmed; DNS setup awaits account access

- The owner confirmed that `skoolo.co.za` is registered in their HOSTAFRICA account and has no
  existing website or email service.
- Attempted to open `https://dash.cloudflare.com/` through the available in-app browser. The
  administrator-enforced origin policy rejected access. No alternate browser, API or CLI route
  was used to work around that restriction, and no Cloudflare or HOSTAFRICA settings changed.
- Next input: the two nameservers Cloudflare assigns after the owner adds the domain to the
  existing Cloudflare account. These exact values are needed for HOSTAFRICA delegation; example
  nameservers must not be substituted. DNS, TLS, SMTP and live email verification remain pending.

Documentation-only update: reviewed the diff and ran `git diff --check`. No application or
authentication configuration changed; no new build or database test was required.

## 2026-10-24 — Cloudflare zone added; registrar nameservers saved

- Guided the owner through connecting the existing domain to Cloudflare and choosing the Free
  plan. The DNS scan found no records, consistent with the owner's report of no website/email.
- Read Cloudflare's assigned nameservers from the supplied recording:
  `leif.ns.cloudflare.com` and `marlowe.ns.cloudflare.com`. The owner's subsequent refreshed
  HOSTAFRICA screenshot shows Custom nameservers with exactly this saved pair.
- The latest Cloudflare screenshot explicitly reports waiting for registrar propagation. The
  earlier public DNS lookup still returned HOSTAFRICA's `dan1`–`dan4.host-ww.net` nameservers.
  Zone activation and TLS are not confirmed; no Worker custom domains or live auth/SMTP changes
  have been applied. Next independent setup step is the Resend sending account/domain.
- Account interaction was performed by the owner. Recordings were read locally using the existing
  decoder; extracted frames stay under ignored `web/.angular/`. Dashboard access restrictions
  were not bypassed.

Documentation-only update: diff reviewed and `git diff --check` passed. No new build or RLS test
was required. Live email delivery and Stage 0 acceptance remain open.

## 2026-10-24 — Cloudflare active and Resend sending domain verified

- Public DNS now returns `leif.ns.cloudflare.com` and `marlowe.ns.cloudflare.com`. The owner's
  Cloudflare screenshot confirms the zone is active.
- The owner approved Resend's one-time DNS setup in Cloudflare. Public DNS resolves
  `send.auth.skoolo.co.za` to `send.forge.rmta.net` and `rsend.auth.skoolo.co.za` to
  `rsend-euw1.forge.rmta.net`; `resend._domainkey.auth.skoolo.co.za` has a public DKIM key.
- The owner's Resend screenshot confirms Verified status for `auth.skoolo.co.za`, sending in
  Ireland (`eu-west-1`) and Forge enabled. This proves sender setup, not delivery of an auth email.
- Guided creation of a `Skoolo Supabase Auth` API key with Sending access restricted to the
  sending domain. The owner reports the key is created; no secret was requested, read or stored
  in the repository. The owner has opened the Supabase custom SMTP form, which is still blank
  in the supplied recording. Saving SMTP settings and testing delivery remain pending.
- App custom domains, production auth URL changes and signup confirmation still remain to be
  completed. The existing Workers addresses stay in service.

This milestone changes documentation only; diff review and `git diff --check` are the relevant
repository checks. Stage 0 has not been marked accepted.

## 2026-10-24 — Parent password reset works through production SMTP

- The owner confirmed saving custom SMTP in Supabase with Resend's host `smtp.resend.com`,
  port `465`, username `resend`, sender `no-reply@auth.skoolo.co.za` and display name `Skoolo`.
  The owner entered the API key directly in Supabase; the agent never received the credential.
- Before the save, `npm run test:rls` passed all 112 isolation checks and the coverage guard.
- Guided a live password-reset test from the existing parent app's `/forgot-password` page.
  The owner reported that the whole flow worked. This is owner-reported end-to-end verification
  on the parent Workers address, not an agent browser observation or proof of the portal flow.
- The next rollout step is attaching `app.skoolo.co.za` and `schools.skoolo.co.za` to their existing
  Workers, followed by auth URL settings and live checks on those addresses. Signup confirmation
  has not yet been enabled. No roadmap stage is marked accepted.
- Updated the skill's current-state notes to reflect working parent email delivery and the
  current test count. The local Supabase config still has a commented SMTP example; future config
  deployments must preserve the live dashboard-managed SMTP setup and email rate limit.

Documentation-only release: diff reviewed and `git diff --check` passed. No application code,
Worker routes or live authentication settings were changed by the agent in this milestone.

## 2026-10-25 — Custom domains load; replace the portal's Angular favicon

- The owner attached `app.skoolo.co.za` and `schools.skoolo.co.za` to the existing Workers and
  confirmed both work. Supplied screenshots show the parent directory and portal sign-in page
  on the new addresses. The dashboard first selects the root zone, then accepts `app` or
  `schools` in a separate subdomain field; deployment instructions now reflect that sequence.
- Recorded these already-attached custom domains in both Wrangler files, explicitly retaining
  `workers_dev: true` and the existing static asset and SPA settings. No Cloudflare dashboard,
  API or CLI access was used to work around the administrator's browser restriction.
- Replaced the portal's Angular starter favicon with the existing parent app's Skoolo S icon.
  The new `skoolo-favicon.png` filename avoids reusing the cached Angular icon URL; the original
  `favicon.ico` is removed from the public assets.
- Both production builds passed. Parent initial bundle: 1.33 MB, no warnings. Portal: 532.75 kB,
  with the existing 500 kB initial-bundle warning unchanged. Checked the generated portal HTML,
  verified its icon bytes match the parent icon, and confirmed the Angular favicon is absent
  from the build. Both Wrangler configs parse with the intended domains and Workers fallback.
- `git diff --check` passed. No authentication settings, data access, or permissions changed,
  so a fresh database test run was not required for this release.
- The icon was inspected locally and its production artifact checked. The new browser-tab icon
  has not been observed live by the agent because app browser access is restricted. The owner
  can refresh the portal after deployment to confirm it.

Supabase production URL settings, email reset checks on both new domains and signup confirmation
remain open. The working SMTP setup is unchanged and Stage 0 remains in progress.

## 2026-10-25 — Prepare authentication returns for the custom domains

- The owner's Supabase URL Configuration screenshots confirm the hosted Site URL still points
  to the parent Workers address, with only the two Workers and two localhost redirect entries.
- Updated `supabase/config.toml` to use `https://app.skoolo.co.za` as the Site URL and allow five
  exact return paths: parent `/auth` and `/reset-password`; portal `/join`, `/register-school`
  and `/reset-password`. All four old entries remain, for a total of nine.
- Checked the return paths against the signup and recovery code. Existing calls already use
  the current app origin; no application code change is needed for these domains.
- The hosted change is handed to the owner through **Authentication → URL Configuration**.
  No configuration push was run: the working SMTP credentials and hosted email rate limit are
  managed in the dashboard. Updated deployment instructions to avoid overwriting them with
  local defaults. A repository push alone does not apply hosted Supabase settings.
- Full `npm run test:rls` passed: 112 isolation checks and the coverage guard. The existing auth
  form/controller checks also passed, including app-specific confirmation URLs and password
  reset success, expiry and failure handling. They use mocks and do not prove live delivery.
- Parsed the TOML and compared it with the preceding committed configuration: only `site_url`
  and `additional_redirect_urls` change semantically. Confirmed nine unique URLs, preservation
  of the four old entries, and unchanged SMTP, rate limits and other auth settings.
- Diff reviewed and `git diff --check` passed. Application bundles are unchanged; both production
  builds passed in the preceding release. The auth check printed the existing Node 20 deprecation
  notice from Supabase JS; runtime dependencies were not changed.

Owner confirmation of the dashboard save, reset emails on both custom domains and signup
confirmation testing remain pending. No live authentication setting or stage acceptance is
claimed by this configuration preparation.

## 2026-10-25 — Owner saved the custom-domain authentication URLs

- The owner replied "saved" after instructions to add the five exact custom-domain return URLs,
  retain all four existing entries and save `https://app.skoolo.co.za` as the Supabase Site URL.
  Recorded this as owner-reported completion, not an independently inspected dashboard save.
- Next verification is a fresh reset email from the school portal, returning to
  `schools.skoolo.co.za/reset-password`, followed by the parent app returning to
  `app.skoolo.co.za/reset-password`; each must allow a password change and sign-in afterward.
- No configuration or application code changed in this milestone. Documentation diff reviewed
  and `git diff --check` passed; the full RLS suite and auth checks passed in the preceding release.

Live reset checks on both new addresses and signup confirmation remain pending. Stage 0 remains
in progress.

## 2026-10-25 — Both custom-domain resets passed; prepare signup confirmation

- The owner reported "both passed" after testing fresh password-reset emails from the parent
  and school apps: email delivery, return to each app's custom domain, password change and
  subsequent sign-in. This records owner verification, not an agent browser walkthrough.
- Set `[auth.email].enable_confirmations = true` in the repository. Existing parent signup,
  staff joining and school registration already handle confirmation before onboarding writes.
  The hosted Email provider's **Confirm email** setting still needs to be enabled and saved
  by the owner, followed by live signup tests. No Supabase config push or dashboard edit was made.
- Full RLS suite passed (112 isolation checks plus coverage guard), and the existing auth
  form/controller checks passed, including deferred and immediate-session signup flows.
  TOML comparison confirms email confirmation is the only semantic configuration change;
  SMTP, redirects, rate limits, SMS and other settings remain unchanged.
- `git diff --check` passed. The application source is unchanged; the passing production builds
  from the favicon/domain release remain applicable. The auth checks printed the existing
  Supabase JS Node 20 deprecation notice; no runtime upgrade was made.

New-account confirmation, reused/expired reset links and real-device/cross-browser checks remain
open. No credentials or reset links were requested. Stage 0 remains in progress.

## 2026-10-25 — Parent signup confirmation passed

- The owner supplied a Supabase screenshot showing **Confirm email** switched on, then reported
  "confirmed, it worked" after the guided fresh parent signup and email-confirmation test.
  Recorded parent confirmation as owner-verified; the agent did not operate the browser or mailbox.
- The actual dashboard places the confirmation switch above the Auth Providers list, so the
  deployment instructions now include that location.
- Reviewed the portal registration flow: **Create login and continue** sends confirmation to
  `/register-school`, and school details are shown only after authentication. The next live
  check is this login/confirmation step, stopping at the school details form. A separate staff
  invitation walkthrough is still needed; parent confirmation does not prove either portal path.
- Documentation-only milestone; diff reviewed and `git diff --check` passed. No application,
  authentication settings or database records were changed by the agent.

Both custom-domain resets and parent signup confirmation are owner-verified. Portal confirmation,
reused/expired links and real-device/cross-browser checks remain open; Stage 0 is not accepted.

## 2026-10-25 — Note school-registration password visibility improvement

- During the portal signup walkthrough, the owner asked to note that **Choose a password** on
  `/register-school` needs a Show/Hide control. Added it as pending work in Stage 0, with masking
  by default, value preservation and keyboard access. No password or entered account details
  from the screenshot were copied into the repository.
- This request records the improvement; it does not implement it or confirm completion of the
  portal signup test. Application behaviour is unchanged while that live walkthrough continues.
- Documentation-only change: diff reviewed and `git diff --check` passed.

## 2026-10-25 — Make portal email confirmation visible; add password Show/Hide

- The owner reported that **Create login and continue** appeared to do nothing. The supplied
  screenshot already showed the existing confirmation notice and a cleared password; the owner
  then confirmed receiving the email. The request reached the email-confirmation step, but its
  feedback was too subtle. Completion through the email link is not yet reported.
- Replaced the remaining input form and disabled submit button with a dedicated **Check your
  email** panel. It names the entered email, explains the next step and offers **Continue to sign
  in** with `/register-school` as its return URL. **Use a different email** restores editable
  account details with the password cleared. The panel receives focus when it appears.
- Added the requested labelled, keyboard-accessible Show/Hide control. It is a non-submit button;
  the existing password field and validation remain intact, with an eight-character hint.
  Successful submission clears and masks the password again. No password is persisted.
- Kept the Supabase signup request, return URL and school-write guards. The pending email step
  prevents repeat signup submission, and school creation/claim still requires a signed-in user.
- Expanded existing auth checks for the separate confirmation view, return navigation, no
  duplicate submission or premature school writes, email correction, password masking and
  retention, immediate sessions and error recovery. All auth checks passed. The full RLS suite
  passed 112 isolation checks and its coverage guard.
- Portal production build passed (532.78 kB initial bundle; existing 500 kB budget warning).
  Parent app source is unchanged. Diff reviewed and `git diff --check` passed. Browser access
  remains restricted, so live layout, focus and password-toggle interaction are unverified;
  controller/template checks and compilation are not presented as visual verification.

The portal email has arrived; following it to **Your school**, the staff-invite flow and the
remaining real-device/link checks still need owner verification. Stage 0 remains in progress.

## 2026-10-25 — Keep saved school registration safe when workspace navigation fails

- The owner reached the signed-in school-details form after email confirmation. Submitting it
  showed a failed dynamic-module import. A narrowly scoped, read-only database check confirmed
  one matching school, claimed but not verified, with the signup account as an administrator.
  No school records were changed by the agent. The owner then confirmed that opening `/school`
  in a new tab showed the registered school's workspace.
- The missing shell chunk was from an earlier build, consistent with a tab surviving a
  deployment. The defect in the page was treating a successful school write and failed workspace
  navigation as one failed registration, leaving the write action available again.
- Create/claim now return the committed school before any membership refresh. The destination
  guard still loads the signed-in user's explicitly filtered memberships. The registration page
  retains the saved result, replaces the form with **Your school is saved**, and blocks further
  create/claim submissions on that page. A failed or cancelled navigation offers a normal
  **Reload and continue** link so the browser fetches the current application assets.
- The continuation URL includes the destination school. The guard only applies that selection
  when it belongs to the authenticated user's memberships, preserving the school after a full
  reload without trusting a URL as an access grant. No RPC, schema, RLS or school-verification
  rules changed. The change prevents resubmission after a known successful write; it does not
  introduce server-side idempotency for ambiguous network failures.
- Controller/template checks passed for create and claim after missing chunks, membership-read
  failures and cancelled navigation, blocked repeat writes, retryable rejected writes, and the
  full-document recovery link. Real service/guard checks cover deferred membership refresh,
  current-user query filtering, restoring a non-first school, ignoring an unowned school hint,
  membership roles, and signed-out/no-school redirects.
- Both production builds passed: portal 532.79 kB initial (existing 500 kB budget warning),
  parent 1.33 MB. The full database suite passed 112 isolation checks and its coverage guard.
  Browser tooling remains restricted: the new recovery panel's visual layout, focus and
  end-to-end reload interaction still need a live check. The owner's new-tab recovery confirms
  existing school access, not visual acceptance of the new panel. Stage 0 remains in progress.
