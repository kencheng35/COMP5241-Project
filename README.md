# Forge Learning Studio

A Next.js 16 / React 19 learning application for COMP5241, using Supabase Auth/Postgres and server-side OpenRouter inference.

Track remaining work, blockers, acceptance criteria and verification updates in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

## Current coordination — 20 October 2026 - lesson creation repair

**Independent bounded LOCAL acceptance only; live creation remains unverified.** Forge Implementer delivered the manual-validation, eligibility-error and uncertain-save/AI acknowledgement recovery repairs; Forge QA independently accepted them on **20 October, 09:34–09:36 HKT**: **232 tests passed**, with lint, typecheck and build exit 0. Manual creation remains independent of AI access/provider availability; canonical content, authorization and privacy rules are unchanged. Coordinator reconciled documentation only. The original connected failure/root cause remains unestablished: this is not a claim that live generation or all creation failures are fixed, nor release/project completion. Whole-project and associated tasks remain **Open/Partial**. Connected checks need a confirmed intended disposable nonproduction Supabase target/app origin and authorization, with separate permission for any quota-consuming AI probe. See the [20 October tracker handover](IMPLEMENTATION_TRACKER.md#current-coordination--20-october-2026---lesson-creation-repair) for ownership, six delivered files, independent local evidence and pending gates; the 15 October entries below remain historical.

### 20 October follow-up — activity-step blank lines (IMPLEMENTER only; independent QA pending)

After the first repair, the user reported `Please check activity.steps.1: Too small: expected string to have >=1 characters.` An offline real-editor regression reproduced that exact blank-second-step error. Activity entry now retains raw typing/newlines while preview, submitted steps and dirty/saved comparisons consistently ignore blank lines and surrounding whitespace. Field-associated guidance/focus requires **3–6 real ordered steps, each ≤120 characters**; no missing content is invented or meaningful steps truncated. Server validation and the provider JSON schema remain unchanged, as do the six earlier repairs.

Local implementer evidence: corrected red authoring run **17 passed / 2 failed** (regression + parent), immediate green **19/19**, expanded authoring **24/24**, final `node --experimental-strip-types --test tests/manual-authoring.test.mjs tests/learning.test.mjs` **31/31**. Scoped ESLint, direct `tsc --noEmit --incremental false` and diff whitespace checks passed. Keyboard/focus, retained input, preview/save order and same-ID updates passed at 320px/1440px; six activity screenshots were opened and inspected. This follow-up is **not independently accepted**: full suite/build and all connected gates remain for authorized independent QA. No environment-file reads/imports, remote services, installs, migrations, commits or deployment. See the tracker follow-up for reproducible commands and evidence paths.

## Current coordination — 15 October 2026, 03/18 + 08 integration

**Independent bounded LOCAL QA accepted at 15:07 HK; not release or whole-project acceptance.** Forge Implementer delivered onboarding/local diagnostic, the coupled profile/email repairs (03/13/18/20) and browser-harness integration; the disjoint curriculum writer delivered canonical curriculum/metadata and manual-authoring repairs (08/14). With all source frozen, Forge QA independently verified the integrated local packet and owns this final documentation-only evidence update. The project owner still approves pedagogy/content and release.

- Coordinator reports the stable combined **13-file focused run: 134 passed, 0 failed/skipped**, with direct `tsc`, scoped lint and diff checks passing. The initial onboarding packet's 33-pass/one-startup-failure result is superseded: the curriculum writer repaired leaf-module imports within ownership, without adding an account-test loader workaround. These are implementer/integration results, **not independent acceptance**.
- Independent **preimplementation** QA at **14:17:48.940 HK** passed **168 tests and lint** over 102 fingerprinted files (`935b1f3fa1586827c85fe8401c3a98ff26037fe952cd30ef60e468c1098ab235`). This remains baseline evidence, distinct from the fresh acceptance below. The separate historical Task25 repair already had independent local 168-test acceptance; its connected gates remain open.
- The earlier harness/docs handoff ran `node --check` on both harnesses, scoped ESLint, and **22 isolated synthetic helper contracts** using the real registry/schema and UI/database adapters. Independent QA subsequently inspected the bounded onboarding/schema/metadata adaptations without executing either connected harness.
- **Final independent gates, 15:06:14.580–15:07:19.543 HK:** one serialized run each of `npm test` (**224 passed, 0 failed/cancelled/skipped**), `npm run lint`, `npm run typecheck` and `npm run build`; all exit 0. Next.js 16.3.5 Turbopack completed **23/23** static-generation work items; onboarding/diagnostic routes are dynamic. Earlier independent **47/47** targeted repair tests were not redundantly rerun as a separate subset.
- The first full attempt was **223/224**, stopped before lint/typecheck/build because the old eligibility fixture omitted the new profile revision/auth/CAS contract. The sole subsequent change, `tests/eligibility.test.mjs`, adapts that fixture and adds owner/revision/matching-ID assertions while preserving age/minor/no-grant assertions. **Resolved test adaptation, not an application regression or policy relaxation.**

The five reproduced profile issues are locally repaired: operational/auth/uncertain email-change handling with retained address and no automatic replay; retained actual File/removal/text state after failed saves; failed/missing profile loads cannot expose saveable defaults or be masked by success-query text; 320px file-control wrapping and keyboard/focus behavior; and mutation denial for returned auth errors even when a user is present. Shared revisions also protect profile choices from stale diagnostic/onboarding tabs. The actual manual-editor regression changed from **two inserts** to **one insert followed by a same-ID update to version 2**.

**Repair closure:** the earlier independent **33 targeted + 103 curriculum/account** runs verified the original five profile contracts and onboarding role/scoring/owner/state checks, then exposed QA-FOCUS-01/02 and QA-MANUAL-01. The focus writer's four red keyboard cases and **18/18** repaired UI result remain implementer evidence. Independent **47/47**, followed by the final **224/224**, now close all three findings locally: Cancel retake focuses the persistent saved-result heading, Cancel picture change focuses the chooser, and both work without mutations at **320×844 and 1440×1000**. Manual creation distinguishes definite rejection from ambiguous acknowledgement: thrown/returned-error/missing-data/malformed-ID post-insert variants retain the draft, leave one row and block another create. Private catalog recovery opens separately; published recovery uses the permission-gated teaching library. Canonical existing-ID reconciliation and the original same-ID/version-2 save remain passing. The persistent curriculum render-synchronization harness repair also passes without weakening assertions.

**Reproducibility and safety:** snapshot captured **15:05:50.662 HK**, 125 files from `src/`, `tests/`, `scripts/`, `supabase/` and seven named root package/config files; SHA-256 `b46b50503e3865dc5188576836f7c5c07cd82d6cfac530e2670350c98a39cf89`. Repository/copy inputs stayed unchanged; fingerprint comparison confirmed only the eligibility fixture changed from the previous attempt. Windows, Node **25.2.1**, invoked bundled npm **11.6.2**, TypeScript **5.9.3**, ESLint **9.39.5**, Playwright **1.63.0**, Chromium **153.0.8010.12**. Existing dependencies and an OS-environment allowlist were used; no environment-file reads/copies, credentials, installs, remote services, connected suites, migration application or deployment. Generated files stayed in the owned snapshot, which was removed with absence verified. The final run retained **49 synthetic screenshots; 17 were opened and inspected**, including all four cancellation-focus views and manual uncertainty at mobile/desktop. Two full-page profile captures contain viewport-transition/fixed-header artifacts and are not settled-layout approval. Exact commands/timings, evidence paths and limits are in the tracker's final independent local QA entry.

**The whole project and 03/08/18/25 remain Open/Open-Partial:** local starting-point setup and metadata do not establish genuine tailoring, reviewed curriculum/resources or connected acceptance. Reviewed progress (09/12), targeted AI revisions (14/16), actual tailoring (18), required legacy PPT/student slide assistance (19), 4D/reflections (22), private planner (23), embedded coding (24), and all provider/connected/owner/release gates remain open. Historical logs below retain their original evidence dates.

## Approved delivery scope (15 October 2026)

Target: 31 October 2026, focused on university learners and instructors. This remains a supervised Hong Kong course demonstration with the existing 13+ signup policy, not an approved public launch. The project owner performs final review and owns the course submission. The 15 October owner-confirmed scope supersedes conflicting September SDLC-only limits and deferrals, not the existing safeguards.

### Approved target — bounded implementation status

- Role-appropriate first-login background/goals onboarding and a separate explained local diagnostic with explicit adoption/override/retake are implemented locally; self-report never grants instructor rights. Connected acceptance and owner pedagogical review remain open.
- Explicit lesson audience, difficulty, outcomes and prerequisites with filtering, plus canonical SDLC, AI coding-agent and software-development soft/product families, are implemented locally. Reviewed demonstration content and learning/tool resources remain open.
- Genuinely tailored explanations, examples and practice, not merely reordered recommendations. AI-assisted targeted instructor revisions require preview, accept/reject and versioning.
- Clear reviewed vs attended vs passed progress states; activities and reflections applying AI fluency 4D: Delegation, Description, Discernment and Diligence; daily reflections.
- A **private project planner** (goals → suggested stack/structure → editable milestones/tasks/progress) and a **student slide assistant** (authorized course material or personal uploads → source-referenced summary, key terms, glossary and beginner explanations; private by default).
- **Embedded coding (24):** beginner-friendly, initially **JavaScript and Python**, as confirmed on **15 October 2026 at 11:20 HK**; TypeScript/other languages are not required. Runtime/execution isolation and resource controls still need design/feasibility before implementation. Outbound links do not replace embedded coding.
- **Real-time interviews (25): LIVE TEXT only**, with no voice/video requirement. Persistence was approved in principle at 11:20 HK; the **15 October 11:26 HK decision approved private owner history, deletion, export/account cascade and retention until deletion**. Bounded local implementation is now present at `/interviews`; migration application and connected acceptance remain open. Generic lesson-coach chat remains session-only with no persisted history.

**Interview transcript policy — APPROVED, 15 October 11:26 HK:** private learner-owner history/list/reopen/continue, explicit finish and individual deletion; retain until interview or account deletion; include transcripts in account export and Auth-user FK cascade. No automatic administrator, instructor, reviewer or peer access. History/read/finish/delete/export require authentication and ownership, not an active AI grant. Each new inference/retry additionally uses the existing adult/trusted-grant gate and unchanged free-only strict-privacy AI client. This approval does not certify live persistence, provider retention or deployment readiness.

Retained structure: **one standalone lesson per mini-course; no multi-lesson containers**. No community is required: no peer showcases/sharing, human Q&A, instructor news/community feed, comments or community notifications. Campus retrieval, lecture-video ingestion/alignment, rich advanced media/real-time voice/video, and broader games/simulations are not newly approved; basic tailored practice and 4D activities are core.

Beyond the approved private interview transcript policy, this scope decision does not authorize other conversation/recording storage, new services, public hosting/deployment, paid endpoints, privacy-filter relaxation or third-party analytics/training use. Free-only AI, privacy filters, minor/unknown-age external-AI denial, administrator-approved recorded-adult AI access, admin-granted instructor rights, owner-scoped publishing/reporting, explicit enrollment, optional paths, quiz/certificate rules and no persisted coach history/original upload retention all remain. Required legacy PPT import is still open. See the [current scope record](IMPLEMENTATION_TRACKER.md#current-approved-scope---15-october-2026), [current overview](IMPLEMENTATION_TRACKER.md#current-overview) and tasks 03/08/09/12/14–16/18/19/22–25 for owners, acceptance and dependencies. Approval is not feature completion or live verification.

### Existing implementation and limits

- Administrators use `/admin/accounts` to search accounts by email, grant/revoke instructor rights, and approve/revoke external AI access for recorded adults. Administrator accounts cannot be demoted by this interface.
- Instructors use `/teaching` to create, publish and edit their own lessons, select existing verified learners by email filter for enrollment, and view only their own published-lesson reports. Administrators retain global public-lesson control. Existing self-enrollment and private-draft isolation remain.
- First dashboard entry sends incomplete accounts to `/onboarding`; later edits and `/diagnostic` are linked from `/profile`. Completion/background and the latest diagnostic summary are separate from the chosen `learning_level`. Current trusted instructors/admins receive instructor questions; reviewers and other accounts receive learner questions. No self-reported privilege grants, invented historical completion/ages, raw answer history or new diagnostic AI payloads.
- The six-question local diagnostic uses draft rubric `draft-2026-10-v1`: 0–1 New, 2–3 Foundation, 4–5 Intermediate, 6 Advanced. Retaking never changes the chosen level; adoption/override is explicit. Owner pedagogical review is still required. Recovery/profile/export/deletion remain reachable when setup is incomplete or unavailable.
- `/paths` provides optional, explainable local recommendations across the three canonical families and an explicit AI path action. Paths never enroll learners, and generated paths are session-only. Only coarse learning preferences and course metadata are sent to AI, not account identifiers, raw profile goals, grades or answer keys. This is not genuine lesson-content tailoring.
- Teaching imports target an editable private draft and quiz; successful end-to-end AI generation remains unverified. Searchable PDF and PPTX text extraction is implemented; originals are not saved. Limits: 4 MiB, 60 pages/slides, and 20,000 extracted characters for generation. Scanned/image-only PDFs require OCR outside this workflow. Legacy binary `.ppt` remains an unmet requirement and is rejected explicitly; no supported serverless conversion dependency has been verified.
- Authoring, generation, coaching and paths now share the canonical curriculum registry: **Software Development Life Cycle**, **AI Coding-Agent Skills**, and **Software Development Soft and Product Skills**. New lesson writes require version-1 `content.metadata` with topic, audience, difficulty, 1–8 outcomes and 0–8 prerequisites. Audience expresses suitability, not access permission. Legacy aliases are read through the registry; absent/invalid legacy metadata is **Not specified**, never inferred beginner/everyone/no-prerequisites. No curriculum DDL/backfill was added. Older writers can strip JSON metadata on rollback; freeze/review writes before reverting. Schema/prompt alignment does not prove semantic quality; owner-reviewed content/resources remain required.
- External AI is denied to minors and unknown-age accounts. Recorded adults additionally require a trusted administrator AI-access grant. This is a technical gate, not independent age verification or proof of legal consent.

Previously recorded connected blockers (not rechecked by these packets): the database lacked `profiles.age`; the resume table passed an empty-read check, but service-role grants and full resume behavior still needed verification. The new onboarding/diagnostic migration is also required for profile editing. No migration was remotely applied in these packets; connected applied status remains unverified regardless of filename suffix. Live free-model probes returned 429 and 404 under the unchanged privacy restrictions; successful generation remains unverified. Production encryption-at-rest configuration, backups, retention and Hong Kong/provider eligibility have not been certified.

## Existing learning workflows

- Authenticated catalog search, explicit self-enrollment, saved lessons and real progress records. No assigned learners or invented progress.
- Standalone private AI-generated or manually authored lessons (one lesson per mini-course), with 4-6 short slides, an ordering activity and exactly 10 four-option quiz questions; live AI success remains blocked as noted above.
- Server-side grading: 6/10 passes; retries are unlimited. Attendance records reaching the final quiz, independently of submission or passing.
- Downloadable, printable HTML certificates for every passing attempt. Private Self-Learning and Public Published Lesson certificates retain the lesson version and visibility at achievement time.
- Structured editing and optimistic version checks. Learners edit their own private lessons; instructors publish/edit their own public lessons and administrators manage public lessons globally.
- Private drafts are invisible to other accounts, including administrators, until the owner explicitly submits them for publication review.
- Administrators grant per-published-lesson report access to registered reviewers. Reports contain public participation and submitted quiz answers, never coach conversations or private attempts.
- Session-only contextual AI coaching, with no server-side conversation storage.
- Verified-email authentication, password recovery, profile image validation/resizing, verified email-change requests, paginated JSON export and password-confirmed account deletion.
- Optional three-family recommendations and AI learning paths, plus instructor-selected enrollment of existing verified learners. No roster-file uploads, cohorts or notifications.

## Run locally

```bash
npm install
npm run dev
```

Use Node.js 22.18+ (or Node.js 24 LTS). Configure the variables listed in [.env.example](.env.example) in your local environment. Never expose the service-role or OpenRouter keys through `NEXT_PUBLIC_` variables. The existing `OPEN_ROUTER_API_KEY` spelling is accepted as an alias for `OPENROUTER_API_KEY`.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` are required for authenticated access. Set the site URL to the canonical deployment origin (no path, query or credentials); use HTTPS except for local loopback development. Set `NEXT_PUBLIC_SITE_URL` to your deployed HTTPS origin in Vercel's environment variables; keep `.env.local` pointed at your local server. `.env.prod` is not loaded automatically by Next.js or Vercel. Misconfigured protected pages return a retryable 503 screen, and APIs return a 503 JSON error. The setup diagnostic checks these settings without printing their values.

In the Supabase SQL editor, apply these files in order:

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
11. [supabase/migrations/20261015_onboarding_diagnostic.sql](supabase/migrations/20261015_onboarding_diagnostic.sql).

These are the verified current filenames; `_ran` is a filename suffix, **not evidence of applied status**. No migration was renamed or remotely applied in the Task25 packet. Apply the interview migration before enabling interview pages/actions **or account exports**, which now require the 14th table `forge_interviews`. Missing migration/access fails the entire export rather than silently omitting transcripts. Setup diagnostics use an empty metadata-column read, not transcript inspection; they do not prove RPC permissions or transactional behavior.

The onboarding/diagnostic migration adds nullable `onboarding_completed_at`, `onboarding_background`, `diagnostic_summary`, and integer `learning_setup_revision` (initially 0) to `profiles`, with bounded JSON checks, protected setup writes and a revision trigger. It is required for **dashboard onboarding, diagnostic actions and ordinary profile editing**. Both browser harness scopes require this schema and numeric-age eligibility. It makes no historical completion/background/age backfill; existing unknown-age rows may still fail prior age constraints until explicitly reviewed. `profiles.*` owner export includes the fields and the existing Auth-user cascade removes them. Application of this migration remains outstanding/unverified in the connected target; local PGlite checks are not deployment evidence.

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

Successful password reset requests global sign-out before returning to login. Ordinary **Log out** also uses global scope, revoking refresh sessions across devices rather than only this browser. Already issued access tokens can remain valid until their configured expiry; this is not an immediate access-token revocation guarantee. Provider or cookie-cleanup failures show retry guidance, and a confirmed password update followed by failed logout is reported separately so users know to use the new password. Live multi-session revocation and browser-cookie behavior still require verification on the approved disposable target.

Keep email confirmations and secure email-change confirmation enabled in Supabase. Configure production SMTP. Signup requires a whole-number age of at least 13; under-13 guardian self-attestation has been removed. Profile ages remain self-reported, and minors cannot access external AI under the current demo policy.

## Administrator setup

Use a trusted Supabase administrator session or Admin API to set `app_metadata.role` to `admin` for an explicitly approved registered account. Do not use `user_metadata` or a browser-controlled role field. No existing account has been promoted automatically; browser tests create and then delete a temporary administrator.

Create or review a submitted lesson in the studio, then select the review-and-publish checkbox. The administration page grants quiz-report access using a registered user's UUID and can revoke existing grants. This grants report access, not learner assignment.

After bootstrap, use Account maintenance to grant an instructor role; never expose the service key to a browser. Instructors can manage only their own lessons and reports. Teaching > Manage learners supports email-filtered selection of up to 50 verified learner accounts per action; duplicate enrollment preserves existing progress. No account is created and no invitation email is sent by this operation. Instructor directory searches require at least three email characters and return only minimal account labels, not profiles or AI eligibility.

## AI availability and privacy

Only explicit `provider/model:free` IDs verified against the zero-price OpenRouter catalog are accepted. The default `OPENROUTER_MODEL` is `nvidia/nemotron-3-ultra-550b-a55b:free`, with `OPENROUTER_FALLBACK_MODELS` empty by default/local configuration; a missing or nonzero-priced catalog entry still fails closed. There is no paid fallback. Optional fallbacks remain a comma-separated priority list (up to ten total models), sent in OpenRouter's ordered `models` array. Requests require `data_collection: deny`, `zdr: true` and supported parameters; lesson generation also requires structured output. Fallback cannot bypass account quotas or privacy constraints. Catalog validation, inference and response-body reads share one **30-second default/maximum deadline** (smaller injectable test deadlines are allowed). For lesson, coaching and interview requests alike, `max_tokens = min(16384, max(256, 3 * len(text)))`, interpreting `text` as all outgoing message contents concatenated without separators: count Unicode code points like Python `len`, not UTF-16 units or graphemes; roles and schema JSON are excluded. Reasoning remains disabled. Provider failures never save a fabricated lesson. Manually authored lessons do not require AI. This configuration is not live availability verification.

`npm run check:ai` checks the public catalog and account quota without inference. `npm run check:ai -- --probe=structured` makes one synthetic structured request using the same fallback/privacy client as the application; `--probe=text` tests unstructured coaching availability. No credentials, prompts or output content are printed. The 25 September text and structured probes returned 429 and 404 respectively; no working endpoint has been established. Earlier probe results below are historical, not current guarantees.

Application and setup-probe requests explicitly set `reasoning: { enabled: false }`. A successful standalone request using `deepseek/deepseek-v4-flash-0731` is not an equivalent availability test: that model has nonzero pricing, and the supplied standalone request omits the application's privacy filters and structured-output requirement. Free-only usage was reconfirmed; the paid model has not been enabled or called by these checks.

The supplied key authenticated successfully. Synthetic inference probes did **not** complete: the Qwen free endpoint returned 429 and other tested free endpoints returned 404 under the privacy policy. A working free endpoint still needs to be verified; do not assume the default model is currently available. Free-model availability, limits and upstream terms change.

With reasoning disabled, the latest Qwen probe still returned HTTP 429, and a temporary `liquid/lfm-2.5-2.6b:free` probe returned HTTP 404 under the same required settings. The temporary probe did not change the configured model. These statuses alone do not identify the exact quota or provider restriction.

Application limits are 5 generation attempts (including material imports and AI paths) and **15 shared text-AI requests (coach plus interviews)** per account per UTC database day. Failed provider calls consume a request to prevent repeated abuse. Quiz retries are never rate-limited by these counters. Provider-wide free quotas may be lower than aggregate user demand.

**Deployment gate:** before exposing AI to minors or deploying in any target region, review OpenRouter account eligibility, the selected upstream provider's age/region terms, consent requirements and data-processing arrangements. A safe-language prompt and a checkbox do not establish legal eligibility. Do not weaken the privacy policy or switch to a paid endpoint without approval. No production eligibility review has been completed.

For existing workflows, the provider receives a chosen objective and explicit curriculum selection, consented extracted teaching text, or lesson slides and recent coach exchanges. AI paths send only derived coarse preferences and course metadata. Account identifiers, raw profile fields, grades and quiz answer keys are not sent. Onboarding backgrounds and diagnostic answers/summaries add no provider payload fields; the diagnostic is local. Users must not enter personal data in free text or uploads. Provider retention must be independently confirmed; the app does not persist lesson-coach history or original uploaded teaching files. Interview persistence is locally implemented under the approved 11:26 policy. Interview context uses only a reviewed topic description, chosen level, phase/answer count and bounded canonical saved text; no account/interview/request IDs, raw profiles, grades or answer keys are added. Rate counters contain no prompt text and old counters are removed on the next AI request.

New learning tables deny direct `anon` and `authenticated` access. All reads and writes use authenticated server operations with explicit ownership/reviewer checks; the service key is server-only. The answer key is omitted from the lesson player's initial props. Review feedback is revealed only after a saved submission.

Existing learning records remain until account deletion. Approved private interview transcripts remain until individual interview or account deletion. Deleting an author removes their lessons and enrollment links, but other learners retain certificate/result snapshots. Deleting a learner removes their own records. Database backups and hosting/provider operational logs require separate retention configuration; the application cannot promise immediate erasure from those systems. Avatars are decoded and resized to 160px JPEGs in the private profile row, without a public storage bucket.

## Verification

### T25-QA-01 local repair — 15 October 2026

**Task25 remains Open. Independent QA has not rerun this repair; the initial QA failure below is preserved.** Changed only `src/components/interview-history.tsx`, narrowly extended `tests/interviews-ui.test.mjs`, and added README/tracker evidence. No action/helper/schema/provider changes; QA's server tests and original pagination regression assertions remain intact.

Confirmed creation now fetches the canonical latest metadata page through the existing list action and replaces rows, continuation cursor and latest/older selection together. It no longer prepends/truncates against an old cursor. The UI explains that creation returns to latest history. If that refresh returns an error or loses transport, the previous page/cursor remain unchanged, **Open new interview** remains available, and the notice explicitly distinguishes confirmed creation from failed history refresh. A synchronous in-flight guard prevents duplicate submits and overlapping create/history requests. Lost creation acknowledgements still require explicit reload; creation is never automatically replayed.

Actual local repair checks (Windows / Node.js v25.2.1; synthetic offline fixtures):

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/interviews-ui.test.mjs tests/interviews.test.mjs` | Final **36 passed, 0 failed/skipped**: 19 UI and 17 server tests, including parent tests |
| `node node_modules/eslint/bin/eslint.js src/components/interview-history.tsx tests/interviews-ui.test.mjs` | Passed, exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Passed, exit 0; no Next type generation/environment loading |

Added **10 UI subtests**: latest-page creation with 18/20/41 retained rows (including 20→21 and three-page traversal); creation on older short/full/intermediate pages with 21/40/41 retained rows; returned/thrown post-create refresh failure preserving the prior page/boundary and open link; deferred create-refresh/older-load overlap and same-tick duplicate submits; returned/thrown lost creation acknowledgement with explicit recovery and no replay. The original 21→22 regression is unchanged. Traversals compare every saved ID exactly once, enforce the page cap and reject invented short-page continuation.

Baseline reproduced **24 passed / 2 failed** (one product defect plus parent); the component-only repair passed **26/26**. An added race test initially selected the shell logout form (**34 passed / 2 failed**); correcting only its form selector produced the final **36/36**. Existing Node module-type warnings are non-fatal. Final Chromium reported **0 network attempts / 0 page errors**; overflow checks passed at 1440×900, 390×844, 320×844 and 844×390. Retained **28 synthetic screenshots** at `C:\Users\SOLUSER\AppData\Local\Temp\forge-task25-qa-o0VBhA`; the implementer inspected success and refresh-failure history at desktop/320px (four images), not an independent visual acceptance. Only this repair's three intermediate capture directories were removed; original QA evidence was preserved.

**Handoff:** request independent QA to rerun local gates and the retained/extended regressions. Full suite, Next typegen/build and connected checks were not rerun in this repair. No agents, installs, environment-file reads, services, remote operations, migrations, commits or deployment. Existing connected routing/auth transport, Postgres concurrency/grants, export/cascade and provider/privacy gates remain open.

### Independent Task25 QA — 15 October 2026

**Task25 remains Open; local acceptance is not certified.** Independent QA reproduced a history-pagination defect in `src/components/interview-history.tsx:43`: with 21 retained interviews, create another on the first page, then select **Older interviews**. Prepending/truncating the displayed rows leaves the old cursor, skipping the displaced record (21 of 22 reachable). **Reload latest history** recovers it; storage was not deleted. A failing actual-component regression is retained in `tests/interviews-ui.test.mjs`. Implementer repair requested: reconcile the displayed page and cursor together after confirmed creation, including creation on older/full pages, without automatically replaying creation.

Actual Windows / Node.js **v25.2.1**, npm **11.19.1** QA results:

| Command / scope | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/interviews.test.mjs` | **17 passed, 0 failed/skipped**; strengthened all-six-action auth-failure coverage |
| `node --experimental-strip-types --test tests/interviews-ui.test.mjs` | Final **7 passed, 2 failed, 0 skipped**; pagination subtest plus its parent are the two failures |
| `npm test` | Final **156 passed, 2 failed, 0 skipped** / 158 total; same single product defect |
| `npm run lint` | Passed, including final test-only changes |
| `npm run typecheck`, then `npm run build` | Both passed in a secret-free temporary source/config copy using existing dependencies; default Next.js **16.3.5 Turbopack**, TypeScript and **21/21 static-generation work items** completed |

QA changed only the two interview test files and this README/tracker evidence, not application code, migrations or manifests. Existing auth/deletion, 14-table paginated export (including interview later-page failures), private-owner/role denial, eligibility, quota/replay/race/recovery and privacy-client regressions passed locally. Protected routes and setup diagnostics were source-reviewed, not connected-tested.

Network-blocked actual-component Chromium **153.0.8010.12** recorded **0 network attempts and 0 page errors**. QA independently inspected **24 screenshots**: history, pending, failed/retry, connection loss, finished and deletion confirmation at **1440×900, 390×844, 320×844 and 844×390**. Notices, transcripts and controls wrapped without horizontal overflow; focus indicators were visible. Long selected topic text clips within native narrow selects (non-blocking visual limitation). Keyboard recovery retained the unsaved draft; retry, finish, delete/cancel and mobile navigation focus checks passed. Evidence: `C:\Users\SOLUSER\AppData\Local\Temp\forge-task25-qa-Lvz9Jt` (`<state>-<width>x<height>.png`).

Temporary build copy/wrapper and intermediate/duplicate screenshots were removed; test browser contexts and in-memory databases closed. No installs, workspace environment-file reads/edits, remote Supabase/AI/mail operations, server deployment or migration application. Git was unavailable: no diff/commit verification claim. Real routing/action transport, multi-session Postgres locking, migration/grants/RPCs, connected cascade/export, provider feedback and retention remain open; prior age/grant/free-provider blockers were not re-probed. Task24 and broader Group A scope are not completed by this QA. See the tracker for detailed repair and verification boundaries. The implementer's earlier evidence below is preserved as history.

### Task25 local implementation evidence — 15 October 2026

Dedicated `/interviews` history/create and `/interviews/[id]` reopen/continue/finish/delete are implemented locally. Each interview is one bounded typed row. A transaction saves learner text and claims the existing shared quota before inference; expected revisions, request replay checks, a database-time 75-second lease and per-attempt token guard conditional finalization (never an upsert). Explicit retry preserves the saved answer. Finish/delete invalidate pending replies. Creation is empty and is never automatically retried after an uncertain acknowledgement. Notices distinguish failed reservation, saved request without reply, unconfirmed final save, and connection loss; only confirmed canonical text is displayed, without HTML/Markdown execution.

Limits: 8 learner answers plus one opening; 1–1,200 learner characters; 1–1,600 reply characters; 128 KiB transcript JSON; 12,000 total provider-message characters; then-existing 600-token text ceiling (superseded on 20 October by the shared content-based budget in [AI availability and privacy](#ai-availability-and-privacy)); at most 3 explicit attempts per turn; one pending turn per owner; 100 retained interviews; stable metadata-only history pages of 20. Delete an old interview to free capacity—there is no automatic transcript expiry. An expired pending interview must be explicitly retried, finished or deleted before starting another. Successful eighth-answer feedback completes practice; early finish makes no extra AI request and retains existing feedback without inventing a summary or awarding a grade/certificate/hiring decision.

Implementer checks on Windows / Node.js **v25.2.1**:

```powershell
node --experimental-strip-types --test tests/interviews.test.mjs tests/interviews-ui.test.mjs tests/account.test.mjs tests/database.test.mjs tests/eligibility.test.mjs tests/openrouter.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Combined result: **87 passed, 0 failed, 0 skipped**. Scoped ESLint also passed; the exact file-scoped command is recorded in the tracker. Tests execute actual actions/helpers with mocked auth/provider, PGlite migrations/permissions/state constraints, owner and cross-role denials, revoked/minor/unknown eligibility, quota/replay/concurrency/expiry, rollback and uncertain-save paths, finish/delete/account-cascade races, context caps, and 14-table all-or-nothing paginated export including later-page and missing-migration failures. Network-blocked mounted Chromium at 390×844 covers create/history/reopen/continue/retry/finish/delete, pending/save-notice focus, mobile navigation and keyboard newline behavior, text-only rendering and late responses. Zero network attempts/page errors; a synthetic screenshot was captured in memory, **not independently visually reviewed**. Earlier failed fixture/constraint/UI-harness checks were repaired and rerun; Node's existing module-type warning remains non-fatal.

**Open gates:** Task25 stays **Open** for independent QA and connected acceptance. This was one local writer, no agents, environment-file loading, installs, server, remote schema changes, provider/inbox calls, E2E fixtures, commit or deployment. Git was unavailable. Direct `tsc` deliberately avoided the `npm run typecheck` wrapper's Next environment-loading type generation; full suite/build/type generation and independent visual review were not run in this packet. PGlite contention tests are serialized by its local engine; real multi-session Postgres locking, PostgREST/RPC/grants, hosting timeout behavior, real account cascade/export, and an eligible free-provider interview remain unverified. Migration not applied; existing connected blockers were not rechecked. Request independent QA to run local gates serialized, then separately authorize a disposable connected target. Task24 has an isolated guest/WASM runtime direction only; no JavaScript/Python runner capability was implemented or verified. Other Group A scope remains pending.

`npm test` includes offline component tests mounted in real Chromium. Install the Playwright browser beforehand with `npx playwright install chromium` (Linux CI uses `npx playwright install --with-deps chromium`); a missing browser fails the tests rather than skipping them. These synthetic fixtures need no Supabase configuration or AI access. The opt-in authenticated browser suites below remain separate and write to the configured Supabase project.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Unit/database tests cover pass thresholds, malformed submissions, safe redirects, complete pagination, migration execution in isolated PostgreSQL-compatible PGlite, direct-access denial, request quotas and certificate retention.

The focused auth checks run with `node --experimental-strip-types --test tests/auth.test.mjs`. They cover reset/global-logout ordering, returned/thrown provider failures, strict cookie cleanup, read-only cookie tolerance, recovery focus/pending/retry, conflicting query notices and responsive error layouts. They mock provider calls and mount the real form in network-blocked Chromium; screenshots contain synthetic data and go to an OS temporary directory printed by the test. They do not establish live session revocation or email delivery.

9 October local auth continuation: 90 total tests and typecheck passed. A React prop-immutability lint issue was repaired, lint then passed, the final 20 focused auth checks passed again, and the production build passed including TypeScript. The full 90 were not rerun after that small lint repair. These Windows/Node.js 25.2.1 results are separate from hosted CI, independent QA and connected browser acceptance.

9 October subsequent team verification (Coordinator-supplied independent Forge QA report): no substantive defect found; bounded LOCAL acceptance passed on Windows/Node.js v25.2.1 win32/x64. The focused account suite passed 41 tests and `npm test` passed 131, both with zero failures/skips; lint, typecheck and build passed, including TypeScript and 20 static pages. QA visually inspected all 8 network-blocked actual-component/CSS deletion-fallback and cleanup-notice scenarios in Chromium 153.0.8010.12 across desktop, mobile and landscape; interaction/layout checks passed with zero network attempts/page errors. Offline actual-handler/action tests are not live HTTP, Supabase/provider/session, schema/grant, cascade/snapshot/retention, hosted Node.js 24 or full accessibility proof. Task 05 remains Open; this documentation update did not rerun QA. Detailed evidence and retained temporary screenshot locations are in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

GitHub Actions runs these tests, lint, type checking and a production build on pushes and pull requests using Node.js 24 LTS. The workflow requires no application secrets and does not run live database checks, AI probes or the database-writing browser suite.

25 September verification: 60 local tests passed, along with lint, typecheck and production build. `npm run test:instructors` passed 18 live workflow stages, including admin role changes, instructor ownership, real publication, directory filtering, duplicate enrollment preservation, report isolation, and stale-form denials after revocation. It also checks 1440/390/320px layout and mobile navigation; all four temporary accounts were deleted. This test defaults to a local server at `http://127.0.0.1:3126` and supports `E2E_BASE_URL`. Like the existing E2E suite it writes to the configured Supabase project: use only the authorized disposable development environment. It makes no AI calls or email sends.

### Authenticated browser tests

With the local dev server running and a migrated development Supabase project configured:

```bash
npx playwright install chromium
npm run test:e2e
```

This opt-in command writes to the configured Supabase project: it creates three temporary, email-confirmed accounts (including one administrator), one initially unconfirmed signup account, and temporary lessons/results. It exercises real login and server actions, changes only a temporary account's password, and deletes its accounts and associated fixtures in cleanup. It never changes existing accounts. Use a development project, not a production database. Generated credentials and verification tokens remain in process memory and are omitted from test output; screenshots contain only test data and are written to a temporary directory printed on completion. Callback requests carry tokens in their query strings, so application/proxy access logs must be treated as sensitive and query values redacted in production. If cleanup fails, the command reports the temporary account ID for manual removal. The browser tests use `NEXT_PUBLIC_SITE_URL` from the local environment; `E2E_BASE_URL` must match it when selecting another localhost port. Non-loopback application URLs are rejected. The command is separate from `npm test` and makes no AI requests or email sends.

`E2E_SCOPE=authoring` skips the full resume/profile/export workflow, **not onboarding or its schema prerequisites**. Both scopes complete first-login onboarding through the real UI, including newly confirmed signup accounts; no completion marker is seeded. Profile checks use the saved revision, and manual/instructor fixtures resolve the testing alias through the curriculum registry and write canonical metadata. The instructor harness also updates background through the trusted-instructor UI after the administrator grant, and fills required import metadata before testing stale-role denial. Existing permission, quiz/version and temporary-account cleanup checks are retained. These harness integrations have syntax/lint/synthetic-helper evidence only; connected execution is still pending.

For a server on port 3107, set `NEXT_PUBLIC_SITE_URL=http://localhost:3107` when starting the server and run this in PowerShell only after authorizing the disposable database: `$env:E2E_SCOPE='authoring'; $env:NEXT_PUBLIC_SITE_URL='http://localhost:3107'; $env:E2E_BASE_URL=$env:NEXT_PUBLIC_SITE_URL; npm run test:e2e`. Set `E2E_BROWSER` to `firefox` or `webkit` for those Playwright browsers (default: Chromium). The full suite additionally requires the resume/grant migrations. `npm run test:instructors` also writes temporary database fixtures and requires separate connected authorization.

Historical connected evidence, before the resume migration and before the current onboarding/metadata changes: manual creation, consecutive editor saves, private isolation (including administrators before review submission), self-enrollment, bookmark persistence, desktop/mobile lesson layout and navigation, ordering practice, attendance without submission, 5/10 failure, 6/10 pass and retries, private/public certificates, cross-account certificate denial, publication snapshot preservation, stale quiz rejection, reviewer grant/revocation, exclusion of private attempts from reports, and learner-scoped export. All temporary test accounts were removed in that run; this is not acceptance of the integrated harness.

Also verified through real forms: profile-field persistence, image upload and conversion to 160x160 JPEG, displayed image loading, rejection of invalid and oversized uploads without changing saved data, picture removal, wrong-password deletion rejection, successful password-confirmed author/learner deletion, session invalidation, and retention of another learner's certificate after author deletion. The test keeps generated passwords in memory and deletes only its own temporary accounts.

Auth link handling is also verified with Supabase Admin API-generated links: rejection of invalid tokens and unauthenticated password updates, unverified-login rejection, signup confirmation/session creation, same-origin redirect enforcement, single-use signup/recovery links, password-rule validation, recovery through the real reset form, old-password rejection, and new-password login. Missing credentials, unsupported verification types, ambiguous token/code combinations and invalid PKCE codes are rejected. Successful and rejected redirects carry no-store and no-referrer headers. Successful PKCE code exchange remains unverified; successful confirmation and recovery tests use the `token_hash` branch.

Still unverified end to end: successful AI generation/coaching (the latest synthetic probe returned HTTP 429), signup/reset/resend email requests and inbox delivery, PKCE email callbacks, and verified email-address changes. Mail flows need a controlled test inbox; generating links without sending mail does not verify SMTP, templates, or delivery. Provider eligibility and retention review remain deployment gates.

Before deployment, verify with separate learner, reviewer and administrator accounts: private isolation, enrollment, attendance without submission, failed/passing/retried quizzes, stale quiz versions, certificates, explicit review submission, report permissions, email confirmation/recovery, profile uploads, export and deletion. Check mobile and desktop layouts. Certificate files are printable HTML, not digitally signed credentials or accreditation.

## Deploy to Vercel

Import the repository using the Next.js defaults, configure all environment variables, apply migrations, and set the deployed origin in Supabase Authentication URL Configuration. Teaching extraction plus inference declares a 90-second route budget; confirm the selected Vercel plan/runtime supports it. PDF.js is externalized and its worker included in tracing, but deployed parsing and function memory limits still require staging verification. Complete provider eligibility, restricted-demo access, data protection and end-to-end gates before inviting learners. Deployment is not authorized by the current implementation approval.

## Final independent T25-QA-01 verification — 15 October 2026

**Governing QA reconciliation: T25-QA-01 is fixed and independently verified; bounded LOCAL acceptance passes. Task25 remains Open for connected/release gates.** This final follow-up supersedes the earlier statements that independent QA has not rerun the repair or that local acceptance is blocked/not certified. Those dated initial-failure and implementer-handoff entries remain historical evidence, not the current QA disposition.

Sole test/build runner; no subagents. Windows, Node.js **v25.2.1**, npm **11.19.1**, Chromium **153.0.8010.12**. Inspected the changed component/assertions and test/script side effects. All commands below ran serially in a secret-free temporary copy: named source/config/test/schema files only, existing dependencies hardlinked, OS-variable allowlist, telemetry disabled. No environment-file reads/copies/edits, installs, manifest changes, dev server or connected commands. Next-generated files stayed in the copy.

| Executed command | Final result |
| --- | --- |
| `node --experimental-strip-types --test tests/interviews-ui.test.mjs tests/interviews.test.mjs` | **36 passed, 0 failed/skipped**, exit 0; 19 UI + 17 server, including parents |
| `npm test` | **168 passed, 0 failed/skipped**, exit 0 |
| `npm run lint` | Passed, exit 0 |
| `npm run typecheck` | Next route type generation and `tsc --noEmit --incremental false` passed, exit 0 |
| `npm run build` | Default Next.js **16.3.5 Turbopack**, compilation and TypeScript passed; **21/21** static-generation work items, exit 0; both interview routes dynamic |

Exact-once reachability passed for latest-page creation with 18/20/21/41 retained rows and older-page creation with 21/40/41. Deferred requests preserve the old page until canonical rows/cursor/mode move together; duplicate submits and overlapping history requests are excluded. Returned/thrown refresh failures retain the old page/boundary and keyboard-openable **Open new interview**, with truthful confirmed-save versus refresh-failure status. Returned/thrown lost creation acknowledgements stay uncertain until explicit reload, without automatic replay or a false unsaved claim. Original pending/retry/transport recovery/finish/delete regressions and negative owner/role/auth/eligibility, local grants, export/cascade and privacy-client tests passed.

A temporary, external in-memory extension of the unchanged UI harness added independent Tab/Enter/Space, status focus, explicit recovery and link-opening assertions at **1440×900 and 320×844**: **20 passed, 0 failed/skipped** including the retained UI tests and parent. Initial supplemental launch failed before mounting because the temporary runner passed a Windows path to `--import`; converting only that runner argument to a `file://` URL fixed the invocation. No application or repository-test repair was needed. Focused, full-suite and supplemental interview runs each recorded **0 network attempts / 0 page errors**.

**Fresh visual inspection:** all **12** `independent-*.png` images were opened and inspected in `C:\Users\SOLUSER\AppData\Local\Temp\forge-task25-qa-zWczdA`: create success, pending history refresh, returned/thrown refresh failure and returned/thrown uncertain creation, each at desktop/320px. Notices, page labels, new-interview links and focus outlines wrap without overlapping controls; overflow assertions passed. The directory retains **40 synthetic images** total; the other 28 were captured, not newly claimed as visually inspected. Original four-size keyboard/overflow assertions also reran. The earlier **24-image** independent review at `forge-task25-qa-Lvz9Jt` remains preserved historical evidence, not a fresh inspection claim.

Only README/tracker QA evidence was appended in the repository. A SHA-256 snapshot of **102 source/config/test/schema/script files** was unchanged across both isolated executions; no Git diff claim. Both owned temporary copies and two QA scripts were removed with absence verified; duplicate current-run interview/auth capture directories were removed, retained evidence and prior work preserved. Browser contexts and in-memory databases closed through harness cleanup; no remote fixtures or cleanup failures.

**Untested/open, not passes:** the new migration is unapplied; connected grants/RPC/PostgREST, real multi-session concurrency, authenticated routing/action transport/live rights, owner export/account cascade, live eligible free-provider behavior, provider/backup/log retention and deployment/privacy acceptance. No setup/AI probes, E2E/instructor suites, Supabase/mail calls, migration applies, commits or deployment ran. Task24 coding runtime and broader Group A requirements remain open, not implemented by this repair or QA.