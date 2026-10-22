# Forge production: learner workflow testing

## Environment and authorization

- Date: 22 October 2026, approximately 16:48-17:23 HKT (UTC+08:00).
- Application: https://comp5241-project.vercel.app
- Session: the existing shared browser page after the user switched to a learner account.
- Authorization: the user explicitly permitted record creation and AI generation for this pass.
- Browser: VS Code integrated Chromium browser on Windows.
- Methods: normal learner UI, keyboard activation, browser DOM inspection, and same-origin GET reads of the certificate link exposed by the successful quiz.
- Desktop viewport varied with the integrated browser's zoom/size. Mobile findings below use measured CSS dimensions, not merely the requested emulation size.
- Test marker: `QA-20261022-LRN-84fc`.
- Existing lessons, enrollments, attempts, profile settings, age, AI eligibility, and account roles were not deliberately edited. No publication, review submission, learner import, email change, or account deletion was attempted.
- Only synthetic lesson objectives and synthetic interview text were intentionally submitted to AI. AI path generation was not invoked because it would include existing private lesson titles.

The earlier administrator report is preserved separately: [Administrator read-only report](./2026-10-22-admin-read-only.md).

## Findings summary

Two additional issues were observed. All three earlier issues also reproduced in the learner session.

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| PROD-004 | Medium | AI lesson generation repeatedly failed to produce Slide 1 after a saved outline | Two explicit attempts on the same reconciled draft; canonical state remained at 1 saved part |
| PROD-005 | Low | A manually authored lesson's certificate falsely describes its content as AI-generated | Same saved certificate returned the incorrect statement in two GET reads |
| PROD-001 | Medium | Catalog Clear leaves select controls stale | Unfiltered results returned while Visibility remained Public published; Search reapplied the filter |
| PROD-002 | Medium | Open mobile navigation permits focus behind the overlay | Reproduced at measured CSS widths 433 px and 355 px |
| PROD-003 | Low | Saved account name/initials become Learner / L on several pages | Reconfirmed on four routes; also observed on the interview-detail page |

Severity describes observed user impact, not a security audit or an identified root cause. PROD-004 is a reproducible in-session production failure; it is not proof that every topic, account, model, or later request will fail.

## PROD-004: AI lesson generation stops repeatedly at the first slide

**Route:** `/studio`

**Preconditions:** A learner eligible for external AI, with a generation start available.

### Reproduction steps

1. Open Create lesson.
2. Choose:
   - Subject: Software Development Life Cycle.
   - Curriculum topic: Testing.
   - Audience: University learners.
   - Difficulty: Foundation.
3. Enter these learning outcomes:

   ```text
   Identify boundary values for an inclusive 1-to-10 range.
   Choose valid and invalid input test cases.
   ```

4. Leave prerequisites empty and enter this synthetic learning objective:

   ```text
   QA-20261022-LRN-84fc: Teach beginner boundary-value testing using a synthetic inclusive 1-to-10 input range. Create exactly four short slides, a three-step ordering activity, and a ten-question quiz. Use no personal data.
   ```

5. Click Save generation draft (no AI yet).
6. Reload and confirm that the draft is recovered with zero saved parts.
7. Choose Resume / Retry explicitly, then Pause after current request. Let the outline finish.
8. Confirm that one part is saved and the next stage is Slide 1 of 4.
9. Load the saved draft if recovery is delayed, then choose Resume / Retry explicitly.
10. After the failure, choose Load saved state / reconcile response loss before making one explicit retry.
11. Inspect the canonical saved state again.

### Expected

The saved outline should advance to a saved first slide, or the application should provide a usable explanation/recovery path for a persistent generation failure.

### Actual

Both first-slide attempts stopped with:

> This part failed or its save acknowledgement was lost. Load saved state first; no automatic retry was made.

The status became:

> Stopped. Load saved state before retrying.

After reconciliation, the canonical state was:

```text
1 saved parts
Last confirmed revision 7
Next: Slide 1 of 4
Last confirmed stage attempts: 2/3
```

The explicit retry took approximately 65,078 ms from activation to the visible failure. No completed normal lesson was produced.

### Scope and interpretation

- Draft saving, zero-part reload recovery, outline generation, pause, and canonical state loading did work.
- The failed stage did not silently restart or consume another generation start.
- No third first-slide attempt or new generation start was made.
- The browser message intentionally groups inference failure and lost acknowledgement. Server logs/provider diagnostics were not available, so the underlying reason is unknown.
- Interview text AI later succeeded in the same learner session. This was not established as a total AI outage.

**Impact:** The learner used a daily generation start but could not obtain a usable generated lesson during this test.

**Workaround tested:** Save an authored starter manually and use it as a private lesson without AI.

