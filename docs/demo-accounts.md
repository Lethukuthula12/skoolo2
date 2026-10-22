# Demo accounts

Disposable test logins on the pilot Supabase project, for trying the two systems during the pilot.
**Delete these before real parents and staff use Skoolo.** They are test data, not real users, and
the passwords here are for testing only.

## The two systems

| System | Who | URL |
|---|---|---|
| Parent app | Parents, on a phone | <https://skoolo-app.lethufzikhali.workers.dev> |
| School portal | Principals, admin staff and teachers | <https://skoolo-schools.lethufzikhali.workers.dev> |

Both also run locally during development: parent app on `http://localhost:4200`, portal on
`http://localhost:4300`.

## Logins

### Parent app

| Email | Password | What they are |
|---|---|---|
| `skoolo.pilot.parent1@outlook.com` | `Pilot-Parent-2026!` | A parent with one child (Sipho), who applied to Newborn Christian Primary School. Reference `ENR-E5D24T`. Use to see My applications, the inbox and a completed application. |

To test a fresh application, create a new account in the app with any email (sign-up confirmation
is off for the pilot, so it signs in immediately).

### School portal — Newborn Christian Primary School

| Email | Password | Role | What they see |
|---|---|---|---|
| `skoolo.pilot.admin@outlook.com` | `Pilot-Admin-2026!` | Administrator | Everything: applications, enrolment settings, staff register, school profile. |
| `skoolo.pilot.teacher@outlook.com` | `Pilot-Teacher-2026!` | Teacher (staff) | Only a "Home" placeholder. Teachers share the portal with admins but have no enrolment access; their class tools arrive in later stages. Use this to see what a teacher sees. |

Your own account `lethufzikhali@gmail.com` is also an administrator of this school; use your own
password for it.

## Roles, in one line

- **Administrator** (principal, clerk): enrolment, payments, staff, school settings.
- **Teacher** (staff): no enrolment access at all; sees only their own tools (none yet). Enforced
  in the database, proven by `npm run test:rls`.
