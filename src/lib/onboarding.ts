import { z } from "zod";
import { diagnosticSummarySchema, levels, type SetupRole } from "./diagnostic";

export const backgroundChoices = {
  learner: [
    ["starting", "Starting out — little or no software-development practice"],
    ["coursework", "Coursework — some guided exercises or small projects"],
    ["projects", "Independent projects — building and debugging with less guidance"],
  ],
  instructor: [
    ["new-teaching", "New to teaching software development"],
    ["teaching", "Teaching courses or supporting project work"],
    ["curriculum", "Designing curriculum or mentoring other educators"],
  ],
} as const;
export const goalChoices = {
  learner: [
    ["sdlc", "Understand and apply the software-development lifecycle"],
    ["agents", "Use coding agents critically and responsibly"],
    ["teamwork", "Practise teamwork and product decisions"],
  ],
  instructor: [
    ["scaffold", "Design scaffolded learning activities"],
    ["assessment", "Assess understanding when learners use coding agents"],
    ["feedback", "Give actionable feedback and improve lessons"],
  ],
} as const;

export const backgroundSchema = z.strictObject({
  version: z.literal(1), role: z.enum(["learner", "instructor"]),
  experience: z.string().max(30), goals: z.array(z.string().max(30)).min(1).max(3),
}).refine(value =>
  backgroundChoices[value.role].some(([id]) => id === value.experience) &&
  value.goals.every(goal => goalChoices[value.role].some(([id]) => id === goal)) &&
  new Set(value.goals).size === value.goals.length);
export type Background = z.infer<typeof backgroundSchema>;
export const revisionSchema = z.number().int().min(0).max(2147483646);
export const onboardingInputSchema = z.strictObject({
  revision: revisionSchema, role: z.enum(["learner", "instructor"]),
  experience: z.string().max(30), goals: z.array(z.string().max(30)).min(1).max(3), level: z.enum(levels),
}).refine(value => backgroundSchema.safeParse({ version: 1, role: value.role, experience: value.experience, goals: value.goals }).success);
export const diagnosticInputSchema = z.strictObject({
  revision: revisionSchema, role: z.enum(["learner", "instructor"]),
  answers: z.array(z.number().int().min(0).max(2)).length(6),
});
export const levelInputSchema = z.strictObject({
  revision: revisionSchema, role: z.enum(["learner", "instructor"]),
  decision: z.enum(["adopt", "override"]), level: z.enum(levels),
});
export const setupProfileSchema = z.object({
  id: z.string().min(1), learning_level: z.string().nullable(),
  learning_setup_revision: revisionSchema,
  onboarding_completed_at: z.iso.datetime({ offset: true }).nullable(),
  onboarding_background: backgroundSchema.nullable(),
  diagnostic_summary: diagnosticSummarySchema.nullable(),
}).refine(value => (value.onboarding_completed_at === null) === (value.onboarding_background === null));
export type SetupProfile = z.infer<typeof setupProfileSchema>;
export type SetupCode = "loaded" | "saved" | "invalid" | "auth" | "unavailable" | "schema" | "missing" | "conflict" | "unknown" | "rejected";
export type SetupResult = { code: SetupCode; message: string; profile?: SetupProfile; role?: SetupRole };
export const setupMessages: Record<SetupCode, string> = {
  loaded: "Saved version reloaded. Your draft choices are still shown; compare before saving.",
  saved: "Saved.",
  invalid: "Check all choices. Your account role may have changed; reload before changing role-specific answers.",
  auth: "Your session could not be verified. Log in again; your current choices remain here.",
  unavailable: "Could not load your learning setup. No save was attempted. Try loading again.",
  schema: "Learning setup is unavailable. An administrator must check the onboarding/diagnostic migration and database access. No save was confirmed.",
  missing: "Your profile is missing. Contact support; no profile or age has been invented. Account controls remain available.",
  conflict: "A newer profile or diagnostic change was found. Nothing from this submission was saved. Reload the saved version before trying again.",
  unknown: "Could not confirm whether this was saved. Do not resubmit yet. Reload the saved version and compare; your current choices remain here.",
  rejected: "The database rejected this change. Review your profile (including age) or contact support. Your current choices remain here.",
};
export function setupFailure(code: SetupCode): SetupResult { return { code, message: setupMessages[code] }; }
export function setupRole(user: { app_metadata?: Record<string, unknown> }): SetupRole {
  return user.app_metadata?.role === "instructor" || user.app_metadata?.role === "admin" ? "instructor" : "learner";
}
