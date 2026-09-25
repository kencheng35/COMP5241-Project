# Implementation Tracker

Last reviewed: 2026-09-25

## Current approved scope - 25 September 2026

This decision governs the current scope, overview and task details below; conflicting decisions in the historical evidence log are superseded. Deadline: 31 October 2026. The owner approved AI-native implementation and disposable-development checks and will perform final review/submission. No production changes or deployment are authorized. Coordinator owns the plan and assigned bounded work to Forge Architect, Forge Implementer and Forge QA this turn; completed dispatches and evidence are recorded below. This final documentation assignment edits only this tracker and does not change project authority.

| Work | Owner | Current deliverable / acceptance | Evidence / remaining dependency |
| --- | --- | --- | --- |
| Instructor role and account maintenance | Forge Implementer + Forge QA | Admin grants/revokes instructor role; own-lesson publication/editing/reporting; private drafts stay isolated | Recorded implementation and 18-stage instructor regression, including forged direct actions and next-request revocation; not rerun here |
| Learner import | Forge Implementer + Forge QA | Email-filtered selection of existing verified learner accounts, up to 50/action; repeated import preserves progress | Recorded implementation and live tests; no roster files, account creation, invitation mail, cohorts or notifications |
| Standalone SDLC lessons | Coordinator+Owner | Private unless published by owning instructor or admin; learner self-enrollment remains | Standalone scope decision complete; multi-lesson containers not required; owner's curriculum review remains |
| Material-to-editable-draft import | Forge Implementer + Forge QA | PDF/PPTX/PPT to editable slides/activity/quiz; original files not retained | Recorded 14 local extraction/guard tests for PDF/PPTX; legacy binary PPT blocked; end-to-end generation awaits provider + age migration |
| Free-only AI generation/coaching | Forge Architect + Forge QA | Ordered free-model fallback, unchanged privacy, bounded errors, SDLC prompts/schema | Recorded 12 local tests; synthetic text 429 / structured 404. No live success proven; no paid model or privacy relaxation |
| Optional personalization | Forge Implementer + Forge QA | Optional preferences, explainable local SDLC recommendations and explicit AI paths using background/goals/progress; no forced enrollment | Recorded 16 local tests and page/layout checks; AI action gated, generated paths session-only, live AI blocked |
| Age and AI eligibility | Forge Architect + Coordinator+Owner | Supervised HK demo, ages 13+; minors/unknown ages denied external AI pending approved consent policy; recorded adults also need admin grant | Recorded 8 isolated tests; numeric-age migration pending. Self-reported age and grants do not establish legal consent; no minor AI enablement approved |
| Setup and data protection | Forge Architect + Forge QA | Migrations, application grants, encrypted hosting transport/storage review, safe diagnostics | Fresh Forge QA read-only setup: profiles.age absent (42703); other checked profile columns and all 7 forge tables, including resume, available. All checked SQL/management environment-presence flags false; service-role grants unverified. Encryption-at-rest, backup/log retention and restricted deployment unverified |
| Submission and deployment | Coordinator+Owner | Required report/video/manuals/slides/contribution and stakeholder evidence | Owner retains submission responsibility; artifacts incomplete; staging/production approval still required |

Current next assignments follow the ordered remaining-work plan below: Coordinator+Owner and Forge Architect resolve schema/age/grant readiness, then Forge QA runs the full authorized profile/resume/export scope with the locally ready harness. Forge Architect AI/PPT feasibility and Forge Implementer local account failure/accessibility work can proceed in parallel without waiting for every migration. No website-complete claim is permitted while these and the failure/accessibility/delivery gates remain open.

Recorded evidence from 25 September (previous work, not newly verified here): 60 local tests, lint, typecheck and production build passed. The instructor browser suite passed 18 stages plus widths 1440/390/320 and mobile menu focus/inert checks; all four temporary accounts were deleted. These are development results, not production certification or a fresh full profile/resume/export pass. Setup diagnostics failed on missing profile age; live provider probes failed as described above. No original testing data was intentionally removed in that recorded work.

Fresh evidence this turn: Forge QA ran read-only `npm run check:setup` and the baseline `npm test` (60 passed); last-known `profiles.age` absence was revalidated with code 42703, while other checked profile columns and all 7 forge tables including `forge_resume` were available. All checked SQL/management environment-presence flags were false. No AI calls/probes, remote writes, schema applies or new browser/Supabase fixtures occurred this turn.

Forge Implementer completed the numeric-age harness repair and immediate serialized LessonPlayer saves, with mounted real-Chromium component coverage in [tests/resume.test.mjs](tests/resume.test.mjs). Implementer reported `npm test`: 70 passed, `npm run typecheck` and scoped lint passed on local Node.js 25.2.1. Independent Forge QA found a stale transient-error alert on idle reversion and missing CI Chromium installation; both were repaired. Final independent focused QA passed 12 tests, confirmed alert count 0 for the regression and preserved conflict/in-flight behavior; YAML ordering checks passed. Independent QA did not rerun all 70 tests. Hosted Node.js 24 CI and the current full live E2E suite were not run; no fresh production build is claimed.

