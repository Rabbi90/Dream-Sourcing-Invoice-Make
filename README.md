# Dream Sourcing Invoice Maker — private account edition

This version adds server-enforced email/password access and password recovery. It also adds a **TOTAL row** section to every template, with an editable label and minimum height. The existing row/column defaults and multi-page PDF signature spacing are preserved.

## Deploy the secure update to your existing Netlify site

This is now a server application. Deploy the source project with Netlify's Next.js build; do not upload the former static `out` folder. An old static deployment remains public until it is replaced.

1. Replace the source files in the Git repository connected to your existing Netlify site. Keep the existing site address so previous browser-saved data can be imported.
2. Netlify build settings: **Build command:** `npm run build`; **Publish directory:** `.next`; **Node:** 22. The supplied `netlify.toml` sets these. Netlify's current Next.js adapter supplies the server runtime automatically.
3. The app now reads Netlify's primary site `URL` automatically at runtime. `APP_URL` is an optional override for the exact HTTPS origin you use, such as your custom domain. Use no path and never leave an example address as its value. If you set an override, include the **Functions** scope (or **All scopes**) and redeploy. Only the configured origin can submit account and catalog changes.
4. Configure the mail sender using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; see `.env.example`. Port 465 uses TLS directly, while other ports require STARTTLS. For Gmail, use the sender's app password; the site sign-in password is not an SMTP credential. Keep mail credentials in Netlify environment variables, never in public client variables.
5. For a new, empty private store, set `AUTH_INITIAL_PASSWORD_HASH` in Netlify environment variables (Functions or All scopes) to a salted scrypt hash using N=32768, r=8, p=3. The first sign-in email is **rabbikhan11002299@gmail.com**. Existing account records retain their current password and do not need this bootstrap variable. Real bootstrap hashes and plaintext passwords are excluded from this public source. No public registration is available.
6. After signing in, use **Import previous data** if the site finds products/templates saved by the old version in this browser. Data is copied to the private server store; the old browser copy is removed only after a successful save. Verify the import before clearing browser storage.

Netlify Blobs stores the account, sessions and catalog persistently for this site. No separate database key is required in Netlify's supported Next.js runtime. Keep the private store `dream-sourcing-private-v1` when redeploying. Deleting its account record resets the site to the initial account; access to the hosting dashboard must remain restricted to the owner.

The password-reset flow is implemented, but actual email delivery requires the SMTP settings above. It displays a configuration error if no sender is configured. This package does not deploy itself or change a currently running site.

## If the previous deployment shows “This page couldn’t load”

If deployment instead fails at **Scanning for secrets** and names `AUTH_STORAGE`, this is a false positive: its value `netlify` is a public provider name that also occurs in dependencies and documentation. The checked-in `netlify.toml` excludes only `AUTH_STORAGE` using `SECRETS_SCAN_OMIT_KEYS`; credential scanning stays enabled. You can also edit `AUTH_STORAGE` in Netlify and clear **Contains secret values**. Keep `AUTH_INITIAL_PASSWORD_HASH` and SMTP passwords marked secret.

The previous package only read Netlify's `URL` when the `NETLIFY` build flag was present. Netlify Functions provides `URL` at runtime but does not guarantee that build flag. Without an explicit `APP_URL`, the old version could throw before showing the sign-in page. This update removes that incorrect dependency.

1. Replace the previous source with this update and trigger a fresh Netlify build. Keep `npm run build`, publish directory `.next`, and Node 22.
2. If you have not yet replaced the source, the immediate workaround is to add `APP_URL` with your **actual main HTTPS site address** in **Project configuration → Environment variables**, select **All scopes** or **Functions**, save, and redeploy. Adding it only to `netlify.toml` does not make it available to Functions.
3. Open the main site address after deployment, rather than an old deployment permalink. A private/incognito visit should show **Sign in**.
4. If the problem persists, capture the first error from the deployed Next.js server function log and the site URL. Do not include environment-variable values, passwords, cookies or reset links.

This ZIP is source code for Netlify's Next.js build, not a static drag-and-drop `out` folder. SMTP is needed for reset emails; it is not required to display the sign-in page or sign in.

## Account and recovery

