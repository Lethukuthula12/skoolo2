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
| 1 | Learners, classes and subjects | 1, 8 (teaching assignments) | **In progress** (model, security and admin screens done; teacher class view next) |
| 2 | Connect parents to their children | prerequisite for 2, 4, 6 | Planned |
| 3 | Term reports | 2, 5, 3 (schedules and pass and fail lists) | Planned, target Term 4 reports in early December 2026 |
| 4 | Messages between home and school | 4, 6 | Planned |
| 5 | School fees | 7 | Planned, target January 2027 billing |
| 6 | Teacher timetables and calendars | 8 | Planned, target start of Term 1 2027 |
| 7 | Assessment detail | rest of 5 | Planned, target Term 1 2027 |

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

Why first: the enrolment flow, portal and self-service onboarding were built in five days and
checked by hand. Before more people depend on them, the rules that protect each school's data need
automated proof, and a forgotten password must not lock anyone out.

| Item | Done when |
|---|---|
| Phone testing | Both live sites checked on an iPhone and an Android phone; no sideways scrolling, install path works. |
| Automated database tests | **Done.** `npm run test:rls` runs `supabase/tests/tenant_isolation.sql`: it builds two schools (each with an admin, a teacher and a parent with a learner and an application) as the `authenticated` role with per-user JWT claims, asserts 20 isolation and role checks, and rolls everything back. Proven to bite: weakening one policy flips the matching check to failure. Re-run before every release. CI wiring is a follow-up (needs Supabase secrets in GitHub Actions). |
| Password reset | **Flow built** on both apps: a "Forgot password?" link, a request page, and a reset page that sets a new password from the email link's recovery session. The password-change mechanic is verified against the auth API (change, sign in with the new password, change back). **Still needed:** a domain and an email provider (Resend free tier) wired into Supabase SMTP so the reset email actually delivers, then re-enable sign-up confirmation. Blocked on buying the domain. |
| Demo data | The test application `ENR-E5D24T` and the test accounts are deleted or kept as a labelled demo before real parents use the system. (Grades, bank details and the rest are the admin's to set and correct in the portal, so we do not chase the school to confirm them.) |

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
