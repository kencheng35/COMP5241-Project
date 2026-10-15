import { z } from "zod";

// Draft educational content: project-owner pedagogical review is still required.
// This is a small local orientation aid, not a grade, credential or AI assessment.
export const rubricVersion = "draft-2026-10-v1" as const;
export const levels = ["new", "foundation", "intermediate", "advanced"] as const;
export const levelLabels = { new: "New to the subject", foundation: "Foundation", intermediate: "Intermediate", advanced: "Advanced" };
export type Level = typeof levels[number];
export type SetupRole = "learner" | "instructor";
type Question = { id: string; prompt: string; choices: readonly string[]; correct: number; explanation: string };
const shared: Question[] = [
  { id: "requirements", prompt: "A project request is unclear. What is the best first step?", choices: ["Start implementing immediately", "Clarify the user's goal and acceptance criteria", "Choose a framework by popularity"], correct: 1, explanation: "Clarify goals and acceptance criteria before implementation." },
  { id: "testing", prompt: "An AI coding agent proposes a fix. What should happen before accepting it?", choices: ["Review the diff and run relevant tests", "Trust a confident explanation", "Skip tests if it compiles"], correct: 0, explanation: "Inspect the change and test its behavior; compilation alone is not enough." },
  { id: "privacy", prompt: "Which input is appropriate for an external coding assistant?", choices: ["A production access token", "A real student's private record", "A minimal synthetic example with no secrets"], correct: 2, explanation: "Use minimal synthetic examples, not secrets or private records." },
];
export const diagnosticQuestions: Record<SetupRole, readonly Question[]> = {
  learner: [...shared,
    { id: "debugging", prompt: "A bug appears only for an empty list. What is a useful next step?", choices: ["Remove the empty-list case", "Reproduce it and add a boundary-case test", "Rewrite the whole application"], correct: 1, explanation: "Reproduce the boundary case and protect the fix with a test." },
    { id: "delegation", prompt: "How would you delegate a small task to a coding agent?", choices: ["Give an unlimited task and accept all edits", "Ask it to hide failures", "Define scope, constraints and a focused check"], correct: 2, explanation: "Bounded scope, constraints and checks make delegated work reviewable." },
    { id: "collaboration", prompt: "A teammate proposes a risky change near a deadline. What helps?", choices: ["Explain the trade-off and agree on a testable smaller change", "Merge without discussion", "Avoid mentioning the risk"], correct: 0, explanation: "Communicate trade-offs and agree on evidence for a bounded change." },
  ],
  instructor: [...shared,
    { id: "evidence", prompt: "A learner submits AI-generated code that runs. What evidence best checks understanding?", choices: ["The amount of generated code", "The tool's confidence", "An explanation, a modification and relevant tests"], correct: 2, explanation: "Explanations, modifications and tests provide evidence beyond a runnable artifact." },
    { id: "scaffolding", prompt: "Learners have different starting experience. What is a useful teaching response?", choices: ["Offer scaffolded practice with explicit outcomes", "Assign identical advanced work without support", "Infer ability from account age"], correct: 0, explanation: "Use explicit outcomes and scaffolded practice rather than demographic inference." },
    { id: "review", prompt: "An agent suggests a lesson revision. What should the instructor do?", choices: ["Publish automatically", "Review accuracy, accessibility and alignment before accepting", "Remove the original without comparison"], correct: 1, explanation: "Instructor review should check accuracy, accessibility and alignment before publication." },
  ],
};

export function suggestedLevel(score: number): Level {
  if (!Number.isInteger(score) || score < 0 || score > 6) throw new Error("Invalid diagnostic score.");
  return score <= 1 ? "new" : score <= 3 ? "foundation" : score <= 5 ? "intermediate" : "advanced";
}

export const diagnosticSummarySchema = z.strictObject({
  rubric_version: z.literal(rubricVersion),
  role: z.enum(["learner", "instructor"]),
  score: z.number().int().min(0).max(6),
  total: z.literal(6),
  suggested_level: z.enum(levels),
  completed_at: z.iso.datetime(),
}).refine(value => Number.isInteger(value.score) && value.score >= 0 && value.score <= 6 &&
  suggestedLevel(value.score) === value.suggested_level);
export type DiagnosticSummary = z.infer<typeof diagnosticSummarySchema>;

export function scoreDiagnostic(role: SetupRole, answers: unknown, now = new Date()): DiagnosticSummary {
  const validated = z.array(z.number().int().min(0).max(2)).length(6).parse(answers);
  const score = diagnosticQuestions[role].reduce((sum, question, index) => sum + Number(validated[index] === question.correct), 0);
  return { rubric_version: rubricVersion, role, score, total: 6, suggested_level: suggestedLevel(score), completed_at: now.toISOString() };
}

export function explainDiagnostic(summary: DiagnosticSummary) {
  return `${summary.score}/6 suggests ${levelLabels[summary.suggested_level]}. Draft rubric: 0–1 New, 2–3 Foundation, 4–5 Intermediate, 6 Advanced. This short ${summary.role} check samples SDLC, responsible AI use and collaboration; it does not establish mastery. Your chosen level stays unchanged until you explicitly adopt or override the suggestion.`;
}
