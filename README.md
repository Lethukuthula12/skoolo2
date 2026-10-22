# Skoolo

Enrolment platform for South African private schools. Parents find a school, apply from their
phone, upload documents and pay the enrolment fee by EFT. School staff review applications,
confirm payments and manage intake per grade from a web portal.

| Part | Where | Stack |
|---|---|---|
| Database, auth, storage, API | `supabase/` | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Parent app (PWA now, stores later) | `web/projects/parent-app` | Ionic 8 + Angular 20 + Capacitor |
| School portal | `web/projects/school-portal` | Angular 20 |
| Shared models and Supabase client | `web/projects/shared` | Angular library |

**Live:** parent app <https://skoolo-app.lethufzikhali.workers.dev> · school portal
<https://skoolo-schools.lethufzikhali.workers.dev>. Both redeploy from `main` on every push
(Cloudflare Workers, see `docs/deploy.md`).

Read `docs/decisions.md` before changing anything. It records what was agreed and why.

## Local development

```bash
cd web && npm install
npm run start:parent     # http://localhost:4200
npm run start:portal     # http://localhost:4300
```

Database changes are migrations under `supabase/migrations/`, pushed with `npx supabase db push`.
Never edit the schema in the Supabase dashboard.
