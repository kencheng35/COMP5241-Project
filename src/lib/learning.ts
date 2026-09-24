import { z } from "zod";

export const lessonSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subject: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(10).max(300),
  slides: z.array(z.object({
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(400),
    example: z.string().min(1).max(240),
  })).min(4).max(6),
  activity: z.object({
    prompt: z.string().min(1).max(240),
    steps: z.array(z.string().min(1).max(120)).min(3).max(6),
  }),
  questions: z.array(z.object({
    prompt: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(200)).length(4),
    correct: z.number().int().min(0).max(3),
    explanation: z.string().min(1).max(400),
  })).length(10),
});

export type LessonContent = z.infer<typeof lessonSchema>;

export async function collectRows<Row>(readPage: (start: number, end: number) => PromiseLike<{ data: Row[] | null; error: unknown }>) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await readPage(offset, offset + 499);
    if (error || !data) throw new Error("Could not load complete learning records. Check the database migrations and try again.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export function gradeQuiz(questions: LessonContent["questions"], answers: unknown) {
  const validated = z.array(z.number().int().min(0).max(3)).length(10).parse(answers);
  if (questions.length !== 10) throw new Error("A quiz must contain exactly ten questions.");
  const score = questions.reduce((total, question, index) => total + Number(question.correct === validated[index]), 0);
  return { score, total: 10, passed: score >= 6, answers: validated };
}

export function safeDestination(value: string | null, origin: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\") || /%(?:2f|5c|25)/i.test(value.split("?")[0])) return "/dashboard";
  try {
    const destination = new URL(value, origin);
    return destination.origin === new URL(origin).origin ? destination.pathname + destination.search : "/dashboard";
  } catch {
    return "/dashboard";
  }
}