# Forge production: non-destructive browser test report

## Environment and safety boundaries

- Date: 22 October 2026, approximately 16:14-16:25 HKT (UTC+08:00).
- Origin: https://comp5241-project.vercel.app
- Session: existing shared, authenticated administrator session. No account switching.
- Browser: VS Code integrated browser, Chromium 150.0.7871.250 / Electron 43.7.7 on Windows.
- Desktop reproduction viewport: 1019 x 727 CSS pixels.
- Mobile emulation: 390 x 844, 320 x 844, and a 320 x 740 route-layout sweep. These are desktop-browser emulations, not physical-device tests.
- Method: browser navigation, accessibility snapshots, read-only DOM inspection, keyboard interaction, and the catalog's confirmed GET search form.
- No save, create, update, delete, enrollment, publishing, quiz-submission, upload, account-change, or AI-generation controls were activated.
- Opening the studio and teaching pages automatically issued POST requests. The matching local source identifies the mount-time actions as saved-generation list/read operations using database SELECTs; no start, resume, advance, or finalize action was invoked. HTTP POST alone is not evidence of a record mutation.
- No production database audit was available, so this report does not claim an independently audited absence of server-side logging or incidental session maintenance.
- No application code was edited. Identifying account values and private record contents are omitted from this report.
- At completion, the shared page was returned to the dashboard, its navigation was closed, and viewport emulation was cleared.

## Confirmed bugs

| ID | Severity | Bug | Affected surface | Reproduction |
| --- | --- | --- | --- | --- |
| PROD-001 | Medium | Clear links restore catalog results but retain stale filter selections | Course catalog | Confirmed with both Clear links; all four select controls also checked together |
| PROD-002 | Medium | Keyboard focus escapes behind an open mobile navigation overlay | Shared learner navigation | Confirmed at 390 px and 320 px widths |
| PROD-003 | Low | Four pages replace the saved account name and avatar initials with generic defaults | Interviews, reflections, onboarding, diagnostic | Each affected route reproduced in two passes |

Severity is based on observed user impact, not an exploitability assessment.

## PROD-001: Catalog Clear links do not reset filter selections

**URL:** https://comp5241-project.vercel.app/catalog

**Preconditions:** Signed in; at least one available public lesson. In the tested session, there was one public lesson and no private lessons.

### Steps to reproduce

1. Open Course catalog.
2. Set Visibility to **My private lessons**.
3. Click **Search**.
4. Click **Clear** beside Search.
5. Inspect the Visibility control and the displayed results.
6. Without changing a control, click **Search** again.
7. Repeat using **Clear all filters** in the empty state instead of Clear.

### Expected

Both clearing links should remove the filters from the URL, reset the controls to their unfiltered choices, and show matching unfiltered results. Searching immediately afterward should remain unfiltered.

### Actual

The URL becomes `/catalog` and the public lesson returns, but Visibility still shows **My private lessons**. Clicking Search immediately reapplies `visibility=private`, hiding the lesson again.

Both **Clear** and **Clear all filters** reproduced the stale selection. Reloading the unfiltered URL resets the control correctly.

### Captured evidence

| Step | URL | Visibility value | Visible lesson cards |
| --- | --- | --- | --- |
| Filtered | `/catalog?q=&subject=&audience=&difficulty=&visibility=private` | `private` | 0 |
| Clear | `/catalog` | `private` | 1 |
| Search again | `/catalog?q=&subject=&audience=&difficulty=&visibility=private` | `private` | 0 |
| Clear all filters | `/catalog` | `private` | 1 |
| Reload unfiltered URL | `/catalog` | empty / All available | 1 |

A second reproduction set all four selects before searching. After Clear, the URL was `/catalog` with one public result, but the live form still contained:

```json
{
  "q": "",
  "subject": "AI Coding-Agent Skills",
  "audience": "instructors",
  "difficulty": "advanced",
  "visibility": "private"
}
```

The search text reset correctly; the defect was confirmed on Subject, Audience, Difficulty, and Visibility.

**Impact:** The visible controls contradict the displayed results. A subsequent search unexpectedly reapplies filters that the user already cleared.

**Workaround:** Reload `/catalog`, or manually reset each select.

## PROD-002: Mobile navigation leaves covered background controls keyboard-focusable

**URL:** https://comp5241-project.vercel.app/dashboard

**Preconditions:** Signed in. Set the viewport to 390 x 844 CSS pixels. The exact tab count below is for the tested administrator navigation.

### Steps to reproduce

1. Open the dashboard at the mobile viewport.
2. Activate **Open navigation**.
3. Wait for the slide-in animation to finish. Initial focus is on **Close navigation**.
4. Press Tab repeatedly through the navigation links and Log out, without activating any of them.
5. After 15 Tabs from Close navigation, focus reaches the background **Open navigation** button.
6. After 16 Tabs, focus reaches the background **Explore courses** link.
7. Press Escape to close the navigation safely.

### Expected

While the drawer and blocking overlay are open, keyboard focus should remain within the navigation's available controls, or the drawer should close before focus moves into the workspace. Focus should not land on visually covered controls.

### Actual

