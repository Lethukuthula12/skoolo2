# Set up Skoolo on a new laptop

This guide restores development and testing from GitHub. No file from the old laptop is required
for the fictional local environment. The live database and hosting stay in their existing accounts.

## Install prerequisites

1. Install Git: https://git-scm.com/downloads
2. Install **Node 22.18 or newer in the Node 22 line**, with npm: https://nodejs.org/en/download
   The repository's .node-version selects Node 22. Node 20 can build the application but is not
   supported by all dependencies in the new test project.
3. Install and start Docker Desktop: https://docs.docker.com/desktop/
   On Windows use Linux containers and finish Docker's WSL 2 setup if requested. Restart if required.
   On Linux, a working Docker Engine is also sufficient.
4. Install Chrome for interactive browser tests. Cypress can also use its bundled Electron.
   Linux needs Cypress's documented system packages:
   https://docs.cypress.io/app/get-started/install-cypress#Linux-Prerequisites
5. Ensure internet access for npm, the initial Docker image downloads and the local Turnstile test
   widget. Allow enough disk space for Docker images, dependencies and the Cypress browser.

## Clone and install

Run these from PowerShell, Terminal or a command prompt:

```sh
git clone https://github.com/Lethukuthula12/skoolo2.git
cd skoolo2
node --version
npm run setup:tools
npm run local:doctor
```

Use the same repository on every laptop; do not create a new Supabase hosted project for these tests.
Both web/package-lock.json and tests/e2e/package-lock.json are committed. setup:tools uses npm ci,
including the Cypress binary installation. No global Angular, Cypress or Supabase installation is
needed. If PowerShell blocks npm.ps1, use npm.cmd for the same commands.

## Create the fictional local environment

```sh
npm run local:setup
npm run local:start
```

Keep the second command running. Wait until **both Angular applications finish building**.

| Service | Address |
|---|---|
| Parent app | http://localhost:4400 |
| School portal | http://127.0.0.1:4400 |
| Supabase API | http://127.0.0.1:55321 |
| Database | 127.0.0.1:55322 |
| Supabase Studio | http://127.0.0.1:55323 |
| Captured local email | http://127.0.0.1:55324 |

The two app addresses intentionally use different hostnames on one port for Cypress cross-app
testing. Use these exact addresses. Angular runs behind them on ports 4200 and 4300.

local:setup creates the separate Docker project **skoolo-e2e**, copies repository migrations, resets
only that local database and seeds fictional data. It generates the ignored Angular local environment
and Cypress browser configuration. Re-running setup or reset discards local test data; it never uses
--linked or a hosted project reference. Historical pilot rows created by migrations are removed from
this local copy before fictional fixtures are inserted.

**Use local:start for local testing.** The older start:parent / start:portal commands still use the
existing hosted public configuration. The local script refuses to start without local setup.

The generated files are intentionally absent from Git. Regenerate them on the new laptop:
tests/e2e/.local/ and web/projects/shared/src/lib/environment.local.ts.
Do not copy access tokens, node_modules, Docker volumes or CLI credentials between laptops.

## Fictional accounts and data

All eight accounts have password **Skoolo-Local-Only-2026!**. They are created already confirmed.

| Role | Email | Starting access |
|---|---|---|
| Administrator A | admin.a@example.test | Test School A |
| Teacher A | teacher.a@example.test | School A, Grade 3 A |
| Unassigned teacher | unassigned.a@example.test | School A without a class |
| Parent A | parent.a@example.test | Lerato Learner A |
| New parent | new.parent@example.test | No linked children |
| Administrator B | admin.b@example.test | Test School B |
| Teacher B | teacher.b@example.test | School B, Grade 3 A |
| Parent B | parent.b@example.test | Lerato Learner B |

Each school has a current-year Grade 3 A class, Mathematics and English, four terms, one learner and
an open intake. Grade 3 has capacity 3, Grade 4 has capacity 0 and Grade 1 is closed.
Family codes: **FAMILYA23** and **FAMILYB23**.
All banking information is fictional: DO NOT PAY. The current calendar year is used when resetting;
select that year in module filters. If the date crosses into a new year, reset before a test session.

Test School A learner ID: e3000000-0000-4000-8000-000000000001.
Test School B learner ID: e3000000-0000-4000-8000-000000000002.
Test School A ID: e0000000-0000-4000-8000-000000000001.
Test School B ID: e0000000-0000-4000-8000-000000000002.

For scenarios requiring new schools, documents, workbooks, reports or fees, prepare the stated
Given conditions using the appropriate administrator or parent UI. Copy the import template from
the learner screen and use fictional records. There are no pre-seeded payments or published reports.

