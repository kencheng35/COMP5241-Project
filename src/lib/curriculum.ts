import { z } from "zod";

/** Tracker08: content.metadata v1; no DDL/backfill. Old writers can strip metadata.
 * Audience describes suitability, never access. Resources/semantic correctness still need owner review.
 * Missing/unknown legacy metadata is NOT beginner/everyone/no-prerequisites.
 */
export const FAMILIES = {
  sdlc: "Software Development Life Cycle",
  "coding-agents": "AI Coding-Agent Skills",
  "soft-product": "Software Development Soft and Product Skills",
} as const;
export type Family = keyof typeof FAMILIES;
export const TOPICS = ["overview", "requirements", "design", "implementation", "testing", "deployment", "maintenance", "coding-agents", "soft-product"] as const;
export type Topic = typeof TOPICS[number];
export const TOPIC_LABELS: Record<Topic, string> = {
  overview: "SDLC overview / planning", requirements: "Requirements", design: "Design", implementation: "Implementation",
  testing: "Testing", deployment: "Deployment", maintenance: "Maintenance",
  "coding-agents": FAMILIES["coding-agents"], "soft-product": FAMILIES["soft-product"],
};
export const AUDIENCES = { learners: "University learners", instructors: "Instructors", both: "Learners and instructors" } as const;
export const DIFFICULTIES = { new: "New", foundation: "Foundation", intermediate: "Intermediate", advanced: "Advanced" } as const;
const aliases: Record<string, Topic> = {
  sdlc: "overview", "software development lifecycle": "overview", "software development life cycle": "overview",
  "software engineering": "overview", "software development": "overview", "software requirements": "requirements",
  "requirements engineering": "requirements", "software design": "design", "software architecture": "design",
  "software implementation": "implementation", "software testing": "testing", "software quality assurance": "testing",
  "software deployment": "deployment", "software maintenance": "maintenance", devops: "deployment",
};
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
export function subjectSelection(subject: string): { family: Family; topic: Topic } | null {
  const value = normalize(subject);
  for (const family of ["coding-agents", "soft-product"] as const) {
    if (value === normalize(FAMILIES[family])) return { family, topic: family };
  }
  const prefixed = /^sdlc\s*[:\-]\s*(overview|requirements|design|implementation|testing|deployment|maintenance)$/.exec(value);
  const topic = (Object.hasOwn(aliases, value) ? aliases[value] : prefixed?.[1]) as Topic | undefined;
  return topic ? { family: "sdlc", topic } : null;
}
export function topicFamily(topic: Topic): Family {
  return topic === "coding-agents" || topic === "soft-product" ? topic : "sdlc";
}
const entry = z.string().trim().min(1).max(240).refine(value => !/[<>\u0000-\u001f]/.test(value), "Use bounded plain text, without markup or control characters.");
export const metadataSchema = z.object({
  version: z.literal(1),
  audience: z.enum(["learners", "instructors", "both"]),
  difficulty: z.enum(["new", "foundation", "intermediate", "advanced"]),
  topic: z.enum(TOPICS),
  outcomes: z.array(entry).min(1).max(8),
  prerequisites: z.array(entry).max(8),
}).strict();
export type CurriculumMetadata = z.infer<typeof metadataSchema>;
export function readMetadata(subject: string, value: unknown): CurriculumMetadata | null {
  const parsed = metadataSchema.safeParse(value);
  const selection = subjectSelection(subject);
  return parsed.success && selection && topicFamily(parsed.data.topic) === selection.family ? parsed.data : null;
}
export const curriculumSelectionSchema = z.object({
  subject: z.enum([FAMILIES.sdlc, FAMILIES["coding-agents"], FAMILIES["soft-product"]]),
  metadata: metadataSchema,
}).superRefine((value, context) => {
  if (!readMetadata(value.subject, value.metadata)) context.addIssue({ code: "custom", path: ["metadata", "topic"], message: "Choose a topic in the selected subject family." });
});
export function selectionFromForm(form: FormData) {
  return curriculumSelectionSchema.parse({
    subject: form.get("subject"),
    metadata: { version: 1, audience: form.get("audience"), difficulty: form.get("difficulty"), topic: form.get("curriculumTopic"),
      outcomes: String(form.get("outcomes") ?? "").split("\n").map(line => line.trim()).filter(Boolean),
      prerequisites: String(form.get("prerequisites") ?? "").split("\n").map(line => line.trim()).filter(Boolean) },
  });
}
export type CurriculumSelection = z.infer<typeof curriculumSelectionSchema>;
/** Compose at write boundaries AFTER lessonSchema.parse. Keeping curriculum and learning
 * as independent leaf modules preserves direct Node strip-types consumers (including export).
 * Reads tolerate legacy metadata; writes must explicitly validate the v1 curriculum portion.
 */
export function validateCurriculumContent<T extends { subject: string; metadata?: unknown }>(content: T) {
  return { ...content, ...curriculumSelectionSchema.parse(content) };
}
export type CatalogFilters = { q?: string; subject?: string; audience?: string; difficulty?: string; visibility?: string };
export function filterLessons<T extends { title: string; summary: string; subject: string; metadata?: unknown; visibility: string }>(lessons: readonly T[], filters: CatalogFilters): T[] {
  return lessons.filter(lesson => {
    const metadata = readMetadata(lesson.subject, lesson.metadata);
    const family = subjectSelection(lesson.subject)?.family;
    return `${lesson.title} ${lesson.summary} ${lesson.subject}`.toLowerCase().includes((filters.q ?? "").trim().toLowerCase()) &&
      (!filters.subject || (family ? FAMILIES[family] : lesson.subject) === filters.subject) &&
      (!filters.audience || metadata?.audience === filters.audience || metadata?.audience === "both" && filters.audience !== "both") &&
      (!filters.difficulty || metadata?.difficulty === filters.difficulty) &&
      (!filters.visibility || lesson.visibility === filters.visibility);
  });
}