Evidence boundary: this final documentation assignment records the supplied completed dispatch/execution evidence, not a new application verification run. The dated historical log remains unchanged. IDs stay stable, and unfinished acceptance gates below remain binding.

## How to maintain this tracker

- Mark a task `[x]` only when its acceptance checks pass; record the evidence in the update log.
- Keep unfinished implementation separate from external verification and policy approval.
- Update the status, last-reviewed date and blockers when work changes.
- For an item requiring a decision, record the approved scope before implementation.
- Never include credentials, verification links, learner records or private provider responses here.

Statuses: **Open** (implementation or tests remain), **Verification** (review/external checks remain), **Blocked** (needs a decision or dependency), **Partial** (explicitly split completed and deferred scope), **Paused** (explicitly stopped), **Deferred** (future scope), **Complete** (agreed scope verified in recorded evidence). **Open/Blocked** identifies unfinished implementation with a blocking dependency; no status certifies production readiness.

## Current agreed scope

- Authenticated registered users only, including for published lessons; explicit self-enrollment.
- Supervised Hong Kong demonstration, ages 13+, targeting 31 October 2026; no production/deployment approval.
- Learners create private lessons. Administrators grant/revoke instructor roles; instructors publish/edit their own lessons and report only on their own published lessons. Administrators retain global public-lesson control.
- Private drafts stay hidden from administrators until explicitly submitted for review.
- Standalone SDLC lessons satisfy the approved structure; multi-lesson course containers are not required. Owner review of curriculum and content correctness remains mandatory.
- Ten four-option quiz questions; pass at 6/10; unlimited retries.
- Attendance means reaching the final quiz, not submitting or passing it.
- Every passing attempt receives its own private/public certificate snapshot.
- Authorized reviewers see published-lesson participation and quiz results, not private attempts or coach chats.
- No persisted coach history or retained original teaching uploads. Current learning-record retention is until account deletion; approved consent withdrawal, retention exceptions, backups and operational-log policy remain unresolved under 04/05/21.
- AI implementation is approved but live success is blocked. Free-only models and existing privacy filters remain mandatory. Minors and unknown ages are denied external AI pending approved consent/eligibility policy; recorded adults additionally need a trusted administrator grant. No minor AI enablement is approved by this decision.
- Optional learning preferences and explainable local SDLC recommendations are implemented; explicit AI-generated paths remain session-only and never force enrollment. Durable paths and wider adaptation are not approved.
- Instructor email-filtered enrollment of existing verified learners is implemented; roster-file imports, account creation/invitations, cohorts and notifications remain deferred.
- PDF/PPTX/PPT material-to-editable-draft import is required. PDF/PPTX extraction passed recorded local checks; legacy binary PPT remains unsupported and open. Additional activity/media types beyond this import scope remain deferred.

## Current overview

| ID | Priority | Status | Next gate / verified scope |
| --- | --- | --- | --- |
| 01 | P0 | Open | Unavailable screen and config checks implemented; test real expiry, partial config and staging origin |
| 02 | P0 | Open | Form recovery/resend/provider notices implemented; session/failure checks, controlled inbox and PKCE remain |
| 03 | P1 | Open/Blocked | Local numeric-age harness ready; fresh QA confirms profiles.age absent (42703); live persistence blocked by migrations/access, legacy review and failure tests pending |
| 04 | P0 before minors | Blocked | 13+ supervised HK policy chosen; local age/adult-grant controls recorded; live migration, legal/consent/retention gates pending |
| 05 | P0 | Open | Export retry and checked pagination implemented; endpoint-scale/failure tests and retention review remain |
| 06 | P1 | Open | Links reach player; resume table present in recorded empty read; verify restore after 09 grants/schema and persistence checks |
| 07 | P1 | Complete | Search shortcut, combined filters and keyboard checks passed |
| 08 | P0 | Verification | Standalone SDLC scope decision complete; owner curriculum/content review and publication remain |
| 09 | P0 | Open | Immediate serialized saving locally accepted after independent QA repair/regression; fresh read confirms resume table present, not grants; live persistence/conflict/export and native unload gates remain |
| 10 | P1 | Complete | Bookmark scope implemented and tested |
| 11 | P1 | Open | Unfinished-answer state implemented; verify reload/retry/version changes after 09 grants and live persistence checks |
| 12 | P1 | Complete | Agreed statistics/history/HTML certificates; expansions deferred |
| 13 | P2 | Verification | Avatar preview/save tested; email-change confirmation needs controlled inboxes |
| 14 | P1 | Complete | Recorded editor/preview checks and admin-granted instructor own-publication/edit/report regression; independent release QA remains |
| 15 | P1 | Blocked | Coaching approved; free privacy-compatible live endpoint, age/grant readiness and quality checks pending |
| 16 | P1 | Blocked | SDLC generation approved; endpoint, age/grants, saved-draft and import end-to-end checks pending |
| 17 | P1 | Partial | Email-selection imports complete in recorded tests; roster files, cohorts, invitations and notifications Deferred |
| 18 | P1 | Blocked | Optional local recommendations implemented/tested; session-only AI paths await live endpoint and eligibility verification |
| 19 | P1 required import | Open/Blocked | PDF/PPTX extraction verified locally; required legacy binary PPT unsupported; safe conversion and end-to-end AI checks pending |
| 20 | P1 | Open | Focus, navigation and landscape checks partially pass; full accessibility/failure-state audit remains |
| 21 | P0 | Verification | CI Chromium prerequisite configured and ordering checked; local harness ready; hosted Node.js 24 CI, clean setup, staging and deployment rehearsal unverified |

