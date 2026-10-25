# Skoolo — decisions

Agreed on 2026-10-21 during planning. This is the source of truth for scope. Change it
deliberately, with a dated note, not by drifting.

## Objective

A working pilot of the enrolment flow, live for **Newborn Christian School** within five days
(target 2026-10-26), built so it grows into a product for private schools across South Africa
rather than being thrown away.

## Who uses it

- **Parents**, on their phones. Find a school, apply for a child, upload documents, pay the
  enrolment fee by EFT, follow the application in an inbox.
- **School staff**, in a browser. Open an enrolment period, set which grades are open and how many
  places each has, review applications and documents, confirm payments, change statuses.
- **Us**, directly in the database for now. Seed schools, verify claims, create staff accounts.

## Scope of the pilot

In: school directory with search, school detail with open/closed status, parent sign-up,
standard application form, document upload, grade capacity check, EFT payment screen with a
unique reference, parent marks paid, staff confirm payment, status pipeline, in-app inbox,
staff portal for the above.

Out until the pilot proves demand: push notifications, SMS, email, card payments, school
self-service claim and verification, multiple staff roles, reporting, app store builds, custom
forms per school, anything beyond enrolment.

## Decisions and why

| # | Decision | Why |
|---|---|---|
| 1 | **Enrolment is the only feature.** | It was the pilot school's stated pain. One complete flow beats five half-built modules. |
| 2 | **Hybrid directory.** We seed real private schools; a school is "claimed" when it has staff and "open" when it has an open enrolment period. Only claimed schools show *Register now*. | The app looks full on day one without pretending every school accepts applications. |
| 3 | **One standard application form** for every school. | A form builder is weeks of work. Schools get custom questions later as an optional section. |
| 4 | **Grade capacity is set by the school per enrolment period** and enforced in the database. A place is held from submission and released only on decline or withdrawal. | Two parents must not both take the last place. Enforcing it in the client alone is not enforcing it. |
| 5 | **Payment is EFT into the school's own bank account.** The platform shows the details, generates a reference, records "parent says paid", and staff confirm. | Holding money makes us a payment intermediary with regulatory weight. Schools already reconcile EFTs today. |
| 6 | **Payment reference is a short unique code** (`ENR-XXXXXX`) shown with the child's surname. | Names collide and get mistyped; banks cap references around 20 characters. |
| 7 | **Transport question is one optional field** with its purpose stated. | We want the data for a future transport feature. POPIA requires us to say why we collect it. |
| 8 | **Supabase** for database, auth, storage and API. | Solo developer, five days. Hosting, login and file storage on day one. Data is hosted outside South Africa; the privacy notice must say so. Revisit when there is revenue. |
| 9 | **Angular 20 portal, Ionic 8 parent app, one Angular workspace, shared library.** | One language and one component style for one developer. Node 20 on the build machine pins these versions. |
| 10 | **Parent app ships as a progressive web app** for the pilot. Capacitor store builds later. | Store accounts, a Mac and review time do not fit in five days. The school shares a link or QR code. |
| 11 | **Email and password sign-in**, phone number required on the profile. | SMS sign-in needs a paid provider and setup time. Add it when parents ask. |
| 12 | **No installed desktop software.** Staff use a web portal. | Nothing to install or update at schools; "desktop and app share data" becomes trivial because both read the same database. |
| 13 | **The old `C:\Dev\Skoolo` project is reference only.** | It was designed for a different product. Opening it during decisions pulls in weight we do not need. |

## Rules lifted from the old project

These five, and nothing else:

1. Grade and class capacity is enforced on the server.
2. Application statuses are a fixed set with allowed transitions.
3. South African ID numbers are Luhn-validated, with a passport fallback.
4. Money is a decimal with an explicit currency column. ZAR only for now.
5. One active application per learner per school per academic year.

## Statuses

Application: `submitted` → `under_review` → `more_info_needed` / `accepted` / `waitlisted` /
`declined`; parent may `withdraw` at any time before decline. Payment, tracked separately:
`unpaid` → `marked_paid` → `confirmed`. Confirming payment also marks the application
`accepted` and sends the welcome message.

