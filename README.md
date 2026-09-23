# Forge Learning Studio

A Next.js 16 / React 19 learning application for COMP5241, using Supabase Auth/Postgres and server-side OpenRouter inference.

Track remaining work, blockers, acceptance criteria and verification updates in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

## Learning workflows

- Authenticated catalog search, explicit self-enrollment, saved lessons and real progress records. No assigned learners or invented progress.
- Private AI-generated or manually authored lessons, with 4-6 short slides, an ordering activity and exactly 10 four-option quiz questions.
- Server-side grading: 6/10 passes; retries are unlimited. Attendance records reaching the final quiz, independently of submission or passing.
- Downloadable, printable HTML certificates for every passing attempt. Private Self-Learning and Public Published Lesson certificates retain the lesson version and visibility at achievement time.
- Structured editing and optimistic version checks. Learners edit their own private lessons; only administrators publish or edit public lessons.
- Private drafts are invisible to other accounts, including administrators, until the owner explicitly submits them for publication review.
- Administrators grant per-published-lesson report access to registered reviewers. Reports contain public participation and submitted quiz answers, never coach conversations or private attempts.
- Session-only contextual AI coaching, with no server-side conversation storage.
- Verified-email authentication, password recovery, profile image validation/resizing, verified email-change requests, paginated JSON export and password-confirmed account deletion.
- Personalization remains deferred. No enrollment imports, learner assignment, or claims of adaptive recommendations.

## Run locally

```bash
npm install
npm run dev
```

Use Node.js 22.18+ (or Node.js 24 LTS). Configure the variables listed in [.env.example](.env.example) in your local environment. Never expose the service-role or OpenRouter keys through `NEXT_PUBLIC_` variables. The existing `OPEN_ROUTER_API_KEY` spelling is accepted as an alias for `OPENROUTER_API_KEY`.

In the Supabase SQL editor, apply these files in order:

1. [supabase/schema.sql](supabase/schema.sql), only for a new database. Do not rerun it over an existing installation.
2. [supabase/migrations/20260923_learning.sql](supabase/migrations/20260923_learning.sql).
3. [supabase/migrations/20260924_review_privacy.sql](supabase/migrations/20260924_review_privacy.sql).
4. [supabase/migrations/20260925_coach.sql](supabase/migrations/20260925_coach.sql).
5. [supabase/migrations/20260926_record_integrity.sql](supabase/migrations/20260926_record_integrity.sql).

The connected development database now passes all required table/column checks, and the authenticated manual-learning workflow has passed browser testing against it. New installations must still apply the files above; source changes alone do not create tables. Old prototype records remain available in exports but are not converted to new lesson results or certificates.

After applying the migrations, verify the configuration:

```bash
npm run check:setup
npm run check:setup -- --ai
```

The first command checks required database columns using empty reads and checks that AI configuration is present. The optional `--ai` command also makes one synthetic request to the configured free model, consuming provider quota while preserving the application's privacy settings. Neither command applies migrations or prints credentials or learner records. Failed checks return a nonzero exit code. These checks do not verify database grants, request-limit functions, full lesson generation, or provider eligibility; those require the tests and deployment checks below.

