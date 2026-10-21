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
