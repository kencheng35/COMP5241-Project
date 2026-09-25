# Forge Learning Studio

A Next.js 16 / React 19 learning application for COMP5241, using Supabase Auth/Postgres and server-side OpenRouter inference.

Track remaining work, blockers, acceptance criteria and verification updates in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

## Approved delivery scope (25 September 2026)

Target: 31 October 2026. This is a supervised Hong Kong course demonstration for ages 13+, not an approved public launch. The project owner performs final review and owns the course submission. Local edits, dependencies, disposable-development fixtures and API checks are authorized; production changes and deployment still require approval.

- Administrators use `/admin/accounts` to search accounts by email, grant/revoke instructor rights, and approve/revoke external AI access for recorded adults. Administrator accounts cannot be demoted by this interface.
- Instructors use `/teaching` to create, publish and edit their own lessons, select existing verified learners by email filter for enrollment, and view only their own published-lesson reports. Administrators retain global public-lesson control. Existing self-enrollment and private-draft isolation remain.
- `/paths` provides optional, explainable local SDLC recommendations and an explicit AI path action. Paths never enroll learners, and generated paths are session-only. Only coarse learning preferences and course metadata are sent to AI, not account identifiers, raw profile goals, grades or answer keys.
- Teaching uploads generate an editable private draft and quiz. Searchable PDF and PPTX text extraction is implemented; originals are not saved. Limits: 4 MiB, 60 pages/slides, and 20,000 extracted characters for generation. Scanned/image-only PDFs require OCR outside this workflow. Legacy binary `.ppt` remains an unmet requirement and is rejected explicitly; no supported serverless conversion dependency has been verified.
- Generation, coaching and path generation are limited to SDLC. Manual authoring validates an approved SDLC subject; prompts and subject/stage labels do not prove the semantic correctness of arbitrary content. The project owner remains responsible for demonstration content review.
- External AI is denied to minors and unknown-age accounts. Recorded adults additionally require a trusted administrator AI-access grant. This is a technical gate, not independent age verification or proof of legal consent.

Current blockers: the connected database lacks `profiles.age`; apply the age migration before profile saves and adult AI approval. The resume table is now present (empty-read check passed), but service-role grants and full resume behavior still need live verification. No SQL connection or Supabase management token is configured in this workspace, so new migrations have not been applied by the agent. Live free-model probes returned 429 and 404 under the unchanged privacy restrictions; successful generation remains unverified. Production encryption-at-rest configuration, backups, retention and Hong Kong/provider eligibility have not been certified.

## Learning workflows

- Authenticated catalog search, explicit self-enrollment, saved lessons and real progress records. No assigned learners or invented progress.
- Private AI-generated or manually authored lessons, with 4-6 short slides, an ordering activity and exactly 10 four-option quiz questions.
- Server-side grading: 6/10 passes; retries are unlimited. Attendance records reaching the final quiz, independently of submission or passing.
- Downloadable, printable HTML certificates for every passing attempt. Private Self-Learning and Public Published Lesson certificates retain the lesson version and visibility at achievement time.
- Structured editing and optimistic version checks. Learners edit their own private lessons; instructors publish/edit their own public lessons and administrators manage public lessons globally.
- Private drafts are invisible to other accounts, including administrators, until the owner explicitly submits them for publication review.
- Administrators grant per-published-lesson report access to registered reviewers. Reports contain public participation and submitted quiz answers, never coach conversations or private attempts.
- Session-only contextual AI coaching, with no server-side conversation storage.
- Verified-email authentication, password recovery, profile image validation/resizing, verified email-change requests, paginated JSON export and password-confirmed account deletion.
- Optional SDLC recommendations and AI learning paths, plus instructor-selected enrollment of existing verified learners. No roster-file uploads, cohorts or notifications.

## Run locally

```bash
npm install
npm run dev
```

