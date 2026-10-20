import { z } from "zod";
import { lessonSchema } from "./learning";
import { curriculumSelectionSchema, validateCurriculumContent } from "./curriculum";

export const outlineSchema = z.object({
  title: lessonSchema.shape.title,
  summary: lessonSchema.shape.summary,
  plan: z.array(z.string().trim().min(1).max(100)).min(4).max(6),
}).strict();
export const slideSchema = lessonSchema.shape.slides.element.strict().refine(
  slide => slide.body.trim().split(/\s+/u).length <= 60, "Use at most 60 words per slide.",
);
export const activitySchema = lessonSchema.shape.activity.strict();
export const questionSchema = lessonSchema.shape.questions.element.refine(
  q => new Set(q.options.map(option => option.trim().toLowerCase())).size === 4,
  "Use four distinct options.",
);
export const questionBatchSchema = z.object({ questions: z.array(questionSchema).length(5) }).strict();
export const generationSchema = z.object({
  id: z.uuid(), owner_id: z.uuid(), revision: z.number().int().positive(),
  kind: z.enum(["studio", "import"]), objective: z.string().min(5).max(500),
  selection: curriculumSelectionSchema, source_text: z.string().max(20000).nullable(),
  parts: z.array(z.unknown()).max(10),
  attempts: z.array(z.object({
    request: z.uuid(), token: z.uuid(), stage: z.number().int(), revision: z.number().int(),
    lease: z.string(), outcome: z.enum(["pending", "complete", "failed", "expired"]),
  })).max(30),
  lesson_id: z.uuid().nullable(), deleted_at: z.string().nullable(),
});
export type Generation = z.infer<typeof generationSchema>;
export const generationSummarySchema = generationSchema.pick({ id: true, kind: true, objective: true, revision: true, lesson_id: true }).extend({
  part_count: z.number().int().min(0).max(10),
});
export type GenerationSummary = z.infer<typeof generationSummarySchema>;
export type GenerationState = { draft?: Generation; drafts?: GenerationSummary[]; error?: string; uncertain?: boolean; replay?: boolean; deleted?: boolean; missing?: boolean };

export function partSchema(draft: Pick<Generation, "parts">) {
  const index = draft.parts.length;
  if (index === 0) return outlineSchema;
  const outline = outlineSchema.parse(draft.parts[0]);
  if (index <= outline.plan.length) return slideSchema;
  if (index === outline.plan.length + 1) return activitySchema;
  if (index <= outline.plan.length + 3) return questionBatchSchema;
  throw new Error("All parts are saved. Finalize this lesson.");
}
export function stageLabel(draft: Pick<Generation, "parts">) {
  if (!draft.parts.length) return "Outline";
  const count = outlineSchema.parse(draft.parts[0]).plan.length;
  const index = draft.parts.length;
  return index <= count ? `Slide ${index} of ${count}` : index === count + 1 ? "Ordering activity" :
    index <= count + 3 ? `Quiz batch ${index - count - 1} of 2` : "Finalize lesson";
}
export function readyToFinalize(draft: Pick<Generation, "parts">) {
  return draft.parts.length > 0 && draft.parts.length === outlineSchema.parse(draft.parts[0]).plan.length + 4;
}
export function assembleLesson(draft: Generation) {
  if (!readyToFinalize(draft)) throw new Error("Save every part before finalizing.");
  const outline = outlineSchema.parse(draft.parts[0]);
  const n = outline.plan.length;
  return validateCurriculumContent(lessonSchema.parse({
    title: outline.title, summary: outline.summary, ...draft.selection,
    slides: draft.parts.slice(1, n + 1).map(part => slideSchema.parse(part)),
    activity: activitySchema.parse(draft.parts[n + 1]),
    questions: draft.parts.slice(n + 2).flatMap(part => questionBatchSchema.parse(part).questions),
  }));
}