**Cleanup:** Test generation `496bc22f-95e6-4be1-81eb-4a3b80fd4093` was deleted using its UI control. Its absence from the saved list was verified. The disclosed minimal replay-prevention tombstone and quota usage remain.

## PROD-005: Manual lesson certificate incorrectly claims AI-generated provenance

**Fixture lesson:** `cf3c06c3-9c69-4ad9-9f87-783095ada42a`

**Fixture title:** `QA-20261022-LRN-84fc SDLC learner workflow`

### Reproduction steps

1. In Create lesson, open the authored starter SDLC: a small change from need to feedback.
2. Confirm that the starter's introduction describes it as original authored content, not generated AI.
3. Change the title to the fixture title above.
4. Save the lesson manually. Do not request AI generation for this lesson.
5. Open the lesson overview and enroll.
6. Complete the final quiz with a passing score.
7. Open Download certificate.
8. Inspect the certificate's provenance statement.

### Expected

A private manual lesson's certificate should identify it as private self-learning without claiming that AI generated its content. Ideally provenance would distinguish authored and generated material.

### Actual

The certificate correctly contained the synthetic title, version 1, Private Self-Learning label, and score 6/10 (60%), but also stated:

> Self-directed AI-generated learning; not administrator-reviewed.

That statement is incorrect for this lesson, which was saved from an authored starter independently of the failed AI draft.

### Reproduction evidence

Certificate path:

```text
/api/certificates/bdb435cb-71de-4ee2-adba-233289e3d249
```

Two same-origin GET reads of the certificate link both returned:

| Check | Result |
| --- | --- |
| HTTP status | 200 |
| Content-Type | text/html; charset=utf-8 |
| Content-Disposition | attachment |
| Fixture title and 60% score present | Yes |
| Private Self-Learning label present | Yes |
| Incorrect AI-generated statement present | Yes, in both reads |

The recipient's name and the rest of their private account data are intentionally not reproduced here.

**Impact:** The exported credential misrepresents how manually authored learning content was produced.

**Workaround:** No UI control was found to correct this certificate statement. Do not treat it as verified provenance.

## Earlier bugs revalidated as a learner

### PROD-001: Catalog clearing

Using Visibility = Public published:

| Step | URL/filter state | Lesson cards |
| --- | --- | --- |
| Initial catalog | Unfiltered | 3 |
| Search | `visibility=public` | 1 |
| Clear | URL `/catalog`, but control still `public` | 3 |
| Search again without changing controls | `visibility=public` reapplied | 1 |

The learner reproduction confirms the same state mismatch reported in the administrator pass, without depending on an empty private catalog.

### PROD-002: Mobile drawer focus

From the Close navigation button, 13 Tabs in the learner menu reached the background Explore courses link while the menu remained expanded.

| Measured CSS viewport | Focus inside drawer | Covering element | Workspace inert |
| --- | --- | --- | --- |
| 433 x 937 | false | `portal-scrim` | false |
| 355 x 937 | false | open `portal-sidebar` | false |

The requested browser emulation sizes were 390 x 844 and 320 x 844, but browser zoom produced the measured dimensions above. Testing waited for the drawer animation to finish. Escape closed it and restored focus correctly.

### PROD-003: Account indicator

The account name was compared internally against the dashboard without printing its saved value.

| Route | Matches saved dashboard name | Generic name/initials |
| --- | --- | --- |
| `/interviews` | false | Learner / L |
| `/reflections` | false | Learner / L |
| `/onboarding` | false | Learner / L |
| `/diagnostic` | false | Learner / L |

The synthetic interview detail page also displayed Learner / L. This did not establish an actual account switch or role change.

## Successful learner workflows