## Grades

`G00` Grade 00 (Preschool), `GRR` Grade RR, `GR` Grade R, `G1`…`G7`. Codes `G8`…`G12` exist in the
lookup for schools that offer them.

## Assumptions to validate

- Newborn Christian School's full details, fee and banking details arrive 2026-10-22.
- Parents will pay by EFT rather than expect card payment in the app.
- A public list of private schools is usable as seed data. Until then, a hand-picked seed.
- Staff have reliable internet at the school office.

## Risks

- The development machine is temporary. Everything is in GitHub and Supabase from the first hour.
- Five days means almost no automated tests. The capacity rule and row-level security are the two
  things that get tests.

## Amendments, 2026-10-22

Agreed at the pilot school with its administrator. These extend the decisions above.

| # | Decision | Why |
|---|---|---|
| 14 | **Schools set themselves up; Skoolo verifies.** A principal registers or claims their school from the portal and becomes its first admin. Skoolo flips `is_verified` once per school after checking it is real. Nothing else about a school's configuration goes through Skoolo. | Multi-tenant from day one. The developer cannot be in the loop for every school. Verification stays manual because parents pay the school directly and must not be sent to a fake one. |
| 15 | **Staff logins by invite code, not email.** The admin creates an invite for a staff member; the code (plus link and WhatsApp share) is handed over in person or by message. The person signs up with the invited email and redeems it. | No dependency on email delivery, which is rate-limited on the free tier. Codes are single-use, expire after 14 days and are bound to an email address. |
| 16 | **Two roles.** `admin` (principal, clerk): full control. `staff` (teachers): applications read-only. Enforced in RLS and the payment and status RPCs. | The admin wanted teachers in the system without letting them confirm payments or change outcomes. |
| 17 | **Staff register with documents** lives in the system: name, position, class, ID number, contact details, address, notes, and private files (ID copy, qualifications, contract, police clearance, SACE, CV). Admin-only. | Asked for by the administrator; the record every school keeps on paper today. |
| 18 | **Badge uploaded by the school**, stored in a public bucket. | Self-service; it is public branding. |
| 19 | **Grade 0 is its own level** between Grade 00 and Grade RR. Pilot school's structure: 00, 0, RR, R, 1–7. | As given by the school. Flagged for confirmation that it is not the same as Grade R. |
| 20 | **The applying parent's details are captured per application:** full name, relationship, ID or passport number, phone. The account holder's contact details remain on the profile. | The school's form asks for the parent's ID; the person applying may not be the account holder. |
| 21 | **The enrolment fee is once-off** (R520 at the pilot school). Monthly, termly or yearly school fees are outside the pilot. | Clarified with the school. |

### Updated scope line

Out until proven needed: push notifications, SMS, email delivery provider, card payments, Skoolo
super-admin console (verification is one SQL statement until then), school fees, reporting,
custom forms per school, app store builds.

## Amendments, 2026-10-22 (afternoon): the school's feature list

The full plan and its reasoning are in `docs/roadmap.md`; the policy research is in
`docs/report-card-spec.md`.

| # | Decision | Why |
|---|---|---|
| 22 | **One roadmap stage at a time**, each passing the definition of done in the `skoolo` skill before the next begins. Stage 0 hardens what exists first. | Asked for by the developer: make what exists work best, then add feature by feature, each tested and working. |
| 23 | **Classes, subjects and teaching assignments are set up by each school's admin.** Whether a grade has one class teacher or subject teachers is a school setting (the pilot school: class teacher to Grade 3, subject teachers from Grade 4). | Multi-tenant; other schools draw the line elsewhere. |
| 24 | **Skoolo generates report cards from marks** the school captures, following the National Protocol for Assessment (contents) and the NPPPR (scale and promotion guidelines). Term marks are typed in directly first; individual assessments come later. | The school has marks, not report files, so uploading PDFs would not help. Term 4 reports are the deadline. |
| 25 | **The principal approves results in Skoolo before any report is published**, and published reports are locked and versioned. | Request 5, and the protocol's rule that reports must be free of errors, with the school management team responsible. |
| 26 | **A report card is never withheld for any reason, including unpaid fees.** | National Protocol for Assessment 25(13). Must hold when fees arrive in Stage 5. |
| 27 | **Learners are imported from the school's existing Excel list** with validation before anything is saved. | The school already keeps the list; retyping hundreds of learners would stop adoption. |

