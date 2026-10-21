# Deploying Skoolo

Both web apps are static builds that talk to Supabase directly, so any static host works. The
instructions below are for Vercel, which handles two projects from one repository cleanly. Netlify
works the same way; the `_redirects` files in each app's `public/` folder cover its SPA routing.

## One-time setup on Vercel

1. Sign in at vercel.com with GitHub and import `Lethukuthula12/skoolo2`.
2. Create the **parent app** project:
   - Project name: `skoolo-app`
   - Root Directory: `web`
   - Framework preset: Other
   - Build Command: `npm run build:parent`
   - Output Directory: `dist/parent-app/browser`
   - Install Command: `npm ci`
3. Import the same repository again and create the **school portal** project:
   - Project name: `skoolo-schools`
   - Root Directory: `web`
   - Build Command: `npm run build:portal`
   - Output Directory: `dist/school-portal/browser`
   - Install Command: `npm ci`
4. Deploy. Every push to `main` redeploys both.

The repository's `vercel.json` adds the SPA rewrite and keeps the service worker files uncached.

## After the first deploy

1. Note the two URLs, for example `https://skoolo-app.vercel.app` and `https://skoolo-schools.vercel.app`.
2. In `supabase/config.toml`, set `site_url` to the parent app URL and add both URLs to
   `additional_redirect_urls`, then run:

   ```bash
   npx supabase config push
   ```

3. Open the parent app URL on a phone. In Chrome on Android use the menu and choose
   "Add to Home screen" or "Install app". On iPhone use Share and "Add to Home Screen".
4. Share the parent app link with the school. A QR code of the URL on a poster at the gate works
   well; any free QR generator will do.

## Custom domain later

Add `app.skoolo.co.za` and `schools.skoolo.co.za` (or whatever domain you buy) to the two Vercel
projects, point the DNS CNAME records at Vercel, and update the Supabase URLs above.

## Local production preview

```bash
npm run build:parent
npx http-server web/dist/parent-app/browser -p 4201 --proxy "http://localhost:4201?"
```

The service worker only registers in production builds, so this is how to test installability
before deploying.
