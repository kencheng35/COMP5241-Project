# Implementation Tracker

Last reviewed: 2026-09-24

This is the working backlog for the original implementation plan. IDs remain stable even when related work is grouped. The baseline below reflects inspected code and completed local tests, not production certification.

## How to maintain this tracker

- Mark a task `[x]` only when its acceptance checks pass; record the evidence in the update log.
- Keep unfinished implementation separate from external verification and policy approval.
- Update the status, last-reviewed date and blockers when work changes.
- For an item requiring a decision, record the approved scope before implementation.
- Never include credentials, verification links, learner records or private provider responses here.

Statuses: **Open** (implementation remains), **Verification** (external checks remain), **Blocked** (needs a decision or dependency), **Paused** (explicitly stopped), **Deferred** (future scope), **Complete** (agreed scope verified).

## Agreed scope

- Authenticated registered users only, including for published lessons; explicit self-enrollment.
- Learners create private lessons. Only administrators publish shared lessons.
- Private drafts stay hidden from administrators until explicitly submitted for review.
- Ten four-option quiz questions; pass at 6/10; unlimited retries.
- Attendance means reaching the final quiz, not submitting or passing it.
- Every passing attempt receives its own private/public certificate snapshot.
- Authorized reviewers see published-lesson participation and quiz results, not private attempts or coach chats.
- No persisted coach history. Learning records are retained until account deletion, subject to separately managed backups and operational logs.
- AI integration is paused. Free-only models and existing privacy filters must remain unchanged without approval.
- Personalization and additional activity types are deferred. Learner assignment, roster imports and cohort notifications are outside the agreed implementation.

## Overview

| ID | Priority | Status | Next gate / verified scope |
| --- | --- | --- | --- |
| 01 | P0 | Open | Unavailable screen and config checks implemented; test real expiry, partial config and staging origin |
| 02 | P0 | Open | Form recovery/resend/provider notices implemented; session/failure checks, controlled inbox and PKCE remain |
| 03 | P1 | Open | Field feedback and retained edits implemented; deploy profile limits, inject failures; age rules depend on 04 |
| 04 | P0 before minors | Blocked | Approved age/consent policy and enforcement |
| 05 | P0 | Open | Export retry and checked pagination implemented; endpoint-scale/failure tests and retention review remain |
| 06 | P1 | Open | Dashboard/catalog links reach player; verify saved-position restore after 09 migration |
| 07 | P1 | Complete | Search shortcut, combined filters and keyboard checks passed |
| 08 | P0 | Blocked | Curriculum approval; decision on multi-lesson course scope |
| 09 | P0 | Open | Versioned resume code and isolated tests pass; apply migration and verify live owner-scoped writes/conflicts |
| 10 | P1 | Complete | Bookmark scope implemented and tested |
| 11 | P1 | Open | Unfinished-answer state implemented; verify reload, retry and version changes after 09 migration |
| 12 | P1 | Complete | Agreed statistics/history/HTML certificates; expansions deferred |
| 13 | P2 | Verification | Avatar preview/save tested; email-change confirmation needs controlled inboxes |
| 14 | P1 | Complete | Dirty-edit protection and preview passed focused Chromium/Firefox/WebKit checks |
| 15 | P1 | Paused | Coaching integration and quality verification |
| 16 | P1 | Paused | Generation integration and quality verification |
| 17 | P1 original plan | Deferred | Outside agreed scope: imports, cohorts, assignment, notifications |
| 18 | P1 original plan | Deferred | Personalized paths and adaptation |
| 19 | P2 expansion | Deferred | Additional activity/media/import types |
| 20 | P1 | Open | Focus, navigation and landscape checks partially pass; full accessibility/failure-state audit remains |
| 21 | P0 | Verification | Hosted CI, clean setup, staging and deployment rehearsal |

Current next steps while AI is paused:

