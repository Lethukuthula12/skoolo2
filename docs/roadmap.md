# Skoolo — roadmap

Written 2026-10-22 from the feature list the pilot school gave us, and revised the same day with
the school's answers. Enrolment for 2027 has closed, so the order favours what the school can use
this term and in the first weeks of next year.

**How we work:** one stage at a time. A stage is not done until it passes the definition of done
in the `skoolo` skill (`.claude/skills/skoolo/SKILL.md`): agreed with the school, tested
automatically and by hand in every affected role, deployed, and used by a real person at the
school. Nothing in the next stage starts while the current one has open bugs.

## Status

| Stage | What | Requests | Status |
|---|---|---|---|
| 0 | Make what exists solid | — | **In progress** |
| 1 | Learners, classes and subjects | 1, 8 (teaching assignments) | **Built** (model, admin screens and teacher view done and verified; awaiting the admin importing real learners) |
| 2 | Connect parents to their children | prerequisite for 2, 4, 6 | **Built** (codes, redeem, My children, portal sharing, verified; awaiting ten real families) |
| 3 | Term reports | 2, 5, 3 (schedules and pass and fail lists) | **Built** (capture grid, approval, publish, report card, parent view, schedule export; verified end to end) |
| 4 | Messages between home and school | 4, 6 | **Built** (report absence, acknowledge, two-way threads, message a class; verified absence end to end) |
| 5 | School fees | 7 | **Built** (fee structures, accounts, record/confirm payments, balances, arrears export, parent statement; verified end to end) |
| 6 | Teacher timetables and calendars | 8 | **Built** (day structure, teacher weekly grid with place/remove and .ics export, calendar, admin per-class and per-teacher views; verified end to end) |
| 7 | Assessment detail | rest of 5 | **Built** (capture grid with live calculated term marks, roll-up into Stage 3 draft reports, per-assessment and per-subject analysis export; verified end to end) |
| 8 | Assessment paper builder | Teacher-to-office paper preparation | **Built** (editor, templates, review, separate learner/memorandum printing and mark-capture links; automated checks pass; browser and school acceptance pending) |

## Stage 8 — Assessment papers (authorised 2026-10-25)

The owner confirmed teachers handwrite questions which the office retypes in Word, and asked to
build the proposed paper builder. This explicitly brings this feature forward while Stage 0's
remaining installation and session checks remain open.

Teachers create papers for assigned classes/subjects, add questions, marks, images and answer
space, save drafts, and choose a school administrator to review. Administrators manage reusable
school templates. Reviewers return feedback or approve a fixed paper. Corrections create a new
draft linked to the original. Learner paper and memorandum have separate A4 print/PDF outputs.
An approved paper can create or link a compatible assessment for existing mark capture.

First-version assumptions: reviewers are existing administrators; teachers edit only their own
drafts; administrators can read school papers and print approved copies. Templates hold reusable
instructions/layout defaults, not confidential question answers. Online responses, OCR, Word
export and offline synchronisation are later work.

Done when a real teacher creates an assessment, the selected reviewer approves it and the office
prints it without Word or retyping. Verify tenant/role isolation, saved drafts and conflicts,
returned corrections, separate memorandum output, pagination and phone/desktop operation.

The school's requests, in their words:

1. The admin assigns a teacher to a class; when a learner enrols they are placed in a grade and a class.
2. Send reports to parents through the system. A massive pain point.
3. Export documents such as class learner lists, filter passed and failed learners, export to Excel or PDF.
4. A teacher sends a message directly to a parent.
5. The admin captures assessment results after the principal has viewed and approved them.
6. A parent sends a message reporting that their child is absent.
7. Parents pay school fees monthly, per term or per year.
8. From Grade 0 to Grade 3 one teacher is assigned to a class; from Grade 4 to Grade 7 teachers
   teach specific subjects. A teacher can create and generate their own calendar.

## Stage 0 — Make what exists solid

### Next work agreed with the owner

- [ ] **Portable test handover (2026-10-25):** test project, full-system Gherkin catalogue and
  local setup are built. Follow docs/testing/new-laptop.md on the replacement laptop, run the
  Docker bootstrap and ten Cypress cases, then automate the three complete journeys. Scenario
  definitions and manual guides are not school acceptance.


