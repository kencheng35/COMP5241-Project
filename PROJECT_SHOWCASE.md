# Forge Learning Studio

## Small lessons. Visible practice. Reviewable AI assistance.

Forge Learning Studio is a software-development learning prototype that connects
short, structured lessons with practice, server-graded quizzes and instructor oversight.
Learners can study without external AI; eligible adults can optionally use AI-assisted
authoring, coaching, learning-path suggestions and text interview practice.

**COMP5241 project showcase · Scope snapshot: 22 October 2026 · Delivery: 31 October 2026**

> **Status:** implemented local prototype with bounded offline evidence, not a certified
> production release. The intended setting is a supervised Hong Kong demonstration,
> ages 13+. External AI requires a recorded adult age (18+) **and** a trusted
> administrator's explicit AI-access grant.

**Explore:** [Features](#features-by-role) · [Learner journey](#a-learner-journey) ·
[Gallery](#prototype-screenshot-gallery) · [Architecture](#architecture-at-a-glance) ·
[Rehearsal](#suggested-academic-demonstration) · [Delivery status](#implemented-locally-versus-still-open)

### Current 22 October, 14:04 decision / local report evidence

Owner **APPROVED the 10–12 minute TARGET walkthrough** and local continuation.
Actual rehearsal **NOT RUN**, duration **UNMEASURED**. Coordinator has accepted the earlier
diagnostic LOCAL packet (**40/40 + 41 native probes**) after directly checking the corrected
same-ID/**advancing-version** sentence against `updateLesson:132–145`; the original wording
finding is closed without a diagnostic/application-source change for that reconciliation.

The bounded Task09/12 `/reports` packet is **locally independently verified: 37/37 + 6/6
actual-route supplement** and Coordinator-accepted for this reporting LOCAL scope only:
**current lesson version / CURRENT PUBLIC ENROLLMENT ROSTER**
counts explicit review, quiz reach and saved public passes independently, once per learner.
Missing review is unknown and optional; no funnel/comprehension claim. Only a same-learner,
same-lesson, current-version saved public score6–10/10 passes. Legacy attendance does not
identify the current version. **Public attempt history (all versions)** retains versioned
snapshots, repeated passes and removed enrollees separately from current-roster counts.
Only authorized published lessons/public records appear; private attempts/enrollments,
reflections and transcripts are excluded. Fresh auth and complete checked reads fail closed.
No atomic cross-query publication/revocation guarantee or connected evidence is claimed.
The existing20Oct synthetic gallery remains historical; no new showcase gallery/AI proof.

### Current optional-path maintenance / remaining demo count

**THREE connected DEMO FLOWS + TWO non-flow approval gates = the existing FIVE
workstreams.** All three have local implementations; connected acceptance is **PENDING**.
Existing optional-path maintenance is **not a fourth required flow**, new module,
planner/tailoring feature or reactivated deferral.

The bounded path repair refreshes authenticated identity at entry and after inference,
checks the same owner and fresh adult/trusted grant, and rejects the whole response after
auth loss/revocation. Owner/coarse-preference keyed client state, immediate duplicate-submit
guard, fixed transport feedback, retained controls, focused feedback/results and canonical
whole-path stale validation are locally implemented. Explicit consent/local recommendations,
anonymized candidate tokens, shared quota and the20Oct shared-client policy stay unchanged.
No persistent path/enrollment/history or automatic retry/inference is added.

**22 October independent optional-path + fresh accumulated integration QA: LOCAL PASS;
Coordinator-accepted LOCAL checkpoint only**, not connected/full-MVP/production or owner
content approval. One actual-action probe passed **1/1 covering seven auth/grant/owner-context,
whole-result rejection and recovery scenarios**. One fresh standard serial `npm test` passed
**340/340 across 31 files**; six-file scoped lint and direct TypeScript passed. Environment-file-free
isolated **Next typegen → TypeScript → `build --webpack` passed**, all exit0; build **31.988s**.
Nine fresh local UI images were opened, not added to or claimed as the20Oct gallery.
Exact evidence, image paths, fingerprints and cleanup are in the
[README checkpoint](README.md#22-october-2026--independent-paths--fresh-integration-checkpoint-local-pass)
and [tracker](IMPLEMENTATION_TRACKER.md).

The earlier22Oct writer-only **59/59** focused packet and expanded **22/22** checks remain
**dated history**, as do their lint/TypeScript/whitespace and synthetic UI evidence;
their QA-requested wording is superseded by the independent checkpoint above.
Reports37+6 and diagnostic40/41 retain their bounded LOCAL acceptance. No source, policy,
schema, model or quota change is part of this status synchronization.

Next critical step is **planned shared-screen connected acceptance**, not adding deferred
features or a fourth flow. Connected transport, target schema/grants/cache/app version,
Postgres races, live AI and owner content/source/pedagogy review remain unverified.
The owner-approved10–12-minute TARGET is unchanged; rehearsal **NOT RUN**, duration
**UNMEASURED**. Local first/shared screen later; no login request now. Future login alone
does not authorize writes/provider operations; confirm target and operation scope first.

## The problem and intended users

Software-development study involves more than reading slides: learners need to connect
concepts to decisions, check their understanding and know what to practise next.
Instructors need manageable authoring, enrollment and reporting workflows without
automatically exposing private drafts or treating generated text as reviewed teaching material.

Forge brings these activities into a compact, role-aware workflow:

- **University learners and beginners:** discover relevant standalone lessons, practise,
  retry assessments and keep evidence of passing.
- **Instructors:** author and maintain their own lessons, publish them, enroll learners
  and inspect reports within their ownership boundary.
- **Administrators and approved reviewers:** manage trusted grants and bounded review access.
- **Participants aged 13–17:** use non-AI learning workflows; signup does not grant AI access.

## Features by role

All capabilities below describe the **local implementation**, subject to the open gates later.

| Role | Available prototype workflows | Important boundary |
| --- | --- | --- |
| Learner | Role-appropriate onboarding, optional six-question local diagnostic, chosen learning level | The diagnostic suggests a level; adoption or override is explicit. Self-report grants no instructor or AI rights. |
| Learner | Search/filter the catalog, enroll, bookmark, study slides and complete an ordering activity | Audience and difficulty describe suitability, not permission to access private content. |
| Learner | Optional slide-review acknowledgement, version-specific attendance and saved passing results; unlimited quiz retries and per-pass certificates | REVIEWED is explicit self-acknowledgement, ATTENDED means reaching the final quiz, PASSED requires a saved server score ≥6/10. Review is not a quiz gate or award; missing historical review is unknown. |
| Lesson owner | Manually create/edit private lessons, preview content, load three review-ready authored starters and request review | Starters are not AI output or owner-reviewed courseware. Opening one does not save/publish/enroll. Private drafts require explicit owner submission before administrator review access. |
| Learner / author | Click explicit HTTPS references in slide body/examples and full preview | Links remain **unverified**, not fetched or endorsed by the renderer. Owner source/age-suitability review remains required. |
| AI-eligible adult | Save/resume staged lesson generation; optionally request coaching, AI paths or text interviews | External inference requires adult age, an administrator grant, applicable consent and available free-provider capacity. |
| Instructor | Publish/manage instructor-owned lessons, email-filter verified learner enrollment; current-version public-roster evidence and version-labelled all-version public attempt history | Published owned lessons only; private enrollments/results/reflections/transcripts excluded. Enrollment does not create accounts or send invitations. Historical attempts do not inflate current-roster counts. |
| Administrator / reviewer | Grant instructor status, AI access and quiz-report reviewer access; review submitted lessons | Reviewer grants concern reports, not learner assignment or unrestricted private-draft access. |
| Account owner | Maintain profile, export owned data and delete the account; delete individual interviews | Provider/hosting logs and backups need separate retention arrangements. |
| Account owner | Create/edit/date-select/export/delete private daily **4D reflections**: Delegation, Description, Discernment, Diligence | Plain text, one entry per Hong Kong date; no AI forwarding, sharing, grading, streaks, certificates or progress awards. Export is through account data export. |

## A learner journey

1. **Set a starting point.** Complete role-appropriate background/goals onboarding.
   Choose a level, optionally take the local diagnostic, then keep, adopt or override its suggestion.
2. **Find a useful skill.** Filter the catalog by subject family, audience, difficulty
   and visibility. Read the learning outcomes and prerequisites before enrolling.
3. **Study one focused mini-course.** Each mini-course is **one standalone lesson**:
   **4–6 slides**, followed by an ordering activity with **3–6 steps**. Optionally
   acknowledge slide review; enrollment, bookmarks and a saved place do not prove review.
4. **Check understanding.** Submit **exactly 10 questions**, each with **four options**.
   The server marks the attempt; **6/10 passes**. Quiz retries are unlimited.
5. **Keep evidence and continue.** Review saved attempt feedback and print an
   **HTML certificate for each passing attempt**. Attendance alone is not a pass.
6. **Optionally practise further.** Use local recommendations, or—only when eligible—
   optional AI paths, lesson coaching or private text interview practice.
7. **Reflect privately without AI.** Record the four D choices, revise the dated entry,
   export owned data or explicitly delete the entry. This does not award lesson progress.

The diagnostic is a separate, local orientation aid, not the ten-question lesson quiz,
a credential or proof of mastery. Only its latest bounded summary is retained, not
diagnostic answers or attempt history. Neither it nor path recommendations currently
implements genuinely tailored lesson explanations or practice.

## What distinguishes the design

These are project-specific design choices, not claims of worldwide novelty or proven learning gains.

1. **A deliberately small learning unit.** A consistent slide → activity → quiz contract
   makes a lesson straightforward to author, inspect and demonstrate. There are no
   multi-lesson course containers or community features in this prototype.
2. **Non-AI learning remains a first-class route.** Manual authoring and ordinary lesson,
   activity, quiz and certificate workflows do not depend on an external AI response.
   This matters for minors, unavailable providers and constrained demo budgets.
3. **Suggestion is not authority.** A diagnostic result does not silently change the
   learner's level; audience tags do not grant access; AI feedback is not a course grade.
4. **Recoverable generation rather than one opaque wait.** Generation saves an outline,
   individual slides, an activity and two five-question batches separately. Users explicitly
   pause, resume, retry or reconcile uncertain responses instead of silently starting a new copy.
5. **Private authoring before publication.** Whole-content validation and atomic
   finalization produce one canonical **private** lesson. Owner review, editing and
   permission-gated publication remain separate from generation.
6. **Ownership extends beyond the happy path.** Private interview history supports
   reopening, deletion and export; generic lesson-coach exchanges remain session-only.
   These are application design boundaries, not a security or privacy certification.

**Generation detail:** saving a generation draft makes no AI call. Pause/close stops
subsequent scheduling, not an already-running request, whose part may still save.
Reloading does not start inference; uncertain acknowledgements require loading saved
state and explicit reconciliation. The current local acceptance does not prove live provider quality.

## Curriculum families

| Family | Intended learning emphasis | Current content boundary |
| --- | --- | --- |
| **Software Development Life Cycle (SDLC)** | Overview/planning, requirements, design, implementation, testing, deployment and maintenance | Review-ready starter: **SDLC: a small change from need to feedback** (`sdlc-small-change`). |
| **AI Coding-Agent Skills** | Framing tasks, reviewing proposed changes and verifying outputs | Review-ready starter: **Coding agents: supervise a small change with 4D** (`coding-agent-4d`), including a 4D ordering exercise, not embedded execution. |
| **Software Development Soft and Product Skills** | Collaboration, communication and product trade-offs | Review-ready starter: **Product skills: explain a small trade-off** (`product-tradeoffs`). |

All three are original authored **five-slide** starters with curriculum metadata,
an ordering activity and ten four-option questions/explanations. Open through
**Studio → Authored lesson starters**, or `/studio?manual=1&starter=<id>`.
Owner factual/pedagogical/answer-key/source and supervised-13+ suitability review is
**pending**. References survive ordinary saves as slide text; clickable HTTPS resources
are unverified suggestions, not a curated/approved collection or proof of availability.

Lessons carry explicit audience, difficulty, outcomes and prerequisites. Legacy lessons
without these fields remain identifiable as **not specified**, rather than being
silently classified as beginner-friendly. Optional local recommendations and AI paths
help select/order existing lessons; they are not genuine content adaptation.

## Prototype screenshot gallery

**Historical gallery: 20 October 2026 only.** All seven captions below describe that
dated capture, not the 22 October starters/progress/reflections or a fresh rehearsal.
No new screenshot, recording or connected/live-AI evidence is claimed.

**Evidence type:** locally rendered routes/components with synthetic accounts and content,
captured by offline Chromium harnesses on 20 October 2026. These are actual prototype
renders, **not mockups, live deployed end-to-end screenshots or live AI results**.
Shell, navigation, image and action adapters may be substituted; blank catalog media
areas reflect the image adapter. Captures were inspected and copied unchanged into
`docs/screenshots/` so the gallery does not depend on temporary evidence directories.

### 1. A clear starting point — desktop onboarding

![Desktop learner onboarding with background, learning goals, a chosen level and links to the optional local diagnostic.](docs/screenshots/onboarding-desktop.png)

*The learner selects coarse background/goals and a level. The screen explicitly separates
these choices from diagnostic suggestions and warns that they do not grant teaching or AI access.*

### 2. Suggestions without automatic adoption — mobile diagnostic

![Mobile diagnostic result suggesting Advanced after six of six answers while the chosen level remains New to the subject, with adopt and override controls.](docs/screenshots/diagnostic-mobile.png)

*A synthetic 6/6 result suggests Advanced, but the chosen level remains unchanged.
The narrow layout retains explicit adopt, override and retake controls.*

### 3. Three subject families in one catalog — desktop

![Desktop lesson catalog with subject, audience, difficulty and visibility filters above synthetic SDLC, coding-agent, soft-product and legacy lesson cards.](docs/screenshots/catalog-desktop.png)

*The catalog exposes learning metadata alongside private/published labels.
The legacy card demonstrates honest handling of missing metadata; the lessons shown are fixtures.*

### 4. Focused discovery on a small screen — mobile catalog

![Mobile catalog filtered to an intermediate AI Coding-Agent lesson suitable for instructors and visible under My private lessons.](docs/screenshots/catalog-mobile.png)

*Stacked filters narrow discovery without confusing audience suitability with access.
The synthetic private lesson is shown in its owner's harness context.*

### 5. A complete non-AI authoring route — desktop editor

![Lower section of the manual lesson editor showing question ten, four options, the correct-option selector, explanation, preview, save and a Lesson saved confirmation.](docs/screenshots/manual-authoring-desktop.png)

*This retained editor viewport shows a synthetic manual lesson's saved confirmation.
It illustrates authoring and feedback, not a learner's completed quiz or an externally generated lesson.*

### 6. Pause with saved progress — mobile generation

![Mobile generation status paused after one saved outline, with the next slide stage, explicit resume, reconciliation and draft-deletion controls.](docs/screenshots/generation-paused-mobile.png)

*The outline is saved and the next stage is slide 1 of 4. Resume and response-loss
reconciliation remain explicit, with no claim that closing the page cancels an in-flight request.*

### 7. Completion leads to private review — desktop generation

![Desktop generation status with eight saved parts, a completed progress bar and a link to review the completed private lesson in the editor.](docs/screenshots/generation-completed-desktop.png)

*The synthetic four-slide example has eight saved parts: outline, four slides, activity
and two question batches. Completion offers private editor review, not automatic publication.*

### Screenshot provenance and portability

All seven PNGs total **442,098 bytes** (about 432 KiB); no resizing, compositing or
invented UI was used. The three selected earlier-evidence images matched their recorded
SHA-256 inventory entries; all seven persistent copies matched their source-file hashes.

Evidence roots below are beneath the capturing machine's `%TEMP%`, not runtime dependencies:

- **E:** `forge-independent-lesson-20261020-qa/evidence/screenshots/` (retained inventory evidence).
- **C:** `forge-tracker08-DmwS9h/` (latest independent offline curriculum-route captures).
- **G:** `forge-generation-20261020-j2SRxG/` (latest independent saved-generation captures).

| Persistent filename | Pixels | Original evidence under the indicated root |
| --- | --- | --- |
| `onboarding-desktop.png` | 1440 × 1060 | E: `forge-onboarding-ui-0Lb7fV/onboarding-desktop.png` |
| `diagnostic-mobile.png` | 320 × 1685 | E: `forge-onboarding-ui-0Lb7fV/learner-diagnostic-320.png` |
| `catalog-desktop.png` | 1280 × 2088 | C: `catalog-desktop.png` |
| `catalog-mobile.png` | 390 × 1848 | C: `catalog-mobile-filtered.png` |
| `manual-authoring-desktop.png` | 1440 × 900 | E: `forge-manual-qa01-oowtqs/blank-saved-1440.png` |
| `generation-paused-mobile.png` | 320 × 1333 | G: `paused-320.png` |
| `generation-completed-desktop.png` | 1440 × 1000 | G: `completed-1440.png` |

Traceable harnesses: [onboarding](tests/onboarding-ui.test.mjs),
[curriculum routes](tests/curriculum-ui.test.mjs),
[manual authoring](tests/manual-authoring.test.mjs) and
[saved generation](tests/lesson-generation-ui.test.mjs).
Fixtures contain no real learner records. No new screenshots or test reruns were needed
for this showcase. The gallery does not evidence the learner player, certificates,
instructor reports, administration screens or connected operation.

## Architecture at a glance

```text
Browser: role-aware screens, lesson player, editor and saved-generation controls
    |
Next.js server operations: authenticated ownership/role checks, grading, AI eligibility
    |                                  |
Supabase Auth + Postgres                Optional server-side OpenRouter requests
Private records, RLS and RPCs           Verified zero-price :free models only
```

| Layer | Technology / responsibility |
| --- | --- |
| Web application | **Next.js 16.3.5**, **React 19**, **TypeScript**; server routes/actions and client interactions |
| Interface | **Tailwind CSS 4** plus component styles; shared responsive controls |
| Identity and storage | **Supabase Auth / PostgreSQL**, RLS and server-only learning-table operations with explicit access checks |
| Content contracts | Zod validation for lesson structure and curriculum metadata; server-side quiz scoring |
| AI integration | Server-side **OpenRouter**, free-only catalog checks, bounded requests and saved generation stages; no paid fallback |
| Teaching-material extraction | PDF/PPTX text extraction: **4 MiB**, **60 pages/slides**, **20,000 extracted characters**; originals are not retained |

Extracted import text can be retained while generation is pending, then cleared on
completion/deletion. Legacy **`.ppt` is explicitly unsupported and deferred for the demo** (an unmet original requirement).
External requests can contain objectives, consented extracted text, relevant lesson or
interview context; users must not include personal/confidential information.
The **20 October policy omits `provider` and `reasoning` request overrides**:
do not infer guaranteed zero-data-retention, provider no-retention or enforced historical
strict request filters. Effective account/provider policies and availability require review.

## Suggested academic demonstration

### Prerequisites and evidence boundary

**Owner-approved TARGET duration: 10–12 minutes (22Oct14:04)**; actual duration
**UNMEASURED**, rehearsal **NOT RUN**. This is a source-inspected runbook, not a measured
connected demonstration. Owner09:54 defers shared-screen login/connected testing until
later; User22Oct14:04 approves continued local development, not service probes.
Login alone is not write/AI approval.

Before any real probe/write, owner/Coordinator must confirm the disposable nonproduction
Supabase target, application origin/version, schema application/cache/grants/RPCs and
exact permitted operation/cleanup scope. The current
[generation](supabase/migrations/20261020_lesson_generation_ran.sql),
[progress](supabase/migrations/20261021_progress_evidence_ran.sql) and
[reflection](supabase/migrations/20261022_daily_reflections_ran.sql) migrations are required;
**application is unverified by this work** and `_ran` proves nothing.

Use dedicated **synthetic instructor and learner identities**, separate browser profiles
and an exact fixture-ID inventory, never an existing owner's account. A trusted administrator
must grant instructor rights. If AI is used, separately approve data processing/provider
terms/operation scope and grant AI access to a **recorded adult (18+)**; minor/unknown-age
accounts stay on the manual route. Owner must review lesson facts, keys, explanations,
activity order, sources and 13+ suitability **before publication**. Prepare a reviewed
answer plan for deliberately scoring five, then six; do not expose author answer keys
through the learner UI.

Later operator commands, **not executed here**:

- `npm run check:setup` loads local configuration and performs remote **zero-row database
  column reads**; it is not fully offline. No AI catalog/inference without `--ai`.
- `npm run check:setup -- --ai` additionally verifies the free catalog and attempts **one
  quota-consuming synthetic completion POST** via the actual shared client. Failures
  block readiness; a pass proves neither a lesson nor grants/RPCs/concurrency/eligibility/quality.
- `npm run check:ai` reads provider catalog/account-quota metadata; `--probe=structured`
  or `--probe=text` adds inference/quota use. These also require separate authorization.
  Never show keys, raw settings, prompts, provider bodies or account metadata on screen.

### Proposed presentation sequence

Times are flexible allocations, **not promises of connected completion**. Full persistence,
failure-recovery and AI proof/rehearsal can precede presentation after authorization.

| Suggested slot / actor | Actual route and action | Expected observable outcome | Actual status |
| --- | --- | --- | --- |
| 0–1 min · presenter | Explain the supervised HK13+ scope, synthetic roles and chosen lesson; optionally show `/onboarding` or `/diagnostic` already prepared | Chosen level and diagnostic suggestion are distinct; no self-granted privileges or invented learner evidence | **NOT RUN connected** |
| 1–3 min · instructor | `/teaching` → **Create lesson** (`/studio?manual=1`); choose a reviewed starter, preview, leave **Review and publish this lesson** unchecked and **Save lesson**. Reopen the saved ID using **Edit lesson** / **Edit slides and quiz**, make a bounded edit, save; after owner review select that publication checkbox and save | First save creates a private lesson; next save updates the same lesson ID and advances its version, not a duplicate starter. Publication is a separate instructor decision; catalog/teaching shows the published lesson | **NOT RUN connected; owner review pending** |
| 3–5 min · learner | `/catalog` → **View and enroll** → **Enroll in lesson** → **Open lesson**. Use **Next** through slides, wait for progress saving to settle, reload and check restored place. On last slide optionally **Acknowledge slide review** | Saved place resumes; REVIEWED changes only after explicit acknowledgement. Unverified HTTPS references are keyboard-focusable with external/new-tab hints; explain rather than open an unapproved external site | **NOT RUN connected** |
| 5–6 min · learner | **Practice**, move steps using up/down controls, **Check order**, then **Start final quiz** (or **Final quiz**) | Ordering feedback appears; reaching quiz records version-specific ATTENDED independently of optional review or a pass | **NOT RUN connected** |
| 6–8 min · learner | Answer all ten, **Submit quiz** using the prepared five-correct plan; **Retry quiz**, then six correct; **Download certificate**. Inspect `/progress` and saved feedback | Server saves **5/10 fail**, **6/10 pass**, separate attempts, unlimited retries and an HTML printable certificate for each passing attempt. REVIEWED/ATTENDED/PASSED remain distinct | **NOT RUN connected** |
| 8–9 min · instructor | `/reports` **Participation & results.** for own published lesson: read **Current lesson version**, **CURRENT PUBLIC ENROLLMENT ROSTER**, then expand a version-labelled **Public attempt history (all versions)** detail. If approved, `/teaching` → **Manage learners** → **Learner email filter** → **Find learners**, select a dedicated verified synthetic account → **Enroll selected learners** | Current-public-roster counts are per learner/current version: acknowledgement, quiz reach and public saved6–10/10 pass are independent, not a funnel. Missing review is unknown/optional; legacy attendance is not current evidence. All-version public snapshots include repeated passes/removed enrollees without inflating current counts. Private lessons/enrollments/results/reflections/transcripts excluded. Email selection creates no account/invitation; duplicate enrollment preserves progress | **NOT RUN connected; reports locally independently verified 37/37 + 6/6** |
| 9–11 min · learner | `/reflections`: select a date, fill Delegation/Description/Discernment/Diligence, **Create entry**, edit → **Save changes**, reload. `/profile` → **Download my data**; return to the same entry → **Delete entry** → **Confirm deletion** | One private dated entry has a stable identity and increasing revision; owned JSON export includes it; deletion is confirmed and reload shows absence. No AI, sharing, grading, streak or certificate. Handle any uncertain acknowledgement via **Inspect canonical entry**, not blind replay | **NOT RUN connected** |
| 11–12 min · eligible adult / presenter, optional | `/studio` → **Saved generation drafts** → **Load draft**, preferably genuine prepared output; **Review completed private lesson in editor** if completed | Show actual saved-part counts, private lesson and owner-reviewed provenance, or explicitly mark AI **blocked/not demonstrated**. No guarantee a new multistage run fits this slot | **NOT RUN connected; genuine AI output unproven** |

### Optional AI proof/recovery rehearsal — separately authorized, outside the timed core

Prefer an existing genuine generation. **Prepared actual saved AI output** is usable only
after authorized generation provenance and owner quality review are proven. The retained
20 October synthetic gallery is **not live AI output** and cannot satisfy that gate.

If authorized to generate: in `/studio`, choose metadata/objective and **Save generation
draft (no AI yet)**. Expected: private start identity, zero inference; the saved start still
uses an application daily-start allowance. **Resume / Retry explicitly** schedules sequential
parts: outline → individual slides → activity → two five-question batches, then whole-content
validation/private finalization. **Pause after current request** prevents later scheduling;
the in-flight part can still save. On reload/uncertainty use **Load saved state / reconcile
response loss**, inspect confirmed revision/counts, then explicitly retry only if appropriate
(up to three stage attempts; a 90-second lease may need to expire). Never start a duplicate
to recover a lost acknowledgement. Expected: saved parts survive, reload does not infer,
and finalization creates one **private** normal lesson, not automatic publication.
Use its editor link for owner review before any publication. **Actual status of every
AI rehearsal operation: NOT RUN connected.**

No promise that all stages finish in two minutes. If the provider is unavailable, stop,
record **blocked** and retain safe recovery state; do not change policy/models, silently
retry, pay, or fabricate output. A manual-authored starter fallback demonstrates **manual
learning**, not completed AI. Full AI proof may precede presentation; omit the live extension
if unproven. Imports, if selected later, remain consented bounded **PDF/PPTX**, not binary PPT.

### Rehearsal close and cleanup

Record actual outcomes/failures, target/version, fixture IDs and approved actor/action scope
without secrets or real learner data. Check keyboard focus, narrow layout, readable feedback
and screenreader behavior during a later approved rehearsal; none is freshly certified here.
Cleanup is limited to **exact owned synthetic fixtures** and their approved cascades, with
absence confirmed; no existing owner-account deletion or unrelated records. Deleting a
generation draft does **not** delete its finalized normal lesson. Remove owned local export
copies under the agreed retention plan. **Cleanup/connected fixture creation: NOT RUN here
(no connected fixtures created).** Owner retains final academic review/submission; no invented
findings, contribution claims, user studies or recording.

## Implemented locally versus still open

| Implemented local scope (22 October) | Remaining selected-demo acceptance, not new must-build modules |
| --- | --- |
| Onboarding/local diagnostic, metadata/catalog filters, optional recommendations/AI paths | Owner content/pedagogical review and authorized connected core acceptance |
| Three review-ready authored starters, 4D ordering exercise and clickable unverified HTTPS references | Owner review of all three canonical-family lessons and sources; no reviewed-courseware claim |
| Manual private create/edit, staged saved generation, owner-scoped publishing/enrollment/reports | Connected create/edit/publish/enroll/resume/results/certificates; one genuine eligible free-AI showcase, preferably saved |
| Explicit optional REVIEWED, quiz-reached ATTENDED, saved-score PASSED; current-public-roster/version reports separate from all-version public history; unlimited retries/per-pass certificates; reports locally independently verified **37/37 + 6/6** | Real persistence/version/concurrency checks; no historical review inferred |
| Private daily 4D reflections with CRUD/history, account export and deletion | Owner prompt review; connected lifecycle/export/cascade/privacy acceptance |
| Bounded PDF/PPTX imports, private text interviews and session-only generic coaching | Connected/provider checks only when selected and separately authorized; no voice/video demo requirement |
| Existing local auth/role/owner/age/grant/free-only/server-grading/upload safeguards | Authorized connected QA, rehearsal/accessibility and owner submission approval; not production certification |

**Exactly THREE connected DEMO FLOWS remain pending acceptance:** (1) the core
author/learner journey, quiz/certificates/**reports**; (2) private daily4D CRUD/export/delete;
(3) one genuine eligible free-AI generation. All have local implementations.
**Plus TWO non-flow approval gates:** owner review of three lesson sources/keys/pedagogy;
final rehearsal/accessibility/submission approval. Together these reconcile the old
**FIVE workstreams**, not five unbuilt modules or a fourth optional-path flow.
Target/schema/app-version/operation authorization are common prerequisites, not a sixth
feature or the old25-task backlog. User migration `_ran` application remains UNVERIFIED.

**Six approved demo deferrals remain unchanged:** coding runner24; binary PPT19
(PDF/PPTX demo only); student slide assistant19; private planner23; genuine tailoring18;
targeted AI revisions14/16. They remain unmet original requirements, not current must-build
demo requirements. Existing implementations and controls are not removed.

**Evidence:** independently accepted local reference packet **61/61** and Task22 earlier
**305/305 and snapshot build** are dated LOCAL baselines, not reports acceptance. The
diagnostic LOCAL packet **40/40 + 41 native probes** is Coordinator-accepted following
the source-checked wording correction. The current reports LOCAL packet is **locally
independently verified: 37/37 + 6/6 actual-route supplement** and Coordinator-accepted
for that bounded scope. Scoped ESLint/direct TypeScript, syntax-only instructor-harness
and whitespace checks passed; four fresh320/1440 report/keyboard images were opened,
with all six source/test hashes unchanged. The20Oct gallery remains historical.
Connected transport/schema/grants/publication-revocation races remain open.
No fresh full suite/Next build, connected probe, genuine AI output, owner content review
or actual rehearsal occurred in that dated reports slice; the fresh accumulated LOCAL
integration checkpoint is recorded above.

**Remaining selected-demo acceptance gates:** real Next action transport; authorized target
schema application/cache, RLS/RPC and service grants; provider availability/content/terms
review if AI is used; screenreader testing and owner rehearsal/submission approval.
Any deployment requires separate approval and verification of its hosting/proxy time/cost
budget; a public launch is not this deadline's scope.
Privacy/ownership controls are important design features, **not a security certification**.
No user evaluation, measured pedagogical benefit or successful deployment is claimed.

## Further reading

- [README — setup, current policy, operating details and verification summaries](README.md)
- [Implementation tracker — scope ownership, exact acceptance evidence and remaining blockers](IMPLEMENTATION_TRACKER.md)

This showcase is a presentation aid, not a replacement for the project owner's academic
submission or release decision. Independent coordinator review of the document, captions
and evidence boundaries is requested before report/presentation use.