1. On a development/staging database, apply `20260927_resume.sql`, then `20260928_profile_limits.sql` in the documented order. Review existing profile rows before validating the non-validating constraints. Run setup diagnostics and the full authenticated browser suite; do not treat isolated migration tests as live resume verification.
2. Verify 09, then 06/11 and the new-record portion of 05: cross-device position and answers, retries/version changes, conflicts, owner isolation, export and deletion. Keep their statuses Open until those checks pass.
3. Finish local failure/expiry/access checks in 01/02/03/05 and the broader accessibility audit in 20. Then complete the staging/deployment checks under 21.
4. Use a controlled inbox for mail/PKCE in 02 and email changes in 13. Obtain the age/consent decision for 04 before minors are eligible and the curriculum/course decision for 08 before building course containers. Leave 15/16 paused and 17-19 deferred unless their scope is explicitly changed.

## Active implementation

### 01 - Configuration and protected access

Implemented: protected routes fail closed; misconfiguration returns a retryable HTML 503 for protected pages and JSON 503 for APIs. Required public settings and site-origin format are validated before server-client creation and email callbacks. Unit tests cover malformed configuration and encoded redirect attempts; focused browser checks reject anonymous page/API access and a synthetic stale cookie.

- [x] Replace the plain configuration-error response with a usable unavailable screen; retain appropriate API errors.
- [ ] Validate required configuration and the canonical deployment origin without exposing secrets (format and presence validated; deployment origin still needs a staging check).
- [ ] Complete missing/partial configuration checks across page and API routes, real expired-session checks and remaining redirect encodings; anonymous access and synthetic stale-cookie checks already pass.

Acceptance: configuration failures are explicit and recoverable; no protected operation runs without valid configuration and authentication; redirects cannot escape the application origin.

### 02 - Authentication experience and failure handling

Implemented: signup/login/recovery forms retain nonsecret values and focus validation errors; provider failures show generic notices, and resend retains retry context. Token-hash confirmation/recovery, single-use links, invalid-code rejection, safe callbacks and protective redirect headers passed the earlier authenticated browser suite. The signup loading-fallback investigation is paused after two sessions; the focused suite does not establish reliable automated signup-form coverage.

- [x] Preserve nonsecret form inputs after validation/provider errors and show field-level feedback (signup/login and recovery email; reset contains only a password, which is cleared).
- [x] Preserve resend context and keep retry available after resend success or failure.
- [x] Consistently handle thrown auth-provider failures without leaking internal details.
- [ ] Define and test password-reset and logout session behavior, including logout failures.
- [ ] Test tampered query parameters and recovery under slow/offline requests.
- [ ] Verify signup, resend and recovery email delivery using a controlled inbox.
- [ ] Verify successful PKCE code exchange; invalid-code rejection is already tested.
- [ ] Review Supabase rate limits and abuse controls for deployment.
- [ ] Paused after two sessions: investigate intermittent signup loading fallback in headless browsers when work resumes; page HTML can contain the form while its streamed reveal remains pending.

Blocker: actual mail delivery requires SMTP configuration and a controlled inbox. Generated token links do not establish mail delivery or PKCE success.

### 03 - Profile editing

Implemented: field feedback, client/server limits, retention of nonsecret failed edits, avatar preview and successful profile persistence. Focused browser checks cover invalid-field focus; a new `NOT VALID` profile-limit migration and isolated invalid-write tests exist, but the migration is not deployed to the connected database.

- [x] Add field-level feedback and matching client-side limits.
- [x] Preserve nonsecret edits when saving fails (selected files must be reselected).
- [ ] Align profile database constraints with accepted values and limits where needed (migration and isolated invalid-write tests pass; connected deployment and legacy-row review pending).
- [ ] Test expired sessions, missing configuration and database failures without false success notices.
- [ ] Enforce the age-change rules approved under 04.

Acceptance: invalid/failed saves never appear successful or discard unrelated edits; displayed identity matches persisted values.

### 05 - Data export and account deletion

Implemented: owner-scoped checked-pagination exports, a pending/failure/retry download control, password-confirmed deletion and distinct deletion/sign-out failure guidance. Partial-page failures are covered at the pagination-helper level, and the browser suite passed a simulated download failure followed by a real retry before the resume migration was added.

