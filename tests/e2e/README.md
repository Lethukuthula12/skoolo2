# Skoolo Cypress and Cucumber project

Start with [the new laptop guide](../../docs/testing/new-laptop.md).
The test project has its own pinned package-lock.json and uses the root .node-version (Node 22).
It runs only against the dedicated local Supabase project and local app URLs.

- `features/automated/`: executable Cypress scenarios with step definitions.
- `features/catalogue/`: full-system manual/automation backlog scenarios, deliberately excluded from the Cypress spec pattern.
- `step-definitions/`: real browser actions and assertions. No placeholder passing steps.
- `scripts/`: setup, reset protection, fictional data, app startup and catalogue validation.
- `fixtures/accounts.json`: fictional local accounts, never production credentials.
- `reports/`: ignored HTML/JSON Cucumber reports, screenshots and downloads.
- `.local/`: ignored generated Supabase project and public browser configuration.

From the repository root, `npm run e2e:check` validates TypeScript, Gherkin, IDs, expected outcomes,
defined automated steps, generated guides and local-reset safety. It does not execute browser tests.
Run `npm run e2e:catalogue` to regenerate the manual guide and coverage matrix after a scenario edit.

To automate a manual case, implement its real step definitions, move it into automated, change
@manual to @automated and preserve its test ID. Verify it alone and in the suite before claiming it
passed. Cypress retries once in run mode; inspect retry results rather than hiding intermittent failures.

The preprocessor generates `reports/cucumber.html`, `reports/cucumber.json` and
`reports/cucumber.ndjson`. A run includes only selected executable cases; compare it with the
coverage matrix before drawing conclusions about whole-system coverage.

No service-role or database credential is exposed to browser test code. Login helpers use ordinary
test-user sessions; API permission assertions use that user's access token. Fixture setup uses
privileged access only to the dedicated local database. UI sign-in has its own cases.
