# Deploying Skoolo

Both web apps are static builds that talk to Supabase directly. We host them on **Cloudflare
Workers** with static assets: free for commercial use, static requests are free and unlimited,
edge servers in Johannesburg and Cape Town, and the same account can hold the domain's DNS later.

The repository carries everything the host needs:

- `package.json` at the root installs the web dependencies and builds each app.
- `.node-version` pins Node 22 for the host build (Wrangler needs 22; Angular 20 supports it).
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

Supabase only sends people back to addresses it knows. The current deployed addresses in
`supabase/config.toml` are:

```toml
site_url = "https://skoolo-app.lethufzikhali.workers.dev"
additional_redirect_urls = [
  "https://skoolo-app.lethufzikhali.workers.dev/**",
  "https://skoolo-schools.lethufzikhali.workers.dev/**",
  "http://localhost:4200/**",
  "http://localhost:4300/**"
]
```

After reviewing an intentional configuration change against the linked project, apply it with:

```bash
npx supabase config push
```

Do not switch the Site URL to a new hostname until its HTTPS application is working. Follow the
domain and email rollout below for `skoolo.co.za`.

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

## HOSTAFRICA domain and production email

Target: `skoolo.co.za`, registered with HOSTAFRICA, with DNS on the same Cloudflare account as
the two Workers. Registration stays with HOSTAFRICA; hosting stays on Cloudflare. This is a rollout
procedure; the verified progress as of 2026-10-25 is:

- The owner registered the domain at HOSTAFRICA with no existing website or email, then added it
  to the existing Cloudflare account on the Free plan.
- The owner's refreshed HOSTAFRICA screen confirms custom nameservers `leif.ns.cloudflare.com`
  and `marlowe.ns.cloudflare.com` are saved. Public DNS now returns that pair, and the owner's
  Cloudflare screenshot confirms zone activation.
- Resend shows `auth.skoolo.co.za` as Verified, with sending enabled, Ireland (`eu-west-1`) as the
  region and Forge enabled. Public DNS confirms both sending CNAMEs and the DKIM TXT record.
  The owner reports creating a sending API key; its value has not been shared with the agent.
- Cloudflare dashboard access remains blocked by the agent session's administrator browser
  policy. The owner performs account actions with step-by-step guidance from screenshots and
  recordings. No workaround access was used.
- The owner saved Resend SMTP in Supabase (`smtp.resend.com:465`, username `resend`, sender
  `Skoolo <no-reply@auth.skoolo.co.za>`). The API key was entered directly in Supabase. The owner
  then reported that the complete password-reset flow worked using the parent Workers address.
  Production auth URL changes, reset verification on both custom domains and signup confirmation
  are still pending.
- The owner attached `app.skoolo.co.za` and `schools.skoolo.co.za` to their corresponding Workers
  and confirmed both load correctly. Supplied browser screenshots show the parent directory and
  portal sign-in page at those addresses. Both Wrangler files now preserve these custom domains
  and keep the original Workers addresses enabled. This does not verify authentication email
  returns on the new origins.
- SMTP is currently managed in Supabase's dashboard; the repository's commented SMTP example
  is not a record of live settings. Before any future `config push`, review the proposed changes
  so the working SMTP settings and live email rate limit are preserved.

### 1. Activate DNS

1. Confirm the domain purchase is complete. If it already has a website or email, export/review its
   DNS records first, including MX, SPF, DKIM and DMARC. Preserve those records in Cloudflare before
   changing delegation; automatic scanning may miss records.
2. Add `skoolo.co.za` to the Cloudflare account that hosts Skoolo. Use the **two nameservers assigned
   to this zone**, not example nameservers from a tutorial.
3. In HOSTAFRICA's client area: **Domains → skoolo.co.za → Manage → Manage Nameservers**. Enter the
   Cloudflare-assigned pair and save. Follow Cloudflare's DNSSEC guidance if the existing domain has
   DNSSEC enabled; an old DS record must not remain attached to a different DNS provider.
4. Wait for Cloudflare to show the zone as **Active** before attaching Worker custom domains.
   This step is confirmed complete for the current domain. For future migrations, use
   **Check nameservers now** to request a check; Cloudflare also checks periodically.

