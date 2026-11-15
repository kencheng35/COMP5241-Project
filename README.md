# Forge Learning Studio

A Next.js 16 / React 19 learning application for COMP5241, using Supabase Auth/Postgres and server-side OpenRouter inference.

For a presentation-ready overview of features, design choices and prototype screenshots, see [Project showcase](PROJECT_SHOWCASE.md).

Track remaining work, blockers, acceptance criteria and verification updates in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

## Demo testing guide for instructors and peer learners

Use the demonstration site only when the project owner has confirmed it is the
approved target for this test round. Confirm that planned writes such as
enrollment, progress, profile setup or lesson saves are in scope; otherwise,
limit testing to browsing. Use fictional lesson content and no real learner
records or sensitive personal information. The demo is intended for learners
aged 13 or older.

### Learner testing account

Use one of these learner accounts instead of registering a new account. The
user guide recommends them because email verification or signup can be limited
by server email-send limits. All five use the same password:

| Account | Password |
| --- | --- |
| `learner1@example.com` | `DemoLearner2026!` |
| `learner2@example.com` | `DemoLearner2026!` |
| `learner3@example.com` | `DemoLearner2026!` |
| `learner4@example.com` | `DemoLearner2026!` |
| `learner5@example.com` | `DemoLearner2026!` |

These are learner accounts, not instructor or administrator accounts. Use
different accounts for concurrent testers where possible; lessons, enrollments
and progress are associated with the signed-in account. If an account does not
work, ask the project owner rather than changing its password or creating
another account.

### Peer learner checklist