- [x] Add export pending, download-failure and retry feedback.
- [ ] Inject a later-page query failure through the real endpoint; helper-level missing/error second-page tests already reject incomplete results.
- [ ] Test large exports through the real endpoint, beyond the pagination helper tests.
- [ ] Inject deletion-provider and cookie/session-cleanup failures through the real workflow; generic recovery guidance is implemented but unverified under these failures.
- [ ] Confirm backup and operational-log retention and document the limits of immediate erasure.
- [ ] Verify resume records in the real export and account-deletion endpoint after migration 20260927; keep future consent/storage models in scope when approved.

Acceptance: exports are complete and private; deletion failures are actionable; other learners' certificate snapshots survive author deletion while the deleted learner's own records are removed.

### 07 - Catalog interaction

Implemented: search, subject/visibility filters, no-results state and explicit enrollment with stable lesson IDs.

- [x] Add the planned search keyboard shortcut with accessible focus behavior.
- [x] Add explicit combined-filter, clear-filter, empty-result and keyboard regression coverage.

Acceptance: filters combine correctly, keyboard users can find and enroll in lessons, and repeated enrollment remains idempotent.

### 09 - Durable in-lesson progress

Implemented locally: version-aware private resume storage, authenticated reads and optimistic revision writes for slide, stage, ordering and unfinished answers. Isolated migration, policy, concurrency and cascade tests pass. The connected database lacks `forge_resume`; lessons still work but cannot save a resume there. The live setup check reports this missing table.

- [x] Define a version-aware progress record for slide position, stage, activity state and unfinished answers.
- [ ] Add authenticated, owner-scoped progress reads/writes and required migration/policies (code and isolated migration pass; connected database pending).
- [ ] Define duplicate-write and concurrent-device conflict behavior (revision checks and retryable transient saves implemented; live concurrency/retry verification pending).
- [ ] Restore progress after reload or login on another device.
- [ ] Include new records in exports and deletion cleanup (code and isolated cascade pass; live endpoint verification pending).
- [ ] Test cross-device persistence, duplicate/concurrent writes, unauthorized access and version changes.

Acceptance: authenticated learners restore their own version-compatible position on another device; stale writes cannot silently overwrite newer progress, and answer keys stay private. Existing attendance, grading and certificate rules remain unchanged.

### 06 - Contextual resume links

Implemented: enrolled dashboard and catalog actions open the lesson player; unenrolled catalog actions open the overview. Focused authenticated browser checks pass for those links.

- [ ] Verify that dashboard/catalog Continue restores the saved position after reload or login on another device (depends on 09 migration and live persistence).
- [ ] Verify fallback to an appropriate position when lesson content changes (depends on 09).

Acceptance: Continue reaches the owner's saved position when compatible and a safe starting position when not; it never bypasses enrollment.

### 11 - Unfinished quiz continuation

Implemented locally: unfinished quiz selections are part of the versioned private resume state; submitted attempts and certificate eligibility remain separate records.

- [ ] Verify unfinished answers restore across reload and devices without exposing correct answers (depends on 09 migration).
- [ ] Define and verify quiz restart/retry behavior, including lesson version changes and stale attempts.

Acceptance: unfinished choices restore only for the appropriate learner and lesson version; retries remain unlimited and attendance is not treated as passing.

### 13 - Avatar preview and email changes

Implemented and locally tested: JPG/PNG validation, size and decode limits, 160px JPEG conversion, private profile storage, preview, cancel and removal. The email-change action requests verification; it does not claim the address changed before confirmation. Remaining work is external verification, so this item is in Verification rather than Open.

- [x] Preview the selected image before saving; reset preview correctly on remove/cancel.
- [ ] Verify secure email-change confirmation, expired/reused links and session behavior using controlled inboxes.

Acceptance: invalid images cannot replace saved data and an email change is not shown as complete before required verification.

### 14 - Authoring completion

Implemented: private ownership, structured editing, review submission, admin-only publication, validation and optimistic version checks.

- [x] Track dirty editor state and warn before losing unsaved edits (link/unload and browser Back guards verified in Chromium, Firefox and WebKit for the editor entry flow).
- [x] Add a dedicated local learner-facing preview before saving or publishing (no answer keys).
- [x] Test saved/dirty transitions, cancelled navigation, failed saves, concurrent edits and published-content preview (focused authoring suite covers these in Chromium, Firefox and WebKit).