## Current delegated work log

These four assigned work packets were executed this turn by Forge Architect, Forge Implementer and Forge QA, not merely proposed. Coordinator retains plan ownership; local acceptance is distinct from live or release acceptance.

| Completed dispatch | Owner | Deliverable / execution | Acceptance / verification | Remaining dependency |
| --- | --- | --- | --- | --- |
| Documentation and baseline QA | Forge Implementer; Forge Architect; Forge QA | Implementer reconciled tracker; Architect source review identified missing profile age fixture input and 600ms debounce cancellation; QA ran fresh read-only setup and baseline tests | QA baseline `npm test`: 60 passed; setup reports age 42703, other checked profile columns and all 7 forge tables available; checked SQL/management presence flags all false | Coordinator+Owner migration access and Forge Architect readiness review; no schema application or grant proof |
| Numeric-age browser harness | Forge Implementer; Forge QA | [tests/e2e.mjs](tests/e2e.mjs) fills numeric age 22 at early invalid-name validation and profile save, adds persistence assertions and sanitized full-suite schema preflight | Local syntax, mocked preflight and offline DOM checks passed; harness locally ready without weakening age/AI gates | Forge QA full authorized live run after schema/grant readiness and disposable target/local origin confirmation; no actual mail or live age persistence proved |
| Immediate save scheduling and QA repair | Forge Implementer; Forge QA | Removed lost 600ms window with immediate serialized saves preserving latest in-flight state, reversions, retry and conflict; added mounted Chromium tests; repaired QA-reported stale transient-error alert on idle reversion | Implementer full `npm test`: 70 passed, typecheck/scoped lint passed; final independent focused QA: 12 passed, alert count 0, conflict/in-flight behavior preserved | Local scheduling accepted; live persistence/export/restore checks remain; native browser-close completion not guaranteed; QA did not rerun full 70 |
| CI browser prerequisite | Forge Implementer; Forge QA | Repaired QA-reported missing Chromium prerequisite: `npm ci` -> `npx playwright install --with-deps chromium` -> `npm test`; README documents local browser prerequisite | Independent YAML ordering checks passed; CI configuration ready | Hosted Node.js 24 execution not run; local evidence uses Node.js 25.2.1; no fresh production build or deployment claim |

## Ordered remaining-work plan

The completed dispatches above inform these next assignments; Coordinator+Owner retains sequencing and file-ownership authority. Forge Architect and Forge QA independently review without application mutations; findings return to Forge Implementer for an assigned fix. Next: readiness by Coordinator+Owner + Forge Architect, then full authorized profile/resume/export verification by Forge QA. Parallel Forge Architect AI/PPT feasibility and Forge Implementer local account failure/accessibility scopes need not wait for all migrations. Remote writes require target reconfirmation; AI probes consume quota and need separate authorization. Staging/production deployment remains unapproved.

