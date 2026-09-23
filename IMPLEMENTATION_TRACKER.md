# Implementation Tracker

Last reviewed: 2026-09-23

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

| ID | Priority | Status | Remaining focus |
| --- | --- | --- | --- |
| 01 | P0 | Open | Setup-unavailable screen, configuration validation, access edge cases |
| 02 | P0 | Open | Auth form recovery, provider failures, session semantics, mail verification |
| 03 | P1 | Open | Profile feedback, retained edits, failure tests |
| 04 | P0 before minors | Blocked | Approved age/consent policy and enforcement |
| 05 | P0 | Open | Export feedback, failure injection, retention decisions |
| 06 | P1 | Open | Contextual resume; depends on 09 |
| 07 | P1 | Open | Search shortcut and filter/keyboard coverage |
| 08 | P0 | Blocked | Curriculum approval; decision on multi-lesson course scope |
| 09 | P0 | Open | Durable in-lesson progress and unfinished-answer resume |
| 10 | P1 | Complete | Bookmark scope implemented and tested |
| 11 | P1 | Open | Quiz resumption; depends on 09 |
| 12 | P1 | Complete | Agreed statistics/history/HTML certificates; expansions deferred |
| 13 | P2 | Open | Avatar preview and verified email-change testing |
| 14 | P1 | Open | Unsaved-edit protection and preview |
| 15 | P1 | Paused | Coaching integration and quality verification |
| 16 | P1 | Paused | Generation integration and quality verification |
| 17 | P1 original plan | Deferred | Outside agreed scope: imports, cohorts, assignment, notifications |
| 18 | P1 original plan | Deferred | Personalized paths and adaptation |
| 19 | P2 expansion | Deferred | Additional activity/media/import types |
| 20 | P1 | Open | Accessibility and recoverable interaction states |
| 21 | P0 | Verification | Hosted CI, clean setup, staging and deployment rehearsal |

Recommended implementation order while AI is paused: **01 -> 02/03/05 -> 09/06/11 -> 14/20 -> 21**. Address 07 and 13 alongside related UI work. Resolve 04 before allowing minors into a deployment.

## Active implementation

### 01 - Configuration and protected access

Implemented: protected routes fail closed, APIs reject anonymous access, and verification destinations are checked for same-origin safety.

- [ ] Replace the plain configuration-error response with a usable unavailable screen; retain appropriate API errors.
- [ ] Validate required configuration and the canonical deployment origin without exposing secrets.
- [ ] Test missing and partial configuration, expired sessions, anonymous page/API access and additional encoded redirect cases.

Acceptance: configuration failures are explicit and recoverable; no protected operation runs without valid configuration and authentication; redirects cannot escape the application origin.

### 02 - Authentication experience and failure handling

Implemented: fixed form modes, scalar notice props, pending buttons, token-based confirmation/recovery, callback validation and no-store/no-referrer callback redirects.

- [ ] Preserve nonsecret form inputs after validation/provider errors and show field-level feedback.
- [ ] Preserve resend context and keep retry available after resend success or failure.
- [ ] Consistently handle thrown auth-provider failures without leaking internal details.
- [ ] Define and test password-reset and logout session behavior, including logout failures.
- [ ] Test tampered query parameters and recovery under slow/offline requests.
- [ ] Verify signup, resend and recovery email delivery using a controlled inbox.
- [ ] Verify successful PKCE code exchange; invalid-code rejection is already tested.
- [ ] Review Supabase rate limits and abuse controls for deployment.

Blocker: actual mail delivery requires SMTP configuration and a controlled inbox. Generated token links do not establish mail delivery or PKCE success.

### 03 - Profile editing

Implemented: server-side enum/length validation, successful persistence, identity refresh, and pending submission controls.

- [ ] Add field-level feedback and matching client-side limits.
- [ ] Preserve nonsecret edits when saving fails.
- [ ] Align profile database constraints with accepted values and limits where needed.
- [ ] Test expired sessions, missing configuration and database failures without false success notices.
- [ ] Enforce the age-change rules approved under 04.