Open [http://localhost:3000](http://localhost:3000).

### Authentication setup

Passwords are never stored in this repository or the `profiles` table. Supabase Auth stores a one-way password hash in its protected authentication schema.

In **Supabase → Authentication → URL Configuration**:

- Set the Site URL to `http://localhost:3000` for local development.
- Add `http://localhost:3000/auth/confirm` as a redirect URL.
- For Vercel, also add `https://your-domain.vercel.app/auth/confirm` and use the deployed origin for `NEXT_PUBLIC_SITE_URL`.

After signup, verify the email before logging in. If login reports an unverified email, use **Resend verification**. Existing accounts can also use **Forgot password** without registering again.

Keep email confirmations and secure email-change confirmation enabled in Supabase. Configure production SMTP. The under-13 checkbox records self-attestation, not independently verified parental consent.

## Administrator setup

Use a trusted Supabase administrator session or Admin API to set `app_metadata.role` to `admin` for an explicitly approved registered account. Do not use `user_metadata` or a browser-controlled role field. No existing account has been promoted automatically; browser tests create and then delete a temporary administrator.

Create or review a submitted lesson in the studio, then select the review-and-publish checkbox. The administration page grants quiz-report access using a registered user's UUID and can revoke existing grants. This grants report access, not learner assignment.

## AI availability and privacy

Only model IDs ending in `:free` are accepted. There is no paid fallback. Requests require `data_collection: deny` and `zdr: true`; structured generation also requires schema support. Provider failures are surfaced without saving a fabricated lesson. Manually authored lessons do not require an AI endpoint.

Application and setup-probe requests explicitly set `reasoning: { enabled: false }`. A successful standalone request using `deepseek/deepseek-v4-flash-0731` is not an equivalent availability test: that model has nonzero pricing, and the supplied standalone request omits the application's privacy filters and structured-output requirement. Free-only usage was reconfirmed; the paid model has not been enabled or called by these checks.

The supplied key authenticated successfully. Synthetic inference probes did **not** complete: the Qwen free endpoint returned 429 and other tested free endpoints returned 404 under the privacy policy. A working free endpoint still needs to be verified; do not assume the default model is currently available. Free-model availability, limits and upstream terms change.

With reasoning disabled, the latest Qwen probe still returned HTTP 429, and a temporary `liquid/lfm-2.5-2.6b:free` probe returned HTTP 404 under the same required settings. The temporary probe did not change the configured model. These statuses alone do not identify the exact quota or provider restriction.

Application limits are 5 generation attempts and 15 coach requests per account per UTC database day. Failed provider calls consume a request to prevent repeated abuse. Quiz retries are never rate-limited by these counters. Provider-wide free quotas may be lower than aggregate user demand.

**Deployment gate:** before exposing AI to minors or deploying in any target region, review OpenRouter account eligibility, the selected upstream provider's age/region terms, consent requirements and data-processing arrangements. A safe-language prompt and a checkbox do not establish legal eligibility. Do not weaken the privacy policy or switch to a paid endpoint without approval. No production eligibility review has been completed.

The browser sends only the chosen topic, or lesson slides and the latest coach exchanges, to the server-side provider boundary. Account identifiers, profile fields, grades and quiz answer keys are not included in coach requests. Users must not enter personal data in free text. Provider retention must be independently confirmed; the app does not persist chat history. Rate counters contain no prompt text and old counters are removed on the next AI request.

New learning tables deny direct `anon` and `authenticated` access. All reads and writes use authenticated server operations with explicit ownership/reviewer checks; the service key is server-only. The answer key is omitted from the lesson player's initial props. Review feedback is revealed only after a saved submission.

Learning records remain until account deletion. Deleting an author removes their lessons and enrollment links, but other learners retain certificate/result snapshots. Deleting a learner removes their own records. Database backups and hosting/provider operational logs require separate retention configuration; the application cannot promise immediate erasure from those systems. Avatars are decoded and resized to 160px JPEGs in the private profile row, without a public storage bucket.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Unit/database tests cover pass thresholds, malformed submissions, safe redirects, complete pagination, migration execution in isolated PostgreSQL-compatible PGlite, direct-access denial, request quotas and certificate retention.

GitHub Actions runs these tests, lint, type checking and a production build on pushes and pull requests using Node.js 24 LTS. The workflow requires no application secrets and does not run live database checks, AI probes or the database-writing browser suite.

### Authenticated browser tests

With the local dev server running and a migrated development Supabase project configured:

```bash
npx playwright install chromium
npm run test:e2e
```

This opt-in command writes to the configured Supabase project: it creates three temporary, email-confirmed accounts (including one administrator), one initially unconfirmed signup account, and temporary lessons/results. It exercises real login and server actions, changes only a temporary account's password, and deletes its accounts and associated fixtures in cleanup. It never changes existing accounts. Use a development project, not a production database. Generated credentials and verification tokens remain in process memory and are omitted from test output; screenshots contain only test data and are written to a temporary directory printed on completion. Callback requests carry tokens in their query strings, so application/proxy access logs must be treated as sensitive and query values redacted in production. If cleanup fails, the command reports the temporary account ID for manual removal. `E2E_BASE_URL` can select another localhost port; non-loopback application URLs are rejected. The command is separate from `npm test` and makes no AI requests or email sends.

Verified against the connected development project: manual creation, consecutive editor saves, private isolation (including administrators before review submission), self-enrollment, bookmark persistence, desktop/mobile lesson layout and navigation, ordering practice, attendance without submission, 5/10 failure, 6/10 pass and retries, private/public certificates, cross-account certificate denial, publication snapshot preservation, stale quiz rejection, reviewer grant/revocation, exclusion of private attempts from reports, and learner-scoped export. All temporary test accounts were removed.

Also verified through real forms: profile-field persistence, image upload and conversion to 160x160 JPEG, displayed image loading, rejection of invalid and oversized uploads without changing saved data, picture removal, wrong-password deletion rejection, successful password-confirmed author/learner deletion, session invalidation, and retention of another learner's certificate after author deletion. The test keeps generated passwords in memory and deletes only its own temporary accounts.

Auth link handling is also verified with Supabase Admin API-generated links: rejection of invalid tokens and unauthenticated password updates, unverified-login rejection, signup confirmation/session creation, same-origin redirect enforcement, single-use signup/recovery links, password-rule validation, recovery through the real reset form, old-password rejection, and new-password login. Missing credentials, unsupported verification types, ambiguous token/code combinations and invalid PKCE codes are rejected. Successful and rejected redirects carry no-store and no-referrer headers. Successful PKCE code exchange remains unverified; successful confirmation and recovery tests use the `token_hash` branch.

Still unverified end to end: successful AI generation/coaching (the latest synthetic probe returned HTTP 429), signup/reset/resend email requests and inbox delivery, PKCE email callbacks, and verified email-address changes. Mail flows need a controlled test inbox; generating links without sending mail does not verify SMTP, templates, or delivery. Provider eligibility and retention review remain deployment gates.

Before deployment, verify with separate learner, reviewer and administrator accounts: private isolation, enrollment, attendance without submission, failed/passing/retried quizzes, stale quiz versions, certificates, explicit review submission, report permissions, email confirmation/recovery, profile uploads, export and deletion. Check mobile and desktop layouts. Certificate files are printable HTML, not digitally signed credentials or accreditation.

## Deploy to Vercel

Import the repository using the Next.js defaults, configure all environment variables, apply the migrations, and set the deployed origin in Supabase Authentication URL Configuration. Allow server execution time for up to 55 seconds of inference, or choose asynchronous generation before deploying to a shorter-timeout hosting plan. Complete the provider eligibility and end-to-end verification gates above before inviting learners.