Use Node.js 22.18+ (or Node.js 24 LTS). Configure the variables listed in [.env.example](.env.example) in your local environment. Never expose the service-role or OpenRouter keys through `NEXT_PUBLIC_` variables. The existing `OPEN_ROUTER_API_KEY` spelling is accepted as an alias for `OPENROUTER_API_KEY`.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` are required for authenticated access. Set the site URL to the canonical deployment origin (no path, query or credentials); use HTTPS except for local loopback development. Set `NEXT_PUBLIC_SITE_URL` to your deployed HTTPS origin in Vercel's environment variables; keep `.env.local` pointed at your local server. `.env.prod` is not loaded automatically by Next.js or Vercel. Misconfigured protected pages return a retryable 503 screen, and APIs return a 503 JSON error. The setup diagnostic checks these settings without printing their values.

In the Supabase SQL editor, apply these files in order:

1. [supabase/schema.sql](supabase/schema.sql), only for a new database. Do not rerun it over an existing installation.
2. [supabase/migrations/20260923_learning.sql](supabase/migrations/20260923_learning.sql).
3. [supabase/migrations/20260924_review_privacy.sql](supabase/migrations/20260924_review_privacy.sql).
4. [supabase/migrations/20260925_coach.sql](supabase/migrations/20260925_coach.sql).
5. [supabase/migrations/20260926_record_integrity.sql](supabase/migrations/20260926_record_integrity.sql).
6. [supabase/migrations/20260927_resume.sql](supabase/migrations/20260927_resume.sql).
7. [supabase/migrations/20260928_profile_limits.sql](supabase/migrations/20260928_profile_limits.sql).
8. [supabase/migrations/20260929_age_eligibility.sql](supabase/migrations/20260929_age_eligibility.sql).
9. [supabase/migrations/20260930_resume_grant.sql](supabase/migrations/20260930_resume_grant.sql).

Apply all outstanding migrations in order. Never rerun the base schema on an existing database. The resume table is present in the development project as of 25 September; its explicit service-role grant migration still needs application and verification. Age/profile checks use `NOT VALID` to preserve historical rows during upgrades, but apply to new writes. Existing ages are deliberately left unknown, not inferred from an age range; review legacy profiles and record their ages before validating constraints. Numeric age 13-120 is required for new signup/profile writes. Source changes alone do not create tables. Old prototype records remain available in exports but are not converted to new lesson results or certificates.

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
- For Vercel, set the Supabase Site URL to the deployed HTTPS origin, add its `/auth/confirm` URL as a redirect URL, and set `NEXT_PUBLIC_SITE_URL` to that same origin in Vercel's environment variables. Supabase email templates using `{{ .SiteURL }}` depend on that Site URL setting.

After signup, verify the email before logging in. If login reports an unverified email, use **Resend verification**. Existing accounts can also use **Forgot password** without registering again.

Keep email confirmations and secure email-change confirmation enabled in Supabase. Configure production SMTP. Signup requires a whole-number age of at least 13; under-13 guardian self-attestation has been removed. Profile ages remain self-reported, and minors cannot access external AI under the current demo policy.

## Administrator setup

Use a trusted Supabase administrator session or Admin API to set `app_metadata.role` to `admin` for an explicitly approved registered account. Do not use `user_metadata` or a browser-controlled role field. No existing account has been promoted automatically; browser tests create and then delete a temporary administrator.

Create or review a submitted lesson in the studio, then select the review-and-publish checkbox. The administration page grants quiz-report access using a registered user's UUID and can revoke existing grants. This grants report access, not learner assignment.

After bootstrap, use Account maintenance to grant an instructor role; never expose the service key to a browser. Instructors can manage only their own lessons and reports. Teaching > Manage learners supports email-filtered selection of up to 50 verified learner accounts per action; duplicate enrollment preserves existing progress. No account is created and no invitation email is sent by this operation. Instructor directory searches require at least three email characters and return only minimal account labels, not profiles or AI eligibility.

## AI availability and privacy

Only explicit `provider/model:free` IDs verified against the zero-price OpenRouter catalog are accepted. There is no paid fallback. Set optional `OPENROUTER_FALLBACK_MODELS` to a comma-separated priority list; up to ten total models are allowed. Requests use OpenRouter's `models` fallback array and require `data_collection: deny`, `zdr: true` and supported parameters; generation also requires structured output. Fallback can address a busy model, but cannot bypass account-wide quotas or privacy constraints. Catalog validation and inference share a 55-second deadline. Provider failures never save a fabricated lesson. Manually authored lessons do not require AI.

`npm run check:ai` checks the public catalog and account quota without inference. `npm run check:ai -- --probe=structured` makes one synthetic structured request using the same fallback/privacy client as the application; `--probe=text` tests unstructured coaching availability. No credentials, prompts or output content are printed. The 25 September text and structured probes returned 429 and 404 respectively; no working endpoint has been established. Earlier probe results below are historical, not current guarantees.

Application and setup-probe requests explicitly set `reasoning: { enabled: false }`. A successful standalone request using `deepseek/deepseek-v4-flash-0731` is not an equivalent availability test: that model has nonzero pricing, and the supplied standalone request omits the application's privacy filters and structured-output requirement. Free-only usage was reconfirmed; the paid model has not been enabled or called by these checks.

The supplied key authenticated successfully. Synthetic inference probes did **not** complete: the Qwen free endpoint returned 429 and other tested free endpoints returned 404 under the privacy policy. A working free endpoint still needs to be verified; do not assume the default model is currently available. Free-model availability, limits and upstream terms change.

With reasoning disabled, the latest Qwen probe still returned HTTP 429, and a temporary `liquid/lfm-2.5-2.6b:free` probe returned HTTP 404 under the same required settings. The temporary probe did not change the configured model. These statuses alone do not identify the exact quota or provider restriction.

Application limits are 5 generation attempts (including material imports and AI paths) and 15 coach requests per account per UTC database day. Failed provider calls consume a request to prevent repeated abuse. Quiz retries are never rate-limited by these counters. Provider-wide free quotas may be lower than aggregate user demand.

**Deployment gate:** before exposing AI to minors or deploying in any target region, review OpenRouter account eligibility, the selected upstream provider's age/region terms, consent requirements and data-processing arrangements. A safe-language prompt and a checkbox do not establish legal eligibility. Do not weaken the privacy policy or switch to a paid endpoint without approval. No production eligibility review has been completed.

The provider receives a chosen topic, consented extracted teaching text, or lesson slides and recent coach exchanges. AI paths send only derived coarse preferences and course metadata. Account identifiers, raw profile fields, grades and quiz answer keys are not sent. Users must not enter personal data in free text or uploads. Provider retention must be independently confirmed; the app does not persist chat history or original uploaded teaching files. Rate counters contain no prompt text and old counters are removed on the next AI request.

New learning tables deny direct `anon` and `authenticated` access. All reads and writes use authenticated server operations with explicit ownership/reviewer checks; the service key is server-only. The answer key is omitted from the lesson player's initial props. Review feedback is revealed only after a saved submission.

Learning records remain until account deletion. Deleting an author removes their lessons and enrollment links, but other learners retain certificate/result snapshots. Deleting a learner removes their own records. Database backups and hosting/provider operational logs require separate retention configuration; the application cannot promise immediate erasure from those systems. Avatars are decoded and resized to 160px JPEGs in the private profile row, without a public storage bucket.

## Verification

`npm test` includes offline component tests mounted in real Chromium. Install the Playwright browser beforehand with `npx playwright install chromium` (Linux CI uses `npx playwright install --with-deps chromium`); a missing browser fails the tests rather than skipping them. These synthetic fixtures need no Supabase configuration or AI access. The opt-in authenticated browser suites below remain separate and write to the configured Supabase project.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Unit/database tests cover pass thresholds, malformed submissions, safe redirects, complete pagination, migration execution in isolated PostgreSQL-compatible PGlite, direct-access denial, request quotas and certificate retention.

GitHub Actions runs these tests, lint, type checking and a production build on pushes and pull requests using Node.js 24 LTS. The workflow requires no application secrets and does not run live database checks, AI probes or the database-writing browser suite.

25 September verification: 60 local tests passed, along with lint, typecheck and production build. `npm run test:instructors` passed 18 live workflow stages, including admin role changes, instructor ownership, real publication, directory filtering, duplicate enrollment preservation, report isolation, and stale-form denials after revocation. It also checks 1440/390/320px layout and mobile navigation; all four temporary accounts were deleted. This test defaults to a local server at `http://127.0.0.1:3126` and supports `E2E_BASE_URL`. Like the existing E2E suite it writes to the configured Supabase project: use only the authorized disposable development environment. It makes no AI calls or email sends.

