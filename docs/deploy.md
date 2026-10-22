# Deploying Skoolo

Both web apps are static builds that talk to Supabase directly. We host them on **Cloudflare
Workers** with static assets: free for commercial use, static requests are free and unlimited,
edge servers in Johannesburg and Cape Town, and the same account can hold the domain's DNS later.

The repository carries everything the host needs:

- `package.json` at the root installs the web dependencies and builds each app.
- `.node-version` pins Node 20.
- `wrangler.jsonc` deploys the parent app; `wrangler.portal.jsonc` deploys the portal. Both serve
  the built folder as static assets with single-page-app routing.
- `_headers` in each app's `public/` folder keeps the service worker files uncached.

## Part 1: create the account and connect GitHub (once)

1. Go to <https://dash.cloudflare.com/sign-up> and create an account with your personal email.
   Confirm the email address they send you.
2. In the left menu click **Workers & Pages** (under *Compute* on some accounts).
3. Click **Create**, then under *Workers* choose **Import a repository** (or *Connect to Git*).
4. Choose **GitHub**. A GitHub window opens asking which repositories Cloudflare may see.
   Choose **Only select repositories**, pick `Lethukuthula12/skoolo2`, and click **Install &
   Authorize**. You are returned to Cloudflare.

## Part 2: the parent app

5. Click **skoolo2** in the repository list.
6. Fill in the form:

   | Field | Value |
   |---|---|
   | Project name | `skoolo-app` (must match the `name` in `wrangler.jsonc`) |
   | Production branch | `main` |
   | Build command | `npm run build:parent` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | leave empty |

7. Click **Create and Deploy**. The first build takes three to five minutes. You get a URL like
   `https://skoolo-app.<your-subdomain>.workers.dev`. Open it: the school directory should load.

### Changing the settings of a project you already created

Open the project in **Workers & Pages**, then **Settings**, scroll to **Build configuration**, and
set the fields above. Make sure **Disable builds** is off. Then open **Deployments** and retry the
latest deployment, or push any commit.

## Part 3: the school portal

8. **Workers & Pages**, **Create**, **Import a repository**, choose `skoolo2` again.
9. Fill in the form:

   | Field | Value |
   |---|---|
   | Project name | `skoolo-schools` (must match the `name` in `wrangler.portal.jsonc`) |
   | Production branch | `main` |
   | Build command | `npm run build:portal` |
   | Deploy command | `npx wrangler deploy --config wrangler.portal.jsonc` |
   | Root directory | leave empty |

10. **Create and Deploy**. You get `https://skoolo-schools.<your-subdomain>.workers.dev`.

From now on every push to `main` rebuilds and redeploys both.

If a project was created under a different name, either create it again with the name above, or
change the `name` field in the matching `wrangler*.jsonc` file to the project's name.

## Part 4: tell Supabase about the new addresses

Supabase only sends people back to addresses it knows. In `supabase/config.toml` set:

```toml
site_url = "https://skoolo-app.pages.dev"
additional_redirect_urls = ["https://skoolo-app.pages.dev", "https://skoolo-schools.pages.dev", "http://localhost:4200", "http://localhost:4300"]
```

then run:

```bash
npx supabase config push
```

(Replace the two addresses with the real ones Cloudflare gave you.)

## Part 5: put it on a phone

Open the parent app address in Chrome on Android, tap the menu, and choose **Install app** or
**Add to Home screen**. On iPhone, open it in Safari, tap **Share**, then **Add to Home Screen**.
The icon and the full-screen behaviour come from the manifest in the build.

Share the parent app address with the school. A QR code of the URL on a poster at the gate works
well; any free QR generator will do.

## If a build fails

Open the failed deployment in Cloudflare and read the log.

- `ng: not found` means the build command is not exactly `npm run build:parent` or
  `npm run build:portal`.
- A wrangler error about a missing entry point or assets directory means the deploy command does
  not match the table above, or the build did not produce `web/dist/...`.
- A name mismatch means the project name and the `name` in the wrangler file differ.
- The same build runs on GitHub Actions on every push, so the repository **Actions** tab shows
  whether the code itself builds.

## Custom domain later

When you own `skoolo.co.za`: in each Worker open **Domains & Routes**, add `app.skoolo.co.za`
to the parent app and `schools.skoolo.co.za` to the portal, and follow the DNS instructions shown.
If the domain's DNS is on Cloudflare, it is one click. Then update the Supabase addresses in
Part 4 again.

## Other hosts

Cloudflare Pages, Netlify and Vercel all work with build output `web/dist/<app>/browser`; the
`_redirects` files cover single-page routing on Pages and Netlify, `vercel.json` covers Vercel
(whose free plan does not allow commercial use).

## Local production preview

```bash
npm run build:parent
npx http-server web/dist/parent-app/browser -p 4201 --proxy "http://localhost:4201?"
```

The service worker only registers in production builds, so this is how to test installability
before deploying.