| Order / task IDs | Owner | Dependency | Deliverable | Acceptance | Verification |
| --- | --- | --- | --- | --- | --- |
| 1 - 03/04/09/21 | Coordinator+Owner; Forge Architect; Forge QA verifies | Confirmed disposable target and owner-operated SQL/management access; fresh checks found all checked presence flags false | Owner supplies secure migration configuration or applies outstanding SQL in the SQL editor; Architect reviews README order, especially 20260928, 20260929 and 20260930 | Resume presence distinguished from grant readiness; missing age addressed; legacy ages never fabricated; review existing rows before constraint validation | Forge QA records sanitized setup empty reads plus explicit grants/invalid-write checks after owner-authorized application; setup alone is insufficient |
| 2 - 02/03/04/09/21 | Forge Implementer; Forge QA verifies | Local harness work completed; packet 1 and confirmed disposable target/local origin required only for external acceptance/browser writes | Numeric age 22 at both profile fixture points, persistence assertions and sanitized full-suite schema preflight complete; preserve unique fixtures and finally cleanup | Local syntax, mocked preflight and offline DOM checks passed; full current-form/age/adult-grant acceptance remains external; signup streaming fallback separate | Forge QA verifies full authorized live compatibility and cleanup after readiness; authoring-only scope is not a full pass; no live age persistence/mail claim |
| 3A - 09 local scheduler | Forge Implementer; independent Forge QA | Completed local implementation and QA-repair cycle; no remote dependency for local acceptance | Immediate serialized saves and mounted Chromium regression tests; lost 600ms cancellation window and stale idle-reversion alert fixed | Local scheduling accepted: latest in-flight state, reversions, retry and conflict preserved; native browser-close completion not guaranteed | Implementer full 70 passed plus typecheck/scoped lint; independent focused 12 passed and alert count 0; not live database evidence |
| 3B - 03/09 then 06/11/05 live gates | Forge QA; Forge Implementer for assigned fixes | Packet 1 readiness and packet 2 local harness complete; no schema/grant failures; confirmed disposable target/local origin | Full authorized profile age/save, cross-device resume, conflicts/retries/version changes, Continue/quiz restore, export/deletion verification; remaining unload behavior review | Owner isolation and no answer-key leaks; failed saves truthful; resume included in real export and deletion; large/later-page failures covered | Blocked live acceptance: Forge QA runs full authorized browser scope and records commands, scope and fixture cleanup; local scheduler tests do not satisfy these gates |
| 4A - 04/15/16/18 | Forge Architect | Can run read-only alongside packets 1-3 after assignment; existing provider contract/evidence | Free-only ZDR-compatible text/structured endpoint feasibility and HK/age/consent/data-processing review | No paid fallback, privacy relaxation or inferred live success from 429/404; identify provider and eligibility blockers | Independent read-only contract review; mocked tests first in an assigned implementation packet; separately authorized synthetic/live checks only after age/grants and policy gates |
| 4B - 19/16 | Forge Architect | Can run read-only in parallel with 4A and packets 1-3 after assignment | Legacy binary PPT conversion feasibility: Vercel runtime/budget, resource limits, licensing, privacy and draft schema | Required PPT stays open unless a safe route is demonstrated; PDF/PPTX extraction not equated with full generation | Independent read-only dependency/runtime assessment; no installs/uploads/probes here; fixture extraction and deployed-runtime checks after assignment/approval |
| 5 - 15/16/18/19 | Forge Implementer; Forge QA | Packets 1-2 and 4A/4B recommendations; approved implementation ownership | Resolve feasible AI/PPT blockers and complete optional session-only paths and editable import drafts | SDLC-only output, adult grant and minor denial, context isolation, safe failures/limits, no retained originals, all three required formats | Focused mocked regression first; independent Forge QA performs authorized generation/coaching/path/import checks with synthetic data and records quality/runtime limits |
| 6 - 01/02/03/05/13/20 | Forge Implementer; Forge QA | Local harness ready; assign local account failure/accessibility work in parallel with Architect AI/PPT feasibility and live-readiness work, without waiting for all migrations; controlled inbox/SMTP for mail gates | Account expiry/failure recovery, PKCE/email-change verification, keyboard/screen-reader/responsive audit | All remaining task checkboxes addressed; no private-data leaks, false success, unreachable controls or cleanup failures | Inject failures locally first; independent QA records desktop/mobile/landscape and assistive checks; authorized inbox/browser tests for external gates |
| 7 - 04/08/21 | Coordinator+Owner; Forge Architect; Forge QA | Earlier evidence; legal/institutional review, reviewed SDLC curriculum and separate environment/deployment approval | Consent/withdrawal/retention decision, reviewed content, report/video/manuals/slides/contribution/stakeholder artifacts and release handover | Owner owns academic submission; conditional consent requirements not invented; hosted CI, clean install/upgrade, restricted demo and operational gates pass before release | Independent QA reviews evidence and reruns applicable tests/typecheck/lint/build; record hosted CI and authorized staging smoke results separately; owner accepts by 31 October 2026 |

Owner decisions still required: institutional/legal and provider consent/withdrawal/retention requirements (including whether parental verification/versioned consent records are required), safe environment/access for outstanding migrations, curriculum approval, and acceptance of any infeasible required PPT/AI delivery. No scope reduction is assumed. Streaming/cancel/regenerate/durable-job requirements under 15/16 also need confirmation; durable paths, cohorts and roster-file extensions are not silently added.

Owner action for remote SQL: provide migration configuration through a secure channel/environment, never credentials in chat, or apply outstanding migrations directly in the Supabase SQL editor after confirming the disposable target. Access is still awaited; source changes and table availability do not establish applied migrations or grants.

## Current task details

### 01 - Configuration and protected access

Implemented: protected routes fail closed; misconfiguration returns a retryable HTML 503 for protected pages and JSON 503 for APIs. Required public settings and site-origin format are validated before server-client creation and email callbacks. Unit tests cover malformed configuration and encoded redirect attempts; focused browser checks reject anonymous page/API access and a synthetic stale cookie.

- [x] Replace the plain configuration-error response with a usable unavailable screen; retain appropriate API errors.
- [ ] Validate required configuration and the canonical deployment origin without exposing secrets (format and presence validated; deployment origin still needs a staging check).
- [ ] Complete missing/partial configuration checks across page and API routes, real expired-session checks and remaining redirect encodings; anonymous access and synthetic stale-cookie checks already pass.

Acceptance: configuration failures are explicit and recoverable; no protected operation runs without valid configuration and authentication; redirects cannot escape the application origin.