Acceptance: authors can inspect learner-facing content and cannot accidentally lose edits without warning; previews preserve draft isolation and publication permissions.

### 20 - Accessibility and interaction resilience

Implemented and tested locally: catalog search keyboard focus, mobile navigation Escape and focus restoration, active primary links, editor/preview and lesson/coach reachability at 844x390, and auth/profile/lesson/quiz focus changes. This is not a completed accessibility audit.

- [ ] Audit keyboard navigation and screen-reader announcements across the main workflows.
- [ ] Add navigation Escape handling, appropriate focus management/restoration and active-link semantics (mobile sidebar focus/restore and primary links done; other navigation still needs audit).
- [ ] Check mobile landscape, long labels/content and coach panel sizing (editor, preview, lesson width and inline coach-input reachability pass at 844x390; long labels/content still need checks; legacy fixed coach-panel CSS is unused).
- [ ] Standardize action-specific pending, empty, offline, timeout, failure and retry states.
- [ ] Verify focus after validation errors, quiz results and view changes (auth/profile field errors, provider alerts, lesson stage/slide changes, quiz results and retry pass in the focused browser suite; remaining workflows need audit).

Acceptance: workflows remain usable without a mouse and under slow/failing requests; controls and content do not overlap or become unreachable.

## Policy, content and operational gates

### 04 - Minors and consent

Current state: under-13 guardian agreement is self-attested, not independently verified.

- [ ] Obtain institutional/legal approval for age eligibility, consent and retention requirements.
- [ ] Publish approved policy links and consent copy.
- [ ] Select a parental-verification integration only if the approved policy requires one.
- [ ] Implement server-enforced signup/profile age rules and appropriate versioned consent records.
- [ ] Implement withdrawal and associated retention/deletion handling.
- [ ] Test underage signup, profile age changes, bypass attempts and consent withdrawal.

Release gate: do not treat the existing checkbox as sufficient approval to deploy to minors.

### 08 - Curriculum and course structure

Current state: published/owner-visible standalone lessons work with stable IDs and missing-page handling. A lesson contains ordered slides, an activity and a quiz.

- [ ] Approve the curriculum and publish reviewed learning content.
- [ ] Decide whether standalone lessons satisfy the product scope or multi-lesson courses are still required.
- [ ] If retained, implement course containers, ordered lesson relationships, course metadata and cross-lesson navigation.
- [ ] If retained, define course completion and test lesson ordering, invalid slugs, unpublished content and metadata consistency.

Decision record: pending. Do not treat multi-lesson course infrastructure as already implemented or automatically approved.

### 21 - Delivery and operational readiness

- [x] Add migrations and isolated database integrity/policy tests.
- [x] Add setup diagnostics that avoid printing secrets or learner records.
- [x] Add a secret-free GitHub Actions workflow for tests, lint, type checking and build.
- [x] Run the check sequence locally and pass the authenticated browser regression suite.
- [ ] Run and verify the hosted GitHub Actions workflow.
- [ ] Rehearse clean installation and the documented migration sequence on a fresh staging database.
- [ ] Rehearse an upgrade with representative existing records and confirm schema compatibility.
- [ ] Verify deployment origins, SMTP, secrets, access-log query redaction and retention settings.
- [ ] Run deployed smoke tests with separate learner, reviewer and administrator accounts.

Acceptance: staging/deployment setup is reproducible and does not depend on undocumented local state. Hosted CI success is recorded separately from local results.

## Paused and deferred work

### 15 / 16 - AI coaching and generation: paused

Current state: bounded server-side coaching, generation schema validation, rate limits and private draft persistence code exist. Successful live generation/coaching remains unverified.

