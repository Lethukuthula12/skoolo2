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
