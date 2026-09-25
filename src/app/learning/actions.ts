"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accessibleLesson, currentUser, database, enrolledLesson, isAdmin, canEditLesson, canPublishLessons } from "@/lib/learning-server";
import { coachReply, generateLesson } from "@/lib/openrouter";
import { gradeQuiz, lessonSchema } from "@/lib/learning";
import { resumeSchema, type ResumeState } from "@/lib/resume";
import { requireAiAccess } from "@/lib/ai-eligibility-server";
import { isSdlcSubject } from "@/lib/recommendations";

export type ActionState = { error?: string; success?: string; lessonId?: string; attemptId?: string; score?: number; feedback?: { prompt: string; correct: string; explanation: string }[] };

function failure(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { error: `Please check your input: ${error.issues[0]?.message ?? "Invalid input."}` };
  if (error instanceof SyntaxError) return { error: "The lesson content could not be read. Please reload the editor." };
  return { error: error instanceof Error ? error.message : "The request failed. Please try again." };
}

export async function createLesson(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    await requireAiAccess(user);
    const topic = z.string().trim().min(5, "Describe a topic in at least five characters.").max(500).parse(form.get("topic"));
    const { data: allowed, error } = await database().rpc("forge_claim_request", { request_user: user.id });
    if (error) throw new Error("Generation is unavailable. Check the learning database migration.");
    if (!allowed) throw new Error("Your five daily generation requests have been used. Quiz retries are still unlimited.");
    const content = await generateLesson(topic);
    const { data, error: saveError } = await database().from("forge_lessons").insert({ owner_id: user.id, title: content.title, subject: content.subject, summary: content.summary, content }).select("id").single();
    if (saveError) throw new Error("Could not save the generated lesson.");
    revalidatePath("/dashboard"); revalidatePath("/catalog");
    return { success: "Your private lesson is ready. Enroll to begin.", lessonId: data.id };
  } catch (error) { return failure(error); }
}

export async function enroll(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    const id = z.uuid().parse(form.get("lessonId"));
    const lesson = await accessibleLesson(id, user);
    if (!lesson) throw new Error("Lesson not available.");
    const { error } = await database().from("forge_enrollments").upsert({ user_id: user.id, lesson_id: id, enrollment_kind: lesson.visibility }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    if (error) throw new Error("Enrollment failed. Please try again.");
    revalidatePath(`/courses/${id}`); revalidatePath("/dashboard");
    return { success: "Enrollment confirmed.", lessonId: id };
  } catch (error) { return failure(error); }
}

export async function saveBookmark(id: string, saved: boolean): Promise<ActionState> {
  try {
    const user = await currentUser();
    if (!await accessibleLesson(z.uuid().parse(id), user)) throw new Error("Lesson not available.");
    const client = database();
    const result = saved
      ? await client.from("forge_bookmarks").upsert({ user_id: user.id, lesson_id: id }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true })
      : await client.from("forge_bookmarks").delete().eq("user_id", user.id).eq("lesson_id", id);
    if (result.error) throw new Error("Could not update your bookmark.");
    revalidatePath("/progress");
    return { success: saved ? "Lesson saved." : "Bookmark removed." };
  } catch (error) { return failure(error); }
}

export async function attend(id: string): Promise<ActionState> {
  try {
    const user = await currentUser();
    const lesson = await enrolledLesson(z.uuid().parse(id), user);
    const { error } = await database().from("forge_enrollments").update({ attended_at: new Date().toISOString(), attendance_kind: lesson.visibility }).eq("user_id", user.id).eq("lesson_id", id).is("attended_at", null);
    if (error) throw new Error("Could not record attendance. Please try again.");
    revalidatePath("/progress");
    return { success: "Attendance recorded." };
  } catch (error) { return failure(error); }
}