The drawer stays open while focus moves into the workspace behind it. At 390 px width, the focused Explore courses link is covered by the overlay. At 320 px width, its center is covered by the drawer's brand row.

### Captured evidence

| Viewport | Tabs from Close navigation | Focused element | Inside drawer | Menu expanded | Element covering focus target |
| --- | --- | --- | --- | --- | --- |
| 390 x 844 | 16 | Explore courses | false | true | `portal-scrim` |
| 320 x 844 | 16 | Explore courses | false | true | `brand-row` |

The workspace's `inert` property was false in both cases. Hit testing was performed after waiting for the drawer's left edge to reach zero, avoiding animation-related false positives.

Escape did close the drawer and restore focus to Open navigation in both cases.

**Impact:** Keyboard users can lose visible focus and reach page controls that are blocked for pointer users. This is a focus-order/obscured-focus accessibility defect; no background control was activated during testing.

**Workaround:** Close the drawer with Escape before continuing through page controls.

## PROD-003: Account name and initials fall back to generic values on four routes

**URLs:**

- https://comp5241-project.vercel.app/interviews
- https://comp5241-project.vercel.app/reflections
- https://comp5241-project.vercel.app/onboarding
- https://comp5241-project.vercel.app/diagnostic

**Preconditions:** The existing signed-in profile has a saved display name other than "Learner". No profile editing is required.

### Steps to reproduce

1. Open the dashboard and note the account display name and topbar avatar initials.
2. Open Interview practice.
3. Observe the sidebar account name and topbar initials.
4. Open Daily 4D reflections and compare.
5. From Profile & settings, open **Edit background & goals**, then **View or retake diagnostic**, without submitting either form.
6. Return to the dashboard.

### Expected

The same authenticated account should retain its saved display name and initials throughout the shared navigation.

### Actual

All four affected pages show **Learner** in the sidebar and **L** in the topbar avatar. Returning to the dashboard restores the saved name and initials without signing in again or editing the profile. The Administrator role label remains present.

### Captured evidence

Each route was checked twice after its main heading rendered:

| Route | HTTP status | Matches dashboard display name | Sidebar fallback | Topbar fallback | Reproductions |
| --- | --- | --- | --- | --- | --- |
| `/interviews` | 200 | false | Learner | L | 2/2 |
| `/reflections` | 200 | false | Learner | L | 2/2 |
| `/onboarding` | 200 | false | Learner | L | 2/2 |
| `/diagnostic` | 200 | false | Learner | L | 2/2 |
| `/dashboard` | 200 | true | none | none | 2/2 comparison passes |

**Impact:** The account indicator becomes inconsistent and can make users question which account is active. No account switch, permission change, or data corruption was established.

**Workaround:** Consult the dashboard or profile for the saved identity.

## Coverage and successful observations

Fourteen distinct routes rendered their expected main content:

| Group | Routes | Scope/result |
| --- | --- | --- |
| Learning | `/dashboard`, `/catalog`, `/paths`, `/interviews`, `/reflections`, `/progress` | Main headings, navigation, visible empty states; no learning or AI actions |
| Profile/setup | `/profile`, `/onboarding`, `/diagnostic` | Read-only page loading and identity comparison; no submissions |
| Authoring | `/studio`, `/teaching` | Initial page rendering only; no drafts saved, imports, uploads, or generation |
| Administration/reporting | `/reports`, `/admin`, `/admin/accounts` | Initial page rendering only; no account search, publishing, or maintenance actions |

Additional checks:

- Catalog GET searches behaved as expected before clearing: no-match query 0 cards; `SDLC` query 1 card; Instructors audience 0 cards; New difficulty 1 card; My private lessons 0 cards.
- Catalog `/` shortcut focused Search; Escape blurred it.
- The 320 x 740 layout sweep found no document-level horizontal overflow or overflowing workspace form controls on the ten swept routes: dashboard, catalog, paths, interviews, reflections, progress, profile, reports, admin, and account maintenance.
- Catalog and profile images reported loaded intrinsic dimensions during that sweep.
- No uncaught page errors were recorded during the initial monitored nine-route navigation sweep.
- The monitored catalog and 320 px layout sweeps issued no non-read HTTP requests.
- AI path generation and interview creation were visibly disabled for the current session. Their execution paths were not tested or bypassed.

## Limitations and excluded observations

- Only the existing administrator session was tested. Learner/instructor accounts, anonymous access, and authorization isolation were not tested.
- No mutation-based workflows, learning-progress recording, certificates, quiz grading, reflection saving, interview creation, email verification, deletion, exports, or AI output correctness were tested.
- Course lesson-player routes were deliberately not opened because they may record learning participation.
- No write-capable E2E scripts, quota probes, builds, package installs, or production setup commands were run.
- Canceled Next.js prefetch GETs during navigation were not counted as bugs.
- One browser-harness script initially failed because its execution context did not expose the global URL constructor; it was corrected and rerun. This was not attributed to the application.
- One pointer-action attempt after changing viewport emulation timed out; it passed after explicitly aligning the browser viewport. This was excluded as unconfirmed harness/viewport behavior, not reported as a production defect.
- Browser evidence confirms the three reported behaviors in this deployment at test time. Local source inspection was supplementary; the deployed commit was not independently identified.
