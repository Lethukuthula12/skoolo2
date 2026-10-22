# Deploying Skoolo

Both web apps are static builds that talk to Supabase directly, so any static host works. We use
**Cloudflare Pages**: free for commercial use, unlimited bandwidth, edge servers in Johannesburg
and Cape Town, and the same account can hold the domain's DNS later. The `_redirects` file in
each app's `public/` folder gives Cloudflare (and Netlify) the single-page-app routing it needs.

## Part 1: create the account and connect GitHub (once)

1. Go to <https://dash.cloudflare.com/sign-up> and create an account with your personal email.
   Confirm the email address they send you.
2. In the left menu click **Workers & Pages** (under *Compute* on some accounts).
3. Click the blue **Create** button at the top right.
4. You will see two tabs, **Workers** and **Pages**. Click **Pages**.
5. Under *Import an existing Git repository* click **Get started** (or **Connect to Git**).
6. Choose **GitHub**. A GitHub window opens asking which repositories Cloudflare may see.
   Choose **Only select repositories**, pick `Lethukuthula12/skoolo2`, and click **Install &
   Authorize**. You are returned to Cloudflare.

## Part 2: the parent app

7. In the repository list click **skoolo2**, then **Begin setup**.
8. Fill in the form. Leave anything not listed here as it is.

   | Field | Value |
   |---|---|
   | Project name |  (if taken,  or similar) |
   | Production branch |  |
   | Framework preset |  (leave blank if there is no such field) |
   | Build command |  |
   | Build output directory |  |
   | Root directory | leave empty |

   The root-level  installs the web dependencies and builds, so the root directory
   can stay empty.  pins Node 20; no environment variable is needed.

9. Click **Save and Deploy**. The first build takes three to five minutes. When it finishes you
   get a URL like . Open it: the school directory should load.

### Changing the settings of a project you already created

Open the project in **Workers & Pages**, then **Settings**, then **Builds & deployments** (on some
accounts just **Build**). Under *Build configuration* click **Edit** and change the fields above.
Then open **Deployments** and click **Retry deployment** on the latest one, or push any commit.

If the settings page has a **Deploy command** field and no **Build output directory**, the project
was created as a Worker, not a Pages project. Delete it (Settings, bottom of the page) and create
it again from **Create**, then the **Pages** tab.

## Part 3: the school portal

10. Go back to **Workers & Pages**, click **Create**, then **Pages**, then **Connect to Git**
    again. Choose  again and click **Begin setup**.
11. Fill in the form:

    | Field | Value |
    |---|---|
    | Project name |  |
    | Production branch |  |
    | Framework preset |  |
    | Build command |  |
    | Build output directory |  |
    | Root directory | leave empty |

12. **Save and Deploy**. You get .

From now on every push to  rebuilds both sites automatically.

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

- Open the failed deployment in Cloudflare and read the log. `ng: not found` means the build
  command is not `npm run build:parent` / `npm run build:portal` as given above; a missing output
  means the build output directory does not start with `web/dist/`.
- The same build runs on GitHub Actions on every push, so the repository's **Actions** tab shows
  whether the code itself builds.

## Custom domain later

When you own `skoolo.co.za`: in each Pages project open **Custom domains**, add `app.skoolo.co.za`
to the parent app and `schools.skoolo.co.za` to the portal, and follow the DNS instructions shown.
If the domain's DNS is on Cloudflare, it is one click. Then update the Supabase addresses in
Part 4 again.

## Other hosts

Netlify works the same way with the same build settings and the `_redirects` files. Vercel also
works (`vercel.json` is in the repo), but its free plan does not allow commercial use.

## Local production preview

```bash
npm run build:parent
npx http-server web/dist/parent-app/browser -p 4201 --proxy "http://localhost:4201?"
```

The service worker only registers in production builds, so this is how to test installability
before deploying.