### Authenticated browser tests

With the local dev server running and a migrated development Supabase project configured:

```bash
npx playwright install chromium
npm run test:e2e
```

This opt-in command writes to the configured Supabase project: it creates three temporary, email-confirmed accounts (including one administrator), one initially unconfirmed signup account, and temporary lessons/results. It exercises real login and server actions, changes only a temporary account's password, and deletes its accounts and associated fixtures in cleanup. It never changes existing accounts. Use a development project, not a production database. Generated credentials and verification tokens remain in process memory and are omitted from test output; screenshots contain only test data and are written to a temporary directory printed on completion. Callback requests carry tokens in their query strings, so application/proxy access logs must be treated as sensitive and query values redacted in production. If cleanup fails, the command reports the temporary account ID for manual removal. The browser tests use `NEXT_PUBLIC_SITE_URL` from the local environment; `E2E_BASE_URL` must match it when selecting another localhost port. Non-loopback application URLs are rejected. The command is separate from `npm test` and makes no AI requests or email sends.

Before the resume migration is applied to the connected development database, use the migration-independent editor checks with `E2E_SCOPE=authoring`. For a server on port 3107, set `NEXT_PUBLIC_SITE_URL=http://localhost:3107` when starting the server and run this in PowerShell: `$env:E2E_SCOPE='authoring'; $env:NEXT_PUBLIC_SITE_URL='http://localhost:3107'; $env:E2E_BASE_URL=$env:NEXT_PUBLIC_SITE_URL; npm run test:e2e`. Set `E2E_BROWSER` to `firefox` or `webkit` for those Playwright browsers (default: Chromium; install the browser with `npx playwright install firefox` or `webkit`). The full suite requires the resume migration.