Acceptance: invalid/failed saves never appear successful or discard unrelated edits; displayed identity matches persisted values.

### 05 - Data export and account deletion

Implemented: owner-scoped paginated exports, checked query results, password-confirmed deletion, session invalidation and tested cascade/snapshot behavior.

- [ ] Add export pending, download-failure and retry feedback.
- [ ] Inject partial query failures and verify that incomplete exports are never reported as complete.
- [ ] Test large exports through the real endpoint, beyond the pagination helper tests.
- [ ] Test deletion-provider and cookie/session-cleanup failures with clear recovery guidance.
- [ ] Confirm backup and operational-log retention and document the limits of immediate erasure.
- [ ] Extend export/deletion coverage whenever progress, consent, storage or other models are added.

Acceptance: exports are complete and private; deletion failures are actionable; other learners' certificate snapshots survive author deletion while the deleted learner's own records are removed.

### 07 - Catalog interaction

Implemented: search, subject/visibility filters, no-results state and explicit enrollment with stable lesson IDs.

- [ ] Add the planned search keyboard shortcut with accessible focus behavior.
- [ ] Add explicit combined-filter, clear-filter, empty-result and keyboard regression coverage.

Acceptance: filters combine correctly, keyboard users can find and enroll in lessons, and repeated enrollment remains idempotent.

### 09 / 06 / 11 - Durable progress and resume

Implemented: persisted enrollment, attendance, quiz attempts, trusted grading and dashboard summaries. Current slide, ordering activity and unfinished quiz answers are client state only.

- [ ] Define a version-aware progress record for slide position, stage, activity state and unfinished answers.
- [ ] Add authenticated, owner-scoped progress reads/writes and required migration/policies.
- [ ] Define duplicate-write and concurrent-device conflict behavior.
- [ ] Restore progress after reload or login on another device.
- [ ] Route dashboard/catalog resume actions to the saved position.
- [ ] Define behavior when lesson content changes and when a learner restarts or retries.
- [ ] Include new records in exports and deletion cleanup.
- [ ] Test cross-device persistence, duplicate/concurrent writes, unauthorized access and version changes.

Acceptance: resume restores an appropriate saved state without exposing answer keys, overwriting newer progress silently, or treating attendance as a passed quiz. Existing grading and certificate rules remain unchanged.

### 13 - Avatar preview and email changes

Implemented: JPG/PNG validation, size and decode limits, 160px JPEG conversion, private profile storage, removal and an email-change request action.

- [ ] Preview the selected image before saving; reset preview correctly on remove/cancel.
- [ ] Verify secure email-change confirmation, expired/reused links and session behavior using controlled inboxes.

Acceptance: invalid images cannot replace saved data and an email change is not shown as complete before required verification.

### 14 - Authoring completion

Implemented: private ownership, structured editing, review submission, admin-only publication, validation and optimistic version checks.

- [ ] Track dirty editor state and warn before losing unsaved edits.
- [ ] Add a dedicated preview before saving or publishing.
- [ ] Test saved/dirty transitions, cancelled navigation, failed saves, concurrent edits and published-content preview.

Acceptance: authors can inspect learner-facing content and cannot accidentally lose edits without warning; previews preserve draft isolation and publication permissions.

### 20 - Accessibility and interaction resilience

- [ ] Audit keyboard navigation and screen-reader announcements across the main workflows.
- [ ] Add navigation Escape handling, appropriate focus management/restoration and active-link semantics.
- [ ] Check mobile landscape, long labels/content and coach panel sizing.
- [ ] Standardize action-specific pending, empty, offline, timeout, failure and retry states.
- [ ] Verify focus after validation errors, quiz results and view changes.

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

Related files: [README](README.md), [CI workflow](.github/workflows/checks.yml), [browser tests](tests/e2e.mjs), [setup diagnostics](scripts/check-setup.mjs).