- [ ] **2026-10-26: resume staff session enforcement.** Implement the agreed 30-minute idle and
  eight-hour maximum limits, warning before expiry, and the server-side protections in
  `docs/session-security-design.md`. Parent session limits still need a separate decision.
  Deferred at the owner's request on 2026-10-25; these limits are not active.
- [ ] **Current priority: parent-app installation on Android and iOS.** Fix the missing Android
  install entry point and verify the real-phone installation path. **Entry point and manual help
  implemented; Android acceptance blocked.** The owner confirms iOS installation succeeded and
  explicitly using HTTPS resolved Safari's connection warning. Android installation directly from
  Chrome remains blocked by the older-Android compatibility warning on a Galaxy A05, Android 14,
  Chrome 155.0.8059.39. Its cause is not yet confirmed; the complete warning is needed. This takes priority over
  staff-session implementation for this work session. See the phone checklist in `docs/deploy.md`.

Why first: the enrolment flow, portal and self-service onboarding were built in five days and
checked by hand. Before more people depend on them, the rules that protect each school's data need
automated proof, and a forgotten password must not lock anyone out.

| Item | Done when |
|---|---|
| Phone testing | Both live sites checked on an iPhone and an Android phone; no sideways scrolling, install path works. |
| School-registration password visibility | **Implemented; live visual check pending.** `/register-school` has a labelled Show/Hide button, masks the password initially and preserves the entered value while toggling. The confirmation step replaces the login form with a prominent email panel and sign-in action. Production build and controller/template checks passed; live focus, mobile layout and toggle interaction remain to be checked by the owner. |
| Automated database tests | **Done.** `npm run test:rls` runs `supabase/tests/tenant_isolation.sql`: it builds two schools (each with an admin, a teacher and a parent with a learner and an application) as the `authenticated` role with per-user JWT claims, asserts 112 isolation and role checks, and rolls everything back. Proven to bite: weakening one policy flips the matching check to failure. Re-run before database or access-control releases, as specified in CLAUDE.md. CI wiring is a follow-up (needs Supabase secrets in GitHub Actions). |
| Password reset | **Both custom-domain reset flows verified by the owner:** fresh email delivery, return to the requesting app, password change and subsequent sign-in passed on `app.skoolo.co.za` and `schools.skoolo.co.za`. Email confirmation is enabled; parent signup/confirmation passed, and portal registration reached school details and saved the school/admin membership. Workspace navigation then failed on a lazy module; the owner confirmed the workspace opens in a new tab. **Still needed:** live check of the new registration recovery panel, staff-invite signup, reused/expired reset links and mobile/cross-browser behaviour. Both apps handle confirmation before protected onboarding writes. The owner performs dashboard steps because agent browser access is blocked. See `docs/deploy.md`. |
| Demo data | The test application `ENR-E5D24T` and the test accounts are deleted or kept as a labelled demo before real parents use the system. (Grades, bank details and the rest are the admin's to set and correct in the portal, so we do not chase the school to confirm them.) |

### Login and session security plan

Priority set by the owner on 2026-10-25, ahead of new feature work and broader functional-test
expansion. The immediate concern is login/session storage, not a reported unauthorised-access
incident. This is a plan and source review, not a completed penetration test or security clearance.
Existing isolation checks remain required when changing authentication or access controls.

**Implementation update, 2026-10-25:** the first batch escapes stored print data, constrains stamp
URLs, blocks scripts in print documents, upgrades SheetJS to 0.20.3 and patches the Angular 20
development tools. Both apps now configure enforced framing/object/base-URL protections plus a
full resource/script policy in report-only mode. `npm run check:security` covers print injection,
image URL restrictions, workbook/CSV compatibility and header configuration, and runs in CI.
The full dependency audit now reports zero vulnerabilities. Live print-preview and deployed-header
checks remain open; report-only script rules are not yet an enforced XSS defence. The initial
findings below record the review baseline. HttpOnly migration and MFA remain open.

**Session lifecycle update, 2026-10-25:** both apps now remove their routed pages on sign-out,
session loss, account changes or unrenewed access-token expiry. A dedicated status screen reports
logout failures and continues through a full document load. School memberships and selection are
cleared synchronously, and obsolete membership/storage responses cannot restore a previous account.
Recovery state and timers/listeners are cleaned up. Synthetic lifecycle/form checks and the full
112-check RLS suite plus coverage guard pass. Live cross-tab/device checks remain unverified.
This implements the client lifecycle portion of item 2; hosted controls and abuse protection
remain open. Persistent browser token storage is unchanged.

**Password verification update, 2026-10-25:** both reset-password screens now respond to a server
reauthentication challenge, send a code on request and submit the nonce with the new password.
They handle invalid/expired codes, resend cooldowns, rate-limit responses and connection failures;
completed/destroyed forms clear secrets and Ionic's cached parent screen clears them on leaving.
The owner confirmed enabling Supabase's **Secure password change** option on 2026-10-25. Live
older-session challenge/email-code checks remain open. Dashboard access was denied by browser
security policy; this is owner-reported activation, not an agent inspection.

**Timeout decision, 2026-10-25:** the owner confirmed Supabase Free and approved staff limits of
30 minutes idle/eight hours maximum. Parent limits remain undecided. Hosted lifetime controls
require Pro or above; design server enforcement with item 3 rather than presenting a browser
timer as enforcement. These limits are not active yet.

**CAPTCHA implementation, 2026-10-25:** the owner supplied a public Turnstile Site Key. All seven
public authentication forms now render a challenge and pass its single-use token through the
shared service. Expiry/retry, failed reset requests and duplicate submissions are handled.
Supabase CAPTCHA activation and live validation remain pending the owner steps in `docs/deploy.md`;
the frontend check alone does not enforce bot protection on direct Auth API requests.

The proposed server boundary, registry gate, storage and rollout are now described in
`docs/session-security-design.md`. It changes no infrastructure or current session guarantees.

#### What the review establishes

| Finding | Evidence and significance |
|---|---|
| Sessions are accessible to site JavaScript | `web/projects/shared/src/lib/supabase-client.ts` enables persistent, automatically refreshed sessions with Supabase's default browser storage. The empty Cookies panel is consistent with that architecture; it does not prove compromise. A script-injection flaw could expose access and refresh tokens. |
| Unsafe HTML in print views — first remediation priority | `reports.page.ts` (`printReport`) and `learners.page.ts` (`printRoster`) interpolate stored names/comments and other values into HTML passed to `document.write` in a same-origin popup. These values bypass Angular template escaping. The report also interpolates a stamp URL into an attribute. The unsafe construction is confirmed in source; no malicious records were inserted and no live exploit was attempted. |
| Browser defence headers are absent from repository configuration | Both apps' `public/_headers` files define cache directives only. No CSP or framing policy is configured there. Cloudflare may add headers independently: live response headers remain unverified because browser access is restricted. |
| A production dependency has published high-severity advisories | `npm audit --omit=dev --json` reports one affected direct dependency, `xlsx` 0.18.5, with prototype-pollution and regular-expression denial-of-service advisories. The learner importer calls `XLSX.read` on uploaded workbooks. The audit reports no automatic npm fix; replacing or sourcing a maintained version needs review, not `npm audit fix --force`. This finding is not evidence of exploitation. |
| Session lifecycle needs explicit handling | `AuthService.signOut` discards the returned sign-out error. Auth events update the session but do not centrally clear school-specific state or navigate an already-open protected page away. Recovery state is set on `PASSWORD_RECOVERY` and explicitly reset only by the service's sign-out method. Review cross-tab logout, refresh failure and account switching before declaring these flows secure. |
| Stronger login controls are not implemented in the app | No MFA enrolment/challenge or recent-authentication flow was found. Repository configuration disables TOTP, leaves session lifetime settings commented, and sets `secure_password_change = false`. These are repository facts, not a verified dump of hosted settings. |

The project already has authenticated database access, row-level security, role-scoped RPCs,
private document storage, email confirmation and refresh-token rotation in its design. The last
release passed 112 isolation checks plus the coverage guard. Those checks establish the covered
permission rules; they cannot protect an account whose valid session has been stolen.

#### Delivery order and acceptance

1. **Close script-injection paths and dependency exposure.** Replace raw print HTML containing
   stored values with safe text rendering, or context-correct escaping and constrained image URLs.
   Review every direct DOM sink; the shell's trusted SVG map currently contains code-owned icons,
   so it should not be labelled a confirmed injection flaw merely for using a bypass API.
   Remediate the affected workbook parser. Define CSP, framing, MIME-sniffing and referrer
   protections for both apps, accounting for Angular/Ionic styles, fonts, images and Supabase
   connections. Validate CSP in report-only mode before enforcing it; do not allow arbitrary
   scripts just to suppress errors. Verify HTTPS before tightening HSTS scope. **Acceptance:**
   attacker-like text in names/comments prints as text, image URLs cannot introduce markup,
   imports/exports still work, and actual deployed headers match the policy. No production
   attack payloads or customer-data mutations are required for this verification.

2. **Make logout, expiry and account changes dependable.** Handle sign-out errors, clear
   sensitive in-memory state on session loss, synchronise open tabs, reset recovery state, and
   prevent one account seeing another's cached school state. Read the hosted session lifetime,
   refresh rotation, password-change and rate-limit settings without exposing secrets or
   overwriting working SMTP configuration. Remove unused production redirect wildcards and
   development callbacks after separate development access is established. Add server-validated
   abuse protection for signup/reset/sign-in, preserving generic account-existence responses.
   Agreed portal policy: 30 minutes idle and an eight-hour maximum session, with a warning
   before expiry. Confirm a separate parent-device policy. The current Supabase Free plan does
   not supply hosted lifetime limits; design enforcement through the server layer in item 3.
   **Acceptance:** logout/expiry/account switching behave correctly across tabs and both apps;
   server enforcement matches the chosen policy. A browser timer alone is not enforcement.
   Document the residual lifetime of already-issued JWTs and how revocation is enforced.

3. **Move browser session tokens behind a server layer.** Recommended target: a Cloudflare
   Worker backend for each app's authenticated requests, keeping Supabase access/refresh tokens
   on the server. The browser receives an opaque, host-only `__Host-` session cookie with
   `HttpOnly`, `Secure`, `Path=/` and an explicit `SameSite` policy compatible with email-link
   navigation (proposed `Lax`). Do not share a `.skoolo.co.za` cookie between the apps. Preserve
   RLS by forwarding the authenticated user's identity; never replace ordinary user requests
   with an unrestricted service-role client. Route authenticated database/RPC/storage calls
   through this layer; moving only login while returning tokens to Angular would leave the
   original exposure. Use server-verified, one-use callback handling for confirmation/reset,
   validate destinations and define the cross-browser email-link behaviour.
   Add CSRF tokens and exact-origin validation to state-changing requests, including session
   operations; SameSite alone is insufficient. Authenticated responses must not enter CDN or
   service-worker caches. Define token encryption, session-store consistency, concurrent refresh,
   invalidation, rate limits, logging redaction and outage behaviour before implementation.
   Storage choice, hosting costs and migration/rollback steps remain design work, not approved
   infrastructure changes. **Acceptance:** tokens are absent from browser storage, JavaScript
   responses and logs; cookies have the required flags; forged cross-origin mutations fail;
   refresh/logout/reset work; existing tenant restrictions remain intact. HttpOnly reduces token
   theft by JavaScript but does not fix XSS or hide cookies from the device owner's DevTools.

4. **Require stronger proof for privileged access.** Recommend authenticator-app MFA for school
   administrators, with enrolment, recovery and lost-device procedures before enforcement.
   Require recent authentication for password/email changes and sensitive administration.
   Enforce assurance levels in the server/database and SECURITY DEFINER RPCs as appropriate,
   not only route guards; preserve the exact admin/staff/parent permission boundaries. Confirm
   hosted feature availability instead of trusting old config comments about plan restrictions.
   **Acceptance:** bypassing the MFA screen cannot perform protected actions through direct API
   calls, and legitimate account recovery does not strand school administrators.

Each batch ships with the security checks necessary to prove its fix. General feature-test
expansion can wait; authentication changes still require affected production builds, targeted
security regressions and the full RLS suite. Keep findings, hosted-setting evidence and unresolved
risks explicit. The initial review changed no application code, provider configuration or live data;
the implementation update above records subsequent fixes.
Continue with item 2's owner-assisted hosted-setting review and abuse protection,
alongside live verification of the new session boundary and item 1's headers/print previews.
Then design item 3's server-managed sessions with the agreed staff limits and a separate parent
policy. Promote the full CSP only after compatibility is
checked. HSTS scope and Trusted Types enforcement also remain future work.

#### Reference guidance

- [Supabase browser session defaults](https://supabase.com/docs/reference/javascript/auth)
  explain the current local-storage behaviour.
- [OWASP HTML5 storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
  explains the JavaScript exposure; [Angular 20 security guidance](https://v20.angular.dev/best-practices/security)
  covers unsafe DOM APIs, escaping, CSP and Trusted Types.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
  informs cookie scope and flags. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
  documents token/session lifetimes, hosted limits and the need for server access when using HttpOnly cookies.
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa) covers enrolment and enforcement.
- Spreadsheet advisories: [CVE-2023-30533](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)
  and [CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).

## Stage 1 — Learners, classes and subjects

Why: every other request needs to know which learner is in which class, which subjects they take,
and who teaches them. Everything here is set up by the school's admin, so every school can arrange
its own classes and subjects.

The school teaches in two ways, and the model must hold both from the start:

- **Class teacher grades** (Grade 00 to Grade 3 at the pilot school): one teacher teaches the class
  everything.
- **Subject teacher grades** (Grade 4 to Grade 7): each subject in a class has its own teacher, and
  one teacher may teach the same subject to several classes. Each class still has a class teacher
  for registration and pastoral care.

Which grades work which way is a school setting, not a rule in code. Other schools draw the line
elsewhere.

The school can:

- Set up its subjects per grade. The CAPS subjects for each phase are offered as defaults
  (`docs/report-card-spec.md`), with each language recorded at its level, for example
  "Home Language: isiZulu". The admin edits them and adds the school's own.
- Create classes for a year and grade (for example Grade 3A), and assign a class teacher from the staff register.
- For subject teacher grades, assign a teacher to each subject in each class.
- Import its current learners from Excel. The template matches the school's existing list:
  name, surname, date of birth, ID number, sex, grade, contact numbers, enrolment date, plus an
  optional class and admission number. Skoolo checks every row before importing (valid ID number,
  known grade, no duplicates) and shows the problems to fix.
- Add, edit and move learners one at a time.
- When accepting an application, choose the class; the learner joins the register automatically.
- Export a class list to Excel and PDF.

A teacher who signs in sees the classes they teach: their own class, or every class where they
teach a subject, and nothing else.

The learner register also holds what the report card and schedule need later: admission number
(generated when the school has none) and years in the current phase.

Done when the admin has imported the real learners from the school's own Excel list, every class
has a class teacher, every subject in Grades 4 to 7 has a teacher, a real teacher sees only the
classes they teach, and a class list opens correctly in Excel.

## Stage 2 — Connect parents to their children

Why: reports, messages and absence notes reach nobody in the app until a parent account is linked
to a learner.

- The school generates a family code per learner and shares it by WhatsApp, in bulk per class.
  The contact numbers from the learner import are used to prefill the WhatsApp messages.
- The parent enters the code in the parent app and sees the child under "My children".
- Parents who applied through Skoolo are linked automatically when the application is accepted.
- The school sees which families are connected and who still needs a nudge.

Done when ten real families are connected.

## Stage 3 — Term reports

Why: the school called sending reports a massive pain point, Term 4 reports go home in early
December, and the school has marks rather than finished report files. So Skoolo produces the report
itself. What a South African report card must contain, the 7-point scale and the promotion
guidelines are in `docs/report-card-spec.md`.

The school can:

- **Set up once:** term opening and closing dates, the school stamp image, and who approves
  results (the principal).
- **Capture marks:** per class and term, a grid of learners by subjects. The percentage is typed
  in, for example isiZulu 75%, and the code and description are filled in from the national scale.
  Days absent and a teacher's comment per learner. Who captures (subject teachers, the class
  teacher or the admin) is the school's choice.
- **Approve:** the principal reviews a class with missing marks and learners below the promotion
  guidelines flagged, then approves it. Nothing reaches a parent before that. This is request 5:
  results become official only after the principal has viewed and approved them.
- **Generate:** a report card PDF per learner with every component the policy requires: learner and
  school details, term, subjects with code, description and percentage, attendance, comments,
  teacher and principal names, school dates, stamp and the code table. The end-of-year report
  shows the year's final marks and the outcome (promoted, progressed or retained), which the
  principal confirms.
- **Deliver:** connected parents get an inbox message and open the report in the app. The school
  downloads all of a class's reports as PDFs to print for families not yet connected, and sees
  who has opened theirs.
- **Export:** the class or grade schedule to Excel and PDF, filterable by meets or does not meet
  the promotion guidelines. This is request 3.

Rules: a published report is locked; a correction creates a new version with a record of who
changed what. **A report is never withheld for any reason, including unpaid fees**, as national
policy requires.

Not in this stage: capturing individual tests and assignments that add up to the term mark. The
school enters the term mark directly, as it does today. Detail comes in Stage 7.

Timing, honestly: this depends on Stages 0, 1 and 2 finishing in about three weeks. If Stage 2 is
not finished, Term 4 reports print from Skoolo and in-app delivery follows.

Done when Term 4 2026 reports for at least one real class are captured, approved by the
principal, and reach every family, in the app or printed from Skoolo.

## Stage 4 — Messages between home and school

- A parent reports an absence: which child, which days, the reason, and optionally a photo of a
  doctor's note. The class teacher and the office both see it, and the parent gets an
  acknowledgement. Reported absences feed the days-absent count on the report.
- A teacher messages one parent or the whole class. The parent can reply in the same thread.
- Administrators can see every thread, for safeguarding.

Done when a real absence is reported through the app and the teacher acknowledges it.

## Stage 5 — School fees

Why now rather than later: 2027 fees start in January, so a fee system ready by then is used from
day one. Money needs care, so this stage is larger and tested hardest.

- The school sets fee amounts per grade and payment plans: monthly, per term or per year, with an optional discount for paying upfront.
- Each learner has an account and a unique payment reference.
- The admin clerk records EFT and cash payments; the principal confirms them.
- Parents see their statement and balance in the app.
- An arrears list, exportable.
- Arrears never block a report card.

Not in this stage: card payments and automatic bank statement matching.

Done when January 2027 fees for the real learners are on Skoolo and the clerk records a month of payments with it.

## Stage 6 — Teacher timetables and calendars

The school confirmed it wants both: the weekly timetable of periods and a calendar of dated items.

- The school sets its day structure once: periods, times and breaks.
- A teacher builds their weekly timetable from the classes and subjects they are assigned in
  Stage 1, so they can only place lessons they actually teach. Clashes are flagged.
- A teacher adds dated items such as tests, assignment due dates and outings to their calendar.
- The teacher views or prints their week, and exports it to a phone calendar.
- The admin sees every teacher's timetable and a timetable per class, and can spot double-booked
  classes.

Done when every Grade 4 to 7 teacher at the pilot school has their 2027 timetable in Skoolo.

## Stage 7 — Assessment detail

- Teachers capture individual assessments per subject per term: tests, assignments, projects and
  the end-of-year examination.
- The school sets the weighting per phase, following policy: Grades R to 3 are all school-based
  assessment; Grades 4 to 6 are 75% school-based assessment and 25% examination.
- Term and final marks are calculated instead of typed, and flow into the Stage 3 reports and
  approval.
- Analysis per assessment and per subject, exportable.

Done when Term 1 2027 marks for a real class are built from captured assessments and the
calculated term mark matches the teacher's own calculation.

## Answers from the school (2026-10-22)

| Question | Answer |
|---|---|
| Classes per grade and their names | The admin sets them up in the system, so every school sets its own. |
| Current learner list | Yes, in Excel: name, surname, date of birth, ID number, sex, grade, contact numbers, enrolment date. |
| Subjects in Grades 4 to 7 | The admin sets them up. |
| What goes on reports | Marks per subject as a percentage, for example isiZulu 75%. Format to follow South African policy: researched in `docs/report-card-spec.md`. |
| "Calendar" | Both: the weekly timetable and a calendar of tests and events. |

## Still to ask the school

| For stage | Question |
|---|---|
| 1 | Do Grade 00, Grade RR and Grade R also have one class teacher each? |
| 1 | Whose numbers are the "contact numbers" in the learner list: mother, father, guardian? How many per learner? |
| 3 | Who captures Term 4 marks: the subject teachers, the class teachers, or the admin? Is the principal the only one who approves? |
| 3 | How are Grade 00, Grade 0 and Grade RR reported today: marks, or written comments per development area? |
| 3 | When do Term 4 reports go home? This is the real deadline. |
| 4 | Who should receive an absence note: the class teacher, the office, or both? |
| 5 | What payment plans do schools offer (monthly, per term, per year) and is there a discount for paying upfront? Who records payments and who confirms them? (The amounts themselves the admin captures.) |
| 6 | Who builds the timetable today, each teacher or the principal? How many periods a day, and what times? |