- [ ] Obtain explicit approval to resume AI work.
- [ ] Verify a working free provider under the existing privacy policy; do not enable paid fallback or relax privacy without approval.
- [ ] Verify full generation, saved drafts, coaching quality and context isolation.
- [ ] Test malformed output, unsafe inputs, provider failures/timeouts and quota behavior.
- [ ] Complete provider age/region eligibility and data-processing review.
- [ ] Confirm whether streaming/cancel, explicit regenerate controls and durable generation jobs remain required; implement and test approved scope.

Persisted coach history is not approved and is not a pending implementation task.

### 18 - Personalization: deferred

- [ ] Approve learner signals, adaptation rules, explanations and user overrides.
- [ ] Implement private versioned paths and recommendation decisions after the required content/AI dependencies are ready.
- [ ] Evaluate cold starts, differing backgrounds/goals, overrides and inappropriate topics.

### 19 - Additional activity types: deferred expansion

- [ ] Select activity types, teaching-input formats and integrations before estimating implementation.
- [ ] Define typed schemas, asset licensing, accessibility and submission/progress behavior.
- [ ] Add hostile-input/resource-limit tests and isolate code execution if it becomes part of approved scope.

### 17 - Imports, cohorts and notifications: outside agreed scope

No implementation is scheduled. Roster imports, assignment, cohorts and notifications require a new scope decision. Existing per-lesson reviewer reports are implemented and do not constitute cohort management.

### 12 - Optional reporting/certificate expansion

The agreed result history, statistics and private/public printable HTML certificates are implemented. Durations, timezone streaks, additional award types and signed/PDF credentials are deferred and require approved definitions and eligibility rules before implementation.

## Completed baseline

- [x] 10: persistent owner-scoped bookmarks and saved-lessons view.
- [x] 12: attempt history, real result summaries and authorized private/public HTML certificate downloads.
- [x] Manual lesson creation, consecutive saves, private isolation, review/publication and reviewer grant/revocation.
- [x] Enrollment, attendance-before-submission, fail/pass/retry grading, stale-version rejection and snapshot preservation.
- [x] Profile/avatar persistence and validation, owner-scoped export, password-confirmed deletion and cross-learner certificate retention.
- [x] Token-hash signup/recovery, single-use links, safe redirects, invalid PKCE rejection and callback protective headers.

## Verification evidence and update log

