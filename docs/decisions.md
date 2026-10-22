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
