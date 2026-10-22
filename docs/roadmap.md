# Skoolo — roadmap

Written 2026-10-22 from the feature list the pilot school gave us. Enrolment for 2027 has closed,
so the order favours what the school can use this term and next year's first weeks.

**How we work:** one stage at a time. A stage is not done until it passes the definition of done
in the `skoolo` skill (`.claude/skills/skoolo/SKILL.md`): agreed with the school, tested
automatically and by hand in every affected role, deployed, and used by a real person at the
school. Nothing in the next stage starts while the current one has open bugs.

## Status

| Stage | What | Requests | Status |
|---|---|---|---|
| 0 | Make what exists solid | — | **Next** |
| 1 | Learners and classes | 1, part of 3 | Planned |
| 2 | Connect parents to their children | prerequisite for 2, 4, 6 | Planned |
| 3 | Send reports to parents | 2 | Planned, target before Term 4 reports go home (early December 2026) |
| 4 | Messages between home and school | 4, 6 | Planned |
| 5 | School fees | 7 | Planned, target January 2027 billing |
| 6 | Teacher timetables | 8 | Planned, target start of Term 1 2027 |
| 7 | Assessment results and report cards | 5, rest of 3 | Planned, target end of Term 1 2027 |

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
| Automated database tests | One command runs a script that creates two schools, each with an admin, a teacher and a parent, inside a transaction that is rolled back. It proves: neither school can read or change the other's applications, learners, documents, staff register, invites or bank details; teachers cannot confirm payments or change statuses; a full grade rejects an application; invalid status changes are rejected; invite codes are single-use, bound to an email and expire. It passes, and is re-run before every release. |
| Password reset | A domain is bought, email sends through a provider (Resend free tier), Supabase auth uses it, and "Forgot password" works on both live sites. Sign-up confirmation is switched back on. **Blocked on buying the domain.** |
| Loose ends | The school confirms Grade 0 is distinct from Grade R and the Capitec account holder name. Test application `ENR-E5D24T` and test accounts are deleted or kept as a labelled demo. |

## Stage 1 — Learners and classes

Why: every other request needs to know which learner is in which class and who teaches it.

The school teaches in two ways, and the model must hold both from the start:

- **Class teacher grades** (Grade 00 to Grade 3 at the pilot school): one teacher teaches the class
  everything.
- **Subject teacher grades** (Grade 4 to Grade 7): each subject in a class has its own teacher, and
  one teacher may teach the same subject to several classes. Each class still has a class teacher
  for registration and pastoral care.

Which grades work which way is a school setting, not a rule in code. Other schools draw the line
elsewhere.

The school can:

- Set up its subjects per grade (CAPS defaults offered, editable).
- Create classes for a year and grade (for example Grade 3A), and assign a class teacher from the staff register.
- For subject teacher grades, assign a teacher to each subject in each class.
- Import its current learners from an Excel or CSV template, or add them one at a time, with parent or guardian contact details.
- Move learners between classes.
- When accepting an application, choose the class; the learner joins the register automatically.
- Export a class list to Excel and PDF.

A teacher who signs in sees the classes they teach: their own class, or every class where they
teach a subject, and nothing else.

Done when the admin has imported the real learners, every class has a class teacher, every subject
in Grades 4 to 7 has a teacher, a real teacher sees only the classes they teach, and a class list
opens correctly in Excel.

## Stage 2 — Connect parents to their children

Why: reports, messages and absence notes reach nobody until a parent account is linked to a learner.

- The school generates a family code per learner and shares it by WhatsApp, in bulk per class.
- The parent enters the code in the parent app and sees the child under "My children".
- Parents who applied through Skoolo are linked automatically when the application is accepted.
- The school sees which families are connected and who still needs a nudge.

Done when ten real families are connected.

## Stage 3 — Send reports to parents

Why: the school called it a massive pain point, and Term 4 reports go home in early December.

- The admin uploads one PDF per learner, or a batch whose file names are matched to learners, reviews the matches, and publishes per class.
- The parent gets an inbox message and opens the report in the app.
- The school sees who has opened it and who has not, so it knows whose report still needs printing.

Not in this stage: generating report cards from captured marks. That is Stage 7, and it will feed
this same delivery.

Done when one class's real Term 4 reports reach parents through Skoolo.

## Stage 4 — Messages between home and school

- A parent reports an absence: which child, which days, the reason, and optionally a photo of a doctor's note. The class teacher and the office see it, and the parent gets an acknowledgement.
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

Not in this stage: card payments and automatic bank statement matching.

Done when January 2027 fees for the real learners are on Skoolo and the clerk records a month of payments with it.

## Stage 6 — Teacher timetables

Assumption until the school confirms: "calendar" means the teacher's weekly timetable of periods,
plus their own dated items such as tests and assignment due dates.

- The school sets its day structure once: periods, times and breaks.
- A teacher builds their weekly timetable from the classes and subjects they are assigned in
  Stage 1, so they can only place lessons they actually teach. Clashes are flagged.
- A teacher adds dated items such as tests, assignment due dates and outings to their calendar.
- The teacher views or prints their week, and exports it to a phone calendar.
- The admin sees every teacher's timetable and a timetable per class, and can spot double-booked
  classes.

Done when every Grade 4 to 7 teacher at the pilot school has their 2027 timetable in Skoolo.

## Stage 7 — Assessment results and report cards

- Assessments per subject per term, mark capture by the subject teacher or class teacher.
- The principal reviews and approves before results are final.
- Pass or fail per the CAPS promotion requirements for each phase.
- Filtered exports to Excel and PDF: passed, failed, by subject, by class.
- Report cards generated from approved marks and sent through Stage 3.

Done when Term 1 2027 results are captured, approved and exported for a real class.

## Questions to ask the school

| For stage | Question |
|---|---|
| 1 | How many classes per grade, and what are they called (3A and 3B, or names)? |
| 1 | Is there a current learner list in Excel? Which columns does it have? |
| 3 | What produces reports today: SA-SAMS, other software, Excel, or by hand? Can it give one PDF per learner? |
| 4 | Who should receive an absence note: the class teacher, the office, or both? |
| 5 | Fee amounts per grade, any discount for paying per term or per year, and how parents pay today (reference used, cash). Is there a debtors list now? |
| 5 | Who records payments and who confirms them? (Earlier: the admin clerk receives, the principal confirms.) |
| 1 | Do Grade 00, Grade 0, Grade RR and Grade R also have one class teacher each? Which subjects are taught in Grades 4 to 7? |
| 6 | Does "calendar" mean the weekly timetable of periods, a calendar of tests and events, or both? Who builds the timetable today, each teacher or the principal? How many periods a day, and what times? |
| 7 | Who captures marks: teachers in the system with the principal approving, or the admin typing in results the principal approved on paper? |
| 7 | Which promotion rules do they apply per phase? |