export async function submitQuiz(id: string, version: number, answers: number[]): Promise<ActionState> {
  try {
    const user = await currentUser();
    const lesson = await enrolledLesson(z.uuid().parse(id), user);
    if (lesson.version !== version) throw new Error("This lesson has been updated. Reload the lesson before taking the quiz.");
    const { data: enrollment } = await database().from("forge_enrollments").select("attended_at").eq("user_id", user.id).eq("lesson_id", id).single();
    if (!enrollment?.attended_at) throw new Error("Reach the final quiz before submitting.");
    const result = gradeQuiz(lesson.content.questions, answers);
    const { data, error } = await database().from("forge_attempts").insert({
      user_id: user.id, lesson_id: id, original_lesson_id: id, lesson_title: lesson.title, lesson_version: lesson.version,
      certificate_kind: lesson.visibility, answers: result.answers, questions: lesson.content.questions, score: result.score,
    }).select("id").single();
    if (error) throw new Error("Could not save your quiz result. Please try again.");
    revalidatePath("/progress"); revalidatePath("/dashboard");
    return { score: result.score, attemptId: data.id, success: result.passed ? "Passed. Your certificate is ready." : "Keep practicing. You can retry as often as you need.", feedback: lesson.content.questions.map(question => ({ prompt: question.prompt, correct: question.options[question.correct], explanation: question.explanation })) };
  } catch (error) { return failure(error); }
}

export async function updateLesson(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    const id = z.uuid().parse(form.get("lessonId"));
    const lesson = await accessibleLesson(id, user, true);
    if (!lesson || !canEditLesson(user, lesson)) throw new Error("You cannot edit this lesson.");
    const content = lessonSchema.parse(JSON.parse(String(form.get("content"))));
    if (!isSdlcSubject(content.subject)) return { error: "Choose an SDLC subject, such as Software testing or Software design." };
    const expectedVersion = z.coerce.number().int().positive().parse(form.get("version"));
    const publish = form.get("publish") === "on";
    if (publish && !canPublishLessons(user)) throw new Error("Instructor access is required to publish lessons.");
    const { data, error } = await database().from("forge_lessons").update({ title: content.title, subject: content.subject, summary: content.summary, content, version: expectedVersion + 1, visibility: publish ? "public" : lesson.visibility, ...(publish ? { published_at: new Date().toISOString() } : {}) }).eq("id", id).eq("version", expectedVersion).select("id").maybeSingle();
    if (error) throw new Error("Could not save this lesson.");
    if (!data) throw new Error("This lesson changed in another session. Reload before editing.");
    revalidatePath("/catalog"); revalidatePath(`/courses/${id}`); revalidatePath("/admin"); revalidatePath("/studio");
    return { success: publish ? "Reviewed lesson published." : "Lesson saved.", lessonId: id };
  } catch (error) { return failure(error); }
}

export async function addReviewer(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    if (!isAdmin(user)) throw new Error("Administrator access required.");
    const lessonId = z.uuid().parse(form.get("lessonId"));
    const reviewerId = z.uuid().parse(form.get("reviewerId"));
    const lesson = await accessibleLesson(lessonId, user, true);
    if (lesson?.visibility !== "public") throw new Error("Only published lessons can have reviewers.");
    const { error } = await database().from("forge_reviewers").upsert({ lesson_id: lessonId, user_id: reviewerId });
    if (error) throw new Error("Could not grant access. Check the registered user's ID.");
    revalidatePath("/admin"); revalidatePath("/reports");
    return { success: "Results reviewer added." };
  } catch (error) { return failure(error); }
}

export async function removeReviewer(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    if (!isAdmin(user)) throw new Error("Administrator access required.");
    const lessonId = z.uuid().parse(form.get("lessonId"));
    const reviewerId = z.uuid().parse(form.get("reviewerId"));
    const { error } = await database().from("forge_reviewers").delete().eq("lesson_id", lessonId).eq("user_id", reviewerId);
    if (error) throw new Error("Could not revoke report access.");
    revalidatePath("/admin"); revalidatePath("/reports");
    return { success: "Report access revoked." };
  } catch (error) { return failure(error); }
}