References: [HOSTAFRICA nameservers](https://help.hostafrica.com/article/how-to-update-the-name-servers-for-your-domain)
and [Cloudflare zone setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/).

### 2. Attach the applications

| Worker | Custom domain |
|---|---|
| `skoolo-app` | `app.skoolo.co.za` |
| `skoolo-schools` | `schools.skoolo.co.za` |

In each Worker's **Domains → Add Domain**, first search for and select the existing zone
`skoolo.co.za`. On the next screen enter only `app` or `schools` in **Subdomain**, keep
**Production** selected, then click **Add domain**. The owner completed this flow for both apps.
Some dashboard versions use **Settings → Domains & Routes → Add → Custom Domain** instead.
Cloudflare creates the DNS record and certificate. Do not manually CNAME a hostname to
`workers.dev`. Resolve an existing record conflict only after identifying what it serves.

The corresponding routes are recorded in each Wrangler file so subsequent deployments retain
the domains attached by the owner. For `wrangler.jsonc`:

```jsonc
"workers_dev": true,
"routes": [{ "pattern": "app.skoolo.co.za", "custom_domain": true }]
```

Use `schools.skoolo.co.za` in `wrangler.portal.jsonc`. Keep `workers_dev` enabled through the
transition. Open both applications over HTTPS, including `/auth` on the parent app and `/sign-in`
on the portal, and verify direct refreshes of `/reset-password` on both. Existing installed PWAs
and browser sessions belong to the old origin: users will sign in at the new address and can
install the app again there. Do not add forced redirects until outstanding auth links are handled.

Reference: [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

### 3. Allow the email return addresses

After both custom domains work, update the existing `[auth]` block in `supabase/config.toml`:

```toml
site_url = "https://app.skoolo.co.za"
additional_redirect_urls = [
  "https://app.skoolo.co.za/auth",
  "https://app.skoolo.co.za/reset-password",
  "https://schools.skoolo.co.za/join",
  "https://schools.skoolo.co.za/register-school",
  "https://schools.skoolo.co.za/reset-password",
  "https://skoolo-app.lethufzikhali.workers.dev/**",
  "https://skoolo-schools.lethufzikhali.workers.dev/**",
  "http://localhost:4200/**",
  "http://localhost:4300/**"
]
```

Review and push the configuration as in Part 4. Signup explicitly chooses `/auth`, `/join` or
`/register-school` on the app's own origin. Reset emails return to `/reset-password` on the app
that requested them. Invitation codes, school details and passwords are not put in email return
URLs. Staff enter their original invite code after confirming; school registration collects
school details only after login. An email template's verification link must use
`{{ .ConfirmationURL }}` so the verification token and chosen destination are retained.

Reference: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

### 4. Verify the email sender and connect SMTP

Use Resend for transactional authentication email (the provider already named in Stage 0).
Verify a sending subdomain such as `auth.skoolo.co.za` and use `Skoolo <no-reply@auth.skoolo.co.za>`.
This is a sending identity, not an inbox service or another Worker.

1. In Resend, add that sending domain. Copy the exact verification, DKIM and SPF records it
   supplies into Cloudflare DNS. Preserve existing mail records. Wait for Resend verification.
2. Create a sending API key scoped to the verified domain where available. Keep it in the OS
   credential store/provider settings; never paste it into chat, commit it, or put it in a web
   environment file. Disable click tracking on authentication emails.
3. Configure Supabase custom SMTP with host `smtp.resend.com`, port `465`, username `resend`, the
   API key as password, sender name `Skoolo`, and the verified sender address.

If managing SMTP through the CLI config, the secret must be an environment reference:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "no-reply@auth.skoolo.co.za"
sender_name = "Skoolo"
```

Provide that variable securely only for configuration deployment. Review live settings before
`config push`, including rate limits and confirmation flags. The default Supabase mailer is not a
production sender. Match email limits to the chosen provider plan and expected signup volume;
do not assume the existing two-per-hour development setting is sufficient.

References: [Resend SMTP with Supabase](https://resend.com/docs/send-with-supabase-smtp),
[Resend domain verification](https://resend.com/docs/dashboard/domains/introduction) and
[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### 5. Verify delivery, then enable signup confirmation

1. Run the required `npm run test:rls`, auth checks and production builds before releasing an
   authentication/configuration change.
2. With a designated test account/mailbox, request reset emails from each custom domain. Verify
   delivery, same-app return, changing the password, the success screen, sign-in with the new
   password, and reused/expired link behaviour. Check spam placement as well as provider logs.
3. Only once delivery works, set `[auth.email].enable_confirmations = true` and deploy that
   configuration. Test parent signup, staff signup with an invite code, new school registration,
   existing-account sign-in back to `/join` and `/register-school`, and a claim of an unclaimed
   test school. Use test data; do not claim a real school's directory entry for a smoke test.
4. Verify the emails on a real phone, including a link opened in another browser. Record outcomes
   in `docs/build-log.md`. Automated controller checks do not establish email delivery or live
   acceptance. Stage 0 stays open until these checks pass.

If delivery fails, keep the existing working app addresses and diagnose SMTP/DNS before switching
the signup setting. If already enabled, repair delivery and resend confirmation links; do not
silently bypass verification for unconfirmed accounts.

## Other hosts

Cloudflare Pages, Netlify and Vercel all work with build output `web/dist/<app>/browser`.
`vercel.json` covers single-page routing on Vercel (whose free plan does not allow commercial
use). For Netlify or Cloudflare Pages add a `_redirects` file containing `/* /index.html 200` to
each app's `public/` folder; do not keep that file when deploying to Workers, which rejects it as
a redirect loop because its own `single-page-application` handling already covers it.

## Local production preview

```bash
npm run build:parent
npx http-server web/dist/parent-app/browser -p 4201 --proxy "http://localhost:4201?"
```

The service worker only registers in production builds, so this is how to test installability
before deploying.