## Amendment, 2026-10-23 — Checks follow the change

At the developer's request, release checks are scoped to the complete diff being released.
Presentation, navigation and client error-handling updates that preserve data access and permission
rules need affected-app production builds and relevant functional checks, without a fresh RLS suite.
Database and access-control changes still require the full RLS suite to pass. Documentation-only
changes need a diff review. The detailed criteria live in CLAUDE.md.

A blocked browser or unrelated infrastructure check is recorded honestly and does not prevent an
otherwise verified UI release. This does not waive the real-device and school-use acceptance criteria
for completing a roadmap stage, or override platform permissions.

## Amendment, 2026-10-23 — Push every completed change

The user requires every completed logical change to be committed and pushed to `origin/main`,
after its applicable checks, rather than saved only locally until the end of a session. This is
standing approval for pushes within the authorised work and their configured deployments. Confirm
push success before reporting publication; platform approval controls still apply.


## Amendment, 2026-10-24 — Share saved school appearance with parents

The school's saved `schools.theme` is the source of appearance settings for both apps. Primary
colours carry over to app accents, the header colour to app toolbars, the sidebar colour to bottom
navigation, and background mode to light/dark content. Unsaved portal previews remain local.
Online parent apps check for changes every 30 seconds while visible, on focus/resume, and on home
pull-to-refresh. Offline apps retain the cached theme; signing out restores the default theme.

The existing parent lookup is preserved: the first linked learner returned by the current query
supplies the school theme. It has no explicit ordering or multi-school preference, so this update
does not promise a particular school for families linked to several schools. Choosing a preferred
school remains a separate product decision. No schema, access rules or query scope changed.

## Amendment, 2026-10-25 — Prioritise login and session security

The owner asked to plan and prioritise security before broader system-test expansion, clarifying
that the concern is login/session storage. Stage 0 now contains a source-based security plan with
confirmed findings, hosted settings still to verify, delivery order and acceptance checks.
Server-managed HttpOnly sessions and administrator MFA are recommendations, not implemented or
approved infrastructure changes. Security regression and isolation checks remain part of each
security fix; the request does not remove the existing release requirements.

## Amendment, 2026-10-25 — Staff session policy and current hosting plan

The owner confirmed that Supabase is on the **Free** plan and approved **30 minutes of inactivity
and an eight-hour maximum session for school staff**. Provide a warning before expiry. The parent
device policy remains undecided; do not silently apply staff limits to parents.

These are agreed requirements, not active controls. Supabase's hosted session lifetime controls
require Pro or above and its inactivity timeout measures refresh activity, not user interaction.
Those project-wide settings alone also do not separate the two apps. Design staff enforcement in
the planned server session layer, including idle activity, absolute expiry and direct API bypass,
before claiming the policy is enforced. No paid upgrade or new infrastructure has been approved.

## Amendment, 2026-10-25 — Secure password change and authentication CAPTCHA

The owner confirmed that hosted **Secure password change** is enabled and supplied the public
Site Key for the requested Cloudflare Managed Turnstile widget. Integrate that key into both
apps' public authentication forms, including school registration and invitation signup. The
private key stays in Supabase's hosted CAPTCHA settings. Keep hosted CAPTCHA disabled until
both updated apps are deployed; activation and live provider checks remain owner steps because
browser security policy blocks agent access. The public widget alone is not server enforcement.

The server session proposal is documented in `docs/session-security-design.md`. It does not
create infrastructure, change browser token storage or implement the agreed staff timeouts.