export async function requestReview(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    const id = z.uuid().parse(form.get("lessonId"));
    const { data, error } = await database().from("forge_lessons").update({ review_requested: true }).eq("id", id).eq("owner_id", user.id).eq("visibility", "private").select("id").maybeSingle();
    if (error || !data) throw new Error("Could not submit this private lesson for review.");
    revalidatePath("/admin");
    return { success: "Submitted. Administrators can now review this lesson for publication." };
  } catch (error) { return failure(error); }
}

export async function createManualLesson(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    const content = lessonSchema.parse(JSON.parse(String(form.get("content"))));
    if (!isSdlcSubject(content.subject)) return { error: "Choose an SDLC subject, such as Software testing or Software design." };
    const publish = form.get("publish") === "on";
    if (publish && !canPublishLessons(user)) throw new Error("Instructor access required to publish.");
    const { data, error } = await database().from("forge_lessons").insert({ owner_id: user.id, title: content.title, subject: content.subject, summary: content.summary, content, visibility: publish ? "public" : "private", published_at: publish ? new Date().toISOString() : null }).select("id").single();
    if (error) throw new Error("Could not create this lesson. Check the database migration.");
    revalidatePath("/catalog"); revalidatePath("/dashboard");
    return { success: "Lesson created.", lessonId: data.id };
  } catch (error) { return failure(error); }
}

export async function askCoach(id: string, history: unknown): Promise<{ reply?: string; error?: string }> {
  try {
    const user = await currentUser();
    await requireAiAccess(user);
    const lesson = await enrolledLesson(z.uuid().parse(id), user);
    const messages = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1200) })).min(1).max(12).parse(history);
    if (messages.at(-1)?.role !== "user") throw new Error("Enter a question for your coach.");
    const { data: allowed, error } = await database().rpc("forge_claim_coach_request", { request_user: user.id });
    if (error) throw new Error("Coach service unavailable. Check the database migration.");
    if (!allowed) throw new Error("Your daily coach quota has been reached. Lessons and quizzes remain available.");
    return { reply: await coachReply(lesson.content.slides, messages) };
  } catch (error) { return failure(error); }
}

export async function saveResume(id: string, version: number, revision: number, state: ResumeState): Promise<{ revision?: number; error?: string; conflict?: boolean }> {
  try {
    const user = await currentUser();
    const lesson = await enrolledLesson(z.uuid().parse(id), user);
    if (lesson.version !== version) return { error: "This lesson changed. Reload to start at the updated version.", conflict: true };
    z.number().int().min(0).parse(revision);
    const progress = resumeSchema.parse(state);
    if (progress.slide >= lesson.content.slides.length || progress.ordering.length !== lesson.content.activity.steps.length || new Set(progress.ordering).size !== progress.ordering.length || progress.ordering.some(index => index >= progress.ordering.length)) throw new Error("Invalid lesson position.");
    const client = database();
    const values = { lesson_version: version, stage: progress.stage, slide: progress.slide, ordering: progress.ordering, answers: progress.answers, updated_at: new Date().toISOString() };
    if (revision === 0) {
      const { data, error } = await client.from("forge_resume").insert({ user_id: user.id, lesson_id: id, ...values }).select("revision").single();
      if (error?.code === "23505") return { error: "Progress changed on another device. Reload before continuing.", conflict: true };
      if (error || !data) throw new Error("Could not save progress.");
      return { revision: data.revision };
    }
    const { data, error } = await client.from("forge_resume").update({ ...values, revision: revision + 1 }).eq("user_id", user.id).eq("lesson_id", id).eq("revision", revision).select("revision").maybeSingle();
    if (error) throw new Error("Could not save progress.");
    if (!data) return { error: "Progress changed on another device. Reload before continuing.", conflict: true };
    return { revision: data.revision };
  } catch {
    return { error: "Could not save progress. Try again when your connection is restored." };
  }
}