| Date | Scope | Evidence / change | Remaining limitation |
| --- | --- | --- | --- |
| 2026-09-23 | Local gates | `npm test` passed 5 tests; lint, type checking and production build passed. | Not a hosted CI run or clean-install rehearsal. |
| 2026-09-23 | Browser regression | `npm run test:e2e` passed the authenticated manual-learning, account and token-based auth workflows; temporary accounts cleaned up. | No actual email sends, successful PKCE exchange, or AI inference. |
| 2026-09-23 | Tracking baseline | Created this tracker from the original plan, inspected code and verified results; AI remains paused. | Open checkboxes are not completion claims. |
| 2026-09-24 | 01 configuration (partial) | Added guarded 503 screen/JSON responses, shared public config validation, setup checks and encoded redirect tests; `npm test` passed 7 tests, typecheck, lint, setup diagnostics and production build passed; isolated malformed-config HTTP checks returned 503 for page/API. | Staging origin, expired sessions and full anonymous/access edge cases remain unverified. |
| 2026-09-24 | 02 auth (partial) | Signup/login action-state validation and safe field retention; manual invalid-signup browser check retained name/email/age/consent and cleared password. Resend context and generic thrown-provider handling added; `npm test` (7), typecheck, lint, build and authenticated production-mode browser suite passed with fixture cleanup. | New signup E2E check blocked by intermittent streamed-page loading; recovery field retention, mail delivery, successful PKCE and provider failure injection remain open. |
| 2026-09-24 | 02/03/05/07/13/20 UI | Recovery email and profile fields now retain edits after failures; export supports failure/retry; catalog keyboard and combined-filter coverage, mobile navigation Escape/active semantics, and avatar preview/cancel added. Authenticated browser suite passed with temporary-account cleanup. | Signup loading investigation paused after two sessions; mail and email-change confirmation require controlled inboxes. Profile database constraints and other accessibility flows remain open. |
| 2026-09-24 | 09/06/11 local implementation | Versioned owner-scoped resume migration, serialized revision writes, quiz/slide restore and export inclusion; isolated migration/concurrency/cascade and resume schema tests passed (`npm test`: 9). | Apply resume migration to connected development database before live cross-device, stale-version and export verification. |
| 2026-09-24 | 05/14/20 follow-up | Deletion-provider failures no longer expose internal errors; failed post-deletion sign-out has separate guidance. Editor dirty warnings and local preview, mobile menu focus/restore, and authoring-only browser suite passed with fixture cleanup. | Live failure injection and full authoring navigation audit remain open. |
| 2026-09-24 | 03 profile limits (local) | Added non-validating database constraints on name, level, subjects and goals; isolated invalid-write tests pass. Signup now checks the same name maximum. | Apply migration to connected database, inspect legacy profiles, then validate constraints and rerun profile workflow. |
| 2026-09-24 | 01 access follow-up | Focused authoring browser run passed anonymous page/API rejection and a synthetic stale-cookie check, along with catalog and editor checks; temporary accounts cleaned up. | Real expired-session and staging origin checks remain open. |
| 2026-09-24 | 14 navigation follow-up | Focused browser run passed cancelled/accepted client-side Back, cancelled full-page Back, and stale-version failed-save retention using temporary lessons; fixture cleanup passed. | Browser-history interception uses the Navigation API where available; verify other browsers and published-content preview. |
| 2026-09-24 | 09/14/20 follow-up | Added retryable transient progress saves (typecheck/lint), verified preview/draft isolation before and after publication, and 844x390 editor/preview layout in the focused authenticated browser suite with fixture cleanup. | Live resume retry needs the connected migration; cross-browser history and lesson landscape/content audits remain. |
| 2026-09-24 | 14 editor entry | Lesson overview, admin review and manual editor entry use full-page links for native unload protection where the Navigation API is unavailable. Focused authoring browser checks wait for editor hydration before typing and passed with temporary-account cleanup. | Verify history behavior in Firefox/WebKit; do not claim cross-browser completion yet. |
| 2026-09-24 | 14 cross-browser | Focused authoring browser suite passed in Chromium, Firefox and WebKit with temporary-account cleanup; covers failed-save retention, history cancel/accept, draft isolation and published preview. Editor hydration readiness checks prevent early form input from being reset. | Other authoring flows outside focused suite and deployed browsers still need routine regression checks. |
| 2026-09-24 | 06 resume navigation | Enrolled dashboard and catalog links now open the lesson player; unenrolled catalog links retain the overview. Focused authenticated browser checks passed with temporary-account cleanup. | Live restoration of saved progress awaits the resume migration on the connected database. |
| 2026-09-24 | 20 lesson focus | Player now focuses the new slide/section heading, saved quiz-result heading, and quiz heading on retry. Focused authenticated browser checks passed with temporary-account cleanup. | Form validation focus and remaining lesson/landscape accessibility checks remain open. |
| 2026-09-24 | 20 form focus | Auth actions now focus the first invalid field or provider-error alert; profile validation focuses its invalid field or general save notice. Focused authenticated browser checks passed without persisting invalid profile edits. | Remaining form/view workflows and screen-reader audit remain open. |
| 2026-09-24 | 20 landscape | Focused authenticated browser run found no lesson horizontal overflow at 844x390 and confirmed the inline coach question input remains reachable by scrolling; no AI calls made. | Long labels/content and wider viewport audits remain open. |
| 2026-09-24 | Items 01-20 plan reconciliation | Rechecked the tracker against recorded local test evidence and owning code paths. Refreshed stale overview descriptions; split 09/06/11 into distinct acceptance gates; moved 13 to Verification because avatar work passes and only controlled-inbox email-change checks remain. Items 07/10/12/14 stay Complete, 04/08 Blocked, 15/16 Paused, and 17-19 Deferred. | No new production certification, migration application, hosted CI, SMTP delivery or policy approval is claimed by this documentation review. |

Related files: [README](README.md), [CI workflow](.github/workflows/checks.yml), [browser tests](tests/e2e.mjs), [setup diagnostics](scripts/check-setup.mjs).