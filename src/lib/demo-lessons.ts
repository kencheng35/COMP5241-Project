import type { LessonContent } from "./learning";
import type { CurriculumMetadata } from "./curriculum";

/** Authored demo starters, not AI output or reviewed courseware. Selection never saves.
 * Keep references in ordinary slide text as well as authoring guidance so saves retain them.
 */
export const DEMO_LESSON_IDS = ["sdlc-small-change", "coding-agent-4d", "product-tradeoffs"] as const;
export type DemoLessonId = typeof DEMO_LESSON_IDS[number];
export type DemoLessonStarter = {
  id: DemoLessonId;
  description: string;
  references: { title: string; url: string; review: string }[];
  content: LessonContent & { metadata: CurriculumMetadata };
};

const starters: Record<DemoLessonId, DemoLessonStarter> = {
  "sdlc-small-change": {
    id: "sdlc-small-change",
    description: "Plan and test a small software change, using a school club booking example.",
    references: [
      { title: "SWEBOK overview", url: "https://www.computer.org/education/bodies-of-knowledge/software-engineering",
        review: "Compare the lifecycle vocabulary with this software-engineering knowledge overview." },
      { title: "Agile Manifesto principles", url: "https://agilemanifesto.org/principles.html",
        review: "Discuss feedback and working software; do not treat one lifecycle order as universal." },
    ],
    content: {
      title: "SDLC: a small change from need to feedback",
      subject: "Software Development Life Cycle",
      summary: "Follow a club room-booking change from a testable need through design, implementation, testing and feedback. Authored starter; owner review pending.",
      metadata: { version: 1, audience: "learners", difficulty: "foundation", topic: "overview",
        outcomes: ["Turn a user need into a testable acceptance condition", "Connect design, testing and maintenance decisions"],
        prerequisites: ["Read a short software scenario; no programming required"] },
      slides: [
        { title: "Start with the need", body: "A lifecycle connects a software need to evidence that a change helps. First identify the user, the problem and a boundary. A small scope makes it easier to inspect the result. These stages can repeat when feedback changes the plan.",
          example: "Club members need to avoid booking an occupied room. This change checks time clashes; it does not add payments." },
        { title: "Make success testable", body: "A requirement states an observable outcome, not just a wish. Agree an acceptance condition before choosing a design. Include a normal case and a boundary case so different people can judge the same result.",
          example: "Given a room booked from 15:00 to 16:00, reject another booking at 15:30. Allow a new booking starting at 16:00." },
        { title: "Design, then implement a small part", body: "Design explains how the solution will work. Decide what data and rules are needed, then implement a small part that can be checked. Keeping the clash rule in one place reduces inconsistent behaviour across screens.",
          example: "Store room, start and end times. Compare bookings for the same room before accepting a request." },
        { title: "Test, release and learn", body: "Tests compare behaviour with agreed conditions. Deployment makes a checked change available; maintenance responds to defects and new needs. A passing test is evidence for its cases, not proof that every possible booking works.",
          example: "Test an overlap, a different room and adjacent times. After release, inspect reports of unexpected rejections before changing the rule." },
        { title: "Review notes and references", body: "Original authored starter; owner content and pedagogical review pending. Compare lifecycle terms with SWEBOK and feedback ideas with the Agile principles. Public reference suggestions have not been remotely verified in this slice; check relevance and age suitability before teaching.",
          example: "References: https://www.computer.org/education/bodies-of-knowledge/software-engineering ; https://agilemanifesto.org/principles.html" },
      ],
      activity: { prompt: "For the first room-clash change, order this simplified workflow. Real projects may loop back after evidence or feedback.",
        steps: ["Agree the room-clash need and acceptance cases", "Design the booking data and overlap rule", "Implement the smallest clash check", "Test normal and boundary cases against the agreement", "Release the checked change and collect feedback"] },
      questions: [
        { prompt: "Which statement is a testable requirement for this change?", options: ["The booking page should feel modern", "Reject a same-room booking that overlaps an existing time", "Use the most popular database", "Make every club happy"], correct: 1, explanation: "Overlap rejection describes observable behaviour that a concrete booking can test." },
        { prompt: "Why agree the 16:00 boundary before implementation?", options: ["It removes all future defects", "It chooses the screen colour", "It makes deployment unnecessary", "It gives the team a shared expected result for adjacent bookings"], correct: 3, explanation: "An agreed boundary lets designers, developers and testers use the same expectation." },
        { prompt: "Which task is primarily design?", options: ["Deciding what booking data the clash rule needs", "Typing the clash-check function", "Reporting a live defect", "Running a prepared overlap test"], correct: 0, explanation: "Choosing the data and structure explains how the solution will work before it is implemented." },
        { prompt: "A same-time booking in a different room is accepted. What does this test check?", options: ["Whether all users like the interface", "Whether the release was announced", "Whether the rule is scoped to the requested room", "Whether maintenance is finished"], correct: 2, explanation: "The clash rule should compare times only for the same room." },
        { prompt: "A user asks for payments during the clash-check work. What is the best next step?", options: ["Add payments immediately without discussion", "Record the new need and agree whether scope should change", "Delete the clash tests to save time", "Assume the request is already implemented"], correct: 1, explanation: "A new need deserves a scope decision rather than an unreviewed expansion." },
        { prompt: "All three prepared tests pass. Which conclusion is justified?", options: ["The tested cases match their expected results", "No possible booking can fail", "Users will never request changes", "The software needs no maintenance"], correct: 0, explanation: "Tests provide evidence about checked cases, not a guarantee over every input and future need." },
        { prompt: "Which action is deployment rather than implementation?", options: ["Writing a data comparison", "Agreeing the room-clash requirement", "Sketching the booking record", "Making the checked version available to club members"], correct: 3, explanation: "Deployment makes a version available in its intended environment." },
        { prompt: "After release, valid adjacent bookings are rejected. What should maintenance start with?", options: ["Announcing that every requirement is wrong", "Adding payments to distract from the defect", "Reproducing the report and comparing it with the agreed boundary", "Removing every validation rule"], correct: 2, explanation: "Reproducing the problem against the agreement gives evidence for a focused correction." },
        { prompt: "Why keep the overlap rule in one place?", options: ["To reduce inconsistent decisions across screens", "To avoid writing any tests", "To guarantee unlimited server capacity", "To prevent user feedback"], correct: 0, explanation: "One shared rule reduces the risk of separate screens applying different clash logic." },
        { prompt: "What does feedback imply for the lifecycle?", options: ["Only the first requirement ever matters", "A release proves the work is permanently complete", "Testing must wait until all future features exist", "Earlier decisions may need another iteration"], correct: 3, explanation: "Feedback can reveal a defect or changed need that sends the team back through relevant stages." },
      ],
    },
  },
  "coding-agent-4d": {
    id: "coding-agent-4d",
    description: "Use a bounded 4D workflow to supervise a coding agent without running AI.",
    references: [
      { title: "Anthropic AI Fluency", url: "https://www.anthropic.com/ai-fluency",
        review: "Check the Delegation, Description, Discernment and Diligence vocabulary and teaching context." },
      { title: "GitHub responsible use of Copilot", url: "https://docs.github.com/en/copilot/responsible-use",
        review: "Compare human review responsibilities and tool limitations; no provider use is required." },
    ],
    content: {
      title: "Coding agents: supervise a small change with 4D",
      subject: "AI Coding-Agent Skills",
      summary: "Practise Delegation, Description, Discernment and Diligence using a fictional coding-agent patch. No AI account or live inference is needed. Authored starter; owner review pending.",
      metadata: { version: 1, audience: "learners", difficulty: "foundation", topic: "coding-agents",
        outcomes: ["Describe a bounded coding-agent task without private data", "Review a proposed change using a 4D checklist"],
        prerequisites: ["Recognise a function input and output", "Read a short test example"] },
      slides: [
        { title: "Delegation: choose a safe boundary", body: "A coding agent can propose code, but a person remains responsible for deciding what to delegate. Choose a small task with a checkable result. Keep credentials, personal information and unapproved systems outside the task. This lesson uses a fictional patch, not a live agent.",
          example: "Delegate a pure function that checks whether a club name is blank. Do not delegate account access or publishing." },
        { title: "Description: specify the contract", body: "Describe the goal, allowed files, inputs, expected outputs and checks. Say what must not change. A precise description makes a proposal easier to judge; it does not guarantee a correct proposal.",
          example: "In name-check.ts only: return false for empty or space-only text; return true for a nonblank club name. Do not change login or storage." },
        { title: "Discernment: inspect evidence", body: "Inspect the proposed difference and run focused checks in an approved local setting. Ask whether it meets the contract and introduces unrelated changes. A confident explanation from an agent is a claim, not evidence.",
          example: "A proposal uses text.length > 0. Testing three spaces reveals that the proposal accepts blank names." },
        { title: "Diligence: remain accountable", body: "After finding a defect, request a bounded correction, inspect it and repeat the checks. Before accepting, confirm permissions, data handling and attribution expectations. Keep a truthful record of what was checked and what remains uncertain.",
          example: "A corrected trim-based check passes empty, spaces and Chess Club cases. The owner still reviews the patch; no automatic release follows." },
        { title: "Review notes and references", body: "Original authored starter; owner content and pedagogical review pending. Review the 4D terminology with Anthropic AI Fluency and human responsibility with GitHub guidance. Public reference suggestions are not remotely verified here. This ordering exercise does not implement daily reflections or grant AI access.",
          example: "References: https://www.anthropic.com/ai-fluency ; https://docs.github.com/en/copilot/responsible-use" },
      ],
      activity: { prompt: "Apply 4D to the fictional blank-name patch: order the supervision steps. No live agent or daily reflection is required.",
        steps: ["Delegation: choose only the pure blank-name check", "Description: state allowed file, cases and forbidden changes", "Discernment: inspect the patch and test empty, spaces and a real name", "Diligence: record evidence and obtain owner review before acceptance"] },
      questions: [
        { prompt: "Which task is the safest bounded delegation in this scenario?", options: ["Give the agent the production account password", "Ask it to publish all pending work", "Propose a pure blank-name check in one allowed file", "Let it choose any private user records"], correct: 2, explanation: "A pure, one-file check has a small scope and can be judged without private system access." },
        { prompt: "Which detail most improves the task description?", options: ["Expected outputs for empty, spaces and nonblank text", "A demand to sound confident", "Permission to edit any module", "A promise that tests are unnecessary"], correct: 0, explanation: "Concrete input/output cases make the contract observable and testable." },
        { prompt: "A proposal checks text.length > 0. Which input exposes its blank-name defect?", options: ["Chess Club", "Drama Club", "Robotics Club", "Three space characters"], correct: 3, explanation: "Spaces have positive length but still represent a blank name under the stated contract." },
        { prompt: "The agent says its patch is correct. What should the reviewer do?", options: ["Accept because the explanation is fluent", "Inspect the difference and run the agreed checks", "Remove the allowed-file boundary", "Publish before looking at the code"], correct: 1, explanation: "Discernment uses inspectable evidence rather than trusting the tone of an explanation." },
        { prompt: "The patch also edits login permissions. What is the appropriate response?", options: ["Treat the extra edit as automatically helpful", "Hide the edit from the owner", "Reject the scope expansion and request a focused proposal", "Skip review because one test passed"], correct: 2, explanation: "The description excluded login changes; unapproved edits need removal or a separate explicit decision." },
        { prompt: "Which action best demonstrates Diligence?", options: ["Claiming every possible input is proven safe", "Deleting the test results", "Giving the agent ownership of release approval", "Recording checks and uncertainties for owner review"], correct: 3, explanation: "Diligence keeps human accountability and honest evidence through acceptance." },
        { prompt: "A real bug report contains a password. What belongs in the delegated task?", options: ["A fictional, minimal example without the password", "The full report so the agent has all context", "The password repeated in every test", "A public copy of the report"], correct: 0, explanation: "Use a non-sensitive example sufficient to explain the task; credentials are not needed." },
        { prompt: "The corrected patch passes three checks. What remains true?", options: ["Every possible behaviour is now verified", "The checks support those cases; owner review is still required", "Publishing is automatically authorized", "The allowed-file limit no longer applies"], correct: 1, explanation: "Focused checks provide bounded evidence and do not replace review or authorization." },
        { prompt: "Which 4D step asks whether this task should be given to an agent at all?", options: ["Description", "Discernment", "Diligence", "Delegation"], correct: 3, explanation: "Delegation includes choosing an appropriate task and deciding which responsibilities stay human." },
        { prompt: "What does completing this lesson's activity establish?", options: ["Approval for minors to use any AI service", "A completed daily reflection system", "Practice ordering a supervision workflow, not live AI success", "Proof that the fictional patch was deployed"], correct: 2, explanation: "The activity is a local learning exercise; it does not change access policy or demonstrate live inference." },
      ],
    },
  },
  "product-tradeoffs": {
    id: "product-tradeoffs",
    description: "Frame a user problem, compare options and explain a small product decision.",
    references: [
      { title: "GOV.UK: user needs", url: "https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs",
        review: "Compare the distinction between a user problem and an assumed solution." },
      { title: "Scrum Guide", url: "https://scrumguides.org/scrum-guide.html",
        review: "Review goals and adaptation; this lesson does not teach the complete Scrum framework." },
    ],
    content: {
      title: "Product skills: explain a small trade-off",
      subject: "Software Development Soft and Product Skills",
      summary: "Use a school club sign-up scenario to distinguish needs from features, compare options and communicate a decision with evidence. Authored starter; owner review pending.",
      metadata: { version: 1, audience: "learners", difficulty: "foundation", topic: "soft-product",
        outcomes: ["Separate a user problem from a proposed feature", "Explain a trade-off with a success measure and a limitation"],
        prerequisites: ["Read a short team scenario; no programming required"] },
      slides: [
        { title: "Name the problem before the feature", body: "A feature is a possible solution; a user need describes what someone is trying to achieve. Ask who experiences the problem and what evidence supports it. Avoid assuming that the loudest request represents every learner.",
          example: "Three members missed a club event because the location changed. The need is reliable event information, not automatically a new mobile app." },
        { title: "Compare options with shared criteria", body: "List a few options and choose criteria before judging them. Useful criteria include user benefit, effort and risks. Estimates are uncertain: make assumptions visible rather than presenting a guess as a fact.",
          example: "Compare updating the event page with building push notifications. The page update is smaller; notifications need permission and delivery handling." },
        { title: "Choose a small test and a measure", body: "A small trial can reduce uncertainty before a large investment. Define what you will observe and when you will review it. Collect only the information needed for the decision and do not treat a tiny sample as proof about everyone.",
          example: "For the next club event, update the location page and ask volunteers whether they found the room. Record an anonymous count, not names." },
        { title: "Communicate the trade-off", body: "Explain the problem, chosen option, reason, limitation and next check. Listen to disagreement for missing evidence, not just opposition. A clear decision note helps the team revisit the choice when circumstances change.",
          example: "We will try a clearer event page this week because it is small. It may not reach offline members; review the volunteer feedback before adding notifications." },
        { title: "Review notes and references", body: "Original authored starter; owner content and pedagogical review pending. Compare problem framing with GOV.UK user-needs guidance and adaptation with the Scrum Guide. Public reference suggestions have not been remotely verified here; check relevance before teaching.",
          example: "References: https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs ; https://scrumguides.org/scrum-guide.html" },
      ],
      activity: { prompt: "Order a small product decision for club event information. Use a fictional scenario, not real members' private records.",
        steps: ["Describe who missed the location change and what evidence exists", "Compare a clearer page and notifications using benefit, effort and risk", "Choose a small trial and define an anonymous success measure", "Explain the choice, limitation and review date", "Review the trial evidence and adapt the decision"] },
      questions: [
        { prompt: "Which statement describes a user need rather than a chosen feature?", options: ["Members need to find the current event room", "The team must build push notifications", "The page must have a blue banner", "The project must use a new mobile framework"], correct: 0, explanation: "Finding the current room is the user's goal; the other statements prescribe solutions." },
        { prompt: "Why choose comparison criteria before selecting an option?", options: ["To ensure the largest option always wins", "To avoid hearing from users", "To guarantee estimates are exact", "To judge options consistently rather than justify a favourite afterward"], correct: 3, explanation: "Shared criteria make the reasons for a decision visible and more consistent." },
        { prompt: "Which uncertainty is especially relevant to push notifications?", options: ["Whether the page has a title", "Whether permissions and delivery work for intended members", "Whether rooms have walls", "Whether a decision note uses paragraphs"], correct: 1, explanation: "Notifications depend on permission and reliable delivery, which affect their benefit and risk." },
        { prompt: "What is a proportionate first trial for this scenario?", options: ["Replace every club system before asking anyone", "Collect all members' private messages", "Improve one event page and review volunteer feedback", "Promise no member will ever miss an event"], correct: 2, explanation: "One event provides a small checkable trial without committing to a large system or unnecessary data." },
        { prompt: "Which measure best matches the room-finding need?", options: ["An anonymous count of trial volunteers who found the current room", "The number of colours on the page", "The developer's total keyboard presses", "The age of the team's laptops"], correct: 0, explanation: "Room-finding feedback relates directly to the intended outcome and can avoid identifying members." },
        { prompt: "Two volunteers like the trial. What is the best interpretation?", options: ["Every member must like it", "No further feedback is allowed", "Notifications are proven useless", "This is useful but limited evidence from a small sample"], correct: 3, explanation: "A small sample can inform the next step without representing every user." },
        { prompt: "Which decision note communicates a real trade-off?", options: ["We chose it because we chose it", "Try the smaller page change; it may miss offline members, so review next week", "The team guarantees perfect attendance forever", "Only positive feedback will be recorded"], correct: 1, explanation: "The note gives a reason, a limitation and a time to check the decision." },
        { prompt: "A teammate disagrees with the page trial. What response best supports collaboration?", options: ["Ignore them because the decision is written", "Ask them to stop reporting risks", "Ask what evidence or missing need could change the comparison", "Restart every task without discussing the concern"], correct: 2, explanation: "Exploring the evidence behind disagreement can improve the decision without turning it into a personal conflict." },
        { prompt: "The trial shows offline members still miss changes. What should the team do?", options: ["Hide the limitation in the final report", "Claim the original idea was proven perfect", "Stop measuring because results are inconvenient", "Revisit options using the new evidence"], correct: 3, explanation: "New evidence can justify adapting the choice or trying another option." },
        { prompt: "Which data collection is unnecessary for an anonymous room-finding count?", options: ["The total number of trial responses", "Members' names and home addresses", "The number who found the room", "The event being evaluated"], correct: 1, explanation: "Identities and home addresses are not needed to calculate the trial's anonymous outcome count." },
      ],
    },
  },
};

/** Cards intentionally expose descriptions only, not quiz keys to any learner player. */
export const DEMO_LESSON_STARTERS = DEMO_LESSON_IDS.map(id => ({
  id, title: starters[id].content.title, subject: starters[id].content.subject, description: starters[id].description,
}));

/** Unknown, repeated/array and prototype-property inputs never choose a fallback.
 * Each call returns a fresh draft, isolated from edits and subsequent selections.
 */
export function getDemoLessonStarter(value: unknown): DemoLessonStarter | null {
  return typeof value === "string" && Object.hasOwn(starters, value)
    ? structuredClone(starters[value as DemoLessonId])
    : null;
}
