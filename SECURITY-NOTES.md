# Security changes and operating notes

## Access controls

- Authentication is checked by server code before private page rendering and before every catalog read/write. Hiding UI elements is not the authorization mechanism.
- The initial account is seeded from the private `AUTH_INITIAL_PASSWORD_HASH` environment variable only when the store is empty. No real bootstrap hash is bundled in public source. The scrypt parameters are N=32768, r=8, p=3, with a unique 16-byte salt and timing-safe comparison. Passwords are not stored in plaintext.
- Sessions use random 256-bit opaque tokens. The database key contains only the token's SHA-256 digest. HTTPS deployments use an HttpOnly, Secure, SameSite=Strict, host-only cookie with the `__Host-` prefix.
- Session validity includes expiry and the current account revision. Password changes and resets invalidate all older sessions. Logout deletes the current session.
- Authenticated writes require a session-specific CSRF token, an exact configured Origin, JSON, and a custom request header. Public login/reset requests also require the trusted Origin and custom header. CORS access is not enabled.
- Persistent global rate limits suit this single-account application and cannot be bypassed by rotating the submitted email or forged forwarding headers.

## Recovery

- Reset links have random 256-bit tokens, a 15-minute expiry, and single-use atomic consumption. Only their digest is stored.
- Tokens use URL fragments rather than query strings; the reset screen removes the fragment on load. Referrer-Policy is `no-referrer`.
- Known and unknown email requests receive the same generic response. SMTP runs after that response to avoid revealing account existence through mail-delivery timing.
- Reset emails only go to the registered account. The sender uses verified TLS; SMTP secrets are server environment variables.

## Data and browser protections

- Products and templates live in private persistent storage with validated request bodies and atomic revision checks. Concurrent edits report a conflict instead of silently overwriting data.
- Stored text is rendered using React text nodes, not raw HTML.
- The browser never receives the password hash, SMTP credentials, or storage credentials. Business presets are delivered only after authenticated server rendering.
- Private responses are marked no-store for the browser and CDN. CSP uses a per-request script nonce; inline script execution without a nonce, third-party frames, and object embedding are blocked. Inline CSS remains allowed for the existing layout and PDF renderer.
- Additional headers disable framing, content sniffing, unnecessary device permissions and referrer leakage. HTTPS responses enable HSTS.
- Input schemas bound request sizes, text lengths, prices, template counts, column names and dimensions. No signup or administrator-creation API is exposed.
- Local test storage and the test inbox are allowed only for loopback development and are excluded from deployment archives.

## Verification performed

- Production build, TypeScript and lint checks passed. The pagination/sorting unit tests passed.
- Isolated HTTP checks covered private routes, forged identities, CSRF/origin rejection, bounded bodies, secure cookie flags, catalog validation/conflicts, session expiry/revocation, persistent rate limits, reset expiry/replay and concurrent single-use consumption.
- Browser checks covered sign-in, sign-out, forgot/reset/change-password, URL-token removal, mobile layout, legacy-data import and TOTAL-row persistence without runtime or CSP errors. A downloaded four-page Bill + Challan PDF with 30 rows retained all rows, one final bill total, and at least 40 px of signature space on each page.
- The full dependency audit reported zero known advisories at packaging time. Unused Cloudflare/Vite/Drizzle scaffolding and its vulnerable development dependencies were removed; the application uses the Netlify Next.js runtime.

- Netlify startup regression: with only the runtime `URL` configured and no `APP_URL` or `NETLIFY` flag, the old build returned HTTP 500; the corrected build redirects to `/login`. The full isolated authentication suite also passed using this URL fallback.

## Netlify runtime compatibility fix

The app now uses Netlify's runtime-provided `URL` directly when no `APP_URL` override is set. It no longer requires the build-only `NETLIFY` flag to read this value. Origin checks still use trusted server configuration, never request-supplied Host or Origin values. The Functions `SITE_ID` flag also blocks accidental local-storage mode in production.

## Deployment checks still required

This is a code-level hardening pass, not a guarantee that a live service has no vulnerabilities. The running host was not accessed or changed in this conversation. Before treating the site as protected:

1. Deploy this server version to the existing site and verify an incognito visit redirects to Sign in.
2. Verify HTTPS and the primary site URL (or optional APP_URL override). Confirm public GET /api/catalog returns 401.
3. Configure SMTP and test a real recovery email, including the spam folder. Only a private local inbox was used in automated recovery checks.
4. Remove obsolete public deployments or restrict their access using the hosting dashboard. This new package cannot revoke old static deployment URLs or copies already downloaded.
5. Restrict access to Netlify and any source repository; protect the registered recovery email account. Server-store administrators can change authentication records.
6. Keep runtime dependencies updated and review hosting logs without logging passwords, cookies or reset tokens.

Private catalog data is server-stored. Previously downloaded PDFs, old browser-local copies that have not yet been imported, and data already copied by another person cannot be withdrawn by adding login.

## Document history verification (October 2026)

- History pages, editable snapshots and PDF downloads require a valid server session. History POST uses exact configured Origin, JSON, request-size bounds and session-specific CSRF validation.
- Each generation stores the PDF and validated document snapshot as a separate private record. A compare-and-swap index preserves concurrent saves. The history listing excludes PDF payloads and document line items.
- PDF saves are limited to 3 MB, validate base64 encoding and PDF markers, and use server-generated IDs, filenames, totals and UTC save timestamps. Display uses Asia/Dhaka explicitly.
- Editing creates a new entry and keeps the original file and snapshot intact. Downloads return private/no-store attachment responses. Session revocation also blocks saved PDF downloads.
- The production build, lint, 13 unit tests and isolated API/security suite passed. The latter checks private history routes, invalid snapshots/PDFs, exact downloaded bytes, preserved originals, 11 concurrent saves and two-page listings. Browser visual/download automation was unavailable in this session; live Netlify persistence and real SMTP delivery still require deployment checks.

## Reference links

- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