- **Sign in:** only the configured private account can access the invoice workspace and catalog API.
- **Sign out:** revokes the current server session.
- **Forgot password:** sends a single-use reset link to the account's registered email. The link expires in 15 minutes. Requests for other email addresses receive the same neutral response.
- **Account → Change password:** verifies the current password, saves the new password and signs out all sessions. A successful password reset also invalidates every existing session.
- Sessions have an eight-hour maximum lifetime. PDF export and data writes recheck the server session; background checks return expired sessions to sign-in.
- Sign-in is limited to 15 attempts per 15 minutes across this single-account site. Recovery emails are limited to three requests per hour. The limits persist across server instances and do not rely on spoofable IP headers.

## TOTAL row and templates

Open **Templates**, select a saved template or create a new one, and locate **TOTAL row**. Its label defaults to `TOTAL`; an empty label also uses that default. The optional height field leaves the original size unchanged when blank. Click **Save changes**.

The summary amount is calculated automatically, including VAT where applicable. It appears once, on the final bill page, independently of the per-item **Total Value** column. Challans continue to omit prices and money totals. Pagination measures the TOTAL row height before deciding where to break pages.

## Document history

Every successful **Generate PDF** saves the exact PDF and an editable snapshot to the private server store before starting the download. The confirmation includes the server save time in **Asia/Dhaka (Bangladesh, UTC+6)** and a link to **Document history** at `/history`.

History lists the newest documents first, with a choice of 10, 25 or 50 documents per page. Search by customer, bill/challan number or template, filter by document type and inclusive saved-date range in Bangladesh time, or use Today / Last 7 days / Last 30 days. Sort by saved time, customer, document number or amount using the sort selector or column headings. Filters apply to the whole archive before pagination and remain in the page URL.

**PDF** retrieves the original saved PDF; it does not regenerate it with later product prices or template changes. **Edit** restores the saved customer, date, references, quantities, prices, output mode and layout in the workspace. Generate again to save an edited copy as a new history entry; the original stays available. History downloads show a Bangladesh-time confirmation.

**Delete** asks for confirmation and moves the selected document to **Trash**. Use the row checkboxes to select up to 50 documents on the current page for bulk deletion or restoration. **Undo** restores the last deleted selection; **Restore** in Trash makes the PDF and editable details available again. Trashed records are retained for recovery and cannot be edited or downloaded until restored. This is reversible deletion; it does not permanently purge the private stored files.

History supports up to 500 items and a 3 MB PDF per generated document. Exports use high-quality JPEG page images to keep files compact. If validation, rendering or history storage fails, the app reports the error instead of claiming the document was saved. A browser download confirmation means the download was started; the browser controls whether the file is written to disk. Documents downloaded before this feature cannot be added retroactively.

New documents use today's Bangladesh date. All history endpoints require a valid session; saves also require the existing Origin and CSRF checks. Local history stays in `.auth-data/`; Netlify history uses the same private store as the account and catalog.

## Local development setup

```bash
npm ci --legacy-peer-deps
```

Copy `.env.example` to `.env.local`, change `APP_URL` to `http://localhost:3000`, and set `AUTH_STORAGE=local`. Then run:

```bash
npm run dev
```

Local data is kept in `.auth-data/`, which is ignored by Git. Local storage mode is refused on a non-loopback origin and in the Netlify environment. Production uses Netlify Blobs; this project is not configured for another hosting provider.

For local password recovery without SMTP, add `AUTH_TEST_OUTBOX=.auth-data/outbox` to `.env.local`. Reset messages are saved as JSON files there; open the link inside the newest message. This does not send email and is refused outside local storage mode.

## Verification

```bash
npm test
npm run lint
npm run build
npm audit
```

`npm run test:security` runs the isolated server/API checks after a build. Set `TEST_NETLIFY_RUNTIME=1` to exercise the Netlify `URL` fallback without `APP_URL` or the `NETLIFY` build flag. The suite seeds its own temporary account with a random test password (or optional `TEST_ACCOUNT_PASSWORD`), private store and inbox. It never reads or changes the owner's account and never sends external email. It covers history validation, concurrent saves, original PDF bytes, editable snapshots, preserved originals, pagination and authentication checks.

See `SECURITY-NOTES.md` for the protections, verification scope, and deployment checks. Do not commit `.env.local`, SMTP credentials, `.auth-data`, test inboxes, or session/reset tokens.
