# Skoolo system test plan

The goal is to verify complete work across administrators, teachers and families, including what the
next person sees after a save. Scenario definitions in tests/e2e/features are the shared source for
manual acceptance and Cypress automation. Local fictional data is the default; no live pupil records
or payments are used.

## Scope and priorities

All current modules are mapped in [coverage-matrix.md](coverage-matrix.md): authentication,
school setup, staff, classes/subjects, learners, family linking, enrolment, attendance/absence,
assessment papers, assessments, reports, fees, messaging, notices, timetable, calendar and shared UX.
Three full journeys verify school-to-family onboarding, teacher-to-parent results and daily communication.

P0 protects essential journeys, permissions and saved data. P1 covers validation, edge cases and
recovery. Planned requirements are specifications only. Existing database isolation and synthetic
security/session/paper/feedback checks remain separate evidence and should continue running.

Every case checks an observable outcome; saved data should be verified after refresh and across the
relevant role when appropriate. Failures, boundary values, wrong-school requests and unassigned roles
must be included. An alert alone does not establish persistence. Database tests cover direct API/RLS
rules as well as UI restrictions.

## Execution

1. Record commit, date and environment. Run local:doctor and create a fresh local:setup.
2. Run e2e:check and test:rls:local. Start both apps through local:start.
3. Execute the automated suite at desktop and 375px viewport; keep reports and failures.
4. Follow manual journeys with separate browser profiles for principal, teacher and parent.
5. Test the remaining cases by module, preparing each Given independently.
6. Perform real Android/iOS installation, keyboard, screen-reader, visual and print acceptance.
7. Retest fixes and record remaining blockers with affected case IDs.

No scenario should depend on a previous scenario having passed. Local setup gives a baseline; a
scenario must prepare additional records it needs. Browser tests use real local Auth/API/database
writes except explicit simulated failure paths. Test setup may use local privileged credentials;
behaviour assertions use normal users. Production addresses are rejected by the automation config.

## Results and release decisions

Keep manual and automated outcomes separate: Passed, Failed, Blocked, Not run.
A flaky retry is an investigation item, not proof that an intermittent issue is fixed.
Do not classify unexecuted manual cases as passing because the automated smoke suite is green.
P0 defects affecting access, data integrity or completion must be resolved before accepting the
affected journey. Lower priority findings need an owner and explicit disposition.

A run record includes test ID, commit, account role, device/browser, expected and actual result,
evidence, defect reference and retest outcome. Track scenario coverage and executed coverage separately.
School acceptance still requires actual users completing their work; this suite does not change the
roadmap's definition of done.

## CI and continued work

The E2E workflow validates TypeScript, Gherkin, stable IDs, step bindings, generated documentation
and local-reset guards on relevant pushes and pull requests. A manually dispatched optional job can
provision local Supabase and run browser smoke tests on a GitHub runner. It needs no production
credentials. That job is separate from the existing Cloudflare deployments.

Next automation priority: TC_JOURNEY_001, then TC_JOURNEY_002, then TC_JOURNEY_003. Keep scenarios
readable, add reusable steps only where useful, and move cases to automated only with real assertions.

References: [Cucumber preprocessor](https://github.com/badeball/cypress-cucumber-preprocessor),
[Cypress isolation](https://docs.cypress.io/app/core-concepts/test-isolation),
[cross-origin support](https://docs.cypress.io/app/guides/cross-origin-testing),
[Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