### 02 - Authentication experience and failure handling

Implemented: signup/login/recovery forms retain nonsecret values and focus validation errors; provider failures show generic notices, and resend retains retry context. Token-hash confirmation/recovery, single-use links, invalid-code rejection, safe callbacks and protective redirect headers passed the earlier authenticated browser suite. The signup loading-fallback investigation is paused after two sessions; the focused suite does not establish reliable automated signup-form coverage.

Current harness evidence: numeric age 22 is supplied before early invalid-name validation and profile save, with persistence assertions and sanitized full-suite schema preflight. Syntax, mocked preflight and offline DOM checks passed locally; the current full live suite, actual mail delivery and successful PKCE remain unverified.

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

Recorded implementation: field feedback, client/server limits, retained nonsecret failed edits, avatar preview and earlier profile persistence/focus checks. Numeric-age signup/profile rules and adult AI-access controls exist locally; fresh Forge QA setup this turn confirms `profiles.age` is absent (42703), blocking current profile saves/adult grants. Profile-limit and age migrations use `NOT VALID`; deployment, legacy-row review and current end-to-end behavior remain unverified.

- [x] Add field-level feedback and matching client-side limits.
- [x] Preserve nonsecret edits when saving fails (selected files must be reselected).
- [x] Repair local harness age input at early invalid-name validation and profile save (numeric 22), persistence assertions and sanitized full-suite schema preflight; syntax/mocked/offline DOM checks passed, not live age persistence.
- [ ] Align profile database constraints with accepted values and limits where needed (migration and isolated invalid-write tests pass; connected deployment and legacy-row review pending).
- [ ] Test expired sessions, missing configuration and database failures without false success notices.
- [ ] Verify the implemented age-change rules under 04 after age migration: valid numeric age, underage/unknown rejection as applicable, minor AI denial, and trusted adult grant enforcement on direct actions.

Acceptance: invalid/failed saves never appear successful or discard unrelated edits; displayed identity matches persisted values.

### 05 - Data export and account deletion

Implemented: owner-scoped checked-pagination exports, a pending/failure/retry download control, password-confirmed deletion and distinct deletion/sign-out failure guidance. Partial-page failures are covered at the pagination-helper level, and the browser suite passed a simulated download failure followed by a real retry before the resume migration was added.

- [x] Add export pending, download-failure and retry feedback.
- [ ] Inject a later-page query failure through the real endpoint; helper-level missing/error second-page tests already reject incomplete results.
- [ ] Test large exports through the real endpoint, beyond the pagination helper tests.
- [ ] Inject deletion-provider and cookie/session-cleanup failures through the real workflow; generic recovery guidance is implemented but unverified under these failures.
- [ ] Confirm backup and operational-log retention and document the limits of immediate erasure.
- [ ] Verify resume records in the real export and account-deletion endpoint after schema/grant readiness under 09; the recorded empty read confirms table presence, not endpoint behavior. Keep future consent/storage models in scope when approved.

Acceptance: exports are complete and private; deletion failures are actionable; other learners' certificate snapshots survive author deletion while the deleted learner's own records are removed.

### 07 - Catalog interaction

Implemented: search, subject/visibility filters, no-results state and explicit enrollment with stable lesson IDs.

- [x] Add the planned search keyboard shortcut with accessible focus behavior.
- [x] Add explicit combined-filter, clear-filter, empty-result and keyboard regression coverage.

Acceptance: filters combine correctly, keyboard users can find and enroll in lessons, and repeated enrollment remains idempotent.

### 09 - Durable in-lesson progress

Implemented locally: version-aware private resume storage, authenticated reads and optimistic revision writes for slide, stage, ordering and unfinished answers. Isolated migration, policy, concurrency and cascade tests passed in recorded work. Fresh Forge QA empty reads this turn confirm `forge_resume` is present. This does not establish application/service-role grants or durable writes; `20260930_resume_grant.sql` application and full live persistence remain pending. Missing profile age blocks the full profile/resume/export flow; the repaired harness is locally ready.

Local scheduling acceptance completed: LessonPlayer now saves immediately through serialized writes, removing the lost 600ms debounce-cancellation window while preserving latest in-flight state, reversions, retry and conflict handling. Mounted real-Chromium component tests were added to the existing resume tests. Independent QA found a stale transient-error alert on idle reversion; Implementer repaired it. Implementer reported 70 total tests plus typecheck/scoped lint passed; final independent QA passed 12 focused tests, alert count 0, with conflict/in-flight behavior preserved. These offline tests establish local scheduling behavior, not remote durability or guaranteed completion on native browser close.

- [x] Define a version-aware progress record for slide position, stage, activity state and unfinished answers.
- [x] Complete immediate serialized scheduling and mounted Chromium regressions, including independent QA idle-reversion repair verification.
- [ ] Review/verify remaining native unload behavior; immediate dispatch does not guarantee a save completes on browser close.
- [ ] Verify authenticated, owner-scoped progress reads/writes and required migration/policies (code and isolated migration passed; table presence recorded; connected grants and behavior pending).
- [ ] Define duplicate-write and concurrent-device conflict behavior (revision checks and retryable transient saves implemented; live concurrency/retry verification pending).
- [ ] Restore progress after reload or login on another device.
- [ ] Include new records in exports and deletion cleanup (code and isolated cascade pass; live endpoint verification pending).
- [ ] Test cross-device persistence, duplicate/concurrent writes, unauthorized access and version changes.