| Workflow | Actual result |
| --- | --- |
| Reflection creation | Synthetic entry for 2026-10-21 saved as revision 1 |
| Reflection editing/reload | Revision 2 and its revised text persisted after reload and history selection |
| Unsaved reflection navigation | In-app navigation showed a discard dialog; cancel kept the synthetic draft |
| Reflection deletion | Deletion confirmed; canonical read and refreshed history showed no entry |
| Generation draft recovery | Zero-part draft recovered after reload; the saved outline was recoverable later |
| Generation pause | Only the in-flight outline completed; status showed 1 part saved and paused |
| Manual private authoring | Original authored starter saved under the QA title; no publish checkbox was offered |
| Bookmark | Added, observed from Progress, restored as Saved on overview; removed afterward |
| Enrollment | Overview changed to Open lesson after enrolling; entering the player required a separate activation, as designed |
| Slide resume | Slide 2, Make success testable, was restored after leaving for the dashboard and reopening |
| Review acknowledgement | Saved for version 1 and shown in evidence/history |
| Ordering activity | Initial incorrect order produced retry guidance; learner-style reordering produced Correct order |
| Attendance | Reaching the final quiz saved version-specific attendance |
| Quiz completeness | Submit disabled until all ten answers were selected |
| Exact failure threshold | Deliberate 5/10 attempt did not pass and offered no certificate; ten feedback items appeared |
| Retry | Answers reset and submission became disabled until complete |
| Exact pass threshold | Deliberate 6/10 attempt passed and exposed a certificate |
| Progress/history | Both 5/10 and 6/10 attempts persisted; review, attendance, and pass evidence matched |
| Interview creation | Empty private testing/foundation interview created without automatic inference |
| Interview opening AI | First question returned and was saved, approximately 4,176 ms after activation |
| Interview answer AI | One synthetic answer and a second assistant reply saved; input cleared only after confirmation |
| Interview persistence | Exact synthetic transcript survived reload |
| Interview finish | Finished after one answer; answer form disappeared; no additional AI request was made by finishing |
| Interview deletion | UI confirmed deletion; the new interview disappeared from history |
| Learner-only navigation | No Teaching, Publish & review, or Account maintenance navigation links |
| Privileged page reads | `/teaching`, `/admin`, and `/admin/accounts` rendered Lesson or page unavailable |
| Quiz reports | No granted lessons and zero report sections; no other learners' reports were displayed |

The unavailable privileged routes returned HTTP 200 with their streamed unavailable-page UI. This was recorded as a soft-not-found observation, not counted as a proven authorization bypass.

## Production records and cleanup

Only test-owned records were deleted.

| Test-owned item | Final disposition |
| --- | --- |
| Reflection for 2026-10-21 | Deleted; canonical absence and refreshed history verified |
| Generation `496bc22f-95e6-4be1-81eb-4a3b80fd4093` | Content deleted; saved-list absence verified; minimal tombstone/quota usage remain as disclosed |
| Interview `3e30abae-cd45-4d60-9c89-448245b81f56` | Finished, then deleted; history absence verified |
| Bookmark on synthetic lesson | Removed; absent from saved-lessons section |
| Private lesson `cf3c06c3-9c69-4ad9-9f87-783095ada42a` | Retained with the clearly tagged QA title |
| Synthetic lesson enrollment, resume, review and attendance | Retained |
| Two synthetic quiz attempts | Retained: 5/10 and 6/10; passing attempt ID is `bdb435cb-71de-4ee2-adba-233289e3d249` |

No normal lesson deletion, individual attempt deletion, or unenrollment workflow was found in the tested application surfaces. No privileged database cleanup was attempted. Consequently the learner dashboard gained one enrollment and one passed lesson from the synthetic fixture. This is an intentional test side effect, not an unexplained regression.

The retained lesson can be reopened at:

https://comp5241-project.vercel.app/courses/cf3c06c3-9c69-4ad9-9f87-783095ada42a

### AI and quota usage

- One lesson-generation start was saved.
- Three application-level generation stage attempts were made: one successful outline and two unsuccessful first-slide attempts.
- Two interview text-AI requests succeeded: first question and response to one synthetic answer.
- No third first-slide attempt, additional generation start, learning-path AI request, or lesson-coach request was made.
- Exact provider-side calls, token counts, or billing were not inspected. Application-level attempts must not be interpreted as audited provider-call counts.
- Deleting test content did not restore consumed daily allowances.

## Limitations and final state

- Browser evidence is from one eligible learner session and one point-in-time production deployment.
- Generation failures were reproduced within a single draft, not across other topics/accounts.
- Physical mobile devices, concurrent accounts, revoked eligibility, unknown-age/minor accounts, sharing grants, uploads, diagnostic submission, public lesson modification, and long interview limits were not exercised.
- The role checks were read-only UI/page checks, not exhaustive authorization or direct-action security testing.
- No real learner transcript, private lesson body, profile value, credential, token, or email address was intentionally sent to an external AI provider or included in this report.
- Some automation calls encountered browser-harness limitations: viewport/zoom coordinate drift, a load-event timeout, an isolated new tab without the shared login, and an unsupported Playwright cookie API. These were not counted as application bugs. Keyboard interaction and same-origin browser reads were used where appropriate.
- A fresh tab was not used to transfer or reproduce the signed-in session. Testing continued in the original shared page.
- The application source was not changed, and no deployment, schema change, package installation, write-capable E2E script, or administrative cleanup command was run.
- Browser verification at 17:20 HKT: original shared page on `/dashboard`, role Learner, navigation closed, synthetic lesson visible, viewport emulation cleared. The bookmark add/list/remove lifecycle was independently rechecked at 17:23 HKT; removal persisted and the shared page was returned to the dashboard again.