Verified against the connected development project before the resume migration: manual creation, consecutive editor saves, private isolation (including administrators before review submission), self-enrollment, bookmark persistence, desktop/mobile lesson layout and navigation, ordering practice, attendance without submission, 5/10 failure, 6/10 pass and retries, private/public certificates, cross-account certificate denial, publication snapshot preservation, stale quiz rejection, reviewer grant/revocation, exclusion of private attempts from reports, and learner-scoped export. All temporary test accounts were removed.

Also verified through real forms: profile-field persistence, image upload and conversion to 160x160 JPEG, displayed image loading, rejection of invalid and oversized uploads without changing saved data, picture removal, wrong-password deletion rejection, successful password-confirmed author/learner deletion, session invalidation, and retention of another learner's certificate after author deletion. The test keeps generated passwords in memory and deletes only its own temporary accounts.

Auth link handling is also verified with Supabase Admin API-generated links: rejection of invalid tokens and unauthenticated password updates, unverified-login rejection, signup confirmation/session creation, same-origin redirect enforcement, single-use signup/recovery links, password-rule validation, recovery through the real reset form, old-password rejection, and new-password login. Missing credentials, unsupported verification types, ambiguous token/code combinations and invalid PKCE codes are rejected. Successful and rejected redirects carry no-store and no-referrer headers. Successful PKCE code exchange remains unverified; successful confirmation and recovery tests use the `token_hash` branch.

Still unverified end to end: successful AI generation/coaching (the latest synthetic probe returned HTTP 429), signup/reset/resend email requests and inbox delivery, PKCE email callbacks, and verified email-address changes. Mail flows need a controlled test inbox; generating links without sending mail does not verify SMTP, templates, or delivery. Provider eligibility and retention review remain deployment gates.

Before deployment, verify with separate learner, reviewer and administrator accounts: private isolation, enrollment, attendance without submission, failed/passing/retried quizzes, stale quiz versions, certificates, explicit review submission, report permissions, email confirmation/recovery, profile uploads, export and deletion. Check mobile and desktop layouts. Certificate files are printable HTML, not digitally signed credentials or accreditation.

## Deploy to Vercel

Import the repository using the Next.js defaults, configure all environment variables, apply migrations, and set the deployed origin in Supabase Authentication URL Configuration. Teaching extraction plus inference declares a 90-second route budget; confirm the selected Vercel plan/runtime supports it. PDF.js is externalized and its worker included in tracing, but deployed parsing and function memory limits still require staging verification. Complete provider eligibility, restricted-demo access, data protection and end-to-end gates before inviting learners. Deployment is not authorized by the current implementation approval.