Acceptance: authenticated learners restore their own version-compatible position on another device; stale writes cannot silently overwrite newer progress, and answer keys stay private. Existing attendance, grading and certificate rules remain unchanged.

### 06 - Contextual resume links

Implemented: enrolled dashboard and catalog actions open the lesson player; unenrolled catalog actions open the overview. Focused authenticated browser checks pass for those links.

- [ ] Verify that dashboard/catalog Continue restores the saved position after reload or login on another device (depends on 09 schema/grant readiness and live persistence, not a presumed absent table).
- [ ] Verify fallback to an appropriate position when lesson content changes (depends on 09).

Acceptance: Continue reaches the owner's saved position when compatible and a safe starting position when not; it never bypasses enrollment.

### 11 - Unfinished quiz continuation

Implemented locally: unfinished quiz selections are part of the versioned private resume state; submitted attempts and certificate eligibility remain separate records.

- [ ] Verify unfinished answers restore across reload and devices without exposing correct answers (depends on 09 grants and live persistence; table presence alone does not verify restore).
- [ ] Define and verify quiz restart/retry behavior, including lesson version changes and stale attempts.

Acceptance: unfinished choices restore only for the appropriate learner and lesson version; retries remain unlimited and attendance is not treated as passing.

### 13 - Avatar preview and email changes

Implemented and locally tested: JPG/PNG validation, size and decode limits, 160px JPEG conversion, private profile storage, preview, cancel and removal. The email-change action requests verification; it does not claim the address changed before confirmation. Remaining work is external verification, so this item is in Verification rather than Open.

- [x] Preview the selected image before saving; reset preview correctly on remove/cancel.
- [ ] Verify secure email-change confirmation, expired/reused links and session behavior using controlled inboxes.

Acceptance: invalid images cannot replace saved data and an email change is not shown as complete before required verification.

### 14 - Authoring completion

Recorded implementation: private ownership, structured editing, review submission, validation and optimistic version checks. Administrators grant/revoke instructor rights; instructors publish/edit their own lessons and report only on their own published lessons, while administrators retain global public-lesson control. Private drafts remain isolated until explicit review submission. The recorded September 25 instructor suite passed ownership, forged direct-action and next-request revocation checks; this is not a new run or independent release sign-off.

- [x] Track dirty editor state and warn before losing unsaved edits (link/unload and browser Back guards verified in Chromium, Firefox and WebKit for the editor entry flow).
- [x] Add a dedicated local learner-facing preview before saving or publishing (no answer keys).
- [x] Test saved/dirty transitions, cancelled navigation, failed saves, concurrent edits and published-content preview (focused authoring suite covers these in Chromium, Firefox and WebKit).

Acceptance: authors can inspect learner-facing content and cannot accidentally lose edits without warning; previews preserve draft isolation, instructor own-lesson publication/edit/report permissions and administrator grant/revocation boundaries. Broader independent release regression remains under 21.

### 20 - Accessibility and interaction resilience

Implemented and tested locally: catalog search keyboard focus, mobile navigation Escape and focus restoration, active primary links, editor/preview and lesson/coach reachability at 844x390, and auth/profile/lesson/quiz focus changes. This is not a completed accessibility audit.

- [ ] Audit keyboard navigation and screen-reader announcements across the main workflows.
- [ ] Add navigation Escape handling, appropriate focus management/restoration and active-link semantics (mobile sidebar focus/restore and primary links done; other navigation still needs audit).
- [ ] Check mobile landscape, long labels/content and coach panel sizing (editor, preview, lesson width and inline coach-input reachability pass at 844x390; long labels/content still need checks; legacy fixed coach-panel CSS is unused).
- [ ] Standardize action-specific pending, empty, offline, timeout, failure and retry states.
- [ ] Verify focus after validation errors, quiz results and view changes (auth/profile field errors, provider alerts, lesson stage/slide changes, quiz results and retry pass in the focused browser suite; remaining workflows need audit).

Acceptance: workflows remain usable without a mouse and under slow/failing requests; controls and content do not overlap or become unreachable.

## Current policy, content and operational gates

### 04 - Minors and consent

Approved decision: supervised Hong Kong demonstration for ages 13+, not a public launch. Under-13 guardian self-attestation has been removed in the recorded implementation; numeric age 13-120 is required for new signup/profile writes. Minors and unknown-age accounts are denied external AI pending approved consent/eligibility policy, and recorded adults additionally require trusted administrator approval. This is self-reported age, not independent verification or legal consent. No minor AI enablement is approved; the connected age migration and live checks remain blocked.

Current harness coverage supplies numeric age 22 at both profile fixture points, adds persistence assertions and fails full-suite schema preflight with sanitized diagnostics. Local syntax/mocked/offline DOM checks passed; fresh QA still reports missing `profiles.age` (42703). No new live age persistence, adult-grant/denial workflow or mail delivery was established this turn.

- [x] Record the 13+ supervised-HK policy choice and local signup/profile/AI eligibility controls (8 isolated tests recorded; not live migration or legal approval).
- [ ] Obtain institutional/legal approval for age eligibility, consent and retention requirements.
- [ ] Publish approved policy links and consent copy.
- [ ] Select a parental-verification integration only if the approved policy requires one.
- [ ] Apply/review age and profile migrations in the README order, review legacy rows without fabricating ages, and verify server-enforced signup/profile age rules and adult grants live.
- [ ] Determine whether versioned consent records are required by the approved policy; implement and verify them if required. No existing consent record is claimed as proof.
- [ ] Resolve withdrawal and associated retention/deletion policy; implement and test required handling once approved, including backups/log limitations with 05/21.
- [ ] Test underage signup, profile age changes, unknown-age/minor AI denial, adult grant/revocation and direct bypass attempts live; test consent withdrawal once its policy is defined.

Release gate: technical age checks or an administrator grant do not establish consent, provider eligibility or approval to deploy to minors. Keep external AI denied to minors unless a separately approved consent/eligibility policy is implemented and verified.

### 08 - Curriculum and course structure

Current state: published/owner-visible standalone lessons work with stable IDs and missing-page handling. A lesson contains ordered slides, an activity and a quiz.

- [ ] Approve the curriculum and publish reviewed learning content.
- [x] Decide lesson structure: standalone SDLC lessons satisfy approved scope; multi-lesson courses are not required.
- [ ] Complete owner review of SDLC semantic correctness, slide/activity/quiz consistency and publish only reviewed demonstration content; schema/prompt restrictions do not prove correctness.

Decision record: complete on 25 September; status Verification for remaining owner curriculum/content approval. Course containers, ordered relationships, metadata, cross-lesson navigation and course-completion/order/slug/unpublished-content checks remain conditional future obligations only if that scope is later approved, not current implementation tasks or completed features.

### 21 - Delivery and operational readiness

- [x] Add migrations and isolated database integrity/policy tests.
- [x] Add setup diagnostics that avoid printing secrets or learner records.
- [x] Add a secret-free GitHub Actions workflow for tests, lint, type checking and build.
- [x] Record prior local gates and browser passes: September 24 baseline plus September 25's 60 local tests and 18-stage instructor suite; these do not verify the new full profile/resume/export flow.
- [x] Configure CI order `npm ci` -> `npx playwright install --with-deps chromium` -> `npm test` and document the local Chromium prerequisite in README; independent YAML ordering checks passed.
- [x] Record this-turn local evidence: QA baseline 60 passed; Implementer full 70 passed and typecheck/scoped lint passed; final independent focused QA 12 passed after repair. Local Node.js 25.2.1; independent QA did not rerun full 70.
- [x] Complete local numeric-age harness syntax/mocked/offline DOM checks and mounted Chromium scheduler regression coverage; no new browser/Supabase fixtures or AI probes.
- [ ] Verify age/profile/resume-grant readiness and external harness acceptance, then rerun full profile/resume/export workflows with fixture cleanup; current full live E2E not run.
- [ ] Run and verify the hosted GitHub Actions workflow.
- [ ] Rehearse clean installation and the documented migration sequence on a fresh staging database.
- [ ] Rehearse an upgrade with representative existing records and confirm schema compatibility.
- [ ] Verify deployment origins, SMTP, secrets, access-log query redaction and retention settings.
- [ ] Run deployed smoke tests with separate learner, reviewer and administrator accounts.
- [ ] Independently verify admin-granted instructor own-lesson publication/edit/report, filtered enrollment and role/AI-grant revocation in the approved target.
- [ ] Confirm encryption-at-rest, transport, backup/log/provider retention and restricted-demo access; no production data-protection certification is recorded.
- [ ] Complete owner-reviewed report, video, manuals, slides, contribution and stakeholder evidence by 31 October 2026.
- [ ] Obtain independent Forge QA review and Coordinator+Owner acceptance; obtain separate deployment approval before any staging/production rollout.

Acceptance: staging/deployment setup is reproducible and does not depend on undocumented local state. CI configuration is ready, but hosted Node.js 24 execution remains unverified. Historical build success is not a fresh production build; local results do not authorize deployment or certify release readiness.

## Current AI, imports and optional work

### 15 / 16 - AI coaching and generation: Blocked

Current state: implementation is approved. Bounded SDLC-only server-side coaching/generation, ordered free-model fallback, generation schema validation, rate limits and private draft persistence code exist. Twelve local provider tests are recorded; synthetic text returned 429 and structured generation 404 under unchanged privacy restrictions. No successful live generation/coaching is proven. Age migration, trusted adult grants and eligibility review remain dependencies, not reasons to call this work paused.

