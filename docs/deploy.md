# Deploying Skoolo

Both web apps are static builds that talk to Supabase directly. We host them on **Cloudflare
Workers** with static assets: free for commercial use, static requests are free and unlimited,
edge servers in Johannesburg and Cape Town, and the same account can hold the domain's DNS later.

The repository carries everything the host needs:

- `package.json` at the root installs the web dependencies and builds each app.
- `.node-version` pins Node 22 for the host build (Wrangler needs 22; Angular 20 supports it).
- `wrangler.jsonc` deploys the parent app; `wrangler.portal.jsonc` deploys the portal. Both serve
  the built folder as static assets with single-page-app routing.
- `_headers` in each app's `public/` folder keeps the service worker files uncached and defines
  browser security headers.

## Browser security rollout

Both apps' static responses now configure `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy: no-referrer`, and restricted geolocation/microphone/payment/USB permissions.
The enforced CSP disallows framing and embedded objects and restricts the base URL to the same
origin. A separate **report-only** CSP restricts scripts to the app origin and lists the current
Supabase and Google Fonts origins. Inline styles remain allowed for Angular/Ionic compatibility;
inline scripts and eval are not permitted in the proposed policy. Existing static SVG icon
templates are code-owned; arbitrary user HTML must never be passed to a trust-bypass API.

Report-only violations currently appear in browser DevTools; there is no collection endpoint.
Before enforcing the full policy, check sign-in, confirmation/reset returns, navigation, school
branding, file uploads, print previews and the installed parent PWA on both custom domains.
Inspect document response headers on nested routes as well as the root. Angular's generated
critical-CSS loading and any host-injected scripts may produce violations that must be resolved
deliberately. Do not add broad script exceptions just to silence them. HSTS expansion and Trusted
Types enforcement remain pending compatibility and live HTTPS checks.

The report and roster print documents separately enforce a script-free meta CSP, escape stored
text, accept only credential-free absolute HTTPS stamp URLs and detach the popup's opener.
Their printed layout and stamp loading still need a live browser check. Agent browser access is
restricted, so compiled files and parsed HTML checks are not proof of the deployed headers or
browser behaviour.

Run `npm run check:security` in `web/` for the synthetic-data security/import checks. GitHub Actions
runs them and `npm audit --audit-level=high` before its production builds, using Node 22 from the
same `.node-version` file as hosting. Cloudflare's Git-triggered builds are separate from that
workflow; this is not a claim that GitHub CI gates deployment. SheetJS 0.20.3 comes from its
[official pinned tarball](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), with
SHA-512 integrity in `web/package-lock.json`. Do not replace it with npm's older 0.18.5 package.
Local Node 20 still produces the existing Supabase SDK engine warning; the local runtime has not
been changed by this batch.

## Session lifecycle rollout

Both apps remove their routed content on sign-out, session loss, a different signed-in account,
or access-token expiry without renewal. A status screen offers a normal link that starts a fresh
document, rather than reusing Angular/Ionic page instances. Portal memberships/selection and themes
are reset, and late membership/storage responses are ignored after the account context changes.
Switching accounts on an invitation reloads the existing invitation URL after successful sign-out.
Password-change completion clears the entered passwords and retains its success message.

Sign-out keeps the existing Supabase `global` scope. A returned error or thrown request is surfaced:
if the SDK has removed the local session, the message says that remote sign-out was not confirmed;
if credentials remain, account pages stay hidden and a retry is offered. No tokens or raw provider
errors are included in that message. Ordinary token refresh for the same account keeps the workspace.
Expiry is checked against the SDK's access-token timestamp and again on focus/resume. This protects
displayed state; it is not an idle-timeout policy or a new server authorization check.