1. Sign in at [the demo site](https://comp5241-project.vercel.app/) with one of
   the accounts above. Complete first-login background/goals setup if prompted;
   use non-identifying choices.
2. Open **Course catalog**, find a published lesson under **Not yet enrolled**,
   and select **Enrol now**. Then open it from **Enrolled** with **Continue
   lesson**. Enrollment alone does not open the lesson player.
3. Navigate the lesson slides and complete its quiz if it has one. A lesson
   without a quiz does not produce a quiz certificate. Do not expect unpublished
   private lessons to appear in the learner catalog.
4. Optionally try **Learning game**. Its save belongs to the current browser,
   not the learner account; use the in-game **Learning journal** and export a
   save before clearing browser data or switching devices.
5. Treat **Interview simulator** as optional. Do not enter personal details.
   Staff can read sessions; microphone use sends audio to the browser's speech
   service. AI-assisted features require an administrator grant and may be
   restricted by provider or deployment policy. Test them only when the owner
   has confirmed the account eligibility and authorization. Typing is available
   instead.

### Instructor testing checklist

The accounts above do not have instructor privileges. Instructors must use an
account whose instructor role was granted by an administrator. Ask the project
owner for an authorized instructor account if one was not provided; do not try
to grant yourself access or use administrator credentials.

1. Only if lesson-writing is in scope, open **Teaching** and create a lesson
   with fictional content. Preview it, then save it privately. Use **Save &
   request approval** only if submitting it for administrator review is also
   approved; the request does not publish the lesson.
2. Only if enrollment writes are in scope, use an existing test learner to
   check enrollment and the instructor's own published-lesson reports.
   Instructors manage their own lessons and reports; do not edit or delete
   another instructor's content or use real learner records.
3. Use **Interview question bank** only if it is part of the assigned test.
   Menu items differ by account role. Administrator review, account controls
   and role grants are not instructor tasks.

### Reporting test results

Report the tester role, page, steps, expected result and actual result. Remove
names, email addresses, passwords, tokens and other personal data from
screenshots or messages. Do not publish, delete or change shared demo content
unless the project owner has explicitly approved that action and target.

The [learner guide](group7_user_guide.pdf), [project report](group7_report.pdf)
and [presentation slides](group7_slides.pdf) describe the workflows and roles.
The [walkthrough video](Forge-Learning-Studio-Walkthrough-Save-Catalog.mp4)
shows synthetic data and a private save in disposable local storage; it is a
UI walkthrough, not evidence that a save or publication succeeded on the
hosted site. Confirm any hosted save in the signed-in account and follow the
current on-screen status.

## PDF import: diagnosing image-draft startup failures

Draft startup now distinguishes the exact SQL `P0001` / `draft limit` response
from missing RPC/schema, permission/configuration, transient/unexpected failures
and an invalid UUID acknowledgment. Server logs contain only
`presentation_draft_start_failed`, a fixed `category` and an allowlisted `code`
(otherwise `null`), never raw errors, credentials or user IDs. Unknown `P0001`
messages are **not** treated as quota failures. There is no automatic retry or
cleanup: after an ambiguous failure, a draft may exist even without a returned
ID. Ask an administrator to check before trying again; do not discard unrelated
drafts. The configured limit is ten unexpired owner drafts, including drafts
associated with saved lessons, not ten PDFs; new drafts normally expire after
seven days.

**Remote cause and successful live import remain unverified.** These messages
are diagnostic categories, not proof of the deployed schema or credentials.
The required migration is
`supabase/migrations/20261105140000_presentations_ran.sql` (and its prerequisite
migrations). The `_ran` filename does **not** prove it was applied. Do not rerun
the full migration as a diagnostic or change grants/limits/bucket privacy.

Before any connected operation, confirm the intended Supabase project and
Vercel deployment/environment (Production vs Preview) with its authorized
operator. Privately verify that `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`
belong to that **same project**, and `NEXT_PUBLIC_SITE_URL` is the correct site
origin. Never paste key values into logs, tickets or SQL.

Only after target confirmation, an authorized operator can run these
**read-only** metadata checks in that project's Supabase SQL editor. They do
not invoke the create RPC or select private lesson/image content:

```sql
begin read only;
with target as (
  select to_regprocedure('public.forge_begin_presentation_draft(uuid,uuid)')::oid as oid
)
select t.oid is not null as rpc_exists,
       pg_get_function_result(t.oid) as return_type, p.proargnames as argument_names,
       has_function_privilege('service_role', t.oid, 'EXECUTE') as service_execute,
       has_function_privilege('anon', t.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', t.oid, 'EXECUTE') as authenticated_execute
from target t left join pg_proc p on p.oid = t.oid;

select has_schema_privilege('service_role', 'public', 'USAGE') as service_schema_usage;

select v.name, c.oid is not null as table_exists, c.relrowsecurity as rls_enabled,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_select,
       has_table_privilege('service_role', c.oid, 'INSERT') as service_insert,
       has_table_privilege('service_role', c.oid, 'UPDATE') as service_update,
       has_table_privilege('service_role', c.oid, 'DELETE') as service_delete,
       has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_any_access,
       has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated_any_access
from (values ('public.forge_presentation_drafts'),
             ('public.forge_presentation_assets')) v(name)
left join pg_class c on c.oid = to_regclass(v.name);

select exists(select 1 from storage.buckets where id = 'forge-presentation-images') as bucket_exists,
       (select public from storage.buckets where id = 'forge-presentation-images') as bucket_public;
rollback;
```

Expected: RPC returns `uuid`, arguments `{request_owner,request_lesson}`;
service-role execute/schema usage/table privileges are true; anon/authenticated
execute and table access are false; both tables have RLS; bucket exists and is
**not public**. Missing objects yield false/null. Existence and permissions alone
do not verify the routine body or PostgREST schema cache; an operator should
compare the installed definition with the migration and check API schema
exposure/cache separately before proposing any repair.

Once the drafts table is confirmed, replace the placeholder **privately with
your own UUID** and run only this aggregate count (do not share the UUID):

```sql
begin read only;
select count(*) as active_draft_count
from public.forge_presentation_drafts
where owner_id = 'YOUR-OWN-UUID'::uuid and expires_at > now();
rollback;
```

A count of ten or more is consistent with the quota at the query time; a later
count cannot prove what happened during an earlier request. Share only sanitized
category/code and aggregate/boolean findings. Any connected repair, explicit
discard or live-import verification needs separate target-confirmed approval.
Offline diagnostics do not certify a connected deployment or successful live
import.

## Current product and roles

Forge Learning Studio is a role-aware learning application for learners and
instructors. Its main workflows are:

- **Learners:** browse published lessons, enroll, study slides, take quizzes,
  review progress and use optional practice features. Learning-game progress is
  stored in the browser, not synchronized to the learner account.
- **Instructors:** receive access through an administrator-granted role; create
  private lessons, request publication review, manage their own lessons, enroll
  existing verified learners and view reports for their own published lessons.
  The instructor menu also includes the interview question bank.
- **Administrators:** manage roles and account permissions, review lessons for
  publication and use global account controls.

The application also includes manual lesson authoring, PDF page import, PPTX
export, onboarding and a local learning diagnostic, optional learning paths,
the interview simulator and learning game. New/private lessons remain private
until an administrator approves publication; an existing published lesson can
remain available while an update is reviewed. The
[implementation tracker](IMPLEMENTATION_TRACKER.md) records remaining work,
dependencies, verification boundaries and release gates.

## Run locally

```bash
npm install
npm run dev
```

Use Node.js 22.18+ (or Node.js 24 LTS). Configure the variables listed in [.env.example](.env.example) in your local environment. Never expose the service-role or OpenRouter keys through `NEXT_PUBLIC_` variables. The existing `OPEN_ROUTER_API_KEY` spelling is accepted as an alias for `OPENROUTER_API_KEY`.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` are required for authenticated access. Set the site URL to the canonical deployment origin (no path, query or credentials); use HTTPS except for local loopback development. Set `NEXT_PUBLIC_SITE_URL` to your deployed HTTPS origin in Vercel's environment variables; keep `.env.local` pointed at your local server. `.env.prod` is not loaded automatically by Next.js or Vercel. Misconfigured protected pages return a retryable 503 screen, and APIs return a 503 JSON error. The setup diagnostic checks these settings without printing their values.

Only after separate target/operation authorization, review actual application status and
apply any outstanding files in order in the Supabase SQL editor (not performed here):

1. [supabase/schema.sql](supabase/schema.sql), only for a new database. Do not rerun it over an existing installation.
2. [supabase/migrations/20260923_learning_ran.sql](supabase/migrations/20260923_learning_ran.sql).
3. [supabase/migrations/20260924_review_privacy_ran.sql](supabase/migrations/20260924_review_privacy_ran.sql).
4. [supabase/migrations/20260925_coach_ran.sql](supabase/migrations/20260925_coach_ran.sql).
5. [supabase/migrations/20260926_record_integrity_ran.sql](supabase/migrations/20260926_record_integrity_ran.sql).
6. [supabase/migrations/20260927_resume_ran.sql](supabase/migrations/20260927_resume_ran.sql).
7. [supabase/migrations/20260928_profile_limits_ran.sql](supabase/migrations/20260928_profile_limits_ran.sql).
8. [supabase/migrations/20260929_age_eligibility_ran.sql](supabase/migrations/20260929_age_eligibility_ran.sql).
9. [supabase/migrations/20260930_resume_grant_ran.sql](supabase/migrations/20260930_resume_grant_ran.sql).
10. [supabase/migrations/20261015_interviews_ran.sql](supabase/migrations/20261015_interviews_ran.sql).
11. [supabase/migrations/20261015_onboarding_diagnostic_ran.sql](supabase/migrations/20261015_onboarding_diagnostic_ran.sql).
12. [supabase/migrations/20261020_lesson_generation_ran.sql](supabase/migrations/20261020_lesson_generation_ran.sql).
13. [supabase/migrations/20261021_progress_evidence_ran.sql](supabase/migrations/20261021_progress_evidence_ran.sql) — progress evidence; connected application/acceptance unverified.
14. [supabase/migrations/20261022_daily_reflections_ran.sql](supabase/migrations/20261022_daily_reflections_ran.sql) — daily reflections; verify that it is applied before using reflections or account export on a connected target.

These are the current migration paths. The `_ran` suffix is **not evidence that a migration has been applied**. Verify the target and apply only outstanding migrations after separate authorization. Interviews require their migration; saved lesson generation and **account exports** require the lesson-generation migration (15th export table), and exports also require daily reflections (16th). Missing migration/access fails the entire export rather than silently omitting private records. Setup diagnostics check generation/progress/reflection columns with zero-row projections, not connected transactional behavior or generation RPC permissions.

The progress-evidence migration is required for new review/attendance writes and current-version quiz attendance checks. It adds no export table: enrollment `*` exports include the new version-keyed field automatically once applied. Before enabling these writers on an authorized target, refresh schema cache and verify service-role RPC/table grants and browser-role denial. Existing setup diagnostics do not verify this RPC. Do not infer applied status or backfill review/attendance from old enrollment, bookmarks or saved places.

The onboarding/diagnostic migration adds nullable `onboarding_completed_at`, `onboarding_background`, `diagnostic_summary`, and integer `learning_setup_revision` (initially 0) to `profiles`, with bounded JSON checks, protected setup writes and a revision trigger. It is required for **dashboard onboarding, diagnostic actions and ordinary profile editing**. Both browser harness scopes require this schema and numeric-age eligibility. It makes no historical completion/background/age backfill; existing unknown-age rows may still fail prior age constraints until explicitly reviewed. `profiles.*` owner export includes the fields and the existing Auth-user cascade removes them. Verify that this migration is applied before using those features on a connected target; local PGlite checks are not deployment evidence.

After authorization, compare actual target status and apply only outstanding migrations in order. Never rerun the base schema on an existing database. Current resume-table and service-role-grant application and behavior must be verified before connected use. Age/profile checks use `NOT VALID` to preserve historical rows during upgrades, but apply to new writes. Existing ages are deliberately left unknown, not inferred from an age range; review legacy profiles and record their ages before validating constraints. Numeric age 13-120 is required for new signup/profile writes. Source changes alone do not create tables. Old prototype records remain available in exports but are not converted to new lesson results or certificates.

After separately authorizing the target and these **connected read/probe scopes**,
verify configuration with:

```bash
npm run check:setup
npm run check:setup -- --ai
```

Both commands load local configuration and perform remote database **zero-row column
reads**, including `forge_lesson_generations`, `forge_enrollments.progress_evidence` and
`forge_reflections`; neither reads learner records or mutates/applies schema. The first
checks public/DB/key/model configuration but makes **zero AI requests**. Invalid arguments
are rejected before environment loading or client/network creation.

With `--ai`, successful configuration/column checks allow the **actual shared client**
to verify all selected free IDs/zero pricing with one catalog GET, then make **one**
quota-consuming completion POST. The actual configured helper supplies the default and
ordered fallbacks/aliases; no hardcoded setup model, provider/reasoning overrides, duplicate
catalog validation, per-model POST loop or paid/unverified fallback. Shared deadlines,
content-based token budget, bounded bodies, abort/redirect handling and sanitized diagnostics
are retained. The strict tiny `{ok:true}` output is validated locally; false, wrong,
malformed or extra keys fail. No keys, raw URLs/settings, prompts or response content are
printed; failure reports use fixed text/status metadata (shared-client allowlisted
model IDs and diagnostic UUIDs may appear). Failed checks exit nonzero.

A column/probe pass does **not** prove service/browser grants, RPCs, schema cache,
request-limit behavior, concurrency, account/provider eligibility, full lesson generation
or pedagogical quality. Those require separate authorized verification, not this check.

Open [http://localhost:3000](http://localhost:3000).

### Authentication setup

Passwords are never stored in this repository or the `profiles` table. Supabase Auth stores a one-way password hash in its protected authentication schema.

In **Supabase → Authentication → URL Configuration**:

- Set the Site URL to `http://localhost:3000` for local development.
- Add `http://localhost:3000/auth/confirm` as a redirect URL.
- For Vercel, set the Supabase Site URL to the deployed HTTPS origin, add its `/auth/confirm` URL as a redirect URL, and set `NEXT_PUBLIC_SITE_URL` to that same origin in Vercel's environment variables. Supabase email templates using `{{ .SiteURL }}` depend on that Site URL setting.

After signup, verify the email before logging in. If login reports an unverified email, use **Resend verification**. Existing accounts can also use **Forgot password** without registering again.

Successful password reset requests global sign-out before returning to login. Ordinary **Log out** also uses global scope, revoking refresh sessions across devices rather than only this browser. Already issued access tokens can remain valid until their configured expiry; this is not an immediate access-token revocation guarantee. Provider or cookie-cleanup failures show retry guidance, and a confirmed password update followed by failed logout is reported separately so users know to use the new password. Live multi-session revocation and browser-cookie behavior still require verification on the approved disposable target.

Keep email confirmations and secure email-change confirmation enabled in Supabase. Configure production SMTP. Signup requires a whole-number age of at least 13; under-13 guardian self-attestation has been removed. Profile ages remain self-reported. External AI access requires the trusted administrator approval described below; provider or deployment policies may impose additional age-related restrictions.

### Troubleshooting production signup

The signup server action emits structured JSON to the hosting platform's **server/runtime logs**, not the browser console. For a deployed site, open **Vercel → project → Logs**, select the production deployment and attempt time, and search `auth_signup_`. Include Info and Warning levels as well as Error.

Each attempt emits `auth_signup_started` followed by one terminal event:

- `auth_signup_validation_failed` (Warning): `invalid_fields` contains field names only; no Auth request was sent.
- `auth_signup_failed` (Error): `stage` distinguishes `configuration` (callback configuration), `client` (server client/cookies), and `provider` (Supabase signup). `failure_type` distinguishes a returned provider error from a thrown exception.
- `auth_signup_completed` (Info): Supabase returned without error and the existing verification redirect follows. This does not prove inbox delivery or that an account is new; Supabase may obscure duplicate-account responses.

Search the fresh random `diagnostic_id` to group an attempt. `elapsed_ms` measures time since action entry. Failures include an allowlisted `error_code`, bounded numeric `http_status`, and a fixed `reason`: `database`, `email_delivery`, `network`, or `unknown`. Unrecognized codes/statuses become `null`. Reasons are diagnostic hints from SDK errors, not verified root causes.

Illustrative failure (not a production observation):

```json
{"event":"auth_signup_failed","diagnostic_id":"7e2fe4ea-b7be-49d6-aef6-086ef5ae5311","stage":"provider","elapsed_ms":382,"failure_type":"returned","error_code":"unexpected_failure","http_status":500,"reason":"database"}
```

Use the stage/code/category to narrow the next checks:

- `configuration`: check the production `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` settings. Missing or malformed values prevent signup.
- `database`: inspect Supabase Auth/Postgres logs around the same time, especially the new-user profile trigger and required migrations.
- `email_delivery` or `over_email_send_rate_limit`: inspect Supabase Auth/SMTP configuration and email limits.
- `signup_disabled`, `email_provider_disabled`, or `captcha_failed`: review Supabase signup/provider/CAPTCHA settings.
- `network`, timeouts, or 5xx statuses: check service availability and hosting-to-Supabase connectivity.
- No `auth_signup_started`: verify the deployment contains this code and inspect hosting request errors; middleware/configuration, routing or server-action transport failures can happen before the action runs.

Logs omit submitted names, emails, ages, passwords, tokens, user IDs, environment values, raw errors/messages/stacks and provider response bodies. Diagnostic IDs remain server-side; public error messages and signup behavior are unchanged. Restrict hosting/Supabase log access and configure retention separately. Do not share raw Supabase logs containing account information.

## Administrator setup

Use a trusted Supabase administrator session or Admin API to set `app_metadata.role` to `admin` for an explicitly approved registered account. Do not use `user_metadata` or a browser-controlled role field. No existing account has been promoted automatically; browser tests create and then delete a temporary administrator.

Create or review a submitted lesson in the studio, then select the review-and-publish checkbox. The administration page grants quiz-report access using a registered user's UUID and can revoke existing grants. This grants report access, not learner assignment.

After bootstrap, use Account maintenance to grant an instructor role; never expose the service key to a browser. Instructors can manage only their own lessons and reports. Teaching > Manage learners supports email-filtered selection of up to 50 verified learner accounts per action; duplicate enrollment preserves existing progress. No account is created and no invitation email is sent by this operation. Instructor directory searches require at least three email characters and return only minimal account labels, not profiles or AI eligibility.

## AI availability and privacy

Only explicit `provider/model:free` IDs verified against the zero-price OpenRouter catalog are accepted. The default `OPENROUTER_MODEL` is `nvidia/nemotron-3-ultra-550b-a55b:free`, with no default fallback; model/fallback environment overrides and the existing key alias remain supported. Missing, invalid or nonzero-priced catalog entries fail closed before authenticated inference. There is no paid fallback. A single selected ID is sent as `model`; optional fallbacks remain a comma-separated priority list (up to ten total models), sent as ordered `models` only when multiple IDs remain after deduplication. Requests send **no `provider` or `reasoning` overrides**: ZDR, data-collection denial and reasoning-disabled behavior are not enforced by the request. Account/provider policies still apply; fallback cannot bypass account quotas. Lesson generation retains strict `response_format` JSON schema. Catalog validation, inference and response-body reads share one **30-second default / 60-second maximum deadline**; lesson parts explicitly choose 60 seconds, coaching/interviews remain at 30 seconds (smaller injectable test deadlines are allowed). For lesson, coaching and interview requests alike, `max_tokens = min(16384, max(256, 3 * len(text)))`, interpreting `text` as all outgoing message contents concatenated without separators: count Unicode code points like Python `len`, not UTF-16 units or graphemes; roles and schema JSON are excluded. This intentionally differs from translation's raw-note-only count. Provider failures never save a fabricated lesson. Manually authored lessons do not require AI. This configuration is not live availability verification.

`npm run check:ai` checks the public catalog and account quota without inference.
The `--probe=structured` and `--probe=text` options make connected inference
requests and consume quota; run them only with separate authorization. Offline
tests and catalog checks do not establish live AI availability.



### Current eligibility and data protection

External AI authorization requires authenticated trusted administrator approval; it does not depend on profile age or profile lookup success. Signup, profile and onboarding age rules still apply.

Application limits are **5 new saved lesson starts** (including material imports) and **15 shared text-AI requests (coach plus interviews)** per account per UTC database day. Starting atomically claims quota even if later inference fails; resuming/replaying parts does not claim another start. Each stage instead has three bounded explicit attempts, and provider quotas still apply to every call. Failed coach/interview calls consume their shared text request. Quiz retries are never rate-limited by these counters. Provider-wide free quotas may be lower than aggregate user demand.

**Deployment gate:** before exposing AI to minors or deploying in any target region, review OpenRouter account eligibility, the selected upstream provider's age/region terms, consent requirements and data-processing arrangements. A safe-language prompt and a checkbox do not establish legal eligibility. Do not weaken the privacy policy or switch to a paid endpoint without approval. No production eligibility review has been completed.

For existing workflows, the provider receives a chosen objective and explicit curriculum selection, consented extracted teaching text, or lesson slides and recent coach exchanges. AI paths send only derived coarse preferences and course metadata. Account identifiers, raw profile fields, grades and quiz answer keys are not sent. Onboarding backgrounds and diagnostic answers/summaries add no provider payload fields; the diagnostic is local. Users must not enter personal data in free text or uploads. Provider retention must be independently confirmed; the app does not persist lesson-coach history or original uploaded teaching files. Interview history is owner-scoped and included in account export. Interview context uses only a reviewed topic description, chosen level, phase/answer count and bounded canonical saved text; no account/interview/request IDs, raw profiles, grades or answer keys are added. Rate counters contain no prompt text and old counters are removed on the next AI request.

New learning tables deny direct `anon` and `authenticated` access. All reads and writes use authenticated server operations with explicit ownership/reviewer checks; the service key is server-only. The answer key is omitted from the lesson player's initial props. Review feedback is revealed only after a saved submission.

Existing learning records remain until account deletion. Approved private interview transcripts remain until individual interview or account deletion. Deleting an author removes their lessons and enrollment links, but other learners retain certificate/result snapshots. Deleting a learner removes their own records. Database backups and hosting/provider operational logs require separate retention configuration; the application cannot promise immediate erasure from those systems. Avatars are decoded and resized to 160px JPEGs in the private profile row, without a public storage bucket.

## Verification

Run the local checks from the repository root:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` includes offline component tests mounted in Chromium. If the browser is
not installed, run `npx playwright install chromium`. These synthetic tests do
not verify a connected Supabase project, live authentication, AI availability
or deployment behavior.

### Optional connected browser tests

The authenticated browser suites write temporary accounts and application data
to the configured Supabase project. Use only a separately authorized,
disposable non-production project with the required migrations; never point
them at production. Run the application on loopback, and keep
`E2E_BASE_URL` equal to `NEXT_PUBLIC_SITE_URL`. Non-loopback application URLs
are rejected.

```bash
npm run test:e2e
npm run test:instructors
```

The suites clean up the temporary fixtures they create. If cleanup fails, use
the test's reported account identifier for authorized cleanup. The
`E2E_SCOPE=authoring` option skips resume/profile/export coverage, but still
requires onboarding and its schema prerequisites. These commands are separate
from `npm test`; connected execution is not implied by a local test pass.

GitHub Actions runs the automated test, lint, type-check and production-build
gates on pushes and pull requests. It does not run connected database checks,
AI probes or the database-writing browser suites.

## Deploy to Vercel

Deployment requires separate owner approval. For an approved target, import the repository using the Next.js defaults, configure environment variables, apply only outstanding migrations, and set the deployed origin in Supabase Authentication URL Configuration. Teaching extraction plus inference declares a 90-second route budget; confirm the selected Vercel plan/runtime supports it. PDF.js is externalized and its worker included in tracing, but deployed parsing and function memory limits still require staging verification. Complete provider eligibility, restricted-demo access, data protection and end-to-end gates before inviting learners.