- [x] Record September 25 approval for AI-native implementation within free-only/privacy/eligibility constraints.
- [ ] Verify a working free provider under the existing privacy policy; do not enable paid fallback or relax privacy without approval.
- [ ] Verify age/schema/grant readiness and direct-action minor/unknown-age denial before authorized live AI workflows; recorded adults require administrator approval.
- [ ] Verify full generation, saved drafts, coaching quality and context isolation.
- [ ] Test malformed output, unsafe inputs, provider failures/timeouts and quota behavior.
- [ ] Complete provider age/region eligibility and data-processing review.
- [ ] Confirm whether streaming/cancel, explicit regenerate controls and durable generation jobs remain required; implement and test approved scope.

Persisted coach history is not approved and is not a pending implementation task.

### 18 - Optional personalization: Blocked live AI

Recorded implementation: optional learning preferences, explainable local SDLC recommendations and explicit AI-path action; 16 local tests and page/layout checks passed. AI paths are session-only and never enroll learners. Only derived coarse preferences and course metadata go to AI, not account identifiers, raw profile goals, grades or answer keys. Live AI success remains blocked by 04/15/16.

- [x] Record optional background/goals/progress-based personalization scope with explanations and user choice; no forced enrollment.
- [x] Implement local recommendations and gated session-only AI-path action with recorded local tests.
- [ ] Verify successful live AI paths and failure recovery, privacy/eligibility gates and session-only lifetime after dependencies clear.
- [ ] Complete evaluation of cold starts, differing backgrounds/goals, overrides and inappropriate topics; local passes do not establish live semantic quality.

Private versioned/durable paths and wider adaptation rules remain deferred unless separately approved; they are not required by the session-only decision.

### 19 - Required teaching-material imports: Open/Blocked

Approved requirement: PDF/PPTX/PPT to editable private slides/activity/quiz, with no original-file retention. PDF/PPTX text extraction and guards passed 14 recorded local tests. Legacy binary PPT is explicitly rejected and remains an unmet requirement; a safe Vercel-compatible conversion route has not been verified. Extracted text is not proof of successful AI draft generation. Scanned/image-only PDF OCR is outside this workflow.

- [x] Record PDF/PPTX/PPT teaching-input scope and local searchable-PDF/PPTX extraction/guard coverage.
- [ ] Resolve and implement safe legacy binary PPT conversion within runtime, licensing, privacy and resource limits, or obtain an explicit owner scope decision; rejection alone does not satisfy the requirement.
- [ ] Verify typed editable output, upload permissions, consented/nonpersonal teaching text, asset licensing, accessibility and submission/progress behavior for imported lessons.
- [ ] Complete hostile-input/resource-limit coverage for the chosen PPT route and imported drafts; retain existing PDF/PPTX guards and no-original-retention behavior.
- [ ] Verify end-to-end generation, editing, save/publish and learner behavior for all three required formats after provider and age/grant readiness; confirm deployed parsing, memory and route-time budgets in an approved environment.

Additional activity/media types remain deferred pending selection and approved schemas, licensing, accessibility and progress rules. Code-execution isolation remains a conditional obligation only if executable activities are approved.

### 17 - Learner imports: Partial; extensions Deferred

Completed approved slice (recorded September 25 instructor regression): instructors select existing verified learner accounts by email filter, up to 50 per action, for their own published lessons; duplicate enrollment preserves progress. Directory filtering, ownership/report isolation and next-request role revocation were exercised. Existing per-lesson reports do not constitute cohort management.

- [x] Implement and verify email-selection imports for existing verified learners, with ownership checks and idempotent enrollment in recorded development tests.

Deferred slice: roster-file uploads, account creation, invitation mail, broader assignment/cohort management and notifications require a new scope decision. They are not part of the completed email-selection workflow. Independent release regression remains under 21.

### 12 - Optional reporting/certificate expansion

The agreed result history, statistics and private/public printable HTML certificates are implemented. Durations, timezone streaks, additional award types and signed/PDF credentials are deferred and require approved definitions and eligibility rules before implementation.

## Historical completed baseline

These recorded earlier passes are retained as evidence, not fresh checks of the expanded September 25 scope. Current acceptance gates above take precedence.

- [x] 10: persistent owner-scoped bookmarks and saved-lessons view.
- [x] 12: attempt history, real result summaries and authorized private/public HTML certificate downloads.
- [x] Manual lesson creation, consecutive saves, private isolation, review/publication and reviewer grant/revocation.
- [x] Enrollment, attendance-before-submission, fail/pass/retry grading, stale-version rejection and snapshot preservation.
- [x] Profile/avatar persistence and validation, owner-scoped export, password-confirmed deletion and cross-learner certificate retention.
- [x] Token-hash signup/recovery, single-use links, safe redirects, invalid PKCE rejection and callback protective headers.

## Historical verification evidence and update log

Original dated entries below are preserved unchanged, including superseded scope decisions and then-current migration blockers. They do not describe the current backlog. Fresh September 25 dispatch/execution results and their limits are recorded separately at the top; this final documentation assignment does not rerun them.

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