Supabase broadcasts auth events between same-origin tabs. The two production subdomains have
separate browser storage; there is no immediate cross-domain logout broadcast. Successful global
sign-out revokes refresh tokens, but already-issued access tokens can remain valid until their
expiry. This batch adds no per-request `auth.sessions` check. See
[Supabase sign-out semantics](https://supabase.com/docs/guides/auth/signout).

Run `npm run check:sessions` in `web/` for the lifecycle and existing auth-form checks. They use
synthetic SDK/storage responses, not real browser tabs. Before accepting Stage 0, check both apps:
sign out in one of two open tabs, switch accounts, resume after expiry, simulate an offline logout,
retry, follow a reset email and switch accounts from an invitation. Check browser Back and the
installed parent PWA too. Browser access remains restricted, so these live checks are still open.

Hosted session/JWT settings, refresh rotation, password-change controls, CAPTCHA/rate limits and
redirect allowlists still need verification. Do not change working SMTP configuration as part of
that review. The owner confirmed **Supabase Free** and approved **30 minutes idle/eight hours
maximum for staff** on 2026-10-25. These limits are not enabled; the parent policy is undecided.
Supabase's hosted lifetime controls require Pro or above and measure inactivity using session
refresh, which is not the same as keyboard/mouse inactivity. They are project-wide rather than
separate policies for each app. Plan enforcement in the proposed server layer. See
[Supabase session limits](https://supabase.com/docs/guides/auth/sessions#limiting-session-lifetime-and-number-of-allowed-sessions-per-user).
HttpOnly server-managed sessions and MFA remain future work; tokens still use the existing SDK
browser storage in this release.

## Secure password change rollout

Both password-reset screens support Supabase's recent-authentication challenge. A fresh recovery
session continues through the existing password form. If the server requests reauthentication,
the screen offers **Send verification code**, accepts the code and includes it as `nonce` in
`auth.updateUser`. `auth.reauthenticate` sends the code to the account's confirmed contact; current
Skoolo accounts use confirmed email. This flow does not use `verifyOtp` to start a different session.

**Owner confirmed Secure password change enabled on 2026-10-25.** The following live checks
remain open; this confirmation was supplied by the owner, not inspected through the dashboard.

1. Open the Skoolo Supabase project, **Authentication → Sign In / Providers → Email** (the email
   provider settings), enable **Secure password change**, then save. Keep SMTP credentials,
   redirect URLs and existing email confirmation settings as configured.
2. Check a fresh reset-email flow in each app: return, save, sign out and sign in with the new
   password. Recent sessions need not display the code step. The installed Supabase SDK documents
   a recent session as one created within the preceding 24 hours, so enabling this option does
   not require a code on every password change.
3. Check an older signed-in session on `/reset-password`: it should display the verification step
   when the server requires it. Send a code, try an invalid one, then complete with the valid
   code and verify sign-in with the new password. Do not edit token timestamps to manufacture
   an older session. Confirm the reauthentication email template includes the one-time code.

Browser security policy denied the agent access to the Supabase dashboard. The agent did not
change provider settings or independently verify live challenge email delivery. Repository
`supabase/config.toml` still has its local default of
`secure_password_change = false` and is not a hosted-settings snapshot. Do not use a broad
`supabase config push` to activate this change: it could overwrite working SMTP and other settings.

`npm run check:sessions` covers synthetic challenges, nonce forwarding, invalid/expired codes,
rate limits, retries, duplicate requests and stale results. The 60-second resend cooldown is a UI
guard only; Supabase must enforce the actual limits. Codes/passwords are not added to storage or
logs; they clear on success/destruction and when leaving an Ionic cached page. Browser layout,
focus, mobile keyboard and live provider enforcement still need the checks above.
See [Supabase reauthentication](https://supabase.com/docs/reference/javascript/auth-reauthenticate).

## Turnstile authentication rollout

Both apps now pass a fresh Cloudflare Turnstile token to Supabase for sign-in, account creation
and password-reset email requests. This includes school registration and invitation signup.
The owner supplied the public Site Key used in `web/projects/shared/src/lib/environment.ts`.
The private Secret Key belongs only in Supabase's hosted CAPTCHA settings, never in the app,
repository, logs or chat. The requested Managed widget hostname allowlist is:

- `app.skoolo.co.za`
- `schools.skoolo.co.za`
- `skoolo-app.lethufzikhali.workers.dev`
- `skoolo-schools.lethufzikhali.workers.dev`

**Server enforcement is pending owner activation after both deployments finish:**

1. Wait for the parent and school Cloudflare production deployments containing this change to
   succeed. Reload both apps, including installed PWAs, and confirm the security check loads
   and completes on their sign-in screens. Older cached clients lack the required token.
2. Open Supabase **Authentication → Bot and Abuse Protection → Enable CAPTCHA protection**
   (under project Authentication settings), select **Turnstile**, enter this widget's private
   Secret Key and save. Do not send the secret to the agent. Do not push the entire local
   `supabase/config.toml`, which is not a snapshot of the working hosted SMTP/auth settings.
3. With controlled test accounts, verify sign-in, signup/confirmation and reset emails in both
   apps, plus school registration and invitation signup. Check a wrong-password retry, expiry,
   widget retry, narrow-screen layout and an installed PWA. Verify missing/invalid tokens are
   rejected server-side without creating accounts or sending unintended emails.

Supabase validates these tokens server-side; the app must not consume them with a separate
Siteverify request. The component removes used tokens, handles expiry/network failures and
offers a fresh challenge on retry. Authenticated password updates and reauthentication codes
retain their existing flow. The report-only CSP allows only Cloudflare's challenge origin for
the provider script and iframe; the baseline enforced policy remains unchanged.

Synthetic tests cover all seven forms, SDK token forwarding, consumed/expired tokens, stale
callbacks, widget cleanup and failures. They do not establish real Cloudflare/Supabase acceptance.
Browser security policy prevents the agent from inspecting the private dashboards and relevant
app origins; no alternate access path was used. Hosted CAPTCHA activation, rate-limit review
and the live checks above remain open. No hosted provider setting changed in this release.

Local synthetic tests stub the provider and make no network calls. For interactive local work,
use a separate development Supabase project and a separate test widget/key pair as described by
Cloudflare; never put a test Site Key into the production bundle or add localhost to this
production widget as a shortcut.

References: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/),
[Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

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

Supabase only sends people back to addresses it knows. The repository's `supabase/config.toml`
now sets `https://app.skoolo.co.za` as the Site URL and includes the five exact custom-domain
return paths listed in step 3 below, alongside the four existing Workers/local development URLs.
Both apps have been confirmed to load on their custom domains.

The owner confirmed saving these settings in **Authentication → URL Configuration** on
2026-10-25, after instructions to add the five new return URLs, retain the four existing entries,
and change the Site URL. The owner subsequently reported both fresh password-reset tests passed:
delivery, return to the requesting app, password change and sign-in with the new password.
Committing this file does not update hosted Supabase settings.

Use the dashboard's URL settings for this rollout. SMTP credentials and the live email rate limit
are managed there and are not represented by the commented SMTP example and local defaults.
Do not run a broad `npx supabase config push` until all proposed changes have been reviewed
against the live project and the working mail setup is preserved.

## Part 5: put it on a phone

Use **https://app.skoolo.co.za** for the parent PWA. The school portal is a separate browser app.
An old installation from the Workers address is a different origin; install from the custom
domain for this test. Wait for the latest Cloudflare build to succeed before checking the UI.

### Android / Chrome

1. Open the URL directly in a normal Chrome tab, rather than inside WhatsApp or another app.
2. On Explore schools, find **Skoolo, one tap away**. Tap **Install Skoolo** when Chrome makes
   its native installation prompt available, then confirm in the browser dialog.
3. If there is no button, expand **Installation steps**. Chrome's menu provides
   **Install and create shortcut → Install**; some versions call it **Add to Home screen**
   or **Install app**. Browser eligibility and previous dismissals affect automatic promotion;
   the app cannot force a native popup. An already-installed app may not receive another offer.
4. Open the Skoolo icon from the home screen. Check that it launches without the normal browser
   address bar and the installation card disappears. If Chrome offers only a shortcut, record
   that outcome and the Chrome version; a shortcut is not proof of standalone PWA installation.

The app captures `beforeinstallprompt` during startup, before lazy routes load, and only invokes
it on an explicit tap. Cancellation/failure keeps manual help available and a used event cannot
be reused. Directory dismissal lasts for the browser tab session, not indefinitely in localStorage.
Signed-in users can still find the help under **Account**, even after dismissing the directory card.
The app does not have a reliable cross-browser inventory of installations; standalone launch and
`appinstalled` are the signals it uses to hide the card.

### iPhone / Safari

1. Open **Safari** and visit **https://app.skoolo.co.za** in a normal tab.
2. Tap **Share**. Depending on the Safari layout, open the page menu first to find Share.
3. Scroll to **Add to Home Screen**. If missing, use **Edit Actions** to add it.
4. Keep **Open as Web App** switched on if shown, leave the name **Skoolo**, and tap **Add**.
5. Go to the Home Screen and open the new Skoolo icon. Expect an app window without Safari's
   ordinary address bar. iOS uses this manual flow; do not wait for Chrome's install dialog.

### Real-phone acceptance checks (still pending)

**Owner correction, 2026-10-25:** iOS installation succeeded and explicitly using
`https://app.skoolo.co.za` removed Safari's connection warning. The earlier report that HTTPS
still warned was withdrawn. Android installation directly from Chrome/Install Skoolo remains
blocked with the older-Android privacy-protection warning: Galaxy A05, Android 14,
Chrome 155.0.8059.39. Collect the complete Android warning, including the package's displayed
app name; its cause is still unconfirmed. Keep Play Protect enabled.

Google documents the older-Android warning as an APK target API compatibility issue. This repo
ships static PWA assets, with no native Android project or `targetSdkVersion` setting. Chrome
generates the WebAPK wrapper through its installation service, so adding a target SDK field to
the web manifest would not repair it. Check for an official Chrome update, then retest; this is
a diagnostic step, not a confirmed fix. If it persists, inspect the actual generated package or
browser diagnostics before changing application code. See
[Google's warning guidance](https://developers.google.com/android/play-protect/warning-dev-guidance)
and [Chromium's WebAPK architecture](https://chromium.googlesource.com/chromium/src/+/HEAD/components/webapps/docs/android_architecture.md).

For Safari, use the explicit HTTPS URL above and check that the installed home-screen entry
opens without a warning too. Review Cloudflare's HTTPS redirect setting so bare/HTTP links
upgrade to HTTPS. The successful owner check does not prove that redirect is already enabled.
The agent has not inspected the live certificate or Cloudflare settings because origin access
is blocked. No certificate replacement is indicated by the corrected result.
See [Apple's connection-warning guidance](https://support.apple.com/en-au/102279).

- Search for a school before sign-in; check the installation guidance and narrow-screen layout.
- Launch from the installed icon, complete the security check and sign in with a designated
  parent test account. Check Home, Applications, Inbox and Account navigation, keyboard layout,
  and portrait/landscape scrolling without sideways overflow.
- Close and reopen the installed app; check account restoration, then sign out and check that
  protected content is no longer shown. Browser tabs and installed iOS apps can have different
  session contexts; test the installed app itself. Staff time limits are not part of this test.
- Test reset-email links separately. They may open a browser instead of the installed app;
  after resetting, verify sign-in to the installed app with the new password.
- Check a connection failure and recovery. The shell may be cached, but school data, security
  checks, sign-in and submissions require a connection; installation does not promise offline work.

`npm run check:install` covers synthetic browser events and actual 192/512px manifest icons.
It does not validate live Chrome eligibility, operating-system installation or iPhone rendering.
Agent browser access to the local preview was denied by policy; no alternative browser access
was attempted. Record real-device results and versions in the build log.

References: [Chrome installation](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en),
[Apple's web-app steps](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios),
[browser installation events](https://web.dev/learn/pwa/installation-prompt).

Share the parent app address with the school. A QR code of that URL can be used on a poster.

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
  The owner subsequently confirmed successful reset flows on both custom domains as well.
- The owner attached `app.skoolo.co.za` and `schools.skoolo.co.za` to their corresponding Workers
  and confirmed both load correctly. Supplied browser screenshots show the parent directory and
  portal sign-in page at those addresses. Both Wrangler files now preserve these custom domains
  and keep the original Workers addresses enabled.
- The repository includes the custom-domain auth return URLs. After the initial screenshots
  showed the old settings, the owner confirmed saving the new Site URL and redirect entries.
  The owner then reported "both passed" after instructions to request a fresh reset email from
  each app, check the return domain, change the password and sign in again. Reused/expired links,
  mobile/cross-browser checks and the staff-invite signup path still need live verification.
- The repository sets `[auth.email].enable_confirmations = true`. The owner's screenshot shows
  **Confirm email** enabled, followed by a report that the new parent signup/confirmation test
  worked. Portal staff-invite confirmation still needs a live walkthrough.
- During the portal registration test, the owner confirmed receiving its confirmation email.
  Their next screenshot shows the signed-in school-details form. A read-only database check
  confirmed one new school and its admin membership after submission, but opening the workspace
  failed while fetching a lazy-loaded module. The registration UI now separates saved data from
  navigation failure and provides **Reload and continue**, preserving the school selection only
  after checking the signed-in user's memberships. The owner confirmed that opening `/school`
  in a new tab shows the registered school's workspace. The new recovery panel still needs a
  live check. **Check your email** and password Show/Hide are implemented; their live
  visual/keyboard checks remain open.
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

Both custom domains work, and the existing `[auth]` block in `supabase/config.toml` now contains:

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

Apply only these URL settings in the dashboard as described in Part 4. The redirect list should
then have nine entries. Signup explicitly chooses `/auth`, `/join` or
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
3. Delivery and the successful reset path are now confirmed by the owner on both domains. The
   repository sets `[auth.email].enable_confirmations = true`; in the hosted dashboard open
   **Authentication → Sign In / Providers**, enable **Confirm email**, and save. The owner's
   dashboard shows this switch above the Auth Providers list; some layouts place it under Email. Use
   this targeted dashboard setting rather than a broad config push that could alter SMTP.
   New signups must verify their inbox before signing in. The owner supplied the enabled-switch
   screenshot and reported the parent confirmation test worked. Still test staff signup with an
   invite code, new school registration,
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

## Assessment paper acceptance (2026-10-25)

The feature is available at `/documents` in the school portal. Automated checks cover permissions,
review transitions, saved drafts, print escaping and memorandum separation. Managed browser policy
denied the agent access to the local preview; the following checks still require a real browser.

1. As admin, create a school template with instructions, duration and footer. As an assigned
   teacher, create a paper using it. Check phone width (375px) and desktop, keyboard labels and focus.
2. Add short/long answers, multiple choice, image, table, heading and page break blocks; reorder
   and remove a block. Save, leave, reopen and confirm content and calculated marks persist.
3. Check failed saves preserve edits and an unsaved navigation warns. In two windows, save in one
   then attempt to save the older copy; reload after the conflict message rather than overwrite.
4. Submit, return with feedback, correct and resubmit. Only the selected administrator approves.
   Approved content cannot be edited; Create revised copy preserves the original.
5. Preview and print both outputs. Use Save as PDF, verify A4 pagination, answer spaces, long
   questions, images, table boundaries and school badge. Learner copies must contain no answers.
6. Connect an approved paper to a new assessment, then follow Capture learner scores and verify
   the selected class, subject, term and year. Also link to a compatible existing assessment and
   confirm its scores stay unchanged. Linked totals and deletion are protected.
7. Verify author, reviewer, unrelated teacher, parent and second-school behaviour in the UI.
   Have a real teacher and office complete a real paper without Word or retyping before declaring
   Stage 8 accepted. No online response collection, OCR, editable Word export or offline sync yet.

## Action notification acceptance (2026-10-25)

1. On desktop and a 375px phone, scroll to the bottom of a long assessment paper or school profile,
   save, and check the floating spinner changes to a checkmark without scrolling to the page top.
2. Save the same content twice. Each completed save should show feedback. A reload without a
   write must not report that something was saved. Simulate a failed save and check the error
   persists, the form remains editable and a later successful retry shows the correct result.
3. Save inside a learner or appearance drawer. The notification must appear above its contents,
   with an operable close button. Close the drawer and verify there is only one visible copy.
4. Hover or focus the notification; verify its timer pauses. Switch tabs and return; the success
   should still be readable. Enable reduced motion and test keyboard/screen-reader announcements.
5. In the parent app, upload a document and report an absence. Check the bottom navigation remains
   usable, including device safe areas and an open software keyboard.
6. Navigate away or sign out during an action. Old feedback must not appear over the next page or
   account. In the marks grid, complete two concurrent saves with one failing; no all-saved message.

## Local production preview

```bash
npm run build:parent
npx http-server web/dist/parent-app/browser -p 4201 --proxy "http://localhost:4201?"
```

The service worker only registers in production builds, so this is how to test installability
before deploying.