For the school-registration journey, verify only the newly created fictional school in local Studio:
```sql
update public.schools set is_verified = true where slug = 'your-fictional-school-slug';
```
Check the Studio address is the local port 55323 first. Verification remains an operator action.
Read local confirmation/reset emails at port 55324; these messages are not delivered externally.

The local browser uses Cloudflare's always-pass test site key. Local Supabase CAPTCHA enforcement is
disabled so general functional tests do not depend on real anti-bot decisions. This setup does not
prove hosted CAPTCHA enforcement; provider/failed-token acceptance remains separate.

## Run checks and browser tests

In another terminal, from the repository root:

```sh
npm run e2e:check
npm run test:rls:local
npm run e2e:open
```

In Cypress choose E2E testing, choose a browser and select a feature.
For command-line execution:

```sh
npm run test:e2e
npm run test:e2e:mobile
```

The first command executes ten automated scenarios. Mobile uses a 375 by 812 browser viewport;
it does not replace testing on a physical phone. Reset before an independent acceptance session:

```sh
npm run local:reset
```

Restart local:start after resetting, and sign in again because sessions were invalidated.
Do not reset while a test run is active.

Outputs are under tests/e2e/reports/: cucumber.html, cucumber.json, cucumber.ndjson and failure
screenshots. These files are ignored by Git. Save evidence with the tested commit ID.
e2e:check validates definitions and setup guards; it is not a browser execution result.

## Manual testing and finishing automation

Open [the coverage matrix](coverage-matrix.md) and [manual cases](manual-test-cases.md).
There are 123 scenarios: 10 with Cypress definitions, 112 manual cases and 1 planned requirement.
The manual set includes three complete journeys. Start with TC_JOURNEY_001 for school-to-family
onboarding, TC_JOURNEY_002 for paper-to-report work, and TC_JOURNEY_003 for daily communication.

For every run record commit, date, tester, browser/device, actual result, evidence and:
**Passed / Failed / Blocked / Not run**. Keep a copy of the manual guide as your execution record;
the original is regenerated from Gherkin. Do not count manual or planned scenarios as automated passes.
Future staff timeout requirements remain planned until the server controls are implemented.

To continue automation without this chat: choose a manual scenario, preserve its ID, write actual
step definitions, move it into features/automated, change @manual to @automated, regenerate the
catalogue and run it independently. The next priority is automating the three complete journeys.

## Stop and restart

Ctrl+C in the app terminal stops both Angular apps and the local proxy.
`npm run local:stop` stops only skoolo-e2e Docker services and retains their volumes.
Run local:setup for a fresh reproducible environment, then local:start.

## Troubleshooting

- **docker not found or daemon unavailable:** finish Docker installation, start it and rerun doctor.
- **Node engine error:** use Node 22.18+ in the Node 22 line, then rerun setup:tools.
- **Port already in use:** stop older app processes using 4200, 4300 or 4400, or the conflicting
  test services using 55320–55324. Do not change one port without updating all matching configuration.
- **Missing local config or environment.local.ts:** run local:setup; these files are generated.
- **Cypress binary missing:** run `npm --prefix tests/e2e exec -- cypress install`.
  Remove CYPRESS_INSTALL_BINARY=0 from your own shell if previously set.
- **Windows execution policy:** use npm.cmd; do not weaken machine security policies just for npm.
- **503 from local app:** wait for both Angular build messages or inspect the app terminal errors.
- **Challenge cannot load:** allow challenges.cloudflare.com; the functional test key is intentional.
- **Invalid login after reset:** close old tabs and sign in again using the table above.
- **Missing module data:** select the current year and prepare the scenario's Given state.
- **Migration failure:** preserve the error and stop; do not point the setup at production.
- **Manual guide is stale:** run e2e:catalogue, review the diff and commit it with scenario changes.

## Before handing over the old laptop

Verify the latest commit is on GitHub and that git status has no work you still need.
Store access to GitHub, Supabase, Cloudflare, authentication email and their recovery methods in
your password manager. Local testing needs none of their private production keys.
Hosting secrets stay with those providers; do not add them to Git or the test account file.
Sign out of personal accounts and revoke this device's credentials through your normal handover
process. Copy any uncommitted manual evidence you want to keep; generated test databases are disposable.

## Verification at handover

The catalogue and TypeScript/setup checks are recorded in docs/build-log.md.
GitHub validated commit ce6bc4d: catalogue and application checks passed, and both Cloudflare
deployments succeeded. The optional browser job was skipped, not passed.
This laptop has no Docker command available, so a full fresh-database bootstrap and Cypress browser
run have not been verified here. Managed browser policy also restricted UI testing in this session.
The guide and failure checks support a repeatable setup; they do not guarantee an untested machine
will need no troubleshooting. Complete doctor, setup, local RLS and the ten browser